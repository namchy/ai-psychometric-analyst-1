const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_AMRA_REPLAY_PARTICIPANT_REPORT_GENERATION";
const DATA_ONLY_QA_CONFIRM_ENV = "CONFIRM_AMRA_REPLAY_PARTICIPANT_DATA_ONLY_QA";
const FAILED_REPORT_CLEANUP_CONFIRM_ENV =
  "CONFIRM_AMRA_REPLAY_PARTICIPANT_FAILED_REPORT_CLEANUP";
const TARGET_FAILED_REPORT_ID_ENV = "TARGET_FAILED_REPORT_ID";
const TARGET_REPLAY_PARTICIPANT_ID_ENV = "TARGET_REPLAY_PARTICIPANT_ID";
const TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV = "TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID";
const TARGET_TEST_SLUG_ENV = "TARGET_TEST_SLUG";
const TARGET_TEST_SLUG_ALL = "all";
const AI_REPORT_PROVIDER_ENV = "AI_REPORT_PROVIDER";
const AI_REPORT_MODEL_ENV = "AI_REPORT_MODEL";

const EXPECTED_PROVIDER = "openai";
const EXPECTED_MODEL = "gpt-5.5";
const APPROVED_FAILED_REPORT_CLEANUP_TARGETS = [
  {
    id: "3cc0ef77-ce5a-47b8-9562-3ff81556a0bd",
    attemptId: "8aefc4f9-3ca6-48f2-a41e-0f6b75c5e0d1",
    testSlug: "mwms_v1",
    participantId: "a5678fd5-8fea-4308-8569-5448f26b4f71",
    assessmentAssignmentId: "033f8975-5d9c-4c66-8842-f37527d556d5",
    report_type: "individual",
    audience: "participant",
    source_type: "single_test",
    report_status: "failed",
  },
  {
    id: "294a177b-7b4d-4127-823a-9ce6c0464be1",
    attemptId: "e71d472a-13cb-4cc9-9582-6eaa262affca",
    testSlug: "ipip-neo-120-v1",
    participantId: "a5678fd5-8fea-4308-8569-5448f26b4f71",
    assessmentAssignmentId: "033f8975-5d9c-4c66-8842-f37527d556d5",
    report_type: "individual",
    audience: "participant",
    source_type: "single_test",
    report_status: "failed",
  },
];

const EXPECTED_TARGETS = {
  participantId: "a5678fd5-8fea-4308-8569-5448f26b4f71",
  participantEmail: "amra.new1@example.test",
  assessmentAssignmentId: "033f8975-5d9c-4c66-8842-f37527d556d5",
  organizationId: "5d93f3a1-3765-4ec4-b668-c0d1228a8445",
  fixture: "amra_replay_fixture_v1",
};

const TARGET_TESTS = {
  mwms_v1: {
    attemptId: "8aefc4f9-3ca6-48f2-a41e-0f6b75c5e0d1",
  },
  safran_v1: {
    attemptId: "54702bc1-7d91-492e-9b50-14aff6706d34",
  },
  "ipip-neo-120-v1": {
    attemptId: "e71d472a-13cb-4cc9-9582-6eaa262affca",
  },
};

const ALLOWED_TEST_SLUGS = Object.keys(TARGET_TESTS);
const SUPPORTED_TARGET_TEST_SLUGS = [...ALLOWED_TEST_SLUGS, TARGET_TEST_SLUG_ALL];

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

