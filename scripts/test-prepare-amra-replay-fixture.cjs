const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "scripts", "prepare-amra-replay-fixture.cjs");
const scriptSource = fs.readFileSync(scriptPath, "utf8");

assert.match(scriptSource, /CONFIRM_AMRA_REPLAY_FIXTURE_WRITE/);
assert.match(scriptSource, /SOURCE_PARTICIPANT_ID/);
assert.match(scriptSource, /SOURCE_ASSESSMENT_ASSIGNMENT_ID/);
assert.match(scriptSource, /TARGET_ORGANIZATION_ID/);
assert.match(scriptSource, /TARGET_REPLAY_EMAIL/);
assert.match(scriptSource, /TARGET_REPLAY_FULL_NAME/);
assert.match(scriptSource, /9b742094-53dc-4de5-87a5-174c5491e4dd/);
assert.match(scriptSource, /16943547-ef84-4fc4-a3d2-11801b1f1869/);
assert.match(scriptSource, /5d93f3a1-3765-4ec4-b668-c0d1228a8445/);
assert.match(scriptSource, /amra\.new1@example\.test/);
assert.match(scriptSource, /Amra Replay Fixture 1/);
assert.match(scriptSource, /ipip-neo-120-v1/);
assert.match(scriptSource, /safran_v1/);
assert.match(scriptSource, /mwms_v1/);
assert.match(scriptSource, /persistCompletedAssessmentResults/);
assert.match(scriptSource, /buildAssignmentAttemptLinks/);
assert.match(scriptSource, /createStandardAssessmentAssignment/);
assert.match(scriptSource, /createAssignmentAttemptLinks/);
assert.match(scriptSource, /response_selections/);
assert.match(scriptSource, /selection_role/);
assert.match(scriptSource, /question_id/);
assert.match(scriptSource, /answer_option_id/);
assert.match(scriptSource, /text_value/);
assert.match(scriptSource, /databaseWrites:\s*false/);
assert.match(scriptSource, /openAiCalled:\s*false/);
assert.match(scriptSource, /reportsGenerated:\s*false/);
assert.match(scriptSource, /oldReportsCopied:\s*false/);
assert.match(scriptSource, /oldInputSnapshotsCopied:\s*false/);
assert.match(scriptSource, /oldReportSnapshotsCopied:\s*false/);
assert.match(scriptSource, /originalParticipantTouched:\s*false/);
assert.match(scriptSource, /workerOrSchedulerRun:\s*false/);
assert.match(scriptSource, /uiOrRendererChanged:\s*false/);
assert.match(scriptSource, /migrationOrSchemaChanged:\s*false/);
assert.match(scriptSource, /supabaseRepairOrDbPushOrReset:\s*false/);
assert.match(scriptSource, /blocked_no_safe_raw_response_clone_path/);
assert.match(scriptSource, /assessment_assignments/);
assert.match(scriptSource, /assessment_assignment_attempts/);
assert.doesNotMatch(scriptSource, /\.from\("attempt_reports"\)|\.from\('attempt_reports'\)/);
assert.doesNotMatch(scriptSource, /\.from\("assessment_reports"\)|\.from\('assessment_reports'\)/);
assert.doesNotMatch(scriptSource, /\.from\("team_fit_reports"\)|\.from\('team_fit_reports'\)/);
assert.doesNotMatch(scriptSource, /input_snapshot\s*:/);
assert.doesNotMatch(scriptSource, /report_snapshot\s*:/);
assert.doesNotMatch(scriptSource, /OPENAI_API_KEY|openai\/resources|team-fit-report-openai|composite-hr-openai/i);
assert.doesNotMatch(scriptSource, /process-assessment-report-jobs|report-worker|scheduler\.ts|worker\.ts/i);
assert.doesNotMatch(scriptSource, /supabase migration|db push|db reset|migration repair/i);
assert.doesNotMatch(scriptSource, /components\/|renderer\.tsx|renderer\.ts|app\/\(protected\)/i);

const {
  CONFIRM_ENV,
  EXPECTED_INPUTS,
  REQUIRED_TEST_SLUGS,
  SOURCE_ASSESSMENT_ASSIGNMENT_ID_ENV,
  SOURCE_PARTICIPANT_ID_ENV,
  TARGET_ORGANIZATION_ID_ENV,
  TARGET_REPLAY_EMAIL_ENV,
  TARGET_REPLAY_FULL_NAME_ENV,
  buildConfirmationRequiredArtifact,
  buildReadOnlyAuditSql,
  prepareAmraReplayFixture,
  validateConfirmedInputs,
} = require(scriptPath);

