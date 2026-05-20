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
  if (
    request === "server-only" ||
    request === "@/lib/supabase/admin"
  ) {
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

const source = fs.readFileSync(
  path.join(projectRoot, "lib", "b2b", "team-assessment-detail.ts"),
  "utf8",
);

assert.match(source, /export async function getTeamAssessmentDetailForOrganization/);
assert.match(source, /\.from\("teams"\)/);
assert.match(source, /\.from\("team_memberships"\)/);
assert.match(source, /\.from\("team_assessment_assignments"\)/);
assert.match(source, /\.from\("team_assessment_participants"\)/);
assert.match(source, /\.eq\("package_slug", TEAM_DYNAMICS_TEST_SLUG\)/);
assert.doesNotMatch(source, /\.from\("attempts"\)/);
assert.doesNotMatch(source, /\.from\("responses"\)/);
assert.doesNotMatch(source, /score/i);
assert.doesNotMatch(source, /report_snapshot/);
assert.doesNotMatch(source, /attempt_id/);

const detail = buildTeamAssessmentDetail({
  organizationId: "org-1",
  team: {
    id: "team-1",
    organization_id: "org-1",
    name: "Produkt",
    description: "Core team",
    created_at: "2026-05-20T09:00:00.000Z",
    updated_at: "2026-05-20T10:00:00.000Z",
    archived_at: null,
  },
  activeMemberships: [
    {
      id: "membership-1",
      team_id: "team-1",
      participant_id: "participant-1",
      role: "lead",
      is_active: true,
      joined_at: "2026-05-20T09:00:00.000Z",
      left_at: null,
      participants: {
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
      joined_at: "2026-05-20T09:30:00.000Z",
      left_at: null,
      participants: {
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
    package_slug: "team_dynamics_v1_strong",
    status: "active",
    opened_at: "2026-05-20T11:00:00.000Z",
    closed_at: null,
    created_at: "2026-05-20T11:00:00.000Z",
    updated_at: "2026-05-20T11:30:00.000Z",
  },
  assignmentParticipants: [
    {
      id: "tap-1",
      team_assessment_assignment_id: "assignment-1",
      team_membership_id: "membership-1",
      participant_id: "participant-1",
      status: "completed",
      invited_at: "2026-05-20T11:00:00.000Z",
      started_at: "2026-05-20T11:05:00.000Z",
      completed_at: "2026-05-20T11:20:00.000Z",
      team_memberships: {
        id: "membership-1",
        role: "lead",
        joined_at: "2026-05-20T09:00:00.000Z",
      },
      participants: {
        id: "participant-1",
        organization_id: "org-1",
        full_name: "Amina Lead",
        email: "amina@example.com",
      },
    },
    {
      id: "tap-2",
      team_assessment_assignment_id: "assignment-1",
      team_membership_id: "membership-2",
      participant_id: "participant-2",
      status: "invited",
      invited_at: "2026-05-20T11:00:00.000Z",
      started_at: null,
      completed_at: null,
      team_memberships: {
        id: "membership-2",
        role: "member",
        joined_at: "2026-05-20T09:30:00.000Z",
      },
      participants: {
        id: "participant-2",
        organization_id: "org-1",
        full_name: "Tarik Member",
        email: "tarik@example.com",
      },
    },
  ],
});

assert.deepEqual(detail, {
  teamId: "team-1",
  name: "Produkt",
  description: "Core team",
  activeMemberCount: 2,
  createdAt: "2026-05-20T09:00:00.000Z",
  updatedAt: "2026-05-20T10:00:00.000Z",
  latestAssignment: {
    assignmentId: "assignment-1",
    status: "active",
    openedAt: "2026-05-20T11:00:00.000Z",
    closedAt: null,
    createdAt: "2026-05-20T11:00:00.000Z",
    updatedAt: "2026-05-20T11:30:00.000Z",
    invitedCount: 2,
    completedCount: 1,
    participants: [
      {
        teamAssessmentParticipantId: "tap-1",
        teamMembershipId: "membership-1",
        participantId: "participant-1",
        fullName: "Amina Lead",
        email: "amina@example.com",
        role: "lead",
        status: "completed",
        invitedAt: "2026-05-20T11:00:00.000Z",
        startedAt: "2026-05-20T11:05:00.000Z",
        completedAt: "2026-05-20T11:20:00.000Z",
        joinedAt: "2026-05-20T09:00:00.000Z",
      },
      {
        teamAssessmentParticipantId: "tap-2",
        teamMembershipId: "membership-2",
        participantId: "participant-2",
        fullName: "Tarik Member",
        email: "tarik@example.com",
        role: "member",
        status: "invited",
        invitedAt: "2026-05-20T11:00:00.000Z",
        startedAt: null,
        completedAt: null,
        joinedAt: "2026-05-20T09:30:00.000Z",
      },
    ],
  },
});

assert.equal("responses" in detail.latestAssignment.participants[0], false);
assert.equal("score" in detail.latestAssignment.participants[0], false);
assert.equal("attemptId" in detail.latestAssignment.participants[0], false);
assert.equal("report" in detail.latestAssignment.participants[0], false);

console.log("Team Dynamics team detail read helper tests passed.");