function installTypeScriptRuntime() {
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
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeEnvString(value) {
  return isNonEmptyString(value) ? value.trim() : null;
}

function getTargetInputs(env = process.env) {
  return {
    participantId: normalizeEnvString(env[TARGET_REPLAY_PARTICIPANT_ID_ENV]),
    assessmentAssignmentId: normalizeEnvString(env[TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]),
    testSlug: normalizeEnvString(env[TARGET_TEST_SLUG_ENV]),
  };
}

function getProviderInputs(env = process.env) {
  return {
    declaredProvider: normalizeEnvString(env[AI_REPORT_PROVIDER_ENV]),
    declaredModel: normalizeEnvString(env[AI_REPORT_MODEL_ENV]),
  };
}

function resolveRequestedTestSlugs(testSlug) {
  if (!testSlug || testSlug === TARGET_TEST_SLUG_ALL) {
    return [...ALLOWED_TEST_SLUGS];
  }

  return [testSlug];
}

function validateRequestedTargetInputs(
  env = process.env,
  options = {
    requireExplicitIds: false,
    requireExplicitTestSlug: false,
  },
) {
  const rawInputs = getTargetInputs(env);
  const missing = [];
  const mismatches = [];
  const participantId = rawInputs.participantId ?? EXPECTED_TARGETS.participantId;
  const assessmentAssignmentId =
    rawInputs.assessmentAssignmentId ?? EXPECTED_TARGETS.assessmentAssignmentId;
  const testSlug = rawInputs.testSlug ?? TARGET_TEST_SLUG_ALL;

  if (options.requireExplicitIds) {
    if (!rawInputs.participantId) {
      missing.push(TARGET_REPLAY_PARTICIPANT_ID_ENV);
    }

    if (!rawInputs.assessmentAssignmentId) {
      missing.push(TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV);
    }
  }

  if (options.requireExplicitTestSlug && !rawInputs.testSlug) {
    missing.push(TARGET_TEST_SLUG_ENV);
  }

  if (rawInputs.participantId && rawInputs.participantId !== EXPECTED_TARGETS.participantId) {
    mismatches.push({
      env: TARGET_REPLAY_PARTICIPANT_ID_ENV,
      expected: EXPECTED_TARGETS.participantId,
      received: rawInputs.participantId,
    });
  }

  if (
    rawInputs.assessmentAssignmentId &&
    rawInputs.assessmentAssignmentId !== EXPECTED_TARGETS.assessmentAssignmentId
  ) {
    mismatches.push({
      env: TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV,
      expected: EXPECTED_TARGETS.assessmentAssignmentId,
      received: rawInputs.assessmentAssignmentId,
    });
  }

  if (!SUPPORTED_TARGET_TEST_SLUGS.includes(testSlug)) {
    mismatches.push({
      env: TARGET_TEST_SLUG_ENV,
      expected: SUPPORTED_TARGET_TEST_SLUGS.join(" | "),
      received: testSlug,
    });
  }

  return {
    ok: missing.length === 0 && mismatches.length === 0,
    inputs: {
      participantId,
      assessmentAssignmentId,
      testSlug,
      targetTestSlugs: resolveRequestedTestSlugs(testSlug),
    },
    missing,
    mismatches,
  };
}

function evaluateRuntimeResolution(input) {
  const actualQueueResolvedProvider = input.actualQueueResolvedProvider ?? "mock";
  const actualQueueResolvedModel =
    actualQueueResolvedProvider === "openai" ? normalizeEnvString(input.actualQueueResolvedModel) : null;
  const actualWorkerResolvedProvider = actualQueueResolvedProvider;
  const actualWorkerResolvedModel =
    actualWorkerResolvedProvider === "openai"
      ? actualQueueResolvedModel ??
        normalizeEnvString(input.activeOpenAiRuntimeModel) ??
        normalizeEnvString(input.aiConfigModel)
      : null;
  const fallbackToMockEnabled = Boolean(input.fallbackToMockEnabled);

  return {
    declaredProvider: input.declaredProvider ?? null,
    declaredModel: input.declaredModel ?? null,
    actualQueueResolvedProvider,
    actualQueueResolvedModel,
    actualWorkerResolvedProvider,
    actualWorkerResolvedModel,
    fallbackToMockEnabled,
    ok:
      actualWorkerResolvedProvider === EXPECTED_PROVIDER &&
      actualWorkerResolvedModel === EXPECTED_MODEL &&
      fallbackToMockEnabled === false,
    status:
      actualWorkerResolvedProvider !== EXPECTED_PROVIDER
        ? "blocked_provider_not_openai"
        : actualWorkerResolvedModel !== EXPECTED_MODEL
          ? "blocked_model_not_gpt_5_5"
          : fallbackToMockEnabled
            ? "blocked_mock_fallback_enabled"
            : "ok",
  };
}

function evaluateReplayParticipantGuard(participant) {
  return Boolean(
    participant &&
      participant.organization_id === EXPECTED_TARGETS.organizationId &&
      participant.email === EXPECTED_TARGETS.participantEmail,
  );
}

function evaluateReplayAssignmentGuard(assignment, participantId) {
  return Boolean(
    assignment &&
      assignment.organization_id === EXPECTED_TARGETS.organizationId &&
      assignment.participant_id === participantId &&
      assignment.assignment_type === "standard_battery" &&
      assignment.metadata?.fixture === EXPECTED_TARGETS.fixture,
  );
}

function buildParticipantAttemptReportQueueInsertPayload(input) {
  return {
    attempt_id: input.attemptId,
    test_slug: input.testSlug,
    generator_type: input.generatorType,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    report_status: "queued",
    failure_code: null,
    failure_reason: null,
    report_snapshot: null,
    completed_at: null,
    report_type: "individual",
    audience: "participant",
    source_type: "single_test",
    prompt_version_id: null,
    model_name: input.modelName ?? null,
    generator_version: null,
    input_snapshot: null,
    started_at: null,
  };
}

function resolveClaimedJobModelName(input) {
  if (input.claimedJobGeneratorType !== "openai") {
    return null;
  }

  return (
    normalizeEnvString(input.claimedJobModelName) ??
    normalizeEnvString(input.activeOpenAiRuntimeModel) ??
    normalizeEnvString(input.aiConfigModel)
  );
}

function evaluatePersistedReportPostcondition(input) {
  const persistedProvider = normalizeEnvString(input.generatorType);
  const persistedModel = normalizeEnvString(input.modelName);

  return {
    ok: persistedProvider === EXPECTED_PROVIDER && persistedModel === EXPECTED_MODEL,
    status:
      persistedProvider !== EXPECTED_PROVIDER
        ? "failed_persisted_provider_mismatch"
        : persistedModel !== EXPECTED_MODEL
          ? "failed_persisted_model_mismatch"
          : "ready",
    persistedProvider,
    persistedModel,
  };
}

function findApprovedFailedReportCleanupTarget(reportId) {
  return (
    APPROVED_FAILED_REPORT_CLEANUP_TARGETS.find((target) => target.id === reportId) ?? null
  );
}

function evaluateFailedParticipantReportCleanupGuard(row, approvedTarget) {
  const mismatches = [];

  if (!row || typeof row !== "object") {
    return { ok: false, mismatches: [{ field: "<row>", expected: "existing row", received: null }] };
  }

  if (!approvedTarget) {
    return {
      ok: false,
      mismatches: [{ field: "<approvedTarget>", expected: "approved target", received: null }],
    };
  }

  const expected = {
    id: approvedTarget.id,
    attempt_id: approvedTarget.attemptId,
    test_slug: approvedTarget.testSlug,
    report_type: approvedTarget.report_type,
    audience: approvedTarget.audience,
    source_type: approvedTarget.source_type,
    report_status: approvedTarget.report_status,
  };

  for (const [field, expectedValue] of Object.entries(expected)) {
    if (row[field] !== expectedValue) {
      mismatches.push({ field, expected: expectedValue, received: row[field] ?? null });
    }
  }

  return { ok: mismatches.length === 0, mismatches };
}

function buildReadOnlyAuditSql(testSlugs = ALLOWED_TEST_SLUGS) {
  const selected = testSlugs
    .map((testSlug) => TARGET_TESTS[testSlug]?.attemptId)
    .filter(Boolean);
  const attemptList = selected.map((attemptId) => `'${attemptId}'`).join(", ");
  const testSlugList = testSlugs.map((testSlug) => `'${testSlug}'`).join(", ");

  return [
    "select",
    "  ar.id,",
    "  ar.attempt_id,",
    "  ar.test_slug,",
    "  ar.report_type,",
    "  ar.audience,",
    "  ar.source_type,",
    "  ar.report_status,",
    "  ar.generator_type,",
    "  ar.model_name,",
    "  (ar.input_snapshot is not null) as input_snapshot_present,",
    "  (ar.report_snapshot is not null) as report_snapshot_present,",
    "  ar.failure_code,",
    "  ar.failure_reason,",
    "  ar.generated_at,",
    "  ar.started_at,",
    "  ar.completed_at",
    "from public.attempt_reports ar",
    `where ar.attempt_id in (${attemptList})`,
    `  and ar.test_slug in (${testSlugList})`,
    "  and ar.report_type = 'individual'",
    "  and ar.audience = 'participant'",
    "  and ar.source_type = 'single_test'",
    "order by ar.test_slug asc, ar.generated_at desc, ar.id desc;",
  ].join("\n");
}

function buildRuntimeConfigInspectSql() {
  return [
    "select",
    "  id,",
    "  report_type,",
    "  audience,",
    "  source_type,",
    "  generator_type,",
    "  model_name,",
    "  reasoning_effort,",
    "  temperature,",
    "  is_active,",
    "  notes,",
    "  created_at,",
    "  updated_at,",
    "  updated_by",
    "from public.report_runtime_configs",
    "where report_type = 'individual'",
    "  and audience = 'participant'",
    "  and source_type = 'single_test'",
    "order by is_active desc, updated_at desc, created_at desc, id desc;",
  ].join("\n");
}

function buildRuntimeConfigCreateSql() {
  return [
    "insert into public.report_runtime_configs (",
    "  report_type,",
    "  audience,",
    "  source_type,",
    "  generator_type,",
    "  model_name,",
    "  reasoning_effort,",
    "  temperature,",
    "  is_active,",
    "  notes",
    ")",
    "values (",
    "  'individual',",
    "  'participant',",
    "  'single_test',",
    "  'openai',",
    "  'gpt-5.5',",
    "  'medium',",
    "  null,",
    "  true,",
    "  'Amra replay participant single-test generation lane.'",
    ");",
  ].join("\n");
}

function buildBaseArtifact(input = {}) {
  return {
    metadata: {
      script: "generate_amra_replay_single_test_participant_reports_v1",
      devOnly: true,
      operation: input.operation ?? "generate",
      dryRun: input.dryRun ?? true,
      writeModeConfirmed: input.writeModeConfirmed ?? false,
      participantDataOnlyQaConfirmed: input.participantDataOnlyQaConfirmed ?? false,
      participantSafetyAndProseValidationBypassed:
        input.participantDataOnlyQaConfirmed ?? false,
      databaseWrites: false,
      openAiCalled: false,
      openAiRequired: true,
      mockFallbackAccepted: false,
      expectedProvider: EXPECTED_PROVIDER,
      expectedModel: EXPECTED_MODEL,
      declaredProvider: input.declaredProvider ?? null,
      declaredModel: input.declaredModel ?? null,
      actualQueueResolvedProvider: input.actualQueueResolvedProvider ?? null,
      actualQueueResolvedModel: input.actualQueueResolvedModel ?? null,
      actualWorkerResolvedProvider: input.actualWorkerResolvedProvider ?? null,
      actualWorkerResolvedModel: input.actualWorkerResolvedModel ?? null,
      fallbackToMockEnabled: input.fallbackToMockEnabled ?? null,
      activeOpenAiRuntimeConfigId: input.activeOpenAiRuntimeConfigId ?? null,
      defaultLaneRuntimeConfigId: input.defaultLaneRuntimeConfigId ?? null,
      reportsGenerated: false,
      reportRegenerated: false,
      originalAmraTouched: false,
      existingReplayHrReportsTouched: false,
      compositeHrTouched: false,
      teamFitTouched: false,
      teamDynamicsTouched: false,
      workerOrSchedulerRun: false,
      uiOrRendererChanged: false,
      scoringTouched: false,
      migrationOrSchemaChanged: false,
      runtimeConfigChanged: false,
      cleanupPerformed: false,
      reportRetried: false,
    },
    inputs: {
      targetReplayParticipantId: input.participantId ?? null,
      targetReplayAssessmentAssignmentId: input.assessmentAssignmentId ?? null,
      targetTestSlug: input.testSlug ?? null,
      targetTestSlugs: input.targetTestSlugs ?? [],
      allowedTestSlugs: [...SUPPORTED_TARGET_TEST_SLUGS],
    },
    targetFixture: {
      participantId: EXPECTED_TARGETS.participantId,
      participantEmail: EXPECTED_TARGETS.participantEmail,
      assessmentAssignmentId: EXPECTED_TARGETS.assessmentAssignmentId,
      fixture: EXPECTED_TARGETS.fixture,
    },
    runtimeResolution: {
      reportType: "individual",
      audience: "participant",
      sourceType: "single_test",
      declaredProvider: input.declaredProvider ?? null,
      declaredModel: input.declaredModel ?? null,
      actualQueueResolvedProvider: input.actualQueueResolvedProvider ?? null,
      actualQueueResolvedModel: input.actualQueueResolvedModel ?? null,
      actualWorkerResolvedProvider: input.actualWorkerResolvedProvider ?? null,
      actualWorkerResolvedModel: input.actualWorkerResolvedModel ?? null,
      fallbackToMockEnabled: input.fallbackToMockEnabled ?? null,
    },
    status: input.status ?? "not_started",
    targets: (input.targetTestSlugs ?? []).map((testSlug) => ({
      testSlug,
      attemptId: TARGET_TESTS[testSlug]?.attemptId ?? null,
      participantReportCount: 0,
      participantReportStatuses: [],
      existingParticipantReportIds: [],
      generationAllowed: false,
      reportId: null,
      report_status: null,
      generator_type: null,
      model_name: null,
      input_snapshot_present: false,
      report_snapshot_present: false,
      queueAction: null,
      workerResult: null,
      blockers: [],
    })),
    blockers: [],
    findings: [],
    deletedReportId: input.deletedReportId ?? null,
    attemptId: input.attemptId ?? null,
    testSlug: input.testSlug ?? null,
    cleanupPerformed: input.cleanupPerformed ?? false,
    nextReadOnlyAuditSql: buildReadOnlyAuditSql(input.targetTestSlugs ?? ALLOWED_TEST_SLUGS),
    runtimeConfigInspectSql: buildRuntimeConfigInspectSql(),
    runtimeConfigCreateSql: buildRuntimeConfigCreateSql(),
  };
}

function buildInvalidInputArtifact(validation, options = {}) {
  const providerInputs = getProviderInputs(options.env ?? process.env);
  const artifact = buildBaseArtifact({
    ...validation.inputs,
    ...providerInputs,
    dryRun: true,
    writeModeConfirmed: Boolean(options.writeModeConfirmed),
    status: "confirmation_required",
  });

  if (validation.missing.length > 0) {
    artifact.blockers.push("missing_target_env");
    artifact.findings.push({
      severity: "blocker",
      category: "target_env",
      message:
        "Confirmed participant generation requires explicit replay participant, assignment and target test env vars.",
      missing: validation.missing,
    });
  }

  if (validation.mismatches.length > 0) {
    artifact.status = "blocked_target_env_mismatch";
    artifact.blockers.push("target_env_mismatch");
    artifact.findings.push({
      severity: "blocker",
      category: "target_env",
      message: "Target env vars do not match the approved Amra replay fixture context.",
      mismatches: validation.mismatches,
    });
  }

  return artifact;
}

async function loadReplayParticipant(supabase, participantId) {
  const { data, error } = await supabase
    .from("participants")
    .select("id, organization_id, full_name, email")
    .eq("id", participantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load replay participant: ${error.message}`);
  }

  return data ?? null;
}

async function loadReplayAssignment(supabase, assignmentId) {
  const { data, error } = await supabase
    .from("assessment_assignments")
    .select("id, organization_id, participant_id, assignment_type, status, locale, metadata")
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load replay assessment assignment: ${error.message}`);
  }

  return data ?? null;
}

