const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const FIXTURE_SCRIPT = path.join(__dirname, "write-gd-001-db-fixture.cjs");
const SCORING_SCRIPT = path.join(__dirname, "score-gd-001.cjs");
const REPORT_SCRIPT = path.join(__dirname, "process-golden-demo-individual-report-package.cjs");
const EXPECTED_SCORE_SCRIPT = path.join(__dirname, "verify-golden-demo-expected-scores.cjs");

const DEVELOPMENT_CANDIDATE_IDS = Object.freeze([
  "GD-006",
  "GD-007",
  "GD-008",
  "GD-009",
  "GD-010",
  "GD-011",
  "GD-012",
  "GD-013",
  "GD-014",
  "GD-015",
  "GD-016",
  "GD-017",
  "GD-018",
]);

const DEVELOPMENT_CANDIDATE_PAIRS = Object.freeze([
  ["GD-006", "GD-007"],
  ["GD-008", "GD-009"],
  ["GD-010", "GD-011"],
  ["GD-012", "GD-013"],
  ["GD-014", "GD-015"],
  ["GD-016", "GD-017"],
  ["GD-018"],
]);

const MAX_CANDIDATE_CONCURRENCY = 2;
const REMOTE_WRITE_OPT_IN = "DEEP_PROFILE_ALLOW_REMOTE_DB_WRITES";

function parseCli(argv = []) {
  let phase = null;
  let apply = false;
  let verbose = false;
  let resume = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--phase") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--phase requires one of preflight, foundation, reports, or verify.");
      }
      phase = value;
      index += 1;
      continue;
    }
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--verbose") {
      verbose = true;
      continue;
    }
    if (argument === "--resume") {
      resume = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!phase) throw new Error("An explicit --phase is required.");
  if (!["preflight", "foundation", "reports", "verify"].includes(phase)) {
    throw new Error(`Unsupported cohort phase: ${phase}.`);
  }
  if ((phase === "preflight" || phase === "verify") && apply) {
    throw new Error(`--apply is not allowed for the read-only ${phase} phase.`);
  }
  if ((phase === "foundation" || phase === "reports") && !apply) {
    throw new Error(`The ${phase} phase requires --apply.`);
  }
  if (resume && (phase !== "foundation" || !apply)) {
    throw new Error("--resume is only allowed with --phase foundation --apply.");
  }

  return { phase, apply, resume, verbose };
}

function assertRemoteWriteAuthorization(options, env = process.env) {
  if (!options.apply) throw new Error("Remote write phase requires --apply.");
  if (env[REMOTE_WRITE_OPT_IN] !== "true") {
    throw new Error(`Remote write phase requires ${REMOTE_WRITE_OPT_IN}=true.`);
  }
}

function loadEnvFileIfPresent(filePath, env = process.env) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const name = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (env[name] === undefined) env[name] = value;
  }
}

function buildChildEnv(apply, env = process.env) {
  const childEnv = { ...env };
  if (apply) childEnv[REMOTE_WRITE_OPT_IN] = "true";
  else delete childEnv[REMOTE_WRITE_OPT_IN];
  return childEnv;
}

function runChildProcess({ command, args, env = process.env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode, signal) => resolve({ stdout, stderr, exitCode, signal }));
  });
}

function parseJsonOutput(stdout, context) {
  const text = String(stdout ?? "").trim();
  try {
    return JSON.parse(text);
  } catch {
    for (let position = text.lastIndexOf("{"); position >= 0; position = text.lastIndexOf("{", position - 1)) {
      try {
        return JSON.parse(text.slice(position).trim());
      } catch {
        // Fall through to the contextual error below.
      }
    }
  }
  throw new Error(`${context} returned non-JSON output.`);
}

