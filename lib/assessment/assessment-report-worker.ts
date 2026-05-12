import "server-only";

import {
  buildCompositeHrInputSnapshot,
  type CompositeHrInputSnapshot,
} from "@/lib/assessment/composite-input";
import {
  COMPOSITE_HR_REPORT_CONTRACT_VERSION,
  formatCompositeHrReportValidationErrors,
  validateCompositeHrReportSnapshot,
  type CompositeHrReportSnapshot,
} from "@/lib/assessment/composite-hr-report-contract";
import {
  COMPOSITE_HR_REPORT_MOCK_PROVIDER,
  COMPOSITE_HR_REPORT_MOCK_PROVIDER_VERSION,
  generateMockCompositeHrReport,
} from "@/lib/assessment/composite-hr-report-provider-mock";
import type { AssessmentReportRecord } from "@/lib/assessment/assessment-reports";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AssessmentReportRow = AssessmentReportRecord;

type AssessmentReportQueryOptions = {
  assessmentAssignmentId?: string;
};

type AssessmentReportWorkerDependencies = {
  createSupabaseClient?: typeof createSupabaseAdminClient;
  buildCompositeInputSnapshot?: typeof buildCompositeHrInputSnapshot;
  generateCompositeHrReport?: typeof generateMockCompositeHrReport;
  validateCompositeHrReport?: typeof validateCompositeHrReportSnapshot;
  now?: () => string;
  logger?: Pick<Console, "info" | "warn" | "error">;
};

type AssessmentReportClaimCandidate = AssessmentReportRow;

export type ClaimedAssessmentReportJob = AssessmentReportRow & {
  report_status: "processing";
};

export type AssessmentReportWorkerFailureCode =
  | "COMPOSITE_INPUT_NOT_READY"
  | "COMPOSITE_REPORT_VALIDATION_FAILED"
  | "COMPOSITE_PROVIDER_NOT_IMPLEMENTED";

export type AssessmentReportWorkerFailure = {
  code: AssessmentReportWorkerFailureCode;
  reason: string;
};

export type ProcessClaimedAssessmentReportJobResult =
  | {
      status: "ready";
      reportId: string;
      snapshot: CompositeHrReportSnapshot;
    }
  | {
      status: "failed";
      reportId: string;
      failure: AssessmentReportWorkerFailure;
    }
  | {
      status: "skipped";
      reportId: string;
      reason: string;
    };

const DEFAULT_BATCH_SIZE = 25;

function trimReason(reason: string): string {
  const normalized = reason.trim().replace(/\s+/g, " ");
  return normalized.length > 300 ? `${normalized.slice(0, 297)}...` : normalized;
}

function getSupabaseClient(deps?: AssessmentReportWorkerDependencies) {
  return deps?.createSupabaseClient?.() ?? createSupabaseAdminClient();
}

function getNow(deps?: AssessmentReportWorkerDependencies): string {
  return deps?.now?.() ?? new Date().toISOString();
}

function getLogger(deps?: AssessmentReportWorkerDependencies): Pick<Console, "info" | "warn" | "error"> {
  return deps?.logger ?? console;
}

function isAssessmentReportCandidate(value: unknown): value is AssessmentReportClaimCandidate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.assessment_assignment_id === "string" &&
    typeof candidate.organization_id === "string" &&
    typeof candidate.participant_id === "string" &&
    candidate.report_type === "composite" &&
    candidate.audience === "hr" &&
    candidate.source_type === "assessment"
  );
}

function isProcessingAssessmentReportRow(value: unknown): value is ClaimedAssessmentReportJob {
  if (!isAssessmentReportCandidate(value)) {
    return false;
  }

  return (value as Record<string, unknown>).report_status === "processing";
}

function normalizeClaimedAssessmentReportJob(value: unknown): ClaimedAssessmentReportJob | null {
  if (!isProcessingAssessmentReportRow(value)) {
    return null;
  }

  return {
    ...value,
    report_status: "processing",
  };
}

function compareQueuedAssessmentReportCandidates(
  left: AssessmentReportClaimCandidate,
  right: AssessmentReportClaimCandidate,
): number {
  const leftQueuedAt = left.queued_at;
  const rightQueuedAt = right.queued_at;

  if (leftQueuedAt && !rightQueuedAt) {
    return -1;
  }

  if (!leftQueuedAt && rightQueuedAt) {
    return 1;
  }

  if (leftQueuedAt && rightQueuedAt && leftQueuedAt !== rightQueuedAt) {
    return leftQueuedAt.localeCompare(rightQueuedAt);
  }

  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at);
  }

  return left.id.localeCompare(right.id);
}

