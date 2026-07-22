const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") return emptyModulePath;
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      path.join(projectRoot, request.slice(2)),
      parent,
      isMain,
      options,
    );
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  buildGdt01ScoringPlan,
  classifyGdt01MemberScoringState,
  executeGdt01ScoringApply,
  loadGdt01ExpectedMemberScores,
  parseGdt01MemberScoringCli,
  previewGdt01MemberScores,
} = require("../lib/golden-demo/team-dynamics-gdt-01-scoring-operator.ts");
const { GDT_01_COUNTS, GDT_01_EXPECTED_MEMBER_IDS } = require("../lib/golden-demo/team-dynamics-gdt-01-db-contract.ts");

const expectedScores = loadGdt01ExpectedMemberScores(projectRoot);

function context(candidateId, wrapperStatus = "invited", attemptStatus = "in_progress") {
  return {
    teamAssessmentParticipantId: `w-${candidateId}`,
    teamAssessmentAssignmentId: "assignment-1",
    teamMembershipId: `membership-${candidateId}`,
    participantId: `participant-${candidateId}`,
    attemptId: `attempt-${candidateId}`,
    teamId: "team-1",
    organizationId: "org-1",
    packageSlug: "team_dynamics_assessment_v1",
    wrapperStatus,
    attemptStatus,
    locale: "bs",
    test: {
      id: "test-1",
      slug: "team_dynamics_assessment_v1",
      name: "Team Dynamics",
      status: "active",
      isActive: true,
    },
  };
}

function inspection(state, blockingFindings = []) {
  return {
    target: {
      organization: "Partner Plus d.o.o., Mikrokreditna organizacija",
      teamId: "GDT-01",
      packageSlug: "team_dynamics_assessment_v1",
      runtimeChecksum: "375a97663ed825ff2f8c09f3716d6a39bbea2722d5b45f4a61d60d2be210f48d",
    },
    state,
    writerEligible: state === "EMPTY",
    counts: {
      membersExpected: 6,
      wrappersObserved: 6,
      attemptsObserved: 6,
      responsesExpected: 288,
      responsesObserved: 288,
      physicalSjtSelectionsExpected: 72,
      physicalSjtSelectionsObserved: 72,
      logicalSelectionsExpected: 324,
      logicalSelectionsObserved: 324,
    },
    blockingFindings,
    diagnosticFindings: [],
    safety: {
      readOnly: true,
      databaseWrites: false,
      rpcCalls: false,
      scoringExecuted: false,
      aggregationExecuted: false,
      reportsGenerated: false,
      openaiCalled: false,
    },
  };
}

function observed(scored = false) {
  return {
    organizations: [{ id: "org-1", name: "Partner Plus d.o.o., Mikrokreditna organizacija", slug: "partner-plus", status: "active" }],
    teams: [{ id: "team-1", organizationId: "org-1", name: "Kreditno poslovanje i rad s klijentima", archivedAt: null }],
    participants: GDT_01_EXPECTED_MEMBER_IDS.map((candidateId) => ({ id: `participant-${candidateId}`, organizationId: "org-1", email: `${candidateId.toLowerCase()}@example.test`, fullName: candidateId, participantType: "candidate", status: "active" })),
    memberships: GDT_01_EXPECTED_MEMBER_IDS.map((candidateId) => ({ id: `membership-${candidateId}`, teamId: "team-1", participantId: `participant-${candidateId}`, isActive: true, leftAt: null })),
    runtime: { test: { id: "test-1", slug: "team_dynamics_assessment_v1", status: "active", isActive: true, scoringMethod: "mixed_v1", metadata: {} }, questions: [], options: [], snapshot: null, snapshotErrors: [] },
    assignments: [{ id: "assignment-1", teamId: "team-1", packageSlug: "team_dynamics_assessment_v1", status: "active" }],
    ambientAssignments: [],
    wrappers: GDT_01_EXPECTED_MEMBER_IDS.map((candidateId) => ({ id: `w-${candidateId}`, assignmentId: "assignment-1", membershipId: `membership-${candidateId}`, participantId: `participant-${candidateId}`, attemptId: `attempt-${candidateId}`, status: scored ? "completed" : "invited", startedAt: scored ? "2026-07-22T10:00:00.000Z" : null, completedAt: scored ? "2026-07-22T10:01:00.000Z" : null })),
    attempts: GDT_01_EXPECTED_MEMBER_IDS.map((candidateId) => ({ id: `attempt-${candidateId}`, testId: "test-1", testSlug: "team_dynamics_assessment_v1", organizationId: "org-1", participantId: `participant-${candidateId}`, userId: null, locale: "bs", status: scored ? "completed" : "in_progress", completedAt: scored ? "2026-07-22T10:01:00.000Z" : null })),
    responses: Array.from({ length: 288 }, () => ({ id: "response", attemptId: "attempt-GD-001", questionId: "question", questionCode: "TDM31_01", responseKind: "single_choice", answerOptionId: "option", optionCode: "option", optionValue: 3, optionQuestionId: "question", rawValue: null, scoredValue: null })),
    selections: Array.from({ length: 72 }, () => ({ id: "selection", responseId: "response", questionId: "question", questionCode: "TDM31_01", answerOptionId: "option", optionCode: "option", optionQuestionId: "question", selectionRole: "best" })),
    dimensionScoreIds: [],
    memberScoreIds: [],
    aggregationIds: [],
    reportSelectionDraftIds: [],
    reportSelectionMemberIds: [],
    teamReportIds: [],
    attemptReportIds: [],
    teamFitReports: [],
  };
}