async function invokeScript(script, args, options = {}, dependencies = {}) {
  const runner = dependencies.runner ?? runChildProcess;
  const result = await runner({
    command: process.execPath,
    script,
    args: [script, ...args],
    operatorArgs: args,
    env: buildChildEnv(Boolean(options.apply), options.env ?? dependencies.env ?? process.env),
    candidateId: options.candidateId ?? null,
    phase: options.phase ?? null,
  });
  const exitCode = result.exitCode ?? 0;
  if (exitCode !== 0) {
    const detail = String(result.stderr ?? result.error ?? "child process failed").trim();
    throw new Error(`${path.basename(script)} failed for ${options.candidateId ?? "cohort"}: ${detail}`);
  }
  return parseJsonOutput(result.stdout, `${path.basename(script)} for ${options.candidateId ?? "cohort"}`);
}

function assertOfflineScoreVerification(result, candidateId) {
  if (
    result?.ok !== true ||
    result?.answers?.total !== 184 ||
    result?.expectedScores?.matched !== 47 ||
    result?.expectedScores?.total !== 47
  ) {
    throw new Error(`Offline exact verification failed for ${candidateId}.`);
  }
  return result;
}

async function inspectCandidateSource(candidateId, options, dependencies) {
  const writer = await invokeScript(
    FIXTURE_SCRIPT,
    ["--candidate", candidateId, "--dry-run", "--verbose"],
    { ...options, candidateId, apply: false },
    dependencies,
  );
  if (writer.state !== "EMPTY" || writer.writesPerformed !== false || writer.responses?.resolved !== 184 || (writer.blockers ?? []).length !== 0) {
    throw new Error(`Preflight requires EMPTY fixture state for ${candidateId}.`);
  }

  const expectedScores = await invokeScript(
    EXPECTED_SCORE_SCRIPT,
    [
      "--candidate", candidateId,
      "--assessment", "ipip-neo-120-v1",
      "--assessment", "safran_v1",
      "--assessment", "mwms_v1",
    ],
    { ...options, candidateId, apply: false },
    dependencies,
  );
  assertOfflineScoreVerification(expectedScores, candidateId);
  return { candidateId, fixture: writer, offlineScoreVerification: expectedScores };
}

async function runPreflight(options, dependencies = {}) {
  const candidates = [];
  for (const candidateId of DEVELOPMENT_CANDIDATE_IDS) {
    candidates.push(await inspectCandidateSource(candidateId, options, dependencies));
  }
  return {
    phase: "preflight",
    candidateIds: [...DEVELOPMENT_CANDIDATE_IDS],
    candidates,
    candidateCount: candidates.length,
    fixtureState: "EMPTY",
    responses: candidates.reduce((sum, candidate) => sum + candidate.fixture.responses.resolved, 0),
    expectedScoreChecks: candidates.reduce((sum, candidate) => sum + candidate.offlineScoreVerification.expectedScores.matched, 0),
    writesPerformed: false,
  };
}

function assertFoundationDryRun(result, candidateId, expectedState) {
  if (result?.state !== expectedState || result?.writesPerformed !== false) {
    throw new Error(`Fixture ${expectedState} verification failed for ${candidateId}.`);
  }
}

function assertScoringDryRun(result, candidateId, expectedState) {
  const verification = result?.expectedScoreVerification;
  const baseValid = result?.scoringState === expectedState && result?.writesPerformed === false;
  const unscoredValid =
    expectedState === "UNSCORED_EXACT" &&
    verification?.ok === false &&
    verification?.matched === 0 &&
    verification?.expected === 47;
  const scoredValid =
    expectedState === "SCORED_EXACT" &&
    verification?.ok === true &&
    verification?.matched === 47 &&
    verification?.expected === 47 &&
    Array.isArray(verification?.errors) &&
    verification.errors.length === 0;
  if (!baseValid || !(unscoredValid || scoredValid)) {
    throw new Error(`Scoring ${expectedState} verification failed for ${candidateId}.`);
  }
}

