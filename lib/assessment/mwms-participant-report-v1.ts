import mwmsParticipantReportV1SchemaJson from "@/lib/assessment/schemas/mwms-participant-report-v1.json";

export const MWMS_PARTICIPANT_REPORT_SCHEMA_VERSION = "mwms_participant_report_v1" as const;

export type MwmsParticipantReportV1 = {
  schema_version: typeof MWMS_PARTICIPANT_REPORT_SCHEMA_VERSION;
  test_slug: "mwms_v1";
  audience: "participant";
  title: "Radna motivacija";
  summary: {
    headline: string;
    paragraph: string;
  };
  motivation_pattern: {
    autonomous: string;
    controlled: string;
    amotivation: string;
  };
  key_observations: string[];
  possible_tensions: string[];
  reflection_questions: string[];
  development_suggestions: string[];
  interpretation_note: string;
};

export const mwmsParticipantReportV1OpenAiSchema =
  mwmsParticipantReportV1SchemaJson;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeTextForQualityCheck(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?;:,\s]+$/u, "");
}

function isPlaceholderLikeText(value: string): boolean {
  const normalized = normalizeTextForQualityCheck(value);

  return (
    normalized.length < 18 ||
    /^(?:n\/?a|tbd|todo|test|placeholder|-|—)$/i.test(normalized) ||
    /lorem ipsum/i.test(normalized)
  );
}

function isGenericMwmsFiller(value: string): boolean {
  const normalized = normalizeTextForQualityCheck(value);

  return [
    "ovaj izvještaj prikazuje rezultate",
    "ovaj izvjestaj prikazuje rezultate",
    "kandidat ima različite izvore motivacije",
    "kandidat ima razlicite izvore motivacije",
    "motivacija može varirati",
    "motivacija moze varirati",
    "važno je uzeti rezultate u obzir",
    "vazno je uzeti rezultate u obzir",
    "ovo je opšti sažetak",
    "ovo je opsti sazetak",
    "ovo je opći sažetak",
    "ovo je opci sazetak",
  ].includes(normalized);
}

function hasUnsafeMwmsClaim(value: string): boolean {
  return /(?:\bhire\b|\bno-hire\b|treba zaposliti|ne zaposliti|preporu(?:čuje|cuje) se zapošljavanje|preporu(?:čuje|cuje) se zaposljavanje|dijagnosticira|dijagnosticira|mentaln(?:o|og)? zdravlj|medicinsk|kliničk|klinick|clinical|disorder|poremećaj|poremecaj|dokazuje|garantuje|sigurno pokazuje|\buvijek\b|\bnikada\b)/i.test(
    value,
  );
}

function validateNarrativeText(value: unknown, path: string, errors: string[]): value is string {
  if (!isNonEmptyString(value)) {
    errors.push(`${path}: Expected non-empty string.`);
    return false;
  }

  if (isPlaceholderLikeText(value)) {
    errors.push(`${path}: Text is placeholder-like or too short.`);
  }

  if (isGenericMwmsFiller(value)) {
    errors.push(`${path}: Text is generic MWMS filler.`);
  }

  if (hasUnsafeMwmsClaim(value)) {
    errors.push(`${path}: Text contains an unsafe or overclaiming MWMS assertion.`);
  }

  return true;
}

function isReflectionQuestionLike(value: string): boolean {
  const trimmed = value.trim();

  return (
    trimmed.endsWith("?") ||
    /^(?:koji|koja|koje|kako|šta|sta|gdje|kada|koliko|zašto|zasto|u kojim|u kojoj|možeš li|mozes li|da li)\b/i.test(
      trimmed,
    )
  );
}

function validateStringArray(
  value: unknown,
  path: string,
  errors: string[],
  options?: { requireQuestionShape?: boolean },
): value is string[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  if (value.length < 1 || value.length > 3) {
    errors.push(`${path}: Expected 1-3 items.`);
  }

  value.forEach((item, index) => {
    if (validateNarrativeText(item, `${path}[${index}]`, errors)) {
      if (options?.requireQuestionShape && !isReflectionQuestionLike(item)) {
        errors.push(`${path}[${index}]: Expected reflection question-shaped text.`);
      }
    }
  });

  assertUniqueNarrativeTexts(
    value.filter((item): item is string => typeof item === "string"),
    path,
    errors,
  );

  return value.every(isNonEmptyString) && value.length >= 1 && value.length <= 3;
}

function validateSummary(value: unknown, errors: string[]): value is MwmsParticipantReportV1["summary"] {
  if (!isRecord(value)) {
    errors.push("summary: Expected object.");
    return false;
  }

  const headlineOk = validateNarrativeText(value.headline, "summary.headline", errors);
  const paragraphOk = validateNarrativeText(value.paragraph, "summary.paragraph", errors);

  return headlineOk && paragraphOk;
}

