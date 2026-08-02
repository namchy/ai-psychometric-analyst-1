import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const AI_USAGE_PROVIDER = "openai" as const;
export const AI_USAGE_ENDPOINT = "https://api.openai.com/v1/chat/completions" as const;
export const AI_USAGE_SERVICE_TIER = "standard" as const;
export const AI_USAGE_PRICING_VERSION = "openai_gpt_5_6_sol_standard_20260802" as const;

export type AiUsageCallPurpose =
  | "single_test_hr_generation"
  | "single_test_participant_generation"
  | "composite_hr_generation"
  | "composite_hr_diagnostic_review"
  | "individual_development_profile_generation";

export type AiUsageContext = {
  organizationId: string;
  participantId: string;
  assessmentAssignmentId?: string | null;
  attemptId?: string | null;
  attemptReportId?: string | null;
  assessmentReportId?: string | null;
  reportType: string;
  callPurpose: AiUsageCallPurpose;
  serviceTier?: string;
  attemptNumber?: number;
};

export type AiUsageRequestMetadata = {
  requestedModel: string;
  reasoningEffort?: string | null;
  provider?: string;
  endpoint?: string;
  serviceTier?: string;
};

export type AiUsageResponseTelemetry = {
  usage?: unknown;
  responseModel?: string | null;
  providerRequestId?: string | null;
  providerProcessingMs?: number | null;
  httpStatus?: number | null;
};

export type NormalizedAiUsage = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  usageDetailsComplete: boolean;
  costEstimateStatus: "complete" | "partial" | "unavailable";
};

export type AiPricingSnapshot = {
  id: string;
  provider: string;
  model: string;
  serviceTier: string;
  pricingVersion: string;
  currency: string;
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  cacheWriteUsdPerMillion: number;
  outputUsdPerMillion: number;
  longContextThresholdTokens: number;
  longContextInputMultiplier: number;
  longContextOutputMultiplier: number;
};

export type AiHistoricalCost = {
  uncachedInputTokens: number | null;
  inputCostUsd: number | null;
  cachedInputCostUsd: number | null;
  cacheWriteCostUsd: number | null;
  outputCostUsd: number | null;
  historicalEstimatedCostUsd: number | null;
  costEstimateStatus: "complete" | "partial" | "unavailable";
};

export type AiUsageRecorder = {
  start(input: {
    context: AiUsageContext;
    request: AiUsageRequestMetadata;
    startedAt?: string;
  }): Promise<{ eventId: string; startedAt: string }>;
  succeed(
    eventId: string,
    input: AiUsageResponseTelemetry & { durationMs: number },
  ): Promise<void>;
  fail(
    eventId: string,
    input: AiUsageResponseTelemetry & {
      durationMs: number;
      errorCode?: string | null;
      errorMessage: string;
    },
  ): Promise<void>;
};

export type InstrumentedAiProviderCallResult<T> = {
  value: T;
  telemetry: AiUsageResponseTelemetry;
};

export class AiUsageInstrumentationError extends Error {
  readonly phase: "start" | "succeed" | "fail";
  readonly eventId: string | null;

  constructor(
    message: string,
    phase: "start" | "succeed" | "fail",
    eventId: string | null = null,
  ) {
    super(message);
    this.name = "AiUsageInstrumentationError";
    this.phase = phase;
    this.eventId = eventId;
  }
}

export class AiProviderTransportError extends Error {
  readonly httpStatus: number | null;
  readonly providerRequestId: string | null;
  readonly providerProcessingMs: number | null;

  constructor(
    message: string,
    details?: {
      httpStatus?: number | null;
      providerRequestId?: string | null;
      providerProcessingMs?: number | null;
    },
  ) {
    super(message);
    this.name = "AiProviderTransportError";
    this.httpStatus = details?.httpStatus ?? null;
    this.providerRequestId = details?.providerRequestId ?? null;
    this.providerProcessingMs = details?.providerProcessingMs ?? null;
  }
}

function toNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getUsageDetails(usage: unknown): Record<string, unknown> | null {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;
  const details = (usage as Record<string, unknown>).prompt_tokens_details;
  return details && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : null;
}

