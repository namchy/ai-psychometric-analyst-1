import "server-only";

import {
  loadIndividualDevelopmentProfileAssessmentReportRowById,
  loadLatestIndividualDevelopmentProfileAssessmentReportRow,
  type IndividualDevelopmentProfileAssessmentReportRecord,
  type IndividualDevelopmentProfileAssessmentReportStatus,
} from "@/lib/assessment/individual-development-profile-lifecycle";
import {
  validateIndividualDevelopmentProfileSnapshot,
  type IndividualDevelopmentProfileSnapshot,
} from "@/lib/assessment/individual-development-profile-contract";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type IndividualDevelopmentProfileDisplayDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
  validateSnapshot?: typeof validateIndividualDevelopmentProfileSnapshot;
};

type IndividualDevelopmentProfileDisplayStatus =
  | IndividualDevelopmentProfileAssessmentReportStatus
  | "missing"
  | "invalid";

type IndividualDevelopmentProfileDisplayMetadata = {
  generatorType: string | null;
  generatorVersion: string | null;
  modelName: string | null;
};

type IndividualDevelopmentProfileDisplayBase = {
  ok: true;
  status: IndividualDevelopmentProfileDisplayStatus;
  reportId: string | null;
  assessmentAssignmentId: string | null;
  participantId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  generatedAt: string | null;
  hasInputSnapshot: boolean;
  hasReportSnapshot: boolean;
  safeStatusMessage: string;
};

