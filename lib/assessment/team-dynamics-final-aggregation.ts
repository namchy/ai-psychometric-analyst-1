import "server-only";

import {
  deriveTeamDynamicsMixedScoreContractFlags,
  isValidTeamDynamicsMixedScoreResult,
  type TeamDynamicsMixedScoreContractFlags,
} from "@/lib/assessment/team-dynamics-mixed-score-read";
import {
  TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
} from "@/lib/assessment/team-dynamics-mixed-score-persistence";
import type {
  TeamDynamicsMixedScoreEntry,
  TeamDynamicsMixedScoreResult,
} from "@/lib/assessment/team-dynamics-mixed-scoring";
import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION =
  "team_dynamics_assessment_v1_mixed_aggregation_v1";

type TeamAssessmentAssignmentRow = {
  id: string;
  team_id: string;
  package_slug: string;
};

type TeamAssessmentParticipantRow = {
  id: string;
  participant_id: string;
  status: "invited" | "started" | "completed" | "expired";
};

type TeamAssessmentParticipantScoreRow = {
  id: string;
  team_assessment_participant_id: string;
  scoring_version: string;
  scoring_status: string;
  raw_total: number | null;
  mean_raw: number | null;
  score_0_100: number | null;
  score_snapshot: unknown;
  calculated_at: string | null;
};

export type TeamDynamicsFinalAggregationStatus = "ready" | "not_ready" | "invalid";

export type TeamDynamicsFinalAggregationIssue = {
  teamAssessmentParticipantId: string;
  participantId: string;
  scoreRowId: string | null;
  status: "incomplete" | "not_found" | "invalid";
  reason: string | null;
};

export type TeamDynamicsFinalAggregatedScoreEntry = {
  scoreKey: string;
  label: string;
  blockKey: string;
  scoreModel: TeamDynamicsMixedScoreEntry["scoreModel"];
  entryType:
    | "block_overall"
    | "domain"
    | "construct"
    | "situational_judgment"
    | "outcome_signal"
    | "other";
  memberCount: number;
  meanScore0To100: number | null;
  minScore0To100: number | null;
  maxScore0To100: number | null;
  standardDeviationScore0To100: number | null;
};

export type TeamDynamicsFinalAggregationResult = {
  status: TeamDynamicsFinalAggregationStatus;
  teamAssessmentAssignmentId: string;
  teamId: string | null;
  testSlug: string | null;
  aggregationVersion: string;
  scoringVersion: string;
  participantCount: number;
  completedParticipantCount: number;
  incompleteMemberCount: number;
  readyScoredMemberCount: number;
  missingScoreCount: number;
  invalidScoreCount: number;
  sourceScoreSnapshotIds: string[];
  incompleteMemberParticipantIds: string[];
  missingScoreParticipantIds: string[];
  invalidScoreParticipantIds: string[];
  issues: TeamDynamicsFinalAggregationIssue[];
  scoreEntryAggregations: TeamDynamicsFinalAggregatedScoreEntry[];
  tdmDomainAggregations: TeamDynamicsFinalAggregatedScoreEntry[];
  psychologicalSafetyAggregationEntry: TeamDynamicsFinalAggregatedScoreEntry | null;
  sjtAggregationEntry: TeamDynamicsFinalAggregatedScoreEntry | null;
  outcomePulseAggregationEntry: TeamDynamicsFinalAggregatedScoreEntry | null;
  hasTopLevelOverallScore: boolean;
  teamOverallScore0To100: null;
  meanScore0To100: null;
  minScore0To100: null;
  maxScore0To100: null;
  standardDeviationScore0To100: null;
  reasons: string[];
};

type TeamDynamicsFinalAggregationDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

type ReadyMemberSnapshot = {
  teamAssessmentParticipantId: string;
  participantId: string;
  scoreRowId: string;
  scoreSnapshot: TeamDynamicsMixedScoreResult;
  flags: TeamDynamicsMixedScoreContractFlags;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function dedupeReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons.filter((reason) => isNonEmptyString(reason))));
}

