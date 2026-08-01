"use server";

import { revalidatePath } from "next/cache";
import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";
import { createTeamDynamicsAssessmentForTeam } from "@/lib/assessment/team-assessments";
import {
  loadTeamAssessmentExecutionContext,
  loadTeamAssessmentQuestionOutline,
  loadTeamAssessmentUiOnlyItems,
  resolveTeamAssessmentExecutionShellState,
  transitionTeamAssessmentExecutionToCompleted,
  type TeamAssessmentExecutionCompletionTransitionResult,
  type TeamAssessmentExecutionContextResult,
  type TeamAssessmentQuestionOutline,
} from "@/lib/assessment/team-assessment-execution";
import {
  persistTeamAssessmentMinimalScoreForContext,
  TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
  type TeamAssessmentMinimalScorePersistenceFailureCode,
  type TeamAssessmentMinimalScorePersistenceResult,
} from "@/lib/assessment/team-assessment-score-persistence";
import {
  loadTeamAssessmentCompletionReadinessForContext,
  persistValidatedTeamAssessmentAnswer,
  type TeamAssessmentAnswerPayload,
  type TeamAssessmentAnswerPersistenceResult,
  type TeamAssessmentCompletionReadiness,
} from "@/lib/assessment/team-assessment-responses";
import {
  normalizeAssessmentLocale,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
import {
  INITIAL_CREATE_TEAM_DYNAMICS_ASSESSMENT_ACTION_STATE,
  type CreateTeamDynamicsAssessmentActionResult,
  mapCreateTeamDynamicsAssessmentActionError,
  TEAM_DYNAMICS_ACTION_NO_ACTIVE_ORGANIZATION,
  TEAM_DYNAMICS_ACTION_TEAM_ID_REQUIRED,
} from "@/lib/assessment/team-dynamics-action-contract";
import {
  getTeamDynamicsReportSelectionReadModelForOrganization,
  type TeamDynamicsReportSelectionReadModel,
} from "@/lib/b2b/team-dynamics-report-selection";
import { replaceTeamDynamicsReportSelectionInclusionSet } from "@/lib/b2b/team-dynamics-report-selection-inclusion";
import {
  processTeamDynamicsExecutiveOverviewWithOpenAI,
  queueTeamDynamicsReportShell,
  resetFailedTeamDynamicsReportToQueued,
  TEAM_DYNAMICS_REPORT_TYPE,
  TEAM_DYNAMICS_REPORT_VERSION,
  type ProcessTeamDynamicsExecutiveOverviewOpenAiResult,
  type ResetFailedTeamDynamicsReportToQueuedResult,
  type TeamDynamicsReportStatus,
} from "@/lib/b2b/team-dynamics-report-lifecycle";
import {
  queueTeamFitReportV2Shell,
  resetFailedTeamFitReportToQueued,
  TEAM_FIT_CANDIDATE_SOURCE_TYPE,
  TEAM_FIT_TEAM_SOURCE_TYPE,
  type TeamFitReportStatus,
} from "@/lib/b2b/team-fit-report-lifecycle";
import {
  TEAM_FIT_REPORT_V2_TYPE,
  TEAM_FIT_REPORT_V2_VERSION,
} from "@/lib/b2b/team-fit-report-identity";
import {
  processTeamFitReportV2WithProvider,
  type ProcessTeamFitReportV2WithProviderResult,
} from "@/lib/b2b/team-fit-report-v2-processor";
import { generateTeamFitReportV2WithOpenAI } from "@/lib/b2b/team-fit-report-v2-openai-provider";
import { getAiReportConfig } from "@/lib/assessment/report-config";
import {
  persistValidatedTeamDynamicsMixedAnswer,
  type TeamDynamicsMixedAnswerPersistenceResult,
} from "@/lib/assessment/team-dynamics-mixed-answer-persistence";
import {
  persistTeamDynamicsMixedScoreForContext,
  TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
  type TeamDynamicsMixedScorePersistenceFailureCode,
  type TeamDynamicsMixedScorePersistenceResult,
} from "@/lib/assessment/team-dynamics-mixed-score-persistence";
import type { TeamDynamicsMixedAnswerPayload } from "@/lib/assessment/team-dynamics-mixed-answer-payload-validator";
import {
  loadTeamDynamicsMixedCompletionReadinessForContext,
  type TeamDynamicsMixedCompletionReadiness,
} from "@/lib/assessment/team-dynamics-mixed-completion-readiness";
import { loadTeamDynamicsMixedRuntimeHandoff } from "@/lib/assessment/team-dynamics-mixed-runtime";
import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUserForAction,
} from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getFormDataString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export type SaveTeamAssessmentAnswerActionInput = {
  teamAssessmentParticipantId: string;
  questionId: string;
  optionId: string;
  locale: AssessmentLocale;
  clientTimestamp?: string;
};

export type SaveTeamAssessmentAnswerActionResult =
  | {
      ok: true;
      mode: "saved" | "overwritten" | "unchanged";
    }
  | {
      ok: false;
      code: string;
      reason: string;
    };

type SaveTeamAssessmentAnswerActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  loadExecutionContext?: typeof loadTeamAssessmentExecutionContext;
  persistAnswer?: (
    input: {
      userId: string;
      payload: TeamAssessmentAnswerPayload;
    },
  ) => Promise<TeamAssessmentAnswerPersistenceResult>;
};

export type SaveTeamDynamicsMixedAnswerActionInput =
  | {
      teamAssessmentParticipantId: string;
      questionId: string;
      responseFormat: "single_select_likert";
      optionId: string;
      locale?: string;
      clientTimestamp?: string;
    }
  | {
      teamAssessmentParticipantId: string;
      questionId: string;
      responseFormat: "best_worst";
      bestOptionId: string;
      worstOptionId: string;
      locale?: string;
      clientTimestamp?: string;
    };

export type SaveTeamDynamicsMixedAnswerActionResult =
  | {
      ok: true;
      status: "saved" | "overwritten" | "unchanged";
      teamAssessmentParticipantId: string;
      questionId: string;
      responseFormat: "single_select_likert" | "best_worst";
    }
  | {
      ok: false;
      status:
        | "invalid"
        | "not_runnable"
        | "unsupported"
        | "unsupported_storage_shape"
        | "error";
      reason: string;
      teamAssessmentParticipantId: string | null;
      questionId: string | null;
      responseFormat: string | null;
    };

type SaveTeamDynamicsMixedAnswerActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  persistMixedAnswer?: (
    input: {
      userId: string;
      payload: TeamDynamicsMixedAnswerPayload;
    },
  ) => Promise<TeamDynamicsMixedAnswerPersistenceResult>;
};

export type CompleteTeamDynamicsMixedAssessmentActionInput = {
  teamAssessmentParticipantId: string;
};

export type CompleteTeamDynamicsMixedAssessmentActionResult =
  | {
      ok: true;
      status: "completed" | "already_completed";
      teamAssessmentParticipantId: string;
      readinessStatus: TeamDynamicsMixedCompletionReadiness["readinessStatus"];
      supportedItemCount: number;
      savedValidAnswerCount: number;
      missingQuestionIds: string[];
      postCompletionScoring?: CompleteTeamDynamicsMixedPostCompletionScoringStatus;
    }
  | {
      ok: false;
      status:
        | "not_ready"
        | "not_runnable"
        | "unsupported"
        | "invalid"
        | "error";
      reason: string;
      teamAssessmentParticipantId: string | null;
      readinessStatus?: TeamDynamicsMixedCompletionReadiness["readinessStatus"];
      supportedItemCount?: number;
      savedValidAnswerCount?: number;
      missingQuestionIds?: string[];
      postCompletionScoring?: CompleteTeamDynamicsMixedPostCompletionScoringStatus;
    };

type CompleteTeamDynamicsMixedPostCompletionScoringStatus =
  | {
      ok: true;
      mode: "inserted" | "updated";
      scoringVersion: string;
    }
  | {
      ok: false;
      code: TeamDynamicsMixedScorePersistenceFailureCode;
      reason: string;
      scoringVersion: string;
    };

type CompleteTeamDynamicsMixedAssessmentActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  loadExecutionContext?: typeof loadTeamAssessmentExecutionContext;
  loadMixedRuntimeHandoff?: typeof loadTeamDynamicsMixedRuntimeHandoff;
  loadMixedCompletionReadiness?: typeof loadTeamDynamicsMixedCompletionReadinessForContext;
  transitionCompletion?: (
    input: {
      context: Extract<TeamAssessmentExecutionContextResult, { ok: true }>["context"];
      completedAt?: string;
    },
  ) => Promise<TeamAssessmentExecutionCompletionTransitionResult>;
  persistMixedScore?: (
    input: {
      context: Extract<TeamAssessmentExecutionContextResult, { ok: true }>["context"];
      scoringVersion?: string;
    },
  ) => Promise<TeamDynamicsMixedScorePersistenceResult>;
};

export type CompleteTeamAssessmentActionInput = {
  teamAssessmentParticipantId: string;
};