export function normalizeOpenAiChatCompletionsUsage(usage: unknown): NormalizedAiUsage {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return {
      inputTokens: null,
      cachedInputTokens: null,
      cacheWriteTokens: null,
      outputTokens: null,
      reasoningTokens: null,
      totalTokens: null,
      usageDetailsComplete: false,
      costEstimateStatus: "unavailable",
    };
  }

  const record = usage as Record<string, unknown>;
  const details = getUsageDetails(usage);
  const completionDetails =
    record.completion_tokens_details &&
    typeof record.completion_tokens_details === "object" &&
    !Array.isArray(record.completion_tokens_details)
      ? (record.completion_tokens_details as Record<string, unknown>)
      : null;
  const inputTokens = toNonNegativeInteger(record.prompt_tokens);
  const outputTokens = toNonNegativeInteger(record.completion_tokens);
  const totalTokens = toNonNegativeInteger(record.total_tokens);
  const cachedInputTokens = details ? toNonNegativeInteger(details.cached_tokens) : null;
  const cacheWriteTokens = details ? toNonNegativeInteger(details.cache_write_tokens) : null;
  const reasoningTokens = completionDetails
    ? toNonNegativeInteger(completionDetails.reasoning_tokens)
    : null;
  const usageDetailsComplete =
    inputTokens !== null &&
    outputTokens !== null &&
    totalTokens !== null &&
    cachedInputTokens !== null &&
    cacheWriteTokens !== null;

  return {
    inputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
    usageDetailsComplete,
    costEstimateStatus:
      inputTokens === null || outputTokens === null || totalTokens === null
        ? "unavailable"
        : usageDetailsComplete
          ? "complete"
          : "partial",
  };
}

function priceTokens(tokens: number, rate: number, multiplier: number): number {
  return (tokens * rate * multiplier) / 1_000_000;
}

export function calculateAiHistoricalCost(
  usage: NormalizedAiUsage,
  pricing: AiPricingSnapshot,
): AiHistoricalCost {
  if (usage.inputTokens === null || usage.outputTokens === null) {
    return {
      uncachedInputTokens: null,
      inputCostUsd: null,
      cachedInputCostUsd: null,
      cacheWriteCostUsd: null,
      outputCostUsd: null,
      historicalEstimatedCostUsd: null,
      costEstimateStatus: "unavailable",
    };
  }

  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0;
  const uncachedInputTokens = Math.max(
    usage.inputTokens - cachedInputTokens - cacheWriteTokens,
    0,
  );
  const isLongContext = usage.inputTokens > pricing.longContextThresholdTokens;
  const inputMultiplier = isLongContext ? pricing.longContextInputMultiplier : 1;
  const outputMultiplier = isLongContext ? pricing.longContextOutputMultiplier : 1;
  const inputCostUsd = priceTokens(
    uncachedInputTokens,
    pricing.inputUsdPerMillion,
    inputMultiplier,
  );
  const cachedInputCostUsd = priceTokens(
    cachedInputTokens,
    pricing.cachedInputUsdPerMillion,
    inputMultiplier,
  );
  const cacheWriteCostUsd = priceTokens(
    cacheWriteTokens,
    pricing.cacheWriteUsdPerMillion,
    inputMultiplier,
  );
  const outputCostUsd = priceTokens(
    usage.outputTokens,
    pricing.outputUsdPerMillion,
    outputMultiplier,
  );

  return {
    uncachedInputTokens,
    inputCostUsd,
    cachedInputCostUsd,
    cacheWriteCostUsd,
    outputCostUsd,
    historicalEstimatedCostUsd:
      inputCostUsd + cachedInputCostUsd + cacheWriteCostUsd + outputCostUsd,
    costEstimateStatus: usage.costEstimateStatus,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function durationSince(startedAtMs: number): number {
  return Math.max(0, Date.now() - startedAtMs);
}

function formatErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const sanitized = raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized.length > 500 ? `${sanitized.slice(0, 497)}...` : sanitized;
}

function transportDetailsFromError(error: unknown): AiUsageResponseTelemetry {
  if (error instanceof AiProviderTransportError) {
    return {
      httpStatus: error.httpStatus,
      providerRequestId: error.providerRequestId,
      providerProcessingMs: error.providerProcessingMs,
    };
  }
  return {};
}

export async function runInstrumentedAiProviderCall<T>(input: {
  recorder?: AiUsageRecorder;
  context?: AiUsageContext;
  request: AiUsageRequestMetadata;
  execute: () => Promise<InstrumentedAiProviderCallResult<T>>;
}): Promise<T> {
  if (!input.recorder) {
    return (await input.execute()).value;
  }

  if (!input.context) {
    throw new AiUsageInstrumentationError(
      "AI usage context is required before an OpenAI request.",
      "start",
    );
  }

  const startedAtMs = Date.now();
  let started: { eventId: string; startedAt: string };

  try {
    started = await input.recorder.start({
      context: input.context,
      request: input.request,
      startedAt: nowIso(),
    });
  } catch (error) {
    if (error instanceof AiUsageInstrumentationError) {
      throw error;
    }

    throw new AiUsageInstrumentationError(
      `AI usage start telemetry persistence failed: ${formatErrorMessage(error)}`,
      "start",
    );
  }

  try {
    const result = await input.execute();
    try {
      await input.recorder.succeed(started.eventId, {
        ...result.telemetry,
        durationMs: durationSince(startedAtMs),
      });
    } catch (error) {
      throw new AiUsageInstrumentationError(
        `AI usage success telemetry persistence failed: ${formatErrorMessage(error)}`,
        "succeed",
        started.eventId,
      );
    }
    return result.value;
  } catch (error) {
    if (error instanceof AiUsageInstrumentationError) {
      throw error;
    }

    const transportDetails = transportDetailsFromError(error);
    try {
      await input.recorder.fail(started.eventId, {
        ...transportDetails,
        durationMs: durationSince(startedAtMs),
        errorCode: error instanceof AiProviderTransportError ? "provider_transport_error" : "provider_error",
        errorMessage: formatErrorMessage(error),
      });
    } catch (persistenceError) {
      throw new AiUsageInstrumentationError(
        `AI usage failure telemetry persistence failed: ${formatErrorMessage(persistenceError)}`,
        "fail",
        started.eventId,
      );
    }
    throw error;
  }
}

type AiUsagePricingRow = {
  id: string;
  provider: string;
  model: string;
  service_tier: string;
  pricing_version: string;
  currency: string;
  input_usd_per_million: number | string;
  cached_input_usd_per_million: number | string;
  cache_write_usd_per_million: number | string;
  output_usd_per_million: number | string;
  long_context_threshold_tokens: number | string;
  long_context_input_multiplier: number | string;
  long_context_output_multiplier: number | string;
};

function toPricingSnapshot(row: AiUsagePricingRow): AiPricingSnapshot {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    serviceTier: row.service_tier,
    pricingVersion: row.pricing_version,
    currency: row.currency,
    inputUsdPerMillion: Number(row.input_usd_per_million),
    cachedInputUsdPerMillion: Number(row.cached_input_usd_per_million),
    cacheWriteUsdPerMillion: Number(row.cache_write_usd_per_million),
    outputUsdPerMillion: Number(row.output_usd_per_million),
    longContextThresholdTokens: Number(row.long_context_threshold_tokens),
    longContextInputMultiplier: Number(row.long_context_input_multiplier),
    longContextOutputMultiplier: Number(row.long_context_output_multiplier),
  };
}

