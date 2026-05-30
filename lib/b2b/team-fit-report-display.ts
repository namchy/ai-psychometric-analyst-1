import "server-only";

import {
  TEAM_FIT_REPORT_TYPE,
  TEAM_FIT_REPORT_VERSION,
  type TeamFitReportStatus,
} from "@/lib/b2b/team-fit-report-lifecycle";
import {
  type TeamFitReportV1,
  validateTeamFitReportSnapshot,
} from "@/lib/b2b/team-fit-report-contract";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamFitReportDisplayDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
  validateSnapshot?: typeof validateTeamFitReportSnapshot;
};

type TeamFitReportDisplayRow = {
  id: string;
  organization_id: string;
  team_id: string;
  participant_id: string;
  report_type: string;
  report_version: string;
  report_status: TeamFitReportStatus;
  input_snapshot: Record<string, unknown> | null;
  report_snapshot: Record<string, unknown> | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
};

type TeamRow = {
  id: string;
  organization_id: string;
  name: string | null;
};

type ParticipantRow = {
  id: string;
  organization_id: string;
  full_name: string | null;
};

export type TeamFitReportDisplayStatus = TeamFitReportStatus;

export type TeamFitReportDisplayRecord = {
  id: string;
  organizationId: string;
  teamId: string;
  participantId: string;
  reportType: typeof TEAM_FIT_REPORT_TYPE;
  reportVersion: typeof TEAM_FIT_REPORT_VERSION;
  status: TeamFitReportDisplayStatus;
  team: {
    id: string;
    name: string | null;
  };
  candidate: {
    participantId: string;
    displayName: string | null;
  };
  createdAt: string;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  hasInputSnapshot: boolean;
  hasReportSnapshot: boolean;
  safeStatusMessage: string;
  reportSnapshot: TeamFitReportV1 | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getSafeStatusMessage(status: TeamFitReportDisplayStatus): string {
  switch (status) {
    case "queued":
      return "Izvještaj je pripremljen za obradu.";
    case "processing":
      return "Izvještaj je trenutno u obradi.";
    case "failed":
      return "Izvještaj trenutno nije uspješno kreiran.";
    case "ready":
    default:
      return "Izvještaj je spreman za pregled.";
  }
}

async function loadReportRow(input: {
  organizationId: string;
  teamId: string;
  participantId: string;
  teamFitReportId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<TeamFitReportDisplayRow | null> {
  const { data, error } = await input.supabase
    .from("team_fit_reports")
    .select(
      "id, organization_id, team_id, participant_id, report_type, report_version, report_status, input_snapshot, report_snapshot, queued_at, started_at, completed_at, failed_at, created_at",
    )
    .eq("id", input.teamFitReportId)
    .eq("organization_id", input.organizationId)
    .eq("team_id", input.teamId)
    .eq("participant_id", input.participantId)
    .eq("report_type", TEAM_FIT_REPORT_TYPE)
    .eq("report_version", TEAM_FIT_REPORT_VERSION)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Fit display report row: ${error.message}`);
  }

  return (data as TeamFitReportDisplayRow | null) ?? null;
}

async function loadTeamRow(input: {
  organizationId: string;
  teamId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<TeamRow | null> {
  const { data, error } = await input.supabase
    .from("teams")
    .select("id, organization_id, name")
    .eq("id", input.teamId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Fit display team row: ${error.message}`);
  }

  return (data as TeamRow | null) ?? null;
}

async function loadParticipantRow(input: {
  organizationId: string;
  participantId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<ParticipantRow | null> {
  const { data, error } = await input.supabase
    .from("participants")
    .select("id, organization_id, full_name")
    .eq("id", input.participantId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Fit display participant row: ${error.message}`);
  }

  return (data as ParticipantRow | null) ?? null;
}

function buildDisplayRecord(input: {
  row: TeamFitReportDisplayRow;
  team: TeamRow;
  participant: ParticipantRow;
  status: TeamFitReportDisplayStatus;
  reportSnapshot: TeamFitReportV1 | null;
}): TeamFitReportDisplayRecord {
  return {
    id: input.row.id,
    organizationId: input.row.organization_id,
    teamId: input.row.team_id,
    participantId: input.row.participant_id,
    reportType: TEAM_FIT_REPORT_TYPE,
    reportVersion: TEAM_FIT_REPORT_VERSION,
    status: input.status,
    team: {
      id: input.team.id,
      name: input.team.name,
    },
    candidate: {
      participantId: input.participant.id,
      displayName: input.participant.full_name,
    },
    createdAt: input.row.created_at,
    queuedAt: input.row.queued_at,
    startedAt: input.row.started_at,
    completedAt: input.row.completed_at,
    failedAt: input.row.failed_at,
    hasInputSnapshot: input.row.input_snapshot !== null,
    hasReportSnapshot: input.row.report_snapshot !== null,
    safeStatusMessage: getSafeStatusMessage(input.status),
    reportSnapshot: input.reportSnapshot,
  };
}

export async function loadTeamFitReportDisplayRecord(input: {
  organizationId: string;
  teamId: string;
  participantId: string;
  teamFitReportId: string;
}, deps: TeamFitReportDisplayDependencies = {}): Promise<TeamFitReportDisplayRecord | null> {
  if (!isNonEmptyString(input.organizationId)) {
    throw new Error("organizationId is required.");
  }

  if (!isNonEmptyString(input.teamId)) {
    throw new Error("teamId is required.");
  }

  if (!isNonEmptyString(input.participantId)) {
    throw new Error("participantId is required.");
  }

  if (!isNonEmptyString(input.teamFitReportId)) {
    throw new Error("teamFitReportId is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const validateSnapshot = deps.validateSnapshot ?? validateTeamFitReportSnapshot;

  const row = await loadReportRow({
    organizationId: input.organizationId,
    teamId: input.teamId,
    participantId: input.participantId,
    teamFitReportId: input.teamFitReportId,
    supabase,
  });

  if (!row) {
    return null;
  }

  const [team, participant] = await Promise.all([
    loadTeamRow({
      organizationId: input.organizationId,
      teamId: input.teamId,
      supabase,
    }),
    loadParticipantRow({
      organizationId: input.organizationId,
      participantId: input.participantId,
      supabase,
    }),
  ]);

  if (!team || !participant) {
    return null;
  }

  if (row.report_status !== "ready") {
    return buildDisplayRecord({
      row,
      team,
      participant,
      status: row.report_status,
      reportSnapshot: null,
    });
  }

  if (!row.report_snapshot) {
    return null;
  }

  const validation = validateSnapshot(row.report_snapshot);

  if (!validation.ok) {
    return null;
  }

  return buildDisplayRecord({
    row,
    team,
    participant,
    status: "ready",
    reportSnapshot: validation.snapshot,
  });
}
