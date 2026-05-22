const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

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
  if (request === "server-only" || request === "@/lib/supabase/admin") {
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
  buildTeamAssessmentExecutionContext,
  TEAM_ASSESSMENT_EXECUTION_CONTEXT_FAILURE_CODES,
} = require("../lib/assessment/team-assessment-execution.ts");

const source = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-assessment-execution.ts"),
  "utf8",
);

assert.match(source, /from\("team_assessment_participants"\)/);
assert.match(source, /from\("participants"\)/);
assert.match(source, /from\("team_memberships"\)/);
assert.match(source, /from\("team_assessment_assignments"\)/);
assert.match(source, /from\("teams"\)/);
assert.match(source, /from\("attempts"\)/);
assert.doesNotMatch(source, /from\("responses"\)/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /score/i);
assert.doesNotMatch(source, /report_snapshot/);
assert.equal(Array.isArray(TEAM_ASSESSMENT_EXECUTION_CONTEXT_FAILURE_CODES), true);

const baseInput = {
  teamAssessmentParticipantId: "tap-1",
  userId: "user-1",
  wrapper: {
    id: "tap-1",
    team_assessment_assignment_id: "assignment-1",
    team_membership_id: "membership-1",
    participant_id: "participant-1",
    attempt_id: "attempt-1",
    status: "invited",
  },
  participant: {
    id: "participant-1",
    user_id: "user-1",
    organization_id: "org-1",
    status: "active",
  },
  membership: {
    id: "membership-1",
    team_id: "team-1",
    participant_id: "participant-1",
    is_active: true,
    left_at: null,
  },
  assignment: {
    id: "assignment-1",
    team_id: "team-1",
    package_slug: "team_dynamics_v1_strong",
    status: "active",
  },
  team: {
    id: "team-1",
    organization_id: "org-1",
    archived_at: null,
  },
  attempt: {
    id: "attempt-1",
    test_id: "test-team-dynamics",
    organization_id: "org-1",
    participant_id: "participant-1",
    locale: "bs",
    status: "in_progress",
    tests: {
      id: "test-team-dynamics",
      slug: "team_dynamics_v1_strong",
      name: "Procjena timske dinamike",
      status: "active",
      is_active: true,
    },
  },
};

const happyPath = buildTeamAssessmentExecutionContext(baseInput);
assert.equal(happyPath.ok, true);
assert.deepEqual(happyPath, {
  ok: true,
  context: {
    teamAssessmentParticipantId: "tap-1",
    teamAssessmentAssignmentId: "assignment-1",
    teamMembershipId: "membership-1",
    participantId: "participant-1",
    attemptId: "attempt-1",
    teamId: "team-1",
    organizationId: "org-1",
    packageSlug: "team_dynamics_v1_strong",
    wrapperStatus: "invited",
    attemptStatus: "in_progress",
    locale: "bs",
    test: {
      id: "test-team-dynamics",
      slug: "team_dynamics_v1_strong",
      name: "Procjena timske dinamike",
      status: "active",
      isActive: true,
    },
  },
});
assert.equal("responses" in happyPath.context, false);
assert.equal("scores" in happyPath.context, false);
assert.equal("attempt_reports" in happyPath.context, false);
assert.equal("assessment_reports" in happyPath.context, false);
assert.equal("report" in happyPath.context, false);
assert.equal("teamFit" in happyPath.context, false);

assert.deepEqual(
  buildTeamAssessmentExecutionContext({
    ...baseInput,
    participant: {
      ...baseInput.participant,
      user_id: "user-2",
    },
  }),
  {
    ok: false,
    code: "wrapper_access_denied",
    message: "Team assessment participant wrapper is not owned by this user.",
  },
);

assert.deepEqual(
  buildTeamAssessmentExecutionContext({
    ...baseInput,
    wrapper: {
      ...baseInput.wrapper,
      attempt_id: null,
    },
    attempt: null,
  }),
  {
    ok: false,
    code: "wrapper_missing_attempt",
    message: "Team assessment participant wrapper is missing an attempt.",
  },
);

assert.deepEqual(
  buildTeamAssessmentExecutionContext({
    ...baseInput,
    membership: {
      ...baseInput.membership,
      is_active: false,
    },
  }),
  {
    ok: false,
    code: "membership_inactive",
    message: "Team membership is not active for this Team Dynamics wrapper.",
  },
);

assert.deepEqual(
  buildTeamAssessmentExecutionContext({
    ...baseInput,
    assignment: {
      ...baseInput.assignment,
      status: "closed",
    },
  }),
  {
    ok: false,
    code: "assignment_inactive",
    message: "Team assessment assignment is not active.",
  },
);

assert.deepEqual(
  buildTeamAssessmentExecutionContext({
    ...baseInput,
    assignment: {
      ...baseInput.assignment,
      package_slug: "mwms_v1",
    },
  }),
  {
    ok: false,
    code: "assignment_wrong_package",
    message: "Team assessment assignment is not a Team Dynamics package.",
  },
);

assert.deepEqual(
  buildTeamAssessmentExecutionContext({
    ...baseInput,
    attempt: {
      ...baseInput.attempt,
      participant_id: "participant-2",
    },
  }),
  {
    ok: false,
    code: "attempt_participant_mismatch",
    message: "Linked attempt does not belong to the wrapper participant.",
  },
);

assert.deepEqual(
  buildTeamAssessmentExecutionContext({
    ...baseInput,
    attempt: {
      ...baseInput.attempt,
      organization_id: "org-2",
    },
  }),
  {
    ok: false,
    code: "attempt_organization_mismatch",
    message: "Linked attempt does not belong to the same organization as the team.",
  },
);

assert.deepEqual(
  buildTeamAssessmentExecutionContext({
    ...baseInput,
    attempt: {
      ...baseInput.attempt,
      tests: {
        ...baseInput.attempt.tests,
        slug: "mwms_v1",
      },
    },
  }),
  {
    ok: false,
    code: "attempt_wrong_test",
    message: "Linked attempt is not a Team Dynamics attempt.",
  },
);

assert.deepEqual(
  buildTeamAssessmentExecutionContext({
    ...baseInput,
    attempt: {
      ...baseInput.attempt,
      tests: {
        ...baseInput.attempt.tests,
        is_active: false,
      },
    },
  }),
  {
    ok: false,
    code: "test_inactive",
    message: "Linked Team Dynamics test is not active.",
  },
);

console.log("Team Dynamics execution access helper tests passed.");