export function createSupabaseAiUsageRecorder(
  supabase: ReturnType<typeof createSupabaseAdminClient> = createSupabaseAdminClient(),
): AiUsageRecorder {
  return {
    async start({ context, request, startedAt = nowIso() }) {
      const model = request.requestedModel;
      const serviceTier = request.serviceTier ?? context.serviceTier ?? AI_USAGE_SERVICE_TIER;
      const { data: pricingRow, error: pricingError } = await supabase
        .from("ai_model_pricing_versions")
        .select(
          "id, provider, model, service_tier, pricing_version, currency, input_usd_per_million, cached_input_usd_per_million, cache_write_usd_per_million, output_usd_per_million, long_context_threshold_tokens, long_context_input_multiplier, long_context_output_multiplier",
        )
        .eq("provider", request.provider ?? AI_USAGE_PROVIDER)
        .eq("model", model)
        .eq("service_tier", serviceTier)
        .eq("pricing_version", AI_USAGE_PRICING_VERSION)
        .limit(1)
        .maybeSingle();

      if (pricingError || !pricingRow) {
        throw new AiUsageInstrumentationError(
          `AI pricing snapshot is unavailable for ${model}/${serviceTier}.`,
          "start",
        );
      }

      const pricing = toPricingSnapshot(pricingRow as AiUsagePricingRow);
      const { data: event, error } = await supabase
        .from("ai_generation_usage_events")
        .insert({
          organization_id: context.organizationId,
          participant_id: context.participantId,
          assessment_assignment_id: context.assessmentAssignmentId ?? null,
          attempt_id: context.attemptId ?? null,
          attempt_report_id: context.attemptReportId ?? null,
          assessment_report_id: context.assessmentReportId ?? null,
          report_type: context.reportType,
          call_purpose: context.callPurpose,
          provider: request.provider ?? AI_USAGE_PROVIDER,
          endpoint: request.endpoint ?? AI_USAGE_ENDPOINT,
          service_tier: serviceTier,
          requested_model: model,
          reasoning_effort: request.reasoningEffort ?? null,
          attempt_number: context.attemptNumber ?? 1,
          request_status: "started",
          pricing_version_id: pricing.id,
          pricing_version: pricing.pricingVersion,
          currency: pricing.currency,
          input_rate_snapshot: pricing.inputUsdPerMillion,
          cached_input_rate_snapshot: pricing.cachedInputUsdPerMillion,
          cache_write_rate_snapshot: pricing.cacheWriteUsdPerMillion,
          output_rate_snapshot: pricing.outputUsdPerMillion,
          long_context_threshold_tokens_snapshot: pricing.longContextThresholdTokens,
          long_context_input_multiplier_snapshot: pricing.longContextInputMultiplier,
          long_context_output_multiplier_snapshot: pricing.longContextOutputMultiplier,
          cost_estimate_status: "unavailable",
          usage_details_complete: false,
          started_at: startedAt,
        })
        .select("id")
        .single();

      if (error || !event?.id) {
        throw new AiUsageInstrumentationError(
          `AI usage event start persistence failed${error ? `: ${formatErrorMessage(error)}` : "."}`,
          "start",
        );
      }

      return { eventId: event.id, startedAt };
    },

    async succeed(eventId, input) {
      const normalized = normalizeOpenAiChatCompletionsUsage(input.usage);
      const { data: pricingRow, error: pricingError } = await supabase
        .from("ai_generation_usage_events")
        .select(
          "input_rate_snapshot, cached_input_rate_snapshot, cache_write_rate_snapshot, output_rate_snapshot, long_context_threshold_tokens_snapshot, long_context_input_multiplier_snapshot, long_context_output_multiplier_snapshot",
        )
        .eq("id", eventId)
        .eq("request_status", "started")
        .single();
      if (pricingError || !pricingRow) {
        throw new Error("Started AI usage event could not be loaded for completion.");
      }

      const cost = calculateAiHistoricalCost(normalized, {
        id: eventId,
        provider: AI_USAGE_PROVIDER,
        model: "",
        serviceTier: AI_USAGE_SERVICE_TIER,
        pricingVersion: "",
        currency: "usd",
        inputUsdPerMillion: Number(pricingRow.input_rate_snapshot),
        cachedInputUsdPerMillion: Number(pricingRow.cached_input_rate_snapshot),
        cacheWriteUsdPerMillion: Number(pricingRow.cache_write_rate_snapshot),
        outputUsdPerMillion: Number(pricingRow.output_rate_snapshot),
        longContextThresholdTokens: Number(pricingRow.long_context_threshold_tokens_snapshot),
        longContextInputMultiplier: Number(pricingRow.long_context_input_multiplier_snapshot),
        longContextOutputMultiplier: Number(pricingRow.long_context_output_multiplier_snapshot),
      });
      const { data: updatedEvent, error } = await supabase
        .from("ai_generation_usage_events")
        .update({
          request_status: "succeeded",
          http_status: input.httpStatus ?? null,
          response_model: input.responseModel ?? null,
          provider_request_id: input.providerRequestId ?? null,
          provider_processing_ms: input.providerProcessingMs ?? null,
          input_tokens: normalized.inputTokens,
          cached_input_tokens: normalized.cachedInputTokens,
          cache_write_tokens: normalized.cacheWriteTokens,
          output_tokens: normalized.outputTokens,
          reasoning_tokens: normalized.reasoningTokens,
          total_tokens: normalized.totalTokens,
          usage_details_complete: normalized.usageDetailsComplete,
          uncached_input_cost_usd: cost.inputCostUsd,
          cached_input_cost_usd: cost.cachedInputCostUsd,
          cache_write_cost_usd: cost.cacheWriteCostUsd,
          output_cost_usd: cost.outputCostUsd,
          historical_estimated_cost_usd: cost.historicalEstimatedCostUsd,
          cost_estimate_status: cost.costEstimateStatus,
          duration_ms: input.durationMs,
          completed_at: nowIso(),
        })
        .eq("id", eventId)
        .eq("request_status", "started")
        .select("id")
        .maybeSingle();
      if (error || !updatedEvent?.id) {
        throw new Error(error?.message ?? "AI usage success event update matched no started event.");
      }
    },

    async fail(eventId, input) {
      const { data: updatedEvent, error } = await supabase
        .from("ai_generation_usage_events")
        .update({
          request_status: "failed",
          http_status: input.httpStatus ?? null,
          provider_request_id: input.providerRequestId ?? null,
          provider_processing_ms: input.providerProcessingMs ?? null,
          duration_ms: input.durationMs,
          error_code: input.errorCode ?? "provider_error",
          error_message: formatErrorMessage(input.errorMessage),
          cost_estimate_status: "unavailable",
          completed_at: nowIso(),
        })
        .eq("id", eventId)
        .eq("request_status", "started")
        .select("id")
        .maybeSingle();
      if (error || !updatedEvent?.id) {
        throw new Error(error?.message ?? "AI usage failure event update matched no started event.");
      }
    },
  };
}

