import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const REQUIRED_ROOT_FILES = [
  "test.json",
  "dimensions.json",
  "items.json",
  "options.json",
  "prompts.json",
];

function fail(message) {
  throw new Error(message);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be a JSON object.`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be a JSON array.`);
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
}

function assertNumber(value, label) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    fail(`${label} must be a number.`);
  }
}

function assertKeys(value, label, keys) {
  for (const key of keys) {
    if (!(key in value)) {
      fail(`${label} is missing required key: ${key}`);
    }
  }
}

async function loadLocaleCatalogs(packageDir) {
  const localesDir = path.join(packageDir, "locales");
  let localeEntries;

  try {
    localeEntries = await fs.readdir(localesDir, { withFileTypes: true });
  } catch {
    fail(`Missing required package directory: ${localesDir}`);
  }

  const localeNames = localeEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (localeNames.length === 0) {
    fail(`Package must include at least one locale directory in ${localesDir}.`);
  }

  const locales = {};

  for (const locale of localeNames) {
    const localeDir = path.join(localesDir, locale);
    const requiredLocaleFiles = ["questions.json", "options.json", "prompts.json"];

    for (const fileName of requiredLocaleFiles) {
      const fullPath = path.join(localeDir, fileName);

      try {
        await fs.access(fullPath);
      } catch {
        fail(`Missing required locale file: ${fullPath}`);
      }
    }

    locales[locale] = {
      questions: await readJson(path.join(localeDir, "questions.json")),
      options: await readJson(path.join(localeDir, "options.json")),
      prompts: await readJson(path.join(localeDir, "prompts.json")),
    };
  }

  return locales;
}

function detectPackageMode({ dimensions, items, options, locales, prompts }) {
  const hasNoContentCatalog =
    dimensions.length === 0 &&
    items.length === 0 &&
    options.length === 0 &&
    Object.values(locales).every(
      (localeCatalog) =>
        localeCatalog.questions.length === 0 && localeCatalog.options.length === 0,
    );

  if (hasNoContentCatalog && prompts.length > 0) {
    return "prompt_runtime_bootstrap";
  }

  return "full_assessment_or_partial_content";
}

function mapItemsByCode(items) {
  return new Map(items.map((item) => [item.code, item]));
}

function getBlockItems(items, blockKey) {
  return items.filter((item) => item.metadata?.block_key === blockKey);
}

