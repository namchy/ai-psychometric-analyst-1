import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SafranSeed = {
  assessment_code: string;
  enabled_subtests: string[];
  items: SafranItem[];
};

type SafranRendererType = "text_choice" | "image_choice" | "numeric_input";
type SafranQuestionType = "single_choice" | "text";
type SafranSubtestCode = "VW" | "VA" | "FA" | "FM" | "NZ";
type SafranLocale = "bs" | "en";

type SafranItem = {
  item_id: string;
  subtest_code: SafranSubtestCode;
  domain_code: "V" | "F" | "N";
  renderer_type: SafranRendererType;
  is_scored: true;
  is_active_v1: true;
  display_order: number;
  question: Partial<Record<SafranLocale, string | null>>;
  stimulus_image_path: string | null;
  stimulus_secondary_image_path: string | null;
  options: SafranOption[];
};

type SafranOption = {
  option_id: string;
  display_order: number;
  text: Partial<Record<SafranLocale, string | null>> | null;
  image_path: string | null;
  is_correct: boolean;
};

type Database = {
  public: {
    Tables: {
      tests: {
        Row: {
          id: string;
          slug: string;
          name: string;
          category: "personality" | "behavioral" | "cognitive";
          description: string | null;
          status: "draft" | "active" | "archived";
          scoring_method: "likert_sum" | "correct_answers" | "weighted_correct";
          duration_minutes: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          slug: string;
          name: string;
          category: "cognitive";
          status: "active";
          scoring_method: "correct_answers";
          is_active: true;
        };
        Update: {
          name?: string;
          category?: "cognitive";
          status?: "active";
          scoring_method?: "correct_answers";
          is_active?: true;
        };
        Relationships: [];
      };
      test_dimensions: {
        Row: {
          id: string;
          test_id: string;
          code: string;
          name: string;
          description: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          test_id: string;
          code: string;
          name: string;
          description: string | null;
          display_order: number;
          is_active: true;
        };
        Update: {
          name?: string;
          description?: string | null;
          display_order?: number;
          is_active?: true;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          test_id: string;
          code: string;
          text: string;
          help_text: string | null;
          dimension: string;
          question_type: "single_choice" | "multiple_choice" | "text";
          question_order: number;
          reverse_scored: boolean;
          difficulty: "easy" | "medium" | "hard" | null;
          weight: number;
          is_required: boolean;
          is_active: boolean;
          stimulus_image_path: string | null;
          stimulus_secondary_image_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          test_id: string;
          code: string;
          text: string;
          dimension: string;
          question_type: SafranQuestionType;
          question_order: number;
          is_required: true;
          is_active: true;
          stimulus_image_path: string | null;
          stimulus_secondary_image_path: string | null;
        };
        Update: {
          text?: string;
          dimension?: string;
          question_type?: SafranQuestionType;
          question_order?: number;
          is_required?: true;
          is_active?: true;
          stimulus_image_path?: string | null;
          stimulus_secondary_image_path?: string | null;
        };
        Relationships: [];
      };
      question_localizations: {
        Row: {
          id: string;
          question_id: string;
          locale: SafranLocale;
          text: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          question_id: string;
          locale: SafranLocale;
          text: string;
        };
        Update: {
          text?: string;
        };
        Relationships: [];
      };
      answer_options: {
        Row: {
          id: string;
          question_id: string;
          code: string | null;
          label: string;
          value: number | null;
          option_order: number;
          is_correct: boolean | null;
          image_path: string | null;
          created_at: string;
        };
        Insert: {
          question_id: string;
          code: string;
          label: string;
          value: null;
          option_order: number;
          is_correct: boolean;
          image_path: string | null;
        };
        Update: {
          code?: string;
          label?: string;
          value?: null;
          option_order?: number;
          is_correct?: boolean;
          image_path?: string | null;
        };
        Relationships: [];
      };
      answer_option_localizations: {
        Row: {
          id: string;
          answer_option_id: string;
          locale: SafranLocale;
          label: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          answer_option_id: string;
          locale: SafranLocale;
          label: string;
        };
        Update: {
          label?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type SafranDimensionSeed = {
  code: string;
  name: string;
  description: string | null;
  display_order: number;
};

type TestDimensionInsert = Database["public"]["Tables"]["test_dimensions"]["Insert"];
type QuestionInsert = Database["public"]["Tables"]["questions"]["Insert"];
type QuestionLocalizationInsert = Database["public"]["Tables"]["question_localizations"]["Insert"];
type QuestionLookup = Pick<Database["public"]["Tables"]["questions"]["Row"], "id" | "code">;
type AnswerOptionInsert = Database["public"]["Tables"]["answer_options"]["Insert"];
type AnswerOptionLocalizationInsert = Database["public"]["Tables"]["answer_option_localizations"]["Insert"];
type AnswerOptionLookup = Pick<
  Database["public"]["Tables"]["answer_options"]["Row"],
  "id" | "question_id" | "option_order"
>;

const SAFRAN_TEST = {
  slug: "safran_v1",
  name: "SAFRAN V1",
  category: "cognitive",
  status: "active",
  scoring_method: "correct_answers",
  is_active: true,
} as const;

const SAFRAN_DIMENSIONS: SafranDimensionSeed[] = [
  { code: "V", name: "V", description: null, display_order: 1 },
  { code: "F", name: "F", description: null, display_order: 2 },
  { code: "N", name: "N", description: null, display_order: 3 },
  { code: "verbal_score", name: "verbal_score", description: null, display_order: 4 },
  { code: "figural_score", name: "figural_score", description: null, display_order: 5 },
  { code: "numerical_series_score", name: "numerical_series_score", description: null, display_order: 6 },
  { code: "cognitive_composite_v1", name: "cognitive_composite_v1", description: null, display_order: 7 },
];

const SAFRAN_SCORABLE_SUBTESTS = new Set<SafranSubtestCode>(["VW", "VA", "FA", "FM", "NZ"]);
const SAFRAN_LOCALES: SafranLocale[] = ["bs", "en"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}

function readRequiredString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];

  if (typeof value !== "string" || value.length === 0) {
    fail(`${context} must contain ${key}.`);
  }

  return value;
}

function readNullableString(record: Record<string, unknown>, key: string, context: string): string | null {
  const value = record[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    fail(`${context}.${key} must be a string or null.`);
  }

  return value;
}

function readQuestionTextMap(value: unknown, context: string): Partial<Record<SafranLocale, string | null>> {
  if (!isRecord(value)) {
    fail(`${context}.question must be an object.`);
  }

  const question: Partial<Record<SafranLocale, string | null>> = {};

  for (const locale of SAFRAN_LOCALES) {
    const text = value[locale];

    if (text !== null && text !== undefined && typeof text !== "string") {
      fail(`${context}.question.${locale} must be a string or null.`);
    }

    question[locale] = text ?? null;
  }

  return question;
}

function readOptionTextMap(value: unknown, context: string): Partial<Record<SafranLocale, string | null>> | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    fail(`${context}.text must be an object or null.`);
  }

  const text: Partial<Record<SafranLocale, string | null>> = {};

  for (const locale of SAFRAN_LOCALES) {
    const localizedText = value[locale];

    if (localizedText !== null && localizedText !== undefined && typeof localizedText !== "string") {
      fail(`${context}.text.${locale} must be a string or null.`);
    }

    text[locale] = localizedText ?? null;
  }

  return text;
}

function toSafranSubtestCode(value: unknown, context: string): SafranSubtestCode {
  if (
    value !== "VW" &&
    value !== "VA" &&
    value !== "FA" &&
    value !== "FM" &&
    value !== "NZ"
  ) {
    fail(`${context}.subtest_code must be one of VW, VA, FA, FM, NZ.`);
  }

  return value;
}

function toSafranDomainCode(value: unknown, context: string): "V" | "F" | "N" {
  if (value !== "V" && value !== "F" && value !== "N") {
    fail(`${context}.domain_code must be one of V, F, N.`);
  }

  return value;
}

function toSafranRendererType(value: unknown, context: string): SafranRendererType {
  if (value !== "text_choice" && value !== "image_choice" && value !== "numeric_input") {
    fail(`${context}.renderer_type must be text_choice, image_choice, or numeric_input.`);
  }

  return value;
}

function toSafranItem(value: unknown, index: number): SafranItem {
  const context = `SAFRAN seed item at index ${index}`;

  if (!isRecord(value)) {
    fail(`${context} must be an object.`);
  }

  const isScored = value.is_scored;
  const isActiveV1 = value.is_active_v1;
  const displayOrder = value.display_order;

  if (isScored !== true) {
    fail(`${context}.is_scored must be true for SAFRAN V1 import.`);
  }

  if (isActiveV1 !== true) {
    fail(`${context}.is_active_v1 must be true for SAFRAN V1 import.`);
  }

  if (typeof displayOrder !== "number" || !Number.isInteger(displayOrder) || displayOrder <= 0) {
    fail(`${context}.display_order must be a positive integer.`);
  }

  return {
    item_id: readRequiredString(value, "item_id", context),
    subtest_code: toSafranSubtestCode(value.subtest_code, context),
    domain_code: toSafranDomainCode(value.domain_code, context),
    renderer_type: toSafranRendererType(value.renderer_type, context),
    is_scored: true,
    is_active_v1: true,
    display_order: displayOrder,
    question: readQuestionTextMap(value.question, context),
    stimulus_image_path: readNullableString(value, "stimulus_image_path", context),
    stimulus_secondary_image_path: readNullableString(value, "stimulus_secondary_image_path", context),
    options: readSafranOptions(value.options, context),
  };
}

function toSafranOption(value: unknown, index: number, itemContext: string): SafranOption {
  const context = `${itemContext}.options[${index}]`;

  if (!isRecord(value)) {
    fail(`${context} must be an object.`);
  }

  const displayOrder = value.display_order;
  const isCorrect = value.is_correct;

  if (typeof displayOrder !== "number" || !Number.isInteger(displayOrder) || displayOrder <= 0) {
    fail(`${context}.display_order must be a positive integer.`);
  }

  if (typeof isCorrect !== "boolean") {
    fail(`${context}.is_correct must be a boolean.`);
  }

  return {
    option_id: readRequiredString(value, "option_id", context),
    display_order: displayOrder,
    text: readOptionTextMap(value.text, context),
    image_path: readNullableString(value, "image_path", context),
    is_correct: isCorrect,
  };
}

function readSafranOptions(value: unknown, itemContext: string): SafranOption[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    fail(`${itemContext}.options must be an array when present.`);
  }

  return value.map((option, index) => toSafranOption(option, index, itemContext));
}

