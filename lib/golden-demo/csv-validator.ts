import {
  GOLDEN_DEMO_ADDRESSING_FORMS,
  GOLDEN_DEMO_BANDS_BY_TEST,
  GOLDEN_DEMO_CANDIDATE_IDS,
  GOLDEN_DEMO_COHORT_SEGMENTS,
  GOLDEN_DEMO_CSV_HEADERS,
  GOLDEN_DEMO_DATA_STATUSES,
  GOLDEN_DEMO_EXPECTATION_TYPES,
  GOLDEN_DEMO_PARTICIPANT_TYPES,
  GOLDEN_DEMO_REPORT_LANES,
  GOLDEN_DEMO_RESPONSE_KINDS,
  GOLDEN_DEMO_SCORE_SCOPES,
  GOLDEN_DEMO_TEAM_IDS,
  GOLDEN_DEMO_TEST_SLUGS,
  IPIP_DERIVED_DOMAINS,
  IPIP_PERSISTED_DIMENSIONS,
  MWMS_DERIVED_COMPOSITES,
  MWMS_PERSISTED_DIMENSIONS,
  SAFRAN_DERIVED_COMPONENTS,
  SAFRAN_PERSISTED_DIMENSIONS,
  type GoldenDemoCandidateInspection,
  type GoldenDemoCsvDocument,
  type GoldenDemoCsvFoundation,
  type GoldenDemoRepoContract,
  type GoldenDemoReportLane,
  type GoldenDemoScoreScope,
  type GoldenDemoTestSlug,
  type GoldenDemoValidationIssue,
  type GoldenDemoValidationResult,
} from "./csv-contract";

const CSV_BOOLEAN_VALUES = ["true", "false"] as const;
const CANONICAL_DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;
const FORBIDDEN_SENSITIVE_COLUMNS = [
  "nationality",
  "ethnicity",
  "ethnic_group",
  "race",
  "name_origin_group",
];
const FORBIDDEN_DATABASE_COLUMN_PATTERN = /(^id$|uuid|_uuid$|^db_|_db_id$|question_id|answer_option_id|attempt_id)/i;

function includesValue(values: readonly string[], value: string): boolean {
  return values.includes(value);
}

function addIssue(
  issues: GoldenDemoValidationIssue[],
  code: string,
  document: GoldenDemoCsvDocument,
  message: string,
  options: { row?: number; column?: string } = {},
): void {
  issues.push({ code, file: document.file, ...options, message });
}

function validateHeader(
  document: GoldenDemoCsvDocument,
  expectedHeaders: readonly string[],
  errors: GoldenDemoValidationIssue[],
): void {
  for (const header of document.headers) {
    if (FORBIDDEN_SENSITIVE_COLUMNS.includes(header.toLowerCase())) {
      addIssue(errors, "forbidden_sensitive_column", document, `Forbidden sensitive column: ${header}.`, {
        row: 1,
        column: header,
      });
    }

    if (!expectedHeaders.includes(header) && FORBIDDEN_DATABASE_COLUMN_PATTERN.test(header)) {
      addIssue(errors, "forbidden_database_id_column", document, `Database ID/UUID column is forbidden: ${header}.`, {
        row: 1,
        column: header,
      });
    }

    if (!expectedHeaders.includes(header)) {
      addIssue(errors, "unexpected_column", document, `Unexpected CSV column: ${header}.`, {
        row: 1,
        column: header,
      });
    }
  }

  for (const expectedHeader of expectedHeaders) {
    if (!document.headers.includes(expectedHeader)) {
      addIssue(errors, "missing_column", document, `Missing required CSV column: ${expectedHeader}.`, {
        row: 1,
        column: expectedHeader,
      });
    }
  }

  if (
    document.headers.length === expectedHeaders.length &&
    document.headers.some((header, index) => header !== expectedHeaders[index])
  ) {
    addIssue(errors, "invalid_header_order", document, "CSV columns are not in canonical order.", {
      row: 1,
    });
  }

  for (const row of document.rows) {
    if (row.columnCount !== document.headers.length) {
      addIssue(
        errors,
        "column_count_mismatch",
        document,
        `Expected ${document.headers.length} columns, received ${row.columnCount}.`,
        { row: row.rowNumber },
      );
    }
  }
}

