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
  isTeamDynamicsTestSlug,
  shouldHideTeamDynamicsAttemptFromHrIndividualFlow,
  canUseGenericCandidateAttemptCreation,
  isTeamDynamicsAttemptRecord,
} = require("../lib/assessment/team-dynamics.ts");

assert.equal(TEAM_DYNAMICS_TEST_SLUG, "team_dynamics_v1_strong");
assert.equal(isTeamDynamicsTestSlug("team_dynamics_v1_strong"), true);
assert.equal(isTeamDynamicsTestSlug("TEAM_DYNAMICS_V1_STRONG"), true);
assert.equal(isTeamDynamicsTestSlug("mwms_v1"), false);

assert.equal(shouldHideTeamDynamicsAttemptFromHrIndividualFlow(TEAM_DYNAMICS_TEST_SLUG), true);
assert.equal(shouldHideTeamDynamicsAttemptFromHrIndividualFlow("mwms_v1"), false);

assert.equal(canUseGenericCandidateAttemptCreation(TEAM_DYNAMICS_TEST_SLUG), false);
assert.equal(canUseGenericCandidateAttemptCreation("mwms_v1"), true);

assert.equal(
  isTeamDynamicsAttemptRecord({ tests: { slug: TEAM_DYNAMICS_TEST_SLUG } }),
  true,
);
assert.equal(isTeamDynamicsAttemptRecord({ test_slug: "mwms_v1" }), false);

const organizationsSource = fs.readFileSync(
  path.join(projectRoot, "lib", "b2b", "organizations.ts"),
  "utf8",
);
assert.match(
  organizationsSource,
  /shouldHideTeamDynamicsAttemptFromHrIndividualFlow\(attempt\.tests\?\.slug\)/,
);
assert.match(
  organizationsSource,
  /!shouldHideTeamDynamicsAttemptFromHrIndividualFlow\(tests\?\.slug\)/,
);

const candidateActionsSource = fs.readFileSync(
  path.join(projectRoot, "app", "(protected)", "app", "actions.ts"),
  "utf8",
);
assert.match(candidateActionsSource, /canUseGenericCandidateAttemptCreation\(test\.slug\)/);
assert.match(
  candidateActionsSource,
  /Team Dynamics assessments must be assigned through a team workflow\./,
);

console.log("Team Dynamics privacy guard tests passed.");