type CompleteTeamAssessmentPostCompletionScoringStatus =
  | {
      ok: true;
      mode: "inserted" | "updated";
      scoringVersion: string;
    }
  | {
      ok: false;
      code: TeamAssessmentMinimalScorePersistenceFailureCode;
      reason: string;
      scoringVersion: string;
    };

export type CompleteTeamAssessmentActionResult =
  | {
      ok: true;
      mode: "completed" | "already_completed";
      completionReadiness: TeamAssessmentCompletionReadiness;
      postCompletionScoring?: CompleteTeamAssessmentPostCompletionScoringStatus;
    }
  | {
      ok: false;
      code: string;
      reason: string;
      completionReadiness?: TeamAssessmentCompletionReadiness;
    };

type CompleteTeamAssessmentActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  loadExecutionContext?: typeof loadTeamAssessmentExecutionContext;
  loadQuestionOutline?: (input: {
    testId: string;
    locale?: AssessmentLocale | null;
  }) => Promise<TeamAssessmentQuestionOutline>;
  loadUiOnlyItems?: typeof loadTeamAssessmentUiOnlyItems;
  resolveShellState?: typeof resolveTeamAssessmentExecutionShellState;
  loadCompletionReadiness?: typeof loadTeamAssessmentCompletionReadinessForContext;
  transitionCompletion?: (
    input: {
      context: Extract<TeamAssessmentExecutionContextResult, { ok: true }>["context"];
      completedAt?: string;
    },
  ) => Promise<TeamAssessmentExecutionCompletionTransitionResult>;
  persistMinimalScore?: (
    input: {
      context: Extract<TeamAssessmentExecutionContextResult, { ok: true }>["context"];
      scoringVersion?: string;
      uiOnlyItems?: Awaited<ReturnType<typeof loadTeamAssessmentUiOnlyItems>>["items"];
    },
  ) => Promise<TeamAssessmentMinimalScorePersistenceResult>;
};

type TeamDynamicsAssignmentActionContext = {
  assignmentId: string;
  teamId: string;
  packageSlug: string;
  organizationId: string;
  teamArchivedAt: string | null;
};

type TeamDynamicsAssignmentParticipantContext = {
  id: string;
  teamAssessmentAssignmentId: string;
};

type TeamDynamicsReportActionContext = {
  id: string;
  organizationId: string;
  teamId: string;
  reportType: string;
  reportVersion: string;
  reportStatus: TeamDynamicsReportStatus;
};

type TeamFitReportActionContext = {
  id: string;
  organizationId: string;
  teamId: string;
  participantId: string;
  reportType: string;
  reportVersion: string;
  reportStatus: TeamFitReportStatus;
};

export type ReplaceTeamDynamicsReportSelectionInclusionActionInput = {
  teamAssessmentAssignmentId: string;
  includedTeamAssessmentParticipantIds: string[];
};

export type ReplaceTeamDynamicsReportSelectionInclusionActionResult =
  | {
      ok: true;
      selection: TeamDynamicsReportSelectionReadModel;
    }
  | {
      ok: false;
      errorCode:
        | "authentication_required"
        | "no_active_organization"
        | "invalid_payload"
        | "assignment_not_found"
        | "assignment_not_team_dynamics_final"
        | "unknown_participant_ids"
        | "participant_assignment_mismatch"
        | "selection_not_found"
        | "save_failed";
      message: string;
    };

type ReplaceTeamDynamicsReportSelectionInclusionActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  getActiveOrganization?: typeof getActiveOrganizationForUser;
  loadAssignmentContext?: (
    input: {
      teamAssessmentAssignmentId: string;
    },
  ) => Promise<TeamDynamicsAssignmentActionContext | null>;
  loadAssignmentParticipantsByIds?: (
    input: {
      teamAssessmentParticipantIds: string[];
    },
  ) => Promise<TeamDynamicsAssignmentParticipantContext[]>;
  replaceSelectionInclusionSet?: typeof replaceTeamDynamicsReportSelectionInclusionSet;
  loadSelectionReadModel?: typeof getTeamDynamicsReportSelectionReadModelForOrganization;
};

export type QueueTeamDynamicsReportActionInput = {
  teamId: string;
  teamAssessmentAssignmentId: string;
  selectionDraftId: string;
};

export type QueueTeamDynamicsReportActionResult =
  | {
      ok: true;
      status: "queued";
      message: string;
      reportId: string;
    }
  | {
      ok: false;
      status: "not_ready" | "unauthorized" | "error";
      message: string;
    };

type QueueTeamDynamicsReportActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  getActiveOrganization?: typeof getActiveOrganizationForUser;
  loadAssignmentContext?: (
    input: {
      teamAssessmentAssignmentId: string;
    },
  ) => Promise<TeamDynamicsAssignmentActionContext | null>;
  queueReportShell?: typeof queueTeamDynamicsReportShell;
};

export type ProcessTeamDynamicsExecutiveOverviewReportActionInput = {
  teamAssessmentReportId: string;
  teamId?: string;
};

export type ProcessTeamDynamicsExecutiveOverviewReportActionResult =
  | {
      ok: true;
      status: "ready";
      message: string;
      reportId: string;
      teamId: string;
    }
  | {
      ok: false;
      status:
        | "unauthorized"
        | "not_queued"
        | "unsupported_report_kind"
        | "failed"
        | "error";
      message: string;
      reportId: string | null;
      teamId: string | null;
      marker?: string;
      processorOperation?: ProcessTeamDynamicsExecutiveOverviewOpenAiResult["operation"];
      providerCode?: string;
    };

type ProcessTeamDynamicsExecutiveOverviewReportActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  getActiveOrganization?: typeof getActiveOrganizationForUser;
  loadReportContext?: (input: {
    teamAssessmentReportId: string;
  }) => Promise<TeamDynamicsReportActionContext | null>;
  processExecutiveOverviewReport?: typeof processTeamDynamicsExecutiveOverviewWithOpenAI;
  revalidate?: typeof revalidatePath;
};

export type ResetTeamDynamicsExecutiveOverviewReportActionInput = {
  teamAssessmentReportId: string;
  teamId?: string;
};

export type ResetTeamDynamicsExecutiveOverviewReportActionResult =
  | {
      ok: true;
      status: "queued";
      message: string;
      reportId: string;
      teamId: string;
    }
  | {
      ok: false;
      status:
        | "unauthorized"
        | "unsupported_report_kind"
        | "not_failed"
        | "error";
      message: string;
      reportId: string | null;
      teamId: string | null;
      lifecycleOperation?: ResetFailedTeamDynamicsReportToQueuedResult["operation"];
    };

type ResetTeamDynamicsExecutiveOverviewReportActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  getActiveOrganization?: typeof getActiveOrganizationForUser;
  loadReportContext?: (input: {
    teamAssessmentReportId: string;
  }) => Promise<TeamDynamicsReportActionContext | null>;
  resetExecutiveOverviewReport?: typeof resetFailedTeamDynamicsReportToQueued;
  revalidate?: typeof revalidatePath;
};

export type ResetTeamFitReportActionInput = {
  teamFitReportId: string;
  teamId?: string;
  participantId?: string;
};

export type ResetTeamFitReportActionResult =
  | {
      ok: true;
      status: "queued";
      message: string;
      reportId: string;
      teamId: string;
      participantId: string;
    }
  | {
      ok: false;
      status:
        | "unauthorized"
        | "unsupported_report_kind"
        | "already_queued"
        | "processing_not_resettable"
        | "ready_not_resettable"
        | "not_resettable"
        | "error";
      message: string;
      reportId: string | null;
      teamId: string | null;
      participantId: string | null;
      lifecycleReason?: string;
    };

type ResetTeamFitReportActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  getActiveOrganization?: typeof getActiveOrganizationForUser;
  loadReportContext?: (input: {
    teamFitReportId: string;
  }) => Promise<TeamFitReportActionContext | null>;
  resetTeamFitReport?: typeof resetFailedTeamFitReportToQueued;
  revalidate?: typeof revalidatePath;
};

export type ProcessTeamFitReportActionInput = {
  teamFitReportId: string;
  teamId?: string;
  participantId?: string;
};

export type ProcessTeamFitReportActionResult =
  | {
      ok: true;
      status: "ready";
      message: string;
      reportId: string;
      teamId: string;
      participantId: string;
    }
  | {
      ok: false;
      status:
        | "unauthorized"
        | "unsupported_report_kind"
        | "not_queued"
        | "already_processing"
        | "already_ready"
        | "failed_not_processable"
        | "failed"
        | "error";
      message: string;
      reportId: string | null;
      teamId: string | null;
      participantId: string | null;
      marker?: string;
      processorReason?: string;
    };

type ProcessTeamFitReportActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  getActiveOrganization?: typeof getActiveOrganizationForUser;
  loadReportContext?: (input: {
    teamFitReportId: string;
  }) => Promise<TeamFitReportActionContext | null>;
  processTeamFitReport?: (input: {
    teamFitReportId: string;
    organizationId: string;
  }) => Promise<ProcessTeamFitReportV2WithProviderResult>;
  revalidate?: typeof revalidatePath;
};

