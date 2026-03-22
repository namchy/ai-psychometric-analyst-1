import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  buildImportPayload,
  createAdminSupabaseClient,
  importAssessmentPackageViaRpc,
  loadLocalEnvFile,
} from "./import-assessment-package.mjs";
import { loadAssessmentPackage } from "./validate-assessment-package.mjs";

function fail(message) {
  throw new Error(message);
}

async function main() {
  await loadLocalEnvFile();

  const packageDirArg = process.argv[2] ?? "assessment-packages/ipip50-hr-v1";
  const packageData = await loadAssessmentPackage(packageDirArg);
  const failingSlug = `${packageData.test.slug}-rollback-proof`;
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "assessment-package-atomicity-"));
  const tempPackageDir = path.join(tempRoot, failingSlug);
  const supabase = createAdminSupabaseClient();

  await fs.cp(packageData.packageDir, tempPackageDir, { recursive: true });

  const tempTestPath = path.join(tempPackageDir, "test.json");
  const tempItemsPath = path.join(tempPackageDir, "items.json");

  const tempTest = JSON.parse(await fs.readFile(tempTestPath, "utf8"));
  tempTest.slug = failingSlug;
  tempTest.name = `${tempTest.name} Rollback Proof`;
  tempTest.status = "draft";
  tempTest.is_active = false;
  await fs.writeFile(tempTestPath, `${JSON.stringify(tempTest, null, 2)}\n`);

  const tempItems = JSON.parse(await fs.readFile(tempItemsPath, "utf8"));
  tempItems[tempItems.length - 1].mappings[0].dimension_code = "MISSING_DIMENSION_FOR_ROLLBACK_PROOF";
  await fs.writeFile(tempItemsPath, `${JSON.stringify(tempItems, null, 2)}\n`);

  const failingPackageData = await loadAssessmentPackage(tempPackageDir);
  const payload = buildImportPayload(failingPackageData);

  let observedFailureMessage = null;

  try {
    await importAssessmentPackageViaRpc(supabase, payload);
    fail("Expected RPC import to fail for invalid dimension mapping, but it succeeded.");
  } catch (error) {
    observedFailureMessage = error instanceof Error ? error.message : String(error);
  }

  const { data: testRow, error: testError } = await supabase
    .from("tests")
    .select("id")
    .eq("slug", failingSlug)
    .maybeSingle();

  if (testError) {
    fail(`Failed to verify rollback test row absence: ${testError.message}`);
  }

  let persistedQuestionCount = 0;
  let persistedPromptCount = 0;
  let persistedOptionCount = 0;

  if (testRow?.id) {
    const { count: loadedQuestionCount, error: loadedQuestionsError } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("test_id", testRow.id);

    if (loadedQuestionsError) {
      fail(`Failed to verify rollback questions absence: ${loadedQuestionsError.message}`);
    }

    persistedQuestionCount = loadedQuestionCount ?? 0;

    const { count: loadedPromptCount, error: loadedPromptError } = await supabase
      .from("prompt_versions")
      .select("id", { count: "exact", head: true })
      .eq("test_id", testRow.id);

    if (loadedPromptError) {
      fail(`Failed to verify rollback prompts absence: ${loadedPromptError.message}`);
    }

    persistedPromptCount = loadedPromptCount ?? 0;

    const { data: questionIds, error: questionIdsError } = await supabase
      .from("questions")
      .select("id")
      .eq("test_id", testRow.id);

    if (questionIdsError) {
      fail(`Failed to verify rollback option absence: ${questionIdsError.message}`);
    }

    const ids = (questionIds ?? []).map((question) => question.id);

    if (ids.length > 0) {
      const { count: loadedOptionCount, error: loadedOptionError } = await supabase
        .from("answer_options")
        .select("id", { count: "exact", head: true })
        .in("question_id", ids);

      if (loadedOptionError) {
        fail(`Failed to verify rollback answer option absence: ${loadedOptionError.message}`);
      }

      persistedOptionCount = loadedOptionCount ?? 0;
    }
  }

  if (testRow || persistedQuestionCount !== 0 || persistedPromptCount !== 0 || persistedOptionCount !== 0) {
    fail(
      `Rollback proof failed. testExists=${Boolean(testRow)} questions=${persistedQuestionCount} prompts=${persistedPromptCount} options=${persistedOptionCount}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        failingSlug,
        failureMessage: observedFailureMessage,
        rollbackVerified: true,
        persisted: {
          test: false,
          questions: 0,
          prompts: 0,
          options: 0,
        },
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
