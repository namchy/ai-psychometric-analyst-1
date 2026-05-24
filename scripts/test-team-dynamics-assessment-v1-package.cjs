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
  const { buildImportPayload, buildImportedMixedFormatRuntimeShape } = await import(
    pathToFileURL(path.join(__dirname, "import-assessment-package.mjs")).href
  );

  const packageData = await loadAssessmentPackage(packageDir);
  const {
    test,
    dimensions,
    items,
    options,
    prompts,
    locales,
    contentSpec,
    mixedAssessmentSpec,
    mixedFormatImportPlan,
    teamDynamicsExecutionSpec,
  } =
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

  assert.equal(mixedFormatImportPlan.mode, "mixed_format_content_spec_v1");
  assert.deepEqual(mixedFormatImportPlan.block_order, [
    "tdm-31-V1",
    "psychological_safety",
    "situational_judgment",
    "outcome_pulse",
  ]);
  assert.equal(mixedFormatImportPlan.item_option_catalogs.TDM31_01.length, 4);
  assert.deepEqual(
    mixedFormatImportPlan.item_option_catalogs.TDM31_01.map((option) => option.value),
    [1, 2, 3, 4],
  );
  assert.equal(mixedFormatImportPlan.item_option_catalogs.SJT_TD_01.length, 4);
  assert.equal(
    mixedFormatImportPlan.item_option_catalogs.SJT_TD_01[0].metadata.option_catalog_source,
    "scenario_level_sjt_options",
  );
  assert.equal(
    mixedFormatImportPlan.item_option_catalogs.SJT_TD_01[0].metadata.scenario_id,
    "SJT_TD_01",
  );
  assert.equal(
    mixedFormatImportPlan.item_metadata_by_code.TDM31_01.block_key,
    "tdm-31-V1",
  );
  assert.equal(
    mixedFormatImportPlan.dimension_metadata_by_code.SJT_TOTAL.block_key,
    "situational_judgment",
  );

  const importPayload = buildImportPayload(packageData);
  const mockQuestionRows = items.map((item) => ({
    id: `question-${item.code}`,
    code: item.code,
    question_order: item.question_order,
    question_type: item.question_type,
    metadata: {
      ...(item.metadata ?? {}),
      response_format:
        item.metadata?.response_format ??
        (item.question_type === "single_choice" ? "single_select_likert" : undefined),
    },
  }));
  const mockOptionRows = items.flatMap((item) =>
    (mixedFormatImportPlan.item_option_catalogs[item.code] ?? []).map((option) => ({
      question_id: `question-${item.code}`,
      code: option.code,
      label: option.label,
      value: option.value ?? null,
      option_order: option.option_order,
      metadata: option.metadata ?? {},
    })),
  );
  const importedRuntimeShape = buildImportedMixedFormatRuntimeShape({
    testRow: {
      slug: test.slug,
      metadata: importPayload.import_strategy.test_metadata,
    },
    questionRows: mockQuestionRows,
    optionRows: mockOptionRows,
  });

  assert.deepEqual(importedRuntimeShape.blockOrder, [
    "tdm-31-V1",
    "psychological_safety",
    "situational_judgment",
    "outcome_pulse",
  ]);
  assert.equal(importedRuntimeShape.units.length, 48);
  assert.equal(importedRuntimeShape.optionCatalogs.likert_1_4_agreement.length, 4);
  assert.equal(
    importedRuntimeShape.units.find((unit) => unit.questionCode === "TDM31_01").itemMetadata
      .response_format,
    "single_select_likert",
  );
  assert.equal(
    importedRuntimeShape.units.find((unit) => unit.questionCode === "SJT_TD_01").responseFormat,
    "best_worst",
  );
  assert.equal(
    importedRuntimeShape.units.find((unit) => unit.questionCode === "SJT_TD_01").options[0]
      .metadata.scenario_id,
    "SJT_TD_01",
  );

  assert.equal(teamDynamicsExecutionSpec.assessmentKey, "team_dynamics_assessment_v1");
  assert.equal(teamDynamicsExecutionSpec.displayName, "Procjena timske dinamike");
  assert.equal(teamDynamicsExecutionSpec.estimatedDuration, "12-15 minuta");
  assert.deepEqual(teamDynamicsExecutionSpec.optionCatalogs, {
    likert_1_4_agreement: [
      { value: 1, label: "Uopce se ne slazem" },
      { value: 2, label: "Uglavnom se ne slazem" },
      { value: 3, label: "Uglavnom se slazem" },
      { value: 4, label: "U potpunosti se slazem" },
    ],
  });
  assert.deepEqual(teamDynamicsExecutionSpec.metadata, {
    totalUnits: 48,
    likertUnitCount: 42,
    sjtScenarioCount: 6,
    sjtOptionCount: 24,
    blockKeys: [
      "tdm-31-V1",
      "psychological_safety",
      "situational_judgment",
      "outcome_pulse",
    ],
    validationStatus: "validation_pending",
  });
  assert.equal(teamDynamicsExecutionSpec.units.length, 48);
  assert.deepEqual(
    teamDynamicsExecutionSpec.units.map((unit) => unit.order),
    Array.from({ length: 48 }, (_, index) => index + 1),
  );

  const firstLikertUnit = teamDynamicsExecutionSpec.units[0];
  assert.deepEqual(firstLikertUnit, {
    unitType: "likert_item",
    itemId: "TDM31_01",
    order: 1,
    blockKey: "tdm-31-V1",
    blockDisplayName: "Razvojna zrelost tima",
    itemText: "Članovi tima govore ono što zaista misle reći.",
    responseScaleKey: "likert_1_4_agreement",
    options: teamDynamicsExecutionSpec.optionCatalogs.likert_1_4_agreement,
    scoringMetadata: {
      reverseScored: false,
      domainGroup: "Communication",
      domainScored: true,
      construct: "TDM_COMMUNICATION",
    },
  });

  const reversedLikertUnit = teamDynamicsExecutionSpec.units.find(
    (unit) => unit.unitType === "likert_item" && unit.itemId === "TDM31_03",
  );
  assert.deepEqual(reversedLikertUnit.scoringMetadata, {
    reverseScored: true,
    domainGroup: "Communication",
    domainScored: true,
    construct: "TDM_COMMUNICATION",
  });

  const psychUnit = teamDynamicsExecutionSpec.units.find(
    (unit) => unit.unitType === "likert_item" && unit.itemId === "TPSDP_1",
  );
  assert.deepEqual(psychUnit.scoringMetadata, {
    reverseScored: false,
    construct: "PSYCHOLOGICAL_SAFETY",
  });

  const outcomeUnit = teamDynamicsExecutionSpec.units.find(
    (unit) => unit.unitType === "likert_item" && unit.itemId === "OUTCOME_1",
  );
  assert.deepEqual(outcomeUnit.scoringMetadata, {
    reverseScored: false,
    construct: "OUTCOME_PULSE",
  });

  const firstSjtUnit = teamDynamicsExecutionSpec.units.find(
    (unit) => unit.unitType === "sjt_best_worst_scenario" && unit.scenarioId === "SJT_TD_01",
  );
  assert.deepEqual(firstSjtUnit, {
    unitType: "sjt_best_worst_scenario",
    scenarioId: "SJT_TD_01",
    order: 39,
    blockKey: "situational_judgment",
    blockDisplayName: "Timsko prosudjivanje u situacijama",
    scenarioTitle: "Konflikt koji prelazi u personalizaciju",
    scenarioText:
      "Na timskom sastanku razgovarate o kašnjenju važnog zadatka. Rasprava počinje kao razgovor o poslu, ali se brzo pretvara u lične komentare. Jedan član tima kaže drugom: “Ti uvijek zakomplikuješ stvari i nikad ne završiš ono što obećaš.” Druga osoba se brani povišenim tonom, a ostatak tima uglavnom šuti. Rok je blizu i jasno je da problem treba riješiti, ali atmosfera postaje sve napetija.",
    instruction:
      "Odaberi najefikasniju i najmanje efikasnu reakciju u ovoj situaciji. Ne biras sta bi ti licno najvjerovatnije uradio/la, nego sta bi u ovoj situaciji najvise pomoglo timu da konstruktivno rijesi problem.",
    responseFormat: "best_worst",
    options: [
      {
        optionId: "SJT_TD_01_A",
        label: "A",
        text: "Predlozim da se razgovor vrati na konkretan zadatak: sta tacno kasni, sta je blokada i koji je prvi sljedeci korak. Naglasim da licne ocjene ne pomazu rjesavanju problema.",
        optionLevel: "Acceptable",
      },
      {
        optionId: "SJT_TD_01_B",
        label: "B",
        text: "Sacekam da se rasprava sama smiri, jer bi moje ukljucivanje moglo dodatno pojacati tenziju. Nakon sastanka bih mozda pojedinacno pitao/la sta se desilo.",
        optionLevel: "Weak",
      },
      {
        optionId: "SJT_TD_01_C",
        label: "C",
        text: "Kazem da je ocigledno ko je odgovoran za kasnjenje i da tim vise ne moze stalno tolerisati isti obrazac ponasanja.",
        optionLevel: "Harmful",
      },
      {
        optionId: "SJT_TD_01_D",
        label: "D",
        text: "Predlozim kratku pauzu da se smiri ton, pa da razgovor vratimo na cinjenice: sta kasni, kakav je uticaj na rok i koji je sljedeci dogovor.",
        optionLevel: "Best",
      },
    ],
    scoringMetadata: {
      scoringModel: "expert_key_partial_credit_v1",
      primaryDimension: "constructive_conflict",
      bestChoicePoints: {
        SJT_TD_01_A: 1,
        SJT_TD_01_B: 0,
        SJT_TD_01_C: -1,
        SJT_TD_01_D: 2,
      },
      worstChoicePoints: {
        SJT_TD_01_A: 0,
        SJT_TD_01_B: 1,
        SJT_TD_01_C: 2,
        SJT_TD_01_D: -1,
      },
    },
  });

  const secondaryDimensionSjtUnit = teamDynamicsExecutionSpec.units.find(
    (unit) => unit.unitType === "sjt_best_worst_scenario" && unit.scenarioId === "SJT_TD_02",
  );
  assert.equal(secondaryDimensionSjtUnit.scoringMetadata.secondaryDimension, "coordination");

  console.log("Team Dynamics assessment v1 mixed-format package tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
