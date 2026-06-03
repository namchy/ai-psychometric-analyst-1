import "server-only";

import {
  loadTeamAssessmentExecutionContext,
  type TeamAssessmentExecutionContextFailureCode,
} from "@/lib/assessment/team-assessment-execution";
import {
  TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
} from "@/lib/assessment/team-dynamics-mixed-score-persistence";
import type {
  TeamDynamicsMixedScoreEntry,
  TeamDynamicsMixedScoreResult,
} from "@/lib/assessment/team-dynamics-mixed-scoring";
import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamDynamicsMixedParticipantOwnershipRow = {
  participant_id: string;
};

type TeamDynamicsMixedParticipantUserRow = {
  user_id: string | null;
};

type TeamDynamicsMixedScoreReadRow = {
  id: string;
  scoring_version: string;
  scoring_status: string;
  raw_total: number | null;
  mean_raw: number | null;
  score_0_100: number | null;
  score_snapshot: unknown;
  created_at: string | null;
  updated_at: string | null;
  calculated_at: string | null;
};

export type TeamDynamicsMixedScoreVerificationStatus =
  | "not_found"
  | "ready"
  | "invalid";

export type TeamDynamicsMixedScoreVerificationResult = {
  status: TeamDynamicsMixedScoreVerificationStatus;
  teamAssessmentParticipantId: string;
  testSlug: string | null;
  scoringVersion: string;
  scoreRowId: string | null;
  scoreSnapshot: TeamDynamicsMixedScoreResult | Record<string, unknown> | null;
  scoreEntries: TeamDynamicsMixedScoreEntry[];
  hasTopLevelOverallScore: boolean;
  hasTdmBlockScore: boolean;
  hasTdmDomainScores: boolean;
  hasPsychologicalSafetyScore: boolean;
  hasSjtScore: boolean;
  hasOutcomePulseScore: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  calculatedAt: string | null;
  reason: string | null;
};

export type TeamDynamicsMixedScoreContractFlags = {
  scoreEntries: TeamDynamicsMixedScoreEntry[];
  hasTopLevelOverallScore: boolean;
  hasTdmBlockScore: boolean;
  hasTdmDomainScores: boolean;
  hasPsychologicalSafetyScore: boolean;
  hasSjtScore: boolean;
  hasOutcomePulseScore: boolean;
};

type TeamDynamicsMixedScoreReadDependencies = {
  loadExecutionContext?: typeof loadTeamAssessmentExecutionContext;
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidScoreEntry(value: unknown): value is TeamDynamicsMixedScoreEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.scoreKey) &&
    isNonEmptyString(value.label) &&
    isNonEmptyString(value.blockKey) &&
    (value.scoreModel === "simple_linear_v1" ||
      value.scoreModel === "expert_key_partial_credit_v1") &&
    Number.isInteger(value.itemCount) &&
    Number.isInteger(value.scoredItemCount) &&
    isFiniteNumber(value.rawTotal) &&
    isFiniteNumber(value.meanRaw) &&
    isFiniteNumber(value.score0To100) &&
    isFiniteNumber(value.scaleMin) &&
    isFiniteNumber(value.scaleMax) &&
    isRecord(value.metadata)
  );
}

export function isValidTeamDynamicsMixedScoreResult(
  value: unknown,
): value is TeamDynamicsMixedScoreResult {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isNonEmptyString(value.status) ||
    !Array.isArray(value.blocks) ||
    !Array.isArray(value.scoreEntries) ||
    !Array.isArray(value.missingQuestionIds) ||
    !Array.isArray(value.runtimeWarnings) ||
    !Array.isArray(value.unsupportedQuestionIds)
  ) {
    return false;
  }

  return value.scoreEntries.every((entry) => isValidScoreEntry(entry));
}