function assertResumeFixtureState(result, candidateId, expectedState) {
  const responseCounts = result?.responses?.existingByTest ?? {};
  const expectedResponseCounts = {
    "ipip-neo-120-v1": 120,
    safran_v1: 45,
    mwms_v1: 19,
  };
  const hasExpectedResponses = Object.entries(expectedResponseCounts).every(
    ([slug, expected]) => responseCounts[slug] === expected,
  );
  const createActions = Object.values(result?.attempts ?? {}).every((action) => action === "create");
  const reuseActions = Object.values(result?.attempts ?? {}).every((action) => action === "reuse");
  const expected = expectedState === "EMPTY"
    ? result?.state === "EMPTY" &&
      result?.assignment?.action === "create" &&
      createActions &&
      result?.responses?.insert === 184 &&
      Object.values(responseCounts).every((count) => count === 0)
    : result?.state === "EXACT_MATCH" &&
      result?.assignment?.action === "reuse" &&
      reuseActions &&
      result?.responses?.insert === 0 &&
      hasExpectedResponses;
  if (!expected || result?.writesPerformed !== false || (result?.blockers ?? []).length !== 0) {
    throw new Error(`Fixture ${expectedState} resume verification failed for ${candidateId}.`);
  }
}

async function inspectFoundationResumeState(candidateId, options, dependencies) {
  const fixture = await invokeScript(
    FIXTURE_SCRIPT,
    ["--candidate", candidateId, "--dry-run", "--verbose"],
    { ...options, candidateId, apply: false },
    dependencies,
  );
  const scoring = await invokeScript(
    SCORING_SCRIPT,
    ["--candidate", candidateId, "--dry-run", "--verbose"],
    { ...options, candidateId, apply: false },
    dependencies,
  );

  if (fixture.state === "EMPTY") {
    assertResumeFixtureState(fixture, candidateId, "EMPTY");
    return { state: "EMPTY", fixture, scoring };
  }
  if (
    fixture.state === "EXACT_MATCH" &&
    scoring.fixtureCompatibilityState === "EXACT_MATCH" &&
    scoring.scoringState === "UNSCORED_EXACT"
  ) {
    assertResumeFixtureState(fixture, candidateId, "EXACT_MATCH");
    assertScoringDryRun(scoring, candidateId, "UNSCORED_EXACT");
    return { state: "UNSCORED_EXACT", fixture, scoring };
  }
  if (
    scoring.fixtureCompatibilityState === "EXACT_MATCH" &&
    scoring.scoringState === "SCORED_EXACT"
  ) {
    assertScoringDryRun(scoring, candidateId, "SCORED_EXACT");
    return { state: "SCORED_EXACT", fixture, scoring };
  }
  throw new Error(
    `Foundation resume is blocked for ${candidateId}: fixture=${fixture.state}, ` +
      `fixtureCompatibility=${scoring.fixtureCompatibilityState ?? "unknown"}, ` +
      `scoring=${scoring.scoringState ?? "unknown"}.`,
  );
}

