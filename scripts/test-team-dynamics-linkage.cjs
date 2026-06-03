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
  buildTeamAssessmentAssignmentInsert,
  buildTeamAssessmentParticipantInserts,
  buildTeamDynamicsAttemptInserts,
  mapAttemptIdsToTeamAssessmentParticipants,
  buildTeamAssessmentParticipantCompletionPatch,
} = require("../lib/assessment/team-assessments.ts");
const { TEAM_DYNAMICS_TEST_SLUG } = require("../lib/assessment/team-dynamics.ts");

const assignmentInsert = buildTeamAssessmentAssignmentInsert({
  teamId: "team-1",
  createdByUserId: "user-1",
});

assert.deepEqual(assignmentInsert, {
  team_id: "team-1",
  package_slug: TEAM_DYNAMICS_TEST_SLUG,
  status: "draft",
  created_by_user_id: "user-1",
  opened_at: null,
  closed_at: null,
});

const participantInserts = buildTeamAssessmentParticipantInserts({
  teamAssessmentAssignmentId: "assignment-1",
  memberships: [
    {
      id: "membership-1",
      participant_id: "participant-1",
      participant_user_id: "user-1",
      participant_addressing_form: "feminine",
    },
    {
      id: "membership-2",
      participant_id: "participant-2",
      participant_user_id: null,
      participant_addressing_form: null,
    },
  ],
  invitedAt: "2026-05-19T10:00:00.000Z",
});

assert.deepEqual(participantInserts, [
  {
    team_assessment_assignment_id: "assignment-1",
    team_membership_id: "membership-1",
    participant_id: "participant-1",
    status: "invited",
    invited_at: "2026-05-19T10:00:00.000Z",
  },
  {
    team_assessment_assignment_id: "assignment-1",
    team_membership_id: "membership-2",
    participant_id: "participant-2",
    status: "invited",
    invited_at: "2026-05-19T10:00:00.000Z",
  },
]);

const attemptInserts = buildTeamDynamicsAttemptInserts({
  testId: "test-team-dynamics",
  organizationId: "org-1",
  teamAssessmentParticipants: [
    {
      id: "tap-1",
      participant_id: "participant-1",
      participant_user_id: "user-1",
      participant_addressing_form: "feminine",
    },
    {
      id: "tap-2",
      participant_id: "participant-2",
      participant_user_id: null,
      participant_addressing_form: null,
    },
  ],
  locale: "bs",
  startedAt: "2026-05-19T10:05:00.000Z",
});

assert.deepEqual(attemptInserts, [
  {
    test_id: "test-team-dynamics",
    user_id: "user-1",
    organization_id: "org-1",
    participant_id: "participant-1",
    locale: "bs",
    addressing_form_snapshot: "feminine",
    status: "in_progress",
    started_at: "2026-05-19T10:05:00.000Z",
  },
  {
    test_id: "test-team-dynamics",
    user_id: null,
    organization_id: "org-1",
    participant_id: "participant-2",
    locale: "bs",
    addressing_form_snapshot: "masculine",
    status: "in_progress",
    started_at: "2026-05-19T10:05:00.000Z",
  },
]);

const participantAttemptUpdates = mapAttemptIdsToTeamAssessmentParticipants({
  teamAssessmentParticipants: [
    { id: "tap-1", participant_id: "participant-1" },
    { id: "tap-2", participant_id: "participant-2" },
  ],
  createdAttempts: [
    { id: "attempt-1", participant_id: "participant-1" },
    { id: "attempt-2", participant_id: "participant-2" },
  ],
});

assert.deepEqual(participantAttemptUpdates, [
  { id: "tap-1", attempt_id: "attempt-1" },
  { id: "tap-2", attempt_id: "attempt-2" },
]);

assert.throws(
  () =>
    mapAttemptIdsToTeamAssessmentParticipants({
      teamAssessmentParticipants: [{ id: "tap-1", participant_id: "participant-1" }],
      createdAttempts: [],
    }),
  /Missing Team Dynamics attempt for participant participant-1/,
);

assert.deepEqual(
  buildTeamAssessmentParticipantCompletionPatch({
    completedAt: "2026-05-19T10:10:00.000Z",
    startedAt: null,
  }),
  {
    status: "completed",
    started_at: "2026-05-19T10:10:00.000Z",
    completed_at: "2026-05-19T10:10:00.000Z",
  },
);

const teamAssessmentsSource = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-assessments.ts"),
  "utf8",
);
assert.match(teamAssessmentsSource, /if \(!existing\) \{\s+return null;\s+\}/);

console.log("Team Dynamics linkage helper tests passed.");