async function loadReplayAttemptContext(supabase, input) {
  const targetSpec = TARGET_TESTS[input.testSlug];
  const { data, error } = await supabase
    .from("assessment_assignment_attempts")
    .select(
      "assessment_assignment_id, attempt_id, test_slug, attempts!inner(id, organization_id, participant_id, status, completed_at), tests!inner(slug)",
    )
    .eq("assessment_assignment_id", input.assessmentAssignmentId)
    .eq("attempt_id", targetSpec.attemptId)
    .eq("test_slug", input.testSlug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load replay assessment assignment attempt link: ${error.message}`);
  }

  if (!data || !data.attempts) {
    return null;
  }

  const attempt = Array.isArray(data.attempts) ? data.attempts[0] : data.attempts;
  return {
    attemptId: attempt.id,
    organizationId: attempt.organization_id,
    participantId: attempt.participant_id,
    status: attempt.status,
    completedAt: attempt.completed_at,
  };
}

async function loadExistingParticipantReports(supabase, attemptId, testSlug) {
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(
      "id, attempt_id, test_slug, report_type, audience, source_type, report_status, generator_type, model_name, input_snapshot, report_snapshot",
    )
    .eq("attempt_id", attemptId)
    .eq("test_slug", testSlug)
    .eq("report_type", "individual")
    .eq("audience", "participant")
    .eq("source_type", "single_test")
    .order("generated_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw new Error(`Failed to load existing replay participant reports: ${error.message}`);
  }

  return data ?? [];
}

async function loadFinalParticipantReportRow(supabase, reportId) {
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(
      "id, attempt_id, test_slug, report_status, generator_type, model_name, input_snapshot, report_snapshot",
    )
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load final replay participant report row: ${error.message}`);
  }

  return data ?? null;
}