async function runFoundationCandidate(candidateId, options, dependencies) {
  const startedAt = Date.now();
  const resumeState = options.resume
    ? await inspectFoundationResumeState(candidateId, options, dependencies)
    : { state: "EMPTY", fixture: null, scoring: null };
  if (resumeState.state === "SCORED_EXACT") {
    return {
      candidateId,
      foundationStateBefore: resumeState.state,
      fixtureAction: "skip_exact_match",
      scoringAction: "skip_exact_match",
      fixtureApply: null,
      fixtureAfter: resumeState.fixture,
      scoringBefore: resumeState.scoring,
      scoringApply: null,
      scoringAfter: resumeState.scoring,
      durationMs: Date.now() - startedAt,
    };
  }

  let fixtureApply = null;
  let fixtureAfter = resumeState.fixture;
  if (resumeState.state === "EMPTY") {
    fixtureApply = await invokeScript(
      FIXTURE_SCRIPT,
      ["--candidate", candidateId, "--apply"],
      { ...options, candidateId, apply: true },
      dependencies,
    );
    if (fixtureApply.stateAfter !== "EXACT_MATCH" || fixtureApply.writesPerformed !== true) {
      throw new Error(`Fixture apply did not finish EXACT_MATCH for ${candidateId}.`);
    }
    fixtureAfter = await invokeScript(
      FIXTURE_SCRIPT,
      ["--candidate", candidateId, "--dry-run", "--verbose"],
      { ...options, candidateId, apply: false },
      dependencies,
    );
    assertFoundationDryRun(fixtureAfter, candidateId, "EXACT_MATCH");
  }

  const scoringBefore = resumeState.state === "UNSCORED_EXACT"
    ? resumeState.scoring
    : await invokeScript(
        SCORING_SCRIPT,
        ["--candidate", candidateId, "--dry-run", "--verbose"],
        { ...options, candidateId, apply: false },
        dependencies,
      );
  assertScoringDryRun(scoringBefore, candidateId, "UNSCORED_EXACT");

  const scoringApply = await invokeScript(
    SCORING_SCRIPT,
    ["--candidate", candidateId, "--apply"],
    { ...options, candidateId, apply: true },
    dependencies,
  );
  if (scoringApply.stateAfter !== "SCORED_EXACT" || scoringApply.writesPerformed !== true) {
    throw new Error(`Scoring apply did not finish SCORED_EXACT for ${candidateId}.`);
  }
  const scoringAfter = await invokeScript(
    SCORING_SCRIPT,
    ["--candidate", candidateId, "--dry-run", "--verbose"],
    { ...options, candidateId, apply: false },
    dependencies,
  );
  assertScoringDryRun(scoringAfter, candidateId, "SCORED_EXACT");
  return {
    candidateId,
    fixtureApply,
    fixtureAfter,
    scoringBefore,
    scoringApply,
    scoringAfter,
    foundationStateBefore: resumeState.state,
    fixtureAction: resumeState.state === "EMPTY" ? "apply" : "skip_exact_match",
    scoringAction: "apply",
    durationMs: Date.now() - startedAt,
  };
}

async function runFoundation(options, dependencies = {}) {
  assertRemoteWriteAuthorization(options, dependencies.env ?? process.env);
  const preflight = options.resume ? null : await runPreflight(options, dependencies);
  const candidates = [];
  for (const candidateId of DEVELOPMENT_CANDIDATE_IDS) {
    candidates.push(await runFoundationCandidate(candidateId, options, dependencies));
  }
  return {
    phase: "foundation",
    preflight,
    candidates,
    candidateCount: candidates.length,
    assignments: candidates.length,
    attempts: candidates.length * 3,
    responses: candidates.length * 184,
    dimensionScores: candidates.length * 40,
    expectedScoreChecks: candidates.length * 47,
    scoredExactCandidates: candidates.length,
    reports: 0,
    writesPerformed: candidates.some(
      (candidate) => candidate.fixtureApply?.writesPerformed === true || candidate.scoringApply?.writesPerformed === true,
    ),
  };
}

function assertReportReadyToApply(result, candidateId) {
  if (
    result?.sourceState !== "SCORED_EXACT" ||
    result?.packageState !== "READY_TO_APPLY" ||
    result?.plannedOpenAiCalls !== 5 ||
    result?.writesPerformed !== false ||
    (result?.blockers ?? []).length !== 0
  ) {
    throw new Error(`Report preflight did not produce READY_TO_APPLY for ${candidateId}.`);
  }
}

