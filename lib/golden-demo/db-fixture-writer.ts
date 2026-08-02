import type { GoldenDemoCsvFoundation } from "./csv-contract";

export const GOLDEN_DEMO_CANDIDATE_IDS = ["GD-001", "GD-002", "GD-003"] as const;
export type GoldenDemoCandidateId = (typeof GOLDEN_DEMO_CANDIDATE_IDS)[number];
export const GOLDEN_DEMO_ORGANIZATION_NAME =
  "Partner Plus d.o.o., Mikrokreditna organizacija" as const;
export const GOLDEN_DEMO_TEST_SLUGS = [
  "ipip-neo-120-v1",
  "safran_v1",
  "mwms_v1",
] as const;
export const GOLDEN_DEMO_EXPECTED_RESPONSE_COUNTS = {
  "ipip-neo-120-v1": 120,
  safran_v1: 45,
  mwms_v1: 19,
} as const;

export const GD_001_CANDIDATE_ID = "GD-001" as const;
export const GD_001_ORGANIZATION_NAME = GOLDEN_DEMO_ORGANIZATION_NAME;
export const GD_001_TEST_SLUGS = GOLDEN_DEMO_TEST_SLUGS;
export const GD_001_EXPECTED_RESPONSE_COUNTS = GOLDEN_DEMO_EXPECTED_RESPONSE_COUNTS;
export const GD_001_FIXTURE_RPC = "create_golden_demo_gd001_fixture_v1" as const;
export const GOLDEN_DEMO_FIXTURE_RPC =
  "create_golden_demo_standard_battery_fixture_v2" as const;
export const GD_001_FIXTURE_SCHEMA_VERSION = "gd_db_fixture_v1" as const;
export const GD_001_RPC_NOT_EMPTY_PREFIX = "GD_FIXTURE_NOT_EMPTY" as const;

const LOCKED_CANDIDATE_IDENTITIES: Record<GoldenDemoCandidateId, { fullName: string; email: string }> = {
  "GD-001": {
    fullName: "Amel Kovačević",
    email: "amel.kovacevic@partnerplus.ba",
  },
  "GD-002": {
    fullName: "Nataša Rapaić",
    email: "natasa.rapaic@partnerplus.ba",
  },
  "GD-003": {
    fullName: "Vladimir Lučić",
    email: "vladimir.lucic@partnerplus.ba",
  },
};

const GOLDEN_DEMO_CANDIDATE_LABEL = GOLDEN_DEMO_CANDIDATE_IDS.join(", ");
const LEGACY_NULL_ADDRESSING_CANDIDATE_IDS: readonly GoldenDemoCandidateId[] = ["GD-002", "GD-003"];

export function getGd001RpcErrorText(error: unknown): string {
  const parts: string[] = [];
  if (error instanceof Error && error.message) parts.push(error.message);
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    for (const field of ["code", "message", "details", "hint"] as const) {
      const value = record[field];
      if (typeof value === "string" && value && !parts.includes(value)) parts.push(value);
    }
  }
  if (parts.length > 0) return parts.join(" | ");
  return String(error);
}

export function isGd001RpcNotEmptyError(error: unknown): boolean {
  return getGd001RpcErrorText(error).includes(GD_001_RPC_NOT_EMPTY_PREFIX);
}

export type Gd001WriterMode = "dry-run" | "apply";
export type Gd001FixtureState = "EMPTY" | "EXACT_MATCH" | "PARTIAL" | "CONFLICT";

export type Gd001CliOptions = {
  mode: Gd001WriterMode;
  candidateId: GoldenDemoCandidateId;
  verbose: boolean;
};

export type ResolvedFixtureResponse = {
  testSlug: (typeof GD_001_TEST_SLUGS)[number];
  questionCode: string;
  attemptId: string;
  questionId: string;
  responseKind: "single_choice" | "text";
  answerOptionId: string | null;
  textValue: string | null;
};

export type ResponseInsert = {
  attempt_id: string;
  question_id: string;
  response_kind: "single_choice" | "text";
  answer_option_id?: string;
  text_value?: string;
};

export type ActualFixtureResponse = {
  attempt_id: string;
  question_id: string;
  response_kind: string;
  answer_option_id: string | null;
  text_value: string | null;
  raw_value: number | null;
  scored_value: number | null;
};

export type Gd001ParticipantSnapshot = {
  id: string;
  organization_id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  participant_type: string;
  status: string;
  addressing_form: string | null;
};

export type Gd001AssignmentSnapshot = {
  id: string;
  organization_id: string;
  participant_id: string;
  assignment_type: string;
  status: string;
  locale: string;
  completed_at: string | null;
};

export type Gd001AttemptSnapshot = {
  id: string;
  test_id: string;
  test_slug: string;
  organization_id: string | null;
  participant_id: string | null;
  user_id: string | null;
  status: string;
  locale: string;
  addressing_form_snapshot: string | null;
  completed_at: string | null;
  scored_started_at: string | null;
};

export type Gd001AssignmentAttemptLinkSnapshot = {
  assessment_assignment_id: string;
  attempt_id: string;
  test_id: string;
  test_slug: string;
  role_in_assignment: string;
  required_for_composite: boolean;
  required_for_team_fit: boolean;
  position: number | null;
};