async function loadFailedParticipantReportRow(supabase, reportId) {
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(
      "id, attempt_id, test_slug, report_type, audience, source_type, report_status, generator_type, model_name, report_snapshot",
    )
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load replay participant failed report row: ${error.message}`);
  }

  return data ?? null;
}

async function loadLatestParticipantLaneRuntimeConfig(supabase) {
  const { data, error } = await supabase
    .from("report_runtime_configs")
    .select("id, generator_type, model_name")
    .eq("report_type", "individual")
    .eq("audience", "participant")
    .eq("source_type", "single_test")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load latest participant lane runtime config: ${error.message}`);
  }

  return data ?? null;
}

async function resolveParticipantLaneRuntimePreflight({
  supabase,
  getActiveReportRuntimeConfig,
  getAiReportConfig,
  declaredProvider,
  declaredModel,
}) {
  const defaultLaneRuntimeConfig = await loadLatestParticipantLaneRuntimeConfig(supabase);
  const openAiRuntimeConfig =
    (defaultLaneRuntimeConfig?.generator_type ?? "mock") === "openai"
      ? await getActiveReportRuntimeConfig({
          reportType: "individual",
          audience: "participant",
          sourceType: "single_test",
          generatorType: "openai",
        })
      : null;
  const aiConfig = getAiReportConfig();

  return {
    ...evaluateRuntimeResolution({
      declaredProvider,
      declaredModel,
      actualQueueResolvedProvider: defaultLaneRuntimeConfig?.generator_type ?? "mock",
      actualQueueResolvedModel: defaultLaneRuntimeConfig?.model_name ?? null,
      activeOpenAiRuntimeModel: openAiRuntimeConfig?.modelName ?? null,
      aiConfigModel: aiConfig.model ?? null,
      fallbackToMockEnabled: aiConfig.fallbackToMock,
    }),
    activeOpenAiRuntimeConfigId: openAiRuntimeConfig?.id ?? null,
    defaultLaneRuntimeConfigId: defaultLaneRuntimeConfig?.id ?? null,
  };
}

