import type { GoldenDemoCsvFoundation } from "./csv-contract";

export const GD_001_CANDIDATE_ID = "GD-001" as const;
export const GD_001_ORGANIZATION_NAME =
  "Partner Plus d.o.o., Mikrokreditna organizacija";
export const GD_001_TEST_SLUGS = [
  "ipip-neo-120-v1",
  "safran_v1",
  "mwms_v1",
] as const;
export const GD_001_EXPECTED_RESPONSE_COUNTS = {
  "ipip-neo-120-v1": 120,
  safran_v1: 45,
  mwms_v1: 19,
} as const;
export const GD_001_TRANSACTION_BLOCKER =
  "Atomic apply is unavailable: the repository has no existing RPC that transactionally creates the participant, standard battery assignment, attempts, links, and responses. A separate reviewed migration/RPC task is required before --apply can write.";

export type Gd001WriterMode = "dry-run" | "apply";
export type Gd001FixtureState = "EMPTY" | "EXACT_MATCH" | "PARTIAL" | "CONFLICT";

export type Gd001CliOptions = {
  mode: Gd001WriterMode;
  candidateId: typeof GD_001_CANDIDATE_ID;
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
      candidateId = args[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (argument === "--verbose") {
      verbose = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (mode === "apply" && candidateId !== GD_001_CANDIDATE_ID) {
    throw new Error("--apply requires the exact confirmation --candidate GD-001.");
  }
  if (candidateId && candidateId !== GD_001_CANDIDATE_ID) {
    throw new Error(`Unsupported candidate ID: ${candidateId}. Only GD-001 is allowed.`);
  }

  return { mode, candidateId: GD_001_CANDIDATE_ID, verbose };
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeIdentityText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bs");
}

export function getGd001CandidateContract(foundation: GoldenDemoCsvFoundation) {
  const candidate = foundation.candidates.rows.find(
    (row) => row.values.candidate_id === GD_001_CANDIDATE_ID,
  );
  if (!candidate) throw new Error("Golden Demo candidates.csv is missing GD-001.");
  return {
    candidateId: GD_001_CANDIDATE_ID,
    fullName: candidate.values.display_name,
    email: normalizeEmail(candidate.values.email),
    participantType: candidate.values.participant_type,
    addressingForm: candidate.values.addressing_form,
    teamId: candidate.values.team_id,
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
  if (participant.addressing_form !== candidate.addressingForm) conflictReasons.push("Participant addressing form differs.");

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
}) {
  const create = input.classification.state === "EMPTY";
  const noop = input.classification.state === "EXACT_MATCH";
  return {
    mode: "dry-run" as const,
    candidateId: GD_001_CANDIDATE_ID,
    organization: { matched: true, id: input.organizationId },
    state: input.classification.state,
    blockers: input.classification.reasons,
    participant: { action: create ? "create" : noop ? "reuse" : "blocked", id: input.participantId },
    assignment: { action: create ? "create" : noop ? "reuse" : "blocked", id: input.assignmentId },
    attempts: Object.fromEntries(
      GD_001_TEST_SLUGS.map((slug) => [slug, create ? "create" : noop ? "reuse" : "blocked"]),
    ),
    attemptIds: input.attemptIdsBySlug,
    responses: {
      expected: 184,
      resolved: input.resolvedResponseCount,
      insert: create ? 184 : 0,
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
