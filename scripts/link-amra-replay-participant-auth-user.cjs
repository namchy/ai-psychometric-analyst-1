const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_AMRA_REPLAY_PARTICIPANT_AUTH_LINK";
const PASSWORD_ENV = "AMRA_REPLAY_PARTICIPANT_PASSWORD";

const TARGET = {
  participantId: "a5678fd5-8fea-4308-8569-5448f26b4f71",
  participantEmail: "amra.new1@example.test",
  organizationId: "5d93f3a1-3765-4ec4-b668-c0d1228a8445",
  assignmentId: "033f8975-5d9c-4c66-8842-f37527d556d5",
};

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

function installTypeScriptRuntime() {
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
}

function isConfirmed(env = process.env) {
  return env[CONFIRM_ENV]?.trim().toLowerCase() === "true";
}

function getConfirmedPassword(env = process.env) {
  const value = env[PASSWORD_ENV]?.trim();

  if (!value) {
    throw new Error(`Missing required env var: ${PASSWORD_ENV}`);
  }

  return value;
}

function normalizeEmail(value) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

async function listAuthUsersByEmail(supabase, email) {
  const targetEmail = normalizeEmail(email);
  if (!targetEmail) {
    return null;
  }

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

async function loadExactReplayParticipant(supabase) {
  const { data, error } = await supabase
    .from("participants")
    .select("id, organization_id, email, full_name, user_id")
    .eq("id", TARGET.participantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load replay participant: ${error.message}`);
  }

  return data ?? null;
}

async function loadExactReplayAssignment(supabase) {
  const { data, error } = await supabase
    .from("assessment_assignments")
    .select("id, organization_id, participant_id, assignment_type, status, metadata")
    .eq("id", TARGET.assignmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load replay assignment: ${error.message}`);
  }

  return data ?? null;
}

function evaluateReplayTarget(participant, assignment) {
  return Boolean(
    participant &&
      participant.id === TARGET.participantId &&
      participant.organization_id === TARGET.organizationId &&
      participant.email?.toLowerCase() === TARGET.participantEmail &&
      assignment &&
      assignment.id === TARGET.assignmentId &&
      assignment.organization_id === TARGET.organizationId &&
      assignment.participant_id === TARGET.participantId,
  );
}

async function ensureAuthUser(supabase, password) {
  const existingUser = await listAuthUsersByEmail(supabase, TARGET.participantEmail);

  if (existingUser?.id) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email: TARGET.participantEmail,
      email_confirm: true,
      password,
    });

    if (error) {
      throw new Error(`Failed to update Supabase Auth user: ${error.message}`);
    }

    if (!data?.user?.id) {
      throw new Error("Supabase Auth update did not return a user.");
    }

    return {
      user: data.user,
      authUserCreated: false,
      authUserUpdated: true,
    };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: TARGET.participantEmail,
    email_confirm: true,
    password,
  });

  if (error) {
    throw new Error(`Failed to create Supabase Auth user: ${error.message}`);
  }

  if (!data?.user?.id) {
    throw new Error("Supabase Auth create did not return a user.");
  }

  return {
    user: data.user,
    authUserCreated: true,
    authUserUpdated: false,
  };
}

async function linkParticipantUserId(supabase, userId) {
  const { data, error } = await supabase
    .from("participants")
    .update({ user_id: userId })
    .eq("id", TARGET.participantId)
    .eq("organization_id", TARGET.organizationId)
    .eq("email", TARGET.participantEmail)
    .select("id, user_id")
    .single();

  if (error) {
    throw new Error(`Failed to link participant to auth user: ${error.message}`);
  }

  if (!data?.id || data.user_id !== userId) {
    throw new Error("Participant link update did not return the expected row.");
  }

  return data;
}

async function runLinkParticipantAuthUser(options = {}) {
  const env = options.env ?? process.env;

  if (!isConfirmed(env)) {
    return {
      status: "blocked_confirmation_required",
      confirmed: false,
      databaseWrites: false,
      openAiCalled: false,
      reportsGenerated: false,
      originalAmraTouched: false,
      participantLinked: false,
      participantId: TARGET.participantId,
      participantEmail: TARGET.participantEmail,
    };
  }

  let password;
  try {
    password = getConfirmedPassword(env);
  } catch (error) {
    return {
      status: "blocked_password_required",
      confirmed: true,
      databaseWrites: false,
      openAiCalled: false,
      reportsGenerated: false,
      originalAmraTouched: false,
      participantLinked: false,
      participantId: TARGET.participantId,
      participantEmail: TARGET.participantEmail,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  const supabase = options.deps?.createSupabaseAdminClient
    ? options.deps.createSupabaseAdminClient()
    : require("../lib/supabase/admin.ts").createSupabaseAdminClient();

  const participant = await loadExactReplayParticipant(supabase);
  const assignment = await loadExactReplayAssignment(supabase);

  if (!evaluateReplayTarget(participant, assignment)) {
    return {
      status: "blocked_target_mismatch",
      confirmed: true,
      databaseWrites: false,
      openAiCalled: false,
      reportsGenerated: false,
      originalAmraTouched: false,
      participantLinked: false,
      participantId: TARGET.participantId,
      participantEmail: TARGET.participantEmail,
    };
  }

  const authUserResult = await ensureAuthUser(supabase, password);
  await linkParticipantUserId(supabase, authUserResult.user.id);

  return {
    status: "linked",
    confirmed: true,
    authUserCreated: authUserResult.authUserCreated,
    authUserUpdated: authUserResult.authUserUpdated,
    participantLinked: true,
    participantId: TARGET.participantId,
    participantEmail: TARGET.participantEmail,
    authUserId: authUserResult.user.id,
    databaseWrites: true,
    openAiCalled: false,
    reportsGenerated: false,
    originalAmraTouched: false,
  };
}

async function main() {
  installTypeScriptRuntime();
  const result = await runLinkParticipantAuthUser();
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  TARGET,
  CONFIRM_ENV,
  PASSWORD_ENV,
  installTypeScriptRuntime,
  isConfirmed,
  getConfirmedPassword,
  listAuthUsersByEmail,
  loadExactReplayParticipant,
  loadExactReplayAssignment,
  evaluateReplayTarget,
  ensureAuthUser,
  linkParticipantUserId,
  runLinkParticipantAuthUser,
};