function validateMixedFormatContentSpec({ test, items, options, locales, contentSpec }) {
  assertObject(contentSpec, "content-spec.json");
  assertObject(contentSpec.assessment, "content-spec.json.assessment");
  assertObject(contentSpec.blocks, "content-spec.json.blocks");

  assertString(contentSpec.assessment.assessment_key, "content-spec.json.assessment.assessment_key");
  assertString(contentSpec.assessment.display_name, "content-spec.json.assessment.display_name");
  assertString(contentSpec.assessment.validation_status, "content-spec.json.assessment.validation_status");
  assertArray(contentSpec.assessment.blocks, "content-spec.json.assessment.blocks");

  if (contentSpec.assessment.assessment_key !== test.slug) {
    fail(
      `content-spec.json.assessment.assessment_key must match test.json slug for ${test.slug}.`,
    );
  }

  if (contentSpec.assessment.display_name !== test.name) {
    fail(`content-spec.json.assessment.display_name must match test.json name for ${test.slug}.`);
  }

  if (test.metadata?.validation_status && contentSpec.assessment.validation_status !== test.metadata.validation_status) {
    fail(
      `content-spec.json.assessment.validation_status must match test.json metadata.validation_status for ${test.slug}.`,
    );
  }

  const declaredBlocks = test.metadata?.blocks ?? [];

  if (
    Array.isArray(declaredBlocks) &&
    JSON.stringify(contentSpec.assessment.blocks) !== JSON.stringify(declaredBlocks)
  ) {
    fail(`content-spec.json.assessment.blocks must match test.json metadata.blocks for ${test.slug}.`);
  }

  if (options.length !== 0) {
    fail(`${test.slug} mixed-format content-spec package must keep root options.json empty.`);
  }

  for (const [locale, localeCatalog] of Object.entries(locales)) {
    if (localeCatalog.options.length !== 0) {
      fail(`${test.slug} mixed-format content-spec package must keep locales/${locale}/options.json empty.`);
    }
  }

  const blockKeys = new Set(contentSpec.assessment.blocks);
  const seenItemCodes = new Set();

  for (const item of items) {
    const blockKey = item.metadata?.block_key;

    if (!blockKeys.has(blockKey)) {
      fail(`items.json item ${item.code} references unknown block_key ${blockKey}.`);
    }

    if (seenItemCodes.has(item.code)) {
      fail(`items.json contains duplicate item code ${item.code}.`);
    }

    seenItemCodes.add(item.code);
  }

  const tdmSpec = contentSpec.blocks["tdm-31-V1"];
  const tdmItems = getBlockItems(items, "tdm-31-V1");
  assertObject(tdmSpec, 'content-spec.json.blocks["tdm-31-V1"]');
  assertNumber(tdmSpec.item_count, 'content-spec.json.blocks["tdm-31-V1"].item_count');
  if (tdmItems.length !== tdmSpec.item_count) {
    fail(`tdm-31-V1 item count mismatch: items.json=${tdmItems.length}, content-spec=${tdmSpec.item_count}.`);
  }

  const psychologicalSafetySpec = contentSpec.blocks.psychological_safety;
  const psychologicalSafetyItems = getBlockItems(items, "psychological_safety");
  assertObject(psychologicalSafetySpec, "content-spec.json.blocks.psychological_safety");
  assertNumber(
    psychologicalSafetySpec.item_count,
    "content-spec.json.blocks.psychological_safety.item_count",
  );
  if (psychologicalSafetyItems.length !== psychologicalSafetySpec.item_count) {
    fail(
      `psychological_safety item count mismatch: items.json=${psychologicalSafetyItems.length}, content-spec=${psychologicalSafetySpec.item_count}.`,
    );
  }

  const outcomePulseSpec = contentSpec.blocks.outcome_pulse;
  const outcomePulseItems = getBlockItems(items, "outcome_pulse");
  assertObject(outcomePulseSpec, "content-spec.json.blocks.outcome_pulse");
  assertNumber(outcomePulseSpec.item_count, "content-spec.json.blocks.outcome_pulse.item_count");
  if (outcomePulseItems.length !== outcomePulseSpec.item_count) {
    fail(
      `outcome_pulse item count mismatch: items.json=${outcomePulseItems.length}, content-spec=${outcomePulseSpec.item_count}.`,
    );
  }

  const sjtSpec = contentSpec.blocks.situational_judgment;
  const sjtItems = getBlockItems(items, "situational_judgment");
  assertObject(sjtSpec, "content-spec.json.blocks.situational_judgment");
  assertNumber(
    sjtSpec.scenario_count,
    "content-spec.json.blocks.situational_judgment.scenario_count",
  );
  assertNumber(
    sjtSpec.options_per_scenario,
    "content-spec.json.blocks.situational_judgment.options_per_scenario",
  );
  assertString(
    sjtSpec.scoring_model,
    "content-spec.json.blocks.situational_judgment.scoring_model",
  );

  if (sjtItems.length !== sjtSpec.scenario_count) {
    fail(
      `situational_judgment scenario count mismatch: items.json=${sjtItems.length}, content-spec=${sjtSpec.scenario_count}.`,
    );
  }

  for (const item of sjtItems) {
    if (item.question_type !== "multiple_choice") {
      fail(`SJT item ${item.code} must use question_type="multiple_choice".`);
    }

    if (item.metadata?.response_format !== "best_worst") {
      fail(`SJT item ${item.code} must declare metadata.response_format="best_worst".`);
    }

    if (item.metadata?.instruction_type !== "knowledge_based_should_do") {
      fail(
        `SJT item ${item.code} must declare metadata.instruction_type="knowledge_based_should_do".`,
      );
    }

    assertArray(item.metadata?.options, `items.json item ${item.code}.metadata.options`);

    if (item.metadata.options.length !== sjtSpec.options_per_scenario) {
      fail(
        `SJT item ${item.code} must contain exactly ${sjtSpec.options_per_scenario} scenario-level options.`,
      );
    }

    const optionLevels = new Set();
    const optionIds = new Set();

    for (const [index, option] of item.metadata.options.entries()) {
      assertObject(option, `items.json item ${item.code}.metadata.options[${index}]`);
      assertString(option.option_id, `items.json item ${item.code}.metadata.options[${index}].option_id`);
      assertString(option.option_text, `items.json item ${item.code}.metadata.options[${index}].option_text`);
      assertNumber(option.option_order, `items.json item ${item.code}.metadata.options[${index}].option_order`);
      assertString(option.option_level, `items.json item ${item.code}.metadata.options[${index}].option_level`);
      optionIds.add(option.option_id);
      optionLevels.add(option.option_level);
    }

    if (optionIds.size !== sjtSpec.options_per_scenario) {
      fail(`SJT item ${item.code} must contain unique scenario option ids.`);
    }

    if (
      JSON.stringify([...optionLevels].sort()) !==
      JSON.stringify(["Acceptable", "Best", "Harmful", "Weak"])
    ) {
      fail(`SJT item ${item.code} must contain exactly one Best/Acceptable/Weak/Harmful option.`);
    }
  }
}