export type QueueTeamFitReportV2ActionInput = {
  teamId: string;
  participantId: string;
  candidateSourceId: string;
  teamSourceId: string;
  optionalContext?: Record<string, unknown>;
};

export type QueueTeamFitReportV2ActionResult =
  | { ok: true; status: "queued"; message: string; reportId: string; teamId: string; participantId: string }
  | { ok: false; status: "unauthorized" | "invalid_payload" | "error"; message: string; reportId: null; teamId: string | null; participantId: string | null };

type QueueTeamFitReportV2ActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  getActiveOrganization?: typeof getActiveOrganizationForUser;
  queueReportShell?: typeof queueTeamFitReportV2Shell;
  revalidate?: typeof revalidatePath;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildMixedAnswerActionFailure(
  input: Partial<SaveTeamDynamicsMixedAnswerActionInput>,
  status:
    | "invalid"
    | "not_runnable"
    | "unsupported"
    | "unsupported_storage_shape"
    | "error",
  reason: string,
): SaveTeamDynamicsMixedAnswerActionResult {
  return {
    ok: false,
    status,
    reason,
    teamAssessmentParticipantId: isNonEmptyString(input.teamAssessmentParticipantId)
      ? input.teamAssessmentParticipantId
      : null,
    questionId: isNonEmptyString(input.questionId) ? input.questionId : null,
    responseFormat:
      typeof input.responseFormat === "string" ? input.responseFormat : null,
  };
}

function buildMixedCompletionActionFailure(
  input: Partial<CompleteTeamDynamicsMixedAssessmentActionInput>,
  status:
    | "not_ready"
    | "not_runnable"
    | "unsupported"
    | "invalid"
    | "error",
  reason: string,
  readiness?: TeamDynamicsMixedCompletionReadiness,
): CompleteTeamDynamicsMixedAssessmentActionResult {
  return {
    ok: false,
    status,
    reason,
    teamAssessmentParticipantId: isNonEmptyString(input.teamAssessmentParticipantId)
      ? input.teamAssessmentParticipantId
      : null,
    ...(readiness
      ? {
          readinessStatus: readiness.readinessStatus,
          supportedItemCount: readiness.supportedItemCount,
          savedValidAnswerCount: readiness.savedValidAnswerCount,
          missingQuestionIds: readiness.missingQuestionIds,
        }
      : {}),
  };
}

async function loadTeamDynamicsAssignmentActionContext(input: {
  teamAssessmentAssignmentId: string;
}): Promise<TeamDynamicsAssignmentActionContext | null> {
  const supabase = createSupabaseAdminClient();
  const { data: assignmentData, error: assignmentError } = await supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug")
    .eq("id", input.teamAssessmentAssignmentId)
    .maybeSingle();

  if (assignmentError) {
    throw new Error(
      `Failed to load Team Dynamics selection assignment context: ${assignmentError.message}`,
    );
  }

  const assignment = assignmentData as
    | {
        id: string;
        team_id: string;
        package_slug: string;
      }
    | null;

  if (!assignment) {
    return null;
  }

  const { data: teamData, error: teamError } = await supabase
    .from("teams")
    .select("id, organization_id, archived_at")
    .eq("id", assignment.team_id)
    .maybeSingle();

  if (teamError) {
    throw new Error(
      `Failed to load Team Dynamics selection team context: ${teamError.message}`,
    );
  }

  const team = teamData as
    | {
        id: string;
        organization_id: string;
        archived_at: string | null;
      }
    | null;

  if (!team) {
    return null;
  }

  return {
    assignmentId: assignment.id,
    teamId: assignment.team_id,
    packageSlug: assignment.package_slug,
    organizationId: team.organization_id,
    teamArchivedAt: team.archived_at,
  };
}

async function loadTeamAssessmentParticipantAssignmentContexts(input: {
  teamAssessmentParticipantIds: string[];
}): Promise<TeamDynamicsAssignmentParticipantContext[]> {
  if (input.teamAssessmentParticipantIds.length === 0) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_assessment_participants")
    .select("id, team_assessment_assignment_id")
    .in("id", input.teamAssessmentParticipantIds);

  if (error) {
    throw new Error(
      `Failed to load Team Dynamics selection participant contexts: ${error.message}`,
    );
  }

  return ((data ?? []) as Array<{
    id: string;
    team_assessment_assignment_id: string;
  }>)
    .map((row) => ({
      id: row.id,
      teamAssessmentAssignmentId: row.team_assessment_assignment_id,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function loadTeamDynamicsReportActionContext(input: {
  teamAssessmentReportId: string;
}): Promise<TeamDynamicsReportActionContext | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_assessment_reports")
    .select("id, organization_id, team_id, report_type, report_version, report_status")
    .eq("id", input.teamAssessmentReportId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Dynamics report action context: ${error.message}`);
  }

  const report = (data ??
    null) as
    | {
        id: string;
        organization_id: string;
        team_id: string;
        report_type: string;
        report_version: string;
        report_status: TeamDynamicsReportStatus;
      }
    | null;

  if (!report) {
    return null;
  }

  return {
    id: report.id,
    organizationId: report.organization_id,
    teamId: report.team_id,
    reportType: report.report_type,
    reportVersion: report.report_version,
    reportStatus: report.report_status,
  };
}

async function loadTeamFitReportActionContext(input: {
  teamFitReportId: string;
}): Promise<TeamFitReportActionContext | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_fit_reports")
    .select("id, organization_id, team_id, participant_id, report_type, report_version, report_status")
    .eq("id", input.teamFitReportId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Fit report action context: ${error.message}`);
  }

  const report = (data ??
    null) as
    | {
        id: string;
        organization_id: string;
        team_id: string;
        participant_id: string;
        report_type: string;
        report_version: string;
        report_status: TeamFitReportStatus;
      }
    | null;

  if (!report) {
    return null;
  }

  return {
    id: report.id,
    organizationId: report.organization_id,
    teamId: report.team_id,
    participantId: report.participant_id,
    reportType: report.report_type,
    reportVersion: report.report_version,
    reportStatus: report.report_status,
  };
}

function normalizeIncludedTeamAssessmentParticipantIds(values: string[]): string[] {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      ),
    ),
  ).sort();
}

export async function createTeamDynamicsAssessmentAction(
  previousStateOrFormData:
    | CreateTeamDynamicsAssessmentActionResult
    | FormData,
  maybeFormData?: FormData,
): Promise<CreateTeamDynamicsAssessmentActionResult> {
  const formData =
    previousStateOrFormData instanceof FormData
      ? previousStateOrFormData
      : maybeFormData;

  if (!formData) {
    return INITIAL_CREATE_TEAM_DYNAMICS_ASSESSMENT_ACTION_STATE;
  }

  const user = await requireAuthenticatedUserForAction();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    return {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_NO_ACTIVE_ORGANIZATION,
      message: "Active organization is not available for this user.",
      teamId: null,
    };
  }

  const teamId = getFormDataString(formData, "teamId");
  const locale = getFormDataString(formData, "locale");

  if (!teamId) {
    return {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_TEAM_ID_REQUIRED,
      message: "Team id is required.",
      teamId: null,
    };
  }

  try {
    const result = await createTeamDynamicsAssessmentForTeam({
      organizationId: organization.id,
      teamId,
      createdByUserId: user.id,
      locale: locale || null,
      requireLinkedUsers: true,
    });

    return {
      ok: true,
      teamId,
      assignmentId: result.assignmentId,
      assignmentAction: result.assignmentAction,
      participantsCreated: result.participantsCreated,
      attemptsCreated: result.attemptsCreated,
      attemptMappingsCreated: result.attemptMappingsCreated,
    };
  } catch (error) {
    return mapCreateTeamDynamicsAssessmentActionError(error, teamId);
  }
}