async function createRealDeps() {
  installTypeScriptRuntime();

  const { createSupabaseAdminClient } = require(path.join(projectRoot, "lib", "supabase", "admin.ts"));
  const { getAiReportConfig } = require(path.join(projectRoot, "lib", "assessment", "report-config.ts"));
  const {
    getActiveReportRuntimeConfig,
  } = require(path.join(projectRoot, "lib", "assessment", "report-runtime-config.ts"));
  const {
    claimNextReportJob,
    processClaimedReportJob,
  } = require(path.join(projectRoot, "lib", "assessment", "report-job-worker.ts"));

  return {
    createSupabaseAdminClient,
    getAiReportConfig,
    getActiveReportRuntimeConfig,
    claimNextReportJob,
    processClaimedReportJob,
  };
}

async function inspectReplayParticipantTargets(input, deps) {
  const supabase = deps.createSupabaseAdminClient();
  const artifact = buildBaseArtifact({
    ...input,
    dryRun: true,
    writeModeConfirmed: input.writeModeConfirmed,
    status: "running_inspection",
  });

  const participant = await loadReplayParticipant(supabase, input.participantId);
  if (!participant) {
    artifact.status = "blocked";
    artifact.blockers.push("target_replay_participant_not_found");
    return artifact;
  }

  if (!evaluateReplayParticipantGuard(participant)) {
    artifact.status = "blocked";
    artifact.blockers.push("target_replay_participant_guard_failed");
    artifact.findings.push({
      severity: "blocker",
      category: "participant",
      message: "Replay participant failed organization/email ownership guard.",
    });
    return artifact;
  }

  const assignment = await loadReplayAssignment(supabase, input.assessmentAssignmentId);
  if (!assignment) {
    artifact.status = "blocked";
    artifact.blockers.push("target_replay_assignment_not_found");
    return artifact;
  }

  if (!evaluateReplayAssignmentGuard(assignment, input.participantId) || assignment.status !== "completed") {
    artifact.status = "blocked";
    artifact.blockers.push("target_replay_assignment_guard_failed");
    artifact.findings.push({
      severity: "blocker",
      category: "assignment",
      message: "Replay assignment failed organization/participant/type/status/fixture guard.",
    });
    return artifact;
  }

  for (const target of artifact.targets) {
    const attempt = await loadReplayAttemptContext(supabase, {
      assessmentAssignmentId: input.assessmentAssignmentId,
      testSlug: target.testSlug,
    });

    if (!attempt) {
      target.blockers.push("target_replay_attempt_link_not_found");
      continue;
    }

    if (
      attempt.organizationId !== EXPECTED_TARGETS.organizationId ||
      attempt.participantId !== input.participantId ||
      attempt.status !== "completed" ||
      !attempt.completedAt
    ) {
      target.blockers.push("target_replay_attempt_guard_failed");
      continue;
    }

    const existingReports = await loadExistingParticipantReports(
      supabase,
      attempt.attemptId,
      target.testSlug,
    );

    target.attemptId = attempt.attemptId;
    target.participantReportCount = existingReports.length;
    target.participantReportStatuses = existingReports.map((row) => row.report_status);
    target.existingParticipantReportIds = existingReports.map((row) => row.id);

    if (existingReports.length > 0) {
      target.blockers.push("existing_participant_single_test_report_present");
      continue;
    }

    target.generationAllowed = true;
  }

  const runtimePreflight = await resolveParticipantLaneRuntimePreflight({
    supabase,
    getActiveReportRuntimeConfig: deps.getActiveReportRuntimeConfig,
    getAiReportConfig: deps.getAiReportConfig,
    declaredProvider: input.declaredProvider,
    declaredModel: input.declaredModel,
  });

  Object.assign(artifact.metadata, {
    declaredProvider: runtimePreflight.declaredProvider,
    declaredModel: runtimePreflight.declaredModel,
    actualQueueResolvedProvider: runtimePreflight.actualQueueResolvedProvider,
    actualQueueResolvedModel: runtimePreflight.actualQueueResolvedModel,
    actualWorkerResolvedProvider: runtimePreflight.actualWorkerResolvedProvider,
    actualWorkerResolvedModel: runtimePreflight.actualWorkerResolvedModel,
    fallbackToMockEnabled: runtimePreflight.fallbackToMockEnabled,
    activeOpenAiRuntimeConfigId: runtimePreflight.activeOpenAiRuntimeConfigId,
    defaultLaneRuntimeConfigId: runtimePreflight.defaultLaneRuntimeConfigId,
  });
  Object.assign(artifact.runtimeResolution, {
    declaredProvider: runtimePreflight.declaredProvider,
    declaredModel: runtimePreflight.declaredModel,
    actualQueueResolvedProvider: runtimePreflight.actualQueueResolvedProvider,
    actualQueueResolvedModel: runtimePreflight.actualQueueResolvedModel,
    actualWorkerResolvedProvider: runtimePreflight.actualWorkerResolvedProvider,
    actualWorkerResolvedModel: runtimePreflight.actualWorkerResolvedModel,
    fallbackToMockEnabled: runtimePreflight.fallbackToMockEnabled,
  });

  const blockedTargets = artifact.targets.filter((target) => target.blockers.length > 0);

  if (blockedTargets.some((target) => target.blockers.includes("existing_participant_single_test_report_present"))) {
    artifact.status = "blocked_existing_participant_report_present";
    artifact.blockers.push("existing_participant_single_test_report_present");
    artifact.findings.push({
      severity: "blocker",
      category: "attempt_report",
      message:
        "Replay participant generation is blocked because at least one target attempt already has participant single-test attempt_reports rows. Cleanup/reset is intentionally not implemented in this operator path.",
      blockedTargets: blockedTargets.map((target) => ({
        testSlug: target.testSlug,
        reportIds: target.existingParticipantReportIds,
      })),
    });
    return artifact;
  }

  if (blockedTargets.length > 0) {
    artifact.status = "blocked";
    artifact.blockers.push("target_replay_attempt_guard_failed");
    artifact.findings.push({
      severity: "blocker",
      category: "attempt",
      message: "Replay attempt ownership/completion guard failed for at least one selected test.",
      blockedTargets: blockedTargets.map((target) => ({
        testSlug: target.testSlug,
        blockers: target.blockers,
      })),
    });
    return artifact;
  }

  if (!runtimePreflight.ok) {
    artifact.status = runtimePreflight.status;
    artifact.blockers.push(runtimePreflight.status);
    artifact.findings.push({
      severity: "blocker",
      category: "runtime",
      message:
        runtimePreflight.status === "blocked_mock_fallback_enabled"
          ? "Participant generation is blocked because AI_REPORT_FALLBACK_TO_MOCK still resolves to true."
          : "Participant generation is blocked because the actual participant lane does not resolve to OpenAI gpt-5.5.",
      runtimeResolution: artifact.runtimeResolution,
    });
    return artifact;
  }

  artifact.status = "dry_run_ready";
  if (input.participantDataOnlyQaConfirmed) {
    artifact.findings.push({
      severity: "warning",
      category: "participant_data_only_qa",
      message:
        "Replay QA data-only mode is confirmed: prose, BHS, genericity, actionability and participant safety validators will be bypassed as blockers. JSON/shape/contract/data/reference validation remains blocking, and AI prose will not be rewritten.",
    });
  }
  artifact.findings.push({
    severity: "info",
    category: "dry_run",
    message:
      "Dry-run confirmed target replay fixture ownership, zero existing participant report rows, and participant lane runtime resolution to OpenAI gpt-5.5 with mock fallback disabled.",
  });

  return artifact;
}

