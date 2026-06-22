const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(
  projectRoot,
  "scripts",
  "generate-amra-replay-single-test-participant-reports.cjs",
);
const scriptSource = fs.readFileSync(scriptPath, "utf8");

assert.match(scriptSource, /CONFIRM_AMRA_REPLAY_PARTICIPANT_REPORT_GENERATION/);
assert.match(scriptSource, /TARGET_REPLAY_PARTICIPANT_ID/);
assert.match(scriptSource, /TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID/);
assert.match(scriptSource, /TARGET_TEST_SLUG/);
assert.match(scriptSource, /all/);
assert.match(scriptSource, /participant/);
assert.match(scriptSource, /single_test/);
assert.match(scriptSource, /openai/);
assert.match(scriptSource, /gpt-5\.5/);
assert.match(scriptSource, /AI_REPORT_FALLBACK_TO_MOCK/);
assert.match(scriptSource, /amra_replay_fixture_v1/);
assert.match(scriptSource, /a5678fd5-8fea-4308-8569-5448f26b4f71/);
assert.match(scriptSource, /033f8975-5d9c-4c66-8842-f37527d556d5/);
assert.match(scriptSource, /e71d472a-13cb-4cc9-9582-6eaa262affca/);
assert.match(scriptSource, /54702bc1-7d91-492e-9b50-14aff6706d34/);
assert.match(scriptSource, /8aefc4f9-3ca6-48f2-a41e-0f6b75c5e0d1/);
assert.doesNotMatch(scriptSource, /recoverHrAttemptReport/);
assert.doesNotMatch(scriptSource, /audience:\s*"hr"/);
assert.doesNotMatch(scriptSource, /\.eq\("audience", "hr"\)/);
assert.doesNotMatch(scriptSource, /team_fit_reports|assessment_reports|team_assessment_reports/);
assert.doesNotMatch(scriptSource, /supabase migration|db push|db reset|migration repair/i);
assert.doesNotMatch(scriptSource, /components\/|renderer\.tsx|renderer\.ts|app\/\(protected\)/i);

const {
  AI_REPORT_MODEL_ENV,
  AI_REPORT_PROVIDER_ENV,
  ALLOWED_TEST_SLUGS,
  CONFIRM_ENV,
  EXPECTED_MODEL,
  EXPECTED_PROVIDER,
  EXPECTED_TARGETS,
  SUPPORTED_TARGET_TEST_SLUGS,
  TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV,
  TARGET_REPLAY_PARTICIPANT_ID_ENV,
  TARGET_TEST_SLUG_ALL,
  TARGET_TEST_SLUG_ENV,
  TARGET_TESTS,
  buildParticipantAttemptReportQueueInsertPayload,
  buildReadOnlyAuditSql,
  buildRuntimeConfigCreateSql,
  buildRuntimeConfigInspectSql,
  evaluatePersistedReportPostcondition,
  evaluateReplayAssignmentGuard,
  evaluateReplayParticipantGuard,
  evaluateRuntimeResolution,
  generateAmraReplaySingleTestParticipantReports,
  resolveClaimedJobModelName,
  resolveRequestedTestSlugs,
  validateRequestedTargetInputs,
} = require(scriptPath);

assert.deepEqual(ALLOWED_TEST_SLUGS, ["mwms_v1", "safran_v1", "ipip-neo-120-v1"]);
assert.deepEqual(SUPPORTED_TARGET_TEST_SLUGS, [
  "mwms_v1",
  "safran_v1",
  "ipip-neo-120-v1",
  "all",
]);
assert.deepEqual(resolveRequestedTestSlugs(TARGET_TEST_SLUG_ALL), ALLOWED_TEST_SLUGS);
assert.deepEqual(resolveRequestedTestSlugs("mwms_v1"), ["mwms_v1"]);

