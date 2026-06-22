const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_AMRA_REPLAY_HR_REPORT_GENERATION";
const CONFIRM_CLEANUP_ENV = "CONFIRM_AMRA_REPLAY_MOCK_REPORT_CLEANUP";
const TARGET_REPLAY_PARTICIPANT_ID_ENV = "TARGET_REPLAY_PARTICIPANT_ID";
const TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV = "TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID";
const TARGET_TEST_SLUG_ENV = "TARGET_TEST_SLUG";
const AI_REPORT_PROVIDER_ENV = "AI_REPORT_PROVIDER";
const AI_REPORT_MODEL_ENV = "AI_REPORT_MODEL";
const EXPECTED_PROVIDER = "openai";
const EXPECTED_MODEL = "gpt-5.5";

const EXPECTED_TARGETS = {
  participantId: "a5678fd5-8fea-4308-8569-5448f26b4f71",
  assessmentAssignmentId: "033f8975-5d9c-4c66-8842-f37527d556d5",
  organizationId: "5d93f3a1-3765-4ec4-b668-c0d1228a8445",
  fixture: "amra_replay_fixture_v1",
};

const ACCIDENTAL_MOCK_REPORT = {
  reportId: "5263eda0-2307-4267-b629-939cf79bde70",
  attemptId: "8aefc4f9-3ca6-48f2-a41e-0f6b75c5e0d1",
  testSlug: "mwms_v1",
  generatorType: "mock",
};

const TARGET_TESTS = {
  mwms_v1: {
    attemptId: "8aefc4f9-3ca6-48f2-a41e-0f6b75c5e0d1",
    responseCount: 19,
    dimensionScoreCount: 6,
  },
  safran_v1: {
    attemptId: "54702bc1-7d91-492e-9b50-14aff6706d34",
    responseCount: 45,
    dimensionScoreCount: 4,
  },
  "ipip-neo-120-v1": {
    attemptId: "e71d472a-13cb-4cc9-9582-6eaa262affca",
    responseCount: 120,
    dimensionScoreCount: 30,
  },
};

const ALLOWED_TEST_SLUGS = Object.keys(TARGET_TESTS);

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
    resolvedProvider: normalizeEnvString(env[AI_REPORT_PROVIDER_ENV]),
    resolvedModel: normalizeEnvString(env[AI_REPORT_MODEL_ENV]),
  };
}

function buildBaseArtifact(input = {}) {
  return {
    metadata: {
      script: "generate_amra_replay_single_test_hr_reports_v1",
      devOnly: true,
      operation: input.operation ?? "generate",
      dryRun: input.dryRun ?? true,
      writeModeConfirmed: input.writeModeConfirmed ?? false,
      databaseWrites: false,
      openAiCalled: false,
      openAiRequired: true,
      expectedProvider: EXPECTED_PROVIDER,
      expectedModel: EXPECTED_MODEL,
      resolvedProvider: input.resolvedProvider ?? null,
      resolvedModel: input.resolvedModel ?? null,
      reportsGenerated: false,
      reportRegenerated: false,
      originalAmraTouched: false,
      compositeHrTouched: false,
      teamFitTouched: false,
      teamDynamicsTouched: false,
      workerOrSchedulerRun: false,
      uiOrRendererChanged: false,
      migrationOrSchemaChanged: false,
    },
    inputs: {
      targetReplayParticipantId: input.participantId ?? null,
      targetReplayAssessmentAssignmentId: input.assessmentAssignmentId ?? null,
      targetTestSlug: input.testSlug ?? null,
      targetAttemptId: input.targetAttemptId ?? null,
      allowedTestSlugs: [...ALLOWED_TEST_SLUGS],
    },
    status: input.status ?? "not_started",
    reportId: null,
    testSlug: input.testSlug ?? null,
    attemptId: input.targetAttemptId ?? null,
    report_status: null,
    generator_type: null,
    model_name: null,
    input_snapshot_present: false,
    report_snapshot_present: false,
    queueAction: null,
    workerResult: null,
    cleanupAction: null,
    cleanedUpReportId: null,
    blockers: [],
    findings: [],
    nextReadOnlyAuditSql: null,
  };
}

