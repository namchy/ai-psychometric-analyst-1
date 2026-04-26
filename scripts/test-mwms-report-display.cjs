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
  buildMwmsComputedDimensionsFromPersistedScores,
} = require("../lib/assessment/scoring.ts");
const {
  formatDimensionLabel,
  formatMwmsScoreLabel,
  formatScoreLabel,
  getMwmsScoreWidth,
  isMwmsDimensionSet,
} = require("../lib/assessment/result-display.ts");

function assertApproxEqual(actual, expected, epsilon = 1e-9) {
  assert.equal(Math.abs(actual - expected) <= epsilon, true, `Expected ${actual} to be within ${epsilon} of ${expected}.`);
}

assert.equal(isMwmsDimensionSet([
  "amotivation",
  "external_social",
  "external_material",
  "introjected",
  "identified",
  "intrinsic",
]), true);

assert.equal(formatDimensionLabel("amotivation"), "Amotivacija");
assert.equal(formatDimensionLabel("external_social"), "Ekstrinzična motivacija — socijalna");
assert.equal(formatDimensionLabel("external_material"), "Ekstrinzična motivacija — materijalna");
assert.equal(formatDimensionLabel("introjected"), "Introjecirana motivacija");
assert.equal(formatDimensionLabel("identified"), "Identificirana motivacija");
assert.equal(formatDimensionLabel("intrinsic"), "Intrinzična motivacija");

assert.equal(formatMwmsScoreLabel(1), "1.00 / 7");
assert.equal(formatMwmsScoreLabel(4.67), "4.67 / 7");
assert.equal(formatMwmsScoreLabel(7), "7.00 / 7");
assert.equal(formatMwmsScoreLabel(4.67).includes("bod"), false);

assert.equal(getMwmsScoreWidth(1), 0);
assert.equal(getMwmsScoreWidth(4), 50);
assert.equal(getMwmsScoreWidth(7), 100);
assert.equal(getMwmsScoreWidth(0), 0);
assert.equal(getMwmsScoreWidth(8), 100);

const persistedMwmsDimensions = buildMwmsComputedDimensionsFromPersistedScores([
  { dimension: "amotivation", raw_score: 4.0 },
  { dimension: "external_social", raw_score: 4.0 },
  { dimension: "external_material", raw_score: 5.0 },
  { dimension: "introjected", raw_score: 3.75 },
  { dimension: "identified", raw_score: 4.67 },
  { dimension: "intrinsic", raw_score: 5.0 },
]);

assert.ok(persistedMwmsDimensions, "Expected MWMS persisted dimensions to map successfully.");
assert.deepEqual(
  persistedMwmsDimensions.map((dimension) => ({
    dimension: dimension.dimension,
    rawScore: dimension.rawScore,
    scoreLabel: formatMwmsScoreLabel(dimension.rawScore),
  })),
  [
    { dimension: "amotivation", rawScore: 4, scoreLabel: "4.00 / 7" },
    { dimension: "external_social", rawScore: 4, scoreLabel: "4.00 / 7" },
    { dimension: "external_material", rawScore: 5, scoreLabel: "5.00 / 7" },
    { dimension: "introjected", rawScore: 3.75, scoreLabel: "3.75 / 7" },
    { dimension: "identified", rawScore: 4.67, scoreLabel: "4.67 / 7" },
    { dimension: "intrinsic", rawScore: 5, scoreLabel: "5.00 / 7" },
  ],
);
assertApproxEqual(getMwmsScoreWidth(4), 50);
assertApproxEqual(getMwmsScoreWidth(5), 66.66666666666666);
assertApproxEqual(getMwmsScoreWidth(3.75), 45.83333333333333);
assertApproxEqual(getMwmsScoreWidth(4.67), 61.16666666666666);
assert.equal(persistedMwmsDimensions.some((dimension) => dimension.rawScore === 12), false);
assert.equal(persistedMwmsDimensions.some((dimension) => dimension.rawScore === 15), false);
assert.equal(persistedMwmsDimensions.some((dimension) => dimension.rawScore === 14), false);

assert.equal(formatScoreLabel(12), "12 bodova");
assert.equal(formatDimensionLabel("EXTRAVERSION"), "Ekstraverzija");

console.log("MWMS report display tests passed.");