export type Gd001DbSnapshot = {
  organizationId: string;
  participant: Gd001ParticipantSnapshot | null;
  participantConflictReasons: string[];
  assignments: Gd001AssignmentSnapshot[];
  attempts: Gd001AttemptSnapshot[];
  links: Gd001AssignmentAttemptLinkSnapshot[];
  responses: ActualFixtureResponse[];
  dimensionScoreCount: number;
  attemptReportCount: number;
  assessmentReportCount: number;
};

export type Gd001ResolvedRepositoryState = {
  snapshot: Gd001DbSnapshot;
  expectedResponses: ResolvedFixtureResponse[];
  candidate: ReturnType<typeof getGd001CandidateContract>;
  testIdsBySlug: Record<string, string>;
};

export type Gd001FixtureRepository = {
  inspect(): Promise<Gd001ResolvedRepositoryState>;
};

export type Gd001FixtureRpcPayload = {
  schema_version: typeof GD_001_FIXTURE_SCHEMA_VERSION;
  candidate_id: GoldenDemoCandidateId;
  organization_name: typeof GOLDEN_DEMO_ORGANIZATION_NAME;
  participant: {
    display_name: string;
    email: string;
    participant_type: "employee";
    addressing_form: "masculine" | "feminine";
  };
  assignment: { locale: "bs" };
  tests: Array<{
    test_slug: (typeof GOLDEN_DEMO_TEST_SLUGS)[number];
    component_order: number;
  }>;
  responses: Array<{
    test_slug: (typeof GOLDEN_DEMO_TEST_SLUGS)[number];
    question_code: string;
    response_kind: "single_choice" | "text";
    answer_option_code: string | null;
    answer_value: string | null;
  }>;
};

export type Gd001FixtureRpcResult = {
  rpcVersion: typeof GD_001_FIXTURE_RPC;
  stateBefore: "EMPTY";
  stateAfter: "CREATED";
  candidateId: typeof GD_001_CANDIDATE_ID;
  organizationId: string;
  participantId: string;
  assignmentId: string;
  attemptIds: Record<(typeof GD_001_TEST_SLUGS)[number], string>;
  counts: {
    participants: 1;
    assignments: 1;
    attempts: 3;
    assignmentAttemptLinks: 3;
    responses: 184;
    ipipResponses: 120;
    safranResponses: 45;
    mwmsResponses: 19;
    dimensionScores: 0;
    attemptReports: 0;
    assessmentReports: 0;
  };
  scoringExecution: false;
  reportGeneration: false;
};

export type GoldenDemoFixtureRpcResult = {
  rpcVersion: typeof GOLDEN_DEMO_FIXTURE_RPC;
  stateBefore: "EMPTY";
  stateAfter: "CREATED";
  candidateId: GoldenDemoCandidateId;
  participantCreated: boolean;
  organizationId: string;
  participantId: string;
  assignmentId: string;
  attemptIds: Record<(typeof GOLDEN_DEMO_TEST_SLUGS)[number], string>;
  counts: {
    participants: 1;
    assignments: 1;
    attempts: 3;
    assignmentAttemptLinks: 3;
    responses: 184;
    ipipResponses: 120;
    safranResponses: 45;
    mwmsResponses: 19;
    dimensionScores: 0;
    attemptReports: 0;
    assessmentReports: 0;
  };
  scoringExecution: false;
  reportGeneration: false;
};

export type Gd001StateClassification = {
  state: Gd001FixtureState;
  reasons: string[];
  responseCountsByTest: Record<string, number>;
};

const DESTRUCTIVE_FLAGS = new Set([
  "--delete",
  "--cleanup",
  "--reset",
  "--force",
  "--overwrite",
]);

export function parseGd001WriterCli(args: string[]): Gd001CliOptions {
  for (const argument of args) {
    if (DESTRUCTIVE_FLAGS.has(argument)) {
      throw new Error(
        `${argument} is forbidden. Destructive Golden Demo operations require a separate future operator task.`,
      );
    }
  }

  let mode: Gd001WriterMode = "dry-run";
  let candidateId: string | null = null;
  let verbose = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      if (mode === "apply") throw new Error("--dry-run and --apply cannot be combined.");
      mode = "dry-run";
      continue;
    }
    if (argument === "--apply") {
      mode = "apply";
      continue;
    }
    if (argument === "--candidate") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`--candidate requires an explicit ${GOLDEN_DEMO_CANDIDATE_LABEL} value.`);
      }
      candidateId = value;
      index += 1;
      continue;
    }
    if (argument === "--verbose") {
      verbose = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (mode === "apply" && !candidateId) {
    throw new Error(
      `--apply requires an explicit --candidate from ${GOLDEN_DEMO_CANDIDATE_LABEL} confirmation.`,
    );
  }
  if (candidateId && !GOLDEN_DEMO_CANDIDATE_IDS.includes(candidateId as GoldenDemoCandidateId)) {
    throw new Error(`Unsupported candidate ID: ${candidateId}. Only ${GOLDEN_DEMO_CANDIDATE_LABEL} are allowed.`);
  }

  return { mode, candidateId: (candidateId ?? GD_001_CANDIDATE_ID) as GoldenDemoCandidateId, verbose };
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeIdentityText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bs");
}