function toQuestionType(rendererType: SafranRendererType): SafranQuestionType {
  if (rendererType === "numeric_input") {
    return "text";
  }

  return "single_choice";
}

function getQuestionText(item: SafranItem, locale: SafranLocale): string {
  const text = item.question[locale]?.trim();

  if (text) {
    return text;
  }

  return item.item_id;
}

function getOptionText(option: SafranOption, locale: SafranLocale): string | null {
  const text = option.text?.[locale]?.trim();
  return text || null;
}

function getOptionLabel(option: SafranOption): string {
  return getOptionText(option, "bs") ?? option.option_id;
}

async function loadLocalEnvFile(filePath = ".env.local"): Promise<void> {
  try {
    const raw = await fs.readFile(path.resolve(filePath), "utf8");

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

function createAdminSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function loadSafranSeed(seedPath: string): Promise<SafranSeed> {
  const raw = await fs.readFile(seedPath, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!isRecord(parsed)) {
    fail("SAFRAN seed must be a JSON object.");
  }

  if (typeof parsed.assessment_code !== "string" || parsed.assessment_code.length === 0) {
    fail("SAFRAN seed must contain assessment_code.");
  }

  if (
    !Array.isArray(parsed.enabled_subtests) ||
    !parsed.enabled_subtests.every((subtest) => typeof subtest === "string")
  ) {
    fail("SAFRAN seed must contain enabled_subtests as a string array.");
  }

  if (!Array.isArray(parsed.items)) {
    fail("SAFRAN seed must contain items array.");
  }

  const items = parsed.items.map(toSafranItem).filter((item) => SAFRAN_SCORABLE_SUBTESTS.has(item.subtest_code));

  return {
    assessment_code: parsed.assessment_code,
    enabled_subtests: parsed.enabled_subtests,
    items,
  };
}

async function upsertSafranTest(supabase: SupabaseClient<Database>): Promise<string> {
  const { data, error } = await supabase
    .from("tests")
    .upsert(SAFRAN_TEST, { onConflict: "slug" })
    .select("id")
    .single();

  if (error) {
    fail(`Failed to upsert SAFRAN V1 test: ${error.message}`);
  }

  if (!data?.id) {
    fail("Failed to upsert SAFRAN V1 test: missing test id.");
  }

  return data.id;
}

async function upsertSafranDimensions(supabase: SupabaseClient<Database>, testId: string): Promise<number> {
  const rows: TestDimensionInsert[] = SAFRAN_DIMENSIONS.map((dimension) => ({
    test_id: testId,
    code: dimension.code,
    name: dimension.name,
    description: dimension.description,
    display_order: dimension.display_order,
    is_active: true,
  }));

  const { error } = await supabase.from("test_dimensions").upsert(rows, {
    onConflict: "test_id,code",
  });

  if (error) {
    fail(`Failed to upsert SAFRAN V1 dimensions: ${error.message}`);
  }

  return rows.length;
}

async function upsertSafranQuestions(
  supabase: SupabaseClient<Database>,
  testId: string,
  items: SafranItem[],
): Promise<QuestionLookup[]> {
  const rows: QuestionInsert[] = items.map((item) => ({
    test_id: testId,
    code: item.item_id,
    text: getQuestionText(item, "bs"),
    dimension: item.domain_code,
    question_type: toQuestionType(item.renderer_type),
    question_order: item.display_order,
    is_required: true,
    is_active: true,
    stimulus_image_path: item.stimulus_image_path,
    stimulus_secondary_image_path: item.stimulus_secondary_image_path,
  }));

  const { data, error } = await supabase
    .from("questions")
    .upsert(rows, { onConflict: "test_id,code" })
    .select("id, code");

  if (error) {
    fail(`Failed to upsert SAFRAN V1 questions: ${error.message}`);
  }

  if (!data || data.length !== rows.length) {
    fail("Failed to upsert SAFRAN V1 questions: unexpected question count returned.");
  }

  return data;
}

async function upsertSafranQuestionLocalizations(
  supabase: SupabaseClient<Database>,
  items: SafranItem[],
  questions: QuestionLookup[],
): Promise<number> {
  const questionIdByCode = new Map(questions.map((question) => [question.code, question.id]));
  const rows: QuestionLocalizationInsert[] = [];

  for (const item of items) {
    const questionId = questionIdByCode.get(item.item_id);

    if (!questionId) {
      fail(`Missing upserted question id for SAFRAN item ${item.item_id}.`);
    }

    for (const locale of SAFRAN_LOCALES) {
      rows.push({
        question_id: questionId,
        locale,
        text: getQuestionText(item, locale),
      });
    }
  }

  const { error } = await supabase.from("question_localizations").upsert(rows, {
    onConflict: "question_id,locale",
  });

  if (error) {
    fail(`Failed to upsert SAFRAN V1 question localizations: ${error.message}`);
  }

  return rows.length;
}

async function upsertSafranAnswerOptions(
  supabase: SupabaseClient<Database>,
  items: SafranItem[],
  questions: QuestionLookup[],
): Promise<AnswerOptionLookup[]> {
  const questionIdByCode = new Map(questions.map((question) => [question.code, question.id]));
  const rows: AnswerOptionInsert[] = [];

  for (const item of items) {
    if (item.subtest_code === "NZ" || item.options.length === 0) {
      continue;
    }

    const questionId = questionIdByCode.get(item.item_id);

    if (!questionId) {
      fail(`Missing upserted question id for SAFRAN item ${item.item_id}.`);
    }

    for (const option of item.options) {
      rows.push({
        question_id: questionId,
        code: option.option_id,
        label: getOptionLabel(option),
        value: null,
        option_order: option.display_order,
        is_correct: option.is_correct,
        image_path: option.image_path,
      });
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("answer_options")
    .upsert(rows, { onConflict: "question_id,option_order" })
    .select("id, question_id, option_order");

  if (error) {
    fail(`Failed to upsert SAFRAN V1 answer options: ${error.message}`);
  }

  if (!data || data.length !== rows.length) {
    fail("Failed to upsert SAFRAN V1 answer options: unexpected answer option count returned.");
  }

  return data;
}

async function upsertSafranAnswerOptionLocalizations(
  supabase: SupabaseClient<Database>,
  items: SafranItem[],
  questions: QuestionLookup[],
  answerOptions: AnswerOptionLookup[],
): Promise<number> {
  const questionIdByCode = new Map(questions.map((question) => [question.code, question.id]));
  const optionIdByQuestionAndOrder = new Map(
    answerOptions.map((option) => [`${option.question_id}:${option.option_order}`, option.id]),
  );
  const rows: AnswerOptionLocalizationInsert[] = [];

  for (const item of items) {
    if (item.subtest_code === "NZ" || item.options.length === 0) {
      continue;
    }

    const questionId = questionIdByCode.get(item.item_id);

    if (!questionId) {
      fail(`Missing upserted question id for SAFRAN item ${item.item_id}.`);
    }

    for (const option of item.options) {
      const answerOptionId = optionIdByQuestionAndOrder.get(`${questionId}:${option.display_order}`);

      if (!answerOptionId) {
        fail(`Missing upserted answer option id for SAFRAN option ${option.option_id}.`);
      }

      for (const locale of SAFRAN_LOCALES) {
        const label = getOptionText(option, locale);

        if (!label) {
          continue;
        }

        rows.push({
          answer_option_id: answerOptionId,
          locale,
          label,
        });
      }
    }
  }

  if (rows.length === 0) {
    return 0;
  }

  const { error } = await supabase.from("answer_option_localizations").upsert(rows, {
    onConflict: "answer_option_id,locale",
  });

  if (error) {
    fail(`Failed to upsert SAFRAN V1 answer option localizations: ${error.message}`);
  }

  return rows.length;
}

async function main(): Promise<void> {
  await loadLocalEnvFile();

  const seedPath = path.resolve(process.argv[2] ?? "safran_v1_seed.json");
  const seed = await loadSafranSeed(seedPath);
  const supabase = createAdminSupabaseClient();
  const testId = await upsertSafranTest(supabase);
  const dimensionsUpserted = await upsertSafranDimensions(supabase, testId);
  const questions = await upsertSafranQuestions(supabase, testId, seed.items);
  const questionLocalizationsUpserted = await upsertSafranQuestionLocalizations(supabase, seed.items, questions);
  const answerOptions = await upsertSafranAnswerOptions(supabase, seed.items, questions);
  const answerOptionLocalizationsUpserted = await upsertSafranAnswerOptionLocalizations(
    supabase,
    seed.items,
    questions,
    answerOptions,
  );

  console.info("SAFRAN V1 import summary");
  console.info(`test upserted: ${SAFRAN_TEST.slug}`);
  console.info(`dimensions upserted: ${dimensionsUpserted}`);
  console.info(`questions upserted: ${questions.length}`);
  console.info(`question localizations upserted: ${questionLocalizationsUpserted}`);
  console.info(`answer options upserted: ${answerOptions.length}`);
  console.info(`answer option localizations upserted: ${answerOptionLocalizationsUpserted}`);
  console.info(`items found in seed: ${seed.items.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
