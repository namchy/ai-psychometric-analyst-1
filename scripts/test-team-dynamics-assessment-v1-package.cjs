const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const packageDir = path.join(__dirname, "..", "assessment-packages", "team_dynamics_assessment_v1");
const localizedBsDir = path.join(packageDir, "locales", "bs");

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(packageDir, fileName), "utf8"));
}

async function main() {
  const { loadAssessmentPackage } = await import(
    pathToFileURL(path.join(__dirname, "validate-assessment-package.mjs")).href
  );

  const packageData = await loadAssessmentPackage(packageDir);
  const { test, dimensions, items, options, prompts, locales, contentSpec, mixedAssessmentSpec } =
    packageData;

  const localizedQuestions = JSON.parse(
    fs.readFileSync(path.join(localizedBsDir, "questions.json"), "utf8"),
  );
  const localizedOptions = JSON.parse(
    fs.readFileSync(path.join(localizedBsDir, "options.json"), "utf8"),
  );
  const localizedPrompts = JSON.parse(
    fs.readFileSync(path.join(localizedBsDir, "prompts.json"), "utf8"),
  );

  assert.equal(test.slug, "team_dynamics_assessment_v1");
  assert.equal(test.name, "Procjena timske dinamike");
  assert.equal(test.category, "behavioral");
  assert.equal(test.scoring_method, "mixed_v1");
  assert.equal(test.intended_use, "team_assessment");
  assert.equal(test.report_family, "team_dynamics");
  assert.equal(test.default_locale, "bs");
  assert.deepEqual(test.supported_locales, ["bs"]);
  assert.equal(test.metadata.item_count, 48);
  assert.deepEqual(test.metadata.blocks, [
    "tdm-31-V1",
    "psychological_safety",
    "situational_judgment",
    "outcome_pulse",
  ]);
  assert.equal(test.metadata.import_readiness.status, "content_spec_ready_runtime_pending");
  assert.equal(test.metadata.import_readiness.blocked_by, "shared_options_catalog_constraint");

  assert.equal(dimensions.length, 14);
  assert.deepEqual(
    dimensions.map((dimension) => dimension.code),
    [
      "TDM_CORE_TOTAL",
      "TDM_COMMUNICATION",
      "TDM_ROLES_AND_GOALS",
      "TDM_COHESION",
      "TDM_TEAM_PRIMACY",
      "TDM_OVERALL_RASCH_ONLY",
      "PSYCHOLOGICAL_SAFETY",
      "SJT_TOTAL",
      "SJT_CONSTRUCTIVE_CONFLICT",
      "SJT_OWNERSHIP",
      "SJT_RISK_TRANSPARENCY",
      "SJT_COORDINATION",
      "SJT_ADAPTABILITY",
      "OUTCOME_PULSE",
    ],
  );

  assert.equal(items.length, 48);
  assert.equal(options.length, 0);
  assert.deepEqual(prompts, []);
  assert.equal(localizedQuestions.length, 48);
  assert.deepEqual(localizedOptions, []);
  assert.deepEqual(localizedPrompts, []);
  assert.deepEqual(Object.keys(locales), ["bs"]);
  assert.equal(contentSpec.assessment.assessment_key, "team_dynamics_assessment_v1");

  const tdmItems = items.filter((item) => item.metadata?.block_key === "tdm-31-V1");
  const psychItems = items.filter((item) => item.metadata?.block_key === "psychological_safety");
  const sjtItems = items.filter((item) => item.metadata?.block_key === "situational_judgment");
  const outcomeItems = items.filter((item) => item.metadata?.block_key === "outcome_pulse");

  assert.equal(tdmItems.length, 31);
  assert.equal(psychItems.length, 7);
  assert.equal(sjtItems.length, 6);
  assert.equal(outcomeItems.length, 4);

  assert.deepEqual(
    tdmItems.filter((item) => item.metadata.reverse_scored).map((item) => item.code),
    ["TDM31_03", "TDM31_15", "TDM31_16", "TDM31_27"],
  );
  assert.equal(
    tdmItems.filter((item) => item.metadata.domain_group === "overall_rasch_only").length,
    7,
  );
  assert.ok(
    psychItems.every(
      (item) =>
        item.question_type === "single_choice" &&
        item.metadata.response_scale === "likert_1_4_agreement" &&
        item.metadata.reverse_scored === false,
    ),
  );
  assert.ok(
    outcomeItems.every(
      (item) =>
        item.question_type === "single_choice" &&
        item.metadata.report_role === "criterion_outcome_signal" &&
        item.metadata.diagnostic_index_role === "excluded_in_v1",
    ),
  );

  for (const item of sjtItems) {
    assert.equal(item.question_type, "multiple_choice");
    assert.equal(item.metadata.response_format, "best_worst");
    assert.equal(item.metadata.instruction_type, "knowledge_based_should_do");
    assert.equal(Array.isArray(item.metadata.options), true);
    assert.equal(item.metadata.options.length, 4);
    assert.deepEqual(
      item.metadata.options.map((option) => option.option_level).sort(),
      ["Acceptable", "Best", "Harmful", "Weak"],
    );
  }

  assert.equal(mixedAssessmentSpec.assessmentKey, "team_dynamics_assessment_v1");
  assert.equal(mixedAssessmentSpec.displayName, "Procjena timske dinamike");
  assert.equal(mixedAssessmentSpec.validationStatus, "validation_pending");
  assert.equal(mixedAssessmentSpec.estimatedDuration, "12-15 minuta");
  assert.equal(mixedAssessmentSpec.audience, "team_members");
  assert.equal(mixedAssessmentSpec.blocks.length, 4);
  assert.deepEqual(
    mixedAssessmentSpec.blocks.map((block) => [block.blockKey, block.blockType]),
    [
      ["tdm-31-V1", "likert"],
      ["psychological_safety", "likert"],
      ["situational_judgment", "sjt_best_worst"],
      ["outcome_pulse", "likert"],
    ],
  );

  const normalizedSjtBlock = mixedAssessmentSpec.blocks.find(
    (block) => block.blockKey === "situational_judgment",
  );
  assert.deepEqual(normalizedSjtBlock.scenarioIds, [
    "SJT_TD_01",
    "SJT_TD_02",
    "SJT_TD_03",
    "SJT_TD_04",
    "SJT_TD_05",
    "SJT_TD_06",
  ]);
  assert.equal(normalizedSjtBlock.optionsPerScenario, 4);
  assert.equal(normalizedSjtBlock.scoringModel, "expert_key_partial_credit_v1");

  const normalizedTdmBlock = mixedAssessmentSpec.blocks.find(
    (block) => block.blockKey === "tdm-31-V1",
  );
  assert.equal(normalizedTdmBlock.responseScaleKey, "likert_1_4_agreement");
  assert.equal(normalizedTdmBlock.itemIds.length, 31);
  assert.equal(normalizedTdmBlock.scoringMode, "simple_linear_v1");

  assert.deepEqual(Object.keys(mixedAssessmentSpec.sharedScales), [
    "likert_1_4_agreement",
    "best_worst",
  ]);
  assert.equal(mixedAssessmentSpec.scoring.assessmentScoringMode, "mixed_v1");
  assert.deepEqual(
    mixedAssessmentSpec.scoring.teamAggregation,
    contentSpec.team_aggregation,
  );
  assert.equal(mixedAssessmentSpec.guardrails.length > 0, true);

  console.log("Team Dynamics assessment v1 mixed-format package tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
