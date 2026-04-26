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
  MWMS_COMPOSITE_DIMENSIONS,
  MWMS_DIMENSION_CODES,
  MWMS_DIMENSION_ITEM_CODES,
  MWMS_ITEM_CODES,
  MWMS_ITEM_TO_DIMENSION,
  MWMS_REQUIRED_ITEM_COUNT,
  MWMS_V1_TEST_SLUG,
  scoreMwmsV1Responses,
} = require("../lib/assessment/mwms-scoring.ts");

const happyPathResponses = {
  MWMS_01: 1,
  MWMS_02: 2,
  MWMS_03: 3,
  MWMS_04: 2,
  MWMS_05: 2,
  MWMS_06: 3,
  MWMS_07: 4,
  MWMS_08: 5,
  MWMS_09: 5,
  MWMS_10: 3,
  MWMS_11: 3,
  MWMS_12: 4,
  MWMS_13: 5,
  MWMS_14: 6,
  MWMS_15: 6,
  MWMS_16: 5,
  MWMS_17: 7,
  MWMS_18: 6,
  MWMS_19: 6,
};

const happyPathResult = scoreMwmsV1Responses(happyPathResponses);
assert.equal(happyPathResult.testSlug, MWMS_V1_TEST_SLUG);
assert.equal(happyPathResult.isComplete, true);

if (!happyPathResult.isComplete) {
  throw new Error("Expected complete MWMS scoring result.");
}

assert.deepEqual(happyPathResult.dimensions, {
  amotivation: {
    score: 2,
    answeredItems: 3,
    requiredItems: 3,
  },
  external_social: {
    score: 2.33,
    answeredItems: 3,
    requiredItems: 3,
  },
  external_material: {
    score: 4.67,
    answeredItems: 3,
    requiredItems: 3,
  },
  introjected: {
    score: 3.75,
    answeredItems: 4,
    requiredItems: 4,
  },
  identified: {
    score: 5.67,
    answeredItems: 3,
    requiredItems: 3,
  },
  intrinsic: {
    score: 6.33,
    answeredItems: 3,
    requiredItems: 3,
  },
});

assert.deepEqual(happyPathResult.composites, {
  autonomous_motivation: {
    score: 6,
    sourceDimensions: ["identified", "intrinsic"],
  },
  controlled_motivation: {
    score: 3.58,
    sourceDimensions: ["introjected", "external_social", "external_material"],
  },
});

const missingResponses = { ...happyPathResponses };
delete missingResponses.MWMS_19;
const missingItemResult = scoreMwmsV1Responses(missingResponses);
assert.equal(missingItemResult.isComplete, false);
assert.equal(missingItemResult.error.code, "missing_required_item");

const invalidLowValueResult = scoreMwmsV1Responses({
  ...happyPathResponses,
  MWMS_01: 0,
});
assert.equal(invalidLowValueResult.isComplete, false);
assert.equal(invalidLowValueResult.error.code, "invalid_value");

const invalidHighValueResult = scoreMwmsV1Responses({
  ...happyPathResponses,
  MWMS_19: 8,
});
assert.equal(invalidHighValueResult.isComplete, false);
assert.equal(invalidHighValueResult.error.code, "invalid_value");

const unknownItemResult = scoreMwmsV1Responses({
  ...happyPathResponses,
  MWMS_99: 4,
});
assert.equal(unknownItemResult.isComplete, false);
assert.equal(unknownItemResult.error.code, "unknown_item");

assert.equal("totalScore" in happyPathResult, false);
assert.equal("overallScore" in happyPathResult, false);
assert.equal("percentage" in happyPathResult, false);
assert.equal("passFail" in happyPathResult, false);

assert.equal(MWMS_REQUIRED_ITEM_COUNT, 19);
assert.equal(MWMS_ITEM_CODES.length, 19);
assert.deepEqual(
  MWMS_DIMENSION_CODES.map((dimensionCode) => MWMS_DIMENSION_ITEM_CODES[dimensionCode].length),
  [3, 3, 3, 4, 3, 3],
);

const uniqueItemCodes = new Set(MWMS_ITEM_CODES);
assert.equal(uniqueItemCodes.size, 19);

for (const itemCode of MWMS_ITEM_CODES) {
  assert.equal(typeof MWMS_ITEM_TO_DIMENSION[itemCode], "string");
}

assert.deepEqual(MWMS_COMPOSITE_DIMENSIONS, {
  autonomous_motivation: ["identified", "intrinsic"],
  controlled_motivation: ["introjected", "external_social", "external_material"],
});

console.log("MWMS scoring tests passed.");