export type IndividualDevelopmentProfileDisplayResult =
  | (IndividualDevelopmentProfileDisplayBase & {
      status: "missing";
      reportSnapshot: null;
      metadata: null;
    })
  | (IndividualDevelopmentProfileDisplayBase & {
      status: "queued" | "processing" | "failed";
      reportSnapshot: null;
      metadata: {
        generatorType: string | null;
        generatorVersion: string | null;
        modelName: string | null;
      };
    })
  | (IndividualDevelopmentProfileDisplayBase & {
      status: "ready";
      reportSnapshot: IndividualDevelopmentProfileSnapshot;
      metadata: {
        generatorType: string | null;
        generatorVersion: string | null;
        modelName: string | null;
      };
    })
  | (IndividualDevelopmentProfileDisplayBase & {
      status: "invalid";
      reportSnapshot: null;
      metadata: {
        generatorType: string | null;
        generatorVersion: string | null;
        modelName: string | null;
      };
      validationErrors: string[];
    })
  | {
      ok: false;
      reason: "invalid_payload" | "report_load_failed";
      details: string;
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getSafeStatusMessage(status: IndividualDevelopmentProfileDisplayStatus): string {
  switch (status) {
    case "queued":
      return "Izvještaj je pripremljen za obradu.";
    case "processing":
      return "Izvještaj je trenutno u obradi.";
    case "failed":
      return "Izvještaj trenutno nije dostupan za pregled.";
    case "invalid":
      return "Izvještaj trenutno nije dostupan za pregled.";
    case "ready":
      return "Izvještaj je spreman za pregled.";
    case "missing":
    default:
      return "Izvještaj nije pronađen.";
  }
}

function buildMetadata(
  report: IndividualDevelopmentProfileAssessmentReportRecord,
): IndividualDevelopmentProfileDisplayMetadata {
  return {
    generatorType: report.generator_type,
    generatorVersion: report.generator_version,
    modelName: report.model_name,
  };
}

function buildBase<TStatus extends IndividualDevelopmentProfileDisplayStatus>(
  report: IndividualDevelopmentProfileAssessmentReportRecord | null,
  status: TStatus,
): IndividualDevelopmentProfileDisplayBase & { status: TStatus } {
  return {
    ok: true,
    status,
    reportId: report?.id ?? null,
    assessmentAssignmentId: report?.assessment_assignment_id ?? null,
    participantId: report?.participant_id ?? null,
    createdAt: report?.created_at ?? null,
    updatedAt: report?.updated_at ?? null,
    queuedAt: report?.queued_at ?? null,
    startedAt: report?.started_at ?? null,
    completedAt: report?.completed_at ?? null,
    generatedAt: report?.generated_at ?? null,
    hasInputSnapshot: report?.input_snapshot !== null,
    hasReportSnapshot: report?.report_snapshot !== null,
    safeStatusMessage: getSafeStatusMessage(status),
  };
}

function buildMissingDisplayResult(): Extract<
  IndividualDevelopmentProfileDisplayResult,
  { ok: true; status: "missing" }
> {
  return {
    ...buildBase(null, "missing"),
    reportSnapshot: null,
    metadata: null,
  };
}

function buildNonReadyDisplayResult(
  report: IndividualDevelopmentProfileAssessmentReportRecord,
  status: "queued" | "processing" | "failed",
): Extract<
  IndividualDevelopmentProfileDisplayResult,
  { ok: true; status: "queued" | "processing" | "failed" }
> {
  return {
    ...buildBase(report, status),
    reportSnapshot: null,
    metadata: buildMetadata(report),
  };
}

function buildInvalidDisplayResult(
  report: IndividualDevelopmentProfileAssessmentReportRecord,
  validationErrors: string[],
): Extract<
  IndividualDevelopmentProfileDisplayResult,
  { ok: true; status: "invalid" }
> {
  return {
    ...buildBase(report, "invalid"),
    reportSnapshot: null,
    metadata: buildMetadata(report),
    validationErrors,
  };
}

function buildReadyDisplayResult(
  report: IndividualDevelopmentProfileAssessmentReportRecord,
  reportSnapshot: IndividualDevelopmentProfileSnapshot,
): Extract<
  IndividualDevelopmentProfileDisplayResult,
  { ok: true; status: "ready" }
> {
  return {
    ...buildBase(report, "ready"),
    reportSnapshot,
    metadata: buildMetadata(report),
  };
}

export async function loadIndividualDevelopmentProfileDisplay(input: {
  assessmentAssignmentId?: string;
  assessmentReportId?: string;
  organizationId: string;
  participantId?: string;
}, deps: IndividualDevelopmentProfileDisplayDependencies = {}): Promise<IndividualDevelopmentProfileDisplayResult> {
  if (!isNonEmptyString(input.organizationId)) {
    return {
      ok: false,
      reason: "invalid_payload",
      details: "organizationId is required.",
    };
  }

  if (
    !isNonEmptyString(input.assessmentAssignmentId) &&
    !isNonEmptyString(input.assessmentReportId)
  ) {
    return {
      ok: false,
      reason: "invalid_payload",
      details: "assessmentAssignmentId or assessmentReportId is required.",
    };
  }

  const validateSnapshot = deps.validateSnapshot ?? validateIndividualDevelopmentProfileSnapshot;
  const lifecycleDeps = {
    supabase: deps.supabase ?? createSupabaseAdminClient(),
  };

  const rowResult = isNonEmptyString(input.assessmentReportId)
    ? await loadIndividualDevelopmentProfileAssessmentReportRowById(
        {
          assessmentReportId: input.assessmentReportId,
          organizationId: input.organizationId,
          participantId: input.participantId,
        },
        lifecycleDeps,
      )
    : await loadLatestIndividualDevelopmentProfileAssessmentReportRow(
        {
          assessmentAssignmentId: input.assessmentAssignmentId!,
          organizationId: input.organizationId,
          participantId: input.participantId,
        },
        lifecycleDeps,
      );

  if (!rowResult.ok) {
    return rowResult;
  }

  if (!rowResult.report) {
    return buildMissingDisplayResult();
  }

  if (rowResult.report.report_status === "queued") {
    return buildNonReadyDisplayResult(rowResult.report, "queued");
  }

  if (rowResult.report.report_status === "processing") {
    return buildNonReadyDisplayResult(rowResult.report, "processing");
  }

  if (rowResult.report.report_status === "failed") {
    return buildNonReadyDisplayResult(rowResult.report, "failed");
  }

  const validation = validateSnapshot(rowResult.report.report_snapshot);

  if (!validation.ok) {
    return buildInvalidDisplayResult(rowResult.report, validation.errors);
  }

  return buildReadyDisplayResult(rowResult.report, validation.value);
}