function buildBaseResult(input: {
  status: TeamDynamicsFinalAggregationStatus;
  teamAssessmentAssignmentId: string;
  aggregationVersion: string;
  scoringVersion: string;
  teamId?: string | null;
  testSlug?: string | null;
  participantCount?: number;
  completedParticipantCount?: number;
  incompleteMemberCount?: number;
  readyScoredMemberCount?: number;
  missingScoreCount?: number;
  invalidScoreCount?: number;
  sourceScoreSnapshotIds?: string[];
  incompleteMemberParticipantIds?: string[];
  missingScoreParticipantIds?: string[];
  invalidScoreParticipantIds?: string[];
  issues?: TeamDynamicsFinalAggregationIssue[];
  scoreEntryAggregations?: TeamDynamicsFinalAggregatedScoreEntry[];
  reasons?: string[];
}): TeamDynamicsFinalAggregationResult {
  const scoreEntryAggregations = input.scoreEntryAggregations ?? [];

  return {
    status: input.status,
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    teamId: input.teamId ?? null,
    testSlug: input.testSlug ?? null,
    aggregationVersion: input.aggregationVersion,
    scoringVersion: input.scoringVersion,
    participantCount: input.participantCount ?? 0,
    completedParticipantCount: input.completedParticipantCount ?? 0,
    incompleteMemberCount: input.incompleteMemberCount ?? 0,
    readyScoredMemberCount: input.readyScoredMemberCount ?? 0,
    missingScoreCount: input.missingScoreCount ?? 0,
    invalidScoreCount: input.invalidScoreCount ?? 0,
    sourceScoreSnapshotIds: [...(input.sourceScoreSnapshotIds ?? [])].sort(),
    incompleteMemberParticipantIds: [
      ...(input.incompleteMemberParticipantIds ?? []),
    ].sort(),
    missingScoreParticipantIds: [...(input.missingScoreParticipantIds ?? [])].sort(),
    invalidScoreParticipantIds: [...(input.invalidScoreParticipantIds ?? [])].sort(),
    issues: input.issues ?? [],
    scoreEntryAggregations,
    tdmDomainAggregations: scoreEntryAggregations.filter((entry) =>
      entry.scoreKey.startsWith("tdm_domain_"),
    ),
    psychologicalSafetyAggregationEntry:
      scoreEntryAggregations.find(
        (entry) => entry.scoreKey === "psychological_safety_overall",
      ) ?? null,
    sjtAggregationEntry:
      scoreEntryAggregations.find(
        (entry) => entry.scoreKey === "situational_judgment_overall",
      ) ?? null,
    outcomePulseAggregationEntry:
      scoreEntryAggregations.find((entry) => entry.scoreKey === "outcome_pulse_overall") ??
      null,
    hasTopLevelOverallScore: false,
    teamOverallScore0To100: null,
    meanScore0To100: null,
    minScore0To100: null,
    maxScore0To100: null,
    standardDeviationScore0To100: null,
    reasons: dedupeReasons(input.reasons ?? []),
  };
}

function getEntryType(entry: TeamDynamicsMixedScoreEntry): TeamDynamicsFinalAggregatedScoreEntry["entryType"] {
  if (entry.scoreKey.startsWith("tdm_domain_")) {
    return "domain";
  }

  if (entry.scoreKey === "situational_judgment_overall") {
    return "situational_judgment";
  }

  if (entry.scoreKey === "outcome_pulse_overall") {
    return "outcome_signal";
  }

  if (
    entry.scoreKey === "tdm-31-V1_overall" ||
    entry.scoreKey === "psychological_safety_overall"
  ) {
    return "block_overall";
  }

  if (entry.blockKey === "psychological_safety") {
    return "construct";
  }

  return "other";
}

function calculateStandardDeviation(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  if (values.length === 1) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return roundTo2(Math.sqrt(variance));
}

function aggregateScoreEntries(
  members: ReadyMemberSnapshot[],
): TeamDynamicsFinalAggregatedScoreEntry[] {
  const entryMap = new Map<
    string,
    {
      template: TeamDynamicsMixedScoreEntry;
      values: number[];
    }
  >();

  for (const member of members) {
    for (const entry of member.scoreSnapshot.scoreEntries) {
      const existing = entryMap.get(entry.scoreKey);

      if (existing) {
        existing.values.push(entry.score0To100);
        continue;
      }

      entryMap.set(entry.scoreKey, {
        template: entry,
        values: [entry.score0To100],
      });
    }
  }

  return [...entryMap.entries()]
    .map(([scoreKey, aggregate]) => {
      const sortedValues = [...aggregate.values].sort((left, right) => left - right);
      const memberCount = sortedValues.length;
      const meanScore0To100 =
        memberCount > 0
          ? roundTo2(
              sortedValues.reduce((sum, value) => sum + value, 0) / memberCount,
            )
          : null;

      return {
        scoreKey,
        label: aggregate.template.label,
        blockKey: aggregate.template.blockKey,
        scoreModel: aggregate.template.scoreModel,
        entryType: getEntryType(aggregate.template),
        memberCount,
        meanScore0To100,
        minScore0To100: memberCount > 0 ? sortedValues[0] : null,
        maxScore0To100: memberCount > 0 ? sortedValues[memberCount - 1] : null,
        standardDeviationScore0To100: calculateStandardDeviation(sortedValues),
      };
    })
    .sort((left, right) => left.scoreKey.localeCompare(right.scoreKey));
}

