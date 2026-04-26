const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function createPackageFixture(localeNames) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "assessment-locales-"));
  writeJson(path.join(tempDir, "test.json"), {
    slug: "fixture-test",
    name: "Fixture Test",
    category: "personality",
    scoring_method: "likert_sum",
    version: "v1",
    status: "draft",
    is_active: false,
    intended_use: "internal",
    report_family: "fixture",
    description: "Fixture description",
  });
  writeJson(path.join(tempDir, "dimensions.json"), []);
  writeJson(path.join(tempDir, "items.json"), []);
  writeJson(path.join(tempDir, "options.json"), []);
  writeJson(path.join(tempDir, "prompts.json"), []);

  for (const locale of localeNames) {
    writeJson(path.join(tempDir, "locales", locale, "questions.json"), []);
    writeJson(path.join(tempDir, "locales", locale, "options.json"), []);
    writeJson(path.join(tempDir, "locales", locale, "prompts.json"), []);
  }

  return tempDir;
}

async function main() {
  const {
    DEFAULT_ASSESSMENT_LOCALE,
    getAssessmentLocaleFallbacks,
    getPreferredAssessmentLocaleRecord,
    normalizeAssessmentLocale,
    toLegacyAssessmentLocale,
  } = require("../lib/assessment/locale.ts");
  const {
    resolveLocalizedTestMetadata,
  } = require("../lib/assessment/test-localizations.ts");
  const { loadAssessmentPackage } = await import(
    pathToFileURL(path.join(projectRoot, "scripts/validate-assessment-package.mjs")).href
  );
  const { buildImportPayload } = await import(
    pathToFileURL(path.join(projectRoot, "scripts/import-assessment-package.mjs")).href
  );

  assert.equal(DEFAULT_ASSESSMENT_LOCALE, "bs");
  assert.equal(normalizeAssessmentLocale(undefined), "bs");
  assert.equal(normalizeAssessmentLocale(null), "bs");
  assert.equal(normalizeAssessmentLocale("bs"), "bs");
  assert.equal(normalizeAssessmentLocale("hr"), "hr");
  assert.equal(normalizeAssessmentLocale("sr"), "sr");
  assert.equal(normalizeAssessmentLocale("en"), "en");
  assert.equal(normalizeAssessmentLocale("bs-Latn-BA"), "bs");
  assert.equal(normalizeAssessmentLocale("hr-Latn-HR"), "hr");
  assert.equal(normalizeAssessmentLocale("sr-Cyrl-RS"), "sr");
  assert.equal(normalizeAssessmentLocale("unknown"), "bs");

  assert.deepEqual(getAssessmentLocaleFallbacks("bs"), ["bs"]);
  assert.deepEqual(getAssessmentLocaleFallbacks("bs-Latn-BA"), ["bs"]);
  assert.deepEqual(getAssessmentLocaleFallbacks("hr"), ["hr", "bs"]);
  assert.deepEqual(getAssessmentLocaleFallbacks("hr-Latn-HR"), ["hr", "bs"]);
  assert.deepEqual(getAssessmentLocaleFallbacks("sr"), ["sr", "bs"]);
  assert.deepEqual(getAssessmentLocaleFallbacks("sr-Cyrl-RS"), ["sr", "bs"]);
  assert.deepEqual(getAssessmentLocaleFallbacks("en"), ["en", "bs"]);

  assert.equal(toLegacyAssessmentLocale("bs-Latn-BA"), "bs");
  assert.equal(toLegacyAssessmentLocale("hr-Latn-HR"), "hr");
  assert.equal(toLegacyAssessmentLocale("sr-Cyrl-RS"), "sr");
  assert.equal(toLegacyAssessmentLocale("bs"), "bs");
  assert.equal(toLegacyAssessmentLocale("hr"), "hr");
  assert.equal(toLegacyAssessmentLocale("sr"), "sr");
  assert.equal(toLegacyAssessmentLocale("en"), "en");

  assert.deepEqual(
    resolveLocalizedTestMetadata(
      { name: "Base name", description: "Base description" },
      [
        { locale: "bs", name: "Legacy BS", description: "Legacy BS desc" },
        { locale: "hr", name: "Legacy HR", description: "Legacy HR desc" },
      ],
      "hr",
    ),
    {
      locale: "hr",
      name: "Legacy HR",
      description: "Legacy HR desc",
    },
  );

  assert.deepEqual(
    resolveLocalizedTestMetadata(
      { name: "Base name", description: "Base description" },
      [
        { locale: "bs", name: "Canonical BS", description: null },
      ],
      "unknown",
    ),
    {
      locale: "bs",
      name: "Canonical BS",
      description: null,
    },
  );

  assert.equal(
    getPreferredAssessmentLocaleRecord(
      [
        { locale: "bs", value: "legacy-bs" },
        { locale: "hr-Latn-HR", value: "canonical-hr" },
      ],
      "hr",
    )?.value,
    "canonical-hr",
  );

  const productPackageDir = createPackageFixture(["bs", "hr", "sr", "en"]);
  const aliasPackageDir = createPackageFixture(["bs-Latn-BA", "hr-Latn-HR"]);

  const productPackage = await loadAssessmentPackage(productPackageDir);
  assert.deepEqual(Object.keys(productPackage.locales), ["bs", "en", "hr", "sr"]);
  assert.equal(productPackage.packageMode, "full_assessment_or_partial_content");

  const aliasPackage = await loadAssessmentPackage(aliasPackageDir);
  assert.deepEqual(Object.keys(aliasPackage.locales), ["bs-Latn-BA", "hr-Latn-HR"]);
  assert.equal(aliasPackage.packageMode, "full_assessment_or_partial_content");

  const importPayload = buildImportPayload(productPackage);
  assert.deepEqual(Object.keys(importPayload.locales), ["bs", "en", "hr", "sr"]);

  const migrationPath = path.join(
    projectRoot,
    "supabase/migrations/20260424190000_add_test_localizations_and_expand_assessment_locales.sql",
  );
  const migrationContents = fs.readFileSync(migrationPath, "utf8");

  assert.match(
    migrationContents,
    /create table if not exists public\.test_localizations/i,
  );
  assert.match(migrationContents, /attempts_locale_check/i);
  assert.match(migrationContents, /bs-Latn-BA/);
  assert.match(migrationContents, /hr-Latn-HR/);

  console.log("Assessment locale infrastructure tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