async function enqueueParticipantReportRow(supabase, input) {
  const { data, error } = await supabase
    .from("attempt_reports")
    .insert(buildParticipantAttemptReportQueueInsertPayload(input))
    .select("id, attempt_id, test_slug, report_status, generator_type, model_name")
    .single();

  if (error) {
    throw new Error(`Failed to queue replay participant report: ${error.message}`);
  }

  return data;
}

async function runConfirmedGeneration(input, deps) {
  const inspectionArtifact = await inspectReplayParticipantTargets(
    {
      ...input,
      writeModeConfirmed: true,
    },
    deps,
  );

  if (inspectionArtifact.status !== "dry_run_ready") {
    return inspectionArtifact;
  }

  const supabase = deps.createSupabaseAdminClient();
  inspectionArtifact.metadata.dryRun = false;
  inspectionArtifact.status = "running";

  for (const target of inspectionArtifact.targets) {
    const queuedRow = await enqueueParticipantReportRow(supabase, {
      attemptId: target.attemptId,
      testSlug: target.testSlug,
      generatorType: EXPECTED_PROVIDER,
      modelName: inspectionArtifact.runtimeResolution.actualQueueResolvedModel ?? EXPECTED_MODEL,
    });

    inspectionArtifact.metadata.databaseWrites = true;
    target.queueAction = "insert_queued_participant_report";
    target.reportId = queuedRow.id;

    const claimedJob = await deps.claimNextReportJob({
      attemptId: target.attemptId,
      audience: "participant",
    });

    if (!claimedJob || claimedJob.attempt_id !== target.attemptId || claimedJob.test_slug !== target.testSlug) {
      target.blockers.push("failed_to_claim_target_participant_report_job");
      inspectionArtifact.status = "blocked";
      inspectionArtifact.blockers.push("failed_to_claim_target_participant_report_job");
      return inspectionArtifact;
    }

    const claimedJobResolvedModel = resolveClaimedJobModelName({
      claimedJobGeneratorType: claimedJob.generator_type,
      claimedJobModelName: claimedJob.model_name,
      activeOpenAiRuntimeModel: inspectionArtifact.runtimeResolution.actualWorkerResolvedModel,
      aiConfigModel: inspectionArtifact.runtimeResolution.declaredModel,
    });

    if (claimedJob.generator_type !== EXPECTED_PROVIDER || claimedJobResolvedModel !== EXPECTED_MODEL) {
      const blocker =
        claimedJob.generator_type !== EXPECTED_PROVIDER
          ? "blocked_claimed_job_provider_mismatch"
          : "blocked_claimed_job_model_mismatch";
      target.blockers.push(blocker);
      inspectionArtifact.status = blocker;
      inspectionArtifact.blockers.push(blocker);
      inspectionArtifact.findings.push({
        severity: "blocker",
        category: "claimed_job",
        message:
          "Claimed participant job did not preserve the OpenAI gpt-5.5 path, so processing was aborted before worker execution.",
        testSlug: target.testSlug,
        claimedJobGeneratorType: claimedJob.generator_type,
        claimedJobModelName: claimedJob.model_name ?? null,
        claimedJobResolvedModel,
      });
      return inspectionArtifact;
    }

    const workerResult = await deps.processClaimedReportJob(claimedJob, {
      participantDataOnlyQa: input.participantDataOnlyQaConfirmed,
    });
    inspectionArtifact.metadata.workerOrSchedulerRun = true;
    inspectionArtifact.metadata.openAiCalled = inspectionArtifact.metadata.openAiCalled || claimedJob.generator_type === "openai";
    inspectionArtifact.metadata.reportsGenerated =
      inspectionArtifact.metadata.reportsGenerated || workerResult.status === "ready";
    target.workerResult = workerResult.status;

    const finalRow = await loadFinalParticipantReportRow(supabase, claimedJob.id);

    if (!finalRow) {
      target.blockers.push("final_participant_report_row_not_found");
      inspectionArtifact.status = "blocked";
      inspectionArtifact.blockers.push("final_participant_report_row_not_found");
      return inspectionArtifact;
    }

    target.reportId = finalRow.id;
    target.report_status = finalRow.report_status;
    target.generator_type = finalRow.generator_type;
    target.model_name = finalRow.model_name;
    target.input_snapshot_present = finalRow.input_snapshot !== null;
    target.report_snapshot_present = finalRow.report_snapshot !== null;

    if (workerResult.status !== "ready") {
      inspectionArtifact.status = "failed";
      inspectionArtifact.blockers.push("participant_worker_failed");
      inspectionArtifact.findings.push({
        severity: "blocker",
        category: "worker",
        message: "Replay participant worker finished on failed path.",
        testSlug: target.testSlug,
        failure: workerResult.failure,
      });
      return inspectionArtifact;
    }

    const persistedPostcondition = evaluatePersistedReportPostcondition({
      generatorType: finalRow.generator_type,
      modelName: finalRow.model_name,
    });

    if (!persistedPostcondition.ok) {
      inspectionArtifact.status = persistedPostcondition.status;
      inspectionArtifact.blockers.push("persisted_report_provider_model_mismatch");
      inspectionArtifact.findings.push({
        severity: "blocker",
        category: "postcondition",
        message:
          "Persisted replay participant report did not finish as OpenAI gpt-5.5. Treat this as a hard failure; no reset path is implemented here.",
        testSlug: target.testSlug,
        persistedProvider: persistedPostcondition.persistedProvider,
        persistedModel: persistedPostcondition.persistedModel,
      });
      return inspectionArtifact;
    }

    target.generationAllowed = true;
  }

  inspectionArtifact.status = "ready";
  return inspectionArtifact;
}

