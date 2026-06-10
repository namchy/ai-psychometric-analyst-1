"use server";

import { revalidatePath } from "next/cache";
import {
  processIndividualDevelopmentProfileAssessmentReport,
  type ProcessIndividualDevelopmentProfileAssessmentReportResult,
} from "@/lib/assessment/individual-development-profile-processor";
import {
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE,
  type IndividualDevelopmentProfileAssessmentReportStatus,
  queueIndividualDevelopmentProfileAssessmentReport,
  resetIndividualDevelopmentProfileAssessmentReportToQueued,
} from "@/lib/assessment/individual-development-profile-lifecycle";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUserForAction,
} from "@/lib/auth/session";
import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type IndividualDevelopmentProfileProcessActionInput = {
  assessmentReportId: string;
  participantId?: string | null;
};

type IndividualDevelopmentProfileQueueActionInput = {
  assessmentAssignmentId: string;
  participantId?: string | null;
};

type IndividualDevelopmentProfileQueueActionStatus =
  | "queued"
  | "already_queued"
  | "already_processing"
  | "already_ready"
  | "already_failed"
  | "unauthorized"
  | "error";

export type IndividualDevelopmentProfileQueueActionResult =
  | {
      ok: true;
      status:
        | "queued"
        | "already_queued"
        | "already_processing"
        | "already_ready"
        | "already_failed";
      message: string;
      reportId: string;
      participantId: string;
    }
  | {
      ok: false;
      status: Extract<IndividualDevelopmentProfileQueueActionStatus, "unauthorized" | "error">;
      message: string;
      reportId: string | null;
      participantId: string | null;
      lifecycleReason?:
        | "invalid_payload"
        | "assignment_not_found"
        | "assignment_load_failed"
        | "report_load_failed"
        | "report_insert_failed"
        | "report_update_failed";
    };

type IndividualDevelopmentProfileProcessActionStatus =
  | "processed"
  | "already_processing"
  | "already_ready"
  | "failed_not_processable"
  | "invalid_not_processable"
  | "unsupported_report"
  | "unauthorized"
  | "failed";

export type IndividualDevelopmentProfileProcessActionResult =
  | {
      ok: true;
      status: "processed";
      message: string;
      reportId: string;
      participantId: string;
    }
  | {
      ok: false;
      status: Exclude<IndividualDevelopmentProfileProcessActionStatus, "processed">;
      message: string;
      reportId: string | null;
      participantId: string | null;
      processorReason?:
        | "invalid_payload"
        | "report_not_found"
        | "already_processing"
        | "already_ready"
        | "failed_not_processable"
        | "not_processable"
        | "update_failed"
        | "input_snapshot_failed"
        | "provider_failed"
        | "validation_failed"
        | "ready_update_failed"
        | "fail_transition_failed";
    };

type IndividualDevelopmentProfileProcessActionContext = {
  id: string;
  organizationId: string;
  participantId: string;
  reportType: string;
  audience: string;
  sourceType: string;
  reportStatus: IndividualDevelopmentProfileAssessmentReportStatus | string;
};

type IndividualDevelopmentProfileProcessActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  getActiveOrganization?: typeof getActiveOrganizationForUser;
  loadReportContext?: (
    input: Pick<IndividualDevelopmentProfileProcessActionInput, "assessmentReportId">,
  ) => Promise<IndividualDevelopmentProfileProcessActionContext | null>;
  processReport?: typeof processIndividualDevelopmentProfileAssessmentReport;
  revalidate?: typeof revalidatePath;
};

type IndividualDevelopmentProfileQueueActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  getActiveOrganization?: typeof getActiveOrganizationForUser;
  queueReport?: typeof queueIndividualDevelopmentProfileAssessmentReport;
  revalidate?: typeof revalidatePath;
};

type IndividualDevelopmentProfileResetActionInput = {
  assessmentReportId: string;
  participantId?: string | null;
};

type IndividualDevelopmentProfileResetActionStatus =
  | "queued"
  | "already_queued"
  | "processing_not_resettable"
  | "ready_not_resettable"
  | "not_resettable"
  | "unsupported_report"
  | "unauthorized"
  | "error";

