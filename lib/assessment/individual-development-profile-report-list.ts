import "server-only";

import {
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE,
  type IndividualDevelopmentProfileAssessmentReportStatus,
} from "@/lib/assessment/individual-development-profile-lifecycle";
import {
  validateIndividualDevelopmentProfileSnapshot,
  type IndividualDevelopmentProfileSnapshot,
} from "@/lib/assessment/individual-development-profile-contract";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type IndividualDevelopmentProfileReportListDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
  validateSnapshot?: typeof validateIndividualDevelopmentProfileSnapshot;
};

type IndividualDevelopmentProfileEligibleAssignmentRow = {
  id: string;
  organization_id: string;
  participant_id: string;
  status: "active" | "completed" | string;
  created_at: string;
  updated_at: string;
};

type IndividualDevelopmentProfileReportListRow = {
  id: string;
  assessment_assignment_id: string;
  organization_id: string;
  participant_id: string;
  report_status: IndividualDevelopmentProfileAssessmentReportStatus;
  input_snapshot: Record<string, unknown> | null;
  report_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  generated_at: string | null;
};

export type IndividualDevelopmentProfileReportListStatus =
  | IndividualDevelopmentProfileAssessmentReportStatus
  | "missing_eligible"
  | "invalid";

export type IndividualDevelopmentProfileReportListEntry = {
  id: string;
  assessmentAssignmentId: string;
  organizationId: string;
  participantId: string;
  status: IndividualDevelopmentProfileReportListStatus;
  statusLabel:
    | "Spremno"
    | "Čeka obradu"
    | "U obradi"
    | "Nije dostupno"
    | "Nije pripremljeno";
  safeStatusMessage: string;
  createdAt: string;
  updatedAt: string;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  generatedAt: string | null;
  hasInputSnapshot: boolean;
  hasReportSnapshot: boolean;
  href: string | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getSafeStatusMessage(status: IndividualDevelopmentProfileReportListStatus): string {
  switch (status) {
    case "missing_eligible":
      return "Individualni razvojni profil još nije pripremljen za ovaj procjenski ciklus.";
    case "queued":
      return "Izvještaj je u redu čekanja. Obrada još nije pokrenuta.";
    case "processing":
      return "Izvještaj je trenutno u obradi.";
    case "failed":
    case "invalid":
      return "Izvještaj trenutno nije dostupan za pregled.";
    case "ready":
    default:
      return "Izvještaj je spreman za pregled.";
  }
}

function getStatusLabel(
  status: IndividualDevelopmentProfileReportListStatus,
): IndividualDevelopmentProfileReportListEntry["statusLabel"] {
  switch (status) {
    case "missing_eligible":
      return "Nije pripremljeno";
    case "queued":
      return "Čeka obradu";
    case "processing":
      return "U obradi";
    case "failed":
    case "invalid":
      return "Nije dostupno";
    case "ready":
    default:
      return "Spremno";
  }
}

function mapMissingEligibleEntry(
  assignment: IndividualDevelopmentProfileEligibleAssignmentRow,
): IndividualDevelopmentProfileReportListEntry {
  return {
    id: `missing-idp-${assignment.id}`,
    assessmentAssignmentId: assignment.id,
    organizationId: assignment.organization_id,
    participantId: assignment.participant_id,
    status: "missing_eligible",
    statusLabel: getStatusLabel("missing_eligible"),
    safeStatusMessage: getSafeStatusMessage("missing_eligible"),
    createdAt: assignment.created_at,
    updatedAt: assignment.updated_at,
    queuedAt: null,
    startedAt: null,
    completedAt: null,
    generatedAt: null,
    hasInputSnapshot: false,
    hasReportSnapshot: false,
    href: null,
  };
}

function buildHref(assessmentReportId: string): string {
  return `/dashboard/individual-development-profile-reports/${assessmentReportId}`;
}

function resolveEntryStatus(input: {
  row: IndividualDevelopmentProfileReportListRow;
  validateSnapshot: typeof validateIndividualDevelopmentProfileSnapshot;
}): IndividualDevelopmentProfileReportListStatus {
  if (input.row.report_status !== "ready") {
    return input.row.report_status;
  }

  const validationResult = input.validateSnapshot(
    input.row.report_snapshot as IndividualDevelopmentProfileSnapshot,
  );

  return validationResult.ok ? "ready" : "invalid";
}

function mapEntry(input: {
  row: IndividualDevelopmentProfileReportListRow;
  validateSnapshot: typeof validateIndividualDevelopmentProfileSnapshot;
}): IndividualDevelopmentProfileReportListEntry {
  const status = resolveEntryStatus(input);

  return {
    id: input.row.id,
    assessmentAssignmentId: input.row.assessment_assignment_id,
    organizationId: input.row.organization_id,
    participantId: input.row.participant_id,
    status,
    statusLabel: getStatusLabel(status),
    safeStatusMessage: getSafeStatusMessage(status),
    createdAt: input.row.created_at,
    updatedAt: input.row.updated_at,
    queuedAt: input.row.queued_at,
    startedAt: input.row.started_at,
    completedAt: input.row.completed_at,
    generatedAt: input.row.generated_at,
    hasInputSnapshot: input.row.input_snapshot !== null,
    hasReportSnapshot: input.row.report_snapshot !== null,
    href: buildHref(input.row.id),
  };
}

export async function listIndividualDevelopmentProfileReportEntries(
  input: {
    organizationId: string;
    participantId: string;
  },
  deps: IndividualDevelopmentProfileReportListDependencies = {},
): Promise<IndividualDevelopmentProfileReportListEntry[]> {
  if (!isNonEmptyString(input.organizationId)) {
    throw new Error("organizationId is required.");
  }

  if (!isNonEmptyString(input.participantId)) {
    throw new Error("participantId is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const validateSnapshot = deps.validateSnapshot ?? validateIndividualDevelopmentProfileSnapshot;

  const { data, error } = await supabase
    .from("assessment_reports")
    .select(
      "id, assessment_assignment_id, organization_id, participant_id, report_status, input_snapshot, report_snapshot, created_at, updated_at, queued_at, started_at, completed_at, generated_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("participant_id", input.participantId)
    .eq("report_type", INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE)
    .eq("audience", INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE)
    .eq("source_type", INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw new Error(`Failed to load Individual Development Profile list rows: ${error.message}`);
  }

  const entries = ((data ?? []) as IndividualDevelopmentProfileReportListRow[]).map((row) =>
    mapEntry({ row, validateSnapshot }),
  );

  if (entries.length > 0) {
    return entries;
  }

  const { data: assignmentData, error: assignmentError } = await supabase
    .from("assessment_assignments")
    .select("id, organization_id, participant_id, status, created_at, updated_at")
    .eq("organization_id", input.organizationId)
    .eq("participant_id", input.participantId)
    .eq("assignment_type", "standard_battery")
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assignmentError) {
    throw new Error(
      `Failed to load Individual Development Profile assignment boundary: ${assignmentError.message}`,
    );
  }

  if (!assignmentData) {
    return [];
  }

  return [
    mapMissingEligibleEntry(assignmentData as IndividualDevelopmentProfileEligibleAssignmentRow),
  ];
}
