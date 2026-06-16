const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "scripts", "inspect-team-fit-db-sources.cjs");
const scriptSource = fs.readFileSync(scriptPath, "utf8");

assert.match(scriptSource, /CONFIRM_TEAM_FIT_DB_SOURCE_AUDIT/);
assert.match(scriptSource, /TEAM_FIT_REPORT_ID/);
assert.match(scriptSource, /TEAM_FIT_CANDIDATE_ASSESSMENT_ASSIGNMENT_ID/);
assert.match(scriptSource, /TEAM_FIT_TEAM_AGGREGATION_SNAPSHOT_ID/);
assert.match(scriptSource, /openAiCalled:\s*false/);
assert.match(scriptSource, /databaseWrites:\s*false/);
assert.match(scriptSource, /reportGenerated:\s*false/);
assert.match(scriptSource, /reportPersisted:\s*false/);
assert.match(scriptSource, /productionFlowChanged:\s*false/);
assert.match(scriptSource, /rawCandidateAnswersIncluded:\s*false/);
assert.match(scriptSource, /rawTeamMemberAnswersIncluded:\s*false/);
assert.match(scriptSource, /individualMemberScoresIncluded:\s*false/);
assert.match(scriptSource, /fullUpstreamSnapshotsIncluded:\s*false/);
assert.match(scriptSource, /candidateFacingTextIncluded:\s*false/);
assert.match(scriptSource, /numericFitScoreIncluded:\s*false/);
assert.match(scriptSource, /hireNoHireIncluded:\s*false/);
assert.doesNotMatch(scriptSource, /fetch\(/);
assert.doesNotMatch(scriptSource, /openai|OPENAI|OpenAI/);
assert.doesNotMatch(scriptSource, /team-fit-report-openai-provider/i);
assert.doesNotMatch(scriptSource, /team-fit-report-provider\.ts/i);
assert.doesNotMatch(scriptSource, /team-fit-report-processor/i);
assert.doesNotMatch(scriptSource, /manual-process|process-action/i);
assert.doesNotMatch(scriptSource, /team-fit-report-view|team-fit-report-renderer|components\/dashboard/i);
assert.doesNotMatch(scriptSource, /\.insert\s*\(/);
assert.doesNotMatch(scriptSource, /\.update\s*\(/);
assert.doesNotMatch(scriptSource, /\.upsert\s*\(/);
assert.doesNotMatch(scriptSource, /\.delete\s*\(/);
assert.doesNotMatch(scriptSource, /from\("attempt_reports"\)|from\("team_assessment_reports"\)/);

const {
  CONFIRM_ENV,
  appendCandidateSourceFindings,
  buildBaseArtifact,
  buildSkippedArtifact,
  buildTeamFitDbSourceAuditArtifact,
  runTeamFitDbSourceAudit,
} = require(scriptPath);

function assertAuditMetadata(artifact) {
  assert.equal(artifact.metadata.inspector, "team_fit_db_source_audit_v1");
  assert.equal(artifact.metadata.reportType, "team_fit_report_v1");
  assert.equal(artifact.metadata.readOnly, true);
  assert.equal(artifact.metadata.openAiCalled, false);
  assert.equal(artifact.metadata.databaseWrites, false);
  assert.equal(artifact.metadata.reportGenerated, false);
  assert.equal(artifact.metadata.reportPersisted, false);
  assert.equal(artifact.metadata.productionFlowChanged, false);
}

function assertPrivacyScan(artifact) {
  assert.equal(artifact.privacyAndSafetyScan.rawCandidateAnswersIncluded, false);
  assert.equal(artifact.privacyAndSafetyScan.rawTeamMemberAnswersIncluded, false);
  assert.equal(artifact.privacyAndSafetyScan.individualMemberScoresIncluded, false);
  assert.equal(artifact.privacyAndSafetyScan.fullUpstreamSnapshotsIncluded, false);
  assert.equal(artifact.privacyAndSafetyScan.candidateFacingTextIncluded, false);
  assert.equal(artifact.privacyAndSafetyScan.numericFitScoreIncluded, false);
  assert.equal(artifact.privacyAndSafetyScan.hireNoHireIncluded, false);
}

async function main() {
  const baseArtifact = buildBaseArtifact({
    teamFitReportId: "report-1",
    candidateAssessmentAssignmentId: "assignment-1",
    teamAggregationSnapshotId: "snapshot-1",
    teamId: "team-1",
    participantId: "participant-1",
  });

  assertAuditMetadata(baseArtifact);
  assertPrivacyScan(baseArtifact);
  assert.equal(baseArtifact.candidateSource.usesPersistedCompositeHrReport, false);
  assert.equal(baseArtifact.candidateSource.usesAiGeneratedCompositeNarrative, false);
  assert.equal(baseArtifact.candidateSource.usesAssignmentDerivedDeterministicCompositeInput, true);
  assert.equal(baseArtifact.teamSource.partialAggregationAllowed, false);
  assert.equal(baseArtifact.optionalSources.compositeHrReport.requiredDependency, false);
  assert.equal(baseArtifact.optionalSources.teamDynamicsExecutiveOverview.requiredTeamSource, false);
  assert.equal(baseArtifact.optionalSources.teamStyle.requiredMvpSource, false);
  assert.equal(baseArtifact.optionalSources.roleContext.requiredMvpSource, false);

  const staleCandidateArtifact = buildBaseArtifact({
    candidateAssessmentAssignmentId: "missing-assignment",
  });
  staleCandidateArtifact.candidateSource.status = "not_found";
  staleCandidateArtifact.candidateSource.blockers.push(
    "candidate_assessment_assignment_not_found",
  );
  appendCandidateSourceFindings(staleCandidateArtifact);
  assert.equal(staleCandidateArtifact.findings.length, 1);
  assert.deepEqual(staleCandidateArtifact.findings[0], {
    severity: "blocker",
    category: "candidate_source",
    message: "Candidate source could not be resolved.",
    reason: "candidate_assessment_assignment_not_found",
  });

  const skippedArtifact = buildSkippedArtifact({}, "confirmation missing");
  assertAuditMetadata(skippedArtifact);
  assertPrivacyScan(skippedArtifact);
  assert.equal(skippedArtifact.skipped, true);
  assert.equal(skippedArtifact.reason, "confirmation missing");

  const defaultArtifact = await buildTeamFitDbSourceAuditArtifact({
    env: {},
  });
  assertAuditMetadata(defaultArtifact);
  assertPrivacyScan(defaultArtifact);
  assert.equal(defaultArtifact.skipped, true);
  assert.match(defaultArtifact.reason, new RegExp(`${CONFIRM_ENV}=true`));

  const confirmNoIdsArtifact = await buildTeamFitDbSourceAuditArtifact({
    env: {
      [CONFIRM_ENV]: "true",
    },
  });
  assertAuditMetadata(confirmNoIdsArtifact);
  assertPrivacyScan(confirmNoIdsArtifact);
  assert.equal(confirmNoIdsArtifact.skipped, true);
  assert.match(confirmNoIdsArtifact.reason, /Provide TEAM_FIT_REPORT_ID/);

  let stdout = "";
  const runArtifact = await runTeamFitDbSourceAudit({
    env: {},
    stdout: {
      write(chunk) {
        stdout += chunk;
      },
    },
  });
  assert.deepEqual(JSON.parse(stdout), runArtifact);
  assert.equal(runArtifact.skipped, true);

  console.log("test-inspect-team-fit-db-sources: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