export type IndividualDevelopmentProfileResetActionResult =
  | {
      ok: true;
      status: "queued";
      message: string;
      reportId: string;
      participantId: string;
    }
  | {
      ok: false;
      status: Exclude<IndividualDevelopmentProfileResetActionStatus, "queued">;
      message: string;
      reportId: string | null;
      participantId: string | null;
      lifecycleReason?:
        | "invalid_payload"
        | "assignment_not_found"
        | "assignment_load_failed"
        | "report_load_failed"
        | "report_insert_failed"
        | "report_update_failed";
    };

type IndividualDevelopmentProfileResetActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  getActiveOrganization?: typeof getActiveOrganizationForUser;
  loadReportContext?: (
    input: Pick<IndividualDevelopmentProfileResetActionInput, "assessmentReportId">,
  ) => Promise<IndividualDevelopmentProfileProcessActionContext | null>;
  resetReport?: typeof resetIndividualDevelopmentProfileAssessmentReportToQueued;
  revalidate?: typeof revalidatePath;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function loadIndividualDevelopmentProfileProcessActionContext(input: {
  assessmentReportId: string;
}): Promise<IndividualDevelopmentProfileProcessActionContext | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("assessment_reports")
    .select("id, organization_id, participant_id, report_type, audience, source_type, report_status")
    .eq("id", input.assessmentReportId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    organizationId: data.organization_id,
    participantId: data.participant_id,
    reportType: data.report_type,
    audience: data.audience,
    sourceType: data.source_type,
    reportStatus: data.report_status,
  };
}

function revalidateIndividualDevelopmentProfilePaths(input: {
  participantId: string;
  assessmentReportId: string;
  revalidate: typeof revalidatePath;
}) {
  input.revalidate(`/dashboard/participants/${input.participantId}/reports`);
  input.revalidate(
    `/dashboard/individual-development-profile-reports/${input.assessmentReportId}`,
  );
}

function revalidateIndividualDevelopmentProfileParticipantReportsPath(input: {
  participantId: string;
  revalidate: typeof revalidatePath;
}) {
  input.revalidate(`/dashboard/participants/${input.participantId}/reports`);
}

function mapQueueActionStatus(
  action: "queued" | "noop_queued" | "noop_processing" | "noop_ready" | "noop_failed",
): Exclude<IndividualDevelopmentProfileQueueActionStatus, "unauthorized" | "error"> {
  switch (action) {
    case "noop_queued":
      return "already_queued";
    case "noop_processing":
      return "already_processing";
    case "noop_ready":
      return "already_ready";
    case "noop_failed":
      return "already_failed";
    case "queued":
    default:
      return "queued";
  }
}

function getQueueActionMessage(
  status: Exclude<IndividualDevelopmentProfileQueueActionStatus, "unauthorized" | "error">,
): string {
  switch (status) {
    case "already_queued":
      return "Individualni razvojni profil je već u redu čekanja.";
    case "already_processing":
      return "Priprema Individualnog razvojnog profila je već u toku.";
    case "already_ready":
      return "Individualni razvojni profil je već spreman za pregled.";
    case "already_failed":
      return "Individualni razvojni profil već postoji i trenutno nije dostupan.";
    case "queued":
    default:
      return "Individualni razvojni profil je dodat u red za pripremu.";
  }
}