export function buildGoldenDemoEmail(displayName: string): string {
  const localPart = displayName
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/\s+/u)
    // The cohort specification defines this exact canonical token spelling.
    .map((token) => (token === "ulemek" ? "umelek" : token))
    .filter(Boolean)
    .join(".");

  return `${localPart}@partnerplus.ba`;
}

export const deriveGoldenDemoEmail = buildGoldenDemoEmail;

function validateCandidates(
  document: GoldenDemoCsvDocument,
  errors: GoldenDemoValidationIssue[],
): Set<string> {
  validateHeader(document, GOLDEN_DEMO_CSV_HEADERS.candidates, errors);
  const candidateIds = new Set<string>();
  const emails = new Set<string>();
  const teamCounts = new Map<string, number>();

  for (const row of document.rows) {
    const value = row.values;
    const candidateId = value.candidate_id ?? "";

    if (candidateIds.has(candidateId)) {
      addIssue(errors, "duplicate_candidate_id", document, `Duplicate candidate ID: ${candidateId}.`, {
        row: row.rowNumber,
        column: "candidate_id",
      });
    }
    candidateIds.add(candidateId);

    if (!GOLDEN_DEMO_CANDIDATE_IDS.includes(candidateId)) {
      addIssue(errors, "invalid_candidate_id", document, `Unknown candidate ID: ${candidateId}.`, {
        row: row.rowNumber,
        column: "candidate_id",
      });
    }

    const numericId = Number(candidateId.slice(3));
    const expectedSegment = numericId >= 1 && numericId <= 18 ? "development" : "holdout";
    if (!includesValue(GOLDEN_DEMO_COHORT_SEGMENTS, value.cohort_segment ?? "")) {
      addIssue(errors, "invalid_cohort_segment", document, `Invalid cohort segment: ${value.cohort_segment}.`, {
        row: row.rowNumber,
        column: "cohort_segment",
      });
    } else if (value.cohort_segment !== expectedSegment) {
      addIssue(
        errors,
        "candidate_segment_mismatch",
        document,
        `${candidateId} must use cohort segment ${expectedSegment}.`,
        { row: row.rowNumber, column: "cohort_segment" },
      );
    }

    if (!includesValue(GOLDEN_DEMO_TEAM_IDS, value.team_id ?? "")) {
      addIssue(errors, "invalid_team_id", document, `Invalid team ID: ${value.team_id}.`, {
        row: row.rowNumber,
        column: "team_id",
      });
    } else {
      teamCounts.set(value.team_id, (teamCounts.get(value.team_id) ?? 0) + 1);
    }

    if (!includesValue(GOLDEN_DEMO_PARTICIPANT_TYPES, value.participant_type ?? "")) {
      addIssue(errors, "invalid_participant_type", document, "participant_type must be employee.", {
        row: row.rowNumber,
        column: "participant_type",
      });
    }

    if (!includesValue(GOLDEN_DEMO_ADDRESSING_FORMS, value.addressing_form ?? "")) {
      addIssue(errors, "invalid_addressing_form", document, `Invalid addressing form: ${value.addressing_form}.`, {
        row: row.rowNumber,
        column: "addressing_form",
      });
    }

    if (!includesValue(GOLDEN_DEMO_DATA_STATUSES, value.data_status ?? "")) {
      addIssue(errors, "invalid_data_status", document, `Invalid data_status: ${value.data_status}.`, {
        row: row.rowNumber,
        column: "data_status",
      });
    }

    if (!(value.display_name ?? "").trim()) {
      addIssue(errors, "missing_display_name", document, "display_name must not be empty.", {
        row: row.rowNumber,
        column: "display_name",
      });
    }

    if (!(value.job_title ?? "").trim()) {
      addIssue(errors, "missing_job_title", document, "job_title must not be empty.", {
        row: row.rowNumber,
        column: "job_title",
      });
    }

    const email = value.email ?? "";
    const expectedEmail = buildGoldenDemoEmail(value.display_name ?? "");
    if (email !== expectedEmail) {
      addIssue(errors, "email_derivation_mismatch", document, `Expected deterministic email ${expectedEmail}.`, {
        row: row.rowNumber,
        column: "email",
      });
    }

    if (!email.endsWith("@partnerplus.ba")) {
      addIssue(errors, "invalid_email_domain", document, "Email must end with @partnerplus.ba.", {
        row: row.rowNumber,
        column: "email",
      });
    }

    if (emails.has(email)) {
      addIssue(errors, "duplicate_email", document, `Duplicate candidate email: ${email}.`, {
        row: row.rowNumber,
        column: "email",
      });
    }
    emails.add(email);
  }

  if (document.rows.length !== 24) {
    addIssue(errors, "invalid_candidate_count", document, `Expected 24 candidates, received ${document.rows.length}.`);
  }

  for (const expectedCandidateId of GOLDEN_DEMO_CANDIDATE_IDS) {
    if (!candidateIds.has(expectedCandidateId)) {
      addIssue(errors, "missing_candidate_id", document, `Missing candidate ID: ${expectedCandidateId}.`, {
        column: "candidate_id",
      });
    }
  }

  for (const teamId of GOLDEN_DEMO_TEAM_IDS) {
    const count = teamCounts.get(teamId) ?? 0;
    if (count !== 6) {
      addIssue(errors, "invalid_team_count", document, `${teamId} must contain exactly 6 candidates; received ${count}.`, {
        column: "team_id",
      });
    }
  }

  return candidateIds;
}

