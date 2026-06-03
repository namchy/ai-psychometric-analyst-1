const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  buildMwmsHrReportInput,
  getMwmsHrBand,
  getMwmsHrBandLabel,
} = require("../lib/assessment/mwms-hr-report-v1.ts");

const input = buildMwmsHrReportInput({
  attemptId: "attempt-mwms-hr-input",
  testId: "test-mwms",
  testSlug: "mwms_v1",
  audience: "hr",
  locale: "bs",
  scoringMethod: "likert_sum",
  promptVersion: "v1",
  results: {
    attemptId: "attempt-mwms-hr-input",
    scoringMethod: "likert_sum",
    dimensions: [
      { dimension: "amotivation", rawScore: 2.5, scoredQuestionCount: 3 },
      { dimension: "external_social", rawScore: 3, scoredQuestionCount: 3 },
      { dimension: "external_material", rawScore: 4.99, scoredQuestionCount: 3 },
      { dimension: "introjected", rawScore: 5.5, scoredQuestionCount: 4 },
      { dimension: "identified", rawScore: 6, scoredQuestionCount: 3 },
      { dimension: "intrinsic", rawScore: 4, scoredQuestionCount: 3 },
    ],
    scoredResponseCount: 19,
    unscoredResponses: [],
  },
});

assert.equal(input.testSlug, "mwms_v1");
assert.equal(input.audience, "hr");
assert.equal(input.reportType, "individual");
assert.equal(input.sourceType, "single_test");
assert.deepEqual(input.scale, { min: 1, max: 7 });
assert.equal(input.dimensions.length, 6);
assert.deepEqual(
  input.dimensions.map((dimension) => dimension.code),
  [
    "amotivation",
    "external_social",
    "external_material",
    "introjected",
    "identified",
    "intrinsic",
  ],
);
assert.equal(input.dimensions.every((dimension) => dimension.rawScore >= 1 && dimension.rawScore <= 7), true);
assert.equal(input.dimensions.every((dimension) => typeof dimension.label === "string" && dimension.label.length > 0), true);
assert.equal(
  input.dimensions.every(
    (dimension) =>
      dimension.band === getMwmsHrBand(dimension.rawScore) &&
      dimension.bandLabel === getMwmsHrBandLabel(dimension.band),
  ),
  true,
);
assert.equal(input.dimensions.find((dimension) => dimension.code === "amotivation")?.band, "lower");
assert.equal(input.dimensions.find((dimension) => dimension.code === "external_social")?.band, "moderate");
assert.equal(input.dimensions.find((dimension) => dimension.code === "external_material")?.band, "moderate");
assert.equal(input.dimensions.find((dimension) => dimension.code === "introjected")?.band, "higher");
assert.equal(input.derivedProfile.autonomousMotivationScore, 5);
assert.equal(input.derivedProfile.controlledMotivationScore, 4.5);
assert.equal(input.derivedProfile.amotivationScore, 2.5);
assert.deepEqual(input.derivedProfile.dominantDimensions, ["identified", "introjected"]);
assert.deepEqual(input.derivedProfile.lowerDimensions, ["amotivation", "external_social"]);
assert.deepEqual(input.derivedProfile.cautionFlags, {
  elevatedAmotivation: false,
  highControlledRelativeToAutonomous: false,
  mixedProfile: true,
});
assert.deepEqual(input.interpretationBoundaries, {
  noScoreRecalculation: true,
  noScoreMutation: true,
  noHiringDecision: true,
  noDiagnosis: true,
  noCompositeInsight: true,
  useAsHrHypotheses: true,
});
assert.equal("responses" in input, false);
assert.equal("raw_answers" in input, false);
assert.equal("participantReport" in input, false);
assert.equal(getMwmsHrBand(1), "lower");
assert.equal(getMwmsHrBand(2.99), "lower");
assert.equal(getMwmsHrBand(3), "moderate");
assert.equal(getMwmsHrBand(4.99), "moderate");
assert.equal(getMwmsHrBand(5), "higher");
assert.equal(getMwmsHrBand(7), "higher");
assert.throws(() => getMwmsHrBand(0.99), /between 1 and 7/);

console.log("MWMS HR report input tests passed.");
