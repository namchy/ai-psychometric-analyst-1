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
  GDT_01_LEGACY_PACKAGE_SLUG,
  GDT_01_EXPECTED_MEMBER_IDS,
  GDT_01_PACKAGE_SLUG,
  buildEmptyGdt01ObservedState,
  buildGdt01DbContract,
  buildOfflineObservedRuntime,
  classifyGdt01DbState,
  loadGdt01DbContract,
} = require("../lib/golden-demo/team-dynamics-gdt-01-db-contract.ts");
const {
  createGdt01SupabaseReadRepository,
  GDT_01_RESPONSE_SELECTION_BATCH_SIZE,
} = require("../lib/golden-demo/team-dynamics-gdt-01-db-inspector.ts");
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

function addUnrelatedStandardBatteryData(state) {
  const standardTests = [
    ["ipip-neo-120-v1", "test:ipip"],
    ["safran_v1", "test:safran"],
    ["mwms_v1", "test:mwms"],
  ];
  for (const [testSlug, testId] of standardTests) {
    const attemptId = `attempt:${testSlug}:GD-001`;
    state.attempts.push({
      id: attemptId,
      testId,
      testSlug,
      organizationId: "org:partner-plus",
      participantId: "participant:GD-001",
      userId: null,
      locale: "bs",
      status: "completed",
      completedAt: "2026-07-17T00:00:00.000Z",
    });
    state.responses.push({
      id: `response:${testSlug}:GD-001`,
      attemptId,
      questionId: `question:${testSlug}:1`,
      questionCode: `${testSlug}:1`,
      responseKind: "single_choice",
      answerOptionId: null,
      optionCode: null,
      optionValue: null,
      optionQuestionId: null,
      rawValue: 1,
      scoredValue: 1,
    });
  }
  state.unrelatedDimensionScores = [{ id: "dimension-score:mwms", attempt_id: "attempt:mwms_v1:GD-001" }];
  state.unrelatedAttemptReports = [{ id: "attempt-report:mwms", attempt_id: "attempt:mwms_v1:GD-001" }];
  return state;
}

function addLargeUnrelatedRuntimeCatalog(state) {
  state.unrelatedRuntimeQuestions = [
    ["test:ipip", "ipip-neo-120-v1"],
    ["test:safran", "safran_v1"],
    ["test:mwms", "mwms_v1"],
  ].map(([testId, slug]) => ({
    id: `question:${slug}:runtime`,
    testId,
    code: `${slug}:runtime`,
    order: 1,
    questionType: "single_choice",
    required: true,
    isActive: true,
    metadata: {},
  }));
  state.unrelatedRuntimeOptions = Array.from({ length: 600 }, (_, index) => ({
    id: `option:ambient:${index}`,
    questionId: state.unrelatedRuntimeQuestions[index % state.unrelatedRuntimeQuestions.length].id,
    code: `AMBIENT_${index}`,
    value: index,
    order: index + 1,
    metadata: {},
  }));
  return state;
}

function addUnrelatedTeamAssessmentWrapper(state, packageSlug = "other_team_package") {
  state.assignments.push({
    id: `assignment:${packageSlug}`,
    teamId: "team:gdt-01",
    packageSlug,
    status: "active",
  });
  state.wrappers.push({
    id: `wrapper:${packageSlug}:GD-001`,
    assignmentId: `assignment:${packageSlug}`,
    membershipId: "membership:GD-001",
    participantId: "participant:GD-001",
    attemptId: `attempt:${packageSlug}:GD-001`,
    status: "completed",
    startedAt: "2026-07-17T00:00:00.000Z",
    completedAt: "2026-07-17T00:00:00.000Z",
  });
  state.attempts.push({
    id: `attempt:${packageSlug}:GD-001`,
    testId: "test:ipip",
    testSlug: "ipip-neo-120-v1",
    organizationId: "org:partner-plus",
    participantId: "participant:GD-001",
    userId: null,
    locale: "bs",
    status: "completed",
    completedAt: "2026-07-17T00:00:00.000Z",
  });
  state.unrelatedMemberScores = [{ id: `member-score:${packageSlug}` }];
  state.unrelatedDimensionScores = [{ id: `dimension-score:${packageSlug}`, attempt_id: `attempt:${packageSlug}:GD-001` }];
  state.unrelatedAttemptReports = [{ id: `attempt-report:${packageSlug}`, attempt_id: `attempt:${packageSlug}:GD-001` }];
  return state;
}

