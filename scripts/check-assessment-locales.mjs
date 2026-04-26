import {
  buildImportPayload,
  createAdminSupabaseClient,
} from "./import-assessment-package.mjs";
import { loadAssessmentPackage } from "./validate-assessment-package.mjs";

const TEST_SLUG = "ipip50-hr-v1";
const LOCALE = "hr";
const QUESTION_CODE = "E01";
const OPTION_ORDER = 1;
const PROMPT_KEY = "completed_assessment_report";

function fail(message) {
  throw new Error(message);
}

async function main() {
  const supabase = createAdminSupabaseClient();
  const packageData = await loadAssessmentPackage(`assessment-packages/${TEST_SLUG}`);

  const { data: test } = await supabase
    .from("tests")
    .select("id")
    .eq("slug", TEST_SLUG)
    .single();

  if (!test) {
    fail(`Missing test ${TEST_SLUG}.`);
  }

  const { data: question } = await supabase
    .from("questions")
    .select("id, text")
    .eq("test_id", test.id)
    .eq("code", QUESTION_CODE)
    .single();

  const { data: questionLocalization } = await supabase
    .from("question_localizations")
    .select("id, text")
    .eq("question_id", question.id)
    .eq("locale", LOCALE)
    .single();

  if (!questionLocalization) {
    fail("Question localization check failed.");
  }

  await supabase.from("question_localizations").delete().eq("id", questionLocalization.id);

  const { data: questionLocalizationAfterDelete } = await supabase
    .from("question_localizations")
    .select("text")
    .eq("question_id", question.id)
    .eq("locale", LOCALE)
    .maybeSingle();

  if ((questionLocalizationAfterDelete?.text ?? question.text) !== question.text) {
    fail("Question fallback check failed.");
  }

  const { data: option } = await supabase
    .from("answer_options")
    .select("id, label")
    .eq("question_id", question.id)
    .eq("option_order", OPTION_ORDER)
    .single();

  const { data: optionLocalization } = await supabase
    .from("answer_option_localizations")
    .select("id, label")
    .eq("answer_option_id", option.id)
    .eq("locale", LOCALE)
    .single();

  if (!optionLocalization) {
    fail("Answer option localization check failed.");
  }

  await supabase.from("answer_option_localizations").delete().eq("id", optionLocalization.id);

  const { data: optionLocalizationAfterDelete } = await supabase
    .from("answer_option_localizations")
    .select("label")
    .eq("answer_option_id", option.id)
    .eq("locale", LOCALE)
    .maybeSingle();

  if ((optionLocalizationAfterDelete?.label ?? option.label) !== option.label) {
    fail("Answer option fallback check failed.");
  }

  const { data: prompt } = await supabase
    .from("prompt_versions")
    .select("id, system_prompt, user_prompt_template")
    .eq("test_id", test.id)
    .eq("prompt_key", PROMPT_KEY)
    .eq("audience", "participant")
    .eq("version", "v1")
    .single();

  const { data: promptLocalization } = await supabase
    .from("prompt_version_localizations")
    .select("id, system_prompt, user_prompt_template")
    .eq("prompt_version_id", prompt.id)
    .eq("locale", LOCALE)
    .single();

  if (!promptLocalization) {
    fail("Prompt localization check failed.");
  }

  await supabase
    .from("prompt_version_localizations")
    .delete()
    .eq("id", promptLocalization.id);

  const { data: promptLocalizationAfterDelete } = await supabase
    .from("prompt_version_localizations")
    .select("system_prompt, user_prompt_template")
    .eq("prompt_version_id", prompt.id)
    .eq("locale", LOCALE)
    .maybeSingle();

  if (
    (promptLocalizationAfterDelete?.system_prompt ?? prompt.system_prompt) !== prompt.system_prompt ||
    (promptLocalizationAfterDelete?.user_prompt_template ?? prompt.user_prompt_template) !==
      prompt.user_prompt_template
  ) {
    fail("Prompt fallback check failed.");
  }

  const { data: attempt } = await supabase
    .from("attempts")
    .insert({ test_id: test.id })
    .select("id, locale")
    .single();

  if (!attempt || attempt.locale !== "bs") {
    fail("Attempt default locale check failed.");
  }

  const { error: attemptUpdateError } = await supabase
    .from("attempts")
    .update({ locale: LOCALE })
    .eq("id", attempt.id);

  if (attemptUpdateError) {
    fail(`Attempt locale update failed: ${attemptUpdateError.message}`);
  }

  await supabase.from("attempts").delete().eq("id", attempt.id);

  const payload = buildImportPayload(packageData);
  const { error: importError } = await supabase.rpc("import_assessment_package", {
    p_package: payload,
  });

  if (importError) {
    fail(`Failed to restore localized rows after fallback check: ${importError.message}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        questionFallback: true,
        answerOptionFallback: true,
        promptFallback: true,
        attemptLocale: true,
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
