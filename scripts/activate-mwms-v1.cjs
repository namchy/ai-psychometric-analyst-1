const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const importModule = await import(
    pathToFileURL(path.join(projectRoot, "scripts/import-assessment-package.mjs")).href
  );

  await importModule.loadLocalEnvFile();

  const supabase = importModule.createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("tests")
    .update({
      status: "active",
      is_active: true,
    })
    .eq("slug", "mwms_v1")
    .select("id, slug, status, is_active")
    .single();

  if (error) {
    throw new Error(`Failed to activate mwms_v1: ${error.message}`);
  }

  console.log(JSON.stringify({ ok: true, test: data }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
