import fs from "node:fs";
import path from "node:path";

import {
  classifyGdt01DbState,
  type Gdt01DbContract,
  type Gdt01InspectionResult,
  type Gdt01ObservedState,
} from "./team-dynamics-gdt-01-db-contract";
import {
  createGdt01SupabaseReadRepository,
  type Gdt01SupabaseReadClient,
} from "./team-dynamics-gdt-01-db-inspector";
import {
  GDT_01_COUNTS,
  GDT_01_EXPECTED_MEMBER_IDS,
  GDT_01_PACKAGE_SLUG,
  GDT_01_RUNTIME_CHECKSUM,
  GDT_01_TEAM_ID,
  GDT_01_TEAM_NAME,
  loadGdt01DbContract,
} from "./team-dynamics-gdt-01-db-contract";
import {
  loadTeamDynamicsMixedScoreForContext,
  type TeamDynamicsMixedScoreResult,
} from "@/lib/assessment/team-dynamics-mixed-scoring";
import {
  markTeamAssessmentExecutionStartedIfInvited,
  transitionTeamAssessmentExecutionToCompleted,
  type TeamAssessmentExecutionCompletionTransitionResult,
  type TeamAssessmentExecutionContext,
  type TeamAssessmentExecutionStartTransitionResult,
} from "@/lib/assessment/team-assessment-execution";
import {
  persistTeamDynamicsMixedScoreForContext,
  TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
  type TeamDynamicsMixedScorePersistenceResult,
} from "@/lib/assessment/team-dynamics-mixed-score-persistence";

export const GDT_01_MEMBER_SCORING_CONFIRMATION = "GDT_01_MEMBER_SCORING" as const;

export type Gdt01MemberScoringState =
  | "UNSCORED_EXACT"
  | "SCORED_EXACT"
  | "PARTIAL_EXACT_RESUMABLE"
  | "PARTIAL"
  | "CONFLICT";

export type Gdt01ScoringCliOptions = {
  apply: boolean;
  json: boolean;
  verbose: boolean;
  confirmation: string | null;
};

export type Gdt01ExpectedMemberScore = {
  candidate_id: string;
  score: TeamDynamicsMixedScoreResult;
};

export type Gdt01ScoringMemberTarget = {
  candidateId: string;
  participantId: string | null;
  wrapperId: string | null;
  attemptId: string | null;
  context: TeamAssessmentExecutionContext | null;
};

export type Gdt01ScoringScoreRow = {
  id: string;
  team_assessment_participant_id: string;
  attempt_id: string;
  scoring_version: string;
  scoring_status: string;
  raw_total: number | null;
  mean_raw: number | null;
  score_0_100: number | null;
  score_snapshot: unknown;
  source_response_count: number | null;
  source_completed_at: string | null;
  calculated_at: string | null;
};

export type Gdt01ScoringAttemptLifecycle = {
  id: string;
  status: string;
  completed_at: string | null;
  scored_started_at: string | null;
};

export type Gdt01ScoringSnapshot = {
  inspection: Gdt01InspectionResult;
  observed: Gdt01ObservedState;
  members: Gdt01ScoringMemberTarget[];
  scoreRows: Gdt01ScoringScoreRow[];
  attemptLifecycle: Gdt01ScoringAttemptLifecycle[];
};

export type Gdt01MemberScorePreview = {
  candidateId: string;
  status: TeamDynamicsMixedScoreResult["status"] | "blocked";
  score: TeamDynamicsMixedScoreResult | null;
  expectedMatch: boolean;
  errors: string[];
};

export type Gdt01MemberScoreVerification = {
  state: "EXACT_MATCH" | "MISMATCH";
  membersVerified: number;
  scoreEntriesVerified: number;
  mismatches: string[];
};

export type Gdt01ScoringClassification = {
  state: Gdt01MemberScoringState;
  blockers: string[];
  memberScoreVerification: Gdt01MemberScoreVerification;
  existingExactMemberIds: string[];
  resumableMemberIds: string[];
};

export type Gdt01ScoringPlan = {
  stateBefore: Gdt01MemberScoringState;
  scoringVersion: typeof TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION;
  targetMemberIds: readonly string[];
  skipMemberIds: readonly string[];
  expectedMemberScoreRows: number;
  expectedScoreEntries: number;
  lifecycleTransitions: string[];
  applyAllowed: boolean;
  noOpEligible: boolean;
  reasonCode: string;
  reason: string;
  databaseWrites: boolean;
  aggregationCalls: boolean;
  reportCalls: boolean;
  openAiCalls: boolean;
};

type ReadClient = Gdt01SupabaseReadClient & {
  from(table: string): any;
};

type ScoreMember = (input: {
  context: TeamAssessmentExecutionContext;
}) => Promise<TeamDynamicsMixedScoreResult>;