function validateCandidateProgressStatus(
  foundation: GoldenDemoCsvFoundation,
  errors: GoldenDemoValidationIssue[],
): void {
  const gd001 = foundation.candidates.rows.find(
    (row) => row.values.candidate_id === "GD-001",
  );
  const gd001AnswerCount = foundation.answers.rows.filter(
    (row) => row.values.candidate_id === "GD-001",
  ).length;

  if (gd001AnswerCount > 0 && gd001?.values.data_status !== "answers_ready") {
    addIssue(
      errors,
      "candidate_status_answer_mismatch",
      foundation.candidates,
      "GD-001 must use data_status=answers_ready when answer rows are present.",
      { row: gd001?.rowNumber, column: "data_status" },
    );
  }

  for (const row of foundation.candidates.rows) {
    if (row.values.candidate_id !== "GD-001" && row.values.data_status !== "identity_only") {
      addIssue(
        errors,
        "unexpected_candidate_progress_status",
        foundation.candidates,
        `${row.values.candidate_id} must remain data_status=identity_only in this cohort slice.`,
        { row: row.rowNumber, column: "data_status" },
      );
    }
  }
}

function validateCandidateReference(
  candidateIds: Set<string>,
  candidateId: string,
  document: GoldenDemoCsvDocument,
  rowNumber: number,
  errors: GoldenDemoValidationIssue[],
): void {
  if (!candidateIds.has(candidateId)) {
    addIssue(errors, "unknown_candidate_reference", document, `Unknown candidate reference: ${candidateId}.`, {
      row: rowNumber,
      column: "candidate_id",
    });
  }
}

