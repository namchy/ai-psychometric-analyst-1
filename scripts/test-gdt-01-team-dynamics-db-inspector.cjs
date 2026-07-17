const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
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

const projectRoot = path.resolve(__dirname, "..");
const {
  GDT_01_COUNTS,
  GDT_01_EXPECTED_MEMBER_IDS,
  GDT_01_PACKAGE_SLUG,
  buildEmptyGdt01ObservedState,
  buildGdt01DbContract,
  buildOfflineObservedRuntime,
  classifyGdt01DbState,
  loadGdt01DbContract,
} = require("../lib/golden-demo/team-dynamics-gdt-01-db-contract.ts");
const { createGdt01SupabaseReadRepository } = require("../lib/golden-demo/team-dynamics-gdt-01-db-inspector.ts");
const { parseCli } = require("./inspect-gdt-01-team-dynamics-db.cjs");

const contract = loadGdt01DbContract(projectRoot);
assert.equal(contract.runtimeValidationErrors.length, 0);
assert.equal(contract.fixtureValidationErrors.length, 0);
assert.equal(contract.responses.length, GDT_01_COUNTS.totalResponses);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyState() {
  const state = buildEmptyGdt01ObservedState();
  const runtime = buildOfflineObservedRuntime(contract.runtimeSnapshot);
  state.runtime = runtime;
  state.organizations = [
    {
      id: "org:partner-plus",
      name: "Partner Plus d.o.o., Mikrokreditna organizacija",
      slug: "partner-plus",
      status: "active",
    },
  ];
  state.teams = [
    {
      id: "team:gdt-01",
      organizationId: "org:partner-plus",
      name: "Kreditno poslovanje i rad s klijentima",
      archivedAt: null,
    },
  ];
  state.participants = contract.members.map((member, index) => ({
    id: `participant:${member.candidateId}`,
    organizationId: "org:partner-plus",
    email: member.email,
    fullName: member.displayName,
    participantType: "employee",
    status: "active",
    index,
  })).map(({ index, ...participant }) => participant);
  state.memberships = contract.members.map((member) => ({
    id: `membership:${member.candidateId}`,
    teamId: "team:gdt-01",
    participantId: `participant:${member.candidateId}`,
    isActive: true,
    leftAt: null,
  }));
  return state;
}

function exactState() {
  const state = emptyState();
  state.assignments = [
    {
      id: "assignment:gdt-01",
      teamId: "team:gdt-01",
      packageSlug: GDT_01_PACKAGE_SLUG,
      status: "active",
    },
  ];
  const questionByCode = new Map(state.runtime.questions.map((question) => [question.code, question]));
  const optionByQuestionCode = new Map();
  for (const option of state.runtime.options) {
    const question = state.runtime.questions.find((item) => item.id === option.questionId);
    if (question) optionByQuestionCode.set(`${question.code}\u0000${option.code}`, option);
  }
  state.wrappers = contract.members.map((member) => ({
    id: `wrapper:${member.candidateId}`,
    assignmentId: "assignment:gdt-01",
    membershipId: `membership:${member.candidateId}`,
    participantId: `participant:${member.candidateId}`,
    attemptId: `attempt:${member.candidateId}`,
    status: "invited",
    startedAt: null,
    completedAt: null,
  }));
  state.attempts = contract.members.map((member) => ({
    id: `attempt:${member.candidateId}`,
    testId: state.runtime.test.id,
    testSlug: GDT_01_PACKAGE_SLUG,
    organizationId: "org:partner-plus",
    participantId: `participant:${member.candidateId}`,
    userId: null,
    locale: "bs",
    status: "in_progress",
    completedAt: null,
  }));
  for (const expected of contract.responses) {
    const question = questionByCode.get(expected.questionCode);
    assert.ok(question, `Question ${expected.questionCode} should exist in runtime fixture.`);
    const option = expected.responseType === "likert_single"
      ? optionByQuestionCode.get(`${expected.questionCode}\u0000${expected.optionCode}`)
      : null;
    const responseId = `response:${expected.candidateId}:${expected.questionCode}`;
    state.responses.push({
      id: responseId,
      attemptId: `attempt:${expected.candidateId}`,
      questionId: question.id,
      questionCode: question.code,
      responseKind: expected.responseType === "likert_single" ? "single_choice" : "best_worst",
      answerOptionId: option?.id ?? null,
      optionCode: option?.code ?? null,
      optionValue: option?.value ?? null,
      optionQuestionId: option?.questionId ?? null,
      rawValue: null,
      scoredValue: null,
    });
    if (expected.responseType === "sjt_best_worst") {
      const best = optionByQuestionCode.get(`${expected.questionCode}\u0000${expected.bestOptionCode}`);
      const worst = optionByQuestionCode.get(`${expected.questionCode}\u0000${expected.worstOptionCode}`);
      assert.ok(best && worst, `SJT options should exist for ${expected.questionCode}.`);
      state.selections.push({
        id: `${responseId}:best`,
        responseId,
        questionId: question.id,
        questionCode: question.code,
        answerOptionId: best.id,
        optionCode: best.code,
        optionQuestionId: best.questionId,
        selectionRole: "best",
      });
      state.selections.push({
        id: `${responseId}:worst`,
        responseId,
        questionId: question.id,
        questionCode: question.code,
        answerOptionId: worst.id,
        optionCode: worst.code,
        optionQuestionId: worst.questionId,
        selectionRole: "worst",
      });
    }
  }
  return state;
}

