const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;

    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return emptyModulePath;
  }

  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      resolveWithExtensions(path.join(projectRoot, request.slice(2))),
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const accounting = require("../lib/assessment/ai-usage-accounting.ts");

const pricing = {
  id: "pricing-1",
  provider: "openai",
  model: "gpt-5.6-sol",
  serviceTier: "standard",
  pricingVersion: "openai_gpt_5_6_sol_standard_20260802",
  currency: "usd",
  inputUsdPerMillion: 5,
  cachedInputUsdPerMillion: 0.5,
  cacheWriteUsdPerMillion: 6.25,
  outputUsdPerMillion: 30,
  longContextThresholdTokens: 272000,
  longContextInputMultiplier: 2,
  longContextOutputMultiplier: 1.5,
};

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.00000001, `${actual} !== ${expected}`);
}

async function main() {
  const normalized = accounting.normalizeOpenAiChatCompletionsUsage({
    prompt_tokens: 100000,
    prompt_tokens_details: {
      cached_tokens: 20000,
      cache_write_tokens: 10000,
    },
    completion_tokens: 12000,
    completion_tokens_details: { reasoning_tokens: 4000 },
    total_tokens: 112000,
  });

  assert.equal(normalized.inputTokens, 100000);
  assert.equal(normalized.cachedInputTokens, 20000);
  assert.equal(normalized.cacheWriteTokens, 10000);
  assert.equal(normalized.outputTokens, 12000);
  assert.equal(normalized.reasoningTokens, 4000);
  assert.equal(normalized.totalTokens, 112000);
  assert.equal(normalized.costEstimateStatus, "complete");

  const cost = accounting.calculateAiHistoricalCost(normalized, pricing);
  assert.equal(cost.uncachedInputTokens, 70000);
  assertClose(cost.historicalEstimatedCostUsd, 0.7825);
  assertClose(cost.outputCostUsd, 0.36);
  assert.equal(cost.reasoningTokens, undefined);

  const longContextCost = accounting.calculateAiHistoricalCost(
    accounting.normalizeOpenAiChatCompletionsUsage({
      prompt_tokens: 300000,
      completion_tokens: 10000,
      total_tokens: 310000,
      prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
    }),
    pricing,
  );
  assertClose(longContextCost.inputCostUsd, 3);
  assertClose(longContextCost.outputCostUsd, 0.45);

  assert.equal(
    accounting.normalizeOpenAiChatCompletionsUsage(null).costEstimateStatus,
    "unavailable",
  );
  assert.equal(
    accounting.normalizeOpenAiChatCompletionsUsage({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    }).costEstimateStatus,
    "partial",
  );

  const summary = accounting.summarizeAiUsageEvents(
    [
      {
        participant_id: "participant-old",
        attempt_id: null,
        attempt_report_id: "attempt-report-old",
        assessment_report_id: null,
        report_type: "individual",
        requested_model: "gpt-5.6-sol",
        request_status: "succeeded",
        completed_at: "2026-08-02T08:00:00.000Z",
        total_tokens: 100,
        historical_estimated_cost_usd: "0.10",
      },
      {
        participant_id: "participant-new",
        attempt_id: null,
        attempt_report_id: null,
        assessment_report_id: "assessment-report-new",
        report_type: "composite",
        requested_model: "gpt-5.6-sol",
        request_status: "failed",
        completed_at: "2026-08-02T10:00:00.000Z",
        total_tokens: null,
        historical_estimated_cost_usd: null,
      },
      {
        participant_id: "participant-new",
        attempt_id: null,
        attempt_report_id: null,
        assessment_report_id: "assessment-report-new",
        report_type: "composite",
        requested_model: "gpt-5.6-sol",
        request_status: "succeeded",
        completed_at: "2026-08-02T09:00:00.000Z",
        total_tokens: 200,
        historical_estimated_cost_usd: 0.2,
      },
    ],
    2,
  );
  assert.equal(summary.callCount, 2);
  assert.equal(summary.candidateCount, 1);
  assert.equal(summary.totalTokens, 200);
  assert.equal(summary.successfulCalls, 1);
  assert.equal(summary.failedCalls, 1);
  assert.equal(summary.breakdownByReportType.composite.calls, 2);

  const context = {
    organizationId: "org-1",
    participantId: "participant-1",
    assessmentReportId: "assessment-report-1",
    reportType: "composite",
    callPurpose: "composite_hr_generation",
  };
  const lifecycle = [];
  let executions = 0;
  const recorder = {
    async start(input) {
      lifecycle.push({ type: "started", input });
      return { eventId: "event-1", startedAt: input.startedAt };
    },
    async succeed(eventId, input) {
      lifecycle.push({ type: "succeeded", eventId, input });
    },
    async fail(eventId, input) {
      lifecycle.push({ type: "failed", eventId, input });
    },
  };

  const value = await accounting.runInstrumentedAiProviderCall({
    recorder,
    context,
    request: { requestedModel: "gpt-5.6-sol", reasoningEffort: "medium" },
    execute: async () => {
      executions += 1;
      return {
        value: "ok",
        telemetry: {
          httpStatus: 200,
          providerRequestId: "req-1",
          providerProcessingMs: 42,
          usage: { prompt_tokens: 1 },
        },
      };
    },
  });
  assert.equal(value, "ok");
  assert.equal(executions, 1);
  assert.deepEqual(lifecycle.map((item) => item.type), ["started", "succeeded"]);
  assert.equal(lifecycle[1].input.providerRequestId, "req-1");
  assert.equal(lifecycle[1].input.providerProcessingMs, 42);

  let failedExecutions = 0;
  const failedEvents = [];
  await assert.rejects(
    () =>
      accounting.runInstrumentedAiProviderCall({
        recorder: {
          ...recorder,
          async start(input) {
            return { eventId: "event-2", startedAt: input.startedAt };
          },
          async fail(eventId, input) {
            failedEvents.push({ eventId, input });
          },
        },
        context,
        request: { requestedModel: "gpt-5.6-sol" },
        execute: async () => {
          failedExecutions += 1;
          throw new Error("provider timeout");
        },
      }),
    /provider timeout/,
  );
  assert.equal(failedExecutions, 1);
  assert.equal(failedEvents.length, 1);
  assert.equal(failedEvents[0].input.errorCode, "provider_error");

  let preventedExecutions = 0;
  await assert.rejects(
    () =>
      accounting.runInstrumentedAiProviderCall({
        recorder: {
          ...recorder,
          async start() {
            throw new Error("telemetry insert failed");
          },
        },
        context,
        request: { requestedModel: "gpt-5.6-sol" },
        execute: async () => {
          preventedExecutions += 1;
          return { value: "must-not-run", telemetry: {} };
        },
      }),
    /telemetry insert failed/,
  );
  assert.equal(preventedExecutions, 0);

  let finalUpdateCalls = 0;
  await assert.rejects(
    () =>
      accounting.runInstrumentedAiProviderCall({
        recorder: {
          ...recorder,
          async succeed() {
            finalUpdateCalls += 1;
            throw new Error("telemetry completion failed");
          },
        },
        context,
        request: { requestedModel: "gpt-5.6-sol" },
        execute: async () => ({ value: "one-call", telemetry: {} }),
      }),
    /AI usage success telemetry persistence failed/,
  );
  assert.equal(finalUpdateCalls, 1);

  const migration = fs.readFileSync(
    path.join(projectRoot, "supabase/migrations/20260802140000_create_ai_usage_cost_accounting.sql"),
    "utf8",
  );
  for (const required of [
    "ai_model_pricing_versions",
    "ai_generation_usage_events",
    "openai_gpt_5_6_sol_standard_20260802",
    "272000",
    "6.25",
    "alter table public.ai_generation_usage_events enable row level security",
    "completed_at desc",
  ]) {
    assert.equal(migration.includes(required), true, required);
  }

  for (const sourcePath of [
    "lib/assessment/report-provider-openai.ts",
    "lib/assessment/composite-hr-report-provider-openai.ts",
    "lib/assessment/individual-development-profile-openai-provider.ts",
  ]) {
    const source = fs.readFileSync(path.join(projectRoot, sourcePath), "utf8");
    assert.equal(source.includes("runInstrumentedAiProviderCall"), true, sourcePath);
    assert.equal(source.includes("x-request-id"), true, sourcePath);
    assert.equal(source.includes("openai-processing-ms"), true, sourcePath);
  }

  const compositeSource = fs.readFileSync(
    path.join(projectRoot, "lib/assessment/composite-hr-report-provider-openai.ts"),
    "utf8",
  );
  assert.equal(compositeSource.includes('"composite_hr_generation"'), true);
  assert.equal(compositeSource.includes('"composite_hr_diagnostic_review"'), true);

  const guardedLiveTest = spawnSync(
    process.execPath,
    [path.join(projectRoot, "scripts/test-mwms-hr-report-lifecycle.cjs")],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DEEP_PROFILE_ALLOW_REMOTE_DB_TESTS: "false",
      },
    },
  );
  assert.equal(guardedLiveTest.status, 0, guardedLiveTest.stderr);
  assert.match(
    `${guardedLiveTest.stdout}\n${guardedLiveTest.stderr}`,
    /Remote DB lifecycle test requires DEEP_PROFILE_ALLOW_REMOTE_DB_TESTS=true/,
  );

  console.log("AI usage accounting tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