type MarkStarted = (input: {
  teamAssessmentParticipantId: string;
}) => Promise<TeamAssessmentExecutionStartTransitionResult>;

type TransitionCompleted = (input: {
  context: TeamAssessmentExecutionContext;
}) => Promise<TeamAssessmentExecutionCompletionTransitionResult>;

type PersistMemberScore = (input: {
  context: TeamAssessmentExecutionContext;
  scoringVersion: typeof TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION;
}) => Promise<TeamDynamicsMixedScorePersistenceResult>;

type Gdt01ScoringDependencies = {
  scoreMember?: ScoreMember;
  markStarted?: MarkStarted;
  transitionCompleted?: TransitionCompleted;
  persistMemberScore?: PersistMemberScore;
};

const ALLOWED_FLAGS = new Set(["--apply", "--confirm", "--json", "--verbose"]);
const EXPECTED_SCORED_INSPECTION_FINDINGS = new Set([
  "wrapper_lifecycle_mismatch",
  "attempt_lifecycle_mismatch",
  "seed_score_artifact",
]);

async function selectRows<T>(
  supabase: ReadClient,
  table: string,
  columns: string,
  configure?: (query: any) => any,
): Promise<T[]> {
  let query = supabase.from(table).select(columns);
  if (configure) query = configure(query);
  const result = await query as { data: T[] | null; error: { message: string } | null };
  if (result.error) throw new Error(`Failed to read ${table}: ${result.error.message}`);
  return result.data ?? [];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalizeJson(value[key])]),
    );
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value));
}

function expectedScoreFor(
  expectedScores: Gdt01ExpectedMemberScore[],
  candidateId: string,
): Gdt01ExpectedMemberScore | null {
  return expectedScores.find((member) => member.candidate_id === candidateId) ?? null;
}

function compareScore(
  candidateId: string,
  actual: unknown,
  expectedScores: Gdt01ExpectedMemberScore[],
): string[] {
  const expected = expectedScoreFor(expectedScores, candidateId);
  if (!expected) return [`Missing expected score fixture for ${candidateId}.`];
  if (stableJson(actual) !== stableJson(expected.score)) {
    return [`Score mismatch for ${candidateId} against the locked GDT-01 expected score fixture.`];
  }
  return [];
}

function buildScoreVerification(
  rows: Array<{ candidateId: string; score: unknown }>,
  expectedScores: Gdt01ExpectedMemberScore[],
): Gdt01MemberScoreVerification {
  const mismatches: string[] = [];
  let scoreEntriesVerified = 0;
  for (const row of rows) {
    const errors = compareScore(row.candidateId, row.score, expectedScores);
    mismatches.push(...errors);
    if (errors.length === 0 && isRecord(row.score) && Array.isArray(row.score.scoreEntries)) {
      scoreEntriesVerified += row.score.scoreEntries.length;
    }
  }
  return {
    state: mismatches.length === 0 && rows.length === GDT_01_EXPECTED_MEMBER_IDS.length ? "EXACT_MATCH" : "MISMATCH",
    membersVerified: mismatches.length === 0 ? rows.length : 0,
    scoreEntriesVerified,
    mismatches,
  };
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseGdt01MemberScoringCli(args: string[]): Gdt01ScoringCliOptions {
  const seen = new Set<string>();
  let apply = false;
  let json = false;
  let verbose = false;
  let confirmation: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!ALLOWED_FLAGS.has(argument)) throw new Error(`${argument} is not supported.`);
    if (seen.has(argument)) throw new Error(`${argument} may be supplied only once.`);
    seen.add(argument);

    if (argument === "--apply") apply = true;
    if (argument === "--json") json = true;
    if (argument === "--verbose") verbose = true;
    if (argument === "--confirm") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--confirm requires a non-empty confirmation value.");
      confirmation = value;
      index += 1;
    }
  }

  if (apply && confirmation !== GDT_01_MEMBER_SCORING_CONFIRMATION) {
    throw new Error(`--apply requires --confirm ${GDT_01_MEMBER_SCORING_CONFIRMATION}; no scoring write was attempted.`);
  }
  if (!apply && confirmation !== null) {
    throw new Error("--confirm is valid only with --apply; no scoring write was attempted.");
  }

  return { apply, json, verbose, confirmation };
}

export function loadGdt01ExpectedMemberScores(projectRoot: string): Gdt01ExpectedMemberScore[] {
  const filePath = path.join(
    projectRoot,
    "fixtures/golden-demo/partner-plus/v1/team-dynamics-gdt-01-expected-member-scores.json",
  );
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    schema_version?: unknown;
    team_id?: unknown;
    contract_checksum?: unknown;
    members?: unknown;
  };
  if (
    parsed.schema_version !== "gdt_01_team_dynamics_expected_v1" ||
    parsed.team_id !== GDT_01_TEAM_ID ||
    parsed.contract_checksum !== GDT_01_RUNTIME_CHECKSUM ||
    !Array.isArray(parsed.members)
  ) {
    throw new Error("Locked GDT-01 expected member score fixture is invalid.");
  }
  return parsed.members as Gdt01ExpectedMemberScore[];
}

