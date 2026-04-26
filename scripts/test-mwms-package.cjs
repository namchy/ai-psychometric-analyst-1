const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
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

function assertNoPlaceholderText(text, label) {
  assert.equal(/todo/i.test(text), false, `${label} must not contain TODO.`);
  assert.equal(/placeholder/i.test(text), false, `${label} must not contain placeholder text.`);
  assert.equal(/nije produkcijski tekst/i.test(text), false, `${label} must not contain placeholder copy.`);
}

async function main() {
  const packageDir = path.join(projectRoot, "assessment-packages/mwms_v1");
  const testMetadata = JSON.parse(fs.readFileSync(path.join(packageDir, "test.json"), "utf8"));
  const dimensions = JSON.parse(fs.readFileSync(path.join(packageDir, "dimensions.json"), "utf8"));
  const items = JSON.parse(fs.readFileSync(path.join(packageDir, "items.json"), "utf8"));
  const options = JSON.parse(fs.readFileSync(path.join(packageDir, "options.json"), "utf8"));
  const localizedQuestionsBs = JSON.parse(
    fs.readFileSync(path.join(packageDir, "locales/bs/questions.json"), "utf8"),
  );
  const localizedQuestionsHr = JSON.parse(
    fs.readFileSync(path.join(packageDir, "locales/hr/questions.json"), "utf8"),
  );
  const localizedOptionsBs = JSON.parse(
    fs.readFileSync(path.join(packageDir, "locales/bs/options.json"), "utf8"),
  );
  const localizedOptionsHr = JSON.parse(
    fs.readFileSync(path.join(packageDir, "locales/hr/options.json"), "utf8"),
  );
  const { loadAssessmentPackage } = await import(
    pathToFileURL(path.join(projectRoot, "scripts/validate-assessment-package.mjs")).href
  );
  const {
    MWMS_DIMENSION_ITEM_CODES,
    MWMS_ITEM_CODES,
    MWMS_ITEM_TO_DIMENSION,
    MWMS_V1_TEST_SLUG,
  } = require("../lib/assessment/mwms-scoring.ts");

  assert.equal(testMetadata.slug, MWMS_V1_TEST_SLUG);
  assert.equal(testMetadata.status, "active");
  assert.equal(testMetadata.is_active, true);
  assert.equal(testMetadata.default_locale, "bs");
  assert.deepEqual(testMetadata.supported_locales, ["bs", "hr"]);
  assert.equal(testMetadata.metadata.scoring_profile, "mwms_profile");

  assert.equal(items.length, 19);
  assert.deepEqual(
    items.map((item) => item.code),
    MWMS_ITEM_CODES,
  );

  const dimensionCounts = Object.fromEntries(
    dimensions.map((dimension) => [dimension.code, 0]),
  );

  for (const item of items) {
    assert.equal(Array.isArray(item.mappings), true, `${item.code} must contain mappings array.`);
    assert.equal(item.mappings.length, 1, `${item.code} must map to exactly one dimension.`);
    assert.equal(item.question_type, "single_choice");
    assert.equal(item.is_required, true);
    assert.equal(item.mappings[0].weight, 1);
    assert.equal(item.mappings[0].reverse_scored, false);
    assert.equal(
      item.mappings[0].dimension_code,
      MWMS_ITEM_TO_DIMENSION[item.code],
      `${item.code} dimension mapping must match MWMS scoring helper.`,
    );
    dimensionCounts[item.mappings[0].dimension_code] += 1;
    assertNoPlaceholderText(item.text, `${item.code} base text`);
  }

  assert.deepEqual(dimensionCounts, {
    amotivation: 3,
    external_social: 3,
    external_material: 3,
    introjected: 4,
    identified: 3,
    intrinsic: 3,
  });

  assert.deepEqual(
    Object.fromEntries(
      Object.entries(MWMS_DIMENSION_ITEM_CODES).map(([dimensionCode, codes]) => [
        dimensionCode,
        codes.length,
      ]),
    ),
    dimensionCounts,
  );

  assert.equal(options.length, 7);
  assert.deepEqual(
    options.map((option) => option.value),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(options.every((option) => Number.isInteger(option.value)), true);

  assert.equal(localizedQuestionsBs.length, 19);
  assert.equal(localizedQuestionsHr.length, 19);
  assert.equal(localizedOptionsBs.length, 7);
  assert.equal(localizedOptionsHr.length, 7);
  assert.deepEqual(localizedQuestionsBs, localizedQuestionsHr);
  assert.deepEqual(localizedOptionsBs, localizedOptionsHr);

  for (const item of localizedQuestionsBs) {
    assertNoPlaceholderText(item.text, `${item.code} localized text`);
  }

  assert.equal(fs.existsSync(path.join(packageDir, "locales/sr")), false);
  assert.equal(fs.existsSync(path.join(packageDir, "locales/en")), false);
  assert.equal("totalScore" in testMetadata, false);
  assert.equal("overallScore" in testMetadata, false);
  assert.equal("percentage" in testMetadata, false);

  const packageData = await loadAssessmentPackage(packageDir);
  assert.deepEqual(Object.keys(packageData.locales), ["bs", "hr"]);

  console.log("MWMS package tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