export function normalizeMixedAssessmentSpec({ test, items, contentSpec }) {
  if (!contentSpec) {
    return null;
  }

  const normalizedBlocks = contentSpec.assessment.blocks.map((blockKey) => {
    const blockItems = getBlockItems(items, blockKey);
    const blockSpec = contentSpec.blocks[blockKey];

    if (blockKey === "situational_judgment") {
      return {
        blockKey,
        blockType: "sjt_best_worst",
        displayName: blockSpec.display_name,
        scenarioIds: blockItems.map((item) => item.code),
        optionsPerScenario: blockSpec.options_per_scenario,
        scoringModel: blockSpec.scoring_model,
      };
    }

    const scoringMode =
      blockKey === "tdm-31-V1"
        ? blockSpec.scoring?.phase_1?.method ?? "simple_linear_v1"
        : blockSpec.scoring_mode ?? "simple_linear_v1";

    return {
      blockKey,
      blockType: "likert",
      displayName: blockSpec.display_name,
      responseScaleKey: blockSpec.response_scale,
      itemIds: blockItems.map((item) => item.code),
      scoringMode,
    };
  });

  return {
    assessmentKey: contentSpec.assessment.assessment_key,
    displayName: contentSpec.assessment.display_name,
    validationStatus: contentSpec.assessment.validation_status,
    estimatedDuration: contentSpec.assessment.estimated_duration ?? test.metadata?.estimated_duration,
    audience: contentSpec.assessment.audience ?? test.metadata?.audience,
    blocks: normalizedBlocks,
    sharedScales: contentSpec.response_scales ?? {},
    scoring: {
      assessmentScoringMode: contentSpec.assessment.scoring_mode ?? test.scoring_method,
      teamAggregation: contentSpec.team_aggregation ?? null,
      sharedScoringBands: contentSpec.shared_scoring_bands ?? [],
    },
    guardrails: contentSpec.guardrails ?? [],
  };
}

