import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const REQUIRED_FILES = [
  "test.json",
  "dimensions.json",
  "items.json",
  "options.json",
  "prompts.json",
  "locales/bs/questions.json",
  "locales/hr/questions.json",
  "locales/bs/options.json",
  "locales/hr/options.json",
  "locales/bs/prompts.json",
  "locales/hr/prompts.json",
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

function assertKeys(value, label, keys) {
  for (const key of keys) {
    if (!(key in value)) {
      fail(`${label} is missing required key: ${key}`);
    }
  }
}

function detectPackageMode({ dimensions, items, options, locales, prompts }) {
  const hasNoContentCatalog =
    dimensions.length === 0 &&
    items.length === 0 &&
    options.length === 0 &&
    locales.bs.questions.length === 0 &&
    locales.hr.questions.length === 0 &&
    locales.bs.options.length === 0 &&
    locales.hr.options.length === 0;

  if (hasNoContentCatalog && prompts.length > 0) {
    return "prompt_runtime_bootstrap";
  }

  return "full_assessment_or_partial_content";
}

export async function loadAssessmentPackage(packageDirArg) {
  const packageDir = path.resolve(packageDirArg);

  for (const fileName of REQUIRED_FILES) {
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
  const locales = {
    bs: {
      questions: await readJson(path.join(packageDir, "locales/bs/questions.json")),
      options: await readJson(path.join(packageDir, "locales/bs/options.json")),
      prompts: await readJson(path.join(packageDir, "locales/bs/prompts.json")),
    },
    hr: {
      questions: await readJson(path.join(packageDir, "locales/hr/questions.json")),
      options: await readJson(path.join(packageDir, "locales/hr/options.json")),
      prompts: await readJson(path.join(packageDir, "locales/hr/prompts.json")),
    },
  };

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
  assertArray(locales.bs.questions, "locales/bs/questions.json");
  assertArray(locales.hr.questions, "locales/hr/questions.json");
  assertArray(locales.bs.options, "locales/bs/options.json");
  assertArray(locales.hr.options, "locales/hr/options.json");
  assertArray(locales.bs.prompts, "locales/bs/prompts.json");
  assertArray(locales.hr.prompts, "locales/hr/prompts.json");

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

  for (const locale of ["bs", "hr"]) {
    const localizedQuestions = locales[locale].questions;
    const localizedOptions = locales[locale].options;
    const localizedPrompts = locales[locale].prompts;

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

  return {
    packageDir,
    test,
    dimensions,
    items,
    options,
    prompts,
    locales,
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

  const { packageDir, test, dimensions, items, options, prompts, locales, packageMode } =
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
        locales: {
          bs: {
            questions: locales.bs.questions.length,
            options: locales.bs.options.length,
            prompts: locales.bs.prompts.length,
          },
          hr: {
            questions: locales.hr.questions.length,
            options: locales.hr.options.length,
            prompts: locales.hr.prompts.length,
          },
        },
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
