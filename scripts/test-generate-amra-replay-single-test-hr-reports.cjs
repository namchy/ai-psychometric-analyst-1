const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "scripts", "generate-amra-replay-single-test-hr-reports.cjs");
const scriptSource = fs.readFileSync(scriptPath, "utf8");

assert.match(scriptSource, /CONFIRM_AMRA_REPLAY_HR_REPORT_GENERATION/);
assert.match(scriptSource, /CONFIRM_AMRA_REPLAY_MOCK_REPORT_CLEANUP/);
assert.match(scriptSource, /CONFIRM_AMRA_REPLAY_FAILED_REPORT_CLEANUP/);
assert.match(scriptSource, /TARGET_REPLAY_PARTICIPANT_ID/);
assert.match(scriptSource, /TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID/);
assert.match(scriptSource, /TARGET_TEST_SLUG/);
assert.match(scriptSource, /TARGET_MOCK_REPORT_ID/);
assert.match(scriptSource, /TARGET_FAILED_REPORT_ID/);
assert.match(scriptSource, /AI_REPORT_PROVIDER/);
assert.match(scriptSource, /AI_REPORT_MODEL/);
assert.match(scriptSource, /openai/);
assert.match(scriptSource, /gpt-5\.5/);
assert.match(scriptSource, /a5678fd5-8fea-4308-8569-5448f26b4f71/);
assert.match(scriptSource, /033f8975-5d9c-4c66-8842-f37527d556d5/);
assert.match(scriptSource, /d73c6390-e6fe-411a-a8f3-02c52bc60612/);
assert.match(scriptSource, /5136bc05-153a-4356-8aa2-ee06dd67877a/);
assert.match(scriptSource, /amra_replay_fixture_v1/);
assert.match(scriptSource, /recoverHrAttemptReport/);
assert.match(scriptSource, /claimNextReportJob/);
assert.match(scriptSource, /processClaimedReportJob/);
assert.match(scriptSource, /report_runtime_configs/);
assert.match(scriptSource, /databaseWrites:\s*false/);
assert.match(scriptSource, /openAiCalled:\s*false/);
assert.match(scriptSource, /openAiRequired:\s*true/);
assert.match(scriptSource, /reportsGenerated:\s*false/);
assert.match(scriptSource, /originalAmraTouched:\s*false/);
assert.match(scriptSource, /compositeHrTouched:\s*false/);
assert.match(scriptSource, /teamFitTouched:\s*false/);
assert.match(scriptSource, /teamDynamicsTouched:\s*false/);
assert.match(scriptSource, /workerOrSchedulerRun:\s*false/);
assert.match(scriptSource, /blocked_existing_hr_report_present/);
assert.match(scriptSource, /blocked_provider_not_openai/);
assert.match(scriptSource, /blocked_model_not_gpt_5_5/);
assert.match(scriptSource, /cleanup_completed/);
assert.match(scriptSource, /delete_exact_mock_report/);
assert.match(scriptSource, /failed_cleanup_completed/);
assert.match(scriptSource, /delete_exact_failed_openai_report/);
assert.doesNotMatch(scriptSource, /\.from\("assessment_reports"\)|\.from\('assessment_reports'\)/);
assert.doesNotMatch(scriptSource, /\.from\("team_fit_reports"\)|\.from\('team_fit_reports'\)/);
assert.doesNotMatch(scriptSource, /createQueuedCompositeAssessmentReport|processClaimedAssessmentReportJob|buildCompositeHrInputSnapshot/);
assert.doesNotMatch(scriptSource, /supabase migration|db push|db reset|migration repair/i);
assert.doesNotMatch(scriptSource, /components\/|renderer\.tsx|renderer\.ts|app\/\(protected\)/i);

