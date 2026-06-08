const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(__dirname, "reset-hr1-auth-password.cjs");
const scriptSource = fs.readFileSync(scriptPath, "utf8");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

assert.match(scriptSource, /hr1@nesto\.com/);
assert.match(scriptSource, /auth\.admin\.listUsers/);
assert.match(scriptSource, /auth\.admin\.updateUserById/);
assert.doesNotMatch(scriptSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(scriptSource, /\.from\("participants"\)/);
assert.doesNotMatch(scriptSource, /\.from\("report"/i);
assert.doesNotMatch(scriptSource, /OpenAI|openai/i);

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;

    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return emptyModulePath;
  }

  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      resolveWithExtensions(path.join(projectRoot, request.slice(2))),
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  TARGET_EMAIL,
  CONFIRM_ENV,
  PASSWORD_ENV,
  isResetConfirmed,
  getConfirmedNewPassword,
  findAuthUserByEmail,
  resetHr1AuthPassword,
} = require("./reset-hr1-auth-password.cjs");

function buildSupabaseStub() {
  const calls = {
    listUsers: [],
    updateUserById: [],
  };

  const supabase = {
    auth: {
      admin: {
        listUsers: async (options) => {
          calls.listUsers.push(options);
          return {
            data: { users: [{ id: "auth-user-1", email: TARGET_EMAIL }] },
            error: null,
          };
        },
        updateUserById: async (userId, payload) => {
          calls.updateUserById.push({ userId, payload });
          return {
            data: { user: { id: userId, email: TARGET_EMAIL } },
            error: null,
          };
        },
      },
    },
  };

  return { supabase, calls };
}

async function main() {
  assert.equal(isResetConfirmed({ [CONFIRM_ENV]: "true" }), true);
  assert.equal(isResetConfirmed({ [CONFIRM_ENV]: "false" }), false);

  assert.throws(() => getConfirmedNewPassword({}), /Missing required env var/i);
  assert.equal(getConfirmedNewPassword({ [PASSWORD_ENV]: " new-pass " }), "new-pass");

  const { supabase, calls } = buildSupabaseStub();
  const foundUser = await findAuthUserByEmail(supabase, TARGET_EMAIL);

  assert.equal(foundUser?.id, "auth-user-1");
  assert.equal(calls.listUsers.length > 0, true);

  const noOp = await resetHr1AuthPassword({
    supabase: buildSupabaseStub().supabase,
    env: {},
  });

  assert.deepEqual(noOp, {
    ok: true,
    action: "noop_not_confirmed",
    email: TARGET_EMAIL,
    wrote: false,
  });

  const missingPasswordEnv = {
    [CONFIRM_ENV]: "true",
  };

  assert.rejects(
    () => resetHr1AuthPassword({ supabase: buildSupabaseStub().supabase, env: missingPasswordEnv }),
    /Missing required env var/i,
  );

  const { supabase: confirmedSupabase, calls: confirmedCalls } = buildSupabaseStub();
  const updated = await resetHr1AuthPassword({
    supabase: confirmedSupabase,
    env: {
      [CONFIRM_ENV]: "true",
      [PASSWORD_ENV]: "top-secret-password",
    },
  });

  assert.deepEqual(updated, {
    ok: true,
    action: "updated",
    email: TARGET_EMAIL,
    userId: "auth-user-1",
    wrote: true,
  });
  assert.equal(confirmedCalls.updateUserById.length, 1);
  assert.equal(confirmedCalls.updateUserById[0].userId, "auth-user-1");
  assert.equal(confirmedCalls.updateUserById[0].payload.password, "top-secret-password");

  const missingUserSupabase = {
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: [] }, error: null }),
        updateUserById: async () => {
          throw new Error("updateUserById should not be called when user is missing.");
        },
      },
    },
  };

  await assert.rejects(
    () =>
      resetHr1AuthPassword({
        supabase: missingUserSupabase,
        env: {
          [CONFIRM_ENV]: "true",
          [PASSWORD_ENV]: "top-secret-password",
        },
      }),
    /Supabase Auth user not found for hr1@nesto.com/i,
  );

  console.log("test-reset-hr1-auth-password: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
