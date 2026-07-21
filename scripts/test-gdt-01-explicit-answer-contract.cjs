"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// This offline helper installs the repository TypeScript/alias loader and builds
// the real mixed-runtime handoff from the locked runtime snapshot.
const offline = require("./gdt-01-team-dynamics-offline.cjs");
const {
  buildGdt01DbContract,
  loadGdt01DbContract,
} = require("../lib/golden-demo/team-dynamics-gdt-01-db-contract.ts");
const {
  buildTeamDynamicsMixedSavedAnswerState,
} = require("../lib/assessment/team-dynamics-mixed-answer-rehydration.ts");

const canonical = offline.loadJson(offline.ANSWERS);
const recipe = offline.loadJson(offline.RECIPE);
const canonicalContract = loadGdt01DbContract(offline.root);
const canonicalMemberRows = canonicalContract.members.map((member) => ({
  candidate_id: member.candidateId,
  display_name: member.displayName,
  job_title: member.jobTitle,
  email: member.email,
  development_or_holdout: member.cohortSegment,
  expected_participation_state: member.expectedParticipationState,
  deterministic_verification_allowed: String(member.deterministicVerificationAllowed),
  ai_prompt_calibration_allowed: String(member.aiPromptCalibrationAllowed),
}));

const passes = [];
function pass(name, assertion) {
  assertion();
  passes.push(`PASS ${String(passes.length + 1).padStart(2, "0")} ${name}`);
}

function clone(value) {
  return structuredClone(value);
}

function validateFixture(fixture) {
  return buildGdt01DbContract({
    fixture,
    memberRows: canonicalMemberRows,
    runtimeSnapshot: canonicalContract.runtimeSnapshot,
  });
}

function expectFixtureInvalid(name, mutate, expectedError) {
  pass(name, () => {
    const mutated = clone(canonical);
    mutate(mutated);
    const result = validateFixture(mutated);
    assert.ok(result.fixtureValidationErrors.length > 0, "production fixture validator must reject the mutation");
    assert.ok(result.fixtureValidationErrors.some((error) => expectedError.test(error)), result.fixtureValidationErrors.join("\n"));
  });
}

function fixtureResponseRows(member, handoff) {
  return member.responses.map((response) => {
    const item = handoff.items.find((candidate) => candidate.code === response.question_code);
    assert.ok(item, `runtime handoff must contain ${response.question_code}`);
    if (response.response_type === "likert_single") {
      const option = item.options.find((candidate) => candidate.code === response.option_code && candidate.value === response.option_value);
      return {
        id: `response:${member.candidate_id}:${response.question_code}`,
        question_id: item.questionId,
        response_kind: "single_choice",
        answer_option_id: option?.optionId ?? `invalid:${response.option_code}`,
        response_selections: [],
      };
    }
    const best = item.options.find((candidate) => candidate.code === response.best_option_code);
    const worst = item.options.find((candidate) => candidate.code === response.worst_option_code);
    return {
      id: `response:${member.candidate_id}:${response.question_code}`,
      question_id: item.questionId,
      response_kind: "best_worst",
      answer_option_id: null,
      response_selections: [
        { question_id: item.questionId, answer_option_id: best?.optionId ?? `invalid:${response.best_option_code}`, selection_role: "best" },
        { question_id: item.questionId, answer_option_id: worst?.optionId ?? `invalid:${response.worst_option_code}`, selection_role: "worst" },
      ],
    };
  });
}

function materializeMember(member) {
  const handoff = offline.runtime();
  return buildTeamDynamicsMixedSavedAnswerState({
    context: offline.context(member.candidate_id),
    runtimeHandoff: handoff,
    responseRows: fixtureResponseRows(member, handoff),
  });
}

pass("canonical_production_loader_and_validator", () => {
  assert.equal(canonicalContract.runtimeValidationErrors.length, 0);
  assert.equal(canonicalContract.fixtureValidationErrors.length, 0);
  assert.equal(canonicalContract.members.length, 6);
  assert.equal(canonicalContract.responses.length, 288);
  assert.equal(canonicalContract.responses.filter((response) => response.responseType === "likert_single").length, 252);
  assert.equal(canonicalContract.responses.filter((response) => response.responseType === "sjt_best_worst").length, 36);
});

pass("recipe_only_canonical_rejected", () => {
  assert.ok(validateFixture(recipe).fixtureValidationErrors.length > 0);
});