async function loadQueuedAssessmentReportCandidates(
  deps: AssessmentReportWorkerDependencies | undefined,
  options?: AssessmentReportQueryOptions & {
    offset?: number;
    limit?: number;
  },
): Promise<AssessmentReportClaimCandidate[]> {
  const supabase = getSupabaseClient(deps);
  const limit = options?.limit ?? DEFAULT_BATCH_SIZE;
  const collected: AssessmentReportClaimCandidate[] = [];

  for (let offset = options?.offset ?? 0; ; offset += limit) {
    let query = supabase
      .from("assessment_reports")
      .select(
        "id, assessment_assignment_id, organization_id, participant_id, report_type, audience, source_type, report_status, generator_type, contract_version, prompt_version_id, model_name, generator_version, input_snapshot, report_snapshot, failure_code, failure_reason, queued_at, started_at, completed_at, generated_at, created_at, updated_at, metadata",
      )
      .eq("report_status", "queued")
      .eq("report_type", "composite")
      .eq("audience", "hr")
      .eq("source_type", "assessment")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (options?.assessmentAssignmentId) {
      query = query.eq("assessment_assignment_id", options.assessmentAssignmentId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to load queued assessment report candidates: ${error.message}`);
    }

    const batch = ((data ?? []) as AssessmentReportClaimCandidate[]).filter(isAssessmentReportCandidate);
    collected.push(...batch);

    if (batch.length < limit) {
      break;
    }
  }

  return collected.sort(compareQueuedAssessmentReportCandidates);
}

async function claimAssessmentReportCandidate(
  candidate: AssessmentReportClaimCandidate,
  deps?: AssessmentReportWorkerDependencies,
): Promise<ClaimedAssessmentReportJob | null> {
  const supabase = getSupabaseClient(deps);
  const { data, error } = await supabase
    .from("assessment_reports")
    .update({
      report_status: "processing",
      started_at: getNow(deps),
      failure_code: null,
      failure_reason: null,
    })
    .eq("id", candidate.id)
    .eq("report_status", "queued")
    .select(
      "id, assessment_assignment_id, organization_id, participant_id, report_type, audience, source_type, report_status, generator_type, contract_version, prompt_version_id, model_name, generator_version, input_snapshot, report_snapshot, failure_code, failure_reason, queued_at, started_at, completed_at, generated_at, created_at, updated_at, metadata",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to claim assessment report job: ${error.message}`);
  }

  return normalizeClaimedAssessmentReportJob(data);
}

async function updateAssessmentReportInputSnapshot(
  job: ClaimedAssessmentReportJob,
  inputSnapshot: CompositeHrInputSnapshot,
  deps?: AssessmentReportWorkerDependencies,
): Promise<void> {
  const supabase = getSupabaseClient(deps);
  const { error } = await supabase
    .from("assessment_reports")
    .update({
      input_snapshot: inputSnapshot,
      contract_version: inputSnapshot.targetReportContractVersion,
      generator_version: inputSnapshot.metadata.builderVersion,
      model_name: null,
      prompt_version_id: null,
    })
    .eq("id", job.id)
    .eq("report_status", "processing");

  if (error) {
    throw new Error(`Failed to persist composite assessment report input snapshot: ${error.message}`);
  }
}

async function completeAssessmentReportJob(
  job: ClaimedAssessmentReportJob,
  reportSnapshot: CompositeHrReportSnapshot,
  deps?: AssessmentReportWorkerDependencies,
): Promise<void> {
  const supabase = getSupabaseClient(deps);
  const completedAt = getNow(deps);
  const { error } = await supabase
    .from("assessment_reports")
    .update({
      report_status: "ready",
      report_snapshot: reportSnapshot,
      completed_at: completedAt,
      generated_at: completedAt,
      failure_code: null,
      failure_reason: null,
      model_name: null,
      generator_type: COMPOSITE_HR_REPORT_MOCK_PROVIDER,
      generator_version: COMPOSITE_HR_REPORT_MOCK_PROVIDER_VERSION,
      contract_version: COMPOSITE_HR_REPORT_CONTRACT_VERSION,
    })
    .eq("id", job.id)
    .eq("report_status", "processing");

  if (error) {
    throw new Error(`Failed to complete composite assessment report: ${error.message}`);
  }
}

async function failAssessmentReportJob(
  job: ClaimedAssessmentReportJob,
  failure: AssessmentReportWorkerFailure,
  deps?: AssessmentReportWorkerDependencies,
): Promise<void> {
  const supabase = getSupabaseClient(deps);
  const { error } = await supabase
    .from("assessment_reports")
    .update({
      report_status: "failed",
      failure_code: failure.code,
      failure_reason: failure.reason,
      completed_at: getNow(deps),
    })
    .eq("id", job.id)
    .eq("report_status", "processing");

  if (error) {
    throw new Error(`Failed to mark composite assessment report as failed: ${error.message}`);
  }
}

function normalizeInputNotReadyReason(error: unknown): string {
  if (error instanceof Error) {
    return trimReason(error.message || "Composite HR report input is not ready yet.");
  }

  return "Composite HR report input is not ready yet.";
}

function buildInputNotReadyFailure(error: unknown): AssessmentReportWorkerFailure {
  return {
    code: "COMPOSITE_INPUT_NOT_READY",
    reason: normalizeInputNotReadyReason(error),
  };
}

function buildReportValidationFailure(reason: string): AssessmentReportWorkerFailure {
  return {
    code: "COMPOSITE_REPORT_VALIDATION_FAILED",
    reason: trimReason(reason),
  };
}

function validateAssessmentReportJobShape(job: ClaimedAssessmentReportJob): void {
  if (
    job.report_type !== "composite" ||
    job.audience !== "hr" ||
    job.source_type !== "assessment" ||
    job.report_status !== "processing"
  ) {
    throw new Error(`Claimed assessment report ${job.id} is not a composite HR assessment job.`);
  }
}

export async function claimNextAssessmentReportJob(
  options: AssessmentReportQueryOptions = {},
  deps?: AssessmentReportWorkerDependencies,
): Promise<ClaimedAssessmentReportJob | null> {
  const batchSize = DEFAULT_BATCH_SIZE;

  for (let offset = 0; ; offset += batchSize) {
    const candidates = await loadQueuedAssessmentReportCandidates(deps, {
      ...options,
      offset,
      limit: batchSize,
    });

    if (candidates.length === 0) {
      return null;
    }

    for (const candidate of candidates) {
      const claimedJob = await claimAssessmentReportCandidate(candidate, deps);

      if (claimedJob) {
        return claimedJob;
      }
    }

    if (candidates.length < batchSize) {
      return null;
    }
  }
}

export async function processClaimedAssessmentReportJob(
  job: ClaimedAssessmentReportJob,
  deps?: AssessmentReportWorkerDependencies,
): Promise<ProcessClaimedAssessmentReportJobResult> {
  const logger = getLogger(deps);
  validateAssessmentReportJobShape(job);

  const buildInputSnapshot = deps?.buildCompositeInputSnapshot ?? buildCompositeHrInputSnapshot;
  let inputSnapshot: CompositeHrInputSnapshot;

  try {
    inputSnapshot = await buildInputSnapshot({
      assessmentAssignmentId: job.assessment_assignment_id,
      organizationId: job.organization_id,
      participantId: job.participant_id,
    });
  } catch (error) {
    const failure = buildInputNotReadyFailure(error);

    logger.warn("Composite assessment report input snapshot could not be built", {
      reportId: job.id,
      assessmentAssignmentId: job.assessment_assignment_id,
      failureCode: failure.code,
      failureReason: failure.reason,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    await failAssessmentReportJob(job, failure, deps);

    return {
      status: "failed",
      reportId: job.id,
      failure,
    };
  }

  await updateAssessmentReportInputSnapshot(job, inputSnapshot, deps);

  logger.info("Composite assessment report input snapshot persisted", {
    reportId: job.id,
    assessmentAssignmentId: job.assessment_assignment_id,
    builderVersion: inputSnapshot.metadata.builderVersion,
    contractVersion: inputSnapshot.targetReportContractVersion,
  });

  const generateReport = deps?.generateCompositeHrReport ?? generateMockCompositeHrReport;
  const validateReport = deps?.validateCompositeHrReport ?? validateCompositeHrReportSnapshot;
  let reportSnapshot: CompositeHrReportSnapshot | unknown;

  try {
    reportSnapshot = await generateReport(inputSnapshot);
  } catch (error) {
    const failure = buildReportValidationFailure(
      error instanceof Error ? error.message : "Composite HR report provider returned invalid output.",
    );

    logger.warn("Composite assessment report provider failed before validation", {
      reportId: job.id,
      assessmentAssignmentId: job.assessment_assignment_id,
      failureCode: failure.code,
      failureReason: failure.reason,
    });

    await failAssessmentReportJob(job, failure, deps);

    return {
      status: "failed",
      reportId: job.id,
      failure,
    };
  }

  const validation = validateReport(reportSnapshot);

  if (!validation.ok) {
    const failure = buildReportValidationFailure(
      formatCompositeHrReportValidationErrors(validation.errors),
    );

    logger.warn("Composite assessment report failed runtime validation", {
      reportId: job.id,
      assessmentAssignmentId: job.assessment_assignment_id,
      failureCode: failure.code,
      failureReason: failure.reason,
    });

    await failAssessmentReportJob(job, failure, deps);

    return {
      status: "failed",
      reportId: job.id,
      failure,
    };
  }

  await completeAssessmentReportJob(job, validation.value, deps);

  logger.info("Composite assessment report completed with mock provider", {
    reportId: job.id,
    assessmentAssignmentId: job.assessment_assignment_id,
    contractVersion: validation.value.contractVersion,
    provider: validation.value.metadata.provider,
  });

  return {
    status: "ready",
    reportId: job.id,
    snapshot: validation.value,
  };
}