export function getGoldenDemoCandidateContract(
  foundation: GoldenDemoCsvFoundation,
  candidateId: GoldenDemoCandidateId,
) {
  const candidate = foundation.candidates.rows.find(
    (row) => row.values.candidate_id === candidateId,
  );
  if (!candidate) throw new Error(`Golden Demo candidates.csv is missing ${candidateId}.`);
  const lockedIdentity = LOCKED_CANDIDATE_IDENTITIES[candidateId];
  const fullName = candidate.values.display_name;
  const email = normalizeEmail(candidate.values.email);
  if (fullName !== lockedIdentity.fullName || email !== lockedIdentity.email) {
    throw new Error(`${candidateId} candidate CSV contract does not match the locked fixture identity.`);
  }
  return {
    candidateId,
    fullName: candidate.values.display_name,
    email,
    participantType: candidate.values.participant_type,
    addressingForm: candidate.values.addressing_form,
    teamId: candidate.values.team_id,
  };
}

export function getGd001CandidateContract(foundation: GoldenDemoCsvFoundation) {
  return getGoldenDemoCandidateContract(foundation, GD_001_CANDIDATE_ID);
}

export function buildGoldenDemoFixtureRpcPayload(
  foundation: GoldenDemoCsvFoundation,
  candidateId: GoldenDemoCandidateId,
): Gd001FixtureRpcPayload {
  const candidate = getGoldenDemoCandidateContract(foundation, candidateId);
  if (candidate.participantType !== "employee" || !["masculine", "feminine"].includes(candidate.addressingForm)) {
    throw new Error(`${candidateId} candidate CSV contract has an unsupported participant contract.`);
  }

  const responses = foundation.answers.rows
    .filter((row) => row.values.candidate_id === candidateId)
    .map((row) => {
      const responseKind = row.values.response_kind;
      if (responseKind !== "single_choice" && responseKind !== "text") {
        throw new Error(`GD-001 RPC payload has unsupported response kind ${responseKind}.`);
      }
      if (responseKind === "single_choice") {
        return {
          test_slug: row.values.test_slug as (typeof GD_001_TEST_SLUGS)[number],
          question_code: row.values.question_code,
          response_kind: "single_choice" as const,
          answer_option_code: row.values.answer_option_code,
          answer_value: null,
        };
      }
      return {
        test_slug: row.values.test_slug as (typeof GD_001_TEST_SLUGS)[number],
        question_code: row.values.question_code,
        response_kind: "text" as const,
        answer_option_code: null,
        answer_value: row.values.answer_value,
      };
    });

  const expectedResponseCount = Object.values(GOLDEN_DEMO_EXPECTED_RESPONSE_COUNTS).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (responses.length !== expectedResponseCount) {
    throw new Error(`${candidateId} RPC payload requires ${expectedResponseCount} responses; received ${responses.length}.`);
  }
  for (const slug of GOLDEN_DEMO_TEST_SLUGS) {
    const expected = GOLDEN_DEMO_EXPECTED_RESPONSE_COUNTS[slug];
    const actual = responses.filter((response) => response.test_slug === slug).length;
    if (actual !== expected) {
      throw new Error(`${candidateId} RPC payload requires ${expected} ${slug} responses; received ${actual}.`);
    }
  }

  return {
    schema_version: GD_001_FIXTURE_SCHEMA_VERSION,
    candidate_id: candidateId,
    organization_name: GOLDEN_DEMO_ORGANIZATION_NAME,
    participant: {
      display_name: candidate.fullName,
      email: candidate.email,
      participant_type: "employee",
      addressing_form: candidate.addressingForm as "masculine" | "feminine",
    },
    assignment: { locale: "bs" },
    tests: GOLDEN_DEMO_TEST_SLUGS.map((test_slug, component_order) => ({
      test_slug,
      component_order,
    })),
    responses,
  };
}

export function buildGd001FixtureRpcPayload(
  foundation: GoldenDemoCsvFoundation,
): Gd001FixtureRpcPayload {
  return buildGoldenDemoFixtureRpcPayload(foundation, GD_001_CANDIDATE_ID);
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`GD-001 fixture RPC returned an invalid ${field}.`);
  }
  return value;
}

