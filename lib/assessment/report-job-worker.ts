import "server-only";

import {
  getIpcPromptContract,
  isIpcTestSlug,
} from "@/lib/assessment/ipc-report-contract";
import {
  type RuntimeCompletedAssessmentReport,
  validateRuntimeCompletedAssessmentReport,
} from "@/lib/assessment/report-providers";
import {
  buildCompletedAssessmentReportRequest,
  generateCompletedAssessmentReport,
  type ReportGenerationOverrides,
} from "@/lib/assessment/reports";
import { getAiReportConfig, normalizeAiReportModel } from "@/lib/assessment/report-config";
import {
  normalizeAssessmentLocale,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
import {
  getActivePromptVersion,
  type ActivePromptVersion,
} from "@/lib/assessment/prompt-version";
import { getActiveReportRuntimeConfig } from "@/lib/assessment/report-runtime-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ReportJobAudience = "participant" | "hr";
type ReportGenerator = "mock" | "openai";

type AttemptReportQueueRow = {
  id: string;
  attempt_id: string;
  audience: ReportJobAudience;
  generated_at: string;
};

export type ClaimedReportJob = {
  id: string;
  attempt_id: string;
  test_slug: string;
  generator_type: ReportGenerator;
  generated_at: string;
  report_status: "processing";
  report_type: string | null;
  audience: ReportJobAudience;
  source_type: string | null;
  prompt_version_id: string | null;
  model_name: string | null;
  generator_version: string | null;
  input_snapshot: unknown;
  started_at: string | null;
  completed_at: string | null;
};

type AttemptTestRecord = {
  test_id: string;
  locale: AssessmentLocale | null;
};

type QueuedReportJobSelector = {
  attemptId?: string;
  audience?: ReportJobAudience;
};

type ReportJobFailureCode =
  | "CONFIG_ERROR"
  | "INPUT_BUILD_ERROR"
  | "PROVIDER_ERROR"
  | "PARSE_ERROR"
  | "SNAPSHOT_PERSIST_ERROR"
  | "UNKNOWN_ERROR";

type ReportJobFailure = {
  code: ReportJobFailureCode;
  reason: string;
};

type ReportJobSuccess = {
  status: "ready";
  reportId: string;
  snapshot: RuntimeCompletedAssessmentReport;
};

type ReportJobFailureResult = {
  status: "failed";
  reportId: string;
  failure: ReportJobFailure;
};

const REPORT_PROMPT_KEY = "completed_assessment_report";

export type ProcessClaimedReportJobResult = ReportJobSuccess | ReportJobFailureResult;

class ReportJobError extends Error {
  constructor(
    readonly failureCode: ReportJobFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ReportJobError";
  }
}

type SupabaseOperationResult<TData> = {
  data: TData;
  error: {
    message: string;
  } | null;
};

function trimFailureReason(reason: string): string {
  const normalized = reason.trim().replace(/\s+/g, " ");
  return normalized.length > 300 ? `${normalized.slice(0, 297)}...` : normalized;
}

function normalizeReportJobFailure(error: unknown): ReportJobFailure {
  if (error instanceof ReportJobError) {
    return {
      code: error.failureCode,
      reason: trimFailureReason(error.message),
    };
  }

  if (error instanceof Error) {
    return {
      code: "UNKNOWN_ERROR",
      reason: trimFailureReason(error.message || "Unknown worker error."),
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    reason: "Unknown worker error.",
  };
}

function isRetriableSupabaseErrorMessage(message: string | undefined): boolean {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes("fetch failed") || normalized.includes("networkerror");
}

async function executeSupabaseOperation<TData>(
  operation: () => Promise<SupabaseOperationResult<TData>>,
  label: string,
): Promise<SupabaseOperationResult<TData>> {
  let lastResult: SupabaseOperationResult<TData> | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await operation();

    if (!result.error || !isRetriableSupabaseErrorMessage(result.error.message) || attempt === 3) {
      return result;
    }

    lastResult = result;

    console.warn("Retrying transient Supabase worker operation", {
      label,
      attempt,
      message: result.error.message,
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  return lastResult as SupabaseOperationResult<TData>;
}

function normalizeClaimedReportJob(value: unknown): ClaimedReportJob | null {
  const row = Array.isArray(value) ? value[0] : value;

  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as Record<string, unknown>;
  const audience = candidate.audience;
  const generatorType = candidate.generator_type;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.attempt_id !== "string" ||
    typeof candidate.test_slug !== "string" ||
    typeof candidate.generated_at !== "string" ||
    candidate.report_status !== "processing" ||
    (audience !== "participant" && audience !== "hr") ||
    (generatorType !== "mock" && generatorType !== "openai")
  ) {
    return null;
  }

  return {
    id: candidate.id,
    attempt_id: candidate.attempt_id,
    test_slug: candidate.test_slug,
    generator_type: generatorType,
    generated_at: candidate.generated_at,
    report_status: "processing",
    report_type: typeof candidate.report_type === "string" ? candidate.report_type : null,
    audience,
    source_type: typeof candidate.source_type === "string" ? candidate.source_type : null,
    prompt_version_id:
      typeof candidate.prompt_version_id === "string" ? candidate.prompt_version_id : null,
    model_name: typeof candidate.model_name === "string" ? candidate.model_name : null,
    generator_version:
      typeof candidate.generator_version === "string" ? candidate.generator_version : null,
    input_snapshot: candidate.input_snapshot ?? null,
    started_at: typeof candidate.started_at === "string" ? candidate.started_at : null,
    completed_at: typeof candidate.completed_at === "string" ? candidate.completed_at : null,
  };
}

async function findQueuedReportCandidates(
  selector: QueuedReportJobSelector,
  options?: {
    offset?: number;
    limit?: number;
  },
): Promise<AttemptReportQueueRow[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("attempt_reports")
    .select("id, attempt_id, audience, generated_at")
    .eq("report_status", "queued")
    .order("generated_at", { ascending: true })
    .order("id", { ascending: true })
    .range(options?.offset ?? 0, (options?.offset ?? 0) + ((options?.limit ?? 25) - 1));

  if (selector.attemptId) {
    query = query.eq("attempt_id", selector.attemptId);
  }

  if (selector.audience) {
    query = query.eq("audience", selector.audience);
  }

  const { data, error } = await executeSupabaseOperation(
    async () => await query,
    "findQueuedReportCandidates",
  );

  if (error) {
    throw new ReportJobError(
      "INPUT_BUILD_ERROR",
      `Failed to load queued report job: ${error.message}`,
      { cause: error },
    );
  }

  return ((data ?? []) as AttemptReportQueueRow[]).filter(
    (row) => row.audience === "participant" || row.audience === "hr",
  );
}

async function claimReportJobCandidate(
  candidate: AttemptReportQueueRow,
): Promise<ClaimedReportJob | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await executeSupabaseOperation(
    async () =>
      await supabase.rpc("claim_report_job", {
        p_attempt_id: candidate.attempt_id,
        p_audience: candidate.audience,
      }),
    "claimNextReportJob",
  );

  if (error) {
    throw new ReportJobError(
      "INPUT_BUILD_ERROR",
      `Failed to claim report job: ${error.message}`,
      { cause: error },
    );
  }

  return normalizeClaimedReportJob(data);
}

async function loadAttemptContext(attemptId: string): Promise<{
  testId: string;
  locale: AssessmentLocale;
}> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await executeSupabaseOperation(
    async () =>
      await supabase
        .from("attempts")
        .select("test_id, locale")
        .eq("id", attemptId)
        .maybeSingle(),
    "loadAttemptContext",
  );

  if (error) {
    throw new ReportJobError(
      "INPUT_BUILD_ERROR",
      `Failed to load attempt context: ${error.message}`,
      { cause: error },
    );
  }

  const attempt = data as AttemptTestRecord | null;

  if (!attempt?.test_id) {
    throw new ReportJobError(
      "INPUT_BUILD_ERROR",
      `Attempt ${attemptId} is missing a linked test.`,
    );
  }

  return {
    testId: attempt.test_id,
    locale: normalizeAssessmentLocale(attempt.locale),
  };
}

function getGenerationOverrides(
  job: ClaimedReportJob,
  promptVersion: string,
  resolvedModelName: string | null,
  options?: {
    promptVersionId?: string | null;
    promptTemplate?: ActivePromptVersion | null;
  },
): ReportGenerationOverrides {
  return {
    provider: job.generator_type,
    promptVersion,
    promptVersionId: options?.promptVersionId ?? null,
    promptTemplate: options?.promptTemplate ?? null,
    ...(resolvedModelName ? { model: resolvedModelName } : {}),
  };
}

function resolveReportModelName(
  job: ClaimedReportJob,
  runtimeConfigModelName: string | null,
): string | null {
  if (job.generator_type !== "openai") {
    return null;
  }

  return normalizeAiReportModel(
    job.model_name ??
      runtimeConfigModelName ??
      getAiReportConfig().model,
  );
}

async function loadPromptVersionForJob(
  job: ClaimedReportJob,
  testId: string,
  locale: AssessmentLocale,
): Promise<ActivePromptVersion | null> {
  if (job.generator_type !== "openai") {
    return null;
  }

  try {
    return await getActivePromptVersion({
      testId,
      reportType: job.report_type,
      audience: job.audience,
      sourceType: job.source_type,
      generatorType: job.generator_type,
      promptKey: isIpcTestSlug(job.test_slug)
        ? getIpcPromptContract(job.audience).promptKey
        : REPORT_PROMPT_KEY,
    }, {
      locale,
    });
  } catch (error) {
    throw new ReportJobError(
      "CONFIG_ERROR",
      error instanceof Error ? error.message : "Failed to load active prompt version.",
      { cause: error },
    );
  }
}

async function freezeProcessingReportMetadata(
  reportId: string,
  metadata: {
    promptVersionId?: string | null;
    modelName?: string | null;
  },
): Promise<void> {
  const updatePayload: {
    prompt_version_id?: string | null;
    model_name?: string | null;
  } = {};

  if (metadata.promptVersionId !== undefined) {
    updatePayload.prompt_version_id = metadata.promptVersionId;
  }

  if (metadata.modelName !== undefined) {
    updatePayload.model_name = metadata.modelName;
  }

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await executeSupabaseOperation(
    async () =>
      await supabase
        .from("attempt_reports")
        .update(updatePayload)
        .eq("id", reportId)
        .eq("report_status", "processing"),
    "freezeProcessingReportMetadata",
  );

  if (error) {
    throw new ReportJobError(
      "SNAPSHOT_PERSIST_ERROR",
      `Failed to freeze report metadata: ${error.message}`,
      { cause: error },
    );
  }
}

async function completeReportJob(
  reportId: string,
  reportSnapshot: RuntimeCompletedAssessmentReport,
  metadata: {
    modelName: string | null;
    generatorVersion: string | null;
  },
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await executeSupabaseOperation(
    async () =>
      await supabase.rpc("complete_report_job", {
        p_report_id: reportId,
        p_report_snapshot: reportSnapshot as unknown,
        p_model_name: metadata.modelName,
        p_generator_version: metadata.generatorVersion,
      }),
    "completeReportJob",
  );

  if (error) {
    throw new ReportJobError(
      "SNAPSHOT_PERSIST_ERROR",
      `Failed to complete report job: ${error.message}`,
      { cause: error },
    );
  }
}

async function failReportJob(reportId: string, failure: ReportJobFailure): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await executeSupabaseOperation(
    async () =>
      await supabase.rpc("fail_report_job", {
        p_report_id: reportId,
        p_failure_code: failure.code,
        p_failure_reason: failure.reason,
      }),
    "failReportJob",
  );

  if (error) {
    throw new Error(`Failed to persist report job failure: ${error.message}`);
  }
}

