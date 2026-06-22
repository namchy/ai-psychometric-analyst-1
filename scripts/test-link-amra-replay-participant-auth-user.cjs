const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(__dirname, "link-amra-replay-participant-auth-user.cjs");
const scriptSource = fs.readFileSync(scriptPath, "utf8");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

assert.match(scriptSource, /CONFIRM_AMRA_REPLAY_PARTICIPANT_AUTH_LINK/);
assert.match(scriptSource, /AMRA_REPLAY_PARTICIPANT_PASSWORD/);
assert.match(scriptSource, /a5678fd5-8fea-4308-8569-5448f26b4f71/);
assert.match(scriptSource, /amra\.new1@example\.test/);
assert.match(scriptSource, /5d93f3a1-3765-4ec4-b668-c0d1228a8445/);
assert.match(scriptSource, /033f8975-5d9c-4c66-8842-f37527d556d5/);
assert.doesNotMatch(scriptSource, /https:\/\/api\.openai\.com|attempt_reports|report_snapshot/i);

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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  CONFIRM_ENV,
  PASSWORD_ENV,
  TARGET,
  evaluateReplayTarget,
  getConfirmedPassword,
  isConfirmed,
  linkParticipantUserId,
  loadExactReplayAssignment,
  loadExactReplayParticipant,
  listAuthUsersByEmail,
  runLinkParticipantAuthUser,
} = require(scriptPath);

function buildEnv(extra = {}) {
  return {
    NODE_ENV: "development",
    ...extra,
  };
}