export async function loadAssessmentPackage(packageDirArg) {
  const packageDir = path.resolve(packageDirArg);

  for (const fileName of REQUIRED_ROOT_FILES) {
    const fullPath = path.join(packageDir, fileName);

    try {
      await fs.access(fullPath);
    } catch {
      fail(`Missing required package file: ${fullPath}`);
    }
  }

  const test = await readJson(path.join(packageDir, "test.json"));
  const dimensions = await readJson(path.join(packageDir, "dimensions.json"));
  const items = await readJson(path.join(packageDir, "items.json"));
  const options = await readJson(path.join(packageDir, "options.json"));
  const prompts = await readJson(path.join(packageDir, "prompts.json"));
  const locales = await loadLocaleCatalogs(packageDir);
  const contentSpecFile = test?.metadata?.content_spec_file;
  const contentSpec = contentSpecFile
    ? await readJson(path.join(packageDir, contentSpecFile))
    : null;

  assertObject(test, "test.json");
  assertKeys(test, "test.json", [
    "slug",
    "name",
    "category",
    "scoring_method",
    "version",
    "status",
    "is_active",
    "intended_use",
    "report_family",
    "description",
  ]);

  assertArray(dimensions, "dimensions.json");
  assertArray(items, "items.json");
  assertArray(options, "options.json");
  assertArray(prompts, "prompts.json");

  for (const [locale, localeCatalog] of Object.entries(locales)) {
    assertArray(localeCatalog.questions, `locales/${locale}/questions.json`);
    assertArray(localeCatalog.options, `locales/${locale}/options.json`);
    assertArray(localeCatalog.prompts, `locales/${locale}/prompts.json`);
  }

  for (const [index, dimension] of dimensions.entries()) {
    assertObject(dimension, `dimensions.json[${index}]`);
    assertKeys(dimension, `dimensions.json[${index}]`, [
      "code",
      "name",
      "description",
      "display_order",
      "is_active",
    ]);
  }

  for (const [index, item] of items.entries()) {
    assertObject(item, `items.json[${index}]`);
    assertKeys(item, `items.json[${index}]`, [
      "code",
      "text",
      "question_type",
      "question_order",
      "is_required",
      "is_active",
      "mappings",
    ]);
    assertArray(item.mappings, `items.json[${index}].mappings`);

    for (const [mappingIndex, mapping] of item.mappings.entries()) {
      assertObject(mapping, `items.json[${index}].mappings[${mappingIndex}]`);
      assertKeys(mapping, `items.json[${index}].mappings[${mappingIndex}]`, [
        "dimension_code",
        "weight",
        "reverse_scored",
      ]);
    }
  }

  for (const [index, option] of options.entries()) {
    assertObject(option, `options.json[${index}]`);
    assertKeys(option, `options.json[${index}]`, [
      "code",
      "label",
      "value",
      "option_order",
    ]);
  }

  for (const [index, prompt] of prompts.entries()) {
    assertObject(prompt, `prompts.json[${index}]`);
    assertKeys(prompt, `prompts.json[${index}]`, [
      "prompt_key",
      "audience",
      "report_type",
      "source_type",
      "generator_type",
      "version",
      "is_active",
      "system_prompt",
      "user_prompt_template",
      "output_schema_json",
      "notes",
    ]);
  }

  for (const [locale, localeCatalog] of Object.entries(locales)) {
    const localizedQuestions = localeCatalog.questions;
    const localizedOptions = localeCatalog.options;
    const localizedPrompts = localeCatalog.prompts;

    for (const [index, item] of localizedQuestions.entries()) {
      assertObject(item, `locales/${locale}/questions.json[${index}]`);
      assertKeys(item, `locales/${locale}/questions.json[${index}]`, ["code", "text"]);
    }

    for (const [index, option] of localizedOptions.entries()) {
      assertObject(option, `locales/${locale}/options.json[${index}]`);
      assertKeys(option, `locales/${locale}/options.json[${index}]`, ["option_order", "label"]);
    }

    for (const [index, prompt] of localizedPrompts.entries()) {
      assertObject(prompt, `locales/${locale}/prompts.json[${index}]`);
      assertKeys(prompt, `locales/${locale}/prompts.json[${index}]`, [
        "prompt_key",
        "audience",
        "report_type",
        "source_type",
        "generator_type",
        "version",
        "system_prompt",
        "user_prompt_template",
      ]);
    }
  }

  if (contentSpec) {
    validateMixedFormatContentSpec({
      test,
      items,
      options,
      locales,
      contentSpec,
    });
  }

  const mixedAssessmentSpec = normalizeMixedAssessmentSpec({
    test,
    items,
    contentSpec,
  });

  return {
    packageDir,
    test,
    dimensions,
    items,
    options,
    prompts,
    locales,
    contentSpec,
    mixedAssessmentSpec,
    packageMode: detectPackageMode({
      dimensions,
      items,
      options,
      prompts,
      locales,
    }),
  };
}

async function main() {
  const packageDirArg = process.argv[2];

  if (!packageDirArg) {
    fail("Usage: node scripts/validate-assessment-package.mjs <package-directory>");
  }

  const {
    packageDir,
    test,
    dimensions,
    items,
    options,
    prompts,
    locales,
    contentSpec,
    mixedAssessmentSpec,
    packageMode,
  } =
    await loadAssessmentPackage(packageDirArg);

  console.log(
    JSON.stringify(
      {
        packageDir,
        slug: test.slug,
        packageMode,
        dimensions: dimensions.length,
        items: items.length,
        options: options.length,
        prompts: prompts.length,
        contentSpec: Boolean(contentSpec),
        mixedAssessmentSpec:
          mixedAssessmentSpec === null
            ? null
            : {
                assessmentKey: mixedAssessmentSpec.assessmentKey,
                blocks: mixedAssessmentSpec.blocks.map((block) => ({
                  blockKey: block.blockKey,
                  blockType: block.blockType,
                })),
              },
        locales: Object.fromEntries(
          Object.entries(locales).map(([locale, localeCatalog]) => [
            locale,
            {
              questions: localeCatalog.questions.length,
              options: localeCatalog.options.length,
              prompts: localeCatalog.prompts.length,
            },
          ]),
        ),
      },
      null,
      2,
    ),
  );

  if (packageMode === "prompt_runtime_bootstrap") {
    console.warn(
      `[validate-assessment-package] ${test.slug} is a prompt/runtime bootstrap package, not a full assessment content package.`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
