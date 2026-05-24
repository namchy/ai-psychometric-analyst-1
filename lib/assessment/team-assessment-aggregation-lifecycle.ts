import "server-only";

import {
  loadTeamAssessmentAggregationDraft,
  type TeamAssessmentAggregationDraftReadinessStatus,
  type TeamAssessmentAggregationDraftResult,
} from "@/lib/assessment/team-assessment-aggregation-draft";
import {
  loadTeamAssessmentAggregationVerification,
  type TeamAssessmentAggregationReadVerificationResult,
  type TeamAssessmentAggregationVerificationStatus,
} from "@/lib/assessment/team-assessment-aggregation-read";
import {
  TEAM_ASSESSMENT_AGGREGATION_VERSION,
  persistTeamAssessmentAggregationSnapshot,
  type TeamAssessmentAggregationPersistenceResult,
} from "@/lib/assessment/team-assessment-aggregation-persistence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type TeamAssessmentAggregationLifecycleStatus =
  | "refreshed"
  | "not_ready"
  | "verification_failed"
  | "failed";

type TeamAssessmentAggregationLifecycleDependencies = {
  loadAggregationDraft?: typeof loadTeamAssessmentAggregationDraft;
  persistAggregationSnapshot?: typeof persistTeamAssessmentAggregationSnapshot;
  loadAggregationVerification?: typeof loadTeamAssessmentAggregationVerification;
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

type TeamAssessmentAggregationLifecycleCounts = {
  participantCount: number;
  completedParticipantCount: number;
  scoreSnapshotCount: number;
  includedScoreCount: number;
  excludedScoreCount: number;
};

export type TeamAssessmentAggregationLifecycleResult = {
  teamAssessmentAssignmentId: string;
  aggregationVersion: string;
  lifecycleStatus: TeamAssessmentAggregationLifecycleStatus;
  draftStatus: TeamAssessmentAggregationDraftReadinessStatus | null;
  persistenceMode: "inserted" | "updated" | null;
  verificationStatus: TeamAssessmentAggregationVerificationStatus | null;
  aggregationSnapshotId: string | null;
  reasons: string[];
  counts: TeamAssessmentAggregationLifecycleCounts | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function dedupeReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons.filter((reason) => isNonEmptyString(reason))));
}

function buildCounts(
  draft: TeamAssessmentAggregationDraftResult,
): TeamAssessmentAggregationLifecycleCounts {
  return {
    participantCount: draft.participantCount,
    completedParticipantCount: draft.completedParticipantCount,
    scoreSnapshotCount: draft.scoreSnapshotCount,
    includedScoreCount: draft.includedScoreCount,
    excludedScoreCount: draft.excludedScoreCount,
  };
}

function buildFailedResult(input: {
  teamAssessmentAssignmentId: string;
  aggregationVersion: string;
  draftStatus?: TeamAssessmentAggregationDraftReadinessStatus | null;
  persistenceMode?: "inserted" | "updated" | null;
  verificationStatus?: TeamAssessmentAggregationVerificationStatus | null;
  aggregationSnapshotId?: string | null;
  reasons: string[];
  counts?: TeamAssessmentAggregationLifecycleCounts | null;
}): TeamAssessmentAggregationLifecycleResult {
  return {
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    aggregationVersion: input.aggregationVersion,
    lifecycleStatus: "failed",
    draftStatus: input.draftStatus ?? null,
    persistenceMode: input.persistenceMode ?? null,
    verificationStatus: input.verificationStatus ?? null,
    aggregationSnapshotId: input.aggregationSnapshotId ?? null,
    reasons: dedupeReasons(input.reasons),
    counts: input.counts ?? null,
  };
}