async function loadRuntimeConfigForJob(job: ClaimedReportJob) {
  try {
    return await getActiveReportRuntimeConfig({
      reportType: job.report_type,
      audience: job.audience,
      sourceType: job.source_type,
      generatorType: job.generator_type,
    });
  } catch (error) {
    throw new ReportJobError(
      "CONFIG_ERROR",
      error instanceof Error ? error.message : "Failed to load active report runtime config.",
      { cause: error },
    );
  }
}

async function buildReportSnapshot(job: ClaimedReportJob): Promise<{
  snapshot: RuntimeCompletedAssessmentReport;
  modelName: string | null;
}> {
  const attemptContext = await loadAttemptContext(job.attempt_id);
  const [runtimeConfig, activePromptVersion] = await Promise.all([
    loadRuntimeConfigForJob(job),
    loadPromptVersionForJob(job, attemptContext.testId, attemptContext.locale),
  ]);
  const resolvedModelName = resolveReportModelName(job, runtimeConfig?.modelName ?? null);
  const promptVersion = activePromptVersion?.version ?? getAiReportConfig().promptVersion;
  const overrides = getGenerationOverrides(job, promptVersion, resolvedModelName, {
    promptVersionId: activePromptVersion?.id ?? job.prompt_version_id,
    promptTemplate: activePromptVersion,
  });
  const request = await buildCompletedAssessmentReportRequest(attemptContext.testId, job.attempt_id, {
    audience: job.audience,
    locale: attemptContext.locale,
    promptVersion,
  });

  if (!request) {
    throw new ReportJobError(
      "INPUT_BUILD_ERROR",
      `Attempt ${job.attempt_id} is not eligible for report generation.`,
    );
  }

  await freezeProcessingReportMetadata(job.id, {
    promptVersionId: activePromptVersion?.id,
    modelName: resolvedModelName,
  });

  console.info("Report provider generation started", {
    reportId: job.id,
    attemptId: job.attempt_id,
    audience: job.audience,
    provider: overrides.provider,
    model: resolvedModelName,
    promptVersion,
    promptVersionId: activePromptVersion?.id ?? null,
  });

  const generationResult = await generateCompletedAssessmentReport(request, overrides);

  if (generationResult.status !== "ready") {
    throw new ReportJobError(
      "PROVIDER_ERROR",
      generationResult.failureReason || generationResult.failureCode,
    );
  }

  console.info("Report provider generation succeeded", {
    reportId: job.id,
    attemptId: job.attempt_id,
    audience: job.audience,
    provider: job.generator_type,
  });

  console.info("Report snapshot normalization succeeded", {
    reportId: job.id,
    attemptId: job.attempt_id,
    reportFamily: isIpcTestSlug(job.test_slug) ? "ipip_ipc" : "big_five",
  });

  const validationResult = validateRuntimeCompletedAssessmentReport(generationResult.report, {
    testSlug: job.test_slug,
    audience: job.audience,
  });

  if (!validationResult.ok) {
    throw new ReportJobError(
      "PARSE_ERROR",
      `Generated report failed schema validation: ${validationResult.reason}`,
    );
  }

  return {
    snapshot: validationResult.value,
    modelName: resolvedModelName,
  };
}