function buildMemberTargets(
  contract: Gdt01DbContract,
  observed: Gdt01ObservedState,
): Gdt01ScoringMemberTarget[] {
  const team = observed.teams.find((row) => row.name === GDT_01_TEAM_NAME) ?? null;
  const assignment = observed.assignments.find(
    (row) => row.teamId === team?.id && row.packageSlug === GDT_01_PACKAGE_SLUG,
  ) ?? null;
  const participantsByEmail = new Map(observed.participants.map((row) => [row.email.trim().toLowerCase(), row]));
  const wrappers = observed.wrappers.filter((row) => row.assignmentId === assignment?.id);
  const attemptsById = new Map(observed.attempts.map((row) => [row.id, row]));
  const runtimeTest = observed.runtime?.test;

  return contract.members.map((member) => {
    const participant = participantsByEmail.get(member.email.trim().toLowerCase()) ?? null;
    const wrapper = wrappers.find((row) => row.participantId === participant?.id) ?? null;
    const attempt = wrapper?.attemptId ? attemptsById.get(wrapper.attemptId) ?? null : null;
    const context = participant && wrapper && attempt && runtimeTest
      ? {
          teamAssessmentParticipantId: wrapper.id,
          teamAssessmentAssignmentId: wrapper.assignmentId,
          teamMembershipId: wrapper.membershipId,
          participantId: participant.id,
          attemptId: attempt.id,
          teamId: team?.id ?? "",
          organizationId: participant.organizationId,
          packageSlug: assignment?.packageSlug ?? GDT_01_PACKAGE_SLUG,
          wrapperStatus: wrapper.status as TeamAssessmentExecutionContext["wrapperStatus"],
          attemptStatus: attempt.status as TeamAssessmentExecutionContext["attemptStatus"],
          locale: (attempt.locale ?? "bs") as TeamAssessmentExecutionContext["locale"],
          test: {
            id: runtimeTest.id,
            slug: runtimeTest.slug,
            name: "Team Dynamics",
            status: runtimeTest.status as TeamAssessmentExecutionContext["test"]["status"],
            isActive: runtimeTest.isActive,
          },
        }
      : null;
    return {
      candidateId: member.candidateId,
      participantId: participant?.id ?? null,
      wrapperId: wrapper?.id ?? null,
      attemptId: attempt?.id ?? null,
      context,
    };
  });
}

export async function readGdt01ScoringSnapshot(input: {
  supabase: ReadClient;
  projectRoot: string;
}): Promise<Gdt01ScoringSnapshot> {
  const contract = loadGdt01DbContract(input.projectRoot);
  const repository = createGdt01SupabaseReadRepository(input.supabase, contract);
  const observed = await repository.readState();
  const inspection = classifyGdt01DbState(contract, observed);
  const members = buildMemberTargets(contract, observed);
  const wrapperIds = members.map((member) => member.wrapperId).filter(isNonEmptyString);
  const attemptIds = members.map((member) => member.attemptId).filter(isNonEmptyString);
  const scoreRows = wrapperIds.length > 0
    ? await selectRows<Gdt01ScoringScoreRow>(
        input.supabase,
        "team_assessment_participant_scores",
        "id, team_assessment_participant_id, attempt_id, scoring_version, scoring_status, raw_total, mean_raw, score_0_100, score_snapshot, source_response_count, source_completed_at, calculated_at",
        (query) => query.in("team_assessment_participant_id", wrapperIds),
      )
    : [];
  const attemptLifecycle = attemptIds.length > 0
    ? await selectRows<Gdt01ScoringAttemptLifecycle>(
        input.supabase,
        "attempts",
        "id, status, completed_at, scored_started_at",
        (query) => query.in("id", attemptIds),
      )
    : [];
  return { inspection, observed, members, scoreRows, attemptLifecycle };
}

export async function previewGdt01MemberScores(input: {
  snapshot: Gdt01ScoringSnapshot;
  expectedScores: Gdt01ExpectedMemberScore[];
  scoreMember?: ScoreMember;
}): Promise<Gdt01MemberScorePreview[]> {
  const scoreMember = input.scoreMember ?? loadTeamDynamicsMixedScoreForContext;
  const previews: Gdt01MemberScorePreview[] = [];
  for (const member of input.snapshot.members) {
    if (!member.context) {
      previews.push({
        candidateId: member.candidateId,
        status: "blocked",
        score: null,
        expectedMatch: false,
        errors: [`Missing canonical execution context for ${member.candidateId}.`],
      });
      continue;
    }
    const score = await scoreMember({
      context: {
        ...member.context,
        wrapperStatus: "completed",
        attemptStatus: "completed",
      },
    });
    const errors = score.status === "scored"
      ? compareScore(member.candidateId, score, input.expectedScores)
      : [`Production scorer returned ${score.status} for ${member.candidateId}.`];
    previews.push({
      candidateId: member.candidateId,
      status: score.status,
      score,
      expectedMatch: errors.length === 0,
      errors,
    });
  }
  return previews;
}