expectFixtureInvalid("missing_question_rejected", (fixture) => fixture.members[0].responses.pop(), /48 responses/);
expectFixtureInvalid("duplicate_question_rejected", (fixture) => { fixture.members[0].responses[1] = clone(fixture.members[0].responses[0]); }, /Duplicate question/);
expectFixtureInvalid("unknown_question_rejected", (fixture) => { fixture.members[0].responses[0].question_code = "UNKNOWN_QUESTION"; }, /Unknown runtime question/);
expectFixtureInvalid("likert_missing_option_rejected", (fixture) => { delete fixture.members[0].responses[0].option_code; }, /Invalid canonical Likert option/);
expectFixtureInvalid("likert_value_mismatch_rejected", (fixture) => { fixture.members[0].responses[0].option_value = 1; }, /Invalid canonical Likert option/);
expectFixtureInvalid("sjt_missing_best_rejected", (fixture) => { delete fixture.members[0].responses[38].best_option_code; }, /Invalid canonical SJT option/);
expectFixtureInvalid("sjt_missing_worst_rejected", (fixture) => { delete fixture.members[0].responses[38].worst_option_code; }, /Invalid canonical SJT option/);
expectFixtureInvalid("sjt_same_pair_rejected", (fixture) => { fixture.members[0].responses[38].worst_option_code = fixture.members[0].responses[38].best_option_code; }, /identical/);
expectFixtureInvalid("missing_member_rejected", (fixture) => fixture.members.pop(), /member count is not six|Missing GDT-01 member/);
expectFixtureInvalid("seventh_member_rejected", (fixture) => fixture.members.push(clone(fixture.members[0])), /member count is not six|Duplicate GDT-01 member/);
expectFixtureInvalid("duplicate_candidate_rejected", (fixture) => { fixture.members[1].candidate_id = fixture.members[0].candidate_id; }, /Duplicate GDT-01 member|Missing GDT-01 member/);
expectFixtureInvalid("runtime_contract_checksum_rejected", (fixture) => { fixture.contract_checksum = "bad"; }, /checksum differs/);

pass("production_materializer_canonical_projection", () => {
  const original = clone(canonical);
  const states = canonical.members.map((member) => materializeMember(member));
  assert.deepEqual(canonical, original, "materialization must not mutate fixture input");
  assert.equal(states.length, 6);
  assert.equal(states.reduce((total, state) => total + state.savedAnswerCount, 0), 288);
  assert.equal(states.reduce((total, state) => total + Object.keys(state.savedLikertSelectionsByQuestionId).length, 0), 252);
  assert.equal(states.reduce((total, state) => total + Object.keys(state.savedSjtSelectionsByQuestionId).length, 0), 36);
  for (const state of states) {
    assert.equal(state.savedAnswerCount, 48);
    assert.equal(state.invalidSavedAnswerCount, 0);
    assert.equal(state.ignoredStaleAnswerCount, 0);
    assert.equal(Object.keys(state.savedLikertSelectionsByQuestionId).length, 42);
    assert.equal(Object.keys(state.savedSjtSelectionsByQuestionId).length, 6);
  }
});

pass("production_materializer_mutated_option_is_not_canonical", () => {
  const canonicalOptionCode = canonical.members[0].responses[0].option_code;
  const mutated = clone(canonical);
  mutated.members[0].responses[0].option_code = "NOT_A_RUNTIME_OPTION";
  const canonicalState = materializeMember(canonical.members[0]);
  const mutatedState = materializeMember(mutated.members[0]);
  assert.notDeepEqual(mutatedState, canonicalState);
  assert.equal(mutatedState.savedAnswerCount, 47);
  assert.equal(mutatedState.ignoredStaleAnswerCount, 1);
  assert.equal(canonical.members[0].responses[0].option_code, canonicalOptionCode);
});

pass("independent_rebuilds_are_deep_equal_but_not_same_reference", () => {
  const firstInput = clone(canonical);
  const secondInput = clone(canonical);
  const first = firstInput.members.map((member) => materializeMember(member));
  const second = secondInput.members.map((member) => materializeMember(member));
  assert.deepEqual(first, second);
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first[0], second[0]);
  assert.deepEqual(firstInput, canonical);
  assert.deepEqual(secondInput, canonical);
});

pass("mutated_rebuild_drifts_without_mutating_canonical_input", () => {
  const mutated = clone(canonical);
  mutated.members[0].responses[38].best_option_code = mutated.members[0].responses[38].worst_option_code;
  const canonicalBuild = canonical.members.map((member) => materializeMember(member));
  const mutatedBuild = mutated.members.map((member) => materializeMember(member));
  assert.notDeepEqual(mutatedBuild, canonicalBuild);
  assert.equal(mutatedBuild[0].invalidSavedAnswerCount, 1);
  assert.deepEqual(canonical, offline.loadJson(offline.ANSWERS));
});

const source = fs.readFileSync(__filename, "utf8");
assert.doesNotMatch(source, /=>\s*true\b/, "explicit-answer tests must not use trivial true callbacks");
process.stdout.write(`${passes.join("\n")}\n`);
process.stdout.write(`${JSON.stringify({ casesExecuted: passes.length, casesPassed: passes.length, casesFailed: 0 }, null, 2)}\n`);