function validateAnswers(
  document: GoldenDemoCsvDocument,
  candidateIds: Set<string>,
  repoContract: GoldenDemoRepoContract,
  errors: GoldenDemoValidationIssue[],
): void {
  validateHeader(document, GOLDEN_DEMO_CSV_HEADERS.answers, errors);
  const identities = new Set<string>();

  for (const row of document.rows) {
    const value = row.values;
    validateCandidateReference(candidateIds, value.candidate_id ?? "", document, row.rowNumber, errors);

    const testSlug = value.test_slug ?? "";
    const testContract = repoContract.tests.get(testSlug as GoldenDemoTestSlug);
    if (!testContract || !includesValue(GOLDEN_DEMO_TEST_SLUGS, testSlug)) {
      addIssue(errors, "unknown_test_slug", document, `Unknown test slug: ${testSlug}.`, {
        row: row.rowNumber,
        column: "test_slug",
      });
    }

    const questionCode = value.question_code ?? "";
    const question = testContract?.questions.get(questionCode);
    if (testContract && !question) {
      addIssue(errors, "unknown_question_code", document, `Unknown question code ${questionCode} for ${testSlug}.`, {
        row: row.rowNumber,
        column: "question_code",
      });
    }

    const responseKind = value.response_kind ?? "";
    if (!includesValue(GOLDEN_DEMO_RESPONSE_KINDS, responseKind)) {
      addIssue(errors, "invalid_response_kind", document, `Invalid response kind: ${responseKind}.`, {
        row: row.rowNumber,
        column: "response_kind",
      });
    } else if (question && question.responseKind !== responseKind) {
      addIssue(errors, "response_kind_mismatch", document, `${questionCode} requires response_kind=${question.responseKind}.`, {
        row: row.rowNumber,
        column: "response_kind",
      });
    }

    const answerValue = value.answer_value ?? "";
    const answerOptionCode = value.answer_option_code ?? "";
    if (responseKind === "single_choice") {
      if (!answerOptionCode) {
        addIssue(errors, "missing_answer_option_code", document, "single_choice requires answer_option_code.", {
          row: row.rowNumber,
          column: "answer_option_code",
        });
      } else if (question && !question.optionCodes.has(answerOptionCode)) {
        addIssue(
          errors,
          "answer_option_not_in_question",
          document,
          `Option ${answerOptionCode} does not belong to ${questionCode}.`,
          { row: row.rowNumber, column: "answer_option_code" },
        );
      }

      if (answerValue) {
        addIssue(errors, "single_choice_answer_value_not_empty", document, "single_choice requires empty answer_value.", {
          row: row.rowNumber,
          column: "answer_value",
        });
      }
    }

    if (responseKind === "text") {
      if (!answerValue) {
        addIssue(errors, "missing_answer_value", document, "text response requires answer_value.", {
          row: row.rowNumber,
          column: "answer_value",
        });
      } else if (!CANONICAL_DECIMAL_PATTERN.test(answerValue)) {
        addIssue(
          errors,
          "invalid_canonical_decimal",
          document,
          "SAFRAN numeric answer must use canonical decimal-point notation.",
          { row: row.rowNumber, column: "answer_value" },
        );
      }

      if (answerOptionCode) {
        addIssue(errors, "text_answer_option_not_empty", document, "text response requires empty answer_option_code.", {
          row: row.rowNumber,
          column: "answer_option_code",
        });
      }
    }

    if (!(value.recipe_version ?? "").trim()) {
      addIssue(errors, "missing_recipe_version", document, "recipe_version must not be empty.", {
        row: row.rowNumber,
        column: "recipe_version",
      });
    }

    const identity = `${value.candidate_id}\u0000${testSlug}\u0000${questionCode}`;
    if (identities.has(identity)) {
      addIssue(errors, "duplicate_answer_identity", document, "Duplicate candidate/test/question answer identity.", {
        row: row.rowNumber,
      });
    }
    identities.add(identity);
  }
}

function getScoreKeys(testSlug: string, scope: string): readonly string[] | null {
  if (testSlug === "ipip-neo-120-v1" && scope === "persisted_dimension") return IPIP_PERSISTED_DIMENSIONS;
  if (testSlug === "ipip-neo-120-v1" && scope === "derived_domain") return IPIP_DERIVED_DOMAINS;
  if (testSlug === "mwms_v1" && scope === "persisted_dimension") return MWMS_PERSISTED_DIMENSIONS;
  if (testSlug === "mwms_v1" && scope === "derived_composite") return MWMS_DERIVED_COMPOSITES;
  if (testSlug === "safran_v1" && scope === "persisted_dimension") return SAFRAN_PERSISTED_DIMENSIONS;
  if (testSlug === "safran_v1" && scope === "derived_component") return SAFRAN_DERIVED_COMPONENTS;
  return null;
}

function isFiniteCsvNumber(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Number(value));
}