const queuePayload = buildParticipantAttemptReportQueueInsertPayload({
  attemptId: TARGET_TESTS.mwms_v1.attemptId,
  testSlug: "mwms_v1",
  generatorType: "openai",
  modelName: "gpt-5.5",
  generatedAt: "2026-06-22T10:00:00.000Z",
});
assert.equal(queuePayload.audience, "participant");
assert.equal(queuePayload.report_type, "individual");
assert.equal(queuePayload.source_type, "single_test");
assert.equal(queuePayload.generator_type, "openai");
assert.equal(queuePayload.model_name, "gpt-5.5");

const defaultValidation = validateRequestedTargetInputs({}, { requireExplicitIds: false, requireExplicitTestSlug: false });
assert.equal(defaultValidation.ok, true);
assert.equal(defaultValidation.inputs.participantId, EXPECTED_TARGETS.participantId);
assert.equal(defaultValidation.inputs.assessmentAssignmentId, EXPECTED_TARGETS.assessmentAssignmentId);
assert.equal(defaultValidation.inputs.testSlug, "all");
assert.deepEqual(defaultValidation.inputs.targetTestSlugs, ALLOWED_TEST_SLUGS);

const confirmedMissingValidation = validateRequestedTargetInputs(
  { [CONFIRM_ENV]: "true" },
  { requireExplicitIds: true, requireExplicitTestSlug: true },
);
assert.equal(confirmedMissingValidation.ok, false);
assert.deepEqual(confirmedMissingValidation.missing, [
  TARGET_REPLAY_PARTICIPANT_ID_ENV,
  TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV,
  TARGET_TEST_SLUG_ENV,
]);