function validateReadyMemberScoreRow(input: {
  participant: TeamAssessmentParticipantRow;
  scoreRow: TeamAssessmentParticipantScoreRow;
}):
  | { ok: true; member: ReadyMemberSnapshot }
  | { ok: false; issue: TeamDynamicsFinalAggregationIssue } {
  if (input.scoreRow.scoring_status !== "scored") {
    return {
      ok: false,
      issue: {
        teamAssessmentParticipantId: input.participant.id,
        participantId: input.participant.participant_id,
        scoreRowId: input.scoreRow.id,
        status: "invalid",
        reason: "score_row_not_scored",
      },
    };
  }

  if (!isValidTeamDynamicsMixedScoreResult(input.scoreRow.score_snapshot)) {
    return {
      ok: false,
      issue: {
        teamAssessmentParticipantId: input.participant.id,
        participantId: input.participant.participant_id,
        scoreRowId: input.scoreRow.id,
        status: "invalid",
        reason: "invalid_score_snapshot_shape",
      },
    };
  }

  if (input.scoreRow.score_snapshot.status !== "scored") {
    return {
      ok: false,
      issue: {
        teamAssessmentParticipantId: input.participant.id,
        participantId: input.participant.participant_id,
        scoreRowId: input.scoreRow.id,
        status: "invalid",
        reason: "score_snapshot_not_scored",
      },
    };
  }

  const flags = deriveTeamDynamicsMixedScoreContractFlags({
    scoreSnapshot: input.scoreRow.score_snapshot,
    rawTotal: input.scoreRow.raw_total,
    meanRaw: input.scoreRow.mean_raw,
    score0To100: input.scoreRow.score_0_100,
  });

  if (
    flags.hasTopLevelOverallScore ||
    !flags.hasTdmBlockScore ||
    !flags.hasTdmDomainScores ||
    !flags.hasPsychologicalSafetyScore ||
    !flags.hasSjtScore ||
    !flags.hasOutcomePulseScore
  ) {
    return {
      ok: false,
      issue: {
        teamAssessmentParticipantId: input.participant.id,
        participantId: input.participant.participant_id,
        scoreRowId: input.scoreRow.id,
        status: "invalid",
        reason: "score_snapshot_contract_mismatch",
      },
    };
  }

  return {
    ok: true,
    member: {
      teamAssessmentParticipantId: input.participant.id,
      participantId: input.participant.participant_id,
      scoreRowId: input.scoreRow.id,
      scoreSnapshot: input.scoreRow.score_snapshot,
      flags,
    },
  };
}

