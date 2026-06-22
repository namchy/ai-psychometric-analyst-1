const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "scripts", "generate-amra-replay-single-test-hr-reports.cjs");
const scriptSource = fs.readFileSync(scriptPath, "utf8");

assert.match(scriptSource, /CONFIRM_AMRA_REPLAY_HR_REPORT_GENERATION/);
assert.match(scriptSource, /TARGET_REPLAY_PARTICIPANT_ID/);
assert.match(scriptSource, /TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID/);
assert.match(scriptSource, /TARGET_TEST_SLUG/);
assert.match(scriptSource, /a5678fd5-8fea-4308-8569-5448f26b4f71/);
assert.match(scriptSource, /033f8975-5d9c-4c66-8842-f37527d556d5/);
assert.match(scriptSource, /amra_replay_fixture_v1/);
assert.match(scriptSource, /recoverHrAttemptReport/);
assert.match(scriptSource, /claimNextReportJob/);
assert.match(scriptSource, /processClaimedReportJob/);
assert.match(scriptSource, /databaseWrites:\s*false/);
assert.match(scriptSource, /openAiCalled:\s*false/);
assert.match(scriptSource, /reportsGenerated:\s*false/);
assert.match(scriptSource, /originalAmraTouched:\s*false/);
assert.match(scriptSource, /compositeHrTouched:\s*false/);
assert.match(scriptSource, /teamFitTouched:\s*false/);
assert.match(scriptSource, /teamDynamicsTouched:\s*false/);
assert.match(scriptSource, /workerOrSchedulerRun:\s*false/);
assert.match(scriptSource, /blocked_existing_hr_report_present/);
assert.doesNotMatch(scriptSource, /\.from\("assessment_reports"\)|\.from\('assessment_reports'\)/);
assert.doesNotMatch(scriptSource, /\.from\("team_fit_reports"\)|\.from\('team_fit_reports'\)/);
assert.doesNotMatch(scriptSource, /createQueuedCompositeAssessmentReport|processClaimedAssessmentReportJob|buildCompositeHrInputSnapshot/);
assert.doesNotMatch(scriptSource, /supabase migration|db push|db reset|migration repair/i);
assert.doesNotMatch(scriptSource, /components\/|renderer\.tsx|renderer\.ts|app\/\(protected\)/i);

const {
  ALLOWED_TEST_SLUGS,
  CONFIRM_ENV,
  EXPECTED_TARGETS,
  TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID_ENV,
  TARGET_REPLAY_PARTICIPANT_ID_ENV,
  TARGET_TEST_SLUG_ENV,
  TARGET_TESTS,
  buildConfirmationRequiredArtifact,
  buildReadOnlyAuditSql,
  generateAmraReplaySingleTestHrReports,
  validateConfirmedInputs,
} = require(scriptPath);

assert.deepEqual(ALLOWED_TEST_SLUGS, ["mwms_v1", "safran_v1", "ipip-neo-120-v1"]);
assert.equal(TARGET_TESTS.mwms_v1.attemptId, "8aefc4f9-3ca6-48f2-a41e-0f6b75c5e0d1");
assert.equal(TARGET_TESTS.safran_v1.attemptId, "54702bc1-7d91-492e-9b50-14aff6706d34");
assert.equal(TARGET_TESTS["ipip-neo-120-v1"].attemptId, "e71d472a-13cb-4cc9-9582-6eaa262affca");

const defaultArtifact = buildConfirmationRequiredArtifact({});
assert.equal(defaultArtifact.status, "confirmation_required");
assert.equal(defaultArtifact.metadata.dryRun, true);
assert.equal(defaultArtifact.metadata.databaseWrites, false);
assert.equal(defaultArtifact.metadata.openAiCalled, false);
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

const auditSql = buildReadOnlyAuditSql({
  attemptId: TARGET_TESTS.mwms_v1.attemptId,
  testSlug: "mwms_v1",
});
assert.match(auditSql, /from public\.attempt_reports/);
assert.match(auditSql, /mwms_v1/);
assert.match(auditSql, /individual/);
assert.match(auditSql, /single_test/);

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

  console.log("test-generate-amra-replay-single-test-hr-reports: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