function createMockSupabaseFromExactState(state, options = {}) {
  const calls = [];
  const filters = [];
  let responseSelectionQueryCount = 0;
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
      ...[
        ["test:team-dynamics-legacy", GDT_01_LEGACY_PACKAGE_SLUG],
        ["test:ipip", "ipip-neo-120-v1"],
        ["test:safran", "safran_v1"],
        ["test:mwms", "mwms_v1"],
      ].map(([id, slug]) => ({
        id,
        slug,
        status: "active",
        is_active: true,
        scoring_method: "default",
        metadata: {},
      })),
    ],
    test_dimensions: snapshot.dimensions.map((dimension) => ({
      test_id: runtimeTest.id,
      code: dimension.code,
      display_order: dimension.order,
      is_active: true,
      metadata: dimension.metadata,
    })),
    questions: [...state.runtime.questions, ...(state.unrelatedRuntimeQuestions ?? [])].map((question) => ({
      id: question.id,
      test_id: question.testId,
      code: question.code,
      question_order: question.order,
      question_type: question.questionType,
      is_required: question.required,
      is_active: question.isActive,
      metadata: question.metadata,
    })),
    answer_options: [...state.runtime.options, ...(state.unrelatedRuntimeOptions ?? [])].map((option) => ({
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
    team_assessment_assignments: [...state.assignments, ...state.ambientAssignments].map((assignment) => ({
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
    team_assessment_participant_scores: state.unrelatedMemberScores ?? [],
    dimension_scores: state.unrelatedDimensionScores ?? [],
    team_assessment_aggregation_snapshots: [],
    team_assessment_report_selection_drafts: [],
    team_assessment_report_selection_members: [],
    team_assessment_reports: [],
    attempt_reports: state.unrelatedAttemptReports ?? [],
    team_fit_reports: [],
  };
  return {
    calls,
    filters,
    responseSelectionQueryCount: () => responseSelectionQueryCount,
    client: {
      from(table) {
        let currentRows = rows[table] ?? [];
        const query = {
          select() {
            calls.push({ table, operation: "select" });
            return query;
          },
          eq(column, value) {
            filters.push({ table, operation: "eq", column, value });
            currentRows = currentRows.filter((row) => row[column] === value);
            return query;
          },
          in(column, values) {
            filters.push({ table, operation: "in", column, values: [...values] });
            currentRows = currentRows.filter((row) => values.includes(row[column]));
            return query;
          },
          is(column, value) {
            filters.push({ table, operation: "is", column, value });
            currentRows = currentRows.filter((row) => row[column] === value);
            return query;
          },
          then(resolve, reject) {
            if (table === "response_selections") {
              responseSelectionQueryCount += 1;
              if (responseSelectionQueryCount === options.failResponseSelectionBatch) {
                return Promise.resolve({
                  data: null,
                  error: {
                    message: "synthetic selection failure",
                    cause: { code: "UND_ERR_TEST", message: "synthetic cause" },
                  },
                }).then(resolve, reject);
              }
            }
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
  const expectedExactState = exactState();
  const mock = createMockSupabaseFromExactState(expectedExactState);
  const repository = createGdt01SupabaseReadRepository(mock.client, contract);
  const observed = await repository.readState();
  const adapterResult = classifyGdt01DbState(contract, observed);
  assert.equal(adapterResult.state, "EXACT_MATCH");
  assert.ok(mock.calls.length > 0);
  assert.ok(mock.calls.every((call) => call.operation === "select"));
  const selectionBatchFilters = mock.filters.filter((filter) => filter.table === "response_selections" && filter.operation === "in");
  assert.equal(selectionBatchFilters.length, Math.ceil(contract.responses.length / GDT_01_RESPONSE_SELECTION_BATCH_SIZE));
  assert.equal(selectionBatchFilters[0].values.length, GDT_01_RESPONSE_SELECTION_BATCH_SIZE);
  assert.deepEqual(new Set(selectionBatchFilters.flatMap((filter) => filter.values)), new Set(expectedExactState.responses.map((response) => response.id)));
  assert.equal(mock.responseSelectionQueryCount(), selectionBatchFilters.length);
  assert.equal(observed.selections.length, expectedExactState.selections.length);
  assert.deepEqual(
    observed.selections.map((selection) => `${selection.responseId}:${selection.selectionRole}:${selection.answerOptionId}`).sort(),
    expectedExactState.selections.map((selection) => `${selection.responseId}:${selection.selectionRole}:${selection.answerOptionId}`).sort(),
  );
})();

const emptySelectionReadPromise = (async () => {
  const mock = createMockSupabaseFromExactState(emptyState());
  const observed = await createGdt01SupabaseReadRepository(mock.client, contract).readState();
  assert.deepEqual(observed.selections, []);
  assert.equal(mock.filters.filter((filter) => filter.table === "response_selections").length, 0);
  assert.equal(mock.responseSelectionQueryCount(), 0);
})();

const batchFailurePromise = (async () => {
  const mock = createMockSupabaseFromExactState(exactState(), { failResponseSelectionBatch: 2 });
  await assert.rejects(
    () => createGdt01SupabaseReadRepository(mock.client, contract).readState(),
    /Failed to read response_selections \(batch 2\/12\): synthetic selection failure \(cause.code=UND_ERR_TEST; cause.message=synthetic cause\)/,
  );
  assert.equal(mock.responseSelectionQueryCount(), 2);
})();

const runtimeQueryScopePromise = (async () => {
  const runtimeScopeState = addLargeUnrelatedRuntimeCatalog(exactState());
  const mock = createMockSupabaseFromExactState(runtimeScopeState);
  const observed = await createGdt01SupabaseReadRepository(mock.client, contract).readState();
  const result = classifyGdt01DbState(contract, observed);
  assert.equal(result.state, "EXACT_MATCH");
  assert.equal(observed.runtime.questions.length, GDT_01_COUNTS.questionsPerMember);
  assert.equal(observed.runtime.options.length, contract.runtimeSnapshot.source_summary.option_count);
  assert.equal(observed.runtime.snapshot.checksum, contract.runtimeSnapshot.checksum);
  const testSlugFilter = mock.filters.find((filter) => filter.table === "tests" && filter.operation === "in" && filter.column === "slug");
  assert.deepEqual(testSlugFilter.values, [GDT_01_PACKAGE_SLUG, GDT_01_LEGACY_PACKAGE_SLUG]);
  const runtimeQuestionFilter = mock.filters.find((filter) => filter.table === "questions" && filter.operation === "in" && filter.column === "test_id");
  assert.deepEqual(new Set(runtimeQuestionFilter.values), new Set([observed.runtime.test.id, "test:team-dynamics-legacy"]));
  const optionFilter = mock.filters.find((filter) => filter.table === "answer_options" && filter.operation === "in" && filter.column === "question_id");
  const standardQuestionIds = new Set(runtimeScopeState.unrelatedRuntimeQuestions.map((question) => question.id));
  assert.equal(optionFilter.values.some((id) => standardQuestionIds.has(id)), false);
})();

const missingCanonicalOptionCatalogPromise = (async () => {
  const state = exactState();
  const missingQuestionId = state.runtime.questions[0].id;
  state.runtime.options = state.runtime.options.filter((option) => option.questionId !== missingQuestionId);
  const mock = createMockSupabaseFromExactState(state);
  const observed = await createGdt01SupabaseReadRepository(mock.client, contract).readState();
  const result = classifyGdt01DbState(contract, observed);
  assert.equal(result.state, "CONFLICT");
  assert.ok(result.blockingFindings.some((finding) => finding.code === "runtime_contract_invalid"));
})();

const changedCanonicalOptionPromise = (async () => {
  const state = exactState();
  state.runtime.options[0].value = "changed";
  const mock = createMockSupabaseFromExactState(state);
  const observed = await createGdt01SupabaseReadRepository(mock.client, contract).readState();
  const result = classifyGdt01DbState(contract, observed);
  assert.equal(result.state, "CONFLICT");
  assert.notEqual(observed.runtime.snapshot.checksum, contract.runtimeSnapshot.checksum);
  assert.ok(result.blockingFindings.some((finding) => finding.code === "runtime_checksum_mismatch"));
})();

const unrelatedStandard = addUnrelatedStandardBatteryData(exactState());
const unrelatedStandardResult = expectState("unrelated standard battery data", unrelatedStandard, "EXACT_MATCH");
assert.equal(unrelatedStandardResult.blockingFindings.some((finding) => finding.code.startsWith("orphan_target_")), false);
assert.equal(unrelatedStandardResult.counts.responsesObserved, GDT_01_COUNTS.totalResponses);

const unrelatedStandardAdapterPromise = (async () => {
  const mock = createMockSupabaseFromExactState(unrelatedStandard);
  const repository = createGdt01SupabaseReadRepository(mock.client, contract);
  const observed = await repository.readState();
  const result = classifyGdt01DbState(contract, observed);
  assert.equal(result.state, "EXACT_MATCH");
  assert.equal(result.blockingFindings.some((finding) => finding.code.startsWith("orphan_target_")), false);
  assert.deepEqual(observed.dimensionScoreIds, []);
  assert.deepEqual(observed.attemptReportIds, []);
})();

const unrelatedTeamAssessmentAdapterPromise = (async () => {
  const state = addUnrelatedTeamAssessmentWrapper(exactState());
  const mock = createMockSupabaseFromExactState(state);
  const observed = await createGdt01SupabaseReadRepository(mock.client, contract).readState();
  const result = classifyGdt01DbState(contract, observed);
  assert.equal(result.state, "CONFLICT");
  assert.ok(result.blockingFindings.some((finding) => finding.code === "noncanonical_target_assignment"));
  assert.equal(result.blockingFindings.some((finding) => finding.code === "orphan_target_wrapper"), false);
  assert.equal(result.blockingFindings.some((finding) => finding.code === "orphan_target_attempt"), false);
  assert.deepEqual(observed.memberScoreIds, []);
  assert.deepEqual(observed.dimensionScoreIds, []);
  assert.deepEqual(observed.attemptReportIds, []);
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

const missingTeam = emptyState();
missingTeam.teams = [];
const missingTeamResult = expectState("foundation team missing", missingTeam, "PARTIAL");
assert.equal(missingTeamResult.writerEligible, false);
assert.ok(missingTeamResult.blockingFindings.some((finding) => finding.code === "team_missing"));
assert.ok(missingTeamResult.blockingFindings.filter((finding) => finding.code === "team_missing").every((finding) => finding.category === "foundation"));

const missingParticipants = emptyState();
missingParticipants.participants = missingParticipants.participants.filter((participant) => participant.id === "participant:GD-001");
const missingParticipantsResult = expectState("foundation participants missing", missingParticipants, "PARTIAL");
assert.equal(missingParticipantsResult.writerEligible, false);
assert.equal(missingParticipantsResult.blockingFindings.filter((finding) => finding.code === "participant_missing").length, 5);
assert.ok(missingParticipantsResult.blockingFindings.filter((finding) => finding.code === "participant_missing").every((finding) => finding.category === "foundation"));

const missingMembership = emptyState();
missingMembership.memberships = missingMembership.memberships.filter((membership) => membership.participantId !== "participant:GD-001");
const missingMembershipResult = expectState("foundation membership missing", missingMembership, "PARTIAL");
assert.equal(missingMembershipResult.writerEligible, false);
assert.ok(missingMembershipResult.blockingFindings.some((finding) => finding.code === "membership_missing"));
assert.ok(missingMembershipResult.blockingFindings.filter((finding) => finding.code === "membership_missing").every((finding) => finding.category === "foundation"));

const foundationWithAmbientStandard = addUnrelatedStandardBatteryData(emptyState());
foundationWithAmbientStandard.teams = [];
const foundationWithAmbientStandardResult = expectState("foundation plus unrelated standard battery", foundationWithAmbientStandard, "PARTIAL");
assert.equal(foundationWithAmbientStandardResult.writerEligible, false);
assert.deepEqual(
  foundationWithAmbientStandardResult.blockingFindings.map((finding) => finding.code),
  ["team_missing"],
);

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

const legacyOrphan = exactState();
legacyOrphan.attempts.push({
  id: "attempt:legacy-orphan",
  testId: "test:team-dynamics-legacy",
  testSlug: GDT_01_LEGACY_PACKAGE_SLUG,
  organizationId: "org:partner-plus",
  participantId: "participant:GD-001",
  userId: null,
  locale: "bs",
  status: "in_progress",
  completedAt: null,
});
const legacyOrphanResult = expectState("legacy Team Dynamics orphan", legacyOrphan, "CONFLICT");
assert.ok(legacyOrphanResult.blockingFindings.some((finding) => finding.code === "orphan_target_attempt"));

const legacyOrphanResponse = clone(legacyOrphan);
legacyOrphanResponse.responses.push({
  id: "response:legacy-orphan",
  attemptId: "attempt:legacy-orphan",
  questionId: "question:legacy-orphan",
  questionCode: "legacy-orphan",
  responseKind: "single_choice",
  answerOptionId: null,
  optionCode: null,
  optionValue: null,
  optionQuestionId: null,
  rawValue: null,
  scoredValue: null,
});
const legacyOrphanResponseResult = expectState("legacy Team Dynamics orphan response", legacyOrphanResponse, "CONFLICT");
assert.ok(legacyOrphanResponseResult.blockingFindings.some((finding) => finding.code === "orphan_target_response"));

const canonicalOtherParticipant = exactState();
canonicalOtherParticipant.attempts.push({
  id: "attempt:team-dynamics-other-participant",
  testId: canonicalOtherParticipant.runtime.test.id,
  testSlug: GDT_01_PACKAGE_SLUG,
  organizationId: "org:partner-plus",
  participantId: "participant:GD-006",
  userId: null,
  locale: "bs",
  status: "in_progress",
  completedAt: null,
});
const canonicalOtherParticipantResult = expectState("Team Dynamics attempt for unrelated participant", canonicalOtherParticipant, "EXACT_MATCH");
assert.equal(canonicalOtherParticipantResult.blockingFindings.some((finding) => finding.code.startsWith("orphan_target_")), false);

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

const ambientNonTeamDynamicsWrapper = exactState();
ambientNonTeamDynamicsWrapper.ambientAssignments.push({
  id: "assignment:ambient-other-package",
  teamId: "team:gdt-02",
  packageSlug: "other_team_package",
  status: "active",
});
ambientNonTeamDynamicsWrapper.wrappers.push({
  id: "wrapper:ambient-other-package:GD-001",
  assignmentId: "assignment:ambient-other-package",
  membershipId: "membership:GD-001",
  participantId: "participant:GD-001",
  attemptId: "attempt:ambient-other-package:GD-001",
  status: "completed",
  startedAt: "2026-07-17T00:00:00.000Z",
  completedAt: "2026-07-17T00:00:00.000Z",
});
ambientNonTeamDynamicsWrapper.attempts.push({
  id: "attempt:ambient-other-package:GD-001",
  testId: "test:ipip",
  testSlug: "ipip-neo-120-v1",
  organizationId: "org:partner-plus",
  participantId: "participant:GD-001",
  userId: null,
  locale: "bs",
  status: "completed",
  completedAt: "2026-07-17T00:00:00.000Z",
});
const ambientNonTeamDynamicsWrapperResult = expectState("ambient non-Team-Dynamics wrapper", ambientNonTeamDynamicsWrapper, "EXACT_MATCH");
assert.equal(ambientNonTeamDynamicsWrapperResult.blockingFindings.some((finding) => finding.code.startsWith("orphan_target_")), false);

for (const packageSlug of [GDT_01_PACKAGE_SLUG, GDT_01_LEGACY_PACKAGE_SLUG]) {
  const teamDynamicsWrapperOutsideTarget = exactState();
  teamDynamicsWrapperOutsideTarget.ambientAssignments.push({
    id: `assignment:ambient:${packageSlug}`,
    teamId: "team:gdt-02",
    packageSlug,
    status: "active",
  });
  teamDynamicsWrapperOutsideTarget.wrappers.push({
    id: `wrapper:ambient:${packageSlug}:GD-001`,
    assignmentId: `assignment:ambient:${packageSlug}`,
    membershipId: "membership:GD-001",
    participantId: "participant:GD-001",
    attemptId: `attempt:ambient:${packageSlug}:GD-001`,
    status: "invited",
    startedAt: null,
    completedAt: null,
  });
  teamDynamicsWrapperOutsideTarget.attempts.push({
    id: `attempt:ambient:${packageSlug}:GD-001`,
    testId: packageSlug === GDT_01_PACKAGE_SLUG ? teamDynamicsWrapperOutsideTarget.runtime.test.id : "test:team-dynamics-legacy",
    testSlug: packageSlug,
    organizationId: "org:partner-plus",
    participantId: "participant:GD-001",
    userId: null,
    locale: "bs",
    status: "in_progress",
    completedAt: null,
  });
  const result = expectState(`${packageSlug} wrapper outside target assignment`, teamDynamicsWrapperOutsideTarget, "CONFLICT");
  assert.ok(result.blockingFindings.some((finding) => finding.code === "orphan_target_wrapper"));
  assert.ok(result.blockingFindings.some((finding) => finding.code === "orphan_target_attempt"));
}

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

Promise.all([
  adapterTestPromise,
  emptySelectionReadPromise,
  batchFailurePromise,
  runtimeQueryScopePromise,
  missingCanonicalOptionCatalogPromise,
  changedCanonicalOptionPromise,
  unrelatedStandardAdapterPromise,
  unrelatedTeamAssessmentAdapterPromise,
])
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