assert.deepEqual(REQUIRED_TEST_SLUGS, ["ipip-neo-120-v1", "safran_v1", "mwms_v1"]);

const defaultArtifact = buildConfirmationRequiredArtifact({});
assert.equal(defaultArtifact.status, "confirmation_required");
assert.equal(defaultArtifact.metadata.dryRun, true);
assert.equal(defaultArtifact.metadata.writeModeConfirmed, false);
assert.equal(defaultArtifact.metadata.databaseWrites, false);
assert.equal(defaultArtifact.metadata.openAiCalled, false);
assert.equal(defaultArtifact.metadata.reportsGenerated, false);
assert.equal(defaultArtifact.metadata.originalParticipantTouched, false);
assert.equal(defaultArtifact.metadata.oldReportsCopied, false);
assert.match(defaultArtifact.blockers[0], new RegExp(`${CONFIRM_ENV}=true`));

const missingValidation = validateConfirmedInputs({
  [CONFIRM_ENV]: "true",
});
assert.equal(missingValidation.ok, false);
assert.deepEqual(missingValidation.missing, [
  SOURCE_PARTICIPANT_ID_ENV,
  SOURCE_ASSESSMENT_ASSIGNMENT_ID_ENV,
  TARGET_ORGANIZATION_ID_ENV,
  TARGET_REPLAY_EMAIL_ENV,
  TARGET_REPLAY_FULL_NAME_ENV,
]);

const mismatchValidation = validateConfirmedInputs({
  [SOURCE_PARTICIPANT_ID_ENV]: "wrong-source",
  [SOURCE_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_INPUTS.sourceAssessmentAssignmentId,
  [TARGET_ORGANIZATION_ID_ENV]: EXPECTED_INPUTS.targetOrganizationId,
  [TARGET_REPLAY_EMAIL_ENV]: EXPECTED_INPUTS.targetReplayEmail,
  [TARGET_REPLAY_FULL_NAME_ENV]: EXPECTED_INPUTS.targetReplayFullName,
});
assert.equal(mismatchValidation.ok, false);
assert.equal(mismatchValidation.mismatches.length, 1);
assert.equal(mismatchValidation.mismatches[0].env, SOURCE_PARTICIPANT_ID_ENV);

const validValidation = validateConfirmedInputs({
  [SOURCE_PARTICIPANT_ID_ENV]: EXPECTED_INPUTS.sourceParticipantId,
  [SOURCE_ASSESSMENT_ASSIGNMENT_ID_ENV]: EXPECTED_INPUTS.sourceAssessmentAssignmentId,
  [TARGET_ORGANIZATION_ID_ENV]: EXPECTED_INPUTS.targetOrganizationId,
  [TARGET_REPLAY_EMAIL_ENV]: EXPECTED_INPUTS.targetReplayEmail,
  [TARGET_REPLAY_FULL_NAME_ENV]: EXPECTED_INPUTS.targetReplayFullName,
});
assert.equal(validValidation.ok, true);

const auditSql = buildReadOnlyAuditSql(EXPECTED_INPUTS);
assert.match(auditSql, /select/i);
assert.match(auditSql, /public\.participants/);
assert.match(auditSql, /public\.assessment_assignments/);
assert.match(auditSql, /public\.responses/);
assert.match(auditSql, /public\.dimension_scores/);
assert.match(auditSql, /amra_replay_fixture_v1/);
assert.match(auditSql, /amra\.new1@example\.test/);

async function main() {
  let stdout = "";
  const dryRunArtifact = await prepareAmraReplayFixture({
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
  assert.equal(dryRunArtifact.metadata.oldReportsCopied, false);
  assert.equal(dryRunArtifact.metadata.originalParticipantTouched, false);
  assert.deepEqual(JSON.parse(stdout), dryRunArtifact);

  let missingStdout = "";
  const missingConfirmedArtifact = await prepareAmraReplayFixture({
    env: {
      [CONFIRM_ENV]: "true",
    },
    stdout: {
      write(chunk) {
        missingStdout += chunk;
      },
    },
  });

  assert.equal(missingConfirmedArtifact.status, "confirmation_required");
  assert.equal(missingConfirmedArtifact.metadata.databaseWrites, false);
  assert.equal(missingConfirmedArtifact.blockers.includes("missing_required_env"), true);
  assert.deepEqual(JSON.parse(missingStdout), missingConfirmedArtifact);

  console.log("test-prepare-amra-replay-fixture: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