function allCountsExact(inspection: Gdt01InspectionResult): boolean {
  return inspection.state !== "EMPTY" &&
    inspection.counts.membersExpected === GDT_01_COUNTS.members &&
    inspection.counts.wrappersObserved === GDT_01_COUNTS.members &&
    inspection.counts.attemptsObserved === GDT_01_COUNTS.members &&
    inspection.counts.responsesObserved === GDT_01_COUNTS.totalResponses &&
    inspection.counts.physicalSjtSelectionsObserved === GDT_01_COUNTS.totalPhysicalSjtSelections &&
    inspection.counts.logicalSelectionsObserved === GDT_01_COUNTS.totalLogicalSelections;
}

function hasUnexpectedInspectionFindings(inspection: Gdt01InspectionResult): string[] {
  return inspection.blockingFindings
    .filter((finding) => !EXPECTED_SCORED_INSPECTION_FINDINGS.has(finding.code))
    .map((finding) => `${finding.code}: ${finding.message}`);
}

function hasNoDownstreamArtifacts(observed: Gdt01ObservedState): boolean {
  return observed.dimensionScoreIds.length === 0 &&
    observed.aggregationIds.length === 0 &&
    observed.reportSelectionDraftIds.length === 0 &&
    observed.reportSelectionMemberIds.length === 0 &&
    observed.teamReportIds.length === 0 &&
    observed.attemptReportIds.length === 0 &&
    observed.teamFitReports.length === 0;
}

function scoreRowsHaveCanonicalIdentity(
  snapshot: Gdt01ScoringSnapshot,
): string[] {
  const errors: string[] = [];
  const wrapperIds = new Set(snapshot.members.map((member) => member.wrapperId).filter(isNonEmptyString));
  const attemptByWrapperId = new Map(snapshot.members.map((member) => [member.wrapperId, member.attemptId]));
  const seen = new Set<string>();
  for (const row of snapshot.scoreRows) {
    if (!wrapperIds.has(row.team_assessment_participant_id)) errors.push(`Score row ${row.id} targets an unexpected wrapper.`);
    const key = `${row.team_assessment_participant_id}:${row.scoring_version}`;
    if (seen.has(key)) errors.push(`Duplicate score version exists for wrapper ${row.team_assessment_participant_id}.`);
    seen.add(key);
    if (row.scoring_version !== TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION) errors.push(`Unexpected scoring version on row ${row.id}.`);
    if (row.attempt_id !== (attemptByWrapperId.get(row.team_assessment_participant_id) ?? null)) errors.push(`Score row ${row.id} points to the wrong attempt.`);
  }
  return errors;
}

function scoreRowsMatchExpected(
  snapshot: Gdt01ScoringSnapshot,
  expectedScores: Gdt01ExpectedMemberScore[],
): Gdt01MemberScoreVerification {
  const rows = snapshot.members.map((member) => {
    const rowsForMember = snapshot.scoreRows.filter((row) => row.team_assessment_participant_id === member.wrapperId);
    return { candidateId: member.candidateId, score: rowsForMember[0]?.score_snapshot ?? null };
  });
  return buildScoreVerification(rows, expectedScores);
}

function scoreRowsPresentMatchExpected(
  snapshot: Gdt01ScoringSnapshot,
  expectedScores: Gdt01ExpectedMemberScore[],
): Gdt01MemberScoreVerification {
  const rows = snapshot.members.flatMap((member) => {
    const row = snapshot.scoreRows.find((candidate) => candidate.team_assessment_participant_id === member.wrapperId);
    return row ? [{ candidateId: member.candidateId, score: row.score_snapshot }] : [];
  });
  const mismatches: string[] = [];
  let scoreEntriesVerified = 0;
  for (const row of rows) {
    const errors = compareScore(row.candidateId, row.score, expectedScores);
    mismatches.push(...errors);
    if (errors.length === 0 && isRecord(row.score) && Array.isArray(row.score.scoreEntries)) {
      scoreEntriesVerified += row.score.scoreEntries.length;
    }
  }
  return {
    state: mismatches.length === 0 ? "EXACT_MATCH" : "MISMATCH",
    membersVerified: mismatches.length === 0 ? rows.length : 0,
    scoreEntriesVerified,
    mismatches,
  };
}