function validateMotivationPattern(
  value: unknown,
  errors: string[],
): value is MwmsParticipantReportV1["motivation_pattern"] {
  if (!isRecord(value)) {
    errors.push("motivation_pattern: Expected object.");
    return false;
  }

  for (const key of ["autonomous", "controlled", "amotivation"] as const) {
    validateNarrativeText(value[key], `motivation_pattern.${key}`, errors);
  }

  return (
    isNonEmptyString(value.autonomous) &&
    isNonEmptyString(value.controlled) &&
    isNonEmptyString(value.amotivation)
  );
}

function assertUniqueNarrativeTexts(values: string[], path: string, errors: string[]): void {
  const seen = new Map<string, number>();

  values.forEach((value, index) => {
    const normalized = normalizeTextForQualityCheck(value);

    if (!normalized) {
      return;
    }

    const firstIndex = seen.get(normalized);

    if (firstIndex !== undefined) {
      errors.push(`${path}[${index}]: Duplicate narrative text also found at ${path}[${firstIndex}].`);
      return;
    }

    seen.set(normalized, index);
  });
}

function validateCrossFieldDuplicates(
  report: MwmsParticipantReportV1,
  errors: string[],
): void {
  const entries: Array<{ path: string; value: string }> = [
    { path: "summary.headline", value: report.summary.headline },
    { path: "summary.paragraph", value: report.summary.paragraph },
    { path: "motivation_pattern.autonomous", value: report.motivation_pattern.autonomous },
    { path: "motivation_pattern.controlled", value: report.motivation_pattern.controlled },
    { path: "motivation_pattern.amotivation", value: report.motivation_pattern.amotivation },
    ...report.key_observations.map((value, index) => ({
      path: `key_observations[${index}]`,
      value,
    })),
    ...report.possible_tensions.map((value, index) => ({
      path: `possible_tensions[${index}]`,
      value,
    })),
    ...report.reflection_questions.map((value, index) => ({
      path: `reflection_questions[${index}]`,
      value,
    })),
    ...report.development_suggestions.map((value, index) => ({
      path: `development_suggestions[${index}]`,
      value,
    })),
    { path: "interpretation_note", value: report.interpretation_note },
  ];
  const seen = new Map<string, string>();

  entries.forEach((entry) => {
    const normalized = normalizeTextForQualityCheck(entry.value);

    if (!normalized) {
      return;
    }

    const firstPath = seen.get(normalized);

    if (firstPath) {
      errors.push(`${entry.path}: Duplicate narrative text also found at ${firstPath}.`);
      return;
    }

    seen.set(normalized, entry.path);
  });
}

export function validateMwmsParticipantReportV1(
  value: unknown,
): { ok: true; value: MwmsParticipantReportV1 } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["<root>: Expected object."] };
  }

  if (value.schema_version !== MWMS_PARTICIPANT_REPORT_SCHEMA_VERSION) {
    errors.push(`schema_version: Expected ${MWMS_PARTICIPANT_REPORT_SCHEMA_VERSION}.`);
  }

  if (value.test_slug !== "mwms_v1") {
    errors.push("test_slug: Expected mwms_v1.");
  }

  if (value.audience !== "participant") {
    errors.push("audience: Expected participant.");
  }

  if (value.title !== "Radna motivacija") {
    errors.push("title: Expected Radna motivacija.");
  }

  const summaryOk = validateSummary(value.summary, errors);
  const patternOk = validateMotivationPattern(value.motivation_pattern, errors);
  const observationsOk = validateStringArray(value.key_observations, "key_observations", errors);
  const tensionsOk = validateStringArray(value.possible_tensions, "possible_tensions", errors);
  const questionsOk = validateStringArray(value.reflection_questions, "reflection_questions", errors, {
    requireQuestionShape: true,
  });
  const suggestionsOk = validateStringArray(
    value.development_suggestions,
    "development_suggestions",
    errors,
  );

  const interpretationNoteOk = validateNarrativeText(
    value.interpretation_note,
    "interpretation_note",
    errors,
  );

  if (
    summaryOk &&
    patternOk &&
    observationsOk &&
    tensionsOk &&
    questionsOk &&
    suggestionsOk &&
    interpretationNoteOk
  ) {
    validateCrossFieldDuplicates(value as MwmsParticipantReportV1, errors);
  }

  if (
    errors.length > 0 ||
    !summaryOk ||
    !patternOk ||
    !observationsOk ||
    !tensionsOk ||
    !questionsOk ||
    !suggestionsOk ||
    !interpretationNoteOk
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: value as MwmsParticipantReportV1,
  };
}

export function formatMwmsParticipantReportV1ValidationErrors(errors: string[]): string {
  return errors.join(" | ");
}
