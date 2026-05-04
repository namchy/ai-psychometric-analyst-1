const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const TEST_SLUG = "mwms_v1";
const PACKAGE_DIR = path.resolve(__dirname, "../assessment-packages/mwms_v1");
const LOCALES = ["bs", "hr"];

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertPrompt(prompt) {
  const required = {
    report_type: "individual",
    audience: "participant",
    source_type: "single_test",
    generator_type: "openai",
    version: "v1",
    is_active: true,
  };

  for (const [key, expectedValue] of Object.entries(required)) {
    if (prompt[key] !== expectedValue) {
      fail(`MWMS prompt ${key} must be ${expectedValue}.`);
    }
  }

  if (!prompt.prompt_key || typeof prompt.prompt_key !== "string") {
    fail("MWMS prompt_key must be a non-empty string.");
  }

  if (!prompt.system_prompt || typeof prompt.system_prompt !== "string") {
    fail("MWMS system_prompt must be a non-empty string.");
  }

  if (!prompt.user_prompt_template || typeof prompt.user_prompt_template !== "string") {
    fail("MWMS user_prompt_template must be a non-empty string.");
  }

  if (!prompt.output_schema_json || typeof prompt.output_schema_json !== "object") {
    fail("MWMS output_schema_json must contain the participant report schema.");
  }

  if (prompt.output_schema_json?.properties?.schema_version?.type !== "string") {
    fail('MWMS output_schema_json.properties.schema_version.type must be "string".');
  }

  if (prompt.output_schema_json?.properties?.schema_version?.const !== "mwms_participant_report_v1") {
    fail("MWMS output_schema_json must be the mwms_participant_report_v1 schema.");
  }
}

async function maybeSinglePrompt(supabase, testId, prompt) {
  const { data, error } = await supabase
    .from("prompt_versions")
    .select("id, version")
    .eq("test_id", testId)
    .eq("report_type", prompt.report_type)
    .eq("audience", prompt.audience)
    .eq("source_type", prompt.source_type)
    .eq("generator_type", prompt.generator_type)
    .eq("prompt_key", prompt.prompt_key)
    .eq("version", prompt.version);

  if (error) {
    fail(`Failed to look up existing MWMS prompt: ${error.message}`);
  }

  if (data.length > 1) {
    fail(`Multiple MWMS prompt_versions rows already exist for ${prompt.prompt_key}/${prompt.version}.`);
  }

  return data[0] ?? null;
}

async function upsertPromptLocalization(supabase, promptVersionId, locale, localizedPrompt) {
  const payload = {
    prompt_version_id: promptVersionId,
    locale,
    system_prompt: localizedPrompt.system_prompt,
    user_prompt_template: localizedPrompt.user_prompt_template,
  };

  const { data: existingRows, error: lookupError } = await supabase
    .from("prompt_version_localizations")
    .select("id")
    .eq("prompt_version_id", promptVersionId)
    .eq("locale", locale);

  if (lookupError) {
    const message = lookupError.message ?? "";
    if (message.includes("prompt_version_localizations")) {
      return { skipped: true, locale };
    }

    fail(`Failed to look up MWMS ${locale} prompt localization: ${lookupError.message}`);
  }

  if (existingRows.length > 1) {
    fail(`Multiple MWMS prompt localizations already exist for ${locale}.`);
  }

  if (existingRows.length === 0) {
    const { error } = await supabase.from("prompt_version_localizations").insert(payload);

    if (error) {
      fail(`Failed to insert MWMS ${locale} prompt localization: ${error.message}`);
    }

    return { inserted: true, locale };
  }

  const { error } = await supabase
    .from("prompt_version_localizations")
    .update({
      system_prompt: payload.system_prompt,
      user_prompt_template: payload.user_prompt_template,
    })
    .eq("id", existingRows[0].id);

  if (error) {
    fail(`Failed to update MWMS ${locale} prompt localization: ${error.message}`);
  }

  return { updated: true, locale };
}