export async function claimNextReportJob(
  selector: QueuedReportJobSelector = {},
): Promise<ClaimedReportJob | null> {
  const batchSize = 25;

  for (let offset = 0; ; offset += batchSize) {
    const candidates = await findQueuedReportCandidates(selector, {
      offset,
      limit: batchSize,
    });

    if (candidates.length === 0) {
      return null;
    }

    for (const candidate of candidates) {
      const claimedJob = await claimReportJobCandidate(candidate);

      if (claimedJob) {
        return claimedJob;
      }
    }

    if (candidates.length < batchSize) {
      return null;
    }
  }
}

export async function processClaimedReportJob(
  job: ClaimedReportJob,
): Promise<ProcessClaimedReportJobResult> {
  try {
    const { snapshot, modelName } = await buildReportSnapshot(job);

    await completeReportJob(job.id, snapshot, {
      modelName: job.generator_type === "openai" ? modelName : null,
      generatorVersion: job.generator_version ?? "v1",
    });

    console.info("complete_report_job succeeded", {
      reportId: job.id,
      attemptId: job.attempt_id,
      audience: job.audience,
    });

    return {
      status: "ready",
      reportId: job.id,
      snapshot,
    };
  } catch (error) {
    const failure = normalizeReportJobFailure(error);

    console.error("Report job processing failed", {
      reportId: job.id,
      attemptId: job.attempt_id,
      audience: job.audience,
      failureCode: failure.code,
      failureReason: failure.reason,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    await failReportJob(job.id, failure);

    console.info("fail_report_job succeeded", {
      reportId: job.id,
      attemptId: job.attempt_id,
      audience: job.audience,
      failureCode: failure.code,
    });

    return {
      status: "failed",
      reportId: job.id,
      failure,
    };
  }
}
