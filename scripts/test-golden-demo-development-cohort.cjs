const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const cohort = require("./process-golden-demo-development-cohort.cjs");

assert.deepEqual(cohort.DEVELOPMENT_CANDIDATE_IDS, [
  "GD-006", "GD-007", "GD-008", "GD-009", "GD-010", "GD-011", "GD-012",
  "GD-013", "GD-014", "GD-015", "GD-016", "GD-017", "GD-018",
]);
assert.deepEqual(cohort.DEVELOPMENT_CANDIDATE_PAIRS, [
  ["GD-006", "GD-007"],
  ["GD-008", "GD-009"],
  ["GD-010", "GD-011"],
  ["GD-012", "GD-013"],
  ["GD-014", "GD-015"],
  ["GD-016", "GD-017"],
  ["GD-018"],
]);
assert.equal(cohort.MAX_CANDIDATE_CONCURRENCY, 2);
assert.equal(cohort.REMOTE_WRITE_OPT_IN, "DEEP_PROFILE_ALLOW_REMOTE_DB_WRITES");

assert.deepEqual(cohort.parseCli(["--phase", "preflight"]), {
  phase: "preflight",
  apply: false,
  resume: false,
  verbose: false,
});
assert.deepEqual(cohort.parseCli(["--phase", "foundation", "--apply", "--verbose"]), {
  phase: "foundation",
  apply: true,
  resume: false,
  verbose: true,
});
assert.deepEqual(cohort.parseCli(["--phase", "foundation", "--apply", "--resume"]), {
  phase: "foundation",
  apply: true,
  resume: true,
  verbose: false,
});
assert.throws(() => cohort.parseCli([]), /explicit --phase/);
assert.throws(() => cohort.parseCli(["--phase", "preflight", "--apply"]), /not allowed/);
assert.throws(() => cohort.parseCli(["--phase", "foundation"]), /requires --apply/);
assert.throws(() => cohort.parseCli(["--phase", "foundation", "--resume"]), /requires --apply/);
assert.throws(() => cohort.parseCli(["--phase", "preflight", "--resume"]), /only allowed/);
assert.throws(() => cohort.parseCli(["--phase", "reports", "--apply", "--resume"]), /only allowed/);
assert.throws(() => cohort.parseCli(["--phase", "verify", "--unknown"]), /Unknown argument/);
assert.throws(() => cohort.parseCli(["--phase", "holdout"]), /Unsupported cohort phase/);

const migration = fs.readFileSync(
  path.join(projectRoot, "supabase/migrations/20260802150000_expand_golden_demo_development_cohort.sql"),
  "utf8",
);
assert.match(migration, /create_golden_demo_standard_battery_fixture_v2/);
for (const candidateId of cohort.DEVELOPMENT_CANDIDATE_IDS) {
  assert.match(migration, new RegExp(candidateId));
}
assert.doesNotMatch(migration, /v_candidate_id not in \([^)]*GD-019/);
assert.match(migration, /v_original_definition/);
assert.match(
  fs.readFileSync(
    path.join(projectRoot, "supabase/migrations/20260802123000_generalize_golden_demo_legacy_addressing.sql"),
    "utf8",
  ),
  /v_existing_addressing_form is not null/,
);