export function validateGd001FixtureRpcResult(value: unknown): Gd001FixtureRpcResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GD-001 fixture RPC returned an invalid result object.");
  }
  const result = value as Record<string, unknown>;
  if (result.rpcVersion !== GD_001_FIXTURE_RPC) {
    throw new Error("GD-001 fixture RPC returned an unexpected rpcVersion.");
  }
  if (result.stateBefore !== "EMPTY" || result.stateAfter !== "CREATED") {
    throw new Error("GD-001 fixture RPC did not confirm the EMPTY-to-CREATED transition.");
  }
  if (result.candidateId !== GD_001_CANDIDATE_ID) {
    throw new Error("GD-001 fixture RPC returned an unexpected candidate ID.");
  }
  const attemptIds = result.attemptIds as Record<string, unknown> | null;
  if (!attemptIds || typeof attemptIds !== "object" || Array.isArray(attemptIds)) {
    throw new Error("GD-001 fixture RPC returned invalid attempt IDs.");
  }
  const normalizedAttemptIds = Object.fromEntries(
    GD_001_TEST_SLUGS.map((slug) => [slug, asNonEmptyString(attemptIds[slug], `attemptIds.${slug}`)]),
  ) as Gd001FixtureRpcResult["attemptIds"];
  const counts = result.counts as Record<string, unknown> | null;
  const expectedCounts = {
    participants: 1,
    assignments: 1,
    attempts: 3,
    assignmentAttemptLinks: 3,
    responses: 184,
    ipipResponses: 120,
    safranResponses: 45,
    mwmsResponses: 19,
    dimensionScores: 0,
    attemptReports: 0,
    assessmentReports: 0,
  } as const;
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
    throw new Error("GD-001 fixture RPC returned invalid counts.");
  }
  for (const [key, expected] of Object.entries(expectedCounts)) {
    if (counts[key] !== expected) {
      throw new Error(`GD-001 fixture RPC returned ${key}=${String(counts[key])}; expected ${expected}.`);
    }
  }
  if (result.scoringExecution !== false || result.reportGeneration !== false) {
    throw new Error("GD-001 fixture RPC must not execute scoring or report generation.");
  }
  return {
    rpcVersion: GD_001_FIXTURE_RPC,
    stateBefore: "EMPTY",
    stateAfter: "CREATED",
    candidateId: GD_001_CANDIDATE_ID,
    organizationId: asNonEmptyString(result.organizationId, "organizationId"),
    participantId: asNonEmptyString(result.participantId, "participantId"),
    assignmentId: asNonEmptyString(result.assignmentId, "assignmentId"),
    attemptIds: normalizedAttemptIds,
    counts: expectedCounts,
    scoringExecution: false,
    reportGeneration: false,
  };
}

export function validateGoldenDemoFixtureRpcResult(
  value: unknown,
  expectedCandidateId?: GoldenDemoCandidateId,
): GoldenDemoFixtureRpcResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Golden Demo fixture RPC returned an invalid result object.");
  }
  const result = value as Record<string, unknown>;
  if (result.rpcVersion !== GOLDEN_DEMO_FIXTURE_RPC) {
    throw new Error("Golden Demo fixture RPC returned an unexpected rpcVersion.");
  }
  if (result.stateBefore !== "EMPTY" || result.stateAfter !== "CREATED") {
    throw new Error("Golden Demo fixture RPC did not confirm the EMPTY-to-CREATED transition.");
  }
  if (
    typeof result.candidateId !== "string" ||
    !GOLDEN_DEMO_CANDIDATE_IDS.includes(result.candidateId as GoldenDemoCandidateId)
  ) {
    throw new Error("Golden Demo fixture RPC returned an unsupported candidate ID.");
  }
  if (expectedCandidateId && result.candidateId !== expectedCandidateId) {
    throw new Error(
      `Golden Demo fixture RPC returned ${String(result.candidateId)}; expected ${expectedCandidateId}.`,
    );
  }
  if (typeof result.participantCreated !== "boolean") {
    throw new Error("Golden Demo fixture RPC returned an invalid participantCreated flag.");
  }
  const attemptIds = result.attemptIds as Record<string, unknown> | null;
  if (!attemptIds || typeof attemptIds !== "object" || Array.isArray(attemptIds)) {
    throw new Error("Golden Demo fixture RPC returned invalid attempt IDs.");
  }
  const normalizedAttemptIds = Object.fromEntries(
    GOLDEN_DEMO_TEST_SLUGS.map((slug) => [slug, asNonEmptyString(attemptIds[slug], `attemptIds.${slug}`)]),
  ) as GoldenDemoFixtureRpcResult["attemptIds"];
  const counts = result.counts as Record<string, unknown> | null;
  const expectedCounts = {
    participants: 1,
    assignments: 1,
    attempts: 3,
    assignmentAttemptLinks: 3,
    responses: 184,
    ipipResponses: 120,
    safranResponses: 45,
    mwmsResponses: 19,
    dimensionScores: 0,
    attemptReports: 0,
    assessmentReports: 0,
  } as const;
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
    throw new Error("Golden Demo fixture RPC returned invalid counts.");
  }
  for (const [key, expected] of Object.entries(expectedCounts)) {
    if (counts[key] !== expected) {
      throw new Error(
        `Golden Demo fixture RPC returned ${key}=${String(counts[key])}; expected ${expected}.`,
      );
    }
  }
  if (result.scoringExecution !== false || result.reportGeneration !== false) {
    throw new Error("Golden Demo fixture RPC must not execute scoring or report generation.");
  }
  return {
    rpcVersion: GOLDEN_DEMO_FIXTURE_RPC,
    stateBefore: "EMPTY",
    stateAfter: "CREATED",
    candidateId: result.candidateId as GoldenDemoCandidateId,
    participantCreated: result.participantCreated,
    organizationId: asNonEmptyString(result.organizationId, "organizationId"),
    participantId: asNonEmptyString(result.participantId, "participantId"),
    assignmentId: asNonEmptyString(result.assignmentId, "assignmentId"),
    attemptIds: normalizedAttemptIds,
    counts: expectedCounts,
    scoringExecution: false,
    reportGeneration: false,
  };
}

