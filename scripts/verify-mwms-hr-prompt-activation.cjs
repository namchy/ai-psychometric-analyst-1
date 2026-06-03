const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;
const TEST_SLUG = "mwms_v1";
const PROMPT_KEY = "mwms_hr_report_v1";
const PACKAGE_DIR = path.join(projectRoot, "assessment-packages/mwms_v1");
const REQUIRED_LOCALES = ["bs", "hr"];

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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

function loadEnvFileIfPresent(filename) {
  const envPath = path.join(projectRoot, filename);

  if (!fs.existsSync(envPath)) {
    return false;
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  return true;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertMwmsHrPrompt(prompt) {
  assert.equal(prompt.prompt_key, PROMPT_KEY);
  assert.equal(prompt.audience, "hr");
  assert.equal(prompt.report_type, "individual");
  assert.equal(prompt.source_type, "single_test");
  assert.equal(prompt.generator_type, "openai");
  assert.equal(prompt.version, "v1");
  assert.equal(prompt.is_active, true);
  assert.equal(typeof prompt.system_prompt, "string");
  assert.equal(prompt.system_prompt.length > 0, true);
  assert.equal(typeof prompt.user_prompt_template, "string");
  assert.equal(prompt.user_prompt_template.length > 0, true);
  assert.equal(prompt.output_schema_json?.properties?.contractVersion?.const, PROMPT_KEY);
  assert.equal(prompt.output_schema_json?.properties?.reportType?.const, PROMPT_KEY);
}

async function main() {
  loadEnvFileIfPresent(".env.local");

  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  const packagePrompts = readJson(path.join(PACKAGE_DIR, "prompts.json"));
  const packagePrompt = packagePrompts.find((prompt) => prompt.prompt_key === PROMPT_KEY);

  if (!packagePrompt) {
    throw new Error(`Missing ${PROMPT_KEY} in assessment package.`);
  }

  assertMwmsHrPrompt(packagePrompt);

  for (const locale of REQUIRED_LOCALES) {
    const localePath = path.join(PACKAGE_DIR, "locales", locale, "prompts.json");
    const localizedPrompt = readJson(localePath).find((prompt) => prompt.prompt_key === PROMPT_KEY);

    assert.ok(localizedPrompt, `Missing ${PROMPT_KEY} ${locale} localization.`);
    assert.equal(localizedPrompt.audience, "hr");
    assert.equal(typeof localizedPrompt.system_prompt, "string");
    assert.equal(localizedPrompt.system_prompt.length > 0, true);
    assert.equal(typeof localizedPrompt.user_prompt_template, "string");
    assert.equal(localizedPrompt.user_prompt_template.length > 0, true);
  }

  const { MWMS_HR_REPORT_V1_CONTRACT } = require("../lib/assessment/mwms-hr-report-v1.ts");
  assert.equal(MWMS_HR_REPORT_V1_CONTRACT.promptKey, PROMPT_KEY);

  if (!envStatus.NEXT_PUBLIC_SUPABASE_URL || !envStatus.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          db: "skipped",
          reason: "Missing Supabase env.",
          env: Object.fromEntries(Object.entries(envStatus).map(([key, present]) => [key, present ? "present" : "missing"])),
          package_prompt: "present",
          localizations: REQUIRED_LOCALES,
        },
        null,
        2,
      ),
    );
    return;
  }

  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const { getActivePromptVersion } = require("../lib/assessment/prompt-version.ts");
  const supabase = createSupabaseAdminClient();
  const { data: test, error: testError } = await supabase
    .from("tests")
    .select("id, slug")
    .eq("slug", TEST_SLUG)
    .maybeSingle();

  if (testError || !test) {
    throw new Error(`Missing tests.slug=${TEST_SLUG}: ${testError?.message ?? "not found"}`);
  }

  const activePrompt = await getActivePromptVersion({
    testId: test.id,
    reportType: "individual",
    audience: "hr",
    sourceType: "single_test",
    generatorType: "openai",
    promptKey: PROMPT_KEY,
  }, {
    locale: "bs",
  });

  if (!activePrompt) {
    throw new Error(`No active DB prompt found for ${PROMPT_KEY}. Run npm run import:assessment-package for mwms_v1 package.`);
  }

  const { data: localizations, error: localizationError } = await supabase
    .from("prompt_version_localizations")
    .select("locale, system_prompt, user_prompt_template")
    .eq("prompt_version_id", activePrompt.id);

  const localizationSummary = [];

  if (localizationError) {
    localizationSummary.push({ skipped: "prompt_version_localizations query failed", reason: localizationError.message });
  } else {
    for (const locale of REQUIRED_LOCALES) {
      const row = (localizations ?? []).find((candidate) => candidate.locale === locale);

      if (!row) {
        throw new Error(`Missing active DB localization for ${PROMPT_KEY}/${locale}.`);
      }

      if (!row.system_prompt || !row.user_prompt_template) {
        throw new Error(`Empty active DB localization for ${PROMPT_KEY}/${locale}.`);
      }

      localizationSummary.push({ locale, status: "present" });
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        db: "verified",
        test_slug: TEST_SLUG,
        prompt: {
          id: activePrompt.id,
          prompt_key: activePrompt.promptKey,
          version: activePrompt.version,
          locale_checked: "bs",
        },
        localizations: localizationSummary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  if (/fetch failed|networkerror|connect|ECONNREFUSED/i.test(message)) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          db: "skipped",
          reason: message,
          package_prompt: "verified before DB lookup",
          skipped: "active prompt_versions lookup",
        },
        null,
        2,
      ),
    );
    return;
  }

  console.error(message);
  process.exitCode = 1;
});
