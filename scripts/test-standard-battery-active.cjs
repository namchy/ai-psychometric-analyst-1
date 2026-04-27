const path = require("node:path");
const { pathToFileURL } = require("node:url");

const STANDARD_BATTERY_SLUGS = ["ipip-neo-120-v1", "safran_v1", "mwms_v1"];

function formatState(test) {
  if (!test) {
    return "missing";
  }

  return `status=${JSON.stringify(test.status)}, is_active=${JSON.stringify(test.is_active)}`;
}

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const importModule = await import(
    pathToFileURL(path.join(projectRoot, "scripts/import-assessment-package.mjs")).href
  );

  await importModule.loadLocalEnvFile();

  const supabase = importModule.createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("tests")
    .select("slug, status, is_active")
    .in("slug", STANDARD_BATTERY_SLUGS);

  if (error) {
    throw new Error(`Failed to load standard battery tests: ${error.message}`);
  }

  const testsBySlug = new Map((data ?? []).map((test) => [test.slug, test]));
  const failures = [];

  for (const slug of STANDARD_BATTERY_SLUGS) {
    const test = testsBySlug.get(slug);

    if (!test) {
      failures.push(`Standard battery test ${slug} is missing from public.tests.`);
      continue;
    }

    if (test.status !== "active" || test.is_active !== true) {
      failures.push(
        `Standard battery test ${slug} must be status='active' and is_active=true, received ${formatState(test)}.`,
      );
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }

    process.exit(1);
  }

  console.log("Standard battery active-state tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