function validateExpectedScores(
  document: GoldenDemoCsvDocument,
  candidateIds: Set<string>,
  errors: GoldenDemoValidationIssue[],
): void {
  validateHeader(document, GOLDEN_DEMO_CSV_HEADERS.expectedScores, errors);
  const identities = new Set<string>();

  for (const row of document.rows) {
    const value = row.values;
    validateCandidateReference(candidateIds, value.candidate_id ?? "", document, row.rowNumber, errors);
    const testSlug = value.test_slug ?? "";
    if (!includesValue(GOLDEN_DEMO_TEST_SLUGS, testSlug)) {
      addIssue(errors, "unknown_test_slug", document, `Unknown test slug: ${testSlug}.`, {
        row: row.rowNumber,
        column: "test_slug",
      });
    }

    const scoreScope = value.score_scope ?? "";
    if (!includesValue(GOLDEN_DEMO_SCORE_SCOPES, scoreScope)) {
      addIssue(errors, "invalid_score_scope", document, `Invalid score scope: ${scoreScope}.`, {
        row: row.rowNumber,
        column: "score_scope",
      });
    }

    const allowedKeys = getScoreKeys(testSlug, scoreScope);
    if (!allowedKeys || !allowedKeys.includes(value.score_key ?? "")) {
      addIssue(
        errors,
        "unknown_score_key",
        document,
        `Unknown score key ${value.score_key} for ${testSlug}/${scoreScope}.`,
        { row: row.rowNumber, column: "score_key" },
      );
    }

    if (!isFiniteCsvNumber(value.expected_value ?? "")) {
      addIssue(errors, "invalid_expected_value", document, "expected_value must be a finite number.", {
        row: row.rowNumber,
        column: "expected_value",
      });
    }

    if (!isFiniteCsvNumber(value.tolerance ?? "") || Number(value.tolerance) < 0) {
      addIssue(errors, "invalid_tolerance", document, "tolerance must be a number greater than or equal to zero.", {
        row: row.rowNumber,
        column: "tolerance",
      });
    }

    const expectedBand = value.expected_band ?? "";
    const allowedBands = GOLDEN_DEMO_BANDS_BY_TEST[testSlug as GoldenDemoTestSlug];
    if (expectedBand && (!allowedBands || !includesValue(allowedBands, expectedBand))) {
      addIssue(errors, "invalid_expected_band", document, `Invalid band ${expectedBand} for ${testSlug}.`, {
        row: row.rowNumber,
        column: "expected_band",
      });
    }

    if (!includesValue(CSV_BOOLEAN_VALUES, value.required ?? "")) {
      addIssue(errors, "invalid_required_boolean", document, "required must be true or false.", {
        row: row.rowNumber,
        column: "required",
      });
    }

    if (!(value.expectation_version ?? "").trim()) {
      addIssue(errors, "missing_expectation_version", document, "expectation_version must not be empty.", {
        row: row.rowNumber,
        column: "expectation_version",
      });
    }

    const identity = `${value.candidate_id}\u0000${testSlug}\u0000${scoreScope}\u0000${value.score_key}`;
    if (identities.has(identity)) {
      addIssue(errors, "duplicate_score_expectation", document, "Duplicate expected score identity.", {
        row: row.rowNumber,
      });
    }
    identities.add(identity);
  }
}

function validateExpectedAiFindings(
  document: GoldenDemoCsvDocument,
  candidateIds: Set<string>,
  errors: GoldenDemoValidationIssue[],
): void {
  validateHeader(document, GOLDEN_DEMO_CSV_HEADERS.expectedAiFindings, errors);
  const identities = new Set<string>();

  for (const row of document.rows) {
    const value = row.values;
    validateCandidateReference(candidateIds, value.candidate_id ?? "", document, row.rowNumber, errors);

    if (!includesValue(GOLDEN_DEMO_REPORT_LANES, value.report_lane ?? "")) {
      addIssue(errors, "unknown_report_lane", document, `Unknown report lane: ${value.report_lane}.`, {
        row: row.rowNumber,
        column: "report_lane",
      });
    }

    if (!includesValue(GOLDEN_DEMO_EXPECTATION_TYPES, value.expectation_type ?? "")) {
      addIssue(errors, "invalid_expectation_type", document, `Invalid expectation type: ${value.expectation_type}.`, {
        row: row.rowNumber,
        column: "expectation_type",
      });
    }

    if (!(value.finding_key ?? "").trim()) {
      addIssue(errors, "missing_finding_key", document, "finding_key must not be empty.", {
        row: row.rowNumber,
        column: "finding_key",
      });
    }

    if (!(value.statement ?? "").trim()) {
      addIssue(errors, "empty_ai_statement", document, "statement must not be empty.", {
        row: row.rowNumber,
        column: "statement",
      });
    }

    if (!includesValue(CSV_BOOLEAN_VALUES, value.required ?? "")) {
      addIssue(errors, "invalid_required_boolean", document, "required must be true or false.", {
        row: row.rowNumber,
        column: "required",
      });
    }

    if (!(value.expectation_version ?? "").trim()) {
      addIssue(errors, "missing_expectation_version", document, "expectation_version must not be empty.", {
        row: row.rowNumber,
        column: "expectation_version",
      });
    }

    const identity = `${value.candidate_id}\u0000${value.finding_key}`;
    if (identities.has(identity)) {
      addIssue(errors, "duplicate_finding_key", document, "finding_key must be unique per candidate.", {
        row: row.rowNumber,
        column: "finding_key",
      });
    }
    identities.add(identity);
  }
}