function snapshot(scored = false, scoreRows = [], findingRows = []) {
  return {
    inspection: inspection(scored ? "CONFLICT" : "EXACT_MATCH", findingRows),
    observed: observed(scored),
    members: GDT_01_EXPECTED_MEMBER_IDS.map((candidateId) => ({
      candidateId,
      participantId: `participant-${candidateId}`,
      wrapperId: `w-${candidateId}`,
      attemptId: `attempt-${candidateId}`,
      context: context(candidateId, scored ? "completed" : "invited", scored ? "completed" : "in_progress"),
    })),
    scoreRows,
    attemptLifecycle: GDT_01_EXPECTED_MEMBER_IDS.map((candidateId) => ({
      id: `attempt-${candidateId}`,
      status: scored ? "completed" : "in_progress",
      completed_at: scored ? "2026-07-22T10:01:00.000Z" : null,
      scored_started_at: null,
    })),
  };
}

function previews(exact = true) {
  return GDT_01_EXPECTED_MEMBER_IDS.map((candidateId, index) => ({
    candidateId,
    status: exact ? "scored" : index === 0 ? "not_ready" : "scored",
    score: exact ? expectedScores[index].score : null,
    expectedMatch: exact,
    errors: exact ? [] : index === 0 ? ["Production scorer returned not_ready for GD-001."] : [],
  }));
}

const unscoredSnapshot = snapshot();
const unscoredClassification = classifyGdt01MemberScoringState({
  snapshot: unscoredSnapshot,
  expectedScores,
  previews: previews(),
});
assert.equal(unscoredClassification.state, "UNSCORED_EXACT");
assert.equal(buildGdt01ScoringPlan({ classification: unscoredClassification, mode: "apply" }).applyAllowed, true);

const scoredRows = GDT_01_EXPECTED_MEMBER_IDS.map((candidateId, index) => ({
  id: `score-${candidateId}`,
  team_assessment_participant_id: `w-${candidateId}`,
  attempt_id: `attempt-${candidateId}`,
  scoring_version: "team_dynamics_assessment_v1_mixed_v1",
  scoring_status: "scored",
  raw_total: null,
  mean_raw: null,
  score_0_100: null,
  score_snapshot: expectedScores[index].score,
  source_response_count: 48,
  source_completed_at: "2026-07-22T10:01:00.000Z",
  calculated_at: "2026-07-22T10:01:01.000Z",
}));
const reorderKeys = (value) => {
  if (Array.isArray(value)) return value.map(reorderKeys);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).reverse().map((key) => [key, reorderKeys(value[key])]));
  return value;
};
const reorderedScoreRows = scoredRows.map((row) => ({ ...row, score_snapshot: reorderKeys(row.score_snapshot) }));