const {
  ALLOWED_TEST_SLUGS,
  ACCIDENTAL_MOCK_REPORT,
  AI_REPORT_MODEL_ENV,
  AI_REPORT_PROVIDER_ENV,
  CONFIRM_ENV,
  CONFIRM_CLEANUP_ENV,
  CONFIRM_FAILED_CLEANUP_ENV,
  EXPECTED_TARGETS,
  EXPECTED_MODEL,
  EXPECTED_PROVIDER,
  FAILED_IPIP_REPLAY_REPORT,
  TARGET_FAILED_REPORT_ID_ENV,
  TARGET_MOCK_REPORT_ID_ENV,
  TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV,
  TARGET_REPLAY_PARTICIPANT_ID_ENV,
  TARGET_TEST_SLUG_ENV,
  TARGET_TESTS,
  buildCleanupAuditSql,
  buildConfirmationRequiredArtifact,
  buildFailedCleanupAuditSql,
  evaluateCleanupTargetReportRow,
  evaluateFailedCleanupTargetSelection,
  evaluateFailedCleanupTargetReportRow,
  evaluatePersistedReportPostcondition,
  evaluateReplayAssignmentGuard,
  evaluateReplayParticipantGuard,
  evaluateResolvedProviderState,
  buildProviderBlockedArtifact,
  buildReadOnlyAuditSql,
  generateAmraReplaySingleTestHrReports,
  resolveClaimedJobModelName,
  validateConfirmedInputs,
  validateCleanupInputs,
  validateFailedCleanupInputs,
  validateProviderInputs,
} = require(scriptPath);

assert.deepEqual(ALLOWED_TEST_SLUGS, ["mwms_v1", "safran_v1", "ipip-neo-120-v1"]);
assert.equal(TARGET_TESTS.mwms_v1.attemptId, "8aefc4f9-3ca6-48f2-a41e-0f6b75c5e0d1");
assert.equal(TARGET_TESTS.safran_v1.attemptId, "54702bc1-7d91-492e-9b50-14aff6706d34");
assert.equal(TARGET_TESTS["ipip-neo-120-v1"].attemptId, "e71d472a-13cb-4cc9-9582-6eaa262affca");
assert.equal(ACCIDENTAL_MOCK_REPORT.reportId, "d73c6390-e6fe-411a-a8f3-02c52bc60612");
assert.equal(ACCIDENTAL_MOCK_REPORT.attemptId, TARGET_TESTS.mwms_v1.attemptId);
assert.equal(FAILED_IPIP_REPLAY_REPORT.reportId, "5136bc05-153a-4356-8aa2-ee06dd67877a");
assert.equal(FAILED_IPIP_REPLAY_REPORT.attemptId, TARGET_TESTS["ipip-neo-120-v1"].attemptId);
assert.equal(EXPECTED_PROVIDER, "openai");
assert.equal(EXPECTED_MODEL, "gpt-5.5");

const defaultArtifact = buildConfirmationRequiredArtifact({});
assert.equal(defaultArtifact.status, "confirmation_required");
assert.equal(defaultArtifact.metadata.dryRun, true);
assert.equal(defaultArtifact.metadata.databaseWrites, false);
assert.equal(defaultArtifact.metadata.openAiCalled, false);
assert.equal(defaultArtifact.metadata.openAiRequired, true);
assert.equal(defaultArtifact.metadata.reportsGenerated, false);
assert.equal(defaultArtifact.metadata.originalAmraTouched, false);
assert.match(defaultArtifact.blockers[0], new RegExp(`${CONFIRM_ENV}=true`));

const missingValidation = validateConfirmedInputs({
  [CONFIRM_ENV]: "true",
});
assert.equal(missingValidation.ok, false);
assert.deepEqual(missingValidation.missing, [
  TARGET_REPLAY_PARTICIPANT_ID_ENV,
  TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV,
  TARGET_TEST_SLUG_ENV,
]);

