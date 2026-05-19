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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  TEAM_DYNAMICS_TEST_SLUG,
  shouldBypassIndividualPostCompletionArtifacts,
  shouldUseDefaultIndividualPostCompletionFlow,
} = require("../lib/assessment/team-dynamics.ts");

assert.equal(shouldBypassIndividualPostCompletionArtifacts(TEAM_DYNAMICS_TEST_SLUG), true);
assert.equal(shouldUseDefaultIndividualPostCompletionFlow(TEAM_DYNAMICS_TEST_SLUG), false);
assert.equal(shouldBypassIndividualPostCompletionArtifacts("ipip-neo-120-v1"), false);
assert.equal(shouldBypassIndividualPostCompletionArtifacts("safran_v1"), false);
assert.equal(shouldBypassIndividualPostCompletionArtifacts("mwms_v1"), false);
assert.equal(shouldUseDefaultIndividualPostCompletionFlow("ipip-neo-120-v1"), true);
assert.equal(shouldUseDefaultIndividualPostCompletionFlow("safran_v1"), true);
assert.equal(shouldUseDefaultIndividualPostCompletionFlow("mwms_v1"), true);

const assessmentActionsSource = fs.readFileSync(
  path.join(projectRoot, "app", "actions", "assessment.ts"),
  "utf8",
);
const teamDynamicsBranchMatch = assessmentActionsSource.match(
  /if \(shouldBypassPostCompletionArtifacts\) \{([\s\S]*?)\n\s*\}\n\n\s*const results = await persistCompletedAssessmentResults/,
);

assert.ok(teamDynamicsBranchMatch, "Expected Team Dynamics completion guard branch in assessment action.");
const teamDynamicsBranchSource = teamDynamicsBranchMatch[1];

assert.match(
  assessmentActionsSource,
  /const shouldBypassPostCompletionArtifacts = shouldBypassIndividualPostCompletionArtifacts\(/,
);
assert.match(teamDynamicsBranchSource, /await syncTeamAssessmentParticipantCompletionByAttemptId\(\{/);
assert.match(teamDynamicsBranchSource, /attemptId: persistResult\.attemptId,/);
assert.match(teamDynamicsBranchSource, /completedAt: completedAttempt\.completed_at \?\? completedAt,/);
assert.match(teamDynamicsBranchSource, /results: null,/);
assert.match(teamDynamicsBranchSource, /report: null,/);
assert.doesNotMatch(teamDynamicsBranchSource, /persistCompletedAssessmentResults\(/);
assert.doesNotMatch(teamDynamicsBranchSource, /orchestrateReportsAfterAttemptCompletion\(/);

console.log("Team Dynamics completion guard tests passed.");
