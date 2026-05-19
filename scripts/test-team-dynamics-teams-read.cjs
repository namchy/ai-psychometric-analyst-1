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
  buildTeamSummaries,
} = require("../lib/b2b/teams.ts");

const source = fs.readFileSync(
  path.join(projectRoot, "lib", "b2b", "teams.ts"),
  "utf8",
);

assert.match(source, /export async function getTeamsForOrganization/);
assert.match(source, /\.eq\("organization_id", organizationId\)/);
assert.match(source, /\.is\("archived_at", null\)/);
assert.match(source, /\.from\("team_memberships"\)/);
assert.match(source, /\.from\("team_assessment_assignments"\)/);
assert.match(source, /\.from\("team_assessment_participants"\)/);
assert.doesNotMatch(source, /\.from\("attempts"\)/);
assert.doesNotMatch(source, /\.from\("responses"\)/);
assert.doesNotMatch(source, /score/i);

const summaries = buildTeamSummaries({
  teams: [
    {
      id: "team-1",
      name: "Product",
      description: "Core product team",
      created_at: "2026-05-20T10:00:00.000Z",
      updated_at: "2026-05-20T11:00:00.000Z",
    },
    {
      id: "team-2",
      name: "Operations",
      description: null,
      created_at: "2026-05-19T10:00:00.000Z",
      updated_at: "2026-05-19T11:00:00.000Z",
    },
  ],
  activeMemberships: [
    { team_id: "team-1" },
    { team_id: "team-1" },
    { team_id: "team-2" },
  ],
  activeAssignments: [
    {
      id: "assignment-1",
      team_id: "team-1",
      status: "active",
      opened_at: "2026-05-20T12:00:00.000Z",
      created_at: "2026-05-20T12:00:00.000Z",
      updated_at: "2026-05-20T12:30:00.000Z",
    },
  ],
  activeAssignmentParticipants: [
    { team_assessment_assignment_id: "assignment-1", status: "invited" },
    { team_assessment_assignment_id: "assignment-1", status: "completed" },
  ],
});

assert.deepEqual(summaries, [
  {
    teamId: "team-1",
    name: "Product",
    description: "Core product team",
    activeMemberCount: 2,
    createdAt: "2026-05-20T10:00:00.000Z",
    updatedAt: "2026-05-20T11:00:00.000Z",
    activeAssessment: {
      assignmentId: "assignment-1",
      status: "active",
      openedAt: "2026-05-20T12:00:00.000Z",
      updatedAt: "2026-05-20T12:30:00.000Z",
      invitedCount: 2,
      completedCount: 1,
    },
  },
  {
    teamId: "team-2",
    name: "Operations",
    description: null,
    activeMemberCount: 1,
    createdAt: "2026-05-19T10:00:00.000Z",
    updatedAt: "2026-05-19T11:00:00.000Z",
    activeAssessment: null,
  },
]);

console.log("Team Dynamics teams read helper tests passed.");