async function main() {
  const importModule = await import(
    pathToFileURL(path.resolve(__dirname, "import-assessment-package.mjs")).href
  );
  await importModule.loadLocalEnvFile();

  const supabase = importModule.createAdminSupabaseClient();
  const prompts = readJson(path.join(PACKAGE_DIR, "prompts.json"));
  const prompt = prompts.find((candidate) => candidate.prompt_key === "mwms_participant_report_v1");

  if (!prompt) {
    fail("MWMS participant prompt is missing from assessment-packages/mwms_v1/prompts.json.");
  }

  assertPrompt(prompt);

  const { data: test, error: testError } = await supabase
    .from("tests")
    .select("id, slug")
    .eq("slug", TEST_SLUG)
    .single();

  if (testError || !test) {
    fail(`Failed to find tests.slug = ${TEST_SLUG}: ${testError?.message ?? "not found"}`);
  }

  const existingPrompt = await maybeSinglePrompt(supabase, test.id, prompt);

  if (prompt.is_active) {
    const { error } = await supabase
      .from("prompt_versions")
      .update({ is_active: false })
      .eq("test_id", test.id)
      .eq("report_type", prompt.report_type)
      .eq("audience", prompt.audience)
      .eq("source_type", prompt.source_type)
      .eq("generator_type", prompt.generator_type)
      .eq("prompt_key", prompt.prompt_key)
      .eq("is_active", true)
      .neq("version", prompt.version);

    if (error) {
      fail(`Failed to deactivate older MWMS prompt versions: ${error.message}`);
    }
  }

  const promptPayload = {
    test_id: test.id,
    report_type: prompt.report_type,
    audience: prompt.audience,
    source_type: prompt.source_type,
    generator_type: prompt.generator_type,
    prompt_key: prompt.prompt_key,
    version: prompt.version,
    system_prompt: prompt.system_prompt,
    user_prompt_template: prompt.user_prompt_template,
    output_schema_json: prompt.output_schema_json,
    is_active: prompt.is_active,
    notes: prompt.notes ?? null,
  };

  let promptVersionId;
  let promptAction;

  if (existingPrompt) {
    const { data, error } = await supabase
      .from("prompt_versions")
      .update(promptPayload)
      .eq("id", existingPrompt.id)
      .select("id")
      .single();

    if (error) {
      fail(`Failed to update MWMS prompt_versions row: ${error.message}`);
    }

    promptVersionId = data.id;
    promptAction = "updated";
  } else {
    const { data, error } = await supabase
      .from("prompt_versions")
      .insert(promptPayload)
      .select("id")
      .single();

    if (error) {
      fail(`Failed to insert MWMS prompt_versions row: ${error.message}`);
    }

    promptVersionId = data.id;
    promptAction = "inserted";
  }

  const localizationResults = [];

  for (const locale of LOCALES) {
    const localizedPromptPath = path.join(PACKAGE_DIR, "locales", locale, "prompts.json");

    if (!fs.existsSync(localizedPromptPath)) {
      continue;
    }

    const localizedPrompt = readJson(localizedPromptPath).find(
      (candidate) =>
        candidate.prompt_key === prompt.prompt_key &&
        candidate.audience === prompt.audience &&
        candidate.report_type === prompt.report_type &&
        candidate.source_type === prompt.source_type &&
        candidate.generator_type === prompt.generator_type &&
        candidate.version === prompt.version,
    );

    if (!localizedPrompt) {
      fail(`MWMS ${locale} localized prompt file does not contain ${prompt.prompt_key}/${prompt.version}.`);
    }

    localizationResults.push(
      await upsertPromptLocalization(supabase, promptVersionId, locale, localizedPrompt),
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        test_slug: TEST_SLUG,
        prompt: {
          id: promptVersionId,
          action: promptAction,
          prompt_key: prompt.prompt_key,
          version: prompt.version,
          is_active: prompt.is_active,
        },
        localizations: localizationResults,
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
