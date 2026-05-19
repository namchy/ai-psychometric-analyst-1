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
  assertValidTeamDynamicsAssessmentCreateContext,
  buildTeamDynamicsCreatePlan,
} = require("../lib/assessment/team-assessments.ts");

const validTeam = {
  id: "team-1",
  organization_id: "org-1",
  archived_at: null,
};

assert.throws(
  () =>
    assertValidTeamDynamicsAssessmentCreateContext({
      organizationId: "org-1",
      team: {
        ...validTeam,
        organization_id: "org-2",
      },
      memberships: [],
    }),
  /Team does not belong to the active organization/,
);

assert.throws(
  () =>
    assertValidTeamDynamicsAssessmentCreateContext({
      organizationId: "org-1",
      team: validTeam,
      memberships: [
        {
          id: "membership-1",
          team_id: "team-1",
          participant_id: "participant-1",
          is_active: true,
          left_at: null,
          participants: {
            id: "participant-1",
            organization_id: "org-2",
            user_id: "user-1",
            addressing_form: null,
            status: "active",
          },
        },
      ],
    }),
  /Participant participant-1 does not belong to organization org-1/,
);

assert.throws(
  () =>
    buildTeamDynamicsCreatePlan({
      organizationId: "org-1",
      team: validTeam,
      memberships: [
        {
          id: "membership-1",
          team_id: "team-2",
          participant_id: "participant-1",
          is_active: true,
          left_at: null,
          participants: {
            id: "participant-1",
            organization_id: "org-1",
            user_id: "user-1",
            addressing_form: null,
            status: "active",
          },
        },
      ],
      createdByUserId: "hr-user-1",
      testId: "test-team-dynamics",
      locale: "bs",
      createdAt: "2026-05-19T11:00:00.000Z",
    }),
  /does not belong to the requested team/,
);

const source = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-assessments.ts"),
  "utf8",
);
assert.match(source, /if \(input\.team\.organization_id !== input\.organizationId\)/);
assert.match(source, /if \(participant\.organization_id !== input\.organizationId\)/);
assert.match(source, /if \(!membership\.is_active \|\| membership\.left_at\)/);

console.log("Team Dynamics team access tests passed.");