export async function saveTeamAssessmentAnswerAction(
  input: SaveTeamAssessmentAnswerActionInput,
  deps: SaveTeamAssessmentAnswerActionDependencies = {},
): Promise<SaveTeamAssessmentAnswerActionResult> {
  if (
    !isNonEmptyString(input.teamAssessmentParticipantId) ||
    !isNonEmptyString(input.questionId) ||
    !isNonEmptyString(input.optionId)
  ) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "teamAssessmentParticipantId, questionId and optionId are required.",
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const loadExecutionContext =
    deps.loadExecutionContext ?? loadTeamAssessmentExecutionContext;
  const persistAnswer = deps.persistAnswer ?? persistValidatedTeamAssessmentAnswer;
  const user = await requireUser();
  const contextResult = await loadExecutionContext({
    teamAssessmentParticipantId: input.teamAssessmentParticipantId,
    userId: user.id,
  });

  if (!contextResult.ok) {
    return {
      ok: false,
      code: contextResult.code,
      reason: contextResult.message,
    };
  }

  const result = await persistAnswer({
    userId: user.id,
    payload: {
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      attemptId: contextResult.context.attemptId,
      questionId: input.questionId,
      optionId: input.optionId,
      responseFormat: "single_select_likert",
      locale: normalizeAssessmentLocale(input.locale),
      ...(input.clientTimestamp
        ? {
            clientTimestamp: input.clientTimestamp,
          }
        : {}),
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      reason: result.reason,
    };
  }

  return {
    ok: true,
    mode: result.mode,
  };
}

export async function replaceTeamDynamicsReportSelectionInclusionAction(
  input: ReplaceTeamDynamicsReportSelectionInclusionActionInput,
  deps: ReplaceTeamDynamicsReportSelectionInclusionActionDependencies = {},
): Promise<ReplaceTeamDynamicsReportSelectionInclusionActionResult> {
  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    return {
      ok: false,
      errorCode: "invalid_payload",
      message: "teamAssessmentAssignmentId is required.",
    };
  }

  if (!Array.isArray(input.includedTeamAssessmentParticipantIds)) {
    return {
      ok: false,
      errorCode: "invalid_payload",
      message: "includedTeamAssessmentParticipantIds must be an array.",
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const getActiveOrganization =
    deps.getActiveOrganization ?? getActiveOrganizationForUser;
  const loadAssignmentContext =
    deps.loadAssignmentContext ?? loadTeamDynamicsAssignmentActionContext;
  const loadAssignmentParticipantsByIds =
    deps.loadAssignmentParticipantsByIds ??
    loadTeamAssessmentParticipantAssignmentContexts;
  const replaceSelectionInclusionSet =
    deps.replaceSelectionInclusionSet ??
    replaceTeamDynamicsReportSelectionInclusionSet;
  const loadSelectionReadModel =
    deps.loadSelectionReadModel ??
    getTeamDynamicsReportSelectionReadModelForOrganization;
  const includedTeamAssessmentParticipantIds =
    normalizeIncludedTeamAssessmentParticipantIds(
      input.includedTeamAssessmentParticipantIds,
    );

  try {
    const user = await requireUser();
    const organization = await getActiveOrganization(user.id);

    if (!organization) {
      return {
        ok: false,
        errorCode: "no_active_organization",
        message: "Active organization is not available for this user.",
      };
    }

    const assignmentContext = await loadAssignmentContext({
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    });

    if (
      !assignmentContext ||
      assignmentContext.organizationId !== organization.id ||
      assignmentContext.teamArchivedAt
    ) {
      return {
        ok: false,
        errorCode: "assignment_not_found",
        message: "Team Dynamics assignment was not found in the active organization.",
      };
    }

    if (assignmentContext.packageSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG) {
      return {
        ok: false,
        errorCode: "assignment_not_team_dynamics_final",
        message: "The assignment does not belong to the final Team Dynamics package.",
      };
    }

    const submittedParticipantContexts = await loadAssignmentParticipantsByIds({
      teamAssessmentParticipantIds: includedTeamAssessmentParticipantIds,
    });
    const submittedParticipantIds = new Set(
      submittedParticipantContexts.map((row) => row.id),
    );
    const unknownParticipantIds = includedTeamAssessmentParticipantIds.filter(
      (participantId) => submittedParticipantIds.has(participantId) === false,
    );

    if (unknownParticipantIds.length > 0) {
      return {
        ok: false,
        errorCode: "unknown_participant_ids",
        message: `Unknown Team Dynamics participant ids: ${unknownParticipantIds.join(", ")}.`,
      };
    }

    const mismatchedParticipantIds = submittedParticipantContexts
      .filter(
        (row) =>
          row.teamAssessmentAssignmentId !==
          input.teamAssessmentAssignmentId,
      )
      .map((row) => row.id)
      .sort();

    if (mismatchedParticipantIds.length > 0) {
      return {
        ok: false,
        errorCode: "participant_assignment_mismatch",
        message:
          "All included Team Dynamics participants must belong to the requested assignment.",
      };
    }

    await replaceSelectionInclusionSet({
      organizationId: organization.id,
      teamId: assignmentContext.teamId,
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      includedTeamAssessmentParticipantIds,
      actorUserId: user.id,
    });

    const selection = await loadSelectionReadModel({
      organizationId: organization.id,
      teamId: assignmentContext.teamId,
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    });

    if (!selection) {
      return {
        ok: false,
        errorCode: "selection_not_found",
        message: "Team Dynamics selection could not be reloaded after save.",
      };
    }

    return {
      ok: true,
      selection,
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return {
        ok: false,
        errorCode: "authentication_required",
        message: "Authentication required.",
      };
    }

    return {
      ok: false,
      errorCode: "save_failed",
      message: "Unable to save the Team Dynamics report selection right now.",
    };
  }
}

export async function queueTeamDynamicsReportAction(
  input: QueueTeamDynamicsReportActionInput,
  deps: QueueTeamDynamicsReportActionDependencies = {},
): Promise<QueueTeamDynamicsReportActionResult> {
  if (!isNonEmptyString(input.teamId)) {
    return {
      ok: false,
      status: "error",
      message: "teamId is required.",
    };
  }

  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    return {
      ok: false,
      status: "error",
      message: "teamAssessmentAssignmentId is required.",
    };
  }

  if (!isNonEmptyString(input.selectionDraftId)) {
    return {
      ok: false,
      status: "error",
      message: "selectionDraftId is required.",
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const getActiveOrganization =
    deps.getActiveOrganization ?? getActiveOrganizationForUser;
  const loadAssignmentContext =
    deps.loadAssignmentContext ?? loadTeamDynamicsAssignmentActionContext;
  const queueReportShell = deps.queueReportShell ?? queueTeamDynamicsReportShell;

  try {
    const user = await requireUser();
    const organization = await getActiveOrganization(user.id);

    if (!organization) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Active organization is not available for this user.",
      };
    }

    const assignmentContext = await loadAssignmentContext({
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    });

    if (
      !assignmentContext ||
      assignmentContext.organizationId !== organization.id ||
      assignmentContext.teamArchivedAt ||
      assignmentContext.teamId !== input.teamId
    ) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Team Dynamics assignment was not found in the active organization.",
      };
    }

    if (assignmentContext.packageSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG) {
      return {
        ok: false,
        status: "error",
        message: "The assignment does not belong to the final Team Dynamics package.",
      };
    }

    const result = await queueReportShell({
      organizationId: organization.id,
      teamId: input.teamId,
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      selectionDraftId: input.selectionDraftId,
    });

    if (!result.ok) {
      if (result.code === "aggregation_not_ready") {
        return {
          ok: false,
          status: "not_ready",
          message:
            "Izvještaj još nije moguće pripremiti. Provjeri da su uključeni članovi završili procjenu i da je timska agregacija spremna.",
        };
      }

      if (
        result.code === "team_not_found" ||
        result.code === "assignment_not_found" ||
        result.code === "selection_draft_not_found" ||
        result.code === "selection_draft_mismatch"
      ) {
        return {
          ok: false,
          status: "unauthorized",
          message: "Team Dynamics report context is not available in the active organization.",
        };
      }

      return {
        ok: false,
        status: "error",
        message: "Unable to queue the Team Dynamics report right now.",
      };
    }

    return {
      ok: true,
      status: "queued",
      message: "Timski izvještaj je stavljen u red za pripremu.",
      reportId: result.report.id,
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Authentication required.",
      };
    }

    return {
      ok: false,
      status: "error",
      message: "Unable to queue the Team Dynamics report right now.",
    };
  }
}

function getUnsupportedTeamDynamicsReportKindMessage(): string {
  return "Ovaj Team Dynamics izvještaj nije podržan za ručnu obradu u ovom slice-u.";
}

function getProcessorFailureMessage(
  result: Extract<ProcessTeamDynamicsExecutiveOverviewOpenAiResult, { ok: false }>,
): string {
  switch (result.marker) {
    case "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_CONFIG_ERROR":
      return "OpenAI konfiguracija za Team Dynamics Executive Overview nije spremna.";
    case "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_ERROR":
      return "OpenAI provider nije vratio upotrebljiv Team Dynamics Executive Overview rezultat.";
    case "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PARSE_FAILURE":
      return "OpenAI odgovor za Team Dynamics Executive Overview nije bilo moguće parsirati.";
    case "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_VALIDATION_FAILURE":
      return "OpenAI odgovor za Team Dynamics Executive Overview nije prošao runtime validaciju.";
    case "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_INPUT_SNAPSHOT_INVALID":
      return "Persisted Team Dynamics input snapshot nije validan za obradu izvještaja.";
    case "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_INPUT_SNAPSHOT_MISSING":
    default:
      return "Persisted Team Dynamics input snapshot nije dostupan za obradu izvještaja.";
  }
}

