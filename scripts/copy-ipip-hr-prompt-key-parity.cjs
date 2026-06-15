#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const SOURCE_PROMPT_KEY = "completed_assessment_report";
const TARGET_PROMPT_KEY = "ipip_neo_120_hr_v2";
const TARGET_TEST_SLUG = "ipip-neo-120-v1";
const TARGET_VERSION = "v1_ipip_hr_focused_20260606";
const CONFIRM_ENV = "CONFIRM_IPIP_HR_PROMPT_KEY_PARITY_COPY";

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

function installTypeScriptRequireHook() {
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
}

function stableJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function assertPromptRowMatchesSourceCriteria(sourcePrompt) {
  if (!sourcePrompt) {
    throw new Error("Source IPIP HR prompt row was not found.");
  }

  assertEqual(sourcePrompt.prompt_key, SOURCE_PROMPT_KEY, "source.prompt_key");
  assertEqual(sourcePrompt.report_type, "individual", "source.report_type");
  assertEqual(sourcePrompt.audience, "hr", "source.audience");
  assertEqual(sourcePrompt.source_type, "single_test", "source.source_type");
  assertEqual(sourcePrompt.generator_type, "openai", "source.generator_type");
  assertEqual(sourcePrompt.version, TARGET_VERSION, "source.version");
  assertEqual(sourcePrompt.is_active, true, "source.is_active");

  if (!sourcePrompt.test_id) {
    throw new Error("Source IPIP HR prompt row must be test-specific.");
  }
}

function buildTargetPromptInsert(sourcePrompt) {
  return {
    test_id: sourcePrompt.test_id,
    report_type: sourcePrompt.report_type,
    audience: sourcePrompt.audience,
    source_type: sourcePrompt.source_type,
    generator_type: sourcePrompt.generator_type,
    prompt_key: TARGET_PROMPT_KEY,
    version: sourcePrompt.version,
    system_prompt: sourcePrompt.system_prompt,
    user_prompt_template: sourcePrompt.user_prompt_template,
    output_schema_json: sourcePrompt.output_schema_json ?? null,
    is_active: true,
    notes: sourcePrompt.notes ?? null,
    updated_by: sourcePrompt.updated_by ?? null,
  };
}

function comparePromptParity(sourcePrompt, targetPrompt) {
  const expected = buildTargetPromptInsert(sourcePrompt);
  const mismatches = [];

  for (const field of [
    "test_id",
    "report_type",
    "audience",
    "source_type",
    "generator_type",
    "prompt_key",
    "version",
    "system_prompt",
    "user_prompt_template",
    "is_active",
    "notes",
    "updated_by",
  ]) {
    if ((targetPrompt[field] ?? null) !== (expected[field] ?? null)) {
      mismatches.push(field);
    }
  }

  if (stableJson(targetPrompt.output_schema_json ?? null) !== stableJson(expected.output_schema_json ?? null)) {
    mismatches.push("output_schema_json");
  }

  return mismatches;
}

function normalizeLocalizations(rows) {
  return [...rows]
    .map((row) => ({
      locale: row.locale,
      system_prompt: row.system_prompt,
      user_prompt_template: row.user_prompt_template,
    }))
    .sort((left, right) => left.locale.localeCompare(right.locale));
}

function compareLocalizationParity(sourceLocalizations, targetLocalizations) {
  const source = normalizeLocalizations(sourceLocalizations);
  const target = normalizeLocalizations(targetLocalizations);

  return stableJson(source) === stableJson(target);
}

function buildPromptParityPlan({
  sourcePrompt,
  targetPrompts,
  sourceLocalizations = [],
  targetLocalizations = [],
}) {
  assertPromptRowMatchesSourceCriteria(sourcePrompt);

  const activeTargets = targetPrompts.filter((prompt) => prompt.is_active === true);
  const sameVersionTargets = targetPrompts.filter((prompt) => prompt.version === sourcePrompt.version);

  if (activeTargets.length > 1) {
    throw new Error(`Multiple active target ${TARGET_PROMPT_KEY} rows found for the IPIP HR scope.`);
  }

  if (sameVersionTargets.length > 1) {
    throw new Error(`Multiple target ${TARGET_PROMPT_KEY}/${sourcePrompt.version} rows found for the IPIP HR scope.`);
  }

  const targetPrompt = sameVersionTargets[0] ?? activeTargets[0] ?? null;

  if (targetPrompt) {
    const mismatches = comparePromptParity(sourcePrompt, targetPrompt);

    if (mismatches.length > 0) {
      throw new Error(
        `Target ${TARGET_PROMPT_KEY} row already exists but is not identical to the source row. Mismatched fields: ${mismatches.join(", ")}.`,
      );
    }

    if (!compareLocalizationParity(sourceLocalizations, targetLocalizations)) {
      throw new Error(
        `Target ${TARGET_PROMPT_KEY} localizations already exist but do not match source localizations.`,
      );
    }

    return {
      action: "noop",
      reason: "Target prompt row already exists with matching content and localization parity.",
      targetPromptId: targetPrompt.id,
      insertPrompt: null,
      insertLocalizations: [],
    };
  }

  return {
    action: "insert",
    reason: `Create test-specific active ${TARGET_PROMPT_KEY} prompt row copied from ${SOURCE_PROMPT_KEY}.`,
    targetPromptId: null,
    insertPrompt: buildTargetPromptInsert(sourcePrompt),
    insertLocalizations: normalizeLocalizations(sourceLocalizations),
  };
}

