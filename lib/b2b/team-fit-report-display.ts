import "server-only";

import {
  validateTeamFitReportSnapshot,
  type TeamFitReportV1,
} from "@/lib/b2b/team-fit-report-contract";
import {
  TEAM_FIT_REPORT_V1_TYPE,
  TEAM_FIT_REPORT_V1_VERSION,
  TEAM_FIT_REPORT_V2_TYPE,
  TEAM_FIT_REPORT_V2_VERSION,
  resolveTeamFitReportIdentity,
} from "@/lib/b2b/team-fit-report-identity";
import type { TeamFitReportStatus } from "@/lib/b2b/team-fit-report-lifecycle";
import {
  validateTeamFitReportV2,
  type TeamFitReportV2,
} from "@/lib/b2b/team-fit-report-v2-contract";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamFitReportDisplayDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
  validateV1Snapshot?: typeof validateTeamFitReportSnapshot;
  validateV2Snapshot?: typeof validateTeamFitReportV2;
};

type TeamFitReportDisplayRow = {
  id: string; organization_id: string; team_id: string; participant_id: string;
  report_type: string; report_version: string; report_status: TeamFitReportStatus;
  input_snapshot: Record<string, unknown> | null;
  report_snapshot: Record<string, unknown> | null;
  queued_at: string | null; started_at: string | null; completed_at: string | null;
  failed_at: string | null; created_at: string;
};

type TeamRow = { id: string; organization_id: string; name: string | null };
type ParticipantRow = { id: string; organization_id: string; full_name: string | null };

type TeamFitReportDisplayRecordBase = {
  id: string;
  organizationId: string;
  teamId: string;
  participantId: string;
  status: TeamFitReportStatus;
  team: { id: string; name: string | null };
  candidate: { participantId: string; displayName: string | null };
  createdAt: string;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  hasInputSnapshot: boolean;
  hasReportSnapshot: boolean;
  safeStatusMessage: string;
};

export type TeamFitReportV1DisplayRecord = TeamFitReportDisplayRecordBase & {
  reportType: typeof TEAM_FIT_REPORT_V1_TYPE;
  reportVersion: typeof TEAM_FIT_REPORT_V1_VERSION;
  legacyReadOnly?: true;
  reportSnapshot: TeamFitReportV1 | null;
};

export type TeamFitReportV2DisplayRecord = TeamFitReportDisplayRecordBase & {
  reportType: typeof TEAM_FIT_REPORT_V2_TYPE;
  reportVersion: typeof TEAM_FIT_REPORT_V2_VERSION;
  legacyReadOnly: false;
  reportSnapshot: TeamFitReportV2 | null;
};

export type TeamFitReportVersionedDisplayRecord =
  | TeamFitReportV1DisplayRecord
  | TeamFitReportV2DisplayRecord;

// Backward-compatible name used by the legacy V1 renderer and its dev fixtures.
export type TeamFitReportDisplayRecord = TeamFitReportV1DisplayRecord;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getSafeStatusMessage(status: TeamFitReportStatus): string {
  switch (status) {
    case "queued": return "Izvještaj je pripremljen za obradu.";
    case "processing": return "Izvještaj je trenutno u obradi.";
    case "failed": return "Izvještaj trenutno nije uspješno kreiran.";
    case "ready": default: return "Izvještaj je spreman za pregled.";
  }
}