export function validateGoldenDemoCsvFoundation(
  foundation: GoldenDemoCsvFoundation,
  repoContract: GoldenDemoRepoContract,
): GoldenDemoValidationResult {
  const errors: GoldenDemoValidationIssue[] = [];
  const warnings: GoldenDemoValidationIssue[] = [];
  const candidateIds = validateCandidates(foundation.candidates, errors);
  validateAnswers(foundation.answers, candidateIds, repoContract, errors);
  validateCandidateProgressStatus(foundation, errors);
  validateExpectedScores(foundation.expectedScores, candidateIds, errors);
  validateExpectedAiFindings(foundation.expectedAiFindings, candidateIds, errors);

  const teamCounts = Object.fromEntries(
    GOLDEN_DEMO_TEAM_IDS.map((teamId) => [
      teamId,
      foundation.candidates.rows.filter((row) => row.values.team_id === teamId).length,
    ]),
  );

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      candidateCount: foundation.candidates.rows.length,
      developmentCount: foundation.candidates.rows.filter(
        (row) => row.values.cohort_segment === "development",
      ).length,
      holdoutCount: foundation.candidates.rows.filter(
        (row) => row.values.cohort_segment === "holdout",
      ).length,
      teamCounts,
      answerCount: foundation.answers.rows.length,
      expectedScoreCount: foundation.expectedScores.rows.length,
      expectedAiFindingCount: foundation.expectedAiFindings.rows.length,
    },
  };
}

export function inspectGoldenDemoCandidate(
  foundation: GoldenDemoCsvFoundation,
  candidateId: string,
): GoldenDemoCandidateInspection | null {
  const candidate = foundation.candidates.rows.find(
    (row) => row.values.candidate_id === candidateId,
  );

  if (!candidate) {
    return null;
  }

  const answerCountByTest = Object.fromEntries(
    GOLDEN_DEMO_TEST_SLUGS.map((testSlug) => [
      testSlug,
      foundation.answers.rows.filter(
        (row) => row.values.candidate_id === candidateId && row.values.test_slug === testSlug,
      ).length,
    ]),
  ) as Record<GoldenDemoTestSlug, number>;
  const expectedScoreCountByTest = Object.fromEntries(
    GOLDEN_DEMO_TEST_SLUGS.map((testSlug) => [
      testSlug,
      foundation.expectedScores.rows.filter(
        (row) => row.values.candidate_id === candidateId && row.values.test_slug === testSlug,
      ).length,
    ]),
  ) as Record<GoldenDemoTestSlug, number>;
  const expectedAiFindingCountByReportLane = Object.fromEntries(
    GOLDEN_DEMO_REPORT_LANES.map((reportLane) => [
      reportLane,
      foundation.expectedAiFindings.rows.filter(
        (row) => row.values.candidate_id === candidateId && row.values.report_lane === reportLane,
      ).length,
    ]),
  ) as Record<GoldenDemoReportLane, number>;

  return {
    candidate: {
      candidateId,
      displayName: candidate.values.display_name ?? "",
      email: candidate.values.email ?? "",
      teamId: candidate.values.team_id ?? "",
      cohortSegment: candidate.values.cohort_segment ?? "",
      dataStatus: candidate.values.data_status ?? "",
    },
    answerCountByTest,
    expectedScoreCountByTest,
    expectedAiFindingCountByReportLane,
  };
}