export async function processTeamDynamicsExecutiveOverviewReportAction(
  input: ProcessTeamDynamicsExecutiveOverviewReportActionInput,
  deps: ProcessTeamDynamicsExecutiveOverviewReportActionDependencies = {},
): Promise<ProcessTeamDynamicsExecutiveOverviewReportActionResult> {
  if (!isNonEmptyString(input.teamAssessmentReportId)) {
    return {
      ok: false,
      status: "error",
      message: "teamAssessmentReportId is required.",
      reportId: null,
      teamId: null,
    };
  }

  if (typeof input.teamId !== "undefined" && !isNonEmptyString(input.teamId)) {
    return {
      ok: false,
      status: "error",
      message: "teamId must be a non-empty string when provided.",
      reportId: input.teamAssessmentReportId,
      teamId: null,
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const getActiveOrganization =
    deps.getActiveOrganization ?? getActiveOrganizationForUser;
  const loadReportContext =
    deps.loadReportContext ?? loadTeamDynamicsReportActionContext;
  const processExecutiveOverviewReport =
    deps.processExecutiveOverviewReport ??
    processTeamDynamicsExecutiveOverviewWithOpenAI;
  const revalidate = deps.revalidate ?? revalidatePath;

  try {
    const user = await requireUser();
    const organization = await getActiveOrganization(user.id);

    if (!organization) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Active organization is not available for this user.",
        reportId: input.teamAssessmentReportId,
        teamId: input.teamId ?? null,
      };
    }

    const reportContext = await loadReportContext({
      teamAssessmentReportId: input.teamAssessmentReportId,
    });

    if (
      !reportContext ||
      reportContext.organizationId !== organization.id ||
      (isNonEmptyString(input.teamId) && reportContext.teamId !== input.teamId)
    ) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Team Dynamics report was not found in the active organization.",
        reportId: input.teamAssessmentReportId,
        teamId: input.teamId ?? null,
      };
    }

    if (
      reportContext.reportType !== TEAM_DYNAMICS_REPORT_TYPE ||
      reportContext.reportVersion !== TEAM_DYNAMICS_REPORT_VERSION
    ) {
      return {
        ok: false,
        status: "unsupported_report_kind",
        message: getUnsupportedTeamDynamicsReportKindMessage(),
        reportId: reportContext.id,
        teamId: reportContext.teamId,
      };
    }

    if (reportContext.reportStatus !== "queued") {
      return {
        ok: false,
        status: "not_queued",
        message: "Samo queued Team Dynamics Executive Overview report može biti ručno obrađen.",
        reportId: reportContext.id,
        teamId: reportContext.teamId,
      };
    }

    const config = getAiReportConfig();
    const result = await processExecutiveOverviewReport({
      teamAssessmentReportId: input.teamAssessmentReportId,
      organizationId: organization.id,
    }, {
      executiveOverviewOpenAiOptions: {
        apiKey: config.openAiApiKey,
        model: config.model,
        reasoningEffort: config.reasoningEffort,
        timeoutMs: config.openAiTimeoutMs,
      },
    });

    if (!result.ok) {
      if (
        result.operation === "provider_failed" ||
        result.operation === "input_snapshot_missing" ||
        result.operation === "input_snapshot_invalid" ||
        result.operation === "snapshot_invalid"
      ) {
        revalidate(`/dashboard/teams/${reportContext.teamId}`);
        revalidate(`/dashboard/teams/${reportContext.teamId}/reports/new`);

        return {
          ok: false,
          status: "failed",
          message: getProcessorFailureMessage(result),
          reportId: reportContext.id,
          teamId: reportContext.teamId,
          marker: result.marker,
          processorOperation: result.operation,
          providerCode: result.provider?.code,
        };
      }

      if (result.operation === "claim_not_acquired") {
        return {
          ok: false,
          status: "not_queued",
          message: "Team Dynamics report više nije queued i nije preuzet za ručnu obradu.",
          reportId: reportContext.id,
          teamId: reportContext.teamId,
          marker: result.marker,
          processorOperation: result.operation,
          providerCode: result.provider?.code,
        };
      }

      return {
        ok: false,
        status: "error",
        message: "Ručno pokretanje Team Dynamics Executive Overview obrade nije uspjelo.",
        reportId: reportContext.id,
        teamId: reportContext.teamId,
        marker: result.marker,
        processorOperation: result.operation,
        providerCode: result.provider?.code,
      };
    }

    revalidate(`/dashboard/teams/${reportContext.teamId}`);
    revalidate(`/dashboard/teams/${reportContext.teamId}/reports/new`);
    revalidate(`/dashboard/teams/${reportContext.teamId}/reports/${reportContext.id}`);

    return {
      ok: true,
      status: "ready",
      message: "Team Dynamics Executive Overview je obrađen i spreman za pregled.",
      reportId: result.report.id,
      teamId: result.report.teamId,
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Authentication required.",
        reportId: input.teamAssessmentReportId,
        teamId: input.teamId ?? null,
      };
    }

    return {
      ok: false,
      status: "error",
      message: "Ručno pokretanje Team Dynamics Executive Overview obrade nije dostupno.",
      reportId: input.teamAssessmentReportId,
      teamId: input.teamId ?? null,
    };
  }
}

export async function resetTeamDynamicsExecutiveOverviewReportAction(
  input: ResetTeamDynamicsExecutiveOverviewReportActionInput,
  deps: ResetTeamDynamicsExecutiveOverviewReportActionDependencies = {},
): Promise<ResetTeamDynamicsExecutiveOverviewReportActionResult> {
  if (!isNonEmptyString(input.teamAssessmentReportId)) {
    return {
      ok: false,
      status: "error",
      message: "teamAssessmentReportId is required.",
      reportId: null,
      teamId: null,
    };
  }

  if (typeof input.teamId !== "undefined" && !isNonEmptyString(input.teamId)) {
    return {
      ok: false,
      status: "error",
      message: "teamId must be a non-empty string when provided.",
      reportId: input.teamAssessmentReportId,
      teamId: null,
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const getActiveOrganization =
    deps.getActiveOrganization ?? getActiveOrganizationForUser;
  const loadReportContext =
    deps.loadReportContext ?? loadTeamDynamicsReportActionContext;
  const resetExecutiveOverviewReport =
    deps.resetExecutiveOverviewReport ?? resetFailedTeamDynamicsReportToQueued;
  const revalidate = deps.revalidate ?? revalidatePath;

  try {
    const user = await requireUser();
    const organization = await getActiveOrganization(user.id);

    if (!organization) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Active organization is not available for this user.",
        reportId: input.teamAssessmentReportId,
        teamId: input.teamId ?? null,
      };
    }

    const reportContext = await loadReportContext({
      teamAssessmentReportId: input.teamAssessmentReportId,
    });

    if (
      !reportContext ||
      reportContext.organizationId !== organization.id ||
      (isNonEmptyString(input.teamId) && reportContext.teamId !== input.teamId)
    ) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Team Dynamics report was not found in the active organization.",
        reportId: input.teamAssessmentReportId,
        teamId: input.teamId ?? null,
      };
    }

    if (
      reportContext.reportType !== TEAM_DYNAMICS_REPORT_TYPE ||
      reportContext.reportVersion !== TEAM_DYNAMICS_REPORT_VERSION
    ) {
      return {
        ok: false,
        status: "unsupported_report_kind",
        message: getUnsupportedTeamDynamicsReportKindMessage(),
        reportId: reportContext.id,
        teamId: reportContext.teamId,
      };
    }

    if (reportContext.reportStatus !== "failed") {
      return {
        ok: false,
        status: "not_failed",
        message: "Samo failed Team Dynamics Executive Overview report može biti vraćen u queued stanje.",
        reportId: reportContext.id,
        teamId: reportContext.teamId,
      };
    }

    const result = await resetExecutiveOverviewReport({
      teamAssessmentReportId: input.teamAssessmentReportId,
      organizationId: organization.id,
    });

    if (!result.ok) {
      if (
        result.operation === "already_queued" ||
        result.operation === "processing_not_resettable" ||
        result.operation === "ready_not_resettable" ||
        result.operation === "not_resettable"
      ) {
        return {
          ok: false,
          status: "not_failed",
          message: "Report više nije u failed stanju i nije moguće vratiti ga u queued.",
          reportId: result.report?.id ?? reportContext.id,
          teamId: result.report?.teamId ?? reportContext.teamId,
          lifecycleOperation: result.operation,
        };
      }

      return {
        ok: false,
        status: "error",
        message: "Vraćanje Team Dynamics Executive Overview reporta u queued stanje nije uspjelo.",
        reportId: result.report?.id ?? reportContext.id,
        teamId: result.report?.teamId ?? reportContext.teamId,
        lifecycleOperation: result.operation,
      };
    }

    revalidate(`/dashboard/teams/${reportContext.teamId}`);
    revalidate(`/dashboard/teams/${reportContext.teamId}/reports/new`);

    return {
      ok: true,
      status: "queued",
      message: "Team Dynamics Executive Overview je vraćen u queued stanje.",
      reportId: result.report.id,
      teamId: result.report.teamId,
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Authentication required.",
        reportId: input.teamAssessmentReportId,
        teamId: input.teamId ?? null,
      };
    }

    return {
      ok: false,
      status: "error",
      message: "Vraćanje Team Dynamics Executive Overview reporta u queued stanje nije dostupno.",
      reportId: input.teamAssessmentReportId,
      teamId: input.teamId ?? null,
    };
  }
}