function assertReportComplete(result, candidateId) {
  const artifactStates = Array.isArray(result?.artifactStates)
    ? result.artifactStates.map((artifact) => artifact.status)
    : Object.values(result?.artifactStates ?? {});
  if (
    result?.sourceState !== "SCORED_EXACT" ||
    result?.packageState !== "COMPLETE" ||
    result?.plannedOpenAiCalls !== 0 ||
    result?.writesPerformed !== false ||
    (result?.blockers ?? []).length !== 0 ||
    artifactStates.length !== 5 ||
    artifactStates.some((state) => state !== "READY_VALID")
  ) {
    throw new Error(`Report package did not finish COMPLETE for ${candidateId}.`);
  }
}

async function runReportCandidate(candidateId, options, dependencies) {
  const preflight = await invokeScript(
    REPORT_SCRIPT,
    ["--candidate", candidateId, "--dry-run", "--verbose"],
    { ...options, candidateId, apply: false },
    dependencies,
  );
  if (preflight?.packageState === "COMPLETE") {
    assertReportComplete(preflight, candidateId);
    return {
      candidateId,
      action: "skip_ready",
      preflight,
      apply: null,
      after: preflight,
      durationMs: 0,
    };
  }
  assertReportReadyToApply(preflight, candidateId);
  const startedAt = Date.now();
  const apply = await invokeScript(
    REPORT_SCRIPT,
    ["--candidate", candidateId, "--apply", "--verbose"],
    { ...options, candidateId, apply: true },
    dependencies,
  );
  const after = await invokeScript(
    REPORT_SCRIPT,
    ["--candidate", candidateId, "--dry-run", "--verbose"],
    { ...options, candidateId, apply: false },
    dependencies,
  );
  assertReportComplete(after, candidateId);
  return { candidateId, action: "apply", preflight, apply, after, durationMs: Date.now() - startedAt };
}

async function runReports(options, dependencies = {}) {
  assertRemoteWriteAuthorization(options, dependencies.env ?? process.env);
  const pairs = [];
  for (const pair of DEVELOPMENT_CANDIDATE_PAIRS) {
    const settled = await Promise.allSettled(
      pair.map((candidateId) => runReportCandidate(candidateId, options, dependencies)),
    );
    const completed = settled.filter((result) => result.status === "fulfilled").map((result) => result.value);
    pairs.push({ candidateIds: [...pair], maxConcurrency: Math.min(pair.length, MAX_CANDIDATE_CONCURRENCY), completed });
    const failures = settled
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
    if (failures.length > 0) {
      throw new Error(`Report pair ${pair.join(" + ")} stopped the cohort: ${failures.join(" | ")}`);
    }
  }

  return {
    phase: "reports",
    candidateCount: DEVELOPMENT_CANDIDATE_IDS.length,
    pairs,
    readyReports: DEVELOPMENT_CANDIDATE_IDS.length * 5,
    usageEventsExpected: DEVELOPMENT_CANDIDATE_IDS.length * 6,
    maxCandidateConcurrency: MAX_CANDIDATE_CONCURRENCY,
    automaticRetries: 0,
    participantReports: 0,
    writesPerformed: true,
  };
}

function loadSupabaseEnvironment(env = process.env) {
  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"), env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Usage verification requires Supabase environment variables.");
  return { url, serviceRoleKey };
}

async function readUsageEvidence({ participantIds, env = process.env }) {
  const { url, serviceRoleKey } = loadSupabaseEnvironment({ ...env });
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase
    .from("ai_generation_usage_events")
    .select("id, organization_id, participant_id, assessment_assignment_id, attempt_id, attempt_report_id, assessment_report_id, report_type, call_purpose, provider, requested_model, response_model, request_status, input_tokens, cached_input_tokens, cache_write_tokens, output_tokens, reasoning_tokens, total_tokens, duration_ms, historical_estimated_cost_usd, cost_estimate_status, provider_request_id, started_at, completed_at")
    .in("participant_id", participantIds)
    .order("completed_at", { ascending: false });
  if (error) throw new Error(`Failed to load cohort usage events: ${error.message}`);
  return data ?? [];
}