function buildRunner({ failCandidate = null, initialStates = {} } = {}) {
  const calls = [];
  const fixtureApplied = new Set();
  const scored = new Set();
  const reportsComplete = new Set();
  const stateByCandidate = new Map(
    cohort.DEVELOPMENT_CANDIDATE_IDS.map((candidateId) => [candidateId, initialStates[candidateId] ?? "EMPTY"]),
  );
  const responseCounts = {
    "ipip-neo-120-v1": 120,
    safran_v1: 45,
    mwms_v1: 19,
  };

  function fixtureState(candidateId) {
    const state = stateByCandidate.get(candidateId);
    if (state === "SCORED_EXACT" || scored.has(candidateId)) return "CONFLICT";
    if (state === "UNSCORED_EXACT" || fixtureApplied.has(candidateId)) return "EXACT_MATCH";
    return state;
  }

  function fixtureDryRun(candidateId) {
    const state = fixtureState(candidateId);
    if (state === "EMPTY") {
      return {
        state,
        assignment: { action: "create", id: null },
        attempts: Object.fromEntries(Object.keys(responseCounts).map((slug) => [slug, "create"])),
        responses: { expected: 184, resolved: 184, insert: 184, existingByTest: { ...Object.fromEntries(Object.keys(responseCounts).map((slug) => [slug, 0])) } },
        blockers: [],
        writesPerformed: false,
      };
    }
    if (state === "EXACT_MATCH") {
      return {
        state,
        assignment: { action: "reuse", id: `assignment-${candidateId}` },
        attempts: Object.fromEntries(Object.keys(responseCounts).map((slug) => [slug, "reuse"])),
        responses: { expected: 184, resolved: 184, insert: 0, existingByTest: { ...responseCounts } },
        blockers: [],
        writesPerformed: false,
      };
    }
    return {
      state,
      assignment: { action: "blocked", id: `assignment-${candidateId}` },
      attempts: {},
      responses: { expected: 184, resolved: 184, insert: 0, existingByTest: { ...responseCounts } },
      blockers: [`simulated ${state} foundation state`],
      writesPerformed: false,
    };
  }

  function scoringDryRun(candidateId) {
    const state = stateByCandidate.get(candidateId);
    if (state === "SCORED_EXACT" || scored.has(candidateId)) {
      return {
        scoringState: "SCORED_EXACT",
        fixtureCompatibilityState: "EXACT_MATCH",
        expectedScoreVerification: { ok: true, matched: 47, expected: 47, errors: [] },
        writesPerformed: false,
      };
    }
    if (state === "UNSCORED_EXACT" || fixtureApplied.has(candidateId)) {
      return {
        scoringState: "UNSCORED_EXACT",
        fixtureCompatibilityState: "EXACT_MATCH",
        expectedScoreVerification: { ok: false, matched: 0, expected: 47, errors: ["No persisted dimensions yet."] },
        writesPerformed: false,
      };
    }
    return {
      scoringState: state === "EMPTY" ? "CONFLICT" : state,
      fixtureCompatibilityState: state === "EMPTY" ? "CONFLICT" : state,
      expectedScoreVerification: { ok: false, matched: 0, expected: 47, errors: [`simulated ${state} scoring state`] },
      writesPerformed: false,
    };
  }

  let active = 0;
  let maxActive = 0;
  let activeReportProcesses = 0;
  let maxReportProcesses = 0;
  let maxFoundationProcesses = 0;

  async function runner(request) {
    const operatorArgs = request.operatorArgs;
    const candidateId = operatorArgs.includes("--candidate")
      ? operatorArgs[operatorArgs.indexOf("--candidate") + 1]
      : null;
    const scriptName = path.basename(request.script);
    const isApply = operatorArgs.includes("--apply");
    calls.push({ scriptName, candidateId, operatorArgs: [...operatorArgs], env: { ...request.env } });

    if (scriptName === "verify-golden-demo-expected-scores.cjs") {
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          ok: true,
          candidateId,
          answers: { total: 184 },
          expectedScores: { matched: 47, total: 47 },
        }),
        stderr: "",
      };
    }

    if (scriptName === "write-gd-001-db-fixture.cjs") {
      if (isApply) {
        if (fixtureState(candidateId) !== "EMPTY") {
          return { exitCode: 1, stdout: "", stderr: `fixture apply unexpectedly reached ${candidateId}` };
        }
        fixtureApplied.add(candidateId);
        stateByCandidate.set(candidateId, "UNSCORED_EXACT");
        return { exitCode: 0, stdout: JSON.stringify({ stateAfter: "EXACT_MATCH", writesPerformed: true }), stderr: "" };
      }
      return {
        exitCode: 0,
        stdout: JSON.stringify(fixtureDryRun(candidateId)),
        stderr: "",
      };
    }

    if (scriptName === "score-gd-001.cjs") {
      if (isApply) {
        if (scoringDryRun(candidateId).scoringState !== "UNSCORED_EXACT") {
          return { exitCode: 1, stdout: "", stderr: `scoring apply unexpectedly reached ${candidateId}` };
        }
        scored.add(candidateId);
        stateByCandidate.set(candidateId, "SCORED_EXACT");
        return { exitCode: 0, stdout: JSON.stringify({ stateAfter: "SCORED_EXACT", writesPerformed: true }), stderr: "" };
      }
      return {
        exitCode: 0,
        stdout: JSON.stringify(scoringDryRun(candidateId)),
        stderr: "",
      };
    }

    if (scriptName === "process-golden-demo-individual-report-package.cjs") {
      if (!isApply) {
        const complete = reportsComplete.has(candidateId);
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            sourceState: "SCORED_EXACT",
            packageState: complete ? "COMPLETE" : "READY_TO_APPLY",
            plannedOpenAiCalls: complete ? 0 : 5,
            artifactStates: cohort.DEVELOPMENT_CANDIDATE_IDS.slice(0, 0).concat([
              "ipip_hr", "safran_hr", "mwms_hr", "composite_hr", "individual_development_profile",
            ]).map((key) => ({ key, status: complete ? "READY_VALID" : "MISSING" })),
            blockers: [],
            participantId: `participant-${candidateId}`,
            writesPerformed: false,
          }),
          stderr: "",
        };
      }
      active += 1;
      activeReportProcesses += 1;
      maxActive = Math.max(maxActive, active);
      maxReportProcesses = Math.max(maxReportProcesses, activeReportProcesses);
      await new Promise((resolve) => setTimeout(resolve, candidateId === failCandidate ? 5 : 15));
      active -= 1;
      activeReportProcesses -= 1;
      if (candidateId === failCandidate) {
        return { exitCode: 1, stdout: "", stderr: `simulated failure for ${candidateId}` };
      }
      reportsComplete.add(candidateId);
      return { exitCode: 0, stdout: JSON.stringify({ stateAfter: "COMPLETE", writesPerformed: true }), stderr: "" };
    }

    throw new Error(`Unexpected mocked script ${scriptName}`);
  }

  return {
    runner,
    calls,
    get maxConcurrency() { return maxActive; },
    get maxReportProcesses() { return maxReportProcesses; },
    get maxFoundationProcesses() { return maxFoundationProcesses; },
  };
}

