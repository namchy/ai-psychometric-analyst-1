const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const projectRoot = path.resolve(__dirname, "..");
const packageDir = path.join(projectRoot, "assessment-packages", "team_dynamics_assessment_v1");

async function main() {
  const importModule = await import(
    pathToFileURL(path.join(projectRoot, "scripts", "import-assessment-package.mjs")).href
  );
  const validateModule = await import(
    pathToFileURL(path.join(projectRoot, "scripts", "validate-assessment-package.mjs")).href
  );

  const {
    buildImportPayload,
    buildImportedMixedFormatRuntimeShape,
    createAdminSupabaseClient,
    importAssessmentPackageViaRpc,
    loadLocalEnvFile,
  } = importModule;
  const { loadAssessmentPackage } = validateModule;

  await loadLocalEnvFile();

  const canonicalPackage = await loadAssessmentPackage(packageDir);
  const payload = buildImportPayload(canonicalPackage);

  assert.equal(payload.test.slug, "team_dynamics_assessment_v1");
  assert.deepEqual(payload.options, []);
  assert.equal(payload.import_strategy.mode, "mixed_format_content_spec_v1");
  assert.deepEqual(payload.import_strategy.block_order, [
    "tdm-31-V1",
    "psychological_safety",
    "situational_judgment",
    "outcome_pulse",
  ]);
  assert.equal(payload.import_strategy.item_option_catalogs.TDM31_01.length, 4);
  assert.deepEqual(
    payload.import_strategy.item_option_catalogs.TDM31_01.map((option) => option.value),
    [1, 2, 3, 4],
  );
  assert.equal(payload.import_strategy.item_option_catalogs.SJT_TD_01.length, 4);
  assert.equal(
    payload.import_strategy.item_option_catalogs.SJT_TD_01[0].metadata.response_format,
    "best_worst",
  );
  assert.equal(
    payload.import_strategy.item_option_catalogs.SJT_TD_01[0].metadata.scenario_id,
    "SJT_TD_01",
  );

  const scaffoldPackage = await loadAssessmentPackage(
    path.join(projectRoot, "assessment-packages", "team_dynamics_v1_strong"),
  );
  const scaffoldPayload = buildImportPayload(scaffoldPackage);
  assert.equal(scaffoldPayload.import_strategy, undefined);
  assert.equal(scaffoldPayload.options.length > 0, true);

  const supabase = createAdminSupabaseClient();
  const importResult = await importAssessmentPackageViaRpc(supabase, payload);

  assert.equal(importResult.ok, true);
  assert.equal(importResult.test_slug, "team_dynamics_assessment_v1");
  assert.equal(importResult.counts.questions, 48);
  assert.equal(importResult.counts.dimensions, 14);
  assert.equal(importResult.counts.options, 192);

  const { data: testRow, error: testError } = await supabase
    .from("tests")
    .select("id, slug, metadata")
    .eq("slug", "team_dynamics_assessment_v1")
    .single();

  if (testError) {
    throw new Error(`Failed to load imported test row: ${testError.message}`);
  }

  const testId = testRow.id;

  const [{ data: dimensionRows, error: dimensionError }, { data: questionRows, error: questionError }] =
    await Promise.all([
      supabase
        .from("test_dimensions")
        .select("code, display_order, metadata")
        .eq("test_id", testId)
        .order("display_order", { ascending: true }),
      supabase
        .from("questions")
        .select("id, code, question_order, question_type, metadata")
        .eq("test_id", testId)
        .eq("is_active", true)
        .order("question_order", { ascending: true }),
    ]);

  if (dimensionError) {
    throw new Error(`Failed to load imported dimensions: ${dimensionError.message}`);
  }

  if (questionError) {
    throw new Error(`Failed to load imported questions: ${questionError.message}`);
  }

  const questionIds = (questionRows ?? []).map((question) => question.id);
  const { data: optionRows, error: optionError } = await supabase
    .from("answer_options")
    .select("question_id, code, label, value, option_order, metadata")
    .in("question_id", questionIds)
    .order("question_id", { ascending: true })
    .order("option_order", { ascending: true });

  if (optionError) {
    throw new Error(`Failed to load imported answer options: ${optionError.message}`);
  }

  assert.equal(testRow.metadata.import_mode, "mixed_format_content_spec_v1");
  assert.equal(testRow.metadata.version, "v1_content_spec");
  assert.equal(testRow.metadata.intended_use, "team_assessment");
  assert.equal(testRow.metadata.report_family, "team_dynamics");
  assert.equal(testRow.metadata.content_spec.assessment.assessment_key, "team_dynamics_assessment_v1");
  assert.deepEqual(testRow.metadata.content_spec.assessment.blocks, [
    "tdm-31-V1",
    "psychological_safety",
    "situational_judgment",
    "outcome_pulse",
  ]);

  assert.equal(dimensionRows.length, 14);
  assert.equal(
    dimensionRows.find((dimension) => dimension.code === "SJT_CONSTRUCTIVE_CONFLICT").metadata.block_key,
    "situational_judgment",
  );
  assert.equal(
    dimensionRows.find((dimension) => dimension.code === "OUTCOME_PULSE").metadata.score_role,
    "criterion_outcome_signal",
  );

  const importedRuntimeShape = buildImportedMixedFormatRuntimeShape({
    testRow,
    questionRows,
    optionRows,
  });

  assert.deepEqual(importedRuntimeShape.blockOrder, [
    "tdm-31-V1",
    "psychological_safety",
    "situational_judgment",
    "outcome_pulse",
  ]);
  assert.equal(importedRuntimeShape.units.length, 48);
  assert.equal(importedRuntimeShape.optionCatalogs.likert_1_4_agreement.length, 4);

  const firstLikertUnit = importedRuntimeShape.units.find((unit) => unit.questionCode === "TDM31_01");
  assert.deepEqual(
    firstLikertUnit.options.map((option) => option.value),
    [1, 2, 3, 4],
  );
  assert.equal(firstLikertUnit.itemMetadata.block_key, "tdm-31-V1");
  assert.equal(firstLikertUnit.itemMetadata.response_format, "single_select_likert");
  assert.equal(firstLikertUnit.responseScaleKey, "likert_1_4_agreement");
  assert.ok(
    firstLikertUnit.options.every(
      (option) => option.metadata.response_format === "single_select_likert",
    ),
  );

  const firstSjtUnit = importedRuntimeShape.units.find((unit) => unit.questionCode === "SJT_TD_01");
  assert.equal(firstSjtUnit.responseFormat, "best_worst");
  assert.equal(firstSjtUnit.scenarioMetadata.scenario_title, "Konflikt koji prelazi u personalizaciju");
  assert.equal(firstSjtUnit.options.length, 4);
  assert.deepEqual(
    firstSjtUnit.options.map((option) => option.metadata.option_level).sort(),
    ["Acceptable", "Best", "Harmful", "Weak"],
  );
  assert.ok(
    firstSjtUnit.options.every(
      (option) => option.metadata.scenario_id === "SJT_TD_01" && option.metadata.response_format === "best_worst",
    ),
  );

  const outcomeUnits = importedRuntimeShape.units.filter((unit) => unit.blockKey === "outcome_pulse");
  assert.equal(outcomeUnits.length, 4);
  assert.ok(
    outcomeUnits.every((unit) => unit.itemMetadata.response_format === "single_select_likert"),
  );

  console.log("Team Dynamics assessment v1 DB import tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
