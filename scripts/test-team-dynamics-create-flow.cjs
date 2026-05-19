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
  buildTeamDynamicsCreatePlan,
} = require("../lib/assessment/team-assessments.ts");
const { TEAM_DYNAMICS_TEST_SLUG } = require("../lib/assessment/team-dynamics.ts");

const baseTeam = {
  id: "team-1",
  organization_id: "org-1",
  archived_at: null,
};

const memberships = [
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
      user_id: null,
      addressing_form: null,
      status: "active",
    },
  },
];

const createPlan = buildTeamDynamicsCreatePlan({
  organizationId: "org-1",
  team: baseTeam,
  memberships,
  createdByUserId: "hr-user-1",
  testId: "test-team-dynamics",
  locale: "bs",
  createdAt: "2026-05-19T11:00:00.000Z",
});

assert.equal(createPlan.assignment.mode, "create");
assert.deepEqual(createPlan.assignment.insert, {
  team_id: "team-1",
  package_slug: TEAM_DYNAMICS_TEST_SLUG,
  status: "active",
  created_by_user_id: "hr-user-1",
  opened_at: "2026-05-19T11:00:00.000Z",
  closed_at: null,
});
assert.equal(createPlan.participantInserts.length, 2);
assert.equal(createPlan.attemptInserts.length, 2);
assert.equal(createPlan.attemptTargets.length, 2);
assert.deepEqual(
  createPlan.participantInserts.map((row) => row.team_membership_id),
  ["membership-1", "membership-2"],
);
assert.deepEqual(
  createPlan.attemptInserts.map((row) => row.participant_id),
  ["participant-1", "participant-2"],
);

const reusePlan = buildTeamDynamicsCreatePlan({
  organizationId: "org-1",
  team: baseTeam,
  memberships,
  createdByUserId: "hr-user-1",
  testId: "test-team-dynamics",
  locale: "bs",
  createdAt: "2026-05-19T11:00:00.000Z",
  existingActiveAssignment: {
    id: "assignment-1",
    team_id: "team-1",
    package_slug: TEAM_DYNAMICS_TEST_SLUG,
    status: "active",
  },
  existingParticipants: [
    {
      id: "tap-1",
      team_assessment_assignment_id: "assignment-1",
      team_membership_id: "membership-1",
      participant_id: "participant-1",
      attempt_id: "attempt-1",
      status: "invited",
      invited_at: "2026-05-19T11:00:00.000Z",
      started_at: null,
      completed_at: null,
    },
  ],
});

assert.equal(reusePlan.assignment.mode, "reuse");
assert.equal(reusePlan.assignment.insert, null);
assert.equal(reusePlan.assignment.existingAssignmentId, "assignment-1");
assert.deepEqual(reusePlan.participantInserts, [
  {
    team_assessment_assignment_id: "assignment-1",
    team_membership_id: "membership-2",
    participant_id: "participant-2",
    status: "invited",
    invited_at: "2026-05-19T11:00:00.000Z",
  },
]);
assert.deepEqual(reusePlan.attemptTargets, [
  {
    team_membership_id: "membership-2",
    participant_id: "participant-2",
  },
]);
assert.deepEqual(reusePlan.attemptInserts, [
  {
    test_id: "test-team-dynamics",
    user_id: null,
    organization_id: "org-1",
    participant_id: "participant-2",
    locale: "bs",
    addressing_form_snapshot: "masculine",
    status: "in_progress",
    started_at: "2026-05-19T11:00:00.000Z",
  },
]);

const source = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-assessments.ts"),
  "utf8",
);
assert.match(source, /if \(plan\.assignment\.mode === "create"\)/);
assert.match(source, /if \(plan\.participantInserts\.length > 0\)/);
assert.match(source, /if \(plan\.attemptInserts\.length > 0\)/);
assert.match(source, /assignmentAction: createdAssignment \? "created" : "reused"/);

console.log("Team Dynamics create flow helper tests passed.");