function buildReadOnlyAuditSql(input) {
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
    `where ar.attempt_id = '${input.attemptId}'`,
    `  and ar.test_slug = '${input.testSlug}'`,
    "  and ar.report_type = 'individual'",
    "  and ar.audience = 'hr'",
    "  and ar.source_type = 'single_test'",
    "order by ar.generated_at desc, ar.id desc;",
  ].join("\n");
}

function buildCleanupAuditSql() {
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
    "  ar.model_name",
    "from public.attempt_reports ar",
    `where ar.id = '${ACCIDENTAL_MOCK_REPORT.reportId}'`,
    `  and ar.attempt_id = '${ACCIDENTAL_MOCK_REPORT.attemptId}'`,
    `  and ar.test_slug = '${ACCIDENTAL_MOCK_REPORT.testSlug}';`,
  ].join("\n");
}

function validateConfirmedInputs(env = process.env) {
  const inputs = getTargetInputs(env);
  const missing = [];
  const mismatches = [];

  for (const [key, envName] of [
    ["participantId", TARGET_REPLAY_PARTICIPANT_ID_ENV],
    ["assessmentAssignmentId", TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV],
  ]) {
    if (!inputs[key]) {
      missing.push(envName);
    }
  }

  if (!inputs.participantId) {
    // no-op
  } else if (inputs.participantId !== EXPECTED_TARGETS.participantId) {
    mismatches.push({
      env: TARGET_REPLAY_PARTICIPANT_ID_ENV,
      expected: EXPECTED_TARGETS.participantId,
      received: inputs.participantId,
    });
  }

  if (!inputs.assessmentAssignmentId) {
    // no-op
  } else if (inputs.assessmentAssignmentId !== EXPECTED_TARGETS.assessmentAssignmentId) {
    mismatches.push({
      env: TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV,
      expected: EXPECTED_TARGETS.assessmentAssignmentId,
      received: inputs.assessmentAssignmentId,
    });
  }

  if (!inputs.testSlug) {
    missing.push(TARGET_TEST_SLUG_ENV);
  } else if (!Object.prototype.hasOwnProperty.call(TARGET_TESTS, inputs.testSlug)) {
    mismatches.push({
      env: TARGET_TEST_SLUG_ENV,
      expected: ALLOWED_TEST_SLUGS.join(" | "),
      received: inputs.testSlug,
    });
  }

  return {
    ok: missing.length === 0 && mismatches.length === 0,
    inputs,
    missing,
    mismatches,
  };
}

function validateProviderInputs(env = process.env) {
  const providerInputs = getProviderInputs(env);

  return {
    ok:
      providerInputs.resolvedProvider === EXPECTED_PROVIDER &&
      providerInputs.resolvedModel === EXPECTED_MODEL,
    ...providerInputs,
  };
}

function buildConfirmationRequiredArtifact(env = process.env) {
  const inputs = getTargetInputs(env);
  const providerInputs = getProviderInputs(env);
  const testSpec = inputs.testSlug ? TARGET_TESTS[inputs.testSlug] : null;
  const artifact = buildBaseArtifact({
    ...inputs,
    ...providerInputs,
    targetAttemptId: testSpec?.attemptId ?? null,
    dryRun: true,
    writeModeConfirmed: false,
    status: "confirmation_required",
  });

  artifact.blockers.push(`${CONFIRM_ENV}=true is required before any HR report generation path can run.`);
  artifact.findings.push({
    severity: "info",
    category: "dry_run",
    message: "Default mode is no-write and does not queue or process report jobs.",
  });

  return artifact;
}