function assertUsageEvidence(events, participantIds) {
  const expectedPurposes = [
    "single_test_hr_generation",
    "composite_hr_generation",
    "composite_hr_diagnostic_review",
    "individual_development_profile_generation",
  ];
  const byParticipant = new Map(participantIds.map((id) => [id, []]));
  for (const event of events) {
    if (byParticipant.has(event.participant_id)) byParticipant.get(event.participant_id).push(event);
  }
  const errors = [];
  for (const [participantId, candidateEvents] of byParticipant) {
    if (candidateEvents.length !== 6) errors.push(`${participantId}: expected 6 usage events, received ${candidateEvents.length}.`);
    if (candidateEvents.some((event) => event.request_status !== "succeeded")) errors.push(`${participantId}: usage event is not succeeded.`);
    if (candidateEvents.some((event) => event.completed_at === null)) errors.push(`${participantId}: orphan started usage event.`);
    for (const purpose of expectedPurposes) {
      const count = candidateEvents.filter((event) => event.call_purpose === purpose).length;
      const expected = purpose === "single_test_hr_generation" ? 3 : 1;
      if (count !== expected) errors.push(`${participantId}: ${purpose} expected ${expected}, received ${count}.`);
    }
  }
  if (events.length !== participantIds.length * 6) errors.push(`Expected ${participantIds.length * 6} candidate-scoped events, received ${events.length}.`);
  if (new Set(events.map((event) => event.id)).size !== events.length) errors.push("Duplicate usage event IDs detected.");
  if (errors.length > 0) throw new Error(`Cohort usage verification failed: ${errors.join(" | ")}`);
}

async function runVerify(options, dependencies = {}) {
  const candidates = [];
  for (const candidateId of DEVELOPMENT_CANDIDATE_IDS) {
    const report = await invokeScript(
      REPORT_SCRIPT,
      ["--candidate", candidateId, "--dry-run", "--verbose"],
      { ...options, candidateId, apply: false },
      dependencies,
    );
    assertReportComplete(report, candidateId);
    candidates.push(report);
  }
  const participantIds = candidates.map((candidate) => candidate.participantId).filter(Boolean);
  const usageReader = dependencies.usageReader ?? readUsageEvidence;
  const usageEvents = await usageReader({ participantIds, env: dependencies.env ?? process.env });
  assertUsageEvidence(usageEvents, participantIds);
  return {
    phase: "verify",
    candidates,
    candidateCount: candidates.length,
    readyReports: candidates.length * 5,
    usageEvents,
    usageEventCount: usageEvents.length,
    successfulUsageEvents: usageEvents.filter((event) => event.request_status === "succeeded").length,
    failedUsageEvents: usageEvents.filter((event) => event.request_status === "failed").length,
    orphanStartedEvents: usageEvents.filter((event) => event.request_status === "started" || event.completed_at === null).length,
    duplicateUsageEvents: usageEvents.length - new Set(usageEvents.map((event) => event.id)).size,
    participantReports: 0,
    writesPerformed: false,
  };
}

async function run(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseCli(argv);
  const env = dependencies.env ?? process.env;
  if (options.phase === "preflight") return runPreflight(options, dependencies);
  if (options.phase === "foundation") return runFoundation(options, { ...dependencies, env });
  if (options.phase === "reports") return runReports(options, { ...dependencies, env });
  return runVerify(options, { ...dependencies, env });
}

if (require.main === module) {
  run().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`Golden Demo development cohort error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEVELOPMENT_CANDIDATE_IDS,
  DEVELOPMENT_CANDIDATE_PAIRS,
  MAX_CANDIDATE_CONCURRENCY,
  REMOTE_WRITE_OPT_IN,
  assertRemoteWriteAuthorization,
  parseCli,
  parseJsonOutput,
  assertScoringDryRun,
  inspectFoundationResumeState,
  run,
  runChildProcess,
  runPreflight,
  runFoundation,
  runReports,
  runVerify,
  assertUsageEvidence,
};