export function classifyGdt01MemberScoringState(input: {
  snapshot: Gdt01ScoringSnapshot;
  expectedScores: Gdt01ExpectedMemberScore[];
  previews?: Gdt01MemberScorePreview[];
}): Gdt01ScoringClassification {
  const { snapshot } = input;
  const blockers: string[] = [];
  const unexpectedFindings = hasUnexpectedInspectionFindings(snapshot.inspection);
  const targetIds = snapshot.members.map((member) => member.candidateId);
  const canonicalMembers = stableJson(targetIds) === stableJson([...GDT_01_EXPECTED_MEMBER_IDS]);
  const completeContexts = snapshot.members.length === GDT_01_COUNTS.members && snapshot.members.every((member) => member.context && member.wrapperId && member.attemptId);
  const targetAttemptIds = new Set(snapshot.members.map((member) => member.attemptId).filter(isNonEmptyString));
  const untouchedResponses = snapshot.observed.responses
    .filter((response) => targetAttemptIds.has(response.attemptId))
    .every((response) => response.rawValue === null && response.scoredValue === null);
  const noDownstream = hasNoDownstreamArtifacts(snapshot.observed);
  const scoreIdentityErrors = scoreRowsHaveCanonicalIdentity(snapshot);
  const memberScoreVerification = scoreRowsMatchExpected(snapshot, input.expectedScores);
  const existingScoreVerification = scoreRowsPresentMatchExpected(snapshot, input.expectedScores);
  const allPreviewsExact = (input.previews ?? []).length === GDT_01_COUNTS.members && input.previews?.every((preview) => preview.status === "scored" && preview.expectedMatch) === true;

  if (unexpectedFindings.length > 0) blockers.push(...unexpectedFindings);
  if (!allCountsExact(snapshot.inspection)) blockers.push("Canonical GDT-01 persistence footprint is incomplete or missing.");
  if (!canonicalMembers || !completeContexts) blockers.push("Canonical GDT-01 member identity or execution context is incomplete.");
  if (!untouchedResponses) blockers.push("Scoring changed response raw_value or scored_value fields.");
  if (!noDownstream) blockers.push("Downstream score, aggregation, report or Team Fit artifacts exist.");
  if (scoreIdentityErrors.length > 0) blockers.push(...scoreIdentityErrors);
  if (snapshot.scoreRows.length > 0 && existingScoreVerification.state === "MISMATCH") {
    blockers.push("Persisted member score snapshots do not match the locked GDT-01 expected scores.");
  }

  const unscoredLifecycle = snapshot.members.every((member) => {
    const wrapper = snapshot.observed.wrappers.find((row) => row.id === member.wrapperId);
    const attempt = snapshot.observed.attempts.find((row) => row.id === member.attemptId);
    const lifecycle = snapshot.attemptLifecycle.find((row) => row.id === member.attemptId);
    return wrapper?.status === "invited" && wrapper.startedAt === null && wrapper.completedAt === null &&
      attempt?.status === "in_progress" && attempt.completedAt === null && lifecycle?.scored_started_at === null;
  });
  const scoredLifecycle = snapshot.members.every((member) => {
    const wrapper = snapshot.observed.wrappers.find((row) => row.id === member.wrapperId);
    const attempt = snapshot.observed.attempts.find((row) => row.id === member.attemptId);
    const lifecycle = snapshot.attemptLifecycle.find((row) => row.id === member.attemptId);
    return wrapper?.status === "completed" && isNonEmptyString(wrapper.completedAt) &&
      attempt?.status === "completed" && isNonEmptyString(attempt.completedAt) && lifecycle?.scored_started_at === null;
  });
  const existingExactMemberIds = snapshot.members
    .filter((member) => snapshot.scoreRows.some((row) => row.team_assessment_participant_id === member.wrapperId))
    .map((member) => member.candidateId);
  const resumableMemberIds = snapshot.members
    .filter((member) => !existingExactMemberIds.includes(member.candidateId))
    .map((member) => member.candidateId);
  const existingMemberLifecycleExact = snapshot.members.every((member) => {
    const hasScore = existingExactMemberIds.includes(member.candidateId);
    const wrapper = snapshot.observed.wrappers.find((row) => row.id === member.wrapperId);
    const attempt = snapshot.observed.attempts.find((row) => row.id === member.attemptId);
    const lifecycle = snapshot.attemptLifecycle.find((row) => row.id === member.attemptId);
    if (hasScore) {
      return wrapper?.status === "completed" && isNonEmptyString(wrapper.completedAt) &&
        attempt?.status === "completed" && isNonEmptyString(attempt.completedAt) && lifecycle?.scored_started_at === null;
    }
    return wrapper?.status === "invited" && wrapper.startedAt === null && wrapper.completedAt === null &&
      attempt?.status === "in_progress" && attempt.completedAt === null && lifecycle?.scored_started_at === null;
  });
  const existingRowsExact = snapshot.scoreRows.length > 0 &&
    snapshot.scoreRows.every((row) => row.scoring_status === "scored" &&
      row.source_response_count === GDT_01_COUNTS.responsesPerMember &&
      isNonEmptyString(row.source_completed_at)) &&
    existingScoreVerification.state === "EXACT_MATCH";
  const canonicalResumeMemberSet = stableJson(existingExactMemberIds) === stableJson(["GD-001"]);
  const partialExactResumable = snapshot.scoreRows.length > 0 &&
    snapshot.scoreRows.length < GDT_01_COUNTS.members &&
    canonicalResumeMemberSet &&
    existingExactMemberIds.length === snapshot.scoreRows.length &&
    existingRowsExact &&
    existingMemberLifecycleExact &&
    allPreviewsExact;

  if (blockers.length === 0 && unscoredLifecycle && snapshot.scoreRows.length === 0 && allPreviewsExact) {
    return {
      state: "UNSCORED_EXACT",
      blockers: [],
      memberScoreVerification,
      existingExactMemberIds,
      resumableMemberIds,
    };
  }

  const scoredRowsExact = snapshot.scoreRows.length === GDT_01_COUNTS.members &&
    snapshot.scoreRows.every((row) => row.scoring_status === "scored" && row.source_response_count === GDT_01_COUNTS.responsesPerMember && isNonEmptyString(row.source_completed_at)) &&
    memberScoreVerification.state === "EXACT_MATCH";
  if (blockers.length === 0 && scoredLifecycle && scoredRowsExact) {
    return {
      state: "SCORED_EXACT",
      blockers: [],
      memberScoreVerification,
      existingExactMemberIds,
      resumableMemberIds,
    };
  }

  if (blockers.length === 0 && partialExactResumable) {
    return {
      state: "PARTIAL_EXACT_RESUMABLE",
      blockers: [],
      memberScoreVerification,
      existingExactMemberIds,
      resumableMemberIds,
    };
  }

  if (
    blockers.length === 0 &&
    scoredLifecycle &&
    snapshot.scoreRows.length === GDT_01_COUNTS.members &&
    memberScoreVerification.state === "MISMATCH"
  ) {
    return {
      state: "CONFLICT",
      blockers: ["Persisted member score snapshots do not match the locked GDT-01 expected scores."],
      memberScoreVerification,
      existingExactMemberIds,
      resumableMemberIds,
    };
  }

  if (blockers.length === 0 && (snapshot.scoreRows.length > 0 || !unscoredLifecycle)) {
    return {
      state: "PARTIAL",
      blockers: input.previews && !allPreviewsExact ? ["One or more production member score previews are not exact."] : [],
      memberScoreVerification,
      existingExactMemberIds,
      resumableMemberIds,
    };
  }

  if (input.previews && !allPreviewsExact) blockers.push("One or more production member score previews are not exact.");
  return {
    state: blockers.length > 0 ? "CONFLICT" : "PARTIAL",
    blockers,
    memberScoreVerification,
    existingExactMemberIds,
    resumableMemberIds,
  };
}