function withMutation(mutator) {
  const state = exactState();
  mutator(state);
  return state;
}

function createMockSupabaseFromExactState(state) {
  const calls = [];
  const snapshot = contract.runtimeSnapshot;
  const runtimeTest = state.runtime.test;
  const rows = {
    tests: [
      {
        id: runtimeTest.id,
        slug: runtimeTest.slug,
        status: runtimeTest.status,
        is_active: runtimeTest.isActive,
        scoring_method: runtimeTest.scoringMethod,
        metadata: runtimeTest.metadata,
      },
    ],
    test_dimensions: snapshot.dimensions.map((dimension) => ({
      test_id: runtimeTest.id,
      code: dimension.code,
      display_order: dimension.order,
      is_active: true,
      metadata: dimension.metadata,
    })),
    questions: state.runtime.questions.map((question) => ({
      id: question.id,
      test_id: question.testId,
      code: question.code,
      question_order: question.order,
      question_type: question.questionType,
      is_required: question.required,
      is_active: question.isActive,
      metadata: question.metadata,
    })),
    answer_options: state.runtime.options.map((option) => ({
      id: option.id,
      question_id: option.questionId,
      code: option.code,
      value: option.value,
      option_order: option.order,
      metadata: option.metadata,
    })),
    organizations: state.organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
    })),
    teams: state.teams.map((team) => ({
      id: team.id,
      organization_id: team.organizationId,
      name: team.name,
      archived_at: team.archivedAt,
    })),
    participants: state.participants.map((participant) => ({
      id: participant.id,
      organization_id: participant.organizationId,
      email: participant.email,
      full_name: participant.fullName,
      participant_type: participant.participantType,
      status: participant.status,
    })),
    team_memberships: state.memberships.map((membership) => ({
      id: membership.id,
      team_id: membership.teamId,
      participant_id: membership.participantId,
      is_active: membership.isActive,
      left_at: membership.leftAt,
    })),
    team_assessment_assignments: state.assignments.map((assignment) => ({
      id: assignment.id,
      team_id: assignment.teamId,
      package_slug: assignment.packageSlug,
      status: assignment.status,
    })),
    team_assessment_participants: state.wrappers.map((wrapper) => ({
      id: wrapper.id,
      team_assessment_assignment_id: wrapper.assignmentId,
      team_membership_id: wrapper.membershipId,
      participant_id: wrapper.participantId,
      attempt_id: wrapper.attemptId,
      status: wrapper.status,
      started_at: wrapper.startedAt,
      completed_at: wrapper.completedAt,
    })),
    attempts: state.attempts.map((attempt) => ({
      id: attempt.id,
      test_id: attempt.testId,
      user_id: attempt.userId,
      organization_id: attempt.organizationId,
      participant_id: attempt.participantId,
      locale: attempt.locale,
      status: attempt.status,
      completed_at: attempt.completedAt,
    })),
    responses: state.responses.map((response) => ({
      id: response.id,
      attempt_id: response.attemptId,
      question_id: response.questionId,
      response_kind: response.responseKind,
      answer_option_id: response.answerOptionId,
      raw_value: response.rawValue,
      scored_value: response.scoredValue,
    })),
    response_selections: state.selections.map((selection) => ({
      response_id: selection.responseId,
      question_id: selection.questionId,
      answer_option_id: selection.answerOptionId,
      selection_role: selection.selectionRole,
    })),
    team_assessment_participant_scores: [],
    dimension_scores: [],
    team_assessment_aggregation_snapshots: [],
    team_assessment_report_selection_drafts: [],
    team_assessment_report_selection_members: [],
    team_assessment_reports: [],
    attempt_reports: [],
    team_fit_reports: [],
  };
  return {
    calls,
    client: {
      from(table) {
        let currentRows = rows[table] ?? [];
        const query = {
          select() {
            calls.push({ table, operation: "select" });
            return query;
          },
          eq() {
            return query;
          },
          in() {
            return query;
          },
          is() {
            return query;
          },
          then(resolve, reject) {
            return Promise.resolve({ data: currentRows, error: null }).then(resolve, reject);
          },
        };
        return query;
      },
    },
  };
}

