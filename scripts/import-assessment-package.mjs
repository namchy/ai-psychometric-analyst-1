import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { loadAssessmentPackage } from "./validate-assessment-package.mjs";

function fail(message) {
  throw new Error(message);
}

export async function loadLocalEnvFile(filePath = ".env.local") {
  const resolvedPath = path.resolve(filePath);

  try {
    const raw = await fs.readFile(resolvedPath, "utf8");

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function buildImportPayload(packageData) {
  const payload = {
    test: packageData.test,
    dimensions: packageData.dimensions,
    items: packageData.items,
    options: packageData.options,
    prompts: packageData.prompts,
    locales: packageData.locales,
  };

  if (packageData.contentSpec) {
    payload.content_spec = packageData.contentSpec;
  }

  if (packageData.mixedFormatImportPlan) {
    payload.import_strategy = packageData.mixedFormatImportPlan;
  }

  return payload;
}

function coerceRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function compareByOrder(left, right) {
  return (left.question_order ?? left.option_order ?? 0) - (right.question_order ?? right.option_order ?? 0);
}

export function buildImportedMixedFormatRuntimeShape(input) {
  const testMetadata = coerceRecord(input.testRow?.metadata);
  const contentSpec = coerceRecord(testMetadata.content_spec);
  const questionRows = [...(input.questionRows ?? [])].sort(compareByOrder);
  const optionRows = [...(input.optionRows ?? [])].sort(compareByOrder);
  const optionsByQuestionId = new Map();

  for (const option of optionRows) {
    const rows = optionsByQuestionId.get(option.question_id) ?? [];
    rows.push(option);
    optionsByQuestionId.set(option.question_id, rows);
  }

  const blockOrder = Array.isArray(testMetadata.blocks)
    ? testMetadata.blocks
    : Array.isArray(contentSpec.assessment?.blocks)
      ? contentSpec.assessment.blocks
      : [];
  const groupedQuestions = new Map();

  for (const question of questionRows) {
    const metadata = coerceRecord(question.metadata);
    const blockKey = typeof metadata.block_key === "string" ? metadata.block_key : "unassigned";
    const rows = groupedQuestions.get(blockKey) ?? [];
    rows.push(question);
    groupedQuestions.set(blockKey, rows);
  }

  const orderedBlockKeys = [
    ...blockOrder,
    ...[...groupedQuestions.keys()].filter((blockKey) => !blockOrder.includes(blockKey)),
  ];
  const units = [];
  const optionCatalogs = {};

  for (const blockKey of orderedBlockKeys) {
    const blockSpec = coerceRecord(contentSpec.blocks?.[blockKey]);
    const questions = [...(groupedQuestions.get(blockKey) ?? [])].sort(compareByOrder);

    for (const question of questions) {
      const metadata = coerceRecord(question.metadata);
      const options = [...(optionsByQuestionId.get(question.id) ?? [])].sort(compareByOrder);

      if (metadata.response_format === "best_worst") {
        units.push({
          unitType: "sjt_best_worst_scenario",
          questionCode: question.code,
          order: question.question_order,
          blockKey,
          blockDisplayName: blockSpec.display_name ?? null,
          responseFormat: "best_worst",
          scenarioTitle: metadata.scenario_title ?? null,
          scenarioMetadata: metadata,
          options: options.map((option) => ({
            code: option.code,
            label: option.label,
            optionOrder: option.option_order,
            metadata: coerceRecord(option.metadata),
          })),
        });
        continue;
      }

      const responseScaleKey =
        typeof metadata.response_scale === "string" ? metadata.response_scale : null;

      if (responseScaleKey && !optionCatalogs[responseScaleKey]) {
        optionCatalogs[responseScaleKey] = options.map((option) => ({
          code: option.code,
          label: option.label,
          value: option.value,
          optionOrder: option.option_order,
          metadata: coerceRecord(option.metadata),
        }));
      }

      units.push({
        unitType: "likert_item",
        questionCode: question.code,
        order: question.question_order,
        blockKey,
        blockDisplayName: blockSpec.display_name ?? null,
        responseScaleKey,
        itemMetadata: metadata,
        options: options.map((option) => ({
          code: option.code,
          label: option.label,
          value: option.value,
          optionOrder: option.option_order,
          metadata: coerceRecord(option.metadata),
        })),
      });
    }
  }

  return {
    testSlug: input.testRow?.slug ?? null,
    importMode: testMetadata.import_mode ?? null,
    blockOrder: orderedBlockKeys,
    units,
    optionCatalogs,
    metadata: {
      contentSpecAssessmentKey:
        typeof contentSpec.assessment?.assessment_key === "string"
          ? contentSpec.assessment.assessment_key
          : null,
      contentSpecValidationStatus:
        typeof contentSpec.assessment?.validation_status === "string"
          ? contentSpec.assessment.validation_status
          : null,
    },
  };
}

export async function importAssessmentPackageViaRpc(supabase, payload) {
  const { data, error } = await supabase.rpc("import_assessment_package", {
    p_package: payload,
  });

  if (error) {
    fail(`import_assessment_package RPC failed: ${error.message}`);
  }

  if (!data?.ok) {
    fail("import_assessment_package RPC returned an unexpected response.");
  }

  return data;
}

async function main() {
  await loadLocalEnvFile();

  const packageDirArg = process.argv[2];

  if (!packageDirArg) {
    fail("Usage: node scripts/import-assessment-package.mjs <package-directory>");
  }

  const packageData = await loadAssessmentPackage(packageDirArg);
  const payload = buildImportPayload(packageData);
  const supabase = createAdminSupabaseClient();

  console.info("Assessment package validated.", {
    packageDir: packageData.packageDir,
    slug: packageData.test.slug,
    packageMode: packageData.packageMode,
  });

  if (packageData.packageMode === "prompt_runtime_bootstrap") {
    console.warn(
      `Importing ${packageData.test.slug} as a prompt/runtime bootstrap package. Assessment content catalogs are intentionally empty in this phase.`,
    );
  }

  console.info("Calling import_assessment_package RPC.", {
    packageDir: packageData.packageDir,
    slug: packageData.test.slug,
    packageMode: packageData.packageMode,
  });

  const result = await importAssessmentPackageViaRpc(supabase, payload);

  console.info("Assessment package imported successfully.");
  console.info(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
