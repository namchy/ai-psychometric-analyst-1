import {
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
} from "../assessment/ipip-neo-120-labels";
import { MWMS_COMPOSITE_DIMENSIONS } from "../assessment/mwms-scoring";
import type { GoldenDemoCsvFoundation } from "./csv-contract";
import {
  GD_001_CANDIDATE_ID,
  GD_001_EXPECTED_RESPONSE_COUNTS,
  GD_001_TEST_SLUGS,
  type Gd001FixtureState,
} from "./db-fixture-writer";

export type Gd001ScoringMode = "dry-run" | "apply";
export type Gd001ScoringState =
  | "UNSCORED_EXACT"
  | "SCORED_EXACT"
  | "PARTIAL"
  | "CONFLICT";
export type Gd001FixtureCompatibilityState = "EXACT_MATCH" | "PARTIAL" | "CONFLICT";

export type Gd001ScoringCliOptions = {
  mode: Gd001ScoringMode;
  candidateId: typeof GD_001_CANDIDATE_ID;
  verbose: boolean;
};

export type PersistedDimensionScore = {
  testSlug: string;
  dimension: string;
  rawScore: number;
};

export type Gd001ScoringSnapshot = {
  fixtureState: Gd001FixtureState;
  fixtureBlockers: string[];
  structuralFixtureExact: boolean;
  participantId: string | null;
  assignmentId: string | null;
  attemptIds: Record<string, string | null>;
  attempts: Array<{
    testSlug: string;
    status: string;
    completedAt: string | null;
    scoredStartedAt: string | null;
  }>;
  responseCounts: Record<string, number>;
  rawValueCounts: Record<string, number>;
  scoredValueCounts: Record<string, number>;
  dimensionScores: PersistedDimensionScore[];
  attemptReportCount: number;
  assessmentReportCount: number;
};

export type PersistedScoreVerification = {
  ok: boolean;
  matched: number;
  expected: number;
  errors: string[];
};

export type Gd001ScoringClassification = {
  fixtureWriterState: Gd001FixtureState;
  fixtureCompatibilityState: Gd001FixtureCompatibilityState;
  scoringState: Gd001ScoringState;
  /** Retained as a small compatibility alias for existing callers/tests. */
  state: Gd001ScoringState;
  blockers: string[];
};

const DESTRUCTIVE_FLAGS = new Set([
  "--delete",
  "--cleanup",
  "--reset",
  "--force",
  "--overwrite",
]);