export async function resetTeamFitReportAction(
  input: ResetTeamFitReportActionInput,
  deps: ResetTeamFitReportActionDependencies = {},
): Promise<ResetTeamFitReportActionResult> {
  if (!isNonEmptyString(input.teamFitReportId)) {
    return {
      ok: false,
      status: "error",
      message: "Team Fit izvještaj nije moguće vratiti u red bez identifikatora.",
      reportId: null,
      teamId: null,
      participantId: null,
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const getActiveOrganization =
    deps.getActiveOrganization ?? getActiveOrganizationForUser;
  const loadReportContext = deps.loadReportContext ?? loadTeamFitReportActionContext;
  const resetTeamFitReport =
    deps.resetTeamFitReport ?? resetFailedTeamFitReportToQueued;
  const revalidate = deps.revalidate ?? revalidatePath;

  try {
    const user = await requireUser();
    const organization = await getActiveOrganization(user.id);

    if (!organization) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Team Fit izvještaj nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        teamId: null,
        participantId: null,
      };
    }

    const reportContext = await loadReportContext({
      teamFitReportId: input.teamFitReportId,
    });

    if (!reportContext || reportContext.organizationId !== organization.id) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Team Fit izvještaj nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        teamId: null,
        participantId: null,
      };
    }

    if (isNonEmptyString(input.teamId) && input.teamId !== reportContext.teamId) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Team Fit izvještaj nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        teamId: null,
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
        message: "Team Fit izvještaj nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        teamId: null,
        participantId: null,
      };
    }

    if (
      reportContext.reportType !== TEAM_FIT_REPORT_V2_TYPE ||
      reportContext.reportVersion !== TEAM_FIT_REPORT_V2_VERSION
    ) {
      return {
        ok: false,
        status: "unsupported_report_kind",
        message: "Postojeći V1 Team Fit izvještaj dostupan je samo za pregled.",
        reportId: reportContext.id,
        teamId: reportContext.teamId,
        participantId: reportContext.participantId,
      };
    }

    if (reportContext.reportStatus === "queued") {
      return {
        ok: false,
        status: "already_queued",
        message: "Team Fit izvještaj je već vraćen u queued stanje.",
        reportId: reportContext.id,
        teamId: reportContext.teamId,
        participantId: reportContext.participantId,
      };
    }

    if (reportContext.reportStatus === "processing") {
      return {
        ok: false,
        status: "processing_not_resettable",
        message: "Team Fit izvještaj koji je u obradi nije moguće vratiti u queued stanje.",
        reportId: reportContext.id,
        teamId: reportContext.teamId,
        participantId: reportContext.participantId,
      };
    }

    if (reportContext.reportStatus === "ready") {
      return {
        ok: false,
        status: "ready_not_resettable",
        message: "Spreman Team Fit izvještaj nije moguće vratiti u queued stanje.",
        reportId: reportContext.id,
        teamId: reportContext.teamId,
        participantId: reportContext.participantId,
      };
    }

    if (reportContext.reportStatus !== "failed") {
      return {
        ok: false,
        status: "not_resettable",
        message: "Samo failed Team Fit izvještaj može biti vraćen u queued stanje.",
        reportId: reportContext.id,
        teamId: reportContext.teamId,
        participantId: reportContext.participantId,
      };
    }

    const result = await resetTeamFitReport({
      teamFitReportId: input.teamFitReportId,
      organizationId: organization.id,
    });

    if (!result.ok) {
      if (
        result.reason === "already_queued" ||
        result.reason === "processing_not_resettable" ||
        result.reason === "ready_not_resettable" ||
        result.reason === "not_resettable"
      ) {
        return {
          ok: false,
          status: result.reason,
          message: "Team Fit izvještaj više nije u failed stanju i nije moguće vratiti ga u queued.",
          reportId: result.report?.id ?? reportContext.id,
          teamId: result.report?.teamId ?? reportContext.teamId,
          participantId: result.report?.participantId ?? reportContext.participantId,
          lifecycleReason: result.reason,
        };
      }

      if (result.reason === "report_not_found") {
        return {
          ok: false,
          status: "unauthorized",
          message: "Team Fit izvještaj nije dostupan u aktivnom HR kontekstu.",
          reportId: null,
          teamId: null,
          participantId: null,
          lifecycleReason: result.reason,
        };
      }

      return {
        ok: false,
        status: "error",
        message: "Vraćanje Team Fit izvještaja u queued stanje nije uspjelo.",
        reportId: result.report?.id ?? reportContext.id,
        teamId: result.report?.teamId ?? reportContext.teamId,
        participantId: result.report?.participantId ?? reportContext.participantId,
        lifecycleReason: result.reason,
      };
    }

    revalidate(`/dashboard/participants/${reportContext.participantId}/reports`);
    revalidate(
      `/dashboard/teams/${reportContext.teamId}/participants/${reportContext.participantId}/team-fit-reports/${reportContext.id}`,
    );

    return {
      ok: true,
      status: "queued",
      message: "Team Fit izvještaj je vraćen u queued stanje i spreman za novu ručnu pripremu.",
      reportId: result.report.id,
      teamId: result.report.teamId,
      participantId: result.report.participantId,
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Authentication required.",
        reportId: input.teamFitReportId,
        teamId: input.teamId ?? null,
        participantId: input.participantId ?? null,
      };
    }

    return {
      ok: false,
      status: "error",
      message: "Vraćanje Team Fit izvještaja u queued stanje nije dostupno.",
      reportId: input.teamFitReportId,
      teamId: input.teamId ?? null,
      participantId: input.participantId ?? null,
    };
  }
}

async function processConfiguredTeamFitReportV2(input: {
  teamFitReportId: string;
  organizationId: string;
}): Promise<ProcessTeamFitReportV2WithProviderResult> {
  const config = getAiReportConfig();

  return processTeamFitReportV2WithProvider(input, {
    provider: {
      generate: (inputSnapshot) =>
        generateTeamFitReportV2WithOpenAI(inputSnapshot, {
          apiKey: config.openAiApiKey,
          model: config.model,
          reasoningEffort: config.reasoningEffort,
          timeoutMs: config.openAiTimeoutMs,
        }),
    },
  });
}

