const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const TARGET_EMAIL = "hr1@nesto.com";
const CONFIRM_ENV = "CONFIRM_HR1_PASSWORD_RESET";
const PASSWORD_ENV = "NEW_HR1_PASSWORD";

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

function isResetConfirmed(env = process.env) {
  return env[CONFIRM_ENV]?.trim().toLowerCase() === "true";
}

function getConfirmedNewPassword(env = process.env) {
  const value = env[PASSWORD_ENV]?.trim();

  if (!value) {
    throw new Error(`Missing required env var: ${PASSWORD_ENV}`);
  }

  return value;
}

async function findAuthUserByEmail(supabase, email) {
  const targetEmail = email.toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Failed to list Supabase Auth users: ${error.message}`);
    }

    const users = Array.isArray(data?.users) ? data.users : [];
    const found = users.find((user) => user.email?.toLowerCase() === targetEmail);

    if (found) {
      return found;
    }

    if (users.length < perPage) {
      return null;
    }
  }

  return null;
}

async function resetHr1AuthPassword({ supabase, env = process.env } = {}) {
  if (!isResetConfirmed(env)) {
    return {
      ok: true,
      action: "noop_not_confirmed",
      email: TARGET_EMAIL,
      wrote: false,
    };
  }

  const nextPassword = getConfirmedNewPassword(env);
  const admin = supabase ?? require("../lib/supabase/admin.ts").createSupabaseAdminClient();
  const user = await findAuthUserByEmail(admin, TARGET_EMAIL);

  if (!user) {
    throw new Error(`Supabase Auth user not found for ${TARGET_EMAIL}.`);
  }

  const { data, error } = await admin.auth.admin.updateUserById(user.id, {
    password: nextPassword,
  });

  if (error) {
    throw new Error(`Failed to update Supabase Auth password for ${TARGET_EMAIL}: ${error.message}`);
  }

  if (!data?.user?.id) {
    throw new Error(`Supabase Auth update did not return a user for ${TARGET_EMAIL}.`);
  }

  return {
    ok: true,
    action: "updated",
    email: TARGET_EMAIL,
    userId: data.user.id,
    wrote: true,
  };
}

async function main() {
  const result = await resetHr1AuthPassword();
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  TARGET_EMAIL,
  CONFIRM_ENV,
  PASSWORD_ENV,
  isResetConfirmed,
  getConfirmedNewPassword,
  findAuthUserByEmail,
  resetHr1AuthPassword,
};
