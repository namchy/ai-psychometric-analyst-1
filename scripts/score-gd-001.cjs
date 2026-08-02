const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) return candidatePath;
  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;
    if (fs.existsSync(withExtension)) return withExtension;
  }
  return candidatePath;
}

function installTypeScriptRuntime() {
  Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
    if (request === "server-only") return emptyModulePath;
    if (request.startsWith("@/")) {
      return originalResolveFilename.call(
        this,
        resolveWithExtensions(path.join(projectRoot, request.slice(2))),
        parent,
        isMain,
        options,
      );
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };
  require.extensions[".ts"] = function compileTypeScript(module, filename) {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
      fileName: filename,
    });
    module._compile(output.outputText, filename);
  };
}

installTypeScriptRuntime();

const {
  GD_001_TEST_SLUGS,
  getGoldenDemoCandidateContract,
  classifyGd001FixtureState,
} = require("../lib/golden-demo/db-fixture-writer.ts");
const {
  buildGd001ScoringPlan,
  classifyGd001ScoringState,
  executeGd001ScoringApply,
  parseGd001ScoringCli,
  verifyPersistedGd001Scores,
} = require("../lib/golden-demo/gd-001-scoring-operator.ts");
const {
  loadGoldenDemoCsvFoundation,
  loadGoldenDemoRepoContract,
} = require("../lib/golden-demo/csv-loader.ts");
const { validateGoldenDemoCsvFoundation } = require("../lib/golden-demo/csv-validator.ts");
const {
  createReadOnlyRepository,
  loadEnvFileIfPresent,
  redactSecrets,
  requireEnvironment,
} = require("./write-gd-001-db-fixture.cjs");

async function loadScoringInspection({ supabase, repository, foundation }) {
  const resolved = await repository.inspect();
  const fixture = classifyGd001FixtureState(resolved);
  const attempts = resolved.snapshot.attempts;
  const slugByAttemptId = new Map(attempts.map((attempt) => [attempt.id, attempt.test_slug]));
  const attemptIds = attempts.map((attempt) => attempt.id);
  let dimensionRows = [];
  if (attemptIds.length > 0) {
    const { data, error } = await supabase
      .from("dimension_scores")
      .select("attempt_id, dimension, raw_score")
      .in("attempt_id", attemptIds);
    if (error) throw new Error(`Failed to load persisted dimension scores: ${error.message}`);
    dimensionRows = data ?? [];
  }
  const dimensionScores = dimensionRows.map((row) => ({
    testSlug: slugByAttemptId.get(row.attempt_id) ?? "unknown",
    dimension: row.dimension,
    rawScore: Number(row.raw_score),
  }));
  const countByTest = (predicate) =>
    Object.fromEntries(
      GD_001_TEST_SLUGS.map((slug) => [
        slug,
        resolved.snapshot.responses.filter((response) => {
          const attempt = attempts.find((item) => item.id === response.attempt_id);
          return attempt?.test_slug === slug && predicate(response);
        }).length,
      ]),
    );
  const participant = resolved.snapshot.participant;
  const assignment = resolved.snapshot.assignments[0];
  const expectedByIdentity = new Map(
    resolved.expectedResponses.map((response) => [
      `${response.attemptId}\u0000${response.questionId}`,
      response,
    ]),
  );
  const structurallyMatchingResponses = resolved.snapshot.responses.filter((response) => {
    const expected = expectedByIdentity.get(`${response.attempt_id}\u0000${response.question_id}`);
    return Boolean(
      expected &&
        response.response_kind === expected.responseKind &&
        response.answer_option_id === expected.answerOptionId &&
        response.text_value === expected.textValue,
    );
  }).length;
  const structuralFixtureExact = Boolean(
    participant &&
      participant.organization_id === resolved.snapshot.organizationId &&
      participant.user_id === null &&
      participant.full_name.trim() === resolved.candidate.fullName &&
      participant.email.trim().toLowerCase() === resolved.candidate.email &&
      participant.participant_type === "employee" &&
      participant.status === "active" &&
      (participant.addressing_form === resolved.candidate.addressingForm ||
        (["GD-002", "GD-003"].includes(resolved.candidate.candidateId) && participant.addressing_form === null)) &&
      resolved.snapshot.assignments.length === 1 &&
      assignment?.organization_id === resolved.snapshot.organizationId &&
      assignment?.participant_id === participant.id &&
      assignment?.assignment_type === "standard_battery" &&
      assignment?.status === "active" &&
      assignment?.locale === "bs" &&
      assignment?.completed_at === null &&
      attempts.length === 3 &&
      resolved.snapshot.links.length === 3 &&
      resolved.snapshot.responses.length === 184 &&
      structurallyMatchingResponses === 184 &&
      GD_001_TEST_SLUGS.every((slug, position) => {
        const attempt = attempts.find((item) => item.test_slug === slug);
        const link = resolved.snapshot.links.find((item) => item.test_slug === slug);
        return Boolean(
          attempt &&
            attempt.test_id === resolved.testIdsBySlug[slug] &&
            attempt.organization_id === resolved.snapshot.organizationId &&
            attempt.participant_id === participant.id &&
            attempt.user_id === null &&
            attempt.locale === "bs" &&
            attempt.addressing_form_snapshot === resolved.candidate.addressingForm &&
            link &&
            link.assessment_assignment_id === assignment.id &&
            link.attempt_id === attempt.id &&
            link.test_id === attempt.test_id &&
            link.role_in_assignment === "standard_component" &&
            link.required_for_composite === true &&
            link.required_for_team_fit === false &&
            link.position === position,
        );
      }),
  );
  const snapshot = {
    fixtureState: fixture.state,
    fixtureBlockers: fixture.reasons,
    structuralFixtureExact,
    participantId: resolved.snapshot.participant?.id ?? null,
    assignmentId: resolved.snapshot.assignments[0]?.id ?? null,
    attemptIds: Object.fromEntries(
      GD_001_TEST_SLUGS.map((slug) => [
        slug,
        attempts.find((attempt) => attempt.test_slug === slug)?.id ?? null,
      ]),
    ),
    attempts: attempts.map((attempt) => ({
      testSlug: attempt.test_slug,
      status: attempt.status,
      completedAt: attempt.completed_at,
      scoredStartedAt: attempt.scored_started_at,
    })),
    responseCounts: countByTest(() => true),
    rawValueCounts: countByTest((response) => response.raw_value !== null),
    scoredValueCounts: countByTest((response) => response.scored_value !== null),
    dimensionScores,
    attemptReportCount: resolved.snapshot.attemptReportCount,
    assessmentReportCount: resolved.snapshot.assessmentReportCount,
  };
  const verification = verifyPersistedGd001Scores({
    foundation,
    dimensionScores,
    candidateId: resolved.candidate.candidateId,
  });
  return { resolved, snapshot, verification };
}

