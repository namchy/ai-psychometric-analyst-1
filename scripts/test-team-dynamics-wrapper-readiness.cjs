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
  buildTeamAssessmentDetail,
} = require("../lib/b2b/team-assessment-detail.ts");
const {
  buildTeamDynamicsCreatePlan,
  buildTeamDynamicsRunReadiness,
} = require("../lib/assessment/team-assessments.ts");
const { TEAM_DYNAMICS_TEST_SLUG, canUseGenericCandidateAttemptCreation } = require(
  "../lib/assessment/team-dynamics.ts",
);
const {
  getCandidateAssessmentAvailability,
} = require("../lib/assessment/availability.ts");
const {
  planPostCompletionReportJobs,
} = require("../lib/assessment/report-capabilities.ts");

const detailSource = fs.readFileSync(
  path.join(projectRoot, "lib", "b2b", "team-assessment-detail.ts"),
  "utf8",
);
const candidateActionsSource = fs.readFileSync(
  path.join(projectRoot, "app", "(protected)", "app", "actions.ts"),
  "utf8",
);

const activeTest = {
  id: "test-team-dynamics",
  slug: TEAM_DYNAMICS_TEST_SLUG,
  status: "active",
  is_active: true,
};

const activeAvailability = getCandidateAssessmentAvailability({
  slug: TEAM_DYNAMICS_TEST_SLUG,
  name: "Procjena timske dinamike",
  status: "active",
  isActive: true,
  hasOrganizationAccess: true,
  activeQuestionCount: 36,
});