export function buildGdt01ScoringPlan(input: {
  classification: Gdt01ScoringClassification;
  mode: "read-only" | "apply";
}): Gdt01ScoringPlan {
  const noOpEligible = input.classification.state === "SCORED_EXACT";
  const applyAllowed = input.mode === "apply" &&
    (input.classification.state === "UNSCORED_EXACT" || input.classification.state === "PARTIAL_EXACT_RESUMABLE");
  const targetMemberIds = input.classification.state === "UNSCORED_EXACT" ||
    input.classification.state === "PARTIAL_EXACT_RESUMABLE"
    ? input.classification.resumableMemberIds
    : [];
  return {
    stateBefore: input.classification.state,
    scoringVersion: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
    targetMemberIds,
    skipMemberIds: input.classification.existingExactMemberIds,
    expectedMemberScoreRows: GDT_01_COUNTS.members,
    expectedScoreEntries: GDT_01_COUNTS.members * 8,
    lifecycleTransitions: ["invited → started", "in_progress → completed"],
    applyAllowed,
    noOpEligible,
    reasonCode: noOpEligible
      ? "SCORED_EXACT_NOOP"
      : input.classification.state === "PARTIAL_EXACT_RESUMABLE" && applyAllowed
        ? "PARTIAL_EXACT_RESUMABLE_APPLY"
        : applyAllowed
          ? "UNSCORED_EXACT_APPLY"
          : "SCORING_BLOCKED",
    reason: noOpEligible
      ? "All six canonical GDT-01 member score snapshots already match; no write is allowed."
      : applyAllowed
        ? input.classification.state === "PARTIAL_EXACT_RESUMABLE"
          ? `Canonical existing member scores are exact; score only the remaining ${targetMemberIds.length} GDT-01 members.`
          : "Canonical GDT-01 is unscored and all six production score previews match the locked fixture."
        : "GDT-01 member scoring preconditions are not satisfied; no write is allowed.",
    databaseWrites: applyAllowed,
    aggregationCalls: false,
    reportCalls: false,
    openAiCalls: false,
  };
}