function resumableSnapshot(existingRows) {
  const resumable = snapshot(false, existingRows, [
    { code: "wrapper_lifecycle_mismatch", message: "GD-001 is already completed" },
    { code: "attempt_lifecycle_mismatch", message: "GD-001 is already completed" },
    { code: "seed_score_artifact", message: "GD-001 score exists" },
  ]);
  resumable.inspection.state = "CONFLICT";
  resumable.observed.wrappers = resumable.observed.wrappers.map((row) => row.participantId === "participant-GD-001"
    ? { ...row, status: "completed", startedAt: "2026-07-22T10:00:00.000Z", completedAt: "2026-07-22T10:01:00.000Z" }
    : row);
  resumable.observed.attempts = resumable.observed.attempts.map((row) => row.participantId === "participant-GD-001"
    ? { ...row, status: "completed", completedAt: "2026-07-22T10:01:00.000Z" }
    : row);
  resumable.members = resumable.members.map((member) => member.candidateId === "GD-001"
    ? { ...member, context: context("GD-001", "completed", "completed") }
    : member);
  resumable.attemptLifecycle = resumable.attemptLifecycle.map((row) => row.id === "attempt-GD-001"
    ? { ...row, status: "completed", completed_at: "2026-07-22T10:01:00.000Z" }
    : row);
  return resumable;
}

const resumableState = resumableSnapshot([reorderedScoreRows[0]]);
const resumableClassification = classifyGdt01MemberScoringState({
  snapshot: resumableState,
  expectedScores,
  previews: previews(),
});
assert.equal(resumableClassification.state, "PARTIAL_EXACT_RESUMABLE");
assert.deepEqual(resumableClassification.existingExactMemberIds, ["GD-001"]);
assert.deepEqual(resumableClassification.resumableMemberIds, ["GD-002", "GD-003", "GD-004", "GD-005", "GD-019"]);
const resumablePlan = buildGdt01ScoringPlan({ classification: resumableClassification, mode: "apply" });
assert.equal(resumablePlan.applyAllowed, true);
assert.deepEqual(resumablePlan.targetMemberIds, ["GD-002", "GD-003", "GD-004", "GD-005", "GD-019"]);
assert.deepEqual(resumablePlan.skipMemberIds, ["GD-001"]);
const resumableReadOnlyPlan = buildGdt01ScoringPlan({ classification: resumableClassification, mode: "read-only" });
assert.equal(resumableReadOnlyPlan.applyAllowed, false);
assert.deepEqual(resumableReadOnlyPlan.targetMemberIds, ["GD-002", "GD-003", "GD-004", "GD-005", "GD-019"]);

const scoredClassification = classifyGdt01MemberScoringState({
  snapshot: snapshot(true, reorderedScoreRows, [
    ...GDT_01_EXPECTED_MEMBER_IDS.map(() => ({ code: "wrapper_lifecycle_mismatch", message: "expected scored lifecycle" })),
    ...GDT_01_EXPECTED_MEMBER_IDS.map(() => ({ code: "attempt_lifecycle_mismatch", message: "expected scored lifecycle" })),
    { code: "seed_score_artifact", message: "expected member score rows" },
  ]),
  expectedScores,
});
assert.equal(scoredClassification.state, "SCORED_EXACT");
assert.equal(scoredClassification.memberScoreVerification.membersVerified, 6);
  assert.equal(scoredClassification.memberScoreVerification.scoreEntriesVerified, 48);
assert.equal(buildGdt01ScoringPlan({ classification: scoredClassification, mode: "apply" }).noOpEligible, true);