export async function queueIndividualDevelopmentProfileReportAction(
  input: IndividualDevelopmentProfileQueueActionInput,
  deps: IndividualDevelopmentProfileQueueActionDependencies = {},
): Promise<IndividualDevelopmentProfileQueueActionResult> {
  if (!isNonEmptyString(input.assessmentAssignmentId)) {
    return {
      ok: false,
      status: "error",
      message: "Individualni razvojni profil nije moguće pripremiti bez procjenskog ciklusa.",
      reportId: null,
      participantId: input.participantId ?? null,
      lifecycleReason: "invalid_payload",
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const getActiveOrganization =
    deps.getActiveOrganization ?? getActiveOrganizationForUser;
  const queueReport = deps.queueReport ?? queueIndividualDevelopmentProfileAssessmentReport;
  const revalidate = deps.revalidate ?? revalidatePath;

  try {
    const user = await requireUser();
    const organization = await getActiveOrganization(user.id);

    if (!organization) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Individualni razvojni profil nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        participantId: input.participantId ?? null,
      };
    }

    const result = await queueReport({
      assessmentAssignmentId: input.assessmentAssignmentId,
      organizationId: organization.id,
      participantId: input.participantId ?? undefined,
      requestedByUserId: user.id,
    });

    if (!result.ok) {
      return {
        ok: false,
        status: result.reason === "assignment_not_found" ? "unauthorized" : "error",
        message: "Individualni razvojni profil nije moguće dodati u red za pripremu.",
        reportId: null,
        participantId: input.participantId ?? null,
        lifecycleReason: result.reason,
      };
    }

    const report = result.report;

    if (!report) {
      return {
        ok: false,
        status: "error",
        message: "Individualni razvojni profil nije moguće dodati u red za pripremu.",
        reportId: null,
        participantId: input.participantId ?? result.assignment.participant_id,
        lifecycleReason: "report_insert_failed",
      };
    }

    if (result.action === "queued") {
      revalidateIndividualDevelopmentProfileParticipantReportsPath({
        participantId: report.participant_id,
        revalidate,
      });
    } else {
      revalidateIndividualDevelopmentProfilePaths({
        participantId: report.participant_id,
        assessmentReportId: report.id,
        revalidate,
      });
    }

    const status = mapQueueActionStatus(result.action);

    return {
      ok: true,
      status,
      message: getQueueActionMessage(status),
      reportId: report.id,
      participantId: report.participant_id,
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Authentication required.",
        reportId: null,
        participantId: input.participantId ?? null,
      };
    }

    return {
      ok: false,
      status: "error",
      message: "Individualni razvojni profil nije moguće dodati u red za pripremu.",
      reportId: null,
      participantId: input.participantId ?? null,
    };
  }
}

export async function resetIndividualDevelopmentProfileReportAction(
  input: IndividualDevelopmentProfileResetActionInput,
  deps: IndividualDevelopmentProfileResetActionDependencies = {},
): Promise<IndividualDevelopmentProfileResetActionResult> {
  if (!isNonEmptyString(input.assessmentReportId)) {
    return {
      ok: false,
      status: "error",
      message: "Individualni razvojni profil nije moguće vratiti bez identifikatora.",
      reportId: null,
      participantId: null,
      lifecycleReason: "invalid_payload",
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const getActiveOrganization =
    deps.getActiveOrganization ?? getActiveOrganizationForUser;
  const loadReportContext =
    deps.loadReportContext ?? loadIndividualDevelopmentProfileProcessActionContext;
  const resetReport =
    deps.resetReport ?? resetIndividualDevelopmentProfileAssessmentReportToQueued;
  const revalidate = deps.revalidate ?? revalidatePath;

  try {
    const user = await requireUser();
    const organization = await getActiveOrganization(user.id);

    if (!organization) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Individualni razvojni profil nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        participantId: null,
      };
    }

    const reportContext = await loadReportContext({
      assessmentReportId: input.assessmentReportId,
    });

    if (!reportContext || reportContext.organizationId !== organization.id) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Individualni razvojni profil nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        participantId: null,
      };
    }

    if (
      isNonEmptyString(input.participantId) &&
      input.participantId !== reportContext.participantId
    ) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Individualni razvojni profil nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        participantId: null,
      };
    }

    if (
      reportContext.reportType !== INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE ||
      reportContext.audience !== INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE ||
      reportContext.sourceType !== INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE
    ) {
      return {
        ok: false,
        status: "unsupported_report",
        message: "Ovaj zapis nije podržan za Individualni razvojni profil retry/reset.",
        reportId: reportContext.id,
        participantId: reportContext.participantId,
      };
    }

    if (reportContext.reportStatus === "queued") {
      return {
        ok: false,
        status: "already_queued",
        message: "Individualni razvojni profil je već u queued stanju.",
        reportId: reportContext.id,
        participantId: reportContext.participantId,
      };
    }

    if (reportContext.reportStatus === "processing") {
      return {
        ok: false,
        status: "processing_not_resettable",
        message: "Individualni razvojni profil koji je u obradi nije moguće vratiti u queued stanje.",
        reportId: reportContext.id,
        participantId: reportContext.participantId,
      };
    }

    if (reportContext.reportStatus === "ready") {
      return {
        ok: false,
        status: "ready_not_resettable",
        message: "Spreman Individualni razvojni profil nije moguće vratiti u queued stanje.",
        reportId: reportContext.id,
        participantId: reportContext.participantId,
      };
    }

    if (reportContext.reportStatus !== "failed") {
      return {
        ok: false,
        status: "not_resettable",
        message: "Samo failed Individualni razvojni profil može biti vraćen u queued stanje.",
        reportId: reportContext.id,
        participantId: reportContext.participantId,
      };
    }

    const result = await resetReport({
      assessmentReportId: reportContext.id,
      organizationId: organization.id,
      participantId: reportContext.participantId,
      requestedByUserId: user.id,
    });

    if (!result.ok) {
      if (result.reason === "report_load_failed") {
        return {
          ok: false,
          status: "error",
          message: "Vraćanje Individualnog razvojnog profila u queued stanje nije dostupno.",
          reportId: reportContext.id,
          participantId: reportContext.participantId,
          lifecycleReason: result.reason,
        };
      }

      if (result.reason === "report_update_failed") {
        return {
          ok: false,
          status: "error",
          message: "Vraćanje Individualnog razvojnog profila u queued stanje nije uspjelo.",
          reportId: reportContext.id,
          participantId: reportContext.participantId,
          lifecycleReason: result.reason,
        };
      }

      return {
        ok: false,
        status: "not_resettable",
        message: "Individualni razvojni profil više nije u failed stanju i nije moguće vratiti ga u queued.",
        reportId: reportContext.id,
        participantId: reportContext.participantId,
        lifecycleReason: result.reason,
      };
    }

    if (!result.report) {
      return {
        ok: false,
        status: "error",
        message: "Vraćanje Individualnog razvojnog profila u queued stanje nije dostupno.",
        reportId: reportContext.id,
        participantId: reportContext.participantId,
        lifecycleReason: "report_update_failed",
      };
    }

    revalidateIndividualDevelopmentProfilePaths({
      participantId: result.report.participant_id,
      assessmentReportId: result.report.id,
      revalidate,
    });

    return {
      ok: true,
      status: "queued",
      message: "Individualni razvojni profil je vraćen u queued stanje i spreman za novu ručnu pripremu.",
      reportId: result.report.id,
      participantId: result.report.participant_id,
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Authentication required.",
        reportId: input.assessmentReportId,
        participantId: input.participantId ?? null,
      };
    }

    return {
      ok: false,
      status: "error",
      message: "Vraćanje Individualnog razvojnog profila u queued stanje nije dostupno.",
      reportId: input.assessmentReportId,
      participantId: input.participantId ?? null,
    };
  }
}

