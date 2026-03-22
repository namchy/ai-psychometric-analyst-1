import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function fail(message) {
  throw new Error(message);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    fail("Missing required Supabase env vars.");
  }

  const supabase = createClient(url, serviceRoleKey);
  const selector = {
    report_type: "individual",
    audience: "participant",
    source_type: "single_test",
    generator_type: "openai",
    prompt_key: "completed_assessment_report",
  };

  const duplicateGlobalInsert = await supabase.from("prompt_versions").insert({
    test_id: null,
    ...selector,
    version: "v1-duplicate-global",
    system_prompt: "duplicate global",
    user_prompt_template: "{}",
    output_schema_json: null,
    is_active: true,
    notes: "duplicate global",
  });

  const { data: testRow, error: testInsertError } = await supabase
    .from("tests")
    .insert({
      slug: "tmp-prompt-selection-check",
      name: "Temporary Prompt Selection Check",
      category: "personality",
      scoring_method: "likert_sum",
      status: "draft",
      is_active: false,
      description: "Temporary test row for prompt selection verification.",
    })
    .select("id")
    .single();

  if (testInsertError || !testRow) {
    fail(`Failed to insert temporary test row: ${testInsertError?.message ?? "Unknown error"}`);
  }

  const { data: specificPrompt, error: specificInsertError } = await supabase
    .from("prompt_versions")
    .insert({
      test_id: testRow.id,
      ...selector,
      version: "v1-test-specific",
      system_prompt: "specific",
      user_prompt_template: "{}",
      output_schema_json: null,
      is_active: true,
      notes: "specific",
    })
    .select("id")
    .single();

  if (specificInsertError || !specificPrompt) {
    fail(
      `Failed to insert test-specific active prompt row: ${specificInsertError?.message ?? "Unknown error"}`,
    );
  }

  const duplicateSpecificInsert = await supabase.from("prompt_versions").insert({
    test_id: testRow.id,
    ...selector,
    version: "v1-test-specific-duplicate",
    system_prompt: "specific duplicate",
    user_prompt_template: "{}",
    output_schema_json: null,
    is_active: true,
    notes: "specific duplicate",
  });

  const { data: resolvedPrompt, error: rpcError } = await supabase.rpc("get_active_prompt_version", {
    p_test_id: testRow.id,
    p_report_type: selector.report_type,
    p_audience: selector.audience,
    p_source_type: selector.source_type,
    p_generator_type: selector.generator_type,
    p_prompt_key: selector.prompt_key,
  });

  if (rpcError) {
    fail(`Prompt version RPC check failed: ${rpcError.message}`);
  }

  const selectedRow = Array.isArray(resolvedPrompt) ? resolvedPrompt[0] : resolvedPrompt;

  console.log(
    JSON.stringify(
      {
        duplicateGlobalBlocked: Boolean(duplicateGlobalInsert.error),
        duplicateSpecificBlocked: Boolean(duplicateSpecificInsert.error),
        resolvedPromptId: selectedRow?.id ?? null,
        resolvedPromptTestId: selectedRow?.test_id ?? null,
        expectedSpecificPromptId: specificPrompt.id,
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
