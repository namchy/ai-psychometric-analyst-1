const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const actionPath = path.join(projectRoot, "app", "actions", "team-assessments.ts");
const source = fs.readFileSync(actionPath, "utf8");

assert.match(source, /requireAuthenticatedUserForAction/);
assert.match(source, /getActiveOrganizationForUser\(user\.id\)/);
assert.match(source, /getFormDataString\(formData, "teamId"\)/);
assert.match(source, /createTeamDynamicsAssessmentForTeam\(/);
assert.match(source, /organizationId: organization\.id/);
assert.match(source, /requireLinkedUsers: true/);
assert.doesNotMatch(source, /organizationId"\)/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /redirect\(/);
assert.doesNotMatch(source, /revalidatePath\(/);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "team-dynamics-action-"));
const stubAuthPath = path.join(tmpDir, "auth-session.cjs");
const stubOrganizationsPath = path.join(tmpDir, "organizations.cjs");
const stubTeamAssessmentsPath = path.join(tmpDir, "team-assessments.cjs");
const originalResolveFilename = Module._resolveFilename;

fs.writeFileSync(
  stubAuthPath,
  'module.exports = { requireAuthenticatedUserForAction: (...args) => global.__TEAM_DYNAMICS_ACTION_MOCKS__.auth.requireAuthenticatedUserForAction(...args) };',
);
fs.writeFileSync(
  stubOrganizationsPath,
  'module.exports = { getActiveOrganizationForUser: (...args) => global.__TEAM_DYNAMICS_ACTION_MOCKS__.organizations.getActiveOrganizationForUser(...args) };',
);
fs.writeFileSync(
  stubTeamAssessmentsPath,
  `
class TeamDynamicsTestNotReadyError extends Error {
  constructor(message = "not ready") {
    super(message);
    this.name = "TeamDynamicsTestNotReadyError";
    this.code = "TEAM_DYNAMICS_TEST_NOT_READY";
  }
}

class TeamDynamicsMemberMissingLinkedUserError extends Error {
  constructor(message = "missing linked user") {
    super(message);
    this.name = "TeamDynamicsMemberMissingLinkedUserError";
    this.code = "TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER";
  }
}

module.exports = {
  TEAM_DYNAMICS_TEST_NOT_READY: "TEAM_DYNAMICS_TEST_NOT_READY",
  TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER: "TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER",
  TeamDynamicsTestNotReadyError,
  TeamDynamicsMemberMissingLinkedUserError,
  createTeamDynamicsAssessmentForTeam: (...args) =>
    global.__TEAM_DYNAMICS_ACTION_MOCKS__.teamAssessments.createTeamDynamicsAssessmentForTeam(...args),
};
`,
);

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
  if (request === "@/lib/auth/session") {
    return stubAuthPath;
  }

  if (request === "@/lib/b2b/organizations") {
    return stubOrganizationsPath;
  }

  if (request === "@/lib/assessment/team-assessments") {
    return stubTeamAssessmentsPath;
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
  const tsSource = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(tsSource, {
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

global.__TEAM_DYNAMICS_ACTION_MOCKS__ = {
  auth: {
    requireAuthenticatedUserForAction: async () => ({ id: "user-1" }),
  },
  organizations: {
    getActiveOrganizationForUser: async () => ({ id: "org-1", name: "Org 1" }),
  },
  teamAssessments: {
    createTeamDynamicsAssessmentForTeam: async (input) => ({
      assignmentId: "assignment-1",
      assignmentAction: "created",
      participantsCreated: 3,
      attemptsCreated: 3,
      attemptMappingsCreated: 3,
      capturedInput: input,
    }),
  },
};

const {
  createTeamDynamicsAssessmentAction,
  INITIAL_CREATE_TEAM_DYNAMICS_ASSESSMENT_ACTION_STATE,
  mapCreateTeamDynamicsAssessmentActionError,
  TEAM_DYNAMICS_ACTION_TEAM_ID_REQUIRED,
  TEAM_DYNAMICS_ACTION_NO_ACTIVE_ORGANIZATION,
  TEAM_DYNAMICS_ACTION_MEMBER_MISSING_PARTICIPANT,
  TEAM_DYNAMICS_ACTION_NO_ACTIVE_MEMBERS,
  TEAM_DYNAMICS_ACTION_TEAM_ACCESS_DENIED,
  TEAM_DYNAMICS_ACTION_CREATE_FAILED,
} = require(actionPath);
const {
  TeamDynamicsTestNotReadyError,
  TeamDynamicsMemberMissingLinkedUserError,
} = require(stubTeamAssessmentsPath);

(async () => {
  assert.deepEqual(INITIAL_CREATE_TEAM_DYNAMICS_ASSESSMENT_ACTION_STATE, {
    ok: false,
    code: null,
    message: null,
    teamId: null,
  });

  const missingTeamIdResult = await createTeamDynamicsAssessmentAction(new FormData());
  assert.deepEqual(missingTeamIdResult, {
    ok: false,
    code: TEAM_DYNAMICS_ACTION_TEAM_ID_REQUIRED,
    message: "Team id is required.",
    teamId: null,
  });

  global.__TEAM_DYNAMICS_ACTION_MOCKS__.organizations.getActiveOrganizationForUser = async () => null;
  const noOrganizationResult = await createTeamDynamicsAssessmentAction(new FormData());
  assert.deepEqual(noOrganizationResult, {
    ok: false,
    code: TEAM_DYNAMICS_ACTION_NO_ACTIVE_ORGANIZATION,
    message: "Active organization is not available for this user.",
    teamId: null,
  });

  let capturedInput = null;
  global.__TEAM_DYNAMICS_ACTION_MOCKS__.organizations.getActiveOrganizationForUser = async () => ({
    id: "org-1",
    name: "Org 1",
  });
  global.__TEAM_DYNAMICS_ACTION_MOCKS__.teamAssessments.createTeamDynamicsAssessmentForTeam = async (
    input,
  ) => {
    capturedInput = input;

    return {
      assignmentId: "assignment-1",
      assignmentAction: "reused",
      participantsCreated: 0,
      attemptsCreated: 0,
      attemptMappingsCreated: 0,
    };
  };

  const successFormData = new FormData();
  successFormData.set("teamId", "team-1");
  successFormData.set("locale", "bs");
  successFormData.set("organizationId", "org-evil");

  const successResult = await createTeamDynamicsAssessmentAction(successFormData);
  assert.deepEqual(successResult, {
    ok: true,
    teamId: "team-1",
    assignmentId: "assignment-1",
    assignmentAction: "reused",
    participantsCreated: 0,
    attemptsCreated: 0,
    attemptMappingsCreated: 0,
  });
  assert.deepEqual(capturedInput, {
    organizationId: "org-1",
    teamId: "team-1",
    createdByUserId: "user-1",
    locale: "bs",
    requireLinkedUsers: true,
  });

  assert.deepEqual(
    mapCreateTeamDynamicsAssessmentActionError(
      new TeamDynamicsMemberMissingLinkedUserError("Missing linked user"),
    ),
    {
      ok: false,
      code: "TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER",
      message: "Missing linked user",
      teamId: null,
    },
  );

  assert.deepEqual(
    mapCreateTeamDynamicsAssessmentActionError(
      new TeamDynamicsTestNotReadyError("Team Dynamics test is not runtime-ready."),
    ),
    {
      ok: false,
      code: "TEAM_DYNAMICS_TEST_NOT_READY",
      message: "Team Dynamics test is not runtime-ready.",
      teamId: null,
    },
  );

  assert.deepEqual(
    mapCreateTeamDynamicsAssessmentActionError(new Error("Team was not found.")),
    {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_TEAM_ACCESS_DENIED,
      message: "Team was not found.",
      teamId: null,
    },
  );

  assert.deepEqual(
    mapCreateTeamDynamicsAssessmentActionError(
      new Error("At least one active team membership is required."),
    ),
    {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_NO_ACTIVE_MEMBERS,
      message: "At least one active team membership is required.",
      teamId: null,
    },
  );

  assert.deepEqual(
    mapCreateTeamDynamicsAssessmentActionError(
      new Error("Membership membership-1 is missing a linked participant."),
    ),
    {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_MEMBER_MISSING_PARTICIPANT,
      message: "Membership membership-1 is missing a linked participant.",
      teamId: null,
    },
  );

  assert.deepEqual(
    mapCreateTeamDynamicsAssessmentActionError(new Error("Unknown failure.")),
    {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_CREATE_FAILED,
      message: "Unknown failure.",
      teamId: null,
    },
  );

  console.log("Team Dynamics action tests passed.");
})().finally(() => {
  delete global.__TEAM_DYNAMICS_ACTION_MOCKS__;
  Module._resolveFilename = originalResolveFilename;
});
