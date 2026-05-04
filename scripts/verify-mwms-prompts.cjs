const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const TEST_SLUG = "mwms_v1";
const PROMPT_KEY = "mwms_participant_report_v1";
const PACKAGE_DIR = path.resolve(__dirname, "../assessment-packages/mwms_v1");
const REQUIRED_LOCALES = ["bs", "hr"];

function fail(message) {
  throw new Error(message);
}

function assertMwmsOutputSchema(schema) {
  if (!schema || typeof schema !== "object") {
    fail("MWMS output_schema_json is null.");
  }

  if (schema.type !== "object") {
    fail('MWMS output_schema_json.type must be "object".');
  }

  if (!Array.isArray(schema.required) || schema.required.length === 0) {
    fail("MWMS output_schema_json.required must contain required fields.");
  }

  const properties = schema.properties;

  if (!properties || typeof properties !== "object") {
    fail("MWMS output_schema_json.properties is missing.");
  }

  if (properties.schema_version?.type !== "string") {
    fail('MWMS output_schema_json.properties.schema_version.type must be "string".');
  }

  if (properties.schema_version?.const !== PROMPT_KEY) {
    fail("MWMS output_schema_json does not contain the mwms_participant_report_v1 schema.");
  }

  for (const key of [
    "summary",
    "motivation_pattern",
    "key_observations",
    "possible_tensions",
    "reflection_questions",
    "development_suggestions",
    "interpretation_note",
  ]) {
    if (!properties[key]) {
      fail(`MWMS output_schema_json.properties.${key} is missing.`);
    }
  }
}

async function main() {
  const importModule = await import(
    pathToFileURL(path.resolve(__dirname, "import-assessment-package.mjs")).href
  );
  await importModule.loadLocalEnvFile();

  const supabase = importModule.createAdminSupabaseClient();

  const { data: test, error: testError } = await supabase
    .from("tests")
    .select("id, slug")
    .eq("slug", TEST_SLUG)
    .single();

  if (testError || !test) {
    fail(`Missing tests.slug = ${TEST_SLUG}: ${testError?.message ?? "not found"}`);
  }

  const { data: prompts, error: promptError } = await supabase
    .from("prompt_versions")
    .select(
      "id, report_type, audience, source_type, generator_type, prompt_key, version, system_prompt, user_prompt_template, output_schema_json, is_active",
    )
    .eq("test_id", test.id)
    .eq("report_type", "individual")
    .eq("audience", "participant")
    .eq("source_type", "single_test")
    .eq("generator_type", "openai")
    .eq("prompt_key", PROMPT_KEY)
    .eq("version", "v1")
    .eq("is_active", true);

  if (promptError) {
    fail(`Failed to query MWMS prompt_versions: ${promptError.message}`);
  }

  if (prompts.length !== 1) {
    fail(`Expected exactly one active MWMS participant prompt, found ${prompts.length}.`);
  }

  const prompt = prompts[0];

  if (!prompt.prompt_key) {
    fail("MWMS prompt_key is empty.");
  }

  if (!prompt.system_prompt || prompt.system_prompt.length === 0) {
    fail("MWMS system_prompt is empty.");
  }

  if (!prompt.user_prompt_template || prompt.user_prompt_template.length === 0) {
    fail("MWMS user_prompt_template is empty.");
  }

  assertMwmsOutputSchema(prompt.output_schema_json);

  const expectedLocales = REQUIRED_LOCALES.filter((locale) =>
    fs.existsSync(path.join(PACKAGE_DIR, "locales", locale, "prompts.json")),
  );

  let localizationSummary = [];

  if (expectedLocales.length > 0) {
    const { data: localizations, error: localizationError } = await supabase
      .from("prompt_version_localizations")
      .select("locale, system_prompt, user_prompt_template")
      .eq("prompt_version_id", prompt.id);

    if (localizationError) {
      const message = localizationError.message ?? "";
      if (message.includes("prompt_version_localizations")) {
        localizationSummary = expectedLocales.map((locale) => ({ locale, skipped: "table_missing" }));
      } else {
        fail(`Failed to query MWMS prompt localizations: ${localizationError.message}`);
      }
    } else {
      for (const locale of expectedLocales) {
        const rows = localizations.filter((candidate) => candidate.locale === locale);

        if (rows.length !== 1) {
          fail(`Expected exactly one MWMS ${locale} prompt localization, found ${rows.length}.`);
        }

        if (!rows[0].system_prompt || !rows[0].user_prompt_template) {
          fail(`MWMS ${locale} prompt localization is empty.`);
        }
      }

      localizationSummary = localizations.map((localization) => ({ locale: localization.locale }));
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        test_slug: TEST_SLUG,
        prompt: {
          id: prompt.id,
          audience: prompt.audience,
          source_type: prompt.source_type,
          report_type: prompt.report_type,
          generator_type: prompt.generator_type,
          prompt_key: prompt.prompt_key,
          version: prompt.version,
          system_prompt_length: prompt.system_prompt.length,
          user_prompt_template_length: prompt.user_prompt_template.length,
          has_output_schema_json: true,
        },
        localizations: localizationSummary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