function expectState(name, state, expected) {
  const result = classifyGdt01DbState(contract, state);
  assert.equal(result.state, expected, `${name}: expected ${expected}, received ${result.state}\n${JSON.stringify(result.blockingFindings, null, 2)}`);
  return result;
}

expectState("empty", emptyState(), "EMPTY");
const exact = expectState("exact", exactState(), "EXACT_MATCH");
assert.equal(exact.writerEligible, false);
assert.deepEqual(exact.safety, {
  readOnly: true,
  databaseWrites: false,
  rpcCalls: false,
  scoringExecuted: false,
  aggregationExecuted: false,
  reportsGenerated: false,
  openaiCalled: false,
});

const adapterTestPromise = (async () => {
  const mock = createMockSupabaseFromExactState(exactState());
  const repository = createGdt01SupabaseReadRepository(mock.client);
  const observed = await repository.readState();
  const adapterResult = classifyGdt01DbState(contract, observed);
  assert.equal(adapterResult.state, "EXACT_MATCH");
  assert.ok(mock.calls.length > 0);
  assert.ok(mock.calls.every((call) => call.operation === "select"));
})();

expectState("missing wrapper", withMutation((state) => {
  const wrapper = state.wrappers.pop();
  state.attempts = state.attempts.filter((attempt) => attempt.id !== wrapper.attemptId);
  state.responses = state.responses.filter((response) => response.attemptId !== wrapper.attemptId);
  state.selections = state.selections.filter((selection) => !selection.responseId.startsWith(`response:${wrapper.participantId.replace("participant:", "")}:`));
}), "PARTIAL");
expectState("missing attempt", withMutation((state) => {
  const wrapper = state.wrappers[0];
  state.attempts = state.attempts.filter((attempt) => attempt.id !== wrapper.attemptId);
  wrapper.attemptId = null;
}), "PARTIAL");
expectState("missing response", withMutation((state) => state.responses.pop()), "PARTIAL");
expectState("missing SJT selection", withMutation((state) => state.selections.pop()), "PARTIAL");
expectState("missing wrapper attempt link", withMutation((state) => {
  const wrapper = state.wrappers[0];
  state.attempts = state.attempts.filter((attempt) => attempt.id !== wrapper.attemptId);
  wrapper.attemptId = null;
}), "PARTIAL");