async function loadReportRow(input: {
  organizationId: string; teamId: string; participantId: string;
  teamFitReportId: string; supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<TeamFitReportDisplayRow | null> {
  const { data, error } = await input.supabase
    .from("team_fit_reports")
    .select("id, organization_id, team_id, participant_id, report_type, report_version, report_status, input_snapshot, report_snapshot, queued_at, started_at, completed_at, failed_at, created_at")
    .eq("id", input.teamFitReportId)
    .eq("organization_id", input.organizationId)
    .eq("team_id", input.teamId)
    .eq("participant_id", input.participantId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load Team Fit display report row: ${error.message}`);
  return (data as TeamFitReportDisplayRow | null) ?? null;
}

async function loadTeamRow(input: { organizationId: string; teamId: string; supabase: ReturnType<typeof createSupabaseAdminClient> }): Promise<TeamRow | null> {
  const { data, error } = await input.supabase.from("teams").select("id, organization_id, name")
    .eq("id", input.teamId).eq("organization_id", input.organizationId).maybeSingle();
  if (error) throw new Error(`Failed to load Team Fit display team row: ${error.message}`);
  return (data as TeamRow | null) ?? null;
}

async function loadParticipantRow(input: { organizationId: string; participantId: string; supabase: ReturnType<typeof createSupabaseAdminClient> }): Promise<ParticipantRow | null> {
  const { data, error } = await input.supabase.from("participants").select("id, organization_id, full_name")
    .eq("id", input.participantId).eq("organization_id", input.organizationId).maybeSingle();
  if (error) throw new Error(`Failed to load Team Fit display participant row: ${error.message}`);
  return (data as ParticipantRow | null) ?? null;
}

function buildBase(row: TeamFitReportDisplayRow, team: TeamRow, participant: ParticipantRow): TeamFitReportDisplayRecordBase {
  return {
    id: row.id, organizationId: row.organization_id, teamId: row.team_id,
    participantId: row.participant_id, status: row.report_status,
    team: { id: team.id, name: team.name },
    candidate: { participantId: participant.id, displayName: participant.full_name },
    createdAt: row.created_at, queuedAt: row.queued_at, startedAt: row.started_at,
    completedAt: row.completed_at, failedAt: row.failed_at,
    hasInputSnapshot: row.input_snapshot !== null,
    hasReportSnapshot: row.report_snapshot !== null,
    safeStatusMessage: getSafeStatusMessage(row.report_status),
  };
}

export async function loadTeamFitReportDisplayRecord(input: {
  organizationId: string; teamId: string; participantId: string; teamFitReportId: string;
}, deps: TeamFitReportDisplayDependencies = {}): Promise<TeamFitReportVersionedDisplayRecord | null> {
  if (!isNonEmptyString(input.organizationId)) throw new Error("organizationId is required.");
  if (!isNonEmptyString(input.teamId)) throw new Error("teamId is required.");
  if (!isNonEmptyString(input.participantId)) throw new Error("participantId is required.");
  if (!isNonEmptyString(input.teamFitReportId)) throw new Error("teamFitReportId is required.");

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const row = await loadReportRow({ ...input, supabase });
  if (!row) return null;

  const identity = resolveTeamFitReportIdentity(row.report_type, row.report_version);
  if (!identity) return null;

  const [team, participant] = await Promise.all([
    loadTeamRow({ organizationId: input.organizationId, teamId: input.teamId, supabase }),
    loadParticipantRow({ organizationId: input.organizationId, participantId: input.participantId, supabase }),
  ]);
  if (!team || !participant) return null;

  const base = buildBase(row, team, participant);
  if (row.report_status !== "ready") {
    return identity.reportType === TEAM_FIT_REPORT_V1_TYPE
      ? { ...base, ...identity, legacyReadOnly: true, reportSnapshot: null }
      : { ...base, ...identity, legacyReadOnly: false, reportSnapshot: null };
  }
  if (!row.report_snapshot) return null;

  if (identity.reportType === TEAM_FIT_REPORT_V1_TYPE) {
    const validation = (deps.validateV1Snapshot ?? validateTeamFitReportSnapshot)(row.report_snapshot);
    if (!validation.ok || validation.snapshot.reportType !== identity.reportType || validation.snapshot.reportVersion !== identity.reportVersion) return null;
    return { ...base, ...identity, legacyReadOnly: true, reportSnapshot: validation.snapshot };
  }

  const validation = (deps.validateV2Snapshot ?? validateTeamFitReportV2)(row.report_snapshot);
  if (!validation.ok || validation.value.reportType !== identity.reportType || validation.value.reportVersion !== identity.reportVersion) return null;
  return { ...base, ...identity, legacyReadOnly: false, reportSnapshot: validation.value };
}
