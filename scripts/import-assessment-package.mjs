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
  return {
    test: packageData.test,
    dimensions: packageData.dimensions,
    items: packageData.items,
    options: packageData.options,
    prompts: packageData.prompts,
    locales: packageData.locales,
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
  });

  console.info("Calling import_assessment_package RPC.", {
    packageDir: packageData.packageDir,
    slug: packageData.test.slug,
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
