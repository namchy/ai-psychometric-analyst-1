const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "scripts", "prepare-team-fit-clean-candidate-fixture.cjs");
const scriptSource = fs.readFileSync(scriptPath, "utf8");

assert.match(scriptSource, /CONFIRM_TEAM_FIT_CLEAN_CANDIDATE_FIXTURE_WRITE/);
assert.match(scriptSource, /TARGET_ORGANIZATION_ID/);
assert.match(scriptSource, /TARGET_PARTICIPANT_ID/);
assert.match(scriptSource, /TARGET_TEAM_AGGREGATION_SNAPSHOT_ID/);
assert.match(scriptSource, /d4508f7a-bc88-4870-8e90-d6487aa8ec3a/);
assert.match(scriptSource, /38a5d1e4-ee4e-4b1b-9bb3-050e1bfb93bf/);
assert.match(scriptSource, /01716095-a273-4eb0-a14c-5facd90a7532/);
assert.match(scriptSource, /buildCompositeHrInputSnapshot/);
assert.match(scriptSource, /persistCompletedAssessmentResults/);
assert.match(scriptSource, /buildAssignmentAttemptLinks/);
assert.match(scriptSource, /createStandardAssessmentAssignment/);
assert.match(scriptSource, /createAssignmentAttemptLinks/);
assert.match(scriptSource, /loadTeamDynamicsFinalAggregationVerification/);
assert.match(scriptSource, /required_for_team_fit:\s*true/);
assert.match(scriptSource, /databaseWrites:\s*false/);
assert.match(scriptSource, /openAiCalled:\s*false/);
assert.match(scriptSource, /teamFitProviderCalled:\s*false/);
assert.match(scriptSource, /teamFitReportGenerated:\s*false/);
assert.match(scriptSource, /teamFitReportsTouched:\s*false/);
assert.match(scriptSource, /teamDynamicsAggregationChanged:\s*false/);
assert.match(scriptSource, /workerOrSchedulerRun:\s*false/);
assert.match(scriptSource, /uiOrRendererChanged:\s*false/);
assert.match(scriptSource, /migrationOrSchemaChanged:\s*false/);
assert.match(scriptSource, /compositeHrRuntimeChanged:\s*false/);
assert.doesNotMatch(scriptSource, /from\("team_fit_reports"\)|from\('team_fit_reports'\)/);
assert.doesNotMatch(scriptSource, /team-fit-report-openai-provider/i);
assert.doesNotMatch(scriptSource, /team-fit-report-provider\.ts/i);
assert.doesNotMatch(scriptSource, /team-fit-report-processor/i);
assert.doesNotMatch(scriptSource, /manual-process|process-action/i);
assert.doesNotMatch(scriptSource, /team-fit-report-renderer|components\/dashboard/i);
assert.doesNotMatch(scriptSource, /supabase migration|db push|db reset|migration repair/i);

const {
  CONFIRM_ENV,
  EXPECTED_TARGETS,
  REQUIRED_TEST_SLUGS,
  TARGET_ORGANIZATION_ID_ENV,
  TARGET_PARTICIPANT_ID_ENV,
  TARGET_TEAM_AGGREGATION_SNAPSHOT_ID_ENV,
  buildConfirmationRequiredArtifact,
  prepareTeamFitCleanCandidateFixture,
  validateConfirmedTargetInputs,
} = require(scriptPath);

assert.deepEqual(REQUIRED_TEST_SLUGS, ["ipip-neo-120-v1", "safran_v1", "mwms_v1"]);

const defaultArtifact = buildConfirmationRequiredArtifact({});
assert.equal(defaultArtifact.status, "confirmation_required");
assert.equal(defaultArtifact.metadata.dryRun, true);
assert.equal(defaultArtifact.metadata.writeModeConfirmed, false);
assert.equal(defaultArtifact.metadata.databaseWrites, false);
assert.equal(defaultArtifact.metadata.openAiCalled, false);
assert.equal(defaultArtifact.metadata.teamFitProviderCalled, false);
assert.equal(defaultArtifact.metadata.teamFitReportGenerated, false);
assert.equal(defaultArtifact.metadata.teamFitReportsTouched, false);
assert.match(defaultArtifact.blockers[0], new RegExp(`${CONFIRM_ENV}=true`));

const missingTargetValidation = validateConfirmedTargetInputs({
  [CONFIRM_ENV]: "true",
});
assert.equal(missingTargetValidation.ok, false);
assert.deepEqual(missingTargetValidation.missing, [
  TARGET_ORGANIZATION_ID_ENV,
  TARGET_PARTICIPANT_ID_ENV,
  TARGET_TEAM_AGGREGATION_SNAPSHOT_ID_ENV,
]);

const mismatchValidation = validateConfirmedTargetInputs({
  [TARGET_ORGANIZATION_ID_ENV]: "wrong-org",
  [TARGET_PARTICIPANT_ID_ENV]: EXPECTED_TARGETS.participantId,
  [TARGET_TEAM_AGGREGATION_SNAPSHOT_ID_ENV]: EXPECTED_TARGETS.teamAggregationSnapshotId,
});
assert.equal(mismatchValidation.ok, false);
assert.equal(mismatchValidation.mismatches.length, 1);
assert.equal(mismatchValidation.mismatches[0].env, TARGET_ORGANIZATION_ID_ENV);

const validTargetValidation = validateConfirmedTargetInputs({
  [TARGET_ORGANIZATION_ID_ENV]: EXPECTED_TARGETS.organizationId,
  [TARGET_PARTICIPANT_ID_ENV]: EXPECTED_TARGETS.participantId,
  [TARGET_TEAM_AGGREGATION_SNAPSHOT_ID_ENV]: EXPECTED_TARGETS.teamAggregationSnapshotId,
});
assert.equal(validTargetValidation.ok, true);

async function main() {
  let stdout = "";
  const dryRunArtifact = await prepareTeamFitCleanCandidateFixture({
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
  assert.deepEqual(JSON.parse(stdout), dryRunArtifact);

  let missingStdout = "";
  const missingConfirmedArtifact = await prepareTeamFitCleanCandidateFixture({
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
  assert.equal(missingConfirmedArtifact.blockers.includes("missing_target_env"), true);
  assert.deepEqual(JSON.parse(missingStdout), missingConfirmedArtifact);

  console.log("test-prepare-team-fit-clean-candidate-fixture: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