assert.deepEqual(activeAvailability, {
  catalogKey: null,
  kind: "add_on",
  canStart: true,
  requiresOrganizationAccess: true,
  reason: "add_on_available",
});
assert.equal(canUseGenericCandidateAttemptCreation(TEAM_DYNAMICS_TEST_SLUG), false);
assert.match(
  candidateActionsSource,
  /if \(!canUseGenericCandidateAttemptCreation\(test\.slug\)\) \{\s+throw new Error\("Team Dynamics assessments must be assigned through a team workflow\."\);\s+\}\s+\n\s+const availability = getCandidateAssessmentAvailability\(/,
);

assert.deepEqual(
  buildTeamDynamicsRunReadiness({
    test: activeTest,
    activeQuestionIds: ["q-1", "q-2"],
    questionIdsWithOptions: ["q-1", "q-2"],
  }),
  {
    isReady: true,
    testId: "test-team-dynamics",
    activeQuestionIds: ["q-1", "q-2"],
    questionIdsWithOptions: ["q-1", "q-2"],
    questionIdsMissingOptions: [],
    failureCode: null,
    reason: null,
  },
);

const createPlan = buildTeamDynamicsCreatePlan({
  organizationId: "org-1",
  team: {
    id: "team-1",
    organization_id: "org-1",
    archived_at: null,
  },
  memberships: [
    {
      id: "membership-1",
      team_id: "team-1",
      participant_id: "participant-1",
      is_active: true,
      left_at: null,
      participants: {
        id: "participant-1",
        organization_id: "org-1",
        user_id: "user-1",
        addressing_form: "feminine",
        status: "active",
      },
    },
    {
      id: "membership-2",
      team_id: "team-1",
      participant_id: "participant-2",
      is_active: true,
      left_at: null,
      participants: {
        id: "participant-2",
        organization_id: "org-1",
        user_id: "user-2",
        addressing_form: null,
        status: "active",
      },
    },
  ],
  createdByUserId: "hr-user-1",
  testId: activeTest.id,
  locale: "bs",
  createdAt: "2026-05-22T11:00:00.000Z",
});

assert.equal(createPlan.assignment.mode, "create");
assert.deepEqual(createPlan.assignment.insert, {
  team_id: "team-1",
  package_slug: TEAM_DYNAMICS_TEST_SLUG,
  status: "active",
  created_by_user_id: "hr-user-1",
  opened_at: "2026-05-22T11:00:00.000Z",
  closed_at: null,
});
assert.deepEqual(
  createPlan.participantInserts.map((participant) => ({
    assignment: participant.team_assessment_assignment_id,
    membershipId: participant.team_membership_id,
    participantId: participant.participant_id,
    status: participant.status,
  })),
  [
    {
      assignment: "__PENDING_ASSIGNMENT_ID__",
      membershipId: "membership-1",
      participantId: "participant-1",
      status: "invited",
    },
    {
      assignment: "__PENDING_ASSIGNMENT_ID__",
      membershipId: "membership-2",
      participantId: "participant-2",
      status: "invited",
    },
  ],
);
assert.deepEqual(
  createPlan.attemptInserts.map((attempt) => ({
    testId: attempt.test_id,
    participantId: attempt.participant_id,
    status: attempt.status,
    locale: attempt.locale,
  })),
  [
    {
      testId: "test-team-dynamics",
      participantId: "participant-1",
      status: "in_progress",
      locale: "bs",
    },
    {
      testId: "test-team-dynamics",
      participantId: "participant-2",
      status: "in_progress",
      locale: "bs",
    },
  ],
);

const detail = buildTeamAssessmentDetail({
  organizationId: "org-1",
  team: {
    id: "team-1",
    organization_id: "org-1",
    name: "Produkt tim",
    description: "Wrapper flow readiness",
    created_at: "2026-05-22T09:00:00.000Z",
    updated_at: "2026-05-22T11:30:00.000Z",
    archived_at: null,
  },
  activeMemberships: [
    {
      id: "membership-1",
      team_id: "team-1",
      participant_id: "participant-1",
      role: "lead",
      is_active: true,
      joined_at: "2026-05-22T09:00:00.000Z",
      left_at: null,
      participant: {
        id: "participant-1",
        organization_id: "org-1",
        full_name: "Amina Lead",
        email: "amina@example.com",
        status: "active",
      },
    },
    {
      id: "membership-2",
      team_id: "team-1",
      participant_id: "participant-2",
      role: "member",
      is_active: true,
      joined_at: "2026-05-22T09:15:00.000Z",
      left_at: null,
      participant: {
        id: "participant-2",
        organization_id: "org-1",
        full_name: "Tarik Member",
        email: "tarik@example.com",
        status: "active",
      },
    },
  ],
  latestAssignment: {
    id: "assignment-1",
    team_id: "team-1",
    package_slug: TEAM_DYNAMICS_TEST_SLUG,
    status: "active",
    opened_at: "2026-05-22T11:00:00.000Z",
    closed_at: null,
    created_at: "2026-05-22T11:00:00.000Z",
    updated_at: "2026-05-22T11:30:00.000Z",
  },
  assignmentParticipants: [
    {
      id: "tap-1",
      team_assessment_assignment_id: "assignment-1",
      team_membership_id: "membership-1",
      participant_id: "participant-1",
      status: "completed",
      invited_at: "2026-05-22T11:00:00.000Z",
      started_at: "2026-05-22T11:05:00.000Z",
      completed_at: "2026-05-22T11:20:00.000Z",
      membership: {
        id: "membership-1",
        team_id: "team-1",
        participant_id: "participant-1",
        role: "lead",
        is_active: true,
        joined_at: "2026-05-22T09:00:00.000Z",
        left_at: null,
      },
      participant: {
        id: "participant-1",
        organization_id: "org-1",
        full_name: "Amina Lead",
        email: "amina@example.com",
        status: "active",
      },
    },
    {
      id: "tap-2",
      team_assessment_assignment_id: "assignment-1",
      team_membership_id: "membership-2",
      participant_id: "participant-2",
      status: "started",
      invited_at: "2026-05-22T11:00:00.000Z",
      started_at: "2026-05-22T11:10:00.000Z",
      completed_at: null,
      membership: {
        id: "membership-2",
        team_id: "team-1",
        participant_id: "participant-2",
        role: "member",
        is_active: true,
        joined_at: "2026-05-22T09:15:00.000Z",
        left_at: null,
      },
      participant: {
        id: "participant-2",
        organization_id: "org-1",
        full_name: "Tarik Member",
        email: "tarik@example.com",
        status: "active",
      },
    },
  ],
});

assert.equal(detail.latestAssignment.assignmentId, "assignment-1");
assert.equal(detail.latestAssignment.status, "active");
assert.equal(detail.latestAssignment.invitedCount, 2);
assert.equal(detail.latestAssignment.completedCount, 1);
assert.deepEqual(
  detail.latestAssignment.participants.map((participant) => ({
    participantId: participant.participantId,
    status: participant.status,
    role: participant.role,
  })),
  [
    { participantId: "participant-1", status: "completed", role: "lead" },
    { participantId: "participant-2", status: "started", role: "member" },
  ],
);
assert.equal("attemptId" in detail.latestAssignment.participants[0], false);
assert.equal("responses" in detail.latestAssignment.participants[0], false);
assert.equal("score" in detail.latestAssignment.participants[0], false);
assert.equal("report" in detail.latestAssignment.participants[0], false);
assert.equal("reportCta" in detail.latestAssignment.participants[0], false);
assert.equal("aiReportContent" in detail.latestAssignment.participants[0], false);
assert.equal("teamFit" in detail.latestAssignment.participants[0], false);

assert.match(detailSource, /\.from\("team_assessment_assignments"\)/);
assert.match(detailSource, /\.from\("team_assessment_participants"\)/);
assert.doesNotMatch(detailSource, /\.from\("attempts"\)/);
assert.doesNotMatch(detailSource, /\.from\("responses"\)/);
assert.doesNotMatch(detailSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(detailSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(detailSource, /report_snapshot/);

const teamDynamicsReportPlan = planPostCompletionReportJobs({
  testSlug: TEAM_DYNAMICS_TEST_SLUG,
  existingReports: [
    {
      audience: "participant",
      report_type: "individual",
      source_type: "single_test",
      report_status: "queued",
      test_slug: TEAM_DYNAMICS_TEST_SLUG,
    },
    {
      audience: "hr",
      report_type: "individual",
      source_type: "single_test",
      report_status: "ready",
      test_slug: TEAM_DYNAMICS_TEST_SLUG,
    },
  ],
});

assert.deepEqual(teamDynamicsReportPlan.jobsToEnqueue, []);
assert.equal(
  teamDynamicsReportPlan.lanes.every(
    (lane) =>
      lane.capability.active === false &&
      lane.capability.status === "inactive" &&
      lane.shouldEnqueue === false,
  ),
  true,
);

console.log("Team Dynamics wrapper readiness tests passed.");