export function buildResolvedResponseInserts(
  responses: ResolvedFixtureResponse[],
): ResponseInsert[] {
  return responses.map((response) => {
    if (response.responseKind === "single_choice") {
      if (!response.answerOptionId || response.textValue !== null) {
        throw new Error(`Invalid resolved single-choice response for ${response.questionCode}.`);
      }
      return {
        attempt_id: response.attemptId,
        question_id: response.questionId,
        response_kind: "single_choice",
        answer_option_id: response.answerOptionId,
      };
    }
    if (response.answerOptionId !== null || response.textValue === null) {
      throw new Error(`Invalid resolved text response for ${response.questionCode}.`);
    }
    return {
      attempt_id: response.attemptId,
      question_id: response.questionId,
      response_kind: "text",
      text_value: response.textValue,
    };
  });
}

export function compareActualToExpectedResponse(
  actual: ActualFixtureResponse,
  expected: ResolvedFixtureResponse,
): boolean {
  return (
    actual.attempt_id === expected.attemptId &&
    actual.question_id === expected.questionId &&
    actual.response_kind === expected.responseKind &&
    actual.answer_option_id === expected.answerOptionId &&
    actual.text_value === expected.textValue &&
    actual.raw_value === null &&
    actual.scored_value === null
  );
}

function expectedResponseIdentity(response: ResolvedFixtureResponse): string {
  return `${response.attemptId}\u0000${response.questionId}`;
}

function actualResponseIdentity(response: ActualFixtureResponse): string {
  return `${response.attempt_id}\u0000${response.question_id}`;
}

export function classifyGd001FixtureState(input: {
  snapshot: Gd001DbSnapshot;
  expectedResponses: ResolvedFixtureResponse[];
  candidate: ReturnType<typeof getGd001CandidateContract>;
  testIdsBySlug: Record<string, string>;
}): Gd001StateClassification {
  const { snapshot, expectedResponses, candidate, testIdsBySlug } = input;
  const conflictReasons = [...snapshot.participantConflictReasons];
  const partialReasons: string[] = [];
  const responseCountsByTest = Object.fromEntries(
    GD_001_TEST_SLUGS.map((slug) => [
      slug,
      snapshot.responses.filter((response) =>
        snapshot.attempts.some(
          (attempt) => attempt.id === response.attempt_id && attempt.test_slug === slug,
        ),
      ).length,
    ]),
  );

  if (!snapshot.participant) {
    const dependentCount =
      snapshot.assignments.length + snapshot.attempts.length + snapshot.responses.length;
    if (dependentCount > 0) {
      conflictReasons.push("Dependent fixture rows exist without the resolved participant.");
    }
    return {
      state: conflictReasons.length > 0 ? "CONFLICT" : "EMPTY",
      reasons: conflictReasons,
      responseCountsByTest,
    };
  }

  const participant = snapshot.participant;
  if (participant.organization_id !== snapshot.organizationId) conflictReasons.push("Participant organization differs.");
  if (normalizeEmail(participant.email) !== candidate.email) conflictReasons.push("Participant email differs.");
  if (normalizeIdentityText(participant.full_name) !== normalizeIdentityText(candidate.fullName)) conflictReasons.push("Participant name differs.");
  if (participant.participant_type !== "employee") conflictReasons.push("Participant type differs.");
  if (participant.status !== "active") conflictReasons.push("Participant lifecycle status is not active.");
  if (participant.user_id !== null) conflictReasons.push("Participant has a linked auth user requiring operator review.");
  const addressingFormMatches =
    participant.addressing_form === candidate.addressingForm ||
    (LEGACY_NULL_ADDRESSING_CANDIDATE_IDS.includes(candidate.candidateId) &&
      participant.addressing_form === null);
  if (!addressingFormMatches) conflictReasons.push("Participant addressing form differs.");

  const hasStandardBatteryState =
    snapshot.assignments.length > 0 ||
    snapshot.attempts.length > 0 ||
    snapshot.links.length > 0 ||
    snapshot.responses.length > 0 ||
    snapshot.dimensionScoreCount > 0 ||
    snapshot.attemptReportCount > 0 ||
    snapshot.assessmentReportCount > 0;
  if (!hasStandardBatteryState && conflictReasons.length === 0) {
    return {
      state: "EMPTY",
      reasons: [],
      responseCountsByTest,
    };
  }

  if (snapshot.assignments.length > 1) conflictReasons.push("Multiple assessment assignments exist.");
  const assignment = snapshot.assignments[0];
  if (!assignment) {
    partialReasons.push("Participant exists but standard battery assignment is missing.");
  } else {
    if (
      assignment.organization_id !== snapshot.organizationId ||
      assignment.participant_id !== participant.id ||
      assignment.assignment_type !== "standard_battery" ||
      assignment.status !== "active" ||
      assignment.locale !== "bs" ||
      assignment.completed_at !== null
    ) {
      conflictReasons.push("Assignment differs from the active standard_battery contract.");
    }
  }

  const attemptsBySlug = new Map<string, Gd001AttemptSnapshot[]>();
  for (const attempt of snapshot.attempts) {
    attemptsBySlug.set(attempt.test_slug, [...(attemptsBySlug.get(attempt.test_slug) ?? []), attempt]);
  }
  for (const slug of GD_001_TEST_SLUGS) {
    const attempts = attemptsBySlug.get(slug) ?? [];
    if (attempts.length === 0) {
      partialReasons.push(`Missing attempt for ${slug}.`);
      continue;
    }
    if (attempts.length > 1) {
      conflictReasons.push(`Multiple attempts exist for ${slug}.`);
      continue;
    }
    const attempt = attempts[0];
    if (
      attempt.test_id !== testIdsBySlug[slug] ||
      attempt.organization_id !== snapshot.organizationId ||
      attempt.participant_id !== participant.id ||
      attempt.user_id !== null ||
      attempt.status !== "in_progress" ||
      attempt.completed_at !== null ||
      attempt.scored_started_at !== null ||
      attempt.locale !== "bs" ||
      attempt.addressing_form_snapshot !== candidate.addressingForm
    ) {
      conflictReasons.push(`Attempt for ${slug} differs or has entered scoring/lifecycle processing.`);
    }
  }
  if (snapshot.attempts.some((attempt) => !GD_001_TEST_SLUGS.includes(attempt.test_slug as never))) {
    conflictReasons.push("Additional non-battery attempt exists for the fixture participant.");
  }

  if (assignment) {
    if (snapshot.links.length < 3) partialReasons.push("One or more assignment-attempt links are missing.");
    if (snapshot.links.length > 3) conflictReasons.push("Additional assignment-attempt links exist.");
    for (const slug of GD_001_TEST_SLUGS) {
      const attempt = (attemptsBySlug.get(slug) ?? [])[0];
      const links = snapshot.links.filter((link) => link.test_slug === slug);
      if (links.length === 0) continue;
      if (
        links.length !== 1 ||
        !attempt ||
        links[0].assessment_assignment_id !== assignment.id ||
        links[0].attempt_id !== attempt.id ||
        links[0].test_id !== testIdsBySlug[slug] ||
        links[0].role_in_assignment !== "standard_component" ||
        links[0].required_for_composite !== true ||
        links[0].required_for_team_fit !== false ||
        links[0].position !== GD_001_TEST_SLUGS.indexOf(slug)
      ) {
        conflictReasons.push(`Assignment-attempt link differs for ${slug}.`);
      }
    }
  }

  if (snapshot.dimensionScoreCount > 0) conflictReasons.push("Dimension scores already exist.");
  if (snapshot.attemptReportCount > 0) conflictReasons.push("Attempt reports already exist.");
  if (snapshot.assessmentReportCount > 0) conflictReasons.push("Assessment reports already exist.");

  const expectedByIdentity = new Map(expectedResponses.map((response) => [expectedResponseIdentity(response), response]));
  const actualByIdentity = new Map<string, ActualFixtureResponse>();
  for (const actual of snapshot.responses) {
    const identity = actualResponseIdentity(actual);
    if (actualByIdentity.has(identity)) conflictReasons.push("Duplicate response identity exists.");
    actualByIdentity.set(identity, actual);
    const expected = expectedByIdentity.get(identity);
    if (!expected) conflictReasons.push("Additional response exists.");
    else if (!compareActualToExpectedResponse(actual, expected)) conflictReasons.push("Existing response differs from the fixture contract.");
  }
  for (const identity of expectedByIdentity.keys()) {
    if (!actualByIdentity.has(identity)) partialReasons.push("One or more expected responses are missing.");
  }

  if (conflictReasons.length > 0) return { state: "CONFLICT", reasons: [...new Set(conflictReasons)], responseCountsByTest };
  if (partialReasons.length > 0) return { state: "PARTIAL", reasons: [...new Set(partialReasons)], responseCountsByTest };
  return { state: "EXACT_MATCH", reasons: [], responseCountsByTest };
}

