const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageDir = path.join(__dirname, "..", "assessment-packages", "team_dynamics_assessment_v1");
const localizedBsDir = path.join(packageDir, "locales", "bs");

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(packageDir, fileName), "utf8"));
}

const test = readJson("test.json");
const dimensions = readJson("dimensions.json");
const items = readJson("items.json");
const options = readJson("options.json");
const prompts = readJson("prompts.json");
const contentSpec = readJson("content-spec.json");
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

assert.equal(contentSpec.assessment.assessment_key, "team_dynamics_assessment_v1");
assert.equal(contentSpec.assessment.unit_counts.total_assessment_units, 48);
assert.equal(contentSpec.blocks["tdm-31-V1"].item_count, 31);
assert.equal(contentSpec.blocks.psychological_safety.item_count, 7);
assert.equal(contentSpec.blocks.situational_judgment.scenario_count, 6);
assert.equal(contentSpec.blocks.outcome_pulse.item_count, 4);
assert.equal(
  contentSpec.blocks.situational_judgment.scoring_model,
  "expert_key_partial_credit_v1",
);
assert.equal(
  contentSpec.blocks.situational_judgment.score_transform,
  "sjt_score_0_100 = ((raw_total + 12) / 36) * 100",
);
assert.deepEqual(contentSpec.blocks.psychological_safety.phase_2_optional_metrics, ["AD_M"]);
assert.deepEqual(contentSpec.response_scales.likert_1_4_agreement.labels, {
  "1": "Uopce se ne slazem",
  "2": "Uglavnom se ne slazem",
  "3": "Uglavnom se slazem",
  "4": "U potpunosti se slazem",
});

console.log("Team Dynamics assessment v1 content-spec tests passed.");
