const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { pathToFileURL } = require("node:url");

const projectRoot = path.resolve(__dirname, "..");
const packageDir = path.join(projectRoot, "assessment-packages", "team_dynamics_assessment_v1");
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

async function main() {
  const importModule = await import(
    pathToFileURL(path.join(projectRoot, "scripts", "import-assessment-package.mjs")).href
  );
  const validateModule = await import(
    pathToFileURL(path.join(projectRoot, "scripts", "validate-assessment-package.mjs")).href
  );

  const {
    buildImportPayload,
    createAdminSupabaseClient,
    importAssessmentPackageViaRpc,
    loadLocalEnvFile,
  } = importModule;
  const { loadAssessmentPackage } = validateModule;
  const {
    loadTeamDynamicsMixedRuntimeDbSnapshot,
    loadTeamDynamicsMixedRuntimeHandoff,
  } = require("../lib/assessment/team-dynamics-mixed-runtime.ts");
  const {
    shouldHideAssessmentFromCandidateDashboard,
  } = require("../lib/assessment/availability.ts");
  const {
    STANDARD_ASSESSMENT_BATTERY_SLUGS,
  } = require("../lib/assessment/standard-battery.ts");
  const {
    getReportGenerationCapability,
  } = require("../lib/assessment/report-capabilities.ts");

  await loadLocalEnvFile();

  const packageData = await loadAssessmentPackage(packageDir);
  const payload = buildImportPayload(packageData);
  const supabase = createAdminSupabaseClient();
  const importResult = await importAssessmentPackageViaRpc(supabase, payload);

  assert.equal(importResult.ok, true);
  assert.equal(payload.test.slug, "team_dynamics_assessment_v1");
  assert.deepEqual(payload.options, []);

  const snapshot = await loadTeamDynamicsMixedRuntimeDbSnapshot({ locale: "bs" });
  const handoff = await loadTeamDynamicsMixedRuntimeHandoff({ locale: "bs" });

  assert.equal(snapshot.testRow.slug, "team_dynamics_assessment_v1");
  assert.equal(snapshot.testRow.scoring_method, "mixed_v1");
  assert.equal(snapshot.testRow.metadata.import_mode, "mixed_format_content_spec_v1");
  assert.equal(handoff.testSlug, "team_dynamics_assessment_v1");
  assert.equal(handoff.assessmentKey, "team_dynamics_assessment_v1");
  assert.equal(handoff.importMode, "mixed_format_content_spec_v1");
  assert.equal(handoff.locale, "bs");
  assert.equal(handoff.scoringMethod, "mixed_v1");
  assert.equal(handoff.blockCount, 4);
  assert.equal(handoff.itemCount, 48);
  assert.equal(handoff.likertItemCount, 42);
  assert.equal(handoff.sjtScenarioCount, 6);
  assert.equal(handoff.outcomePulseItemCount, 4);
  assert.deepEqual(handoff.warnings, []);
  assert.deepEqual(handoff.unsupportedItems, []);

  assert.deepEqual(
    handoff.blocks.map((block) => [block.blockKey, block.blockType, block.displayOrder]),
    [
      ["tdm-31-V1", "likert", 1],
      ["psychological_safety", "likert", 2],
      ["situational_judgment", "sjt_best_worst", 3],
      ["outcome_pulse", "likert", 4],
    ],
  );

  assert.equal(handoff.blocks[0].itemCount, 31);
  assert.equal(handoff.blocks[1].itemCount, 7);
  assert.equal(handoff.blocks[2].itemCount, 6);
  assert.equal(handoff.blocks[3].itemCount, 4);

  const tdmItems = handoff.items.filter((item) => item.blockKey === "tdm-31-V1");
  const psychItems = handoff.items.filter((item) => item.blockKey === "psychological_safety");
  const sjtItems = handoff.items.filter((item) => item.blockKey === "situational_judgment");
  const outcomeItems = handoff.items.filter((item) => item.blockKey === "outcome_pulse");

  assert.equal(tdmItems.length, 31);
  assert.equal(psychItems.length, 7);
  assert.equal(sjtItems.length, 6);
  assert.equal(outcomeItems.length, 4);

  const firstLikertItem = handoff.items.find((item) => item.code === "TDM31_01");
  assert.equal(firstLikertItem.responseFormat, "single_select_likert");
  assert.equal(firstLikertItem.questionType, "single_choice");
  assert.equal(firstLikertItem.options.length, 4);
  assert.deepEqual(
    firstLikertItem.options.map((option) => option.value),
    [1, 2, 3, 4],
  );
  assert.ok(
    firstLikertItem.options.every(
      (option) => option.metadata.response_format === "single_select_likert",
    ),
  );
  assert.equal(firstLikertItem.localizedText.length > 0, true);

  const firstSjtItem = handoff.items.find((item) => item.code === "SJT_TD_01");
  assert.equal(firstSjtItem.responseFormat, "best_worst");
  assert.equal(firstSjtItem.questionType, "multiple_choice");
  assert.equal(firstSjtItem.options.length, 4);
  assert.equal(firstSjtItem.metadata.scenario_title, "Konflikt koji prelazi u personalizaciju");
  assert.ok(
    firstSjtItem.options.every(
      (option) =>
        option.metadata.scenario_id === "SJT_TD_01" &&
        option.metadata.response_format === "best_worst",
    ),
  );
  assert.deepEqual(
    firstSjtItem.options.map((option) => option.metadata.option_level).sort(),
    ["Acceptable", "Best", "Harmful", "Weak"],
  );

  assert.ok(
    outcomeItems.every(
      (item) =>
        item.responseFormat === "single_select_likert" &&
        item.options.length === 4,
    ),
  );

  assert.equal(shouldHideAssessmentFromCandidateDashboard({ slug: handoff.testSlug }), true);
  assert.equal(STANDARD_ASSESSMENT_BATTERY_SLUGS.includes(handoff.testSlug), false);
  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: handoff.testSlug,
      audience: "participant",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: false, status: "inactive", reason: "unknown_test" },
  );
  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: handoff.testSlug,
      audience: "hr",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: false, status: "inactive", reason: "unknown_test" },
  );

  console.log("Team Dynamics assessment v1 runtime handoff tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
