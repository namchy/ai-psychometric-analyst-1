const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-dynamics-executive-overview-contract.ts",
);
const helperSource = fs.readFileSync(helperPath, "utf8");
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

assert.match(helperSource, /TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE/);
assert.match(helperSource, /validateTeamDynamicsExecutiveOverviewSnapshot/);
assert.match(helperSource, /buildMockTeamDynamicsExecutiveOverviewSnapshot/);
assert.doesNotMatch(helperSource, /\.from\("/);
assert.doesNotMatch(helperSource, /OpenAI|AI provider|renderer|worker|Team Fit/i);

const {
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE,
  validateTeamDynamicsExecutiveOverviewSnapshot,
  buildMockTeamDynamicsExecutiveOverviewSnapshot,
} = require(helperPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectInvalid(snapshot, pattern) {
  const validation = validateTeamDynamicsExecutiveOverviewSnapshot(snapshot);
  assert.equal(validation.ok, false);
  assert.equal(validation.errors.some((error) => pattern.test(error)), true);
}

function main() {
  const validSnapshot = buildMockTeamDynamicsExecutiveOverviewSnapshot();
  const validation = validateTeamDynamicsExecutiveOverviewSnapshot(validSnapshot);

  assert.equal(validation.ok, true);
  assert.equal(validSnapshot.reportType, TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE);

  const wrongReportType = clone(validSnapshot);
  wrongReportType.reportType = "team_dynamics_team_fit_v1";
  expectInvalid(wrongReportType, /reportType/);

  const missingRequiredSection = clone(validSnapshot);
  delete missingRequiredSection.executiveSummary;
  expectInvalid(missingRequiredSection, /executiveSummary/);

  const forbiddenIndividualScore = clone(validSnapshot);
  forbiddenIndividualScore.dimensionOverview.individualScores = [
    { participantId: "p-1", score0To100: 72 },
  ];
  expectInvalid(forbiddenIndividualScore, /individualScores/);

  const forbiddenIndividualAnswers = clone(validSnapshot);
  forbiddenIndividualAnswers.rawResponses = [{ participantId: "p-1", answer: "x" }];
  expectInvalid(forbiddenIndividualAnswers, /rawResponses/);

  const forbiddenTeamFit = clone(validSnapshot);
  forbiddenTeamFit.teamFitOutput = {
    summary: "Not allowed here.",
  };
  expectInvalid(forbiddenTeamFit, /teamFitOutput/);

  const forbiddenUnifiedOverallScore = clone(validSnapshot);
  forbiddenUnifiedOverallScore.unifiedOverallTeamScore = 84;
  expectInvalid(forbiddenUnifiedOverallScore, /unifiedOverallTeamScore/);
}

try {
  main();
  console.log("Team Dynamics executive overview contract tests passed.");
} catch (error) {
  console.error(error);
  process.exit(1);
}