export function parseGd001ScoringCli(args: string[]): Gd001ScoringCliOptions {
  for (const argument of args) {
    if (DESTRUCTIVE_FLAGS.has(argument)) {
      throw new Error(`${argument} is forbidden. Scoring cleanup or overwrite requires a separate operator task.`);
    }
  }

  let mode: Gd001ScoringMode = "dry-run";
  let candidateId: string | null = null;
  let verbose = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      if (mode === "apply") throw new Error("--dry-run and --apply cannot be combined.");
      mode = "dry-run";
    } else if (argument === "--apply") {
      mode = "apply";
    } else if (argument === "--candidate") {
      candidateId = args[index + 1] ?? null;
      index += 1;
    } else if (argument === "--verbose") {
      verbose = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (mode === "apply" && candidateId !== GD_001_CANDIDATE_ID) {
    throw new Error("--apply requires the exact confirmation --candidate GD-001.");
  }
  if (candidateId && candidateId !== GD_001_CANDIDATE_ID) {
    throw new Error(`Unsupported candidate ID: ${candidateId}. Only GD-001 is allowed.`);
  }
  return { mode, candidateId: GD_001_CANDIDATE_ID, verbose };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function bandFor(testSlug: string, scoreKey: string, value: number): string {
  if (testSlug === "ipip-neo-120-v1") {
    return value >= 3.67 ? "higher" : value >= 2.34 ? "balanced" : "lower";
  }
  if (testSlug === "mwms_v1") {
    return value < 3 ? "lower" : value < 5 ? "moderate" : "higher";
  }
  const threshold = scoreKey === "cognitive_composite_v1" ? [18, 36] : [6, 12];
  return value <= threshold[0] ? "lower_raw" : value <= threshold[1] ? "moderate_raw" : "higher_raw";
}

export function verifyPersistedGd001Scores(input: {
  foundation: GoldenDemoCsvFoundation;
  dimensionScores: PersistedDimensionScore[];
}): PersistedScoreVerification {
  const projected = new Map<string, { value: number; band: string }>();
  for (const score of input.dimensionScores) {
    const key = `${score.testSlug}\u0000persisted_dimension\u0000${score.dimension}`;
    projected.set(key, {
      value: score.rawScore,
      band: bandFor(
        score.testSlug,
        score.dimension,
        score.testSlug === "ipip-neo-120-v1" ? score.rawScore / 4 : score.rawScore,
      ),
    });
  }

  const ipipByDimension = new Map(
    input.dimensionScores
      .filter((score) => score.testSlug === "ipip-neo-120-v1")
      .map((score) => [score.dimension, score.rawScore]),
  );
  for (const domain of IPIP_NEO_120_DOMAIN_ORDER) {
    const facets = IPIP_NEO_120_FACETS_BY_DOMAIN[domain];
    if (!facets.every((facet) => ipipByDimension.has(facet))) continue;
    const value = round2(facets.reduce((sum, facet) => sum + (ipipByDimension.get(facet) ?? 0), 0) / 24);
    projected.set(`ipip-neo-120-v1\u0000derived_domain\u0000${domain}`, {
      value,
      band: bandFor("ipip-neo-120-v1", domain, value),
    });
  }

  const mwmsByDimension = new Map(
    input.dimensionScores
      .filter((score) => score.testSlug === "mwms_v1")
      .map((score) => [score.dimension, score.rawScore]),
  );
  for (const [composite, dimensions] of Object.entries(MWMS_COMPOSITE_DIMENSIONS)) {
    if (!dimensions.every((dimension) => mwmsByDimension.has(dimension))) continue;
    const value = round2(
      dimensions.reduce((sum, dimension) => sum + (mwmsByDimension.get(dimension) ?? 0), 0) /
        dimensions.length,
    );
    projected.set(`mwms_v1\u0000derived_composite\u0000${composite}`, {
      value,
      band: bandFor("mwms_v1", composite, value),
    });
  }

  const expectedRows = input.foundation.expectedScores.rows.filter(
    (row) => row.values.candidate_id === GD_001_CANDIDATE_ID,
  );
  const errors: string[] = [];
  let matched = 0;
  for (const row of expectedRows) {
    const value = row.values;
    const identity = `${value.test_slug}\u0000${value.score_scope}\u0000${value.score_key}`;
    const actual = projected.get(identity);
    if (!actual) {
      errors.push(`Missing persisted/derived score ${value.test_slug}/${value.score_scope}/${value.score_key}.`);
      continue;
    }
    const expected = Number(value.expected_value);
    const tolerance = Number(value.tolerance);
    if (Math.abs(actual.value - expected) > tolerance + 1e-9) {
      errors.push(`Score mismatch for ${value.test_slug}/${value.score_key}: expected ${expected} ± ${tolerance}, received ${actual.value}.`);
      continue;
    }
    if (actual.band !== value.expected_band) {
      errors.push(`Band mismatch for ${value.test_slug}/${value.score_key}: expected ${value.expected_band}, received ${actual.band}.`);
      continue;
    }
    matched += 1;
  }
  return { ok: errors.length === 0 && matched === expectedRows.length, matched, expected: expectedRows.length, errors };
}

export function classifyGd001ScoringState(input: {
  snapshot: Gd001ScoringSnapshot;
  verification: PersistedScoreVerification;
}): Gd001ScoringClassification {
  const { snapshot, verification } = input;
  const blockers: string[] = [];
  const expectedTotal = Object.values(GD_001_EXPECTED_RESPONSE_COUNTS).reduce((sum, count) => sum + count, 0);
  const responseTotal = Object.values(snapshot.responseCounts).reduce((sum, count) => sum + count, 0);
  const rawTotal = Object.values(snapshot.rawValueCounts).reduce((sum, count) => sum + count, 0);
  const scoredTotal = Object.values(snapshot.scoredValueCounts).reduce((sum, count) => sum + count, 0);
  const hasExpectedResponseCounts = Object.entries(GD_001_EXPECTED_RESPONSE_COUNTS).every(
    ([testSlug, expectedCount]) => snapshot.responseCounts[testSlug] === expectedCount,
  );
  const hasExpectedRawCounts = Object.entries(GD_001_EXPECTED_RESPONSE_COUNTS).every(
    ([testSlug, expectedCount]) => snapshot.rawValueCounts[testSlug] === expectedCount,
  );
  const hasExpectedScoredCounts = Object.entries(GD_001_EXPECTED_RESPONSE_COUNTS).every(
    ([testSlug, expectedCount]) => snapshot.scoredValueCounts[testSlug] === expectedCount,
  );
  const completedCount = snapshot.attempts.filter(
    (attempt) => attempt.status === "completed" && Boolean(attempt.completedAt),
  ).length;
  const inProgressCount = snapshot.attempts.filter(
    (attempt) => attempt.status === "in_progress" && attempt.completedAt === null,
  ).length;
  const allAttemptsUnscored =
    snapshot.attempts.length === 3 &&
    snapshot.attempts.every(
      (attempt) =>
        attempt.status === "in_progress" &&
        attempt.completedAt === null &&
        attempt.scoredStartedAt === null,
    );
  const allAttemptsScoredLifecycleValid =
    snapshot.attempts.length === 3 &&
    snapshot.attempts.every(
      (attempt) =>
        attempt.status === "completed" &&
        Boolean(attempt.completedAt) &&
        attempt.scoredStartedAt === null,
    );
  const hasReports = snapshot.attemptReportCount > 0 || snapshot.assessmentReportCount > 0;

  if (!hasExpectedResponseCounts || responseTotal !== expectedTotal || snapshot.attempts.length !== 3) {
    blockers.push("Fixture response or attempt cardinality differs from the locked GD-001 contract.");
  }
  if (hasReports) blockers.push("Report artifacts already exist.");

  if (
    snapshot.fixtureState === "EXACT_MATCH" &&
    snapshot.structuralFixtureExact &&
    blockers.length === 0 &&
    inProgressCount === 3 &&
    allAttemptsUnscored &&
    rawTotal === 0 &&
    scoredTotal === 0 &&
    snapshot.dimensionScores.length === 0
  ) {
    return {
      fixtureWriterState: snapshot.fixtureState,
      fixtureCompatibilityState: snapshot.structuralFixtureExact ? "EXACT_MATCH" : "CONFLICT",
      scoringState: "UNSCORED_EXACT",
      state: "UNSCORED_EXACT",
      blockers: [],
    };
  }

  if (
    !hasReports &&
    blockers.length === 0 &&
    snapshot.structuralFixtureExact &&
    completedCount === 3 &&
    allAttemptsScoredLifecycleValid &&
    hasExpectedRawCounts &&
    hasExpectedScoredCounts &&
    snapshot.dimensionScores.length === 40
  ) {
    if (verification.ok) {
      return {
        fixtureWriterState: snapshot.fixtureState,
        fixtureCompatibilityState: "EXACT_MATCH",
        scoringState: "SCORED_EXACT",
        state: "SCORED_EXACT",
        blockers: [],
      };
    }
    return {
      fixtureWriterState: snapshot.fixtureState,
      fixtureCompatibilityState: "CONFLICT",
      scoringState: "CONFLICT",
      state: "CONFLICT",
      blockers: verification.errors,
    };
  }

  const hasAnyScoring =
    completedCount > 0 || rawTotal > 0 || scoredTotal > 0 || snapshot.dimensionScores.length > 0;
  if (hasAnyScoring && !hasReports) {
    const isPartial =
      responseTotal < expectedTotal ||
      !hasExpectedResponseCounts ||
      completedCount < 3 ||
      rawTotal < expectedTotal ||
      scoredTotal < expectedTotal ||
      !hasExpectedRawCounts ||
      !hasExpectedScoredCounts ||
      snapshot.dimensionScores.length < 40;
    const partialBlockers = blockers.length > 0
      ? blockers
      : [isPartial ? "Scoring responses are incomplete." : "Scoring evidence conflicts with the locked fixture contract."];
    return {
      fixtureWriterState: snapshot.fixtureState,
      fixtureCompatibilityState: isPartial ? "PARTIAL" : "CONFLICT",
      scoringState: isPartial ? "PARTIAL" : "CONFLICT",
      state: isPartial ? "PARTIAL" : "CONFLICT",
      blockers: partialBlockers,
    };
  }
  const conflictBlockers = [...snapshot.fixtureBlockers, ...blockers].length > 0
    ? [...new Set([...snapshot.fixtureBlockers, ...blockers])]
    : ["Fixture is not a valid Golden Demo scoring state."];
  return {
    fixtureWriterState: snapshot.fixtureState,
    fixtureCompatibilityState: "CONFLICT",
    scoringState: "CONFLICT",
    state: "CONFLICT",
    blockers: conflictBlockers,
  };
}

export function buildGd001ScoringPlan(input: {
  mode: Gd001ScoringMode;
  snapshot: Gd001ScoringSnapshot;
  classification: ReturnType<typeof classifyGd001ScoringState>;
  verification: PersistedScoreVerification;
}) {
  return {
    mode: input.mode,
    candidateId: GD_001_CANDIDATE_ID,
    fixtureWriterState: input.classification.fixtureWriterState,
    fixtureCompatibilityState: input.classification.fixtureCompatibilityState,
    scoringState: input.classification.scoringState,
    blockers: input.classification.blockers,
    participantId: input.snapshot.participantId,
    assignmentId: input.snapshot.assignmentId,
    attemptIds: input.snapshot.attemptIds,
    responses: {
      expectedByTest: { ...GD_001_EXPECTED_RESPONSE_COUNTS },
      existingByTest: input.snapshot.responseCounts,
      rawValueCountsByTest: input.snapshot.rawValueCounts,
      scoredValueCountsByTest: input.snapshot.scoredValueCounts,
    },
    dimensionScoreCount: input.snapshot.dimensionScores.length,
    assignmentCompositeScoreStatus: "derived_read_only_not_persisted",
    expectedScoreVerification: input.verification,
    plannedProductionScoringSteps:
      input.classification.scoringState === "UNSCORED_EXACT"
        ? GD_001_TEST_SLUGS.map((testSlug) => ({
            testSlug,
            steps: ["validate_required_responses", "complete_attempt", "persistCompletedAssessmentResults"],
          }))
        : [],
    scoringExecution: false,
    reportGeneration: false,
    openAiCalls: false,
    writesPerformed: false,
  };
}

export async function executeGd001ScoringApply(input: {
  snapshot: Gd001ScoringSnapshot;
  classification: ReturnType<typeof classifyGd001ScoringState>;
  runProductionScoring: () => Promise<void>;
  inspectAfter: () => Promise<{
    snapshot: Gd001ScoringSnapshot;
    verification: PersistedScoreVerification;
  }>;
}) {
  if (
    input.classification.fixtureCompatibilityState === "EXACT_MATCH" &&
    input.classification.scoringState === "SCORED_EXACT"
  ) {
    return {
      stateBefore: "SCORED_EXACT",
      stateAfter: "SCORED_EXACT",
      writesPerformed: false,
      scoringExecution: false,
      reportGeneration: false,
      openAiCalls: false,
    };
  }
  if (
    input.classification.fixtureCompatibilityState !== "EXACT_MATCH" ||
    input.classification.scoringState !== "UNSCORED_EXACT" ||
    input.snapshot.fixtureState !== "EXACT_MATCH"
  ) {
    throw new Error(
      `Scoring apply is blocked in state ${input.classification.scoringState}: ${input.classification.blockers.join("; ")}`,
    );
  }
  await input.runProductionScoring();
  const after = await input.inspectAfter();
  const afterClassification = classifyGd001ScoringState(after);
  if (
    afterClassification.fixtureCompatibilityState !== "EXACT_MATCH" ||
    afterClassification.scoringState !== "SCORED_EXACT"
  ) {
    throw new Error(`Post-scoring verification requires SCORED_EXACT; received ${afterClassification.state}: ${afterClassification.blockers.join("; ")}`);
  }
  return {
    stateBefore: "UNSCORED_EXACT" as const,
    stateAfter: "SCORED_EXACT" as const,
    participantId: after.snapshot.participantId,
    assignmentId: after.snapshot.assignmentId,
    attemptIds: after.snapshot.attemptIds,
    responseCounts: after.snapshot.responseCounts,
    expectedScoreVerification: after.verification,
    writesPerformed: true,
    scoringExecution: true,
    reportGeneration: false,
    openAiCalls: false,
  };
}
