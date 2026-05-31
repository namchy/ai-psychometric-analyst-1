import "server-only";

import {
  TEAM_FIT_REPORT_TYPE,
  TEAM_FIT_REPORT_VERSION,
  type TeamFitReportStatus,
} from "@/lib/b2b/team-fit-report-lifecycle";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamFitReportListDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

type TeamFitReportListRow = {
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
  updated_at: string;
};

type TeamRow = {
  id: string;
  organization_id: string;
  name: string | null;
};

export type TeamFitReportListEntry = {
  id: string;
  organizationId: string;
  teamId: string;
  participantId: string;
  teamName: string | null;
  reportType: typeof TEAM_FIT_REPORT_TYPE;
  reportVersion: typeof TEAM_FIT_REPORT_VERSION;
  status: TeamFitReportStatus;
  statusLabel: "Spremno" | "Čeka obradu" | "U obradi" | "Nije pripremljen";
  safeStatusMessage: string;
  createdAt: string;
  updatedAt: string;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  hasInputSnapshot: boolean;
  hasReportSnapshot: boolean;
  href: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getSafeStatusMessage(status: TeamFitReportStatus): string {
  switch (status) {
    case "queued":
      return "Izvještaj je pripremljen za obradu.";
    case "processing":
      return "Izvještaj je trenutno u obradi.";
    case "failed":
      return "Izvještaj nije pripremljen. Možeš ga vratiti u red za pripremu.";
    case "ready":
    default:
      return "Izvještaj je spreman za pregled.";
  }
}

function getStatusLabel(status: TeamFitReportStatus): TeamFitReportListEntry["statusLabel"] {
  switch (status) {
    case "queued":
      return "Čeka obradu";
    case "processing":
      return "U obradi";
    case "failed":
      return "Nije pripremljen";
    case "ready":
    default:
      return "Spremno";
  }
}

function buildHref(input: {
  teamId: string;
  participantId: string;
  teamFitReportId: string;
}): string {
  return `/dashboard/teams/${input.teamId}/participants/${input.participantId}/team-fit-reports/${input.teamFitReportId}`;
}

function mapEntry(row: TeamFitReportListRow, teamName: string | null): TeamFitReportListEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    teamId: row.team_id,
    participantId: row.participant_id,
    teamName,
    reportType: TEAM_FIT_REPORT_TYPE,
    reportVersion: TEAM_FIT_REPORT_VERSION,
    status: row.report_status,
    statusLabel: getStatusLabel(row.report_status),
    safeStatusMessage: getSafeStatusMessage(row.report_status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    hasInputSnapshot: row.input_snapshot !== null,
    hasReportSnapshot: row.report_snapshot !== null,
    href: buildHref({
      teamId: row.team_id,
      participantId: row.participant_id,
      teamFitReportId: row.id,
    }),
  };
}

export async function listTeamFitReportEntries(input: {
  organizationId: string;
  participantId: string;
  teamId?: string;
}, deps: TeamFitReportListDependencies = {}): Promise<TeamFitReportListEntry[]> {
  if (!isNonEmptyString(input.organizationId)) {
    throw new Error("organizationId is required.");
  }

  if (!isNonEmptyString(input.participantId)) {
    throw new Error("participantId is required.");
  }

  if (input.teamId !== undefined && !isNonEmptyString(input.teamId)) {
    throw new Error("teamId must be a non-empty string when provided.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();

  let query = supabase
    .from("team_fit_reports")
    .select(
      "id, organization_id, team_id, participant_id, report_type, report_version, report_status, input_snapshot, report_snapshot, queued_at, started_at, completed_at, failed_at, created_at, updated_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("participant_id", input.participantId)
    .eq("report_type", TEAM_FIT_REPORT_TYPE)
    .eq("report_version", TEAM_FIT_REPORT_VERSION)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (input.teamId) {
    query = query.eq("team_id", input.teamId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load Team Fit report list rows: ${error.message}`);
  }

  const rows = (data ?? []) as TeamFitReportListRow[];

  if (rows.length === 0) {
    return [];
  }

  const teamIds = Array.from(new Set(rows.map((row) => row.team_id))).sort();
  const { data: teamRows, error: teamError } = await supabase
    .from("teams")
    .select("id, organization_id, name")
    .eq("organization_id", input.organizationId)
    .in("id", teamIds);

  if (teamError) {
    throw new Error(`Failed to load Team Fit list team rows: ${teamError.message}`);
  }

  const teamNameById = new Map(
    ((teamRows ?? []) as TeamRow[]).map((row) => [row.id, row.name ?? null]),
  );

  return rows
    .filter((row) => teamNameById.has(row.team_id))
    .map((row) => mapEntry(row, teamNameById.get(row.team_id) ?? null));
}