export function buildGd001DryRunPlan(input: {
  classification: Gd001StateClassification;
  organizationId: string;
  participantId: string | null;
  assignmentId: string | null;
  attemptIdsBySlug: Record<string, string | null>;
  resolvedResponseCount: number;
  candidateId?: GoldenDemoCandidateId;
}) {
  const create = input.classification.state === "EMPTY";
  const noop = input.classification.state === "EXACT_MATCH";
  const candidateId = input.candidateId ?? GD_001_CANDIDATE_ID;
  const participantExists = input.participantId !== null;
  const expectedByTest = { ...GOLDEN_DEMO_EXPECTED_RESPONSE_COUNTS };
  const expectedTotal = Object.values(expectedByTest).reduce((sum, count) => sum + count, 0);
  return {
    mode: "dry-run" as const,
    candidateId,
    organization: { matched: true, id: input.organizationId },
    state: input.classification.state,
    blockers: input.classification.reasons,
    participant: {
      action: participantExists ? "reuse" : create ? "create" : noop ? "reuse" : "blocked",
      id: input.participantId,
    },
    assignment: { action: create ? "create" : noop ? "reuse" : "blocked", id: input.assignmentId },
    attempts: Object.fromEntries(
      GOLDEN_DEMO_TEST_SLUGS.map((slug) => [slug, create ? "create" : noop ? "reuse" : "blocked"]),
    ),
    attemptIds: input.attemptIdsBySlug,
    responses: {
      expected: expectedTotal,
      resolved: input.resolvedResponseCount,
      insert: create ? expectedTotal : 0,
      existingByTest: input.classification.responseCountsByTest,
    },
    scoringExecution: false,
    reportGeneration: false,
    writesPerformed: false,
  };
}

