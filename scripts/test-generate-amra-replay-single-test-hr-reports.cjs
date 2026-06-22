const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "scripts", "generate-amra-replay-single-test-hr-reports.cjs");
const scriptSource = fs.readFileSync(scriptPath, "utf8");

assert.match(scriptSource, /CONFIRM_AMRA_REPLAY_HR_REPORT_GENERATION/);
assert.match(scriptSource, /CONFIRM_AMRA_REPLAY_MOCK_REPORT_CLEANUP/);
assert.match(scriptSource, /TARGET_REPLAY_PARTICIPANT_ID/);
assert.match(scriptSource, /TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID/);
assert.match(scriptSource, /TARGET_TEST_SLUG/);
assert.match(scriptSource, /AI_REPORT_PROVIDER/);
assert.match(scriptSource, /AI_REPORT_MODEL/);
assert.match(scriptSource, /openai/);
assert.match(scriptSource, /gpt-5\.5/);
assert.match(scriptSource, /a5678fd5-8fea-4308-8569-5448f26b4f71/);
assert.match(scriptSource, /033f8975-5d9c-4c66-8842-f37527d556d5/);
assert.match(scriptSource, /5263eda0-2307-4267-b629-939cf79bde70/);
assert.match(scriptSource, /amra_replay_fixture_v1/);
assert.match(scriptSource, /recoverHrAttemptReport/);
assert.match(scriptSource, /claimNextReportJob/);
assert.match(scriptSource, /processClaimedReportJob/);
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
  EXPECTED_TARGETS,
  EXPECTED_MODEL,
  EXPECTED_PROVIDER,
  TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV,
  TARGET_REPLAY_PARTICIPANT_ID_ENV,
  TARGET_TEST_SLUG_ENV,
  TARGET_TESTS,
  buildCleanupAuditSql,
  buildConfirmationRequiredArtifact,
  buildProviderBlockedArtifact,
  buildReadOnlyAuditSql,
  generateAmraReplaySingleTestHrReports,
  validateConfirmedInputs,
  validateProviderInputs,
} = require(scriptPath);

assert.deepEqual(ALLOWED_TEST_SLUGS, ["mwms_v1", "safran_v1", "ipip-neo-120-v1"]);
assert.equal(TARGET_TESTS.mwms_v1.attemptId, "8aefc4f9-3ca6-48f2-a41e-0f6b75c5e0d1");
assert.equal(TARGET_TESTS.safran_v1.attemptId, "54702bc1-7d91-492e-9b50-14aff6706d34");
assert.equal(TARGET_TESTS["ipip-neo-120-v1"].attemptId, "e71d472a-13cb-4cc9-9582-6eaa262affca");
assert.equal(ACCIDENTAL_MOCK_REPORT.reportId, "5263eda0-2307-4267-b629-939cf79bde70");
assert.equal(ACCIDENTAL_MOCK_REPORT.attemptId, TARGET_TESTS.mwms_v1.attemptId);
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
assert.equal(missingProviderValidation.resolvedProvider, null);
assert.equal(missingProviderValidation.resolvedModel, null);

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

const providerBlockedArtifact = buildProviderBlockedArtifact(validValidation.inputs, wrongProviderValidation);
assert.equal(providerBlockedArtifact.status, "blocked_provider_not_openai");
assert.equal(providerBlockedArtifact.metadata.openAiRequired, true);
assert.equal(providerBlockedArtifact.metadata.resolvedProvider, "mock");

const modelBlockedArtifact = buildProviderBlockedArtifact(validValidation.inputs, wrongModelValidation);
assert.equal(modelBlockedArtifact.status, "blocked_model_not_gpt_5_5");
assert.equal(modelBlockedArtifact.metadata.resolvedProvider, EXPECTED_PROVIDER);
assert.equal(modelBlockedArtifact.metadata.resolvedModel, "gpt-4.1");

const auditSql = buildReadOnlyAuditSql({
  attemptId: TARGET_TESTS.mwms_v1.attemptId,
  testSlug: "mwms_v1",
});
assert.match(auditSql, /from public\.attempt_reports/);
assert.match(auditSql, /mwms_v1/);
assert.match(auditSql, /individual/);
assert.match(auditSql, /single_test/);

const cleanupAuditSql = buildCleanupAuditSql();
assert.match(cleanupAuditSql, /5263eda0-2307-4267-b629-939cf79bde70/);
assert.match(cleanupAuditSql, /8aefc4f9-3ca6-48f2-a41e-0f6b75c5e0d1/);
assert.match(cleanupAuditSql, /mwms_v1/);

async function main() {
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
  assert.deepEqual(JSON.parse(stdout), dryRunArtifact);

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
  assert.deepEqual(JSON.parse(missingStdout), missingArtifact);

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
  assert.deepEqual(JSON.parse(providerBlockedStdout), providerBlocked);

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
  assert.deepEqual(JSON.parse(modelBlockedStdout), modelBlocked);

  let cleanupMissingStdout = "";
  const cleanupMissing = await generateAmraReplaySingleTestHrReports({
    env: {
      [CONFIRM_CLEANUP_ENV]: "true",
    },
    stdout: {
      write(chunk) {
        cleanupMissingStdout += chunk;
      },
    },
  });

  assert.equal(cleanupMissing.status, "confirmation_required");
  assert.equal(cleanupMissing.metadata.databaseWrites, false);
  assert.deepEqual(JSON.parse(cleanupMissingStdout), cleanupMissing);

  console.log("test-generate-amra-replay-single-test-hr-reports: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