export async function processTeamFitReportAction(
  input: ProcessTeamFitReportActionInput,
  deps: ProcessTeamFitReportActionDependencies = {},
): Promise<ProcessTeamFitReportActionResult> {
  if (!isNonEmptyString(input.teamFitReportId)) {
    return {
      ok: false,
      status: "error",
      message: "Team Fit izvještaj nije moguće pripremiti bez identifikatora.",
      reportId: null,
      teamId: null,
      participantId: null,
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const getActiveOrganization =
    deps.getActiveOrganization ?? getActiveOrganizationForUser;
  const loadReportContext = deps.loadReportContext ?? loadTeamFitReportActionContext;
  const processTeamFitReport =
    deps.processTeamFitReport ?? processConfiguredTeamFitReportV2;
  const revalidate = deps.revalidate ?? revalidatePath;

  try {
    const user = await requireUser();
    const organization = await getActiveOrganization(user.id);

    if (!organization) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Team Fit izvještaj nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        teamId: null,
        participantId: null,
      };
    }

    const reportContext = await loadReportContext({
      teamFitReportId: input.teamFitReportId,
    });

    if (!reportContext || reportContext.organizationId !== organization.id) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Team Fit izvještaj nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        teamId: null,
        participantId: null,
      };
    }

    if (isNonEmptyString(input.teamId) && input.teamId !== reportContext.teamId) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Team Fit izvještaj nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        teamId: null,
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
        message: "Team Fit izvještaj nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        teamId: null,
        participantId: null,
      };
    }

    if (
      reportContext.reportType !== TEAM_FIT_REPORT_V2_TYPE ||
      reportContext.reportVersion !== TEAM_FIT_REPORT_V2_VERSION
    ) {
      return {
        ok: false,
        status: "unsupported_report_kind",
        message: "Postojeći V1 Team Fit izvještaj dostupan je samo za pregled.",
        reportId: reportContext.id,
        teamId: reportContext.teamId,
        participantId: reportContext.participantId,
      };
    }

    switch (reportContext.reportStatus) {
      case "processing":
        return {
          ok: false,
          status: "already_processing",
          message: "Priprema Team Fit izvještaja je već u toku.",
          reportId: reportContext.id,
          teamId: reportContext.teamId,
          participantId: reportContext.participantId,
        };
      case "ready":
        return {
          ok: false,
          status: "already_ready",
          message: "Team Fit izvještaj je već spreman za pregled.",
          reportId: reportContext.id,
          teamId: reportContext.teamId,
          participantId: reportContext.participantId,
        };
      case "failed":
        return {
          ok: false,
          status: "failed_not_processable",
          message: "Neuspješan Team Fit izvještaj prvo treba vratiti u red za pripremu.",
          reportId: reportContext.id,
          teamId: reportContext.teamId,
          participantId: reportContext.participantId,
        };
      case "queued":
        break;
      default:
        return {
          ok: false,
          status: "not_queued",
          message: "Team Fit izvještaj trenutno nije spreman za ručnu pripremu.",
          reportId: reportContext.id,
          teamId: reportContext.teamId,
          participantId: reportContext.participantId,
        };
    }

    const result = await processTeamFitReport({
      teamFitReportId: input.teamFitReportId,
      organizationId: organization.id,
    });

    if (!result.ok) {
      if (result.reason === "already_processing") {
        return {
          ok: false,
          status: "already_processing",
          message: "Priprema Team Fit izvještaja je već u toku.",
          reportId: reportContext.id,
          teamId: reportContext.teamId,
          participantId: reportContext.participantId,
          processorReason: result.reason,
        };
      }

      if (result.reason === "already_ready") {
        return {
          ok: false,
          status: "already_ready",
          message: "Team Fit izvještaj je već spreman za pregled.",
          reportId: reportContext.id,
          teamId: reportContext.teamId,
          participantId: reportContext.participantId,
          processorReason: result.reason,
        };
      }

      if (result.reason === "failed_not_claimable") {
        return {
          ok: false,
          status: "failed_not_processable",
          message: "Neuspješan Team Fit izvještaj prvo treba vratiti u red za pripremu.",
          reportId: reportContext.id,
          teamId: reportContext.teamId,
          participantId: reportContext.participantId,
          processorReason: result.reason,
        };
      }

      if (result.reason === "not_claimable") {
        return {
          ok: false,
          status: "not_queued",
          message: "Team Fit izvještaj trenutno nije spreman za ručnu pripremu.",
          reportId: reportContext.id,
          teamId: reportContext.teamId,
          participantId: reportContext.participantId,
          processorReason: result.reason,
        };
      }

      if (result.reason === "input_snapshot_failed" || result.reason === "provider_failed" || result.reason === "provider_validation_failed") {
        return {
          ok: false,
          status: "failed",
          message: "Priprema Team Fit izvještaja nije uspjela. Izvještaj je označen kao neuspješan.",
          reportId: reportContext.id,
          teamId: reportContext.teamId,
          participantId: reportContext.participantId,
          marker: result.marker,
          processorReason: result.reason,
        };
      }

      return {
        ok: false,
        status: "error",
        message: "Priprema Team Fit izvještaja trenutno nije uspjela. Pokušajte kasnije.",
        reportId: reportContext.id,
        teamId: reportContext.teamId,
        participantId: reportContext.participantId,
        marker: result.marker,
        processorReason: result.reason,
      };
    }

    revalidate(`/dashboard/participants/${reportContext.participantId}/reports`);
    revalidate(
      `/dashboard/teams/${reportContext.teamId}/participants/${reportContext.participantId}/team-fit-reports/${reportContext.id}`,
    );

    return {
      ok: true,
      status: "ready",
      message: "Team Fit izvještaj je pripremljen i spreman za pregled.",
      reportId: reportContext.id,
      teamId: reportContext.teamId,
      participantId: reportContext.participantId,
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return {
        ok: false,
        status: "unauthorized",
        message: "Team Fit izvještaj nije dostupan u aktivnom HR kontekstu.",
        reportId: null,
        teamId: null,
        participantId: null,
      };
    }

    return {
      ok: false,
      status: "error",
      message: "Priprema Team Fit izvještaja trenutno nije uspjela. Pokušajte kasnije.",
      reportId: input.teamFitReportId,
      teamId: isNonEmptyString(input.teamId) ? input.teamId : null,
      participantId: isNonEmptyString(input.participantId) ? input.participantId : null,
    };
  }
}