export async function inspectGd001FixtureWithRepository(
  repository: Gd001FixtureRepository,
) {
  const resolved = await repository.inspect();
  const classification = classifyGd001FixtureState(resolved);
  const assignment = resolved.snapshot.assignments[0] ?? null;
  const attemptIdsBySlug = Object.fromEntries(
    GD_001_TEST_SLUGS.map((slug) => [
      slug,
      resolved.snapshot.attempts.find((attempt) => attempt.test_slug === slug)?.id ?? null,
    ]),
  );
  return buildGd001DryRunPlan({
    classification,
    organizationId: resolved.snapshot.organizationId,
    participantId: resolved.snapshot.participant?.id ?? null,
    assignmentId: assignment?.id ?? null,
    attemptIdsBySlug,
    resolvedResponseCount: resolved.expectedResponses.length,
    candidateId: resolved.candidate.candidateId,
  });
}

export function buildGd001ExactMatchApplyNoop(
  plan: Awaited<ReturnType<typeof inspectGd001FixtureWithRepository>>,
) {
  if (plan.state !== "EXACT_MATCH") {
    throw new Error(`Apply no-op requires EXACT_MATCH; received ${plan.state}.`);
  }
  return {
    mode: "apply" as const,
    stateBefore: "EXACT_MATCH" as const,
    stateAfter: "EXACT_MATCH" as const,
    participantId: plan.participant.id,
    assignmentId: plan.assignment.id,
    attemptIds: plan.attemptIds,
    responseCounts: plan.responses.existingByTest,
    writesPerformed: false,
    scoringExecution: false,
    reportGeneration: false,
  };
}

export function buildGd001CreatedApplyResult(input: {
  rpcResult: Gd001FixtureRpcResult;
  postWritePlan: Awaited<ReturnType<typeof inspectGd001FixtureWithRepository>>;
}) {
  if (input.postWritePlan.state !== "EXACT_MATCH") {
    throw new Error(
      `GD-001 RPC write requires post-write EXACT_MATCH; received ${input.postWritePlan.state}: ${input.postWritePlan.blockers.join("; ")}`,
    );
  }
  const identityMismatches = [
    ["organizationId", input.rpcResult.organizationId, input.postWritePlan.organization.id],
    ["participantId", input.rpcResult.participantId, input.postWritePlan.participant.id],
    ["assignmentId", input.rpcResult.assignmentId, input.postWritePlan.assignment.id],
    ...GD_001_TEST_SLUGS.map((slug) => [
      `attemptIds.${slug}`,
      input.rpcResult.attemptIds[slug],
      input.postWritePlan.attemptIds[slug],
    ]),
  ].filter(([, rpcValue, inspectedValue]) => rpcValue !== inspectedValue);
  if (identityMismatches.length > 0) {
    throw new Error(
      `GD-001 RPC result IDs do not match the read-only post-write state: ${identityMismatches
        .map(([field]) => field)
        .join(", ")}.`,
    );
  }
  return {
    mode: "apply" as const,
    candidateId: GD_001_CANDIDATE_ID,
    stateBefore: "EMPTY" as const,
    stateAfter: "EXACT_MATCH" as const,
    rpc: GD_001_FIXTURE_RPC,
    participantId: input.rpcResult.participantId,
    assignmentId: input.rpcResult.assignmentId,
    attemptIds: input.rpcResult.attemptIds,
    responseCounts: {
      ...input.postWritePlan.responses.existingByTest,
      total: 184,
    },
    writesPerformed: true,
    scoringExecution: false,
    reportGeneration: false,
  };
}

export type Gd001ApplyBoundary = {
  initialPlan: Awaited<ReturnType<typeof inspectGd001FixtureWithRepository>>;
  payload: Gd001FixtureRpcPayload;
  invokeRpc: (input: {
    rpcName: typeof GD_001_FIXTURE_RPC;
    payload: Gd001FixtureRpcPayload;
  }) => Promise<unknown>;
  inspectAfterRpc: () => Promise<Awaited<ReturnType<typeof inspectGd001FixtureWithRepository>>>;
};

export async function executeGd001ApplyWithRpcBoundary(input: Gd001ApplyBoundary) {
  if (input.initialPlan.state === "EXACT_MATCH") {
    return buildGd001ExactMatchApplyNoop(input.initialPlan);
  }
  if (input.initialPlan.state !== "EMPTY") {
    throw new Error(
      `Apply is blocked because fixture state is ${input.initialPlan.state}: ${input.initialPlan.blockers.join("; ")}`,
    );
  }

  try {
    const rawRpcResult = await input.invokeRpc({
      rpcName: GD_001_FIXTURE_RPC,
      payload: input.payload,
    });
    const rpcResult = validateGd001FixtureRpcResult(rawRpcResult);
    const postWritePlan = await input.inspectAfterRpc();
    return buildGd001CreatedApplyResult({ rpcResult, postWritePlan });
  } catch (error) {
    if (!isGd001RpcNotEmptyError(error)) {
      throw error;
    }
    const postRacePlan = await input.inspectAfterRpc();
    if (postRacePlan.state === "EXACT_MATCH") {
      return buildGd001ExactMatchApplyNoop(postRacePlan);
    }
    throw new Error(
      `GD-001 RPC reported ${GD_001_RPC_NOT_EMPTY_PREFIX}; read-only recheck found ${postRacePlan.state}: ${postRacePlan.blockers.join("; ")}`,
    );
  }
}