expectState("wrong organization", withMutation((state) => { state.teams[0].organizationId = "org:wrong"; }), "CONFLICT");
expectState("wrong team ownership", withMutation((state) => { state.teams[0].organizationId = "org:wrong"; }), "CONFLICT");
expectState("assignment linked to wrong team", withMutation((state) => { state.assignments[0].teamId = "team:gdt-02"; }), "CONFLICT");
expectState("wrong participant", withMutation((state) => { state.participants[0].fullName = "Wrong Person"; }), "CONFLICT");
expectState("duplicate participant identity", withMutation((state) => { state.participants.push({ ...state.participants[0], id: "participant:GD-001-duplicate" }); }), "CONFLICT");
expectState("inactive membership", withMutation((state) => { state.memberships[0].isActive = false; }), "CONFLICT");
expectState("legacy test slug", withMutation((state) => { state.attempts[0].testSlug = "team_dynamics_v1_strong"; }), "CONFLICT");
expectState("legacy package slug", withMutation((state) => { state.assignments[0].packageSlug = "team_dynamics_v1_strong"; }), "CONFLICT");
expectState("checksum drift", withMutation((state) => {
  state.runtime.snapshot = { ...state.runtime.snapshot, checksum: "drift" };
  state.runtime.snapshotErrors = ["Checksum mismatch."];
}), "CONFLICT");
expectState("duplicate assignment", withMutation((state) => { state.assignments.push({ ...state.assignments[0], id: "assignment:duplicate" }); }), "CONFLICT");
expectState("duplicate response identity", withMutation((state) => { state.responses.push({ ...state.responses[0], id: "response:duplicate" }); }), "CONFLICT");
expectState("extra response", withMutation((state) => { state.responses.push({ ...state.responses[0], id: "response:extra", questionId: "question:unknown", questionCode: "UNKNOWN" }); }), "CONFLICT");
expectState("unknown question", withMutation((state) => { state.responses[0].questionCode = "UNKNOWN"; }), "CONFLICT");
expectState("wrong option", withMutation((state) => {
  const likert = state.responses.find((response) => response.responseKind === "single_choice");
  likert.optionCode = "WRONG_OPTION";
}), "CONFLICT");
expectState("option belongs to another question", withMutation((state) => {
  const likert = state.responses.find((response) => response.responseKind === "single_choice");
  const other = state.runtime.options.find((option) => option.questionId !== likert.optionQuestionId);
  likert.answerOptionId = other.id;
  likert.optionCode = other.code;
  likert.optionValue = other.value;
  likert.optionQuestionId = other.questionId;
}), "CONFLICT");
expectState("wrong SJT best", withMutation((state) => {
  const best = state.selections.find((selection) => selection.selectionRole === "best");
  best.optionCode = "WRONG_OPTION";
}), "CONFLICT");
expectState("SJT option belongs to another question", withMutation((state) => {
  const best = state.selections.find((selection) => selection.selectionRole === "best");
  const other = state.runtime.options.find((option) => option.questionId !== best.optionQuestionId);
  best.answerOptionId = other.id;
  best.optionCode = other.code;
  best.optionQuestionId = other.questionId;
}), "CONFLICT");
expectState("wrong SJT worst", withMutation((state) => {
  const worst = state.selections.find((selection) => selection.selectionRole === "worst");
  worst.optionCode = "WRONG_OPTION";
}), "CONFLICT");
expectState("same SJT option", withMutation((state) => {
  const best = state.selections.find((selection) => selection.selectionRole === "best");
  const worst = state.selections.find((selection) => selection.selectionRole === "worst");
  worst.answerOptionId = best.answerOptionId;
  worst.optionCode = best.optionCode;
}), "CONFLICT");
expectState("duplicate best role", withMutation((state) => { state.selections.push({ ...state.selections.find((selection) => selection.selectionRole === "best"), id: "selection:duplicate-best" }); }), "CONFLICT");
expectState("response kind mismatch", withMutation((state) => {
  const sjt = state.responses.find((response) => response.responseKind === "best_worst");
  sjt.responseKind = "single_choice";
}), "CONFLICT");
expectState("wrong locale", withMutation((state) => { state.attempts[0].locale = "hr"; }), "CONFLICT");
expectState("wrong lifecycle", withMutation((state) => { state.attempts[0].status = "completed"; }), "CONFLICT");
expectState("seed scoring value", withMutation((state) => { state.responses[0].rawValue = 3; }), "CONFLICT");
expectState("member score", withMutation((state) => { state.memberScoreIds.push("score:1"); }), "CONFLICT");
expectState("aggregation", withMutation((state) => { state.aggregationIds.push("aggregation:1"); }), "CONFLICT");
expectState("Team Dynamics report", withMutation((state) => { state.teamReportIds.push("report:1"); }), "CONFLICT");
expectState("direct Team Fit report", withMutation((state) => {
  state.teamFitReports.push({
    id: "team-fit:1",
    organizationId: "org:partner-plus",
    teamId: "team:gdt-01",
    participantId: "participant:GD-001",
    candidateSourceType: "composite_deterministic_input_snapshot",
    candidateSourceId: "attempt:GD-001",
    teamSourceType: "team_dynamics_aggregation_input_snapshot",
    teamSourceId: null,
    lineage: "direct",
  });
}), "CONFLICT");
expectState("orphan attempt", withMutation((state) => {
  state.attempts.push({
    id: "attempt:orphan",
    testId: state.runtime.test.id,
    testSlug: GDT_01_PACKAGE_SLUG,
    organizationId: "org:partner-plus",
    participantId: "participant:GD-001",
    userId: null,
    locale: "bs",
    status: "in_progress",
    completedAt: null,
  });
}), "CONFLICT");
expectState("orphan response", withMutation((state) => {
  state.attempts.push({
    id: "attempt:orphan",
    testId: state.runtime.test.id,
    testSlug: GDT_01_PACKAGE_SLUG,
    organizationId: "org:partner-plus",
    participantId: "participant:GD-001",
    userId: null,
    locale: "bs",
    status: "in_progress",
    completedAt: null,
  });
  state.responses.push({ ...state.responses[0], id: "response:orphan", attemptId: "attempt:orphan" });
}), "CONFLICT");