export function deriveTeamDynamicsMixedScoreContractFlags(input: {
  scoreSnapshot: TeamDynamicsMixedScoreResult;
  rawTotal?: number | null;
  meanRaw?: number | null;
  score0To100?: number | null;
}): TeamDynamicsMixedScoreContractFlags {
  const scoreEntries = input.scoreSnapshot.scoreEntries;

  return {
    scoreEntries,
    hasTopLevelOverallScore:
      isFiniteNumber(input.rawTotal) ||
      isFiniteNumber(input.meanRaw) ||
      isFiniteNumber(input.score0To100) ||
      isFiniteNumber(input.scoreSnapshot.rawTotal) ||
      isFiniteNumber(input.scoreSnapshot.meanRaw) ||
      isFiniteNumber(input.scoreSnapshot.score0To100),
    hasTdmBlockScore: scoreEntries.some((entry) => entry.scoreKey === "tdm-31-V1_overall"),
    hasTdmDomainScores: scoreEntries.some((entry) => entry.scoreKey.startsWith("tdm_domain_")),
    hasPsychologicalSafetyScore: scoreEntries.some(
      (entry) => entry.scoreKey === "psychological_safety_overall",
    ),
    hasSjtScore: scoreEntries.some(
      (entry) => entry.scoreKey === "situational_judgment_overall",
    ),
    hasOutcomePulseScore: scoreEntries.some(
      (entry) => entry.scoreKey === "outcome_pulse_overall",
    ),
  };
}

function buildResult(
  input: Partial<TeamDynamicsMixedScoreVerificationResult> & {
    status: TeamDynamicsMixedScoreVerificationStatus;
    teamAssessmentParticipantId: string;
    scoringVersion: string;
  },
): TeamDynamicsMixedScoreVerificationResult {
  const scoreEntries = input.scoreEntries ?? [];

  return {
    status: input.status,
    teamAssessmentParticipantId: input.teamAssessmentParticipantId,
    testSlug: input.testSlug ?? null,
    scoringVersion: input.scoringVersion,
    scoreRowId: input.scoreRowId ?? null,
    scoreSnapshot: input.scoreSnapshot ?? null,
    scoreEntries,
    hasTopLevelOverallScore: input.hasTopLevelOverallScore ?? false,
    hasTdmBlockScore:
      input.hasTdmBlockScore ??
      scoreEntries.some((entry) => entry.scoreKey === "tdm-31-V1_overall"),
    hasTdmDomainScores:
      input.hasTdmDomainScores ??
      scoreEntries.some((entry) => entry.scoreKey.startsWith("tdm_domain_")),
    hasPsychologicalSafetyScore:
      input.hasPsychologicalSafetyScore ??
      scoreEntries.some((entry) => entry.scoreKey === "psychological_safety_overall"),
    hasSjtScore:
      input.hasSjtScore ??
      scoreEntries.some((entry) => entry.scoreKey === "situational_judgment_overall"),
    hasOutcomePulseScore:
      input.hasOutcomePulseScore ??
      scoreEntries.some((entry) => entry.scoreKey === "outcome_pulse_overall"),
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null,
    calculatedAt: input.calculatedAt ?? null,
    reason: input.reason ?? null,
  };
}