function buildVerificationFailedResult(input: {
  teamAssessmentAssignmentId: string;
  aggregationVersion: string;
  draft: TeamAssessmentAggregationDraftResult;
  persistence: Extract<TeamAssessmentAggregationPersistenceResult, { ok: true }>;
  verification: TeamAssessmentAggregationReadVerificationResult;
}): TeamAssessmentAggregationLifecycleResult {
  return {
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    aggregationVersion: input.aggregationVersion,
    lifecycleStatus: "verification_failed",
    draftStatus: input.draft.aggregationReadinessStatus,
    persistenceMode: input.persistence.mode,
    verificationStatus: input.verification.verificationStatus,
    aggregationSnapshotId: input.verification.aggregationSnapshotId,
    reasons: dedupeReasons(input.verification.reasons),
    counts: buildCounts(input.draft),
  };
}

export async function refreshTeamAssessmentAggregationSnapshot(input: {
  teamAssessmentAssignmentId: string;
  aggregationVersion?: string;
}, deps: TeamAssessmentAggregationLifecycleDependencies = {}): Promise<TeamAssessmentAggregationLifecycleResult> {
  const aggregationVersion =
    input.aggregationVersion ?? TEAM_ASSESSMENT_AGGREGATION_VERSION;

  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    return buildFailedResult({
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId ?? "",
      aggregationVersion,
      reasons: ["teamAssessmentAssignmentId is required."],
    });
  }

  if (!isNonEmptyString(aggregationVersion)) {
    return buildFailedResult({
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion: "",
      reasons: ["aggregationVersion is required."],
    });
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const loadAggregationDraft =
    deps.loadAggregationDraft ?? loadTeamAssessmentAggregationDraft;
  const persistAggregationSnapshot =
    deps.persistAggregationSnapshot ?? persistTeamAssessmentAggregationSnapshot;
  const loadAggregationVerification =
    deps.loadAggregationVerification ?? loadTeamAssessmentAggregationVerification;

  let draft: TeamAssessmentAggregationDraftResult;

  try {
    draft = await loadAggregationDraft(
      {
        teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      },
      {
        supabase,
      },
    );
  } catch (error) {
    return buildFailedResult({
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      reasons: [
        error instanceof Error
          ? error.message
          : "Failed to load Team Dynamics aggregation draft.",
      ],
    });
  }

  const counts = buildCounts(draft);

  let persistenceResult: TeamAssessmentAggregationPersistenceResult;

  try {
    persistenceResult = await persistAggregationSnapshot(
      {
        teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
        aggregationVersion,
      },
      {
        supabase,
        loadAggregationDraft: async () => draft,
      },
    );
  } catch (error) {
    return buildFailedResult({
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      draftStatus: draft.aggregationReadinessStatus,
      reasons: [
        error instanceof Error
          ? error.message
          : "Failed to persist Team Dynamics aggregation snapshot.",
      ],
      counts,
    });
  }

  if (!persistenceResult.ok) {
    return buildFailedResult({
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      draftStatus: draft.aggregationReadinessStatus,
      reasons: [persistenceResult.reason, persistenceResult.code],
      counts,
    });
  }

  let verification: TeamAssessmentAggregationReadVerificationResult;

  try {
    verification = await loadAggregationVerification(
      {
        teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
        aggregationVersion,
      },
      {
        supabase,
      },
    );
  } catch (error) {
    return buildFailedResult({
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      draftStatus: draft.aggregationReadinessStatus,
      persistenceMode: persistenceResult.mode,
      reasons: [
        error instanceof Error
          ? error.message
          : "Failed to verify Team Dynamics aggregation snapshot.",
      ],
      counts,
    });
  }

  if (
    verification.verificationStatus === "missing" ||
    verification.verificationStatus === "invalid"
  ) {
    return buildVerificationFailedResult({
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      draft,
      persistence: persistenceResult,
      verification,
    });
  }

  return {
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    aggregationVersion,
    lifecycleStatus:
      draft.aggregationReadinessStatus === "ready" ? "refreshed" : "not_ready",
    draftStatus: draft.aggregationReadinessStatus,
    persistenceMode: persistenceResult.mode,
    verificationStatus: verification.verificationStatus,
    aggregationSnapshotId: verification.aggregationSnapshotId,
    reasons: dedupeReasons(draft.reasons),
    counts,
  };
}