export async function loadTeamDynamicsFinalAggregation(input: {
  teamAssessmentAssignmentId: string;
  aggregationVersion?: string;
  scoringVersion?: string;
}, deps: TeamDynamicsFinalAggregationDependencies = {}): Promise<TeamDynamicsFinalAggregationResult> {
  const aggregationVersion =
    input.aggregationVersion ?? TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION;
  const scoringVersion =
    input.scoringVersion ?? TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION;

  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    return buildBaseResult({
      status: "invalid",
      teamAssessmentAssignmentId: "",
      aggregationVersion,
      scoringVersion,
      reasons: ["teamAssessmentAssignmentId is required."],
    });
  }

  if (!isNonEmptyString(aggregationVersion)) {
    return buildBaseResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion: "",
      scoringVersion,
      reasons: ["aggregationVersion is required."],
    });
  }

  if (!isNonEmptyString(scoringVersion)) {
    return buildBaseResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      scoringVersion: "",
      reasons: ["scoringVersion is required."],
    });
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const { data: assignmentData, error: assignmentError } = await supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug")
    .eq("id", input.teamAssessmentAssignmentId)
    .maybeSingle();

  if (assignmentError) {
    return buildBaseResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      scoringVersion,
      reasons: [
        `Failed to load Team Dynamics final aggregation assignment context: ${assignmentError.message}`,
      ],
    });
  }

  const assignment = (assignmentData as TeamAssessmentAssignmentRow | null) ?? null;

  if (!assignment) {
    return buildBaseResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      scoringVersion,
      reasons: ["team_assessment_assignment_not_found"],
    });
  }

  if (assignment.package_slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG) {
    return buildBaseResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      scoringVersion,
      teamId: assignment.team_id,
      testSlug: assignment.package_slug,
      reasons: [`unsupported_assessment:${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG}`],
    });
  }

  const { data: participantRowsData, error: participantRowsError } = await supabase
    .from("team_assessment_participants")
    .select("id, participant_id, status")
    .eq("team_assessment_assignment_id", input.teamAssessmentAssignmentId);

  if (participantRowsError) {
    return buildBaseResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      scoringVersion,
      teamId: assignment.team_id,
      testSlug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
      reasons: [
        `Failed to load Team Dynamics final aggregation participants: ${participantRowsError.message}`,
      ],
    });
  }

  const participantRows =
    ((participantRowsData ?? []) as TeamAssessmentParticipantRow[]) ?? [];
  const completedParticipants = participantRows.filter(
    (participant) => participant.status === "completed",
  );
  const incompleteParticipants = participantRows.filter(
    (participant) => participant.status !== "completed",
  );
  const completedParticipantIds = completedParticipants.map((participant) => participant.id);
  const { data: scoreRowsData, error: scoreRowsError } = await supabase
    .from("team_assessment_participant_scores")
    .select(
      "id, team_assessment_participant_id, scoring_version, scoring_status, raw_total, mean_raw, score_0_100, score_snapshot, calculated_at",
    )
    .in("team_assessment_participant_id", completedParticipantIds)
    .eq("scoring_version", scoringVersion);

  if (scoreRowsError) {
    return buildBaseResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      scoringVersion,
      teamId: assignment.team_id,
      testSlug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
      participantCount: participantRows.length,
      completedParticipantCount: completedParticipants.length,
      reasons: [
        `Failed to load Team Dynamics final member score snapshots: ${scoreRowsError.message}`,
      ],
    });
  }

  const scoreRows =
    ((scoreRowsData ?? []) as TeamAssessmentParticipantScoreRow[]) ?? [];
  const scoreRowByParticipantId = new Map<string, TeamAssessmentParticipantScoreRow>();

  for (const scoreRow of scoreRows) {
    if (!scoreRowByParticipantId.has(scoreRow.team_assessment_participant_id)) {
      scoreRowByParticipantId.set(scoreRow.team_assessment_participant_id, scoreRow);
    }
  }

  const readyMembers: ReadyMemberSnapshot[] = [];
  const issues: TeamDynamicsFinalAggregationIssue[] = [];

  for (const participant of incompleteParticipants) {
    issues.push({
      teamAssessmentParticipantId: participant.id,
      participantId: participant.participant_id,
      scoreRowId: null,
      status: "incomplete",
      reason: `member_not_completed:${participant.status}`,
    });
  }

  for (const participant of completedParticipants) {
    const scoreRow = scoreRowByParticipantId.get(participant.id);

    if (!scoreRow) {
      issues.push({
        teamAssessmentParticipantId: participant.id,
        participantId: participant.participant_id,
        scoreRowId: null,
        status: "not_found",
        reason: "member_score_snapshot_not_found",
      });
      continue;
    }

    const validation = validateReadyMemberScoreRow({
      participant,
      scoreRow,
    });

    if (!validation.ok) {
      issues.push(validation.issue);
      continue;
    }

    readyMembers.push(validation.member);
  }

  const incompleteMemberParticipantIds = issues
    .filter((issue) => issue.status === "incomplete")
    .map((issue) => issue.teamAssessmentParticipantId);
  const missingScoreParticipantIds = issues
    .filter((issue) => issue.status === "not_found")
    .map((issue) => issue.teamAssessmentParticipantId);
  const invalidScoreParticipantIds = issues
    .filter((issue) => issue.status === "invalid")
    .map((issue) => issue.teamAssessmentParticipantId);
  const reasons = [
    ...(incompleteMemberParticipantIds.length > 0
      ? ["incomplete_included_members"]
      : []),
    ...(missingScoreParticipantIds.length > 0 ? ["missing_completed_score_snapshots"] : []),
    ...(invalidScoreParticipantIds.length > 0 ? ["invalid_completed_score_snapshots"] : []),
    ...(readyMembers.length === 0 ? ["no_ready_member_score_snapshots"] : []),
  ];

  if (reasons.length > 0) {
    return buildBaseResult({
      status: "not_ready",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      scoringVersion,
      teamId: assignment.team_id,
      testSlug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
      participantCount: participantRows.length,
      completedParticipantCount: completedParticipants.length,
      incompleteMemberCount: incompleteMemberParticipantIds.length,
      readyScoredMemberCount: readyMembers.length,
      missingScoreCount: missingScoreParticipantIds.length,
      invalidScoreCount: invalidScoreParticipantIds.length,
      sourceScoreSnapshotIds: readyMembers.map((member) => member.scoreRowId),
      incompleteMemberParticipantIds,
      missingScoreParticipantIds,
      invalidScoreParticipantIds,
      issues,
      reasons,
    });
  }

  const scoreEntryAggregations = aggregateScoreEntries(readyMembers);

  return buildBaseResult({
    status: "ready",
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    aggregationVersion,
    scoringVersion,
    teamId: assignment.team_id,
    testSlug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
    participantCount: participantRows.length,
    completedParticipantCount: completedParticipants.length,
    incompleteMemberCount: 0,
    readyScoredMemberCount: readyMembers.length,
    missingScoreCount: 0,
    invalidScoreCount: 0,
    sourceScoreSnapshotIds: readyMembers.map((member) => member.scoreRowId),
    scoreEntryAggregations,
    reasons: [],
  });
}