function requireSingleRow(rows, label) {
  if (rows.length !== 1) {
    throw new Error(`Expected exactly one ${label}, found ${rows.length}.`);
  }

  return rows[0];
}

async function loadPromptRows(supabase, testId, promptKey) {
  const { data, error } = await supabase
    .from("prompt_versions")
    .select(
      "id, test_id, report_type, audience, source_type, generator_type, prompt_key, version, system_prompt, user_prompt_template, output_schema_json, is_active, notes, created_at, updated_at, updated_by",
    )
    .eq("test_id", testId)
    .eq("report_type", "individual")
    .eq("audience", "hr")
    .eq("source_type", "single_test")
    .eq("generator_type", "openai")
    .eq("prompt_key", promptKey);

  if (error) {
    throw new Error(`Failed to load ${promptKey} prompt rows: ${error.message}`);
  }

  return data ?? [];
}

async function loadLocalizations(supabase, promptVersionId) {
  const { data, error } = await supabase
    .from("prompt_version_localizations")
    .select("locale, system_prompt, user_prompt_template")
    .eq("prompt_version_id", promptVersionId);

  if (error) {
    throw new Error(`Failed to load prompt localizations: ${error.message}`);
  }

  return data ?? [];
}

async function main() {
  installTypeScriptRequireHook();
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const supabase = createSupabaseAdminClient();
  const confirmed = process.env[CONFIRM_ENV] === "true";

  const { data: test, error: testError } = await supabase
    .from("tests")
    .select("id, slug")
    .eq("slug", TARGET_TEST_SLUG)
    .maybeSingle();

  if (testError) {
    throw new Error(`Failed to load ${TARGET_TEST_SLUG}: ${testError.message}`);
  }

  if (!test?.id) {
    throw new Error(`Test ${TARGET_TEST_SLUG} was not found.`);
  }

  const sourcePrompts = await loadPromptRows(supabase, test.id, SOURCE_PROMPT_KEY);
  const sourcePrompt = requireSingleRow(
    sourcePrompts.filter((prompt) => prompt.is_active === true && prompt.version === TARGET_VERSION),
    `${SOURCE_PROMPT_KEY}/${TARGET_VERSION} active source prompt row`,
  );
  const targetPrompts = await loadPromptRows(supabase, test.id, TARGET_PROMPT_KEY);
  const sourceLocalizations = await loadLocalizations(supabase, sourcePrompt.id);
  const targetPromptForLocalization = targetPrompts.find((prompt) => prompt.version === sourcePrompt.version) ?? null;
  const targetLocalizations = targetPromptForLocalization
    ? await loadLocalizations(supabase, targetPromptForLocalization.id)
    : [];
  const plan = buildPromptParityPlan({
    sourcePrompt,
    targetPrompts,
    sourceLocalizations,
    targetLocalizations,
  });

  console.info("IPIP HR prompt key parity plan", {
    confirmed,
    action: plan.action,
    reason: plan.reason,
    sourcePromptId: sourcePrompt.id,
    targetPromptId: plan.targetPromptId,
    sourcePromptKey: SOURCE_PROMPT_KEY,
    targetPromptKey: TARGET_PROMPT_KEY,
    version: sourcePrompt.version,
    localizationCount: sourceLocalizations.length,
  });

  if (plan.action !== "insert") {
    return;
  }

  if (!confirmed) {
    console.info(`Dry run only. Set ${CONFIRM_ENV}=true to insert the target prompt row.`);
    return;
  }

  const { data: insertedPrompt, error: insertError } = await supabase
    .from("prompt_versions")
    .insert(plan.insertPrompt)
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to insert ${TARGET_PROMPT_KEY} prompt row: ${insertError.message}`);
  }

  if (plan.insertLocalizations.length > 0) {
    const localizationRows = plan.insertLocalizations.map((localization) => ({
      prompt_version_id: insertedPrompt.id,
      locale: localization.locale,
      system_prompt: localization.system_prompt,
      user_prompt_template: localization.user_prompt_template,
    }));
    const { error: localizationInsertError } = await supabase
      .from("prompt_version_localizations")
      .insert(localizationRows);

    if (localizationInsertError) {
      throw new Error(`Failed to copy ${TARGET_PROMPT_KEY} localizations: ${localizationInsertError.message}`);
    }
  }

  console.info("IPIP HR prompt key parity copy completed", {
    insertedPromptId: insertedPrompt.id,
    copiedLocalizationCount: plan.insertLocalizations.length,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  SOURCE_PROMPT_KEY,
  TARGET_PROMPT_KEY,
  TARGET_TEST_SLUG,
  TARGET_VERSION,
  buildPromptParityPlan,
  buildTargetPromptInsert,
  compareLocalizationParity,
  comparePromptParity,
  stableJson,
};