export async function processIndividualDevelopmentProfileReportAction(
  input: IndividualDevelopmentProfileProcessActionInput,
  deps: IndividualDevelopmentProfileProcessActionDependencies = {},
): Promise<IndividualDevelopmentProfileProcessActionResult> {
  if (!isNonEmptyString(input.assessmentReportId)) {
    return {
      ok: false,
      status: "failed",
      message: "Individualni razvojni profil nije moguće pripremiti bez identifikatora.",
      reportId: null,
      participantId: null,
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const getActiveOrganization =
    deps.getActiveOrganization ?? getActiveOrganizationForUser;
  const loadReportContext =
    deps.loadReportContext ?? loadIndividualDevelopmentProfileProcessActionContext;
  const processReport =
    deps.processReport ?? processIndividualDevelopmentProfileAssessmentReport;
  const revalidate = deps.revalidate ?? revalidatePath;

  try {
    const user = await requireUser();
    const organization = await getActiveOrganization(user.id);

    if (!organization) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Individualni razvojni profil nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        participantId: null,
      };
    }

    const reportContext = await loadReportContext({
      assessmentReportId: input.assessmentReportId,
    });

    if (!reportContext || reportContext.organizationId !== organization.id) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Individualni razvojni profil nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        participantId: null,
      };
    }

    if (
      isNonEmptyString(input.participantId) &&
      input.participantId !== reportContext.participantId
    ) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Individualni razvojni profil nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        participantId: null,
      };
    }

    if (
      reportContext.reportType !== INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE ||
      reportContext.audience !== INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE ||
      reportContext.sourceType !== INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE
    ) {
      return {
        ok: false,
        status: "unsupported_report",
        message: "Ovaj zapis nije podržan za ručnu pripremu Individualnog razvojnog profila.",
        reportId: reportContext.id,
        participantId: reportContext.participantId,
      };
    }

    switch (reportContext.reportStatus) {
      case "processing":
        return {
          ok: false,
          status: "already_processing",
          message: "Priprema Individualnog razvojnog profila je već u toku.",
          reportId: reportContext.id,
          participantId: reportContext.participantId,
        };
      case "ready":
        return {
          ok: false,
          status: "already_ready",
          message: "Individualni razvojni profil je već spreman za pregled.",
          reportId: reportContext.id,
          participantId: reportContext.participantId,
        };
      case "failed":
        return {
          ok: false,
          status: "failed_not_processable",
          message:
            "Neuspješan Individualni razvojni profil se u ovom slice-u ne može ponovo pripremiti.",
          reportId: reportContext.id,
          participantId: reportContext.participantId,
        };
      case "queued":
        break;
      default:
        return {
          ok: false,
          status: "invalid_not_processable",
          message:
            "Postojeći Individualni razvojni profil nije u stanju koje podržava ručnu pripremu.",
          reportId: reportContext.id,
          participantId: reportContext.participantId,
        };
    }

    const result = await processReport({
      assessmentReportId: reportContext.id,
      organizationId: organization.id,
      participantId: reportContext.participantId,
    });

    if (result.ok) {
      revalidateIndividualDevelopmentProfilePaths({
        participantId: reportContext.participantId,
        assessmentReportId: reportContext.id,
        revalidate,
      });

      return {
        ok: true,
        status: "processed",
        message: "Individualni razvojni profil je pripremljen i spreman za pregled.",
        reportId: reportContext.id,
        participantId: reportContext.participantId,
      };
    }

    if (result.reason === "already_processing") {
      return {
        ok: false,
        status: "already_processing",
        message: "Priprema Individualnog razvojnog profila je već u toku.",
        reportId: reportContext.id,
        participantId: reportContext.participantId,
        processorReason: result.reason,
      };
    }

    if (result.reason === "already_ready") {
      revalidateIndividualDevelopmentProfilePaths({
        participantId: reportContext.participantId,
        assessmentReportId: reportContext.id,
        revalidate,
      });

      return {
        ok: false,
        status: "already_ready",
        message: "Individualni razvojni profil je već spreman za pregled.",
        reportId: reportContext.id,
        participantId: reportContext.participantId,
        processorReason: result.reason,
      };
    }

    if (result.reason === "failed_not_processable") {
      return {
        ok: false,
        status: "failed_not_processable",
        message:
          "Neuspješan Individualni razvojni profil se u ovom slice-u ne može ponovo pripremiti.",
        reportId: reportContext.id,
        participantId: reportContext.participantId,
        processorReason: result.reason,
      };
    }

    if (result.reason === "not_processable" || result.reason === "report_not_found") {
      return {
        ok: false,
        status: "invalid_not_processable",
        message:
          "Postojeći Individualni razvojni profil nije u stanju koje podržava ručnu pripremu.",
        reportId: reportContext.id,
        participantId: reportContext.participantId,
        processorReason: result.reason,
      };
    }

    revalidateIndividualDevelopmentProfilePaths({
      participantId: reportContext.participantId,
      assessmentReportId: reportContext.id,
      revalidate,
    });

    return {
      ok: false,
      status: "failed",
      message: "Priprema Individualnog razvojnog profila nije uspjela.",
      reportId: reportContext.id,
      participantId: reportContext.participantId,
      processorReason: result.reason,
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Authentication required.",
        reportId: input.assessmentReportId,
        participantId: input.participantId ?? null,
      };
    }

    return {
      ok: false,
      status: "failed",
      message: "Priprema Individualnog razvojnog profila nije dostupna.",
      reportId: input.assessmentReportId,
      participantId: input.participantId ?? null,
    };
  }
}

export async function processIndividualDevelopmentProfileReportFormAction(
  input: IndividualDevelopmentProfileProcessActionInput,
  _formData: FormData,
): Promise<void> {
  await processIndividualDevelopmentProfileReportAction(input);
}

export async function queueIndividualDevelopmentProfileReportFormAction(
  input: IndividualDevelopmentProfileQueueActionInput,
  _formData: FormData,
): Promise<void> {
  await queueIndividualDevelopmentProfileReportAction(input);
}

export async function resetIndividualDevelopmentProfileReportFormAction(
  input: IndividualDevelopmentProfileResetActionInput,
  _formData: FormData,
): Promise<void> {
  await resetIndividualDevelopmentProfileReportAction(input);
}
