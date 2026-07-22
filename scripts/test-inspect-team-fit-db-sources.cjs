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
assert.match(scriptSource, /createFetchDiagnostic/);
assert.match(scriptSource, /serializeFetchError/);
assert.match(scriptSource, /candidate_assignment_read/);
assert.match(scriptSource, /team_aggregation_read/);
assert.match(scriptSource, /team_source_read/);
assert.match(scriptSource, /rawCandidateAnswersIncluded:\s*false/);
assert.match(scriptSource, /rawTeamMemberAnswersIncluded:\s*false/);
assert.match(scriptSource, /individualMemberScoresIncluded:\s*false/);
assert.match(scriptSource, /fullUpstreamSnapshotsIncluded:\s*false/);
assert.match(scriptSource, /candidateFacingTextIncluded:\s*false/);
assert.match(scriptSource, /numericFitScoreIncluded:\s*false/);
assert.match(scriptSource, /hireNoHireIncluded:\s*false/);
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
  createFetchDiagnostic,
  runTeamFitDbSourceAudit,
  serializeFetchError,
  writeDiagnosticArtifact,
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
  let successFetchCalls = 0;
  const successDiagnostic = createFetchDiagnostic({
    fetchImpl: async () => {
      successFetchCalls += 1;
      return new Response("{}", { status: 200 });
    },
  });
  successDiagnostic.install();
  try {
    const response = await fetch(
      "https://example.supabase.co/rest/v1/organizations?select=id",
      { method: "GET", headers: { Authorization: "Bearer should-not-be-recorded" } },
    );
    assert.equal(response.status, 200);
  } finally {
    successDiagnostic.restore();
  }
  assert.equal(successFetchCalls, 1);
  const successRequest = successDiagnostic.getRequests()[0];
  assert.equal(successRequest.ordinal, 1);
  assert.equal(successRequest.method, "GET");
  assert.equal(successRequest.hostname, "example.supabase.co");
  assert.equal(successRequest.pathname, "/rest/v1/organizations");
  assert.equal(successRequest.status, 200);
  assert.equal(successRequest.ok, true);
  assert.equal(typeof successRequest.startedAt, "string");
  assert.equal(typeof successRequest.durationMs, "number");
  assert.equal(successRequest.failure, null);
  assert.deepEqual(Object.keys(successRequest).sort(), [
    "durationMs",
    "failure",
    "hostname",
    "method",
    "ok",
    "ordinal",
    "pathname",
    "startedAt",
    "status",
  ]);
  assert.equal(JSON.stringify(successRequest).includes("select=id"), false);
  assert.equal(JSON.stringify(successRequest).includes("Authorization"), false);

  const resetCause = Object.assign(new Error("read ECONNRESET"), {
    code: "ECONNRESET",
    errno: -104,
    syscall: "read",
  });
  const resetError = Object.assign(new TypeError("fetch failed"), { cause: resetCause });
  let resetFetchCalls = 0;
  const resetDiagnostic = createFetchDiagnostic({
    fetchImpl: async () => {
      resetFetchCalls += 1;
      throw resetError;
    },
  });
  resetDiagnostic.install();
  try {
    await assert.rejects(() => fetch("https://example.supabase.co/rest/v1/organizations"));
  } finally {
    resetDiagnostic.restore();
  }
  assert.equal(resetFetchCalls, 1);
  const resetFailure = resetDiagnostic.getRequests()[0].failure;
  assert.equal(resetFailure.name, "TypeError");
  assert.equal(resetFailure.message, "fetch failed");
  assert.equal(resetFailure.cause.message, "read ECONNRESET");
  assert.equal(resetFailure.cause.code, "ECONNRESET");
  assert.equal(resetFailure.cause.errno, -104);
  assert.equal(resetFailure.cause.syscall, "read");

  const dnsCause = Object.assign(new Error("temporary DNS failure"), {
    code: "EAI_AGAIN",
    hostname: "example.supabase.co",
  });
  const dnsError = Object.assign(new TypeError("fetch failed"), { cause: dnsCause });
  const dnsDiagnostic = createFetchDiagnostic({
    fetchImpl: async () => {
      throw dnsError;
    },
  });
  dnsDiagnostic.install();
  try {
    await assert.rejects(() => fetch("https://example.supabase.co/rest/v1/organizations"));
  } finally {
    dnsDiagnostic.restore();
  }
  assert.equal(dnsDiagnostic.getRequests()[0].failure.cause.code, "EAI_AGAIN");
  assert.equal(dnsDiagnostic.getRequests()[0].failure.cause.hostname, "example.supabase.co");

  const circularError = new TypeError("fetch failed");
  circularError.cause = circularError;
  const circular = serializeFetchError(circularError);
  assert.equal(circular.cause.name, "CircularCause");
  assert.equal(circular.cause.message, "circular fetch error cause omitted");

  let deep = new Error("deepest");
  for (let index = 0; index < 8; index += 1) {
    deep = Object.assign(new Error(`level-${index}`), { cause: deep });
  }
  const serializedDeep = serializeFetchError(deep);
  let depth = 0;
  let cursor = serializedDeep;
  while (cursor) {
    depth += 1;
    cursor = cursor.cause;
  }
  assert.equal(depth, 6);
  assert.equal(
    serializedDeep.cause.cause.cause.cause.cause.message,
    "fetch error cause chain truncated",
  );

  const secretError = new Error(
    "Authorization: secret Bearer token apikey=secret service_role=secret OPENAI_API_KEY=secret request body: secret response body: secret",
  );
  const serializedSecret = JSON.stringify(serializeFetchError(secretError));
  assert.doesNotMatch(
    serializedSecret,
    /Authorization|Bearer|apikey|service_role|OPENAI_API_KEY|request body|response body/i,
  );

  const writes = [];
  writeDiagnosticArtifact(
    {
      writeFileSync(filePath, content, options) {
        writes.push({ filePath, content, options });
      },
      chmodSync(filePath, mode) {
        writes.push({ filePath, mode });
      },
    },
    "/tmp/source-audit-test.json",
    { metadata: { readOnly: true } },
  );
  assert.equal(writes[0].options.mode, 0o600);
  assert.equal(writes[1].mode, 0o600);

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