async function deleteExactFailedParticipantReport(supabase, reportId) {
  const { data, error } = await supabase
    .from("attempt_reports")
    .delete()
    .eq("id", reportId)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to delete exact replay participant failed report row: ${error.message}`);
  }

  if (!data || data.id !== reportId) {
    throw new Error("Failed to delete exactly one approved replay participant failed report row.");
  }

  return data;
}

async function runConfirmedFailedReportCleanup(input, deps) {
  const artifact = buildBaseArtifact({
    ...input,
    operation: "cleanup_failed_participant_report",
    dryRun: false,
    writeModeConfirmed: true,
    status: "running_cleanup_preflight",
    targetTestSlugs: [input.cleanupTarget.testSlug],
    attemptId: input.cleanupTarget.attemptId,
    testSlug: input.cleanupTarget.testSlug,
  });
  const supabase = deps.createSupabaseAdminClient();
  const participant = await loadReplayParticipant(supabase, input.participantId);
  const assignment = await loadReplayAssignment(supabase, input.assessmentAssignmentId);
  const attempt = await loadReplayAttemptContext(supabase, {
    assessmentAssignmentId: input.assessmentAssignmentId,
    testSlug: input.cleanupTarget.testSlug,
  });

  if (
    !evaluateReplayParticipantGuard(participant) ||
    !evaluateReplayAssignmentGuard(assignment, input.participantId) ||
    assignment?.status !== "completed" ||
    !attempt ||
    attempt.attemptId !== input.cleanupTarget.attemptId ||
    attempt.organizationId !== EXPECTED_TARGETS.organizationId ||
    attempt.participantId !== input.participantId ||
    attempt.status !== "completed"
  ) {
    artifact.status = "blocked_cleanup_replay_ownership_guard";
    artifact.blockers.push("cleanup_replay_ownership_guard_failed");
    return artifact;
  }

  const failedRow = await loadFailedParticipantReportRow(supabase, input.failedReportId);
  const rowGuard = evaluateFailedParticipantReportCleanupGuard(failedRow, input.cleanupTarget);

  if (!rowGuard.ok) {
    artifact.status = "blocked_cleanup_failed_report_guard";
    artifact.blockers.push("cleanup_failed_report_guard_failed");
    artifact.findings.push({
      severity: "blocker",
      category: "cleanup",
      message: "Failed participant report row did not match the exact approved cleanup contract.",
      mismatches: rowGuard.mismatches,
    });
    return artifact;
  }

  const deleted = await deleteExactFailedParticipantReport(supabase, input.failedReportId);
  artifact.metadata.databaseWrites = true;
  artifact.metadata.cleanupPerformed = true;
  artifact.status = "cleanup_complete";
  artifact.deletedReportId = deleted.id;
  artifact.attemptId = input.cleanupTarget.attemptId;
  artifact.testSlug = input.cleanupTarget.testSlug;
  artifact.cleanupPerformed = true;
  artifact.findings.push({
    severity: "info",
    category: "cleanup",
    message: "Deleted exactly one approved failed replay participant report row.",
    deletedReportId: deleted.id,
    attemptId: input.cleanupTarget.attemptId,
    testSlug: input.cleanupTarget.testSlug,
  });
  return artifact;
}

async function generateAmraReplaySingleTestParticipantReports(options = {}) {
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? process.stdout;
  const writeModeConfirmed = env[CONFIRM_ENV] === "true";
  const participantDataOnlyQaConfirmed = env[DATA_ONLY_QA_CONFIRM_ENV] === "true";
  const cleanupConfirmed = env[FAILED_REPORT_CLEANUP_CONFIRM_ENV] === "true";
  const failedReportId = normalizeEnvString(env[TARGET_FAILED_REPORT_ID_ENV]);

  if (cleanupConfirmed && writeModeConfirmed) {
    const artifact = buildBaseArtifact({
      operation: "invalid_conflicting_operations",
      dryRun: true,
      status: "blocked_conflicting_operations",
    });
    artifact.blockers.push("generation_and_cleanup_cannot_run_together");
    stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    return artifact;
  }

  if (cleanupConfirmed) {
    const approvedCleanupTarget = findApprovedFailedReportCleanupTarget(failedReportId);
    const validation = validateRequestedTargetInputs(env, {
      requireExplicitIds: true,
      requireExplicitTestSlug: true,
    });

    const cleanupTargetMatches =
      approvedCleanupTarget !== null &&
      validation.inputs.participantId === approvedCleanupTarget.participantId &&
      validation.inputs.assessmentAssignmentId === approvedCleanupTarget.assessmentAssignmentId &&
      validation.inputs.testSlug === approvedCleanupTarget.testSlug;

    if (!validation.ok || !cleanupTargetMatches) {
      const artifact = buildInvalidInputArtifact(validation, {
        env,
        writeModeConfirmed: true,
      });
      artifact.status = "blocked_cleanup_confirmation";
      artifact.metadata.operation = "cleanup_failed_participant_report";
      artifact.blockers.push("exact_failed_report_id_required");
      artifact.findings.push({
        severity: "blocker",
        category: "cleanup",
        message:
          "Cleanup requires an exact approved failed replay participant report target, including report id, participant id, assignment id and test slug.",
        approvedCleanupTarget: approvedCleanupTarget
          ? {
              reportId: approvedCleanupTarget.id,
              participantId: approvedCleanupTarget.participantId,
              assessmentAssignmentId: approvedCleanupTarget.assessmentAssignmentId,
              testSlug: approvedCleanupTarget.testSlug,
            }
          : null,
      });
      stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
      return artifact;
    }

    const deps = options.deps ?? (await createRealDeps());
    const artifact = await runConfirmedFailedReportCleanup(
      {
        ...validation.inputs,
        failedReportId,
        cleanupTarget: approvedCleanupTarget,
      },
      deps,
    );
    stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    return artifact;
  }

  const validation = validateRequestedTargetInputs(env, {
    requireExplicitIds: writeModeConfirmed,
    requireExplicitTestSlug: writeModeConfirmed,
  });

  let artifact;

  if (!validation.ok) {
    artifact = buildInvalidInputArtifact(validation, {
      env,
      writeModeConfirmed,
    });
  } else {
    const providerInputs = getProviderInputs(env);
    const input = {
      ...validation.inputs,
      ...providerInputs,
      writeModeConfirmed,
      participantDataOnlyQaConfirmed,
    };
    const deps = options.deps ?? (await createRealDeps());

    artifact = writeModeConfirmed
      ? await runConfirmedGeneration(input, deps)
      : await inspectReplayParticipantTargets(input, deps);
  }

  stdout.write(JSON.stringify(artifact, null, 2));
  stdout.write("\n");

  return artifact;
}

module.exports = {
  AI_REPORT_MODEL_ENV,
  AI_REPORT_PROVIDER_ENV,
  ALLOWED_TEST_SLUGS,
  CONFIRM_ENV,
  DATA_ONLY_QA_CONFIRM_ENV,
  EXPECTED_MODEL,
  EXPECTED_PROVIDER,
  APPROVED_FAILED_REPORT_CLEANUP_TARGETS,
  EXPECTED_TARGETS,
  FAILED_REPORT_CLEANUP_CONFIRM_ENV,
  SUPPORTED_TARGET_TEST_SLUGS,
  TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV,
  TARGET_REPLAY_PARTICIPANT_ID_ENV,
  TARGET_FAILED_REPORT_ID_ENV,
  TARGET_TEST_SLUG_ALL,
  TARGET_TEST_SLUG_ENV,
  TARGET_TESTS,
  buildParticipantAttemptReportQueueInsertPayload,
  buildReadOnlyAuditSql,
  buildRuntimeConfigCreateSql,
  buildRuntimeConfigInspectSql,
  evaluatePersistedReportPostcondition,
  evaluateFailedParticipantReportCleanupGuard,
  findApprovedFailedReportCleanupTarget,
  evaluateReplayAssignmentGuard,
  evaluateReplayParticipantGuard,
  evaluateRuntimeResolution,
  generateAmraReplaySingleTestParticipantReports,
  resolveClaimedJobModelName,
  resolveRequestedTestSlugs,
  validateRequestedTargetInputs,
};

if (require.main === module) {
  generateAmraReplaySingleTestParticipantReports().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