async function main() {
  const readOnly = buildRunner();
  const preflight = await cohort.run(["--phase", "preflight"], { runner: readOnly.runner, env: {} });
  assert.equal(preflight.candidateCount, 13);
  assert.equal(preflight.responses, 2392);
  assert.equal(preflight.expectedScoreChecks, 611);
  assert.equal(readOnly.calls.some((call) => call.operatorArgs.includes("--apply")), false);
  assert.ok(readOnly.calls.every((call) => call.env.DEEP_PROFILE_ALLOW_REMOTE_DB_WRITES === undefined));

  const foundation = buildRunner();
  const foundationResult = await cohort.run(
    ["--phase", "foundation", "--apply"],
    { runner: foundation.runner, env: { DEEP_PROFILE_ALLOW_REMOTE_DB_WRITES: "true" } },
  );
  assert.equal(foundationResult.scoredExactCandidates, 13);
  assert.equal(foundationResult.responses, 2392);
  assert.equal(foundationResult.dimensionScores, 520);
  assert.equal(foundationResult.expectedScoreChecks, 611);
  assert.equal(foundationResult.writesPerformed, true);
  const foundationApplyOrder = foundation.calls
    .filter((call) => call.scriptName === "write-gd-001-db-fixture.cjs" && call.operatorArgs.includes("--apply"))
    .map((call) => call.candidateId);
  assert.deepEqual(foundationApplyOrder, cohort.DEVELOPMENT_CANDIDATE_IDS);
  assert.ok(foundation.calls.filter((call) => call.operatorArgs.includes("--apply")).every((call) => call.env.DEEP_PROFILE_ALLOW_REMOTE_DB_WRITES === "true"));

  assert.doesNotThrow(() => cohort.assertScoringDryRun({
    scoringState: "UNSCORED_EXACT",
    expectedScoreVerification: { ok: false, matched: 0, expected: 47, errors: ["No persisted dimensions yet."] },
    writesPerformed: false,
  }, "GD-006", "UNSCORED_EXACT"));
  assert.throws(() => cohort.assertScoringDryRun({
    scoringState: "SCORED_EXACT",
    expectedScoreVerification: { ok: false, matched: 0, expected: 47, errors: ["not scored"] },
    writesPerformed: false,
  }, "GD-006", "SCORED_EXACT"), /SCORED_EXACT verification failed/);
  assert.doesNotThrow(() => cohort.assertScoringDryRun({
    scoringState: "SCORED_EXACT",
    expectedScoreVerification: { ok: true, matched: 47, expected: 47, errors: [] },
    writesPerformed: false,
  }, "GD-006", "SCORED_EXACT"));

  const strictResumeGuard = buildRunner({ initialStates: { "GD-006": "UNSCORED_EXACT" } });
  await assert.rejects(
    cohort.run(
      ["--phase", "foundation", "--apply"],
      { runner: strictResumeGuard.runner, env: { DEEP_PROFILE_ALLOW_REMOTE_DB_WRITES: "true" } },
    ),
    /requires EMPTY fixture state for GD-006/,
  );
  assert.equal(strictResumeGuard.calls.some((call) => call.operatorArgs.includes("--apply")), false);

  const resumed = buildRunner({ initialStates: { "GD-006": "UNSCORED_EXACT" } });
  const resumedResult = await cohort.run(
    ["--phase", "foundation", "--apply", "--resume"],
    { runner: resumed.runner, env: { DEEP_PROFILE_ALLOW_REMOTE_DB_WRITES: "true" } },
  );
  const resumedFixtureApplies = resumed.calls
    .filter((call) => call.scriptName === "write-gd-001-db-fixture.cjs" && call.operatorArgs.includes("--apply"))
    .map((call) => call.candidateId);
  const resumedScoringApplies = resumed.calls
    .filter((call) => call.scriptName === "score-gd-001.cjs" && call.operatorArgs.includes("--apply"))
    .map((call) => call.candidateId);
  assert.deepEqual(resumedFixtureApplies, cohort.DEVELOPMENT_CANDIDATE_IDS.slice(1));
  assert.deepEqual(resumedScoringApplies, cohort.DEVELOPMENT_CANDIDATE_IDS);
  assert.equal(resumedResult.candidates[0].fixtureAction, "skip_exact_match");
  assert.equal(resumedResult.candidates[0].scoringAction, "apply");
  assert.equal(resumedResult.writesPerformed, true);

  const scoredResume = buildRunner({ initialStates: { "GD-006": "SCORED_EXACT" } });
  const scoredResumeResult = await cohort.run(
    ["--phase", "foundation", "--apply", "--resume"],
    { runner: scoredResume.runner, env: { DEEP_PROFILE_ALLOW_REMOTE_DB_WRITES: "true" } },
  );
  assert.equal(scoredResumeResult.candidates[0].fixtureAction, "skip_exact_match");
  assert.equal(scoredResumeResult.candidates[0].scoringAction, "skip_exact_match");
  assert.equal(scoredResume.calls.some((call) => call.candidateId === "GD-006" && call.operatorArgs.includes("--apply")), false);

  for (const blockedState of ["PARTIAL", "CONFLICT"]) {
    const blocked = buildRunner({ initialStates: { "GD-006": blockedState } });
    await assert.rejects(
      cohort.run(
        ["--phase", "foundation", "--apply", "--resume"],
        { runner: blocked.runner, env: { DEEP_PROFILE_ALLOW_REMOTE_DB_WRITES: "true" } },
      ),
      new RegExp(`Foundation resume is blocked for GD-006`),
    );
    assert.equal(blocked.calls.some((call) => call.operatorArgs.includes("--apply")), false);
  }

  const resumeNoOptIn = buildRunner({ initialStates: { "GD-006": "UNSCORED_EXACT" } });
  await assert.rejects(
    cohort.run(
      ["--phase", "foundation", "--apply", "--resume"],
      { runner: resumeNoOptIn.runner, env: {} },
    ),
    /DEEP_PROFILE_ALLOW_REMOTE_DB_WRITES=true/,
  );
  assert.equal(resumeNoOptIn.calls.length, 0);

  const reports = buildRunner();
  const reportResult = await cohort.run(
    ["--phase", "reports", "--apply"],
    { runner: reports.runner, env: { DEEP_PROFILE_ALLOW_REMOTE_DB_WRITES: "true" } },
  );
  assert.equal(reportResult.readyReports, 65);
  assert.equal(reportResult.usageEventsExpected, 78);
  assert.equal(reportResult.maxCandidateConcurrency, 2);
  assert.equal(reports.maxReportProcesses, 2);
  const reportApplyOrder = reports.calls
    .filter((call) => call.scriptName === "process-golden-demo-individual-report-package.cjs" && call.operatorArgs.includes("--apply"))
    .map((call) => call.candidateId);
  assert.deepEqual(reportApplyOrder, cohort.DEVELOPMENT_CANDIDATE_PAIRS.flat());

  const failedPair = buildRunner({ failCandidate: "GD-008" });
  await assert.rejects(
    cohort.run(
      ["--phase", "reports", "--apply"],
      { runner: failedPair.runner, env: { DEEP_PROFILE_ALLOW_REMOTE_DB_WRITES: "true" } },
    ),
    /GD-008/,
  );
  const failedPairApplyCandidates = failedPair.calls
    .filter((call) => call.scriptName === "process-golden-demo-individual-report-package.cjs" && call.operatorArgs.includes("--apply"))
    .map((call) => call.candidateId);
  assert.deepEqual(failedPairApplyCandidates, ["GD-006", "GD-007", "GD-008", "GD-009"]);
  assert.equal(failedPair.calls.some((call) => ["GD-010", "GD-011", "GD-012", "GD-013", "GD-014", "GD-015", "GD-016", "GD-017", "GD-018"].includes(call.candidateId) && call.operatorArgs.includes("--apply")), false);

  const noOptIn = buildRunner();
  await assert.rejects(
    cohort.run(["--phase", "foundation", "--apply"], { runner: noOptIn.runner, env: {} }),
    /DEEP_PROFILE_ALLOW_REMOTE_DB_WRITES=true/,
  );
  assert.equal(noOptIn.calls.length, 0);

  const usageEvents = cohort.DEVELOPMENT_CANDIDATE_IDS.flatMap((candidateId) => Array.from({ length: 6 }, (_, index) => ({
    id: `${candidateId}-usage-${index}`,
    participant_id: `participant-${candidateId}`,
    report_type: index < 3 ? "individual" : index === 3 || index === 4 ? "composite" : "individual_development_profile",
    call_purpose: index < 3 ? "single_test_hr_generation" : index === 3 ? "composite_hr_generation" : index === 4 ? "composite_hr_diagnostic_review" : "individual_development_profile_generation",
    request_status: "succeeded",
    completed_at: "2026-08-02T00:00:00.000Z",
  })));
  assert.doesNotThrow(() => cohort.assertUsageEvidence(usageEvents, cohort.DEVELOPMENT_CANDIDATE_IDS.map((candidateId) => `participant-${candidateId}`)));

  assert.equal(cohort.DEVELOPMENT_CANDIDATE_IDS.includes("GD-019"), false);
  console.log("Golden Demo development cohort adapter tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