export type AiUsageEventAggregateRow = {
  participant_id: string | null;
  attempt_id: string | null;
  attempt_report_id: string | null;
  assessment_report_id: string | null;
  report_type: string;
  requested_model: string;
  request_status: "started" | "succeeded" | "failed";
  completed_at: string | null;
  total_tokens: number | null;
  historical_estimated_cost_usd: number | string | null;
};

export type AiUsageSummary = {
  limit: number | "all";
  callCount: number;
  candidateCount: number;
  totalTokens: number;
  averageTokensPerCall: number;
  averageTokensPerReport: number;
  totalHistoricalEstimatedCostUsd: number;
  averageCostPerCallUsd: number;
  averageCostPerReportUsd: number;
  averageCostPerCandidateUsd: number;
  successfulCalls: number;
  failedCalls: number;
  breakdownByReportType: Record<string, { calls: number; costUsd: number }>;
  breakdownByModel: Record<string, { calls: number; costUsd: number }>;
};

function round(value: number): number {
  return Number(value.toFixed(8));
}

export function summarizeAiUsageEvents(
  events: AiUsageEventAggregateRow[],
  limit: number | "all" = "all",
): AiUsageSummary {
  const completed = events
    .filter((event) => event.completed_at !== null)
    .sort((left, right) => String(right.completed_at).localeCompare(String(left.completed_at)));
  const selected = limit === "all" ? completed : completed.slice(0, Math.max(0, limit));
  const candidateIds = new Set(selected.map((event) => event.participant_id).filter(Boolean));
  const reportIds = new Set(
    selected
      .map((event) => event.assessment_report_id ?? event.attempt_report_id ?? event.attempt_id)
      .filter(Boolean),
  );
  const totalTokens = selected.reduce((sum, event) => sum + (event.total_tokens ?? 0), 0);
  const totalCost = selected.reduce(
    (sum, event) => sum + (event.historical_estimated_cost_usd === null ? 0 : Number(event.historical_estimated_cost_usd)),
    0,
  );
  const byReportType: AiUsageSummary["breakdownByReportType"] = {};
  const byModel: AiUsageSummary["breakdownByModel"] = {};
  for (const event of selected) {
    const cost = event.historical_estimated_cost_usd === null ? 0 : Number(event.historical_estimated_cost_usd);
    byReportType[event.report_type] ??= { calls: 0, costUsd: 0 };
    byReportType[event.report_type].calls += 1;
    byReportType[event.report_type].costUsd += cost;
    byModel[event.requested_model] ??= { calls: 0, costUsd: 0 };
    byModel[event.requested_model].calls += 1;
    byModel[event.requested_model].costUsd += cost;
  }
  for (const bucket of Object.values(byReportType)) bucket.costUsd = round(bucket.costUsd);
  for (const bucket of Object.values(byModel)) bucket.costUsd = round(bucket.costUsd);
  return {
    limit,
    callCount: selected.length,
    candidateCount: candidateIds.size,
    totalTokens,
    averageTokensPerCall: selected.length ? round(totalTokens / selected.length) : 0,
    averageTokensPerReport: reportIds.size ? round(totalTokens / reportIds.size) : 0,
    totalHistoricalEstimatedCostUsd: round(totalCost),
    averageCostPerCallUsd: selected.length ? round(totalCost / selected.length) : 0,
    averageCostPerReportUsd: reportIds.size ? round(totalCost / reportIds.size) : 0,
    averageCostPerCandidateUsd: candidateIds.size ? round(totalCost / candidateIds.size) : 0,
    successfulCalls: selected.filter((event) => event.request_status === "succeeded").length,
    failedCalls: selected.filter((event) => event.request_status === "failed").length,
    breakdownByReportType: byReportType,
    breakdownByModel: byModel,
  };
}