const mismatchValidation = validateConfirmedInputs({
  [TARGET_REPLAY_PARTICIPANT_ID_ENV]: "wrong",
  [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_TARGETS.assessmentAssignmentId,
  [TARGET_TEST_SLUG_ENV]: "mwms_v1",
});
assert.equal(mismatchValidation.ok, false);
assert.equal(mismatchValidation.mismatches.length, 1);
assert.equal(mismatchValidation.mismatches[0].env, TARGET_REPLAY_PARTICIPANT_ID_ENV);

const invalidSlugValidation = validateConfirmedInputs({
  [TARGET_REPLAY_PARTICIPANT_ID_ENV]: EXPECTED_TARGETS.participantId,
  [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_TARGETS.assessmentAssignmentId,
  [TARGET_TEST_SLUG_ENV]: "unknown_v1",
});
assert.equal(invalidSlugValidation.ok, false);

const validValidation = validateConfirmedInputs({
  [TARGET_REPLAY_PARTICIPANT_ID_ENV]: EXPECTED_TARGETS.participantId,
  [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_TARGETS.assessmentAssignmentId,
  [TARGET_TEST_SLUG_ENV]: "mwms_v1",
});
assert.equal(validValidation.ok, true);

const missingProviderValidation = validateProviderInputs({});
assert.equal(missingProviderValidation.ok, false);
assert.equal(missingProviderValidation.declaredProvider, null);
assert.equal(missingProviderValidation.declaredModel, null);

const wrongProviderValidation = validateProviderInputs({
  [AI_REPORT_PROVIDER_ENV]: "mock",
  [AI_REPORT_MODEL_ENV]: EXPECTED_MODEL,
});
assert.equal(wrongProviderValidation.ok, false);

const wrongModelValidation = validateProviderInputs({
  [AI_REPORT_PROVIDER_ENV]: EXPECTED_PROVIDER,
  [AI_REPORT_MODEL_ENV]: "gpt-4.1",
});
assert.equal(wrongModelValidation.ok, false);

const validProviderValidation = validateProviderInputs({
  [AI_REPORT_PROVIDER_ENV]: EXPECTED_PROVIDER,
  [AI_REPORT_MODEL_ENV]: EXPECTED_MODEL,
});
assert.equal(validProviderValidation.ok, true);

const providerBlockedArtifact = buildProviderBlockedArtifact(
  validValidation.inputs,
  evaluateResolvedProviderState({
    declaredProvider: "mock",
    declaredModel: EXPECTED_MODEL,
    actualQueueResolvedProvider: "mock",
    actualQueueResolvedModel: null,
    activeOpenAiRuntimeModel: EXPECTED_MODEL,
    aiConfigModel: EXPECTED_MODEL,
  }),
);
assert.equal(providerBlockedArtifact.status, "blocked_provider_not_openai");
assert.equal(providerBlockedArtifact.metadata.openAiRequired, true);
assert.equal(providerBlockedArtifact.metadata.actualWorkerResolvedProvider, "mock");

const modelBlockedArtifact = buildProviderBlockedArtifact(
  validValidation.inputs,
  evaluateResolvedProviderState({
    declaredProvider: EXPECTED_PROVIDER,
    declaredModel: "gpt-4.1",
    actualQueueResolvedProvider: "openai",
    actualQueueResolvedModel: "gpt-4.1",
    activeOpenAiRuntimeModel: EXPECTED_MODEL,
    aiConfigModel: EXPECTED_MODEL,
  }),
);
assert.equal(modelBlockedArtifact.status, "blocked_model_not_gpt_5_5");
assert.equal(modelBlockedArtifact.metadata.actualWorkerResolvedProvider, EXPECTED_PROVIDER);
assert.equal(modelBlockedArtifact.metadata.actualWorkerResolvedModel, "gpt-4.1");

const runtimeBlockedState = evaluateResolvedProviderState({
  declaredProvider: EXPECTED_PROVIDER,
  declaredModel: EXPECTED_MODEL,
  actualQueueResolvedProvider: "mock",
  actualQueueResolvedModel: null,
  activeOpenAiRuntimeModel: EXPECTED_MODEL,
  aiConfigModel: EXPECTED_MODEL,
});
assert.equal(runtimeBlockedState.ok, false);
assert.equal(runtimeBlockedState.status, "blocked_provider_not_openai");
assert.equal(runtimeBlockedState.actualWorkerResolvedProvider, "mock");

const runtimeModelBlockedState = evaluateResolvedProviderState({
  declaredProvider: EXPECTED_PROVIDER,
  declaredModel: EXPECTED_MODEL,
  actualQueueResolvedProvider: "openai",
  actualQueueResolvedModel: "gpt-4.1",
  activeOpenAiRuntimeModel: EXPECTED_MODEL,
  aiConfigModel: EXPECTED_MODEL,
});
assert.equal(runtimeModelBlockedState.ok, false);
assert.equal(runtimeModelBlockedState.status, "blocked_model_not_gpt_5_5");
assert.equal(runtimeModelBlockedState.actualWorkerResolvedModel, "gpt-4.1");

const runtimePassState = evaluateResolvedProviderState({
  declaredProvider: EXPECTED_PROVIDER,
  declaredModel: EXPECTED_MODEL,
  actualQueueResolvedProvider: "openai",
  actualQueueResolvedModel: null,
  activeOpenAiRuntimeModel: EXPECTED_MODEL,
  aiConfigModel: EXPECTED_MODEL,
});
assert.equal(runtimePassState.ok, true);
assert.equal(runtimePassState.actualWorkerResolvedProvider, EXPECTED_PROVIDER);
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

const cleanupValidation = validateCleanupInputs({
  [CONFIRM_CLEANUP_ENV]: "true",
  [TARGET_REPLAY_PARTICIPANT_ID_ENV]: EXPECTED_TARGETS.participantId,
  [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_TARGETS.assessmentAssignmentId,
  [TARGET_TEST_SLUG_ENV]: "mwms_v1",
});
assert.equal(cleanupValidation.ok, false);
assert.equal(cleanupValidation.missing.includes(TARGET_MOCK_REPORT_ID_ENV), true);

const failedCleanupValidation = validateFailedCleanupInputs({
  [CONFIRM_FAILED_CLEANUP_ENV]: "true",
  [TARGET_REPLAY_PARTICIPANT_ID_ENV]: EXPECTED_TARGETS.participantId,
  [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_TARGETS.assessmentAssignmentId,
  [TARGET_TEST_SLUG_ENV]: "ipip-neo-120-v1",
});
assert.equal(failedCleanupValidation.ok, false);
assert.equal(failedCleanupValidation.missing.includes(TARGET_FAILED_REPORT_ID_ENV), true);

assert.equal(
  evaluateReplayParticipantGuard({
    organization_id: EXPECTED_TARGETS.organizationId,
    email: "amra.new1@example.test",
  }),
  true,
);
assert.equal(
  evaluateReplayParticipantGuard({
    organization_id: "5d93f3a1-3765-4ec4-b668-c0d1228a8445",
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
      metadata: { fixture: "amra_replay_fixture_v1" },
    },
    EXPECTED_TARGETS.participantId,
  ),
  true,
);
assert.equal(
  evaluateReplayAssignmentGuard(
    {
      organization_id: "5d93f3a1-3765-4ec4-b668-c0d1228a8445",
      participant_id: "9b742094-53dc-4de5-87a5-174c5491e4dd",
      assignment_type: "standard_battery",
      metadata: {},
    },
    EXPECTED_TARGETS.participantId,
  ),
  false,
);

const failedCleanupWrongSlug = evaluateFailedCleanupTargetSelection({
  testSlug: "mwms_v1",
});
assert.equal(failedCleanupWrongSlug.ok, false);
assert.equal(failedCleanupWrongSlug.blocker, "failed_cleanup_target_test_slug_mismatch");

const cleanupTargetRefused = evaluateCleanupTargetReportRow(
  {
    id: ACCIDENTAL_MOCK_REPORT.reportId,
    attempt_id: ACCIDENTAL_MOCK_REPORT.attemptId,
    test_slug: ACCIDENTAL_MOCK_REPORT.testSlug,
    report_type: "individual",
    audience: "hr",
    source_type: "single_test",
    generator_type: "openai",
  },
  {
    targetMockReportId: ACCIDENTAL_MOCK_REPORT.reportId,
  },
);
assert.equal(cleanupTargetRefused.ok, false);
assert.equal(cleanupTargetRefused.status, "cleanup_refused_non_mock_report");

const cleanupTargetPass = evaluateCleanupTargetReportRow(
  {
    id: ACCIDENTAL_MOCK_REPORT.reportId,
    attempt_id: ACCIDENTAL_MOCK_REPORT.attemptId,
    test_slug: ACCIDENTAL_MOCK_REPORT.testSlug,
    report_type: "individual",
    audience: "hr",
    source_type: "single_test",
    generator_type: "mock",
  },
  {
    targetMockReportId: ACCIDENTAL_MOCK_REPORT.reportId,
  },
);
assert.equal(cleanupTargetPass.ok, true);

const failedCleanupReadyRefused = evaluateFailedCleanupTargetReportRow(
  {
    id: FAILED_IPIP_REPLAY_REPORT.reportId,
    attempt_id: FAILED_IPIP_REPLAY_REPORT.attemptId,
    test_slug: FAILED_IPIP_REPLAY_REPORT.testSlug,
    report_type: "individual",
    audience: "hr",
    source_type: "single_test",
    report_status: "ready",
    generator_type: "openai",
    model_name: "gpt-5.5",
    failure_code: "PROVIDER_ERROR",
  },
  {
    targetFailedReportId: FAILED_IPIP_REPLAY_REPORT.reportId,
  },
);
assert.equal(failedCleanupReadyRefused.ok, false);
assert.equal(failedCleanupReadyRefused.status, "failed_cleanup_refused_ready_report");

const failedCleanupMockRefused = evaluateFailedCleanupTargetReportRow(
  {
    id: FAILED_IPIP_REPLAY_REPORT.reportId,
    attempt_id: FAILED_IPIP_REPLAY_REPORT.attemptId,
    test_slug: FAILED_IPIP_REPLAY_REPORT.testSlug,
    report_type: "individual",
    audience: "hr",
    source_type: "single_test",
    report_status: "failed",
    generator_type: "mock",
    model_name: null,
    failure_code: "PROVIDER_ERROR",
  },
  {
    targetFailedReportId: FAILED_IPIP_REPLAY_REPORT.reportId,
  },
);
assert.equal(failedCleanupMockRefused.ok, false);
assert.equal(failedCleanupMockRefused.status, "failed_cleanup_refused_mock_report");

const failedCleanupGuardFailed = evaluateFailedCleanupTargetReportRow(
  {
    id: FAILED_IPIP_REPLAY_REPORT.reportId,
    attempt_id: FAILED_IPIP_REPLAY_REPORT.attemptId,
    test_slug: "mwms_v1",
    report_type: "individual",
    audience: "hr",
    source_type: "single_test",
    report_status: "failed",
    generator_type: "openai",
    model_name: "gpt-5.5",
    failure_code: "PROVIDER_ERROR",
  },
  {
    targetFailedReportId: FAILED_IPIP_REPLAY_REPORT.reportId,
  },
);
assert.equal(failedCleanupGuardFailed.ok, false);
assert.equal(failedCleanupGuardFailed.status, "blocked_failed_cleanup_target_guard_failed");

const failedCleanupPass = evaluateFailedCleanupTargetReportRow(
  {
    id: FAILED_IPIP_REPLAY_REPORT.reportId,
    attempt_id: FAILED_IPIP_REPLAY_REPORT.attemptId,
    test_slug: FAILED_IPIP_REPLAY_REPORT.testSlug,
    report_type: "individual",
    audience: "hr",
    source_type: "single_test",
    report_status: "failed",
    generator_type: "openai",
    model_name: "gpt-5.5",
    failure_code: "PROVIDER_ERROR",
  },
  {
    targetFailedReportId: FAILED_IPIP_REPLAY_REPORT.reportId,
  },
);
assert.equal(failedCleanupPass.ok, true);

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

const auditSql = buildReadOnlyAuditSql({
  attemptId: TARGET_TESTS.mwms_v1.attemptId,
  testSlug: "mwms_v1",
});
assert.match(auditSql, /from public\.attempt_reports/);
assert.match(auditSql, /mwms_v1/);
assert.match(auditSql, /individual/);
assert.match(auditSql, /single_test/);

const cleanupAuditSql = buildCleanupAuditSql();
assert.match(cleanupAuditSql, /d73c6390-e6fe-411a-a8f3-02c52bc60612/);
assert.match(cleanupAuditSql, /8aefc4f9-3ca6-48f2-a41e-0f6b75c5e0d1/);
assert.match(cleanupAuditSql, /mwms_v1/);

const failedCleanupAuditSql = buildFailedCleanupAuditSql();
assert.match(failedCleanupAuditSql, /5136bc05-153a-4356-8aa2-ee06dd67877a/);
assert.match(failedCleanupAuditSql, /e71d472a-13cb-4cc9-9582-6eaa262affca/);
assert.match(failedCleanupAuditSql, /ipip-neo-120-v1/);

async function main() {
  const toJsonValue = (value) => JSON.parse(JSON.stringify(value));
  let stdout = "";
  const dryRunArtifact = await generateAmraReplaySingleTestHrReports({
    env: {},
    stdout: {
      write(chunk) {
        stdout += chunk;
      },
    },
  });

  assert.equal(dryRunArtifact.status, "confirmation_required");
  assert.equal(dryRunArtifact.metadata.databaseWrites, false);
  assert.equal(dryRunArtifact.metadata.openAiCalled, false);
  assert.equal(dryRunArtifact.metadata.reportsGenerated, false);
  assert.equal(dryRunArtifact.metadata.originalAmraTouched, false);
  assert.deepEqual(JSON.parse(stdout), toJsonValue(dryRunArtifact));

  let missingStdout = "";
  const missingArtifact = await generateAmraReplaySingleTestHrReports({
    env: {
      [CONFIRM_ENV]: "true",
    },
    stdout: {
      write(chunk) {
        missingStdout += chunk;
      },
    },
  });

  assert.equal(missingArtifact.status, "confirmation_required");
  assert.equal(missingArtifact.metadata.databaseWrites, false);
  assert.equal(missingArtifact.blockers.includes("missing_target_env"), true);
  assert.deepEqual(JSON.parse(missingStdout), toJsonValue(missingArtifact));

  let providerBlockedStdout = "";
  const providerBlocked = await generateAmraReplaySingleTestHrReports({
    env: {
      [CONFIRM_ENV]: "true",
      [TARGET_REPLAY_PARTICIPANT_ID_ENV]: EXPECTED_TARGETS.participantId,
      [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_TARGETS.assessmentAssignmentId,
      [TARGET_TEST_SLUG_ENV]: "mwms_v1",
    },
    stdout: {
      write(chunk) {
        providerBlockedStdout += chunk;
      },
    },
  });

  assert.equal(providerBlocked.status, "blocked_provider_not_openai");
  assert.equal(providerBlocked.metadata.databaseWrites, false);
  assert.equal(providerBlocked.metadata.openAiCalled, false);
  assert.deepEqual(JSON.parse(providerBlockedStdout), toJsonValue(providerBlocked));

  let modelBlockedStdout = "";
  const modelBlocked = await generateAmraReplaySingleTestHrReports({
    env: {
      [CONFIRM_ENV]: "true",
      [TARGET_REPLAY_PARTICIPANT_ID_ENV]: EXPECTED_TARGETS.participantId,
      [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_TARGETS.assessmentAssignmentId,
      [TARGET_TEST_SLUG_ENV]: "mwms_v1",
      [AI_REPORT_PROVIDER_ENV]: EXPECTED_PROVIDER,
      [AI_REPORT_MODEL_ENV]: "gpt-4.1",
    },
    stdout: {
      write(chunk) {
        modelBlockedStdout += chunk;
      },
    },
  });

  assert.equal(modelBlocked.status, "blocked_model_not_gpt_5_5");
  assert.equal(modelBlocked.metadata.databaseWrites, false);
  assert.equal(modelBlocked.metadata.openAiCalled, false);
  assert.deepEqual(JSON.parse(modelBlockedStdout), toJsonValue(modelBlocked));

  let cleanupMissingStdout = "";
  const cleanupMissing = await generateAmraReplaySingleTestHrReports({
    env: {
      [CONFIRM_CLEANUP_ENV]: "true",
      [TARGET_REPLAY_PARTICIPANT_ID_ENV]: EXPECTED_TARGETS.participantId,
      [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_TARGETS.assessmentAssignmentId,
      [TARGET_TEST_SLUG_ENV]: "mwms_v1",
    },
    stdout: {
      write(chunk) {
        cleanupMissingStdout += chunk;
      },
    },
  });

  assert.equal(cleanupMissing.status, "confirmation_required");
  assert.equal(cleanupMissing.metadata.databaseWrites, false);
  assert.equal(cleanupMissing.blockers.includes("missing_target_env"), true);
  assert.deepEqual(JSON.parse(cleanupMissingStdout), toJsonValue(cleanupMissing));

  let failedCleanupMissingStdout = "";
  const failedCleanupMissing = await generateAmraReplaySingleTestHrReports({
    env: {
      [CONFIRM_FAILED_CLEANUP_ENV]: "true",
      [TARGET_REPLAY_PARTICIPANT_ID_ENV]: EXPECTED_TARGETS.participantId,
      [TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_TARGETS.assessmentAssignmentId,
      [TARGET_TEST_SLUG_ENV]: "ipip-neo-120-v1",
    },
    stdout: {
      write(chunk) {
        failedCleanupMissingStdout += chunk;
      },
    },
  });

  assert.equal(failedCleanupMissing.status, "confirmation_required");
  assert.equal(failedCleanupMissing.metadata.databaseWrites, false);
  assert.equal(failedCleanupMissing.blockers.includes("missing_target_env"), true);
  assert.deepEqual(JSON.parse(failedCleanupMissingStdout), toJsonValue(failedCleanupMissing));

  let ambiguousStdout = "";
  const ambiguous = await generateAmraReplaySingleTestHrReports({
    env: {
      [CONFIRM_CLEANUP_ENV]: "true",
      [CONFIRM_FAILED_CLEANUP_ENV]: "true",
    },
    stdout: {
      write(chunk) {
        ambiguousStdout += chunk;
      },
    },
  });
  assert.equal(ambiguous.status, "blocked_ambiguous_operator_mode");
  assert.equal(ambiguous.metadata.databaseWrites, false);
  assert.deepEqual(JSON.parse(ambiguousStdout), toJsonValue(ambiguous));

  console.log("test-generate-amra-replay-single-test-hr-reports: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