const wrongTargetValidation = validateRequestedTargetInputs(
  {
    [TARGET_REPLAY_PARTICIPANT_ID_ENV]: "2432eb12-2b54-4881-bef2-2ac687b59e0b",
    [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: "bad42da0-aa18-4ee0-bc6e-552eee8cd38b",
    [TARGET_TEST_SLUG_ENV]: "mwms_v1",
  },
  { requireExplicitIds: true, requireExplicitTestSlug: true },
);
assert.equal(wrongTargetValidation.ok, false);
assert.equal(wrongTargetValidation.mismatches.length, 2);

const wrongSlugValidation = validateRequestedTargetInputs(
  {
    [TARGET_REPLAY_PARTICIPANT_ID_ENV]: EXPECTED_TARGETS.participantId,
    [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_TARGETS.assessmentAssignmentId,
    [TARGET_TEST_SLUG_ENV]: "unknown_v1",
  },
  { requireExplicitIds: true, requireExplicitTestSlug: true },
);
assert.equal(wrongSlugValidation.ok, false);

const confirmedSingleValidation = validateRequestedTargetInputs(
  {
    [TARGET_REPLAY_PARTICIPANT_ID_ENV]: EXPECTED_TARGETS.participantId,
    [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_TARGETS.assessmentAssignmentId,
    [TARGET_TEST_SLUG_ENV]: "ipip-neo-120-v1",
  },
  { requireExplicitIds: true, requireExplicitTestSlug: true },
);
assert.equal(confirmedSingleValidation.ok, true);
assert.deepEqual(confirmedSingleValidation.inputs.targetTestSlugs, ["ipip-neo-120-v1"]);

const confirmedAllValidation = validateRequestedTargetInputs(
  {
    [TARGET_REPLAY_PARTICIPANT_ID_ENV]: EXPECTED_TARGETS.participantId,
    [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_TARGETS.assessmentAssignmentId,
    [TARGET_TEST_SLUG_ENV]: "all",
  },
  { requireExplicitIds: true, requireExplicitTestSlug: true },
);
assert.equal(confirmedAllValidation.ok, true);
assert.deepEqual(confirmedAllValidation.inputs.targetTestSlugs, ALLOWED_TEST_SLUGS);

assert.equal(
  evaluateReplayParticipantGuard({
    organization_id: EXPECTED_TARGETS.organizationId,
    email: EXPECTED_TARGETS.participantEmail,
  }),
  true,
);
assert.equal(
  evaluateReplayParticipantGuard({
    organization_id: EXPECTED_TARGETS.organizationId,
    email: "amrafagan@nestox.com",
  }),
  false,
);

assert.equal(
  evaluateReplayAssignmentGuard(
    {
      organization_id: EXPECTED_TARGETS.organizationId,
      participant_id: EXPECTED_TARGETS.participantId,
      assignment_type: "standard_battery",
      metadata: { fixture: EXPECTED_TARGETS.fixture },
    },
    EXPECTED_TARGETS.participantId,
  ),
  true,
);
assert.equal(
  evaluateReplayAssignmentGuard(
    {
      organization_id: EXPECTED_TARGETS.organizationId,
      participant_id: EXPECTED_TARGETS.participantId,
      assignment_type: "standard_battery",
      metadata: { fixture: "not_replay_fixture" },
    },
    EXPECTED_TARGETS.participantId,
  ),
  false,
);

const providerBlockedState = evaluateRuntimeResolution({
  declaredProvider: EXPECTED_PROVIDER,
  declaredModel: EXPECTED_MODEL,
  actualQueueResolvedProvider: "mock",
  actualQueueResolvedModel: null,
  activeOpenAiRuntimeModel: EXPECTED_MODEL,
  aiConfigModel: EXPECTED_MODEL,
  fallbackToMockEnabled: false,
});
assert.equal(providerBlockedState.ok, false);
assert.equal(providerBlockedState.status, "blocked_provider_not_openai");

const modelBlockedState = evaluateRuntimeResolution({
  declaredProvider: EXPECTED_PROVIDER,
  declaredModel: "gpt-4.1",
  actualQueueResolvedProvider: "openai",
  actualQueueResolvedModel: "gpt-4.1",
  activeOpenAiRuntimeModel: EXPECTED_MODEL,
  aiConfigModel: EXPECTED_MODEL,
  fallbackToMockEnabled: false,
});
assert.equal(modelBlockedState.ok, false);
assert.equal(modelBlockedState.status, "blocked_model_not_gpt_5_5");

const fallbackBlockedState = evaluateRuntimeResolution({
  declaredProvider: EXPECTED_PROVIDER,
  declaredModel: EXPECTED_MODEL,
  actualQueueResolvedProvider: "openai",
  actualQueueResolvedModel: EXPECTED_MODEL,
  activeOpenAiRuntimeModel: EXPECTED_MODEL,
  aiConfigModel: EXPECTED_MODEL,
  fallbackToMockEnabled: true,
});
assert.equal(fallbackBlockedState.ok, false);
assert.equal(fallbackBlockedState.status, "blocked_mock_fallback_enabled");

const runtimePassState = evaluateRuntimeResolution({
  declaredProvider: EXPECTED_PROVIDER,
  declaredModel: EXPECTED_MODEL,
  actualQueueResolvedProvider: "openai",
  actualQueueResolvedModel: EXPECTED_MODEL,
  activeOpenAiRuntimeModel: EXPECTED_MODEL,
  aiConfigModel: EXPECTED_MODEL,
  fallbackToMockEnabled: false,
});
assert.equal(runtimePassState.ok, true);
assert.equal(runtimePassState.actualWorkerResolvedModel, EXPECTED_MODEL);

assert.equal(
  resolveClaimedJobModelName({
    claimedJobGeneratorType: "openai",
    claimedJobModelName: null,
    activeOpenAiRuntimeModel: EXPECTED_MODEL,
    aiConfigModel: EXPECTED_MODEL,
  }),
  EXPECTED_MODEL,
);
assert.equal(
  resolveClaimedJobModelName({
    claimedJobGeneratorType: "mock",
    claimedJobModelName: null,
    activeOpenAiRuntimeModel: EXPECTED_MODEL,
    aiConfigModel: EXPECTED_MODEL,
  }),
  null,
);

const persistedMismatch = evaluatePersistedReportPostcondition({
  generatorType: "mock",
  modelName: null,
});
assert.equal(persistedMismatch.ok, false);
assert.equal(persistedMismatch.status, "failed_persisted_provider_mismatch");

const persistedPass = evaluatePersistedReportPostcondition({
  generatorType: EXPECTED_PROVIDER,
  modelName: EXPECTED_MODEL,
});
assert.equal(persistedPass.ok, true);

const auditSql = buildReadOnlyAuditSql();
assert.match(auditSql, /participant/);
assert.match(auditSql, /single_test/);
assert.match(auditSql, /ipip-neo-120-v1/);
assert.match(auditSql, /safran_v1/);
assert.match(auditSql, /mwms_v1/);

const runtimeInspectSql = buildRuntimeConfigInspectSql();
assert.match(runtimeInspectSql, /report_runtime_configs/);
assert.match(runtimeInspectSql, /audience = 'participant'/);

const runtimeCreateSql = buildRuntimeConfigCreateSql();
assert.match(runtimeCreateSql, /insert into public\.report_runtime_configs/i);
assert.match(runtimeCreateSql, /'gpt-5\.5'/);
assert.match(runtimeCreateSql, /'participant'/);

function createDeps(options = {}) {
  const runtimeResolution =
    options.runtimeResolution ?? {
      declaredProvider: options.declaredProvider ?? null,
      declaredModel: options.declaredModel ?? null,
      actualQueueResolvedProvider: "openai",
      actualQueueResolvedModel: "gpt-5.5",
      actualWorkerResolvedProvider: "openai",
      actualWorkerResolvedModel: "gpt-5.5",
      fallbackToMockEnabled: false,
      ok: true,
      status: "ok",
      activeOpenAiRuntimeConfigId: "runtime-openai-id",
      defaultLaneRuntimeConfigId: "runtime-default-id",
    };

  const existingReportsBySlug = options.existingReportsBySlug ?? {};
  const attemptsBySlug =
    options.attemptsBySlug ??
    Object.fromEntries(
      ALLOWED_TEST_SLUGS.map((testSlug) => [
        testSlug,
        {
          attemptId: TARGET_TESTS[testSlug].attemptId,
          organizationId: EXPECTED_TARGETS.organizationId,
          participantId: EXPECTED_TARGETS.participantId,
          status: "completed",
          completedAt: "2026-06-22T10:00:00.000Z",
        },
      ]),
    );

  return {
    createSupabaseAdminClient() {
      return {};
    },
    getAiReportConfig() {
      return {
        provider: runtimeResolution.actualWorkerResolvedProvider,
        model: runtimeResolution.actualWorkerResolvedModel,
        promptVersion: "v1",
        ipipNeo120ParticipantReportVersion: "v2",
        ipipNeo120ParticipantGenerationMode: "segmented",
        fallbackToMock: runtimeResolution.fallbackToMockEnabled,
        openAiApiKey: null,
        openAiTimeoutMs: 120000,
      };
    },
    async getActiveReportRuntimeConfig() {
      if (runtimeResolution.actualQueueResolvedProvider !== "openai") {
        return null;
      }

      return {
        id: runtimeResolution.activeOpenAiRuntimeConfigId ?? "runtime-openai-id",
        reportType: "individual",
        audience: "participant",
        sourceType: "single_test",
        generatorType: "openai",
        modelName: runtimeResolution.actualWorkerResolvedModel,
        reasoningEffort: "medium",
        temperature: null,
        notes: null,
        createdAt: "2026-06-22T10:00:00.000Z",
        updatedAt: "2026-06-22T10:00:00.000Z",
        updatedBy: null,
      };
    },
    async claimNextReportJob() {
      throw new Error("claimNextReportJob should not run in offline dry-run tests.");
    },
    async processClaimedReportJob() {
      throw new Error("processClaimedReportJob should not run in offline dry-run tests.");
    },
    __testData: {
      runtimeResolution,
      participant:
        options.participant ?? {
          id: EXPECTED_TARGETS.participantId,
          organization_id: EXPECTED_TARGETS.organizationId,
          email: EXPECTED_TARGETS.participantEmail,
        },
      assignment:
        options.assignment ?? {
          id: EXPECTED_TARGETS.assessmentAssignmentId,
          organization_id: EXPECTED_TARGETS.organizationId,
          participant_id: EXPECTED_TARGETS.participantId,
          assignment_type: "standard_battery",
          status: "completed",
          metadata: { fixture: EXPECTED_TARGETS.fixture },
        },
      attemptsBySlug,
      existingReportsBySlug,
    },
  };
}

function installStubbedSupabase(deps) {
  const originalCreateDeps = deps.createSupabaseAdminClient;
  deps.createSupabaseAdminClient = () => ({
    from(table) {
      const state = {
        table,
        filters: {},
        orderKey: null,
      };

      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          state.filters[column] = value;
          return builder;
        },
        maybeSingle: async () => {
          if (table === "participants") {
            return { data: deps.__testData.participant, error: null };
          }

          if (table === "assessment_assignments") {
            return { data: deps.__testData.assignment, error: null };
          }

          if (table === "assessment_assignment_attempts") {
            const slug = state.filters.test_slug;
            const attempt = deps.__testData.attemptsBySlug[slug] ?? null;

            return {
              data: attempt
                ? {
                    assessment_assignment_id: EXPECTED_TARGETS.assessmentAssignmentId,
                    attempt_id: attempt.attemptId,
                    test_slug: slug,
                    attempts: {
                      id: attempt.attemptId,
                      organization_id: attempt.organizationId,
                      participant_id: attempt.participantId,
                      status: attempt.status,
                      completed_at: attempt.completedAt,
                    },
                    tests: { slug },
                  }
                : null,
              error: null,
            };
          }

          if (table === "report_runtime_configs") {
            const runtime = deps.__testData.runtimeResolution;

            return {
              data:
                runtime.actualQueueResolvedProvider === "openai"
                  ? {
                      id: runtime.defaultLaneRuntimeConfigId ?? "runtime-default-id",
                      generator_type: "openai",
                      model_name: runtime.actualQueueResolvedModel,
                    }
                  : {
                      id: runtime.defaultLaneRuntimeConfigId ?? "runtime-default-id",
                      generator_type: runtime.actualQueueResolvedProvider,
                      model_name: runtime.actualQueueResolvedModel,
                    },
              error: null,
            };
          }

          return { data: null, error: null };
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
      };

      if (table === "attempt_reports") {
        builder.order = () => builder;
        builder.select = () => builder;
        builder.eq = (column, value) => {
          state.filters[column] = value;
          return builder;
        };
        builder.maybeSingle = async () => ({ data: null, error: null });
        builder.then = undefined;
        return {
          ...builder,
          async then() {},
          async [Symbol.asyncIterator]() {},
        };
      }

      return builder;
    },
  });

  deps.__restoreCreateSupabaseAdminClient = () => {
    deps.createSupabaseAdminClient = originalCreateDeps;
  };
}

function buildAttemptReportsStub(existingReportsBySlug) {
  return {
    from(table) {
      if (table !== "attempt_reports") {
        throw new Error(`Unexpected table ${table}`);
      }

      const state = {
        filters: {},
      };

      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          state.filters[column] = value;
          return builder;
        },
        order() {
          return builder;
        },
      };

      return new Proxy(builder, {
        get(target, prop) {
          if (prop === "then") {
            const slug = state.filters.test_slug;
            const rows = existingReportsBySlug[slug] ?? [];
            return (resolve) => resolve({ data: rows, error: null });
          }

          return target[prop];
        },
      });
    },
  };
}

async function runWithStubbedDeps(env, options = {}) {
  const deps = createDeps(options);
  let stdout = "";
  const originalCreate = deps.createSupabaseAdminClient;

  deps.createSupabaseAdminClient = () => {
    const base = installCompositeSupabaseStub(deps);
    return base;
  };

  const artifact = await generateAmraReplaySingleTestParticipantReports({
    env,
    deps,
    stdout: {
      write(chunk) {
        stdout += chunk;
      },
    },
  });

  assert.deepEqual(JSON.parse(stdout), JSON.parse(JSON.stringify(artifact)));
  deps.createSupabaseAdminClient = originalCreate;
  return artifact;
}

function installCompositeSupabaseStub(deps) {
  const baseStub = {
    from(table) {
      if (table === "participants") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            return { data: deps.__testData.participant, error: null };
          },
        };
      }

      if (table === "assessment_assignments") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            return { data: deps.__testData.assignment, error: null };
          },
        };
      }

      if (table === "assessment_assignment_attempts") {
        const state = { filters: {} };
        return {
          select() {
            return this;
          },
          eq(column, value) {
            state.filters[column] = value;
            return this;
          },
          async maybeSingle() {
            const slug = state.filters.test_slug;
            const attempt = deps.__testData.attemptsBySlug[slug] ?? null;

            return {
              data: attempt
                ? {
                    assessment_assignment_id: EXPECTED_TARGETS.assessmentAssignmentId,
                    attempt_id: attempt.attemptId,
                    test_slug: slug,
                    attempts: {
                      id: attempt.attemptId,
                      organization_id: attempt.organizationId,
                      participant_id: attempt.participantId,
                      status: attempt.status,
                      completed_at: attempt.completedAt,
                    },
                    tests: { slug },
                  }
                : null,
              error: null,
            };
          },
        };
      }

      if (table === "attempt_reports") {
        const state = { filters: {} };
        return {
          select() {
            return this;
          },
          eq(column, value) {
            state.filters[column] = value;
            return this;
          },
          order() {
            return this;
          },
          then(resolve) {
            const slug = state.filters.test_slug;
            resolve({ data: deps.__testData.existingReportsBySlug[slug] ?? [], error: null });
          },
        };
      }

      if (table === "report_runtime_configs") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          async maybeSingle() {
            const runtime = deps.__testData.runtimeResolution;
            return {
              data: {
                id: runtime.defaultLaneRuntimeConfigId ?? "runtime-default-id",
                generator_type: runtime.actualQueueResolvedProvider,
                model_name: runtime.actualQueueResolvedModel,
              },
              error: null,
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return baseStub;
}

async function main() {
  const defaultDryRun = await runWithStubbedDeps({});
  assert.equal(defaultDryRun.status, "dry_run_ready");
  assert.equal(defaultDryRun.metadata.dryRun, true);
  assert.equal(defaultDryRun.metadata.databaseWrites, false);
  assert.equal(defaultDryRun.metadata.openAiCalled, false);
  assert.equal(defaultDryRun.metadata.reportsGenerated, false);
  assert.equal(defaultDryRun.inputs.targetTestSlug, "all");
  assert.equal(defaultDryRun.targets.length, 3);
  assert(defaultDryRun.targets.every((target) => target.generationAllowed === true));

  const missingConfirmed = await runWithStubbedDeps({
    [CONFIRM_ENV]: "true",
  });
  assert.equal(missingConfirmed.status, "confirmation_required");
  assert.equal(missingConfirmed.blockers.includes("missing_target_env"), true);
  assert.equal(missingConfirmed.metadata.databaseWrites, false);

  const wrongIds = await runWithStubbedDeps({
    [CONFIRM_ENV]: "true",
    [TARGET_REPLAY_PARTICIPANT_ID_ENV]: "2432eb12-2b54-4881-bef2-2ac687b59e0b",
    [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: "bad42da0-aa18-4ee0-bc6e-552eee8cd38b",
    [TARGET_TEST_SLUG_ENV]: "mwms_v1",
  });
  assert.equal(wrongIds.status, "blocked_target_env_mismatch");
  assert.equal(wrongIds.metadata.databaseWrites, false);

  const nonReplayAssignment = await runWithStubbedDeps(
    {},
    {
      assignment: {
        id: EXPECTED_TARGETS.assessmentAssignmentId,
        organization_id: EXPECTED_TARGETS.organizationId,
        participant_id: EXPECTED_TARGETS.participantId,
        assignment_type: "standard_battery",
        status: "completed",
        metadata: { fixture: "wrong_fixture" },
      },
    },
  );
  assert.equal(nonReplayAssignment.status, "blocked");
  assert.equal(nonReplayAssignment.blockers.includes("target_replay_assignment_guard_failed"), true);

  const existingParticipantReport = await runWithStubbedDeps(
    {},
    {
      existingReportsBySlug: {
        mwms_v1: [
          {
            id: "existing-mwms-participant-report",
            report_status: "ready",
          },
        ],
      },
    },
  );
  assert.equal(existingParticipantReport.status, "blocked_existing_participant_report_present");
  assert.equal(existingParticipantReport.metadata.databaseWrites, false);

  const runtimeProviderMismatch = await runWithStubbedDeps(
    {
      [AI_REPORT_PROVIDER_ENV]: EXPECTED_PROVIDER,
      [AI_REPORT_MODEL_ENV]: EXPECTED_MODEL,
    },
    {
      runtimeResolution: {
        declaredProvider: EXPECTED_PROVIDER,
        declaredModel: EXPECTED_MODEL,
        actualQueueResolvedProvider: "mock",
        actualQueueResolvedModel: null,
        actualWorkerResolvedProvider: "mock",
        actualWorkerResolvedModel: null,
        fallbackToMockEnabled: false,
        ok: false,
        status: "blocked_provider_not_openai",
        activeOpenAiRuntimeConfigId: null,
        defaultLaneRuntimeConfigId: "runtime-default-id",
      },
    },
  );
  assert.equal(runtimeProviderMismatch.status, "blocked_provider_not_openai");

  const runtimeModelMismatch = await runWithStubbedDeps(
    {
      [AI_REPORT_PROVIDER_ENV]: EXPECTED_PROVIDER,
      [AI_REPORT_MODEL_ENV]: "gpt-4.1",
    },
    {
      runtimeResolution: {
        declaredProvider: EXPECTED_PROVIDER,
        declaredModel: "gpt-4.1",
        actualQueueResolvedProvider: "openai",
        actualQueueResolvedModel: "gpt-4.1",
        actualWorkerResolvedProvider: "openai",
        actualWorkerResolvedModel: "gpt-4.1",
        fallbackToMockEnabled: false,
        ok: false,
        status: "blocked_model_not_gpt_5_5",
        activeOpenAiRuntimeConfigId: "runtime-openai-id",
        defaultLaneRuntimeConfigId: "runtime-default-id",
      },
    },
  );
  assert.equal(runtimeModelMismatch.status, "blocked_model_not_gpt_5_5");

  const fallbackRefused = await runWithStubbedDeps(
    {
      [AI_REPORT_PROVIDER_ENV]: EXPECTED_PROVIDER,
      [AI_REPORT_MODEL_ENV]: EXPECTED_MODEL,
    },
    {
      runtimeResolution: {
        declaredProvider: EXPECTED_PROVIDER,
        declaredModel: EXPECTED_MODEL,
        actualQueueResolvedProvider: "openai",
        actualQueueResolvedModel: "gpt-5.5",
        actualWorkerResolvedProvider: "openai",
        actualWorkerResolvedModel: "gpt-5.5",
        fallbackToMockEnabled: true,
        ok: false,
        status: "blocked_mock_fallback_enabled",
        activeOpenAiRuntimeConfigId: "runtime-openai-id",
        defaultLaneRuntimeConfigId: "runtime-default-id",
      },
    },
  );
  assert.equal(fallbackRefused.status, "blocked_mock_fallback_enabled");

  const singleMode = await runWithStubbedDeps({
    [TARGET_TEST_SLUG_ENV]: "ipip-neo-120-v1",
  });
  assert.equal(singleMode.status, "dry_run_ready");
  assert.equal(singleMode.targets.length, 1);
  assert.equal(singleMode.targets[0].testSlug, "ipip-neo-120-v1");

  const allModeSafe = await runWithStubbedDeps({
    [TARGET_TEST_SLUG_ENV]: "all",
  });
  assert.equal(allModeSafe.status, "dry_run_ready");
  assert.equal(allModeSafe.targets.length, 3);

  console.log("test-generate-amra-replay-single-test-participant-reports: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