function buildSupabaseStub(options = {}) {
  const calls = {
    listUsers: [],
    createUser: [],
    updateUserById: [],
    participantSelect: [],
    participantUpdate: [],
    assignmentSelect: [],
  };

  const authUsers = options.authUsers ?? [];
  const participantRow =
    options.participantRow ?? {
      id: TARGET.participantId,
      organization_id: TARGET.organizationId,
      email: TARGET.participantEmail,
      full_name: "Amra Replay Fixture 1",
      user_id: null,
    };
  const assignmentRow =
    options.assignmentRow ?? {
      id: TARGET.assignmentId,
      organization_id: TARGET.organizationId,
      participant_id: TARGET.participantId,
      assignment_type: "standard_battery",
      status: "completed",
      metadata: { fixture: "amra_replay_fixture_v1" },
    };

  const supabase = {
    auth: {
      admin: {
        listUsers: async ({ page, perPage }) => {
          calls.listUsers.push({ page, perPage });
          return {
            data: { users: authUsers },
            error: null,
          };
        },
        createUser: async (payload) => {
          calls.createUser.push(payload);
          return {
            data: { user: { id: "new-auth-user-id", email: payload.email } },
            error: null,
          };
        },
        updateUserById: async (userId, payload) => {
          calls.updateUserById.push({ userId, payload });
          return {
            data: { user: { id: userId, email: payload.email ?? TARGET.participantEmail } },
            error: null,
          };
        },
      },
    },
    from(table) {
      if (table === "participants") {
        const state = { filters: {}, updatePayload: null };
        return {
          select() {
            return this;
          },
          eq(column, value) {
            state.filters[column] = value;
            calls.participantSelect.push({ column, value });
            return this;
          },
          maybeSingle: async () => {
            const matches =
              state.filters.id === participantRow.id &&
              (!state.filters.organization_id || state.filters.organization_id === participantRow.organization_id) &&
              (!state.filters.email || state.filters.email === participantRow.email);
            return {
              data: matches ? participantRow : null,
              error: null,
            };
          },
          update(payload) {
            state.updatePayload = payload;
            return this;
          },
          async single() {
            calls.participantUpdate.push({
              filters: { ...state.filters },
              payload: state.updatePayload,
            });
            return {
              data: {
                ...participantRow,
                ...(state.updatePayload ?? {}),
              },
              error: null,
            };
          },
        };
      }

      if (table === "assessment_assignments") {
        const state = { filters: {} };
        return {
          select() {
            return this;
          },
          eq(column, value) {
            state.filters[column] = value;
            calls.assignmentSelect.push({ column, value });
            return this;
          },
          async maybeSingle() {
            const matches =
              state.filters.id === assignmentRow.id &&
              assignmentRow.organization_id === TARGET.organizationId &&
              assignmentRow.participant_id === TARGET.participantId;
            return {
              data: matches ? assignmentRow : null,
              error: null,
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return { supabase, calls };
}

async function main() {
  assert.equal(isConfirmed({ [CONFIRM_ENV]: "true" }), true);
  assert.equal(isConfirmed({ [CONFIRM_ENV]: "false" }), false);
  assert.throws(() => getConfirmedPassword({}), /Missing required env var/i);
  assert.equal(getConfirmedPassword({ [PASSWORD_ENV]: "  secret  " }), "secret");
  assert.equal(
    evaluateReplayTarget(
      {
        id: TARGET.participantId,
        organization_id: TARGET.organizationId,
        email: TARGET.participantEmail,
      },
      {
        id: TARGET.assignmentId,
        organization_id: TARGET.organizationId,
        participant_id: TARGET.participantId,
      },
    ),
    true,
  );
  assert.equal(evaluateReplayTarget(null, null), false);

  const blockedConfirmation = await runLinkParticipantAuthUser({
    env: buildEnv(),
    deps: {
      createSupabaseAdminClient() {
        throw new Error("createSupabaseAdminClient should not run when confirmation is missing.");
      },
    },
  });
  assert.equal(blockedConfirmation.status, "blocked_confirmation_required");
  assert.equal(blockedConfirmation.databaseWrites, false);
  assert.equal(blockedConfirmation.openAiCalled, false);

  const blockedPassword = await runLinkParticipantAuthUser({
    env: buildEnv({
      [CONFIRM_ENV]: "true",
    }),
    deps: {
      createSupabaseAdminClient() {
        throw new Error("createSupabaseAdminClient should not run when password is missing.");
      },
    },
  });
  assert.equal(blockedPassword.status, "blocked_password_required");
  assert.equal(blockedPassword.databaseWrites, false);
  assert.equal(blockedPassword.openAiCalled, false);

  const wrongTarget = await runLinkParticipantAuthUser({
    env: buildEnv({
      [CONFIRM_ENV]: "true",
      [PASSWORD_ENV]: "top-secret-password",
    }),
    deps: {
      createSupabaseAdminClient() {
        return buildSupabaseStub({
          participantRow: {
            id: TARGET.participantId,
            organization_id: "wrong-org",
            email: TARGET.participantEmail,
            full_name: "Amra Replay Fixture 1",
            user_id: null,
          },
        }).supabase;
      },
    },
  });
  assert.equal(wrongTarget.status, "blocked_target_mismatch");
  assert.equal(wrongTarget.databaseWrites, false);

  const wrongEmailTarget = await runLinkParticipantAuthUser({
    env: buildEnv({
      [CONFIRM_ENV]: "true",
      [PASSWORD_ENV]: "top-secret-password",
    }),
    deps: {
      createSupabaseAdminClient() {
        return buildSupabaseStub({
          participantRow: {
            id: TARGET.participantId,
            organization_id: TARGET.organizationId,
            email: "wrong@example.test",
            full_name: "Amra Replay Fixture 1",
            user_id: null,
          },
        }).supabase;
      },
    },
  });
  assert.equal(wrongEmailTarget.status, "blocked_target_mismatch");

  const wrongParticipantTarget = await runLinkParticipantAuthUser({
    env: buildEnv({
      [CONFIRM_ENV]: "true",
      [PASSWORD_ENV]: "top-secret-password",
    }),
    deps: {
      createSupabaseAdminClient() {
        return buildSupabaseStub({
          participantRow: {
            id: "wrong-participant-id",
            organization_id: TARGET.organizationId,
            email: TARGET.participantEmail,
            full_name: "Amra Replay Fixture 1",
            user_id: null,
          },
        }).supabase;
      },
    },
  });
  assert.equal(wrongParticipantTarget.status, "blocked_target_mismatch");

  const wrongAssignmentTarget = await runLinkParticipantAuthUser({
    env: buildEnv({
      [CONFIRM_ENV]: "true",
      [PASSWORD_ENV]: "top-secret-password",
    }),
    deps: {
      createSupabaseAdminClient() {
        return buildSupabaseStub({
          assignmentRow: {
            id: TARGET.assignmentId,
            organization_id: TARGET.organizationId,
            participant_id: "wrong-participant",
            assignment_type: "standard_battery",
            status: "completed",
            metadata: { fixture: "amra_replay_fixture_v1" },
          },
        }).supabase;
      },
    },
  });
  assert.equal(wrongAssignmentTarget.status, "blocked_target_mismatch");

  const existingStub = buildSupabaseStub({
    authUsers: [{ id: "auth-user-1", email: TARGET.participantEmail }],
  });
  const existingResult = await runLinkParticipantAuthUser({
    env: buildEnv({
      [CONFIRM_ENV]: "true",
      [PASSWORD_ENV]: "top-secret-password",
    }),
    deps: {
      createSupabaseAdminClient() {
        return existingStub.supabase;
      },
    },
  });
  assert.equal(existingResult.status, "linked");
  assert.equal(existingResult.authUserUpdated, true);
  assert.equal(existingResult.authUserCreated, false);
  assert.equal(existingResult.participantLinked, true);
  assert.equal(existingResult.authUserId, "auth-user-1");
  assert.equal(existingResult.databaseWrites, true);
  assert.equal(existingResult.openAiCalled, false);
  assert.equal(existingResult.reportsGenerated, false);
  assert.equal(existingResult.originalAmraTouched, false);
  assert.equal(existingStub.calls.updateUserById.length, 1);
  assert.equal(existingStub.calls.updateUserById[0].userId, "auth-user-1");
  assert.equal(existingStub.calls.updateUserById[0].payload.password, "top-secret-password");
  assert.equal(existingStub.calls.participantUpdate.length, 1);
  assert.equal(existingStub.calls.participantUpdate[0].filters.id, TARGET.participantId);
  assert.equal(existingStub.calls.participantUpdate[0].filters.organization_id, TARGET.organizationId);
  assert.equal(existingStub.calls.participantUpdate[0].payload.user_id, "auth-user-1");

  const createStub = buildSupabaseStub({ authUsers: [] });
  const createResult = await runLinkParticipantAuthUser({
    env: buildEnv({
      [CONFIRM_ENV]: "true",
      [PASSWORD_ENV]: "top-secret-password",
    }),
    deps: {
      createSupabaseAdminClient() {
        return createStub.supabase;
      },
    },
  });
  assert.equal(createResult.status, "linked");
  assert.equal(createResult.authUserCreated, true);
  assert.equal(createResult.authUserUpdated, false);
  assert.equal(createResult.participantLinked, true);
  assert.equal(createResult.authUserId, "new-auth-user-id");
  assert.equal(createStub.calls.createUser.length, 1);
  assert.equal(createStub.calls.createUser[0].email, TARGET.participantEmail);
  assert.equal(createStub.calls.createUser[0].password, "top-secret-password");
  assert.equal(createStub.calls.createUser[0].email_confirm, true);
  assert.equal(createStub.calls.participantUpdate.length, 1);

  console.log("test-link-amra-replay-participant-auth-user: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