export type Gdt01ScoringApplyResult =
  | {
      ok: true;
      noOp: boolean;
      writesPerformed: false;
      memberResults: [];
      completedMemberIds: [];
      skippedMemberIds: string[];
      atomic: false;
      failure: null;
    }
  | {
      ok: boolean;
      noOp: false;
      writesPerformed: boolean;
      memberResults: Array<{ candidateId: string; mode: "inserted"; scoreStatus: string }>;
      completedMemberIds: string[];
      skippedMemberIds: string[];
      atomic: false;
      failure: string | null;
    };

export async function executeGdt01ScoringApply(input: {
  snapshot: Gdt01ScoringSnapshot;
  classification: Gdt01ScoringClassification;
  expectedScores: Gdt01ExpectedMemberScore[];
  mode: "read-only" | "apply";
  deps?: Gdt01ScoringDependencies;
}): Promise<Gdt01ScoringApplyResult> {
  if (input.classification.state === "SCORED_EXACT") {
    return {
      ok: true,
      noOp: true,
      writesPerformed: false,
      memberResults: [],
      completedMemberIds: [],
      skippedMemberIds: input.classification.existingExactMemberIds,
      atomic: false,
      failure: null,
    };
  }
  if (input.mode !== "apply" ||
    (input.classification.state !== "UNSCORED_EXACT" && input.classification.state !== "PARTIAL_EXACT_RESUMABLE")) {
    return {
      ok: false,
      noOp: false,
      writesPerformed: false,
      memberResults: [],
      completedMemberIds: [],
      skippedMemberIds: input.classification.existingExactMemberIds,
      atomic: false,
      failure: "GDT-01 member scoring is blocked by the current state or apply mode.",
    };
  }

  const scoreMember = input.deps?.scoreMember ?? loadTeamDynamicsMixedScoreForContext;
  const markStarted = input.deps?.markStarted ?? markTeamAssessmentExecutionStartedIfInvited;
  const transitionCompleted = input.deps?.transitionCompleted ?? transitionTeamAssessmentExecutionToCompleted;
  const persistMemberScore = input.deps?.persistMemberScore ?? persistTeamDynamicsMixedScoreForContext;
  const memberResults: Array<{ candidateId: string; mode: "inserted"; scoreStatus: string }> = [];
  const membersToScore = input.snapshot.members.filter((member) => input.classification.resumableMemberIds.includes(member.candidateId));
  let writesPerformed = false;

  try {
    for (const member of membersToScore) {
      if (!member.context || !member.wrapperId) throw new Error(`Missing execution target for ${member.candidateId}.`);
      const started = await markStarted({ teamAssessmentParticipantId: member.wrapperId });
      writesPerformed = writesPerformed || started.transitioned;
      if (started.status !== "started") throw new Error(`Unable to start ${member.candidateId} before scoring.`);

      const completion = await transitionCompleted({
        context: {
          ...member.context,
          wrapperStatus: "started",
          attemptStatus: "in_progress",
        },
      });
      writesPerformed = true;
      if (!completion.ok || completion.wrapperStatus !== "completed" || completion.attemptStatus !== "completed") {
        throw new Error(`Unable to complete ${member.candidateId} before scoring: ${completion.ok ? "invalid lifecycle result" : completion.reason}`);
      }

      const persisted = await persistMemberScore({
        context: {
          ...member.context,
          wrapperStatus: "completed",
          attemptStatus: "completed",
        },
        scoringVersion: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
      });
      writesPerformed = true;
      if (!persisted.ok) throw new Error(`Unable to persist ${member.candidateId}: ${persisted.code}:${persisted.reason}`);
      if (persisted.mode !== "inserted") throw new Error(`Unexpected existing score update for ${member.candidateId}; no overwrite is allowed.`);
      const scoreErrors = compareScore(member.candidateId, persisted.value.score, input.expectedScores);
      if (scoreErrors.length > 0) throw new Error(scoreErrors.join(" "));
      memberResults.push({ candidateId: member.candidateId, mode: "inserted", scoreStatus: persisted.value.scoringStatus });
    }
  } catch (error) {
    return {
      ok: false,
      noOp: false,
      writesPerformed,
      memberResults,
      completedMemberIds: memberResults.map((member) => member.candidateId),
      skippedMemberIds: input.classification.existingExactMemberIds,
      atomic: false,
      failure: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    ok: true,
    noOp: false,
    writesPerformed: true,
    memberResults,
    completedMemberIds: memberResults.map((member) => member.candidateId),
    skippedMemberIds: input.classification.existingExactMemberIds,
    atomic: false,
    failure: null,
  };
}

function summarizeScore(score: TeamDynamicsMixedScoreResult | null) {
  return score
    ? {
        status: score.status,
        rawTotal: score.rawTotal,
        meanRaw: score.meanRaw,
        score0To100: score.score0To100,
        scoreEntries: score.scoreEntries.map((entry) => ({
          scoreKey: entry.scoreKey,
          rawTotal: entry.rawTotal,
          meanRaw: entry.meanRaw,
          score0To100: entry.score0To100,
        })),
      }
    : null;
}

export async function runGdt01MemberScoringOperator(input: {
  projectRoot: string;
  supabase: ReadClient;
  cli: Gdt01ScoringCliOptions;
  deps?: Gdt01ScoringDependencies;
}) {
  const expectedScores = loadGdt01ExpectedMemberScores(input.projectRoot);
  const snapshotBefore = await readGdt01ScoringSnapshot({ supabase: input.supabase, projectRoot: input.projectRoot });
  const previews = await previewGdt01MemberScores({ snapshot: snapshotBefore, expectedScores, scoreMember: input.deps?.scoreMember });
  const classificationBefore = classifyGdt01MemberScoringState({ snapshot: snapshotBefore, expectedScores, previews });
  const plan = buildGdt01ScoringPlan({ classification: classificationBefore, mode: input.cli.apply ? "apply" : "read-only" });
  const applyExecution = input.cli.apply
    ? await executeGdt01ScoringApply({ snapshot: snapshotBefore, classification: classificationBefore, expectedScores, mode: "apply", deps: input.deps })
    : null;
  const snapshotAfter = applyExecution?.writesPerformed
    ? await readGdt01ScoringSnapshot({ supabase: input.supabase, projectRoot: input.projectRoot })
    : null;
  const classificationAfter = snapshotAfter
    ? classifyGdt01MemberScoringState({ snapshot: snapshotAfter, expectedScores })
    : null;
  const currentClassification = classificationAfter ?? classificationBefore;
  const currentSnapshot = snapshotAfter ?? snapshotBefore;
  const persistedRows = currentSnapshot.scoreRows.map((row) => ({
    id: row.id,
    wrapperId: row.team_assessment_participant_id,
    attemptId: row.attempt_id,
    scoringVersion: row.scoring_version,
    scoringStatus: row.scoring_status,
    sourceResponseCount: row.source_response_count,
    score: summarizeScore(isRecord(row.score_snapshot) ? row.score_snapshot as TeamDynamicsMixedScoreResult : null),
  }));
  return {
    target: {
      teamId: GDT_01_TEAM_ID,
      packageSlug: GDT_01_PACKAGE_SLUG,
      runtimeChecksum: GDT_01_RUNTIME_CHECKSUM,
      memberIds: GDT_01_EXPECTED_MEMBER_IDS,
    },
    state: currentClassification.state,
    scoringStateBefore: classificationBefore.state,
    scoringStateAfter: classificationAfter?.state ?? null,
    persistenceInspectionBefore: snapshotBefore.inspection,
    persistenceInspectionAfter: snapshotAfter?.inspection ?? null,
    counts: {
      wrappers: currentSnapshot.inspection.counts.wrappersObserved,
      attempts: currentSnapshot.inspection.counts.attemptsObserved,
      responses: currentSnapshot.inspection.counts.responsesObserved,
      physicalSelections: currentSnapshot.inspection.counts.physicalSjtSelectionsObserved,
      logicalSelections: currentSnapshot.inspection.counts.logicalSelectionsObserved,
      memberScoreRows: currentSnapshot.scoreRows.length,
      scoreEntries: currentClassification.memberScoreVerification.scoreEntriesVerified,
    },
    scorePreview: previews.map((preview) => ({
      candidateId: preview.candidateId,
      status: preview.status,
      expectedMatch: preview.expectedMatch,
      errors: preview.errors,
      score: summarizeScore(preview.score),
    })),
    persistedScores: persistedRows,
    memberScoreVerification: currentClassification.memberScoreVerification,
    blockingFindings: currentClassification.blockers,
    plan,
    applyRequested: input.cli.apply,
    applyExecution,
    scoreTargetMemberIds: plan.targetMemberIds,
    skippedMemberIds: applyExecution?.skippedMemberIds ?? classificationBefore.existingExactMemberIds,
    safety: {
      databaseWrites: Boolean(applyExecution?.writesPerformed),
      aggregationCalls: false,
      reportCalls: false,
      openAiCalls: false,
      rpcCalls: false,
      atomic: false,
    },
  };
}