async function loadParticipantUserId(input: {
  teamAssessmentParticipantId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<
  | { ok: true; userId: string }
  | { ok: false; code: "wrapper_not_found" | "wrapper_access_denied"; reason: string }
> {
  const { data: wrapperData, error: wrapperError } = await input.supabase
    .from("team_assessment_participants")
    .select("participant_id")
    .eq("id", input.teamAssessmentParticipantId)
    .maybeSingle();

  if (wrapperError) {
    return {
      ok: false,
      code: "wrapper_not_found",
      reason: `Unable to load Team Dynamics participant wrapper ownership: ${wrapperError.message}`,
    };
  }

  const wrapperRow = (wrapperData as TeamDynamicsMixedParticipantOwnershipRow | null) ?? null;

  if (!wrapperRow?.participant_id) {
    return {
      ok: false,
      code: "wrapper_not_found",
      reason: "Team Dynamics participant wrapper was not found.",
    };
  }

  const { data: participantData, error: participantError } = await input.supabase
    .from("participants")
    .select("user_id")
    .eq("id", wrapperRow.participant_id)
    .maybeSingle();

  if (participantError) {
    return {
      ok: false,
      code: "wrapper_access_denied",
      reason: `Unable to load Team Dynamics participant ownership: ${participantError.message}`,
    };
  }

  const participantRow = (participantData as TeamDynamicsMixedParticipantUserRow | null) ?? null;

  if (!isNonEmptyString(participantRow?.user_id)) {
    return {
      ok: false,
      code: "wrapper_access_denied",
      reason: "Team Dynamics participant wrapper is not linked to an owning user.",
    };
  }

  return {
    ok: true,
    userId: participantRow.user_id,
  };
}

function mapExecutionFailureReason(code: TeamAssessmentExecutionContextFailureCode, message: string): string {
  return `${code}:${message}`;
}

export async function loadTeamDynamicsMixedScoreVerification(input: {
  teamAssessmentParticipantId: string;
  scoringVersion?: string;
}, deps: TeamDynamicsMixedScoreReadDependencies = {}): Promise<TeamDynamicsMixedScoreVerificationResult> {
  const scoringVersion =
    input.scoringVersion ?? TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION;

  if (!isNonEmptyString(input.teamAssessmentParticipantId)) {
    return buildResult({
      status: "invalid",
      teamAssessmentParticipantId: "",
      scoringVersion,
      reason: "teamAssessmentParticipantId is required.",
    });
  }

  if (!isNonEmptyString(scoringVersion)) {
    return buildResult({
      status: "invalid",
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      scoringVersion: "",
      reason: "scoringVersion is required.",
    });
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const ownershipResult = await loadParticipantUserId({
    teamAssessmentParticipantId: input.teamAssessmentParticipantId,
    supabase,
  });

  if (!ownershipResult.ok) {
    return buildResult({
      status: "invalid",
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      scoringVersion,
      reason: ownershipResult.reason,
    });
  }

  const loadExecutionContext =
    deps.loadExecutionContext ?? loadTeamAssessmentExecutionContext;
  const contextResult = await loadExecutionContext({
    teamAssessmentParticipantId: input.teamAssessmentParticipantId,
    userId: ownershipResult.userId,
  });

  if (!contextResult.ok) {
    return buildResult({
      status: "invalid",
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      scoringVersion,
      reason: mapExecutionFailureReason(contextResult.code, contextResult.message),
    });
  }

  if (
    contextResult.context.packageSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    contextResult.context.test.slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG
  ) {
    return buildResult({
      status: "invalid",
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      testSlug: contextResult.context.test.slug,
      scoringVersion,
      reason: `unsupported_assessment:${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG}`,
    });
  }

  const { data: scoreRowData, error: scoreRowError } = await supabase
    .from("team_assessment_participant_scores")
    .select(
      "id, scoring_version, scoring_status, raw_total, mean_raw, score_0_100, score_snapshot, created_at, updated_at, calculated_at",
    )
    .eq("team_assessment_participant_id", input.teamAssessmentParticipantId)
    .eq("scoring_version", scoringVersion)
    .maybeSingle();

  if (scoreRowError) {
    return buildResult({
      status: "invalid",
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      testSlug: contextResult.context.test.slug,
      scoringVersion,
      reason: `score_row_load_failed:${scoreRowError.message}`,
    });
  }

  const scoreRow = (scoreRowData as TeamDynamicsMixedScoreReadRow | null) ?? null;

  if (!scoreRow) {
    return buildResult({
      status: "not_found",
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      testSlug: contextResult.context.test.slug,
      scoringVersion,
    });
  }

  if (!isValidTeamDynamicsMixedScoreResult(scoreRow.score_snapshot)) {
    return buildResult({
      status: "invalid",
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      testSlug: contextResult.context.test.slug,
      scoringVersion,
      scoreRowId: scoreRow.id,
      scoreSnapshot: isRecord(scoreRow.score_snapshot) ? scoreRow.score_snapshot : null,
      createdAt: scoreRow.created_at,
      updatedAt: scoreRow.updated_at,
      calculatedAt: scoreRow.calculated_at,
      reason: "invalid_score_snapshot_shape",
    });
  }

  const scoreSnapshot = scoreRow.score_snapshot;
  const flags = deriveTeamDynamicsMixedScoreContractFlags({
    scoreSnapshot,
    rawTotal: scoreRow.raw_total,
    meanRaw: scoreRow.mean_raw,
    score0To100: scoreRow.score_0_100,
  });

  return buildResult({
    status: "ready",
    teamAssessmentParticipantId: input.teamAssessmentParticipantId,
    testSlug: contextResult.context.test.slug,
    scoringVersion: scoreRow.scoring_version,
    scoreRowId: scoreRow.id,
    scoreSnapshot,
    scoreEntries: flags.scoreEntries,
    hasTopLevelOverallScore: flags.hasTopLevelOverallScore,
    hasTdmBlockScore: flags.hasTdmBlockScore,
    hasTdmDomainScores: flags.hasTdmDomainScores,
    hasPsychologicalSafetyScore: flags.hasPsychologicalSafetyScore,
    hasSjtScore: flags.hasSjtScore,
    hasOutcomePulseScore: flags.hasOutcomePulseScore,
    createdAt: scoreRow.created_at,
    updatedAt: scoreRow.updated_at,
    calculatedAt: scoreRow.calculated_at,
  });
}