export type GoldenDemoApplyBoundary = {
  candidateId: GoldenDemoCandidateId;
  initialPlan: Awaited<ReturnType<typeof inspectGd001FixtureWithRepository>>;
  payload: Gd001FixtureRpcPayload;
  invokeRpc: (input: {
    rpcName: typeof GOLDEN_DEMO_FIXTURE_RPC;
    payload: Gd001FixtureRpcPayload;
  }) => Promise<unknown>;
  inspectAfterRpc: () => Promise<Awaited<ReturnType<typeof inspectGd001FixtureWithRepository>>>;
};

export async function executeGoldenDemoApplyWithRpcBoundary(input: GoldenDemoApplyBoundary) {
  if (input.initialPlan.state === "EXACT_MATCH") {
    return {
      mode: "apply" as const,
      candidateId: input.candidateId,
      stateBefore: "EXACT_MATCH" as const,
      stateAfter: "EXACT_MATCH" as const,
      participantId: input.initialPlan.participant.id,
      assignmentId: input.initialPlan.assignment.id,
      attemptIds: input.initialPlan.attemptIds,
      responseCounts: input.initialPlan.responses.existingByTest,
      writesPerformed: false,
      scoringExecution: false,
      reportGeneration: false,
    };
  }
  if (input.initialPlan.state !== "EMPTY") {
    throw new Error(
      `Apply is blocked because fixture state is ${input.initialPlan.state}: ${input.initialPlan.blockers.join("; ")}`,
    );
  }

  try {
    const rawRpcResult = await input.invokeRpc({
      rpcName: GOLDEN_DEMO_FIXTURE_RPC,
      payload: input.payload,
    });
    const rpcResult = validateGoldenDemoFixtureRpcResult(rawRpcResult, input.candidateId);
    const postWritePlan = await input.inspectAfterRpc();
    if (postWritePlan.state !== "EXACT_MATCH") {
      throw new Error(
        `Golden Demo RPC write requires post-write EXACT_MATCH; received ${postWritePlan.state}: ${postWritePlan.blockers.join("; ")}`,
      );
    }
    const identityMismatches = [
      ["organizationId", rpcResult.organizationId, postWritePlan.organization.id],
      ["participantId", rpcResult.participantId, postWritePlan.participant.id],
      ["assignmentId", rpcResult.assignmentId, postWritePlan.assignment.id],
      ...GOLDEN_DEMO_TEST_SLUGS.map((slug) => [
        `attemptIds.${slug}`,
        rpcResult.attemptIds[slug],
        postWritePlan.attemptIds[slug],
      ]),
    ].filter(([, rpcValue, inspectedValue]) => rpcValue !== inspectedValue);
    if (identityMismatches.length > 0) {
      throw new Error(
        `Golden Demo RPC result IDs do not match the read-only post-write state: ${identityMismatches
          .map(([field]) => field)
          .join(", ")}.`,
      );
    }
    return {
      mode: "apply" as const,
      candidateId: input.candidateId,
      stateBefore: "EMPTY" as const,
      stateAfter: "EXACT_MATCH" as const,
      rpc: GOLDEN_DEMO_FIXTURE_RPC,
      participantCreated: rpcResult.participantCreated,
      participantId: rpcResult.participantId,
      assignmentId: rpcResult.assignmentId,
      attemptIds: rpcResult.attemptIds,
      responseCounts: {
        ...postWritePlan.responses.existingByTest,
        total: 184,
      },
      writesPerformed: true,
      scoringExecution: false,
      reportGeneration: false,
    };
  } catch (error) {
    if (!isGd001RpcNotEmptyError(error)) throw error;
    const postRacePlan = await input.inspectAfterRpc();
    if (postRacePlan.state === "EXACT_MATCH") {
      return {
        mode: "apply" as const,
        candidateId: input.candidateId,
        stateBefore: "EXACT_MATCH" as const,
        stateAfter: "EXACT_MATCH" as const,
        participantId: postRacePlan.participant.id,
        assignmentId: postRacePlan.assignment.id,
        attemptIds: postRacePlan.attemptIds,
        responseCounts: postRacePlan.responses.existingByTest,
        writesPerformed: false,
        scoringExecution: false,
        reportGeneration: false,
      };
    }
    throw new Error(
      `Golden Demo RPC reported ${GD_001_RPC_NOT_EMPTY_PREFIX}; read-only recheck found ${postRacePlan.state}: ${postRacePlan.blockers.join("; ")}`,
    );
  }
}

export function verifyGd001FinalCounts(counts: {
  participant: number;
  assignment: number;
  attempts: number;
  responses: number;
  dimension_scores: number;
  attempt_reports: number;
  assessment_reports: number;
}): { ok: boolean; errors: string[] } {
  const expected = {
    participant: 1,
    assignment: 1,
    attempts: 3,
    responses: 184,
    dimension_scores: 0,
    attempt_reports: 0,
    assessment_reports: 0,
  };
  const errors = Object.entries(expected).flatMap(([key, value]) =>
    counts[key as keyof typeof counts] === value
      ? []
      : [`Expected ${key}=${value}, received ${counts[key as keyof typeof counts]}.`],
  );
  return { ok: errors.length === 0, errors };
}