async function runProductionScoring({ supabase, inspection }) {
  // These imports are the canonical production completion validator and scorer.
  // Report orchestration is intentionally not imported or invoked.
  const { loadAssessmentCompletionState } = require("../lib/assessment/completion-server.ts");
  const { persistCompletedAssessmentResults } = require("../lib/assessment/scoring.ts");

  for (const testSlug of GD_001_TEST_SLUGS) {
    const testId = inspection.resolved.testIdsBySlug[testSlug];
    const attemptId = inspection.snapshot.attemptIds[testSlug];
    if (!testId || !attemptId) throw new Error(`Missing resolved test/attempt identity for ${testSlug}.`);
    const completion = await loadAssessmentCompletionState(testId, attemptId);
    if (!completion.isComplete) {
      throw new Error(`${testSlug} is incomplete: ${completion.missingRequiredQuestionIds.length} required responses are missing.`);
    }
    const completedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("attempts")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", attemptId)
      .eq("test_id", testId)
      .eq("status", "in_progress")
      .is("completed_at", null)
      .select("id, status, completed_at")
      .maybeSingle();
    if (error || !data || data.status !== "completed" || !data.completed_at) {
      throw new Error(`Failed to transition ${testSlug} attempt to completed: ${error?.message ?? "no row updated"}`);
    }
    const results = await persistCompletedAssessmentResults(testId, attemptId);
    if (!results) throw new Error(`Production scoring returned no results for ${testSlug}.`);
  }
}

async function run(argv = process.argv.slice(2), env = process.env) {
  const options = parseGd001ScoringCli(argv);
  process.stderr.write(`Mode: ${options.mode}\n`);
  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));
  const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL", env);
  const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY", env);
  const foundation = loadGoldenDemoCsvFoundation(projectRoot);
  const contract = loadGoldenDemoRepoContract(projectRoot);
  const validation = validateGoldenDemoCsvFoundation(foundation, contract);
  if (!validation.ok) {
    throw new Error(`Golden Demo CSV validation failed with ${validation.errors.length} error(s).`);
  }
  const candidate = getGoldenDemoCandidateContract(foundation, options.candidateId);

  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const repository = createReadOnlyRepository({ supabase, foundation, candidate });
  const inspection = await loadScoringInspection({ supabase, repository, foundation });
  const classification = classifyGd001ScoringState({
    ...inspection,
    candidateId: candidate.candidateId,
  });
  const plan = buildGd001ScoringPlan({
    mode: options.mode,
    snapshot: inspection.snapshot,
    classification,
    verification: inspection.verification,
    candidateId: candidate.candidateId,
  });

  if (options.mode === "dry-run") {
    if (options.verbose) plan.verbose = { fixtureBlockers: inspection.snapshot.fixtureBlockers };
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return plan;
  }

  const result = await executeGd001ScoringApply({
    snapshot: inspection.snapshot,
    classification,
    runProductionScoring: () => runProductionScoring({ supabase, inspection }),
    inspectAfter: async () => {
      const after = await loadScoringInspection({ supabase, repository, foundation });
      return { snapshot: after.snapshot, verification: after.verification };
    },
  });
  const output = {
    mode: "apply",
    candidateId: candidate.candidateId,
    fixtureWriterState: inspection.snapshot.fixtureState,
    fixtureCompatibilityState: classification.fixtureCompatibilityState,
    scoringState: classification.scoringState,
    ...result,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return output;
}

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(`GD-001 scoring operator error: ${redactSecrets(error instanceof Error ? error.message : String(error))}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  installTypeScriptRuntime,
  loadScoringInspection,
  run,
  runProductionScoring,
};