export async function queueTeamFitReportV2Action(
  input: QueueTeamFitReportV2ActionInput,
  deps: QueueTeamFitReportV2ActionDependencies = {},
): Promise<QueueTeamFitReportV2ActionResult> {
  if (
    !isNonEmptyString(input.teamId) ||
    !isNonEmptyString(input.participantId) ||
    !isNonEmptyString(input.candidateSourceId) ||
    !isNonEmptyString(input.teamSourceId) ||
    (input.optionalContext !== undefined &&
      (input.optionalContext === null ||
        typeof input.optionalContext !== "object" ||
        Array.isArray(input.optionalContext)))
  ) {
    return {
      ok: false,
      status: "invalid_payload",
      message: "Team Fit V2 red za pripremu zahtijeva tim, kandidata i oba potrebna izvorna identifikatora.",
      reportId: null,
      teamId: isNonEmptyString(input.teamId) ? input.teamId : null,
      participantId: isNonEmptyString(input.participantId) ? input.participantId : null,
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const getActiveOrganization = deps.getActiveOrganization ?? getActiveOrganizationForUser;
  const queueReportShell = deps.queueReportShell ?? queueTeamFitReportV2Shell;
  const revalidate = deps.revalidate ?? revalidatePath;

  try {
    const user = await requireUser();
    const organization = await getActiveOrganization(user.id);
    if (!organization) {
      return { ok: false, status: "unauthorized", message: "Team Fit izvještaj nije dostupan u aktivnom HR kontekstu.", reportId: null, teamId: input.teamId, participantId: input.participantId };
    }

    const result = await queueReportShell({
      organizationId: organization.id,
      teamId: input.teamId,
      participantId: input.participantId,
      candidateSourceType: TEAM_FIT_CANDIDATE_SOURCE_TYPE,
      candidateSourceId: input.candidateSourceId,
      teamSourceType: TEAM_FIT_TEAM_SOURCE_TYPE,
      teamSourceId: input.teamSourceId,
      optionalContext: input.optionalContext,
      createdBy: user.id,
    });

    if (!result.ok) {
      const unauthorized = result.reason === "team_not_found" || result.reason === "participant_not_found" || result.reason === "team_organization_mismatch" || result.reason === "participant_organization_mismatch";
      return { ok: false, status: unauthorized ? "unauthorized" : result.reason === "invalid_payload" ? "invalid_payload" : "error", message: unauthorized ? "Team Fit kontekst nije dostupan u aktivnoj organizaciji." : "Team Fit V2 izvještaj nije moguće staviti u red.", reportId: null, teamId: input.teamId, participantId: input.participantId };
    }

    revalidate(`/dashboard/participants/${input.participantId}/reports`);
    return { ok: true, status: "queued", message: "Team Fit V2 izvještaj je stavljen u red za pripremu.", reportId: result.reportId, teamId: input.teamId, participantId: input.participantId };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return { ok: false, status: "unauthorized", message: "Authentication required.", reportId: null, teamId: input.teamId, participantId: input.participantId };
    }
    return { ok: false, status: "error", message: "Team Fit V2 izvještaj nije moguće staviti u red.", reportId: null, teamId: input.teamId, participantId: input.participantId };
  }
}

export async function saveTeamDynamicsMixedAnswerAction(
  input: SaveTeamDynamicsMixedAnswerActionInput,
  deps: SaveTeamDynamicsMixedAnswerActionDependencies = {},
): Promise<SaveTeamDynamicsMixedAnswerActionResult> {
  if (
    !isNonEmptyString(input.teamAssessmentParticipantId) ||
    !isNonEmptyString(input.questionId)
  ) {
    return buildMixedAnswerActionFailure(
      input,
      "invalid",
      "teamAssessmentParticipantId and questionId are required.",
    );
  }

  if (input.responseFormat === "single_select_likert") {
    if (!isNonEmptyString(input.optionId)) {
      return buildMixedAnswerActionFailure(
        input,
        "invalid",
        "optionId is required for single_select_likert answers.",
      );
    }
  }

  if (input.responseFormat === "best_worst") {
    if (
      !isNonEmptyString(input.bestOptionId) ||
      !isNonEmptyString(input.worstOptionId)
    ) {
      return buildMixedAnswerActionFailure(
        input,
        "invalid",
        "bestOptionId and worstOptionId are required for best_worst answers.",
      );
    }
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const persistMixedAnswer =
    deps.persistMixedAnswer ?? persistValidatedTeamDynamicsMixedAnswer;

  try {
    const user = await requireUser();
    const result = await persistMixedAnswer({
      userId: user.id,
      payload: input,
    });

    if (!result.ok) {
      return {
        ok: false,
        status: result.status,
        reason: result.reason,
        teamAssessmentParticipantId: result.teamAssessmentParticipantId,
        questionId: result.questionId,
        responseFormat: result.responseFormat,
      };
    }

    return {
      ok: true,
      status: result.status,
      teamAssessmentParticipantId: result.value.teamAssessmentParticipantId,
      questionId: result.value.questionId,
      responseFormat: result.value.responseFormat,
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return buildMixedAnswerActionFailure(
        input,
        "error",
        "Authentication required.",
      );
    }

    return buildMixedAnswerActionFailure(
      input,
      "error",
      "Unable to save the Team Dynamics answer right now.",
    );
  }
}

export async function completeTeamAssessmentAction(
  input: CompleteTeamAssessmentActionInput,
  deps: CompleteTeamAssessmentActionDependencies = {},
): Promise<CompleteTeamAssessmentActionResult> {
  if (!isNonEmptyString(input.teamAssessmentParticipantId)) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "teamAssessmentParticipantId is required.",
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const loadExecutionContext = deps.loadExecutionContext ?? loadTeamAssessmentExecutionContext;
  const loadQuestionOutline = deps.loadQuestionOutline ?? loadTeamAssessmentQuestionOutline;
  const loadUiOnlyItems = deps.loadUiOnlyItems ?? loadTeamAssessmentUiOnlyItems;
  const resolveShellState = deps.resolveShellState ?? resolveTeamAssessmentExecutionShellState;
  const loadCompletionReadiness =
    deps.loadCompletionReadiness ?? loadTeamAssessmentCompletionReadinessForContext;
  const transitionCompletion =
    deps.transitionCompletion ?? transitionTeamAssessmentExecutionToCompleted;
  const persistMinimalScore =
    deps.persistMinimalScore ?? persistTeamAssessmentMinimalScoreForContext;
  const user = await requireUser();
  const contextResult = await loadExecutionContext({
    teamAssessmentParticipantId: input.teamAssessmentParticipantId,
    userId: user.id,
  });

  if (!contextResult.ok) {
    return {
      ok: false,
      code: contextResult.code,
      reason: contextResult.message,
    };
  }

  if (
    contextResult.context.wrapperStatus === "completed" &&
    contextResult.context.attemptStatus === "completed"
  ) {
    return {
      ok: true,
      mode: "already_completed",
      completionReadiness: {
        supportedQuestionCount: 0,
        savedValidAnswerCount: 0,
        missingQuestionIds: [],
        invalidSavedAnswerCount: 0,
        isReadyForCompletion: false,
        readinessStatus: "no_supported_items",
      },
    };
  }

  if (contextResult.context.wrapperStatus !== "started") {
    return {
      ok: false,
      code: "wrapper_not_completable",
      reason: "Team Dynamics wrapper must be started before completion is allowed.",
    };
  }

  if (contextResult.context.attemptStatus !== "in_progress") {
    return {
      ok: false,
      code: "attempt_not_completable",
      reason: "Linked Team Dynamics attempt must be in_progress before completion is allowed.",
    };
  }

  const questionOutline = await loadQuestionOutline({
    testId: contextResult.context.test.id,
    locale: contextResult.context.locale,
  });
  const uiOnlyItems = await loadUiOnlyItems({
    testId: contextResult.context.test.id,
    questionOutline,
    locale: contextResult.context.locale,
  });
  const completionReadiness = await loadCompletionReadiness({
    context: contextResult.context,
    shellState: resolveShellState({
      route: "run",
      wrapperStatus: contextResult.context.wrapperStatus,
    }),
    uiOnlyItems: uiOnlyItems.items,
  });

  if (
    completionReadiness.isReadyForCompletion === false ||
    completionReadiness.readinessStatus !== "ready"
  ) {
    return {
      ok: false,
      code: "not_ready",
      reason: "Team Dynamics completion readiness is not satisfied.",
      completionReadiness,
    };
  }

  const completionResult = await transitionCompletion({
    context: contextResult.context,
  });

  if (!completionResult.ok) {
    return {
      ok: false,
      code: completionResult.code,
      reason: completionResult.reason,
      completionReadiness,
    };
  }

  let postCompletionScoring: CompleteTeamAssessmentPostCompletionScoringStatus | undefined;

  if (completionResult.mode === "completed") {
    const completedScoringContext = {
      ...contextResult.context,
      wrapperStatus: completionResult.wrapperStatus,
      attemptStatus: completionResult.attemptStatus,
    };
    const scorePersistenceResult = await persistMinimalScore({
      context: completedScoringContext,
      scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
      uiOnlyItems: uiOnlyItems.items,
    });

    if (scorePersistenceResult.ok) {
      postCompletionScoring = {
        ok: true,
        mode: scorePersistenceResult.mode,
        scoringVersion: scorePersistenceResult.value.scoringVersion,
      };
    } else {
      postCompletionScoring = {
        ok: false,
        code: scorePersistenceResult.code,
        reason: scorePersistenceResult.reason,
        scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
      };
    }
  }

  return {
    ok: true,
    mode: completionResult.mode,
    completionReadiness,
    ...(postCompletionScoring ? { postCompletionScoring } : {}),
  };
}

export async function completeTeamDynamicsMixedAssessmentAction(
  input: CompleteTeamDynamicsMixedAssessmentActionInput,
  deps: CompleteTeamDynamicsMixedAssessmentActionDependencies = {},
): Promise<CompleteTeamDynamicsMixedAssessmentActionResult> {
  if (!isNonEmptyString(input.teamAssessmentParticipantId)) {
    return buildMixedCompletionActionFailure(
      input,
      "invalid",
      "teamAssessmentParticipantId is required.",
    );
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const loadExecutionContext =
    deps.loadExecutionContext ?? loadTeamAssessmentExecutionContext;
  const loadMixedRuntimeHandoff =
    deps.loadMixedRuntimeHandoff ?? loadTeamDynamicsMixedRuntimeHandoff;
  const loadMixedCompletionReadiness =
    deps.loadMixedCompletionReadiness ??
    loadTeamDynamicsMixedCompletionReadinessForContext;
  const transitionCompletion =
    deps.transitionCompletion ?? transitionTeamAssessmentExecutionToCompleted;
  const persistMixedScore =
    deps.persistMixedScore ?? persistTeamDynamicsMixedScoreForContext;

  try {
    const user = await requireUser();
    const contextResult = await loadExecutionContext({
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      userId: user.id,
    });

    if (!contextResult.ok) {
      return buildMixedCompletionActionFailure(
        input,
        "invalid",
        contextResult.message,
      );
    }

    const context = contextResult.context;

    if (
      context.packageSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
      context.test.slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG
    ) {
      return buildMixedCompletionActionFailure(
        input,
        "unsupported",
        `This completion action only supports ${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG}.`,
      );
    }

    const runtimeHandoff = await loadMixedRuntimeHandoff({
      locale: context.locale,
    });
    const completionReadiness = await loadMixedCompletionReadiness({
      context,
      runtimeHandoff,
    });

    if (
      context.wrapperStatus === "completed" &&
      context.attemptStatus === "completed"
    ) {
      return {
        ok: true,
        status: "already_completed",
        teamAssessmentParticipantId: context.teamAssessmentParticipantId,
        readinessStatus: completionReadiness.readinessStatus,
        supportedItemCount: completionReadiness.supportedItemCount,
        savedValidAnswerCount: completionReadiness.savedValidAnswerCount,
        missingQuestionIds: completionReadiness.missingQuestionIds,
      };
    }

    if (
      context.wrapperStatus !== "started" ||
      context.attemptStatus !== "in_progress"
    ) {
      return buildMixedCompletionActionFailure(
        input,
        "not_runnable",
        "Team Dynamics mixed-format assessment is not in a completable state.",
        completionReadiness,
      );
    }

    if (
      completionReadiness.readinessStatus !== "ready" ||
      completionReadiness.isReadyForCompletion === false
    ) {
      return buildMixedCompletionActionFailure(
        input,
        "not_ready",
        "Team Dynamics mixed-format completion readiness is not satisfied.",
        completionReadiness,
      );
    }

    const completionResult = await transitionCompletion({ context });

    if (!completionResult.ok) {
      return buildMixedCompletionActionFailure(
        input,
        "not_runnable",
        completionResult.reason,
        completionReadiness,
      );
    }

    let postCompletionScoring: CompleteTeamDynamicsMixedPostCompletionScoringStatus | undefined;

    if (completionResult.mode === "completed") {
      const completedScoringContext = {
        ...context,
        wrapperStatus: completionResult.wrapperStatus,
        attemptStatus: completionResult.attemptStatus,
      };
      const scorePersistenceResult = await persistMixedScore({
        context: completedScoringContext,
        scoringVersion: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
      });

      if (scorePersistenceResult.ok) {
        postCompletionScoring = {
          ok: true,
          mode: scorePersistenceResult.mode,
          scoringVersion: scorePersistenceResult.value.scoringVersion,
        };
      } else {
        postCompletionScoring = {
          ok: false,
          code: scorePersistenceResult.code,
          reason: scorePersistenceResult.reason,
          scoringVersion: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
        };
      }
    }

    return {
      ok: true,
      status: completionResult.mode,
      teamAssessmentParticipantId: context.teamAssessmentParticipantId,
      readinessStatus: completionReadiness.readinessStatus,
      supportedItemCount: completionReadiness.supportedItemCount,
      savedValidAnswerCount: completionReadiness.savedValidAnswerCount,
      missingQuestionIds: completionReadiness.missingQuestionIds,
      ...(postCompletionScoring ? { postCompletionScoring } : {}),
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return buildMixedCompletionActionFailure(
        input,
        "error",
        "Authentication required.",
      );
    }

    return buildMixedCompletionActionFailure(
      input,
      "error",
      "Unable to complete the Team Dynamics assessment right now.",
    );
  }
}