function buildInvalidInputArtifact(validation) {
  const testSpec = validation.inputs.testSlug ? TARGET_TESTS[validation.inputs.testSlug] : null;
  const providerInputs = getProviderInputs();
  const artifact = buildBaseArtifact({
    ...validation.inputs,
    ...providerInputs,
    targetAttemptId: testSpec?.attemptId ?? null,
    dryRun: true,
    writeModeConfirmed: true,
    status: "confirmation_required",
  });

  if (validation.missing.length > 0) {
    artifact.blockers.push("missing_target_env");
    artifact.findings.push({
      severity: "blocker",
      category: "target_env",
      message: "Confirmed mode requires explicit replay participant, assignment and target test env vars.",
      missing: validation.missing,
    });
  }

  if (validation.mismatches.length > 0) {
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

function buildProviderBlockedArtifact(input, providerValidation) {
  const artifact = buildBaseArtifact({
    ...input,
    ...providerValidation,
    targetAttemptId: TARGET_TESTS[input.testSlug]?.attemptId ?? null,
    dryRun: true,
    writeModeConfirmed: true,
    status:
      providerValidation.resolvedProvider !== EXPECTED_PROVIDER
        ? "blocked_provider_not_openai"
        : "blocked_model_not_gpt_5_5",
  });

  if (providerValidation.resolvedProvider !== EXPECTED_PROVIDER) {
    artifact.blockers.push("blocked_provider_not_openai");
    artifact.findings.push({
      severity: "blocker",
      category: "provider",
      message: "Confirmed replay HR generation requires AI_REPORT_PROVIDER=openai.",
    });
  } else {
    artifact.blockers.push("blocked_model_not_gpt_5_5");
    artifact.findings.push({
      severity: "blocker",
      category: "provider",
      message: "Confirmed replay HR generation requires AI_REPORT_MODEL=gpt-5.5.",
    });
  }

  return artifact;
}

function buildAmbiguousModeArtifact(env = process.env) {
  const inputs = getTargetInputs(env);
  const providerInputs = getProviderInputs(env);
  const testSpec = inputs.testSlug ? TARGET_TESTS[inputs.testSlug] : null;
  const artifact = buildBaseArtifact({
    ...inputs,
    ...providerInputs,
    targetAttemptId: testSpec?.attemptId ?? null,
    dryRun: true,
    writeModeConfirmed: false,
    status: "blocked_ambiguous_operator_mode",
  });

  artifact.blockers.push("blocked_ambiguous_operator_mode");
  artifact.findings.push({
    severity: "blocker",
    category: "operator_mode",
    message: `Set either ${CONFIRM_ENV}=true or ${CONFIRM_CLEANUP_ENV}=true, not both.`,
  });

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

async function loadAttemptFootprint(supabase, attemptId) {
  const [{ count: responseCount, error: responseError }, { count: dimensionScoreCount, error: scoreError }] =
    await Promise.all([
      supabase
        .from("responses")
        .select("*", { count: "exact", head: true })
        .eq("attempt_id", attemptId),
      supabase
        .from("dimension_scores")
        .select("*", { count: "exact", head: true })
        .eq("attempt_id", attemptId),
    ]);

  if (responseError) {
    throw new Error(`Failed to count replay attempt responses: ${responseError.message}`);
  }

  if (scoreError) {
    throw new Error(`Failed to count replay attempt dimension scores: ${scoreError.message}`);
  }

  return {
    responseCount: responseCount ?? 0,
    dimensionScoreCount: dimensionScoreCount ?? 0,
  };
}

async function loadExistingHrReports(supabase, attemptId, testSlug) {
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(
      "id, attempt_id, test_slug, report_type, audience, source_type, report_status, generator_type, model_name, input_snapshot, report_snapshot",
    )
    .eq("attempt_id", attemptId)
    .eq("test_slug", testSlug)
    .eq("report_type", "individual")
    .eq("audience", "hr")
    .eq("source_type", "single_test")
    .order("generated_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw new Error(`Failed to load existing replay HR reports: ${error.message}`);
  }

  return data ?? [];
}

async function loadFinalReportRow(supabase, reportId) {
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(
      "id, attempt_id, test_slug, report_status, generator_type, model_name, input_snapshot, report_snapshot",
    )
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load final replay HR report row: ${error.message}`);
  }

  return data ?? null;
}

async function loadCleanupTargetReport(supabase) {
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(
      "id, attempt_id, test_slug, report_type, audience, source_type, report_status, generator_type, model_name",
    )
    .eq("id", ACCIDENTAL_MOCK_REPORT.reportId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load cleanup target report: ${error.message}`);
  }

  return data ?? null;
}

async function runConfirmedGeneration(input) {
  installTypeScriptRuntime();

  const { createSupabaseAdminClient } = require(path.join(projectRoot, "lib", "supabase", "admin.ts"));
  const { recoverHrAttemptReport } = require(path.join(projectRoot, "lib", "assessment", "reports.ts"));
  const {
    claimNextReportJob,
    processClaimedReportJob,
  } = require(path.join(projectRoot, "lib", "assessment", "report-job-worker.ts"));

  const supabase = createSupabaseAdminClient();
  const targetSpec = TARGET_TESTS[input.testSlug];
  const artifact = buildBaseArtifact({
    ...input,
    operation: "generate",
    targetAttemptId: targetSpec.attemptId,
    dryRun: false,
    writeModeConfirmed: true,
    status: "running",
  });

  const participant = await loadReplayParticipant(supabase, input.participantId);
  if (!participant) {
    artifact.status = "blocked";
    artifact.blockers.push("target_replay_participant_not_found");
    return artifact;
  }

  if (participant.organization_id !== EXPECTED_TARGETS.organizationId) {
    artifact.status = "blocked";
    artifact.blockers.push("target_replay_participant_organization_mismatch");
    return artifact;
  }

  const assignment = await loadReplayAssignment(supabase, input.assessmentAssignmentId);
  if (!assignment) {
    artifact.status = "blocked";
    artifact.blockers.push("target_replay_assignment_not_found");
    return artifact;
  }

  if (
    assignment.organization_id !== EXPECTED_TARGETS.organizationId ||
    assignment.participant_id !== input.participantId ||
    assignment.assignment_type !== "standard_battery" ||
    assignment.status !== "completed" ||
    assignment.metadata?.fixture !== EXPECTED_TARGETS.fixture
  ) {
    artifact.status = "blocked";
    artifact.blockers.push("target_replay_assignment_guard_failed");
    artifact.findings.push({
      severity: "blocker",
      category: "assignment",
      message: "Replay assignment failed organization/participant/type/status/fixture guard.",
    });
    return artifact;
  }

  const attempt = await loadReplayAttemptContext(supabase, input);
  if (!attempt) {
    artifact.status = "blocked";
    artifact.blockers.push("target_replay_attempt_link_not_found");
    return artifact;
  }

  if (
    attempt.organizationId !== EXPECTED_TARGETS.organizationId ||
    attempt.participantId !== input.participantId ||
    attempt.status !== "completed" ||
    !attempt.completedAt
  ) {
    artifact.status = "blocked";
    artifact.blockers.push("target_replay_attempt_guard_failed");
    return artifact;
  }

  const footprint = await loadAttemptFootprint(supabase, attempt.attemptId);
  if (footprint.responseCount <= 0 || footprint.dimensionScoreCount <= 0) {
    artifact.status = "blocked";
    artifact.blockers.push("target_replay_attempt_missing_source_state");
    artifact.findings.push({
      severity: "blocker",
      category: "attempt",
      message: "Replay attempt must have persisted responses and dimension scores before HR generation.",
      footprint,
    });
    return artifact;
  }

  if (
    footprint.responseCount !== targetSpec.responseCount ||
    footprint.dimensionScoreCount !== targetSpec.dimensionScoreCount
  ) {
    artifact.status = "blocked";
    artifact.blockers.push("target_replay_attempt_footprint_mismatch");
    artifact.findings.push({
      severity: "blocker",
      category: "attempt",
      message: "Replay attempt footprint does not match the approved audit context.",
      expected: {
        responseCount: targetSpec.responseCount,
        dimensionScoreCount: targetSpec.dimensionScoreCount,
      },
      received: footprint,
    });
    return artifact;
  }

  const existingReports = await loadExistingHrReports(supabase, attempt.attemptId, input.testSlug);
  if (existingReports.length > 0) {
    artifact.status = "blocked_existing_hr_report_present";
    artifact.blockers.push("existing_hr_single_test_report_present");
    artifact.findings.push({
      severity: "blocker",
      category: "attempt_report",
      message: "Replay attempt already has HR single-test attempt_reports rows. Overwrite/reset is intentionally not implemented in this operator path.",
      existingReportIds: existingReports.map((row) => row.id),
    });
    return artifact;
  }

  const recovery = await recoverHrAttemptReport(attempt.attemptId);
  artifact.queueAction = recovery.action;
  artifact.reportId = recovery.reportId ?? null;

  if (recovery.action !== "generate" || recovery.status !== "queued" || !recovery.reportId) {
    artifact.status = "blocked";
    artifact.blockers.push("unexpected_hr_recovery_result");
    artifact.findings.push({
      severity: "blocker",
      category: "queue",
      message: "Replay HR queue path did not return the expected generate -> queued result.",
      recovery,
    });
    return artifact;
  }

  const claimedJob = await claimNextReportJob({
    attemptId: attempt.attemptId,
    audience: "hr",
  });

  if (!claimedJob || claimedJob.attempt_id !== attempt.attemptId || claimedJob.test_slug !== input.testSlug) {
    artifact.status = "blocked";
    artifact.blockers.push("failed_to_claim_target_hr_report_job");
    return artifact;
  }

  const workerResult = await processClaimedReportJob(claimedJob);
  artifact.metadata.databaseWrites = true;
  artifact.metadata.openAiCalled = claimedJob.generator_type === "openai";
  artifact.metadata.reportsGenerated = workerResult.status === "ready";
  artifact.metadata.workerOrSchedulerRun = true;
  artifact.workerResult = workerResult.status;

  const finalRow = await loadFinalReportRow(supabase, claimedJob.id);
  artifact.nextReadOnlyAuditSql = buildReadOnlyAuditSql({
    attemptId: attempt.attemptId,
    testSlug: input.testSlug,
  });

  if (!finalRow) {
    artifact.status = "blocked";
    artifact.blockers.push("final_hr_report_row_not_found");
    return artifact;
  }

  artifact.reportId = finalRow.id;
  artifact.testSlug = finalRow.test_slug;
  artifact.attemptId = finalRow.attempt_id;
  artifact.report_status = finalRow.report_status;
  artifact.generator_type = finalRow.generator_type;
  artifact.model_name = finalRow.model_name;
  artifact.input_snapshot_present = finalRow.input_snapshot !== null;
  artifact.report_snapshot_present = finalRow.report_snapshot !== null;

  artifact.status = workerResult.status === "ready" ? "ready" : "failed";

  if (workerResult.status !== "ready") {
    artifact.findings.push({
      severity: "blocker",
      category: "worker",
      message: "Replay HR worker finished on failed path.",
      failure: workerResult.failure,
    });
  }

  return artifact;
}

async function runConfirmedCleanup(input) {
  installTypeScriptRuntime();

  const { createSupabaseAdminClient } = require(path.join(projectRoot, "lib", "supabase", "admin.ts"));
  const supabase = createSupabaseAdminClient();
  const artifact = buildBaseArtifact({
    ...input,
    operation: "cleanup_mock_report",
    targetAttemptId: ACCIDENTAL_MOCK_REPORT.attemptId,
    dryRun: false,
    writeModeConfirmed: true,
    status: "running_cleanup",
  });

  const participant = await loadReplayParticipant(supabase, input.participantId);
  if (!participant || participant.organization_id !== EXPECTED_TARGETS.organizationId || participant.email !== "amra.new1@example.test") {
    artifact.status = "blocked";
    artifact.blockers.push("cleanup_target_participant_guard_failed");
    return artifact;
  }

  const assignment = await loadReplayAssignment(supabase, input.assessmentAssignmentId);
  if (
    !assignment ||
    assignment.organization_id !== EXPECTED_TARGETS.organizationId ||
    assignment.participant_id !== input.participantId ||
    assignment.assignment_type !== "standard_battery" ||
    assignment.metadata?.fixture !== EXPECTED_TARGETS.fixture
  ) {
    artifact.status = "blocked";
    artifact.blockers.push("cleanup_target_assignment_guard_failed");
    return artifact;
  }

  if (input.testSlug !== ACCIDENTAL_MOCK_REPORT.testSlug) {
    artifact.status = "blocked";
    artifact.blockers.push("cleanup_target_test_slug_mismatch");
    return artifact;
  }

  const attempt = await loadReplayAttemptContext(supabase, input);
  if (
    !attempt ||
    attempt.attemptId !== ACCIDENTAL_MOCK_REPORT.attemptId ||
    attempt.organizationId !== EXPECTED_TARGETS.organizationId ||
    attempt.participantId !== input.participantId
  ) {
    artifact.status = "blocked";
    artifact.blockers.push("cleanup_target_attempt_guard_failed");
    return artifact;
  }

  const report = await loadCleanupTargetReport(supabase);
  if (!report) {
    artifact.status = "blocked_cleanup_target_not_found";
    artifact.blockers.push("cleanup_target_report_not_found");
    artifact.nextReadOnlyAuditSql = buildCleanupAuditSql();
    return artifact;
  }

  if (
    report.id !== ACCIDENTAL_MOCK_REPORT.reportId ||
    report.attempt_id !== ACCIDENTAL_MOCK_REPORT.attemptId ||
    report.test_slug !== ACCIDENTAL_MOCK_REPORT.testSlug ||
    report.generator_type !== ACCIDENTAL_MOCK_REPORT.generatorType ||
    report.report_type !== "individual" ||
    report.audience !== "hr" ||
    report.source_type !== "single_test"
  ) {
    artifact.status = "blocked_cleanup_target_guard_failed";
    artifact.blockers.push("cleanup_target_report_guard_failed");
    return artifact;
  }

  const { error: deleteError } = await supabase
    .from("attempt_reports")
    .delete()
    .eq("id", ACCIDENTAL_MOCK_REPORT.reportId)
    .eq("attempt_id", ACCIDENTAL_MOCK_REPORT.attemptId)
    .eq("test_slug", ACCIDENTAL_MOCK_REPORT.testSlug)
    .eq("generator_type", ACCIDENTAL_MOCK_REPORT.generatorType)
    .eq("report_type", "individual")
    .eq("audience", "hr")
    .eq("source_type", "single_test");

  if (deleteError) {
    throw new Error(`Failed to cleanup accidental mock replay report: ${deleteError.message}`);
  }

  artifact.metadata.databaseWrites = true;
  artifact.status = "cleanup_completed";
  artifact.cleanupAction = "delete_exact_mock_report";
  artifact.cleanedUpReportId = ACCIDENTAL_MOCK_REPORT.reportId;
  artifact.reportId = ACCIDENTAL_MOCK_REPORT.reportId;
  artifact.testSlug = ACCIDENTAL_MOCK_REPORT.testSlug;
  artifact.attemptId = ACCIDENTAL_MOCK_REPORT.attemptId;
  artifact.nextReadOnlyAuditSql = buildCleanupAuditSql();

  return artifact;
}

async function generateAmraReplaySingleTestHrReports({ env = process.env, stdout = process.stdout } = {}) {
  if (env[CONFIRM_ENV] === "true" && env[CONFIRM_CLEANUP_ENV] === "true") {
    const artifact = buildAmbiguousModeArtifact(env);
    stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    return artifact;
  }

  if (env[CONFIRM_CLEANUP_ENV] === "true") {
    const validation = validateConfirmedInputs(env);
    if (!validation.ok) {
      const artifact = buildInvalidInputArtifact(validation);
      stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
      return artifact;
    }

    const artifact = await runConfirmedCleanup({
      ...validation.inputs,
      ...getProviderInputs(env),
    });
    stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    return artifact;
  }

  if (env[CONFIRM_ENV] !== "true") {
    const artifact = buildConfirmationRequiredArtifact(env);
    stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    return artifact;
  }

  const validation = validateConfirmedInputs(env);
  if (!validation.ok) {
    const artifact = buildInvalidInputArtifact(validation);
    stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    return artifact;
  }

  const providerValidation = validateProviderInputs(env);
  if (!providerValidation.ok) {
    const artifact = buildProviderBlockedArtifact(validation.inputs, providerValidation);
    stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    return artifact;
  }

  const artifact = await runConfirmedGeneration({
    ...validation.inputs,
    ...providerValidation,
  });
  stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}

module.exports = {
  ALLOWED_TEST_SLUGS,
  ACCIDENTAL_MOCK_REPORT,
  AI_REPORT_MODEL_ENV,
  AI_REPORT_PROVIDER_ENV,
  CONFIRM_ENV,
  CONFIRM_CLEANUP_ENV,
  EXPECTED_TARGETS,
  EXPECTED_MODEL,
  EXPECTED_PROVIDER,
  TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV,
  TARGET_REPLAY_PARTICIPANT_ID_ENV,
  TARGET_TEST_SLUG_ENV,
  TARGET_TESTS,
  buildBaseArtifact,
  buildCleanupAuditSql,
  buildConfirmationRequiredArtifact,
  buildReadOnlyAuditSql,
  buildProviderBlockedArtifact,
  generateAmraReplaySingleTestHrReports,
  getTargetInputs,
  validateConfirmedInputs,
  validateProviderInputs,
};

if (require.main === module) {
  generateAmraReplaySingleTestHrReports().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