const diagnostic = exactState();
diagnostic.teamFitReports.push({
  id: "team-fit:ambient",
  organizationId: "org:partner-plus",
  teamId: "team:gdt-01",
  participantId: "participant:GD-001",
  candidateSourceType: "composite_deterministic_input_snapshot",
  candidateSourceId: null,
  teamSourceType: "team_dynamics_aggregation_input_snapshot",
  teamSourceId: null,
  lineage: "ambient",
});
const diagnosticResult = expectState("ambient Team Fit", diagnostic, "EXACT_MATCH");
assert.ok(diagnosticResult.diagnosticFindings.some((finding) => finding.code === "ambient_team_fit_report"));

const ambientAssignment = exactState();
ambientAssignment.ambientAssignments.push({
  id: "assignment:other-team",
  teamId: "team:gdt-02",
  packageSlug: GDT_01_PACKAGE_SLUG,
  status: "active",
});
const ambientAssignmentResult = expectState("ambient assignment", ambientAssignment, "EXACT_MATCH");
assert.ok(ambientAssignmentResult.diagnosticFindings.some((finding) => finding.code === "ambient_team_dynamics_assignment"));

const precedence = withMutation((state) => {
  state.responses.pop();
  state.attempts[0].locale = "hr";
});
assert.equal(classifyGdt01DbState(contract, precedence).state, "CONFLICT");

const inspectorSource = fs.readFileSync(path.join(projectRoot, "lib/golden-demo/team-dynamics-gdt-01-db-inspector.ts"), "utf8");
for (const forbidden of [".insert(", ".update(", ".delete(", ".upsert(", ".rpc("]) {
  assert.equal(inspectorSource.includes(forbidden), false, `Inspector must not contain ${forbidden}.`);
}
const contractSource = fs.readFileSync(path.join(projectRoot, "lib/golden-demo/team-dynamics-gdt-01-db-contract.ts"), "utf8");
assert.equal(contractSource.includes("answer-recipes"), false);
assert.deepEqual(parseCli([]), { json: false, verbose: false });
assert.deepEqual(parseCli(["--json", "--verbose"]), { json: true, verbose: true });
assert.throws(() => parseCli(["--apply"]), /SELECT-only/);

adapterTestPromise
  .then(() => {
    console.log(JSON.stringify({
      stateCases: "PASS",
      exactCounts: {
        responses: exact.counts.responsesObserved,
        physicalSjtSelections: exact.counts.physicalSjtSelectionsObserved,
        logicalSelections: exact.counts.logicalSelectionsObserved,
      },
      precedence: "PASS",
      readOnlySourceGuard: "PASS",
      selectOnlyAdapter: "PASS",
      cliContract: "PASS",
      members: GDT_01_EXPECTED_MEMBER_IDS.length,
    }, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