(async () => {
  let scorerCalls = 0;
  const previewResult = await previewGdt01MemberScores({
    snapshot: unscoredSnapshot,
    expectedScores,
      scoreMember: async ({ context: memberContext }) => {
        scorerCalls += 1;
        assert.equal(memberContext.wrapperStatus, "completed");
        assert.equal(memberContext.attemptStatus, "completed");
      const candidateId = memberContext.teamAssessmentParticipantId.slice(2);
      return expectedScores.find((member) => member.candidate_id === candidateId)?.score ?? expectedScores[0].score;
      },
  });
  assert.equal(scorerCalls, 6, "production scorer must be called once per member preview");
  assert.equal(previewResult.every((result) => result.expectedMatch), true);

  let markCalls = 0;
  let transitionCalls = 0;
  let persistCalls = 0;
  const applyResult = await executeGdt01ScoringApply({
    snapshot: unscoredSnapshot,
    classification: unscoredClassification,
    expectedScores,
    mode: "apply",
    deps: {
      markStarted: async ({ teamAssessmentParticipantId }) => {
        markCalls += 1;
        assert.match(teamAssessmentParticipantId, /^w-GD-/);
        return { status: "started", startedAt: "now", transitioned: true };
      },
      transitionCompleted: async ({ context: memberContext }) => {
        transitionCalls += 1;
        assert.equal(memberContext.wrapperStatus, "started");
        assert.equal(memberContext.attemptStatus, "in_progress");
        return { ok: true, mode: "completed", wrapperStatus: "completed", attemptStatus: "completed", completedAt: "now" };
      },
      persistMemberScore: async ({ context: memberContext }) => {
        persistCalls += 1;
        const candidateId = memberContext.teamAssessmentParticipantId.slice(2);
        const expected = expectedScores.find((member) => member.candidate_id === candidateId);
        return { ok: true, mode: "inserted", value: { id: `score-${memberContext.participantId}`, teamAssessmentParticipantId: memberContext.teamAssessmentParticipantId, attemptId: memberContext.attemptId, scoringVersion: "team_dynamics_assessment_v1_mixed_v1", scoringStatus: "scored", calculatedAt: "now", sourceCompletedAt: "now", score: expected.score } };
      },
    },
  });
  assert.equal(applyResult.ok, true);
  assert.equal(applyResult.writesPerformed, true);
  assert.equal(markCalls, 6);
  assert.equal(transitionCalls, 6);
  assert.equal(persistCalls, 6);
  assert.deepEqual(applyResult.completedMemberIds, GDT_01_EXPECTED_MEMBER_IDS);

  let resumedMarkCalls = 0;
  let resumedTransitionCalls = 0;
  let resumedPersistCalls = 0;
  const resumedApplyResult = await executeGdt01ScoringApply({
    snapshot: resumableState,
    classification: resumableClassification,
    expectedScores,
    mode: "apply",
    deps: {
      markStarted: async ({ teamAssessmentParticipantId }) => {
        resumedMarkCalls += 1;
        assert.notEqual(teamAssessmentParticipantId, "w-GD-001");
        return { status: "started", startedAt: "now", transitioned: true };
      },
      transitionCompleted: async ({ context: memberContext }) => {
        resumedTransitionCalls += 1;
        assert.notEqual(memberContext.teamAssessmentParticipantId.slice(2), "GD-001");
        return { ok: true, mode: "completed", wrapperStatus: "completed", attemptStatus: "completed", completedAt: "now" };
      },
      persistMemberScore: async ({ context: memberContext }) => {
        resumedPersistCalls += 1;
        const candidateId = memberContext.teamAssessmentParticipantId.slice(2);
        const expected = expectedScores.find((member) => member.candidate_id === candidateId);
        return { ok: true, mode: "inserted", value: { id: `score-${memberContext.participantId}`, teamAssessmentParticipantId: memberContext.teamAssessmentParticipantId, attemptId: memberContext.attemptId, scoringVersion: "team_dynamics_assessment_v1_mixed_v1", scoringStatus: "scored", calculatedAt: "now", sourceCompletedAt: "now", score: expected.score } };
      },
    },
  });
  assert.equal(resumedApplyResult.ok, true);
  assert.equal(resumedApplyResult.writesPerformed, true);
  assert.equal(resumedMarkCalls, 5);
  assert.equal(resumedTransitionCalls, 5);
  assert.equal(resumedPersistCalls, 5);
  assert.deepEqual(resumedApplyResult.completedMemberIds, ["GD-002", "GD-003", "GD-004", "GD-005", "GD-019"]);
  assert.deepEqual(resumedApplyResult.skippedMemberIds, ["GD-001"]);

  const missingPreviewClassification = classifyGdt01MemberScoringState({ snapshot: unscoredSnapshot, expectedScores, previews: previews(false) });
  assert.notEqual(missingPreviewClassification.state, "UNSCORED_EXACT");
  assert.equal(buildGdt01ScoringPlan({ classification: missingPreviewClassification, mode: "apply" }).applyAllowed, false);

  const partialClassification = classifyGdt01MemberScoringState({ snapshot: snapshot(true, [scoredRows[0]], [{ code: "wrapper_lifecycle_mismatch", message: "partial" }, { code: "attempt_lifecycle_mismatch", message: "partial" }, { code: "seed_score_artifact", message: "partial" }]), expectedScores });
  assert.equal(partialClassification.state, "PARTIAL");

  const mismatchedRows = scoredRows.map((row, index) => index === 0 ? { ...row, score_snapshot: { ...row.score_snapshot, scoreEntries: [] } } : row);
  const mismatchClassification = classifyGdt01MemberScoringState({ snapshot: resumableSnapshot([mismatchedRows[0]]), expectedScores, previews: previews() });
  assert.equal(mismatchClassification.state, "CONFLICT");

  const duplicateClassification = classifyGdt01MemberScoringState({ snapshot: resumableSnapshot([reorderedScoreRows[0], reorderedScoreRows[0]]), expectedScores, previews: previews() });
  assert.equal(duplicateClassification.state, "CONFLICT");

  let secondRunWrites = 0;
  const noOp = await executeGdt01ScoringApply({
    snapshot: snapshot(true, scoredRows, [{ code: "wrapper_lifecycle_mismatch", message: "expected scored lifecycle" }, { code: "attempt_lifecycle_mismatch", message: "expected scored lifecycle" }, { code: "seed_score_artifact", message: "expected member score rows" }]),
    classification: scoredClassification,
    expectedScores,
    mode: "apply",
    deps: {
      markStarted: async () => { secondRunWrites += 1; throw new Error("no-op must not write"); },
      transitionCompleted: async () => { secondRunWrites += 1; throw new Error("no-op must not write"); },
      persistMemberScore: async () => { secondRunWrites += 1; throw new Error("no-op must not write"); },
    },
  });
  assert.equal(noOp.noOp, true);
  assert.equal(noOp.writesPerformed, false);
  assert.equal(secondRunWrites, 0);

  for (const args of [["--apply"], ["--confirm", "GDT_01_MEMBER_SCORING"], ["--apply", "--confirm", "WRONG"], ["--unknown"]]) {
    assert.throws(() => parseGdt01MemberScoringCli(args));
  }

  const operatorSource = fs.readFileSync(path.join(projectRoot, "lib/golden-demo/team-dynamics-gdt-01-scoring-operator.ts"), "utf8");
  assert.match(operatorSource, /loadTeamDynamicsMixedScoreForContext/);
  assert.match(operatorSource, /persistTeamDynamicsMixedScoreForContext/);
  assert.doesNotMatch(operatorSource, /persistTeamDynamicsFinalAggregationSnapshot|loadTeamDynamicsFinalAggregation|OpenAI|report orchestration/);
  const cliSource = fs.readFileSync(path.join(projectRoot, "scripts/score-gdt-01-team-dynamics-members.cjs"), "utf8");
  assert.match(cliSource, /PARTIAL_EXACT_RESUMABLE/);

  assert.equal(GDT_01_COUNTS.members, 6);
  assert.equal(expectedScores.length, 6);
  console.log(JSON.stringify({
    cli: "PASS",
    unscoredExact: "PASS",
    scoredExact: "PASS",
    partialExactResumable: "PASS",
    productionScorerPreviewCalls: scorerCalls,
    applyMemberCount: applyResult.completedMemberIds.length,
    resumeApplyMemberCount: resumedApplyResult.completedMemberIds.length,
    expectedScoreEntries: 48,
    partialAndConflictGuards: "PASS",
    secondRunNoOp: "PASS",
    downstreamIsolation: "PASS",
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
