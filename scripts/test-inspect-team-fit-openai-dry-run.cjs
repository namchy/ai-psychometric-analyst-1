const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const typescript = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const inspectorPath = path.join(__dirname, "inspect-team-fit-openai-dry-run.cjs");
const inputPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-input.ts");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;
const inspectorSource = fs.readFileSync(inspectorPath, "utf8");
const {
  DEFAULT_OUTPUT_PATH,
  buildDryRunInputsFromEnv,
  buildSkippedArtifact,
  runTeamFitOpenAiDryRun,
} = require(inspectorPath);

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  for (const extension of ["", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;

    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  return candidatePath;
}

function installTypeScriptRuntime() {
  Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
    if (request === "server-only") {
      return emptyModulePath;
    }

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
    const transpiled = typescript.transpileModule(source, {
      compilerOptions: {
        module: typescript.ModuleKind.CommonJS,
        moduleResolution: typescript.ModuleResolutionKind.NodeJs,
        target: typescript.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filename,
    });

    module._compile(transpiled.outputText, filename);
  };
}

function buildEnv(overrides = {}) {
  return {
    CONFIRM_TEAM_FIT_OPENAI_DRY_RUN: "true",
    TEAM_FIT_ORGANIZATION_ID: "org-1",
    TEAM_FIT_TEAM_ID: "team-1",
    TEAM_FIT_PARTICIPANT_ID: "participant-1",
    TEAM_FIT_CANDIDATE_ASSESSMENT_ASSIGNMENT_ID: "candidate-assignment-1",
    TEAM_FIT_TEAM_AGGREGATION_SNAPSHOT_ID: "aggregation-snapshot-1",
    AI_REPORT_MODEL: "gpt-5.6-sol",
    AI_REPORT_REASONING_EFFORT: "low",
    OPENAI_API_KEY: "test-key-not-printed",
    ...overrides,
  };
}

function buildInputSnapshot() {
  return {
    inputType: "team_fit_report_input_v1",
    inputVersion: "team_fit_report_input_v2_enriched",
    reportType: "team_fit_report_v1",
    reportVersion: "v1",
    locale: "bs",
    generatedAt: "2026-07-22T10:00:00.000Z",
    organizationContext: { organizationId: "org-1", organizationName: "Org" },
    teamContext: {
      teamId: "team-1",
      teamName: "Team",
      teamSourceType: "team_dynamics_aggregation_input_snapshot",
      teamSourceId: "aggregation-snapshot-1",
    },
    candidateContext: {
      participantId: "participant-1",
      displayName: "Candidate",
      candidateSourceType: "composite_deterministic_input_snapshot",
      candidateSourceId: "candidate-assignment-1",
    },
    sourceReferences: {
      teamFitReportId: "ephemeral-1",
      candidateSourceType: "composite_deterministic_input_snapshot",
      candidateSourceId: "candidate-assignment-1",
      teamSourceType: "team_dynamics_aggregation_input_snapshot",
      teamSourceId: "aggregation-snapshot-1",
      executiveOverviewContextIncluded: false,
      roleContextIncluded: false,
    },
    candidateSignals: { sourceStatus: "available", summary: {} },
    teamSignals: { sourceStatus: "available", summary: {} },
    interpretationGuardrails: {
      noNumericFitScore: true,
      noHireNoHire: true,
      noRawTeamMemberAnswers: true,
      noIndividualTeamMemberScoreDisplay: true,
      noCandidateFacingOutput: true,
    },
    relationshipReasoningGuardrails: {
      allowedPatterns: [
        "alignment_signal",
        "complementarity_signal",
        "mixed_signal",
        "needs_validation",
      ],
      patternIsNotScore: true,
      patternIsNotRanking: true,
      patternIsNotDecision: true,
      patternIsNotRecommendation: true,
      patternIsNotHireNoHireSignal: true,
    },
  };
}

function buildValidSourceResult() {
  return {
    ok: true,
    ephemeralReportReferenceId: "ephemeral-1",
    inputSnapshot: buildInputSnapshot(),
    candidateSourceStatus: "available",
    candidateCoverage: {
      requiredCount: 3,
      completedCount: 3,
      missingTestSlugs: [],
    },
    teamSourceStatus: "available",
    teamFullCoverage: true,
  };
}

function buildFakeFs() {
  const writes = [];
  return {
    writes,
    writeFileSync(filePath, content, options) {
      writes.push({ filePath, content, options });
    },
    chmodSync(filePath, mode) {
      writes.push({ chmod: true, filePath, mode });
    },
  };
}

function buildDependencies({ sourceResult = buildValidSourceResult(), provider } = {}) {
  const calls = { source: 0, provider: 0 };
  const fakeFs = buildFakeFs();

  return {
    calls,
    fakeFs,
    randomUUID: () => "ephemeral-1",
    now: () => "2026-07-22T10:00:00.000Z",
    shouldOmitOpenAiTemperature: (model) => model === "gpt-5.6-sol",
    sourceDirectBuilder: async () => {
      calls.source += 1;
      return sourceResult;
    },
    provider: async (inputSnapshot, options) => {
      calls.provider += 1;
      assert.equal(inputSnapshot.sourceReferences.teamFitReportId, "ephemeral-1");
      assert.equal(options.model, "gpt-5.6-sol");
      assert.equal(options.apiKey, "test-key-not-printed");
      if (provider) {
        return provider(inputSnapshot, options);
      }
      return { ok: true, code: "success", snapshot: { reportType: "team_fit_report_v1" } };
    },
    fsImpl: fakeFs,
  };
}

function buildCompositeFixture() {
  return {
    contractVersion: "composite_hr_input_v1",
    targetReportContractVersion: "composite_hr_v1",
    sourceType: "assessment",
    reportType: "composite",
    audience: "hr",
    locale: "bs",
    addressingForm: "ti",
    generatedFor: {
      organizationId: "org-1",
      participantId: "participant-1",
      assessmentAssignmentId: "candidate-assignment-1",
    },
    assessmentAssignment: {
      id: "candidate-assignment-1",
      assignmentType: "standard_battery",
      status: "active",
      locale: "bs",
      createdAt: "2026-07-22T09:00:00.000Z",
    },
    sourceAttempts: [
      {
        testSlug: "ipip-neo-120-v1",
        status: "completed",
        requiredForComposite: true,
        requiredForTeamFit: false,
      },
      {
        testSlug: "safran_v1",
        status: "completed",
        requiredForComposite: true,
        requiredForTeamFit: false,
      },
      {
        testSlug: "mwms_v1",
        status: "completed",
        requiredForComposite: true,
        requiredForTeamFit: false,
      },
    ],
    coverage: {
      requiredCount: 3,
      completedCount: 3,
      missingTestSlugs: [],
    },
    deterministicInputs: {
      ipip: {
        testSlug: "ipip-neo-120-v1",
        scale: { min: 1, max: 5 },
        domains: [
          {
            domainCode: "OPENNESS",
            label: "Otvorenost",
            rawScore: 72,
            averageScore: 3.6,
            band: "balanced",
            bandLabel: "Uravnoteženo",
            displayBand: "balanced",
            displayBandLabel: "Uravnoteženo",
          },
        ],
      },
      safran: {
        testSlug: "safran_v1",
        overall: { rawScore: 18, maxScore: 30, scoreLabel: "18/30", band: "moderate", bandLabel: "Umjereno" },
        verbal: { rawScore: 7, maxScore: 10, scoreLabel: "7/10", band: "moderate", bandLabel: "Umjereno" },
        figural: { rawScore: 6, maxScore: 10, scoreLabel: "6/10", band: "moderate", bandLabel: "Umjereno" },
        numeric: { rawScore: 5, maxScore: 10, scoreLabel: "5/10", band: "moderate", bandLabel: "Umjereno" },
      },
      mwms: {
        testSlug: "mwms_v1",
        scale: { min: 1, max: 7 },
        dimensions: [
          { code: "intrinsic", label: "Intrinsic motivation", rawScore: 5, band: "higher", bandLabel: "Više izraženo" },
        ],
        motivationStructure: {
          autonomousMotivationScore: 5,
          controlledMotivationScore: 3,
          amotivationScore: 2,
        },
        summarySignals: {
          cautionFlags: {
            elevatedAmotivation: false,
            highControlledRelativeToAutonomous: false,
            mixedProfile: false,
          },
        },
      },
    },
    summarySignals: {
      personalityHighestDomains: ["OPENNESS"],
      personalityLowestDomains: ["OPENNESS"],
      cognitiveStrongestDomain: "verbal",
      cognitiveLowestDomain: "numeric",
      motivationHighestDrivers: ["intrinsic"],
      motivationLowestDrivers: ["intrinsic"],
      crossInstrumentFlags: [],
    },
    metadata: { builderVersion: "v1" },
  };
}

function buildTeamVerificationFixture() {
  const entry = (scoreKey, label) => ({
    scoreKey,
    label,
    blockKey: "tdm",
    scoreModel: "simple_linear_v1",
    entryType: "domain",
    memberCount: 6,
    meanScore0To100: 70,
    minScore0To100: 60,
    maxScore0To100: 80,
    standardDeviationScore0To100: 5,
  });

  return {
    status: "ready",
    teamAssessmentAssignmentId: "team-assignment-1",
    testSlug: "tdm-31-v1",
    aggregationVersion: "team_dynamics_final_aggregation_v1",
    aggregationSnapshotId: "aggregation-snapshot-1",
    aggregationSnapshot: {},
    scoreEntryAggregations: [
      entry("tdm-31-V1_overall", "Higher overall"),
      entry("tdm_domain_communication", "Higher communication"),
      entry("psychological_safety_overall", "Higher psychological safety"),
      entry("situational_judgment_overall", "Higher judgment"),
      entry("outcome_pulse_overall", "Higher outcome"),
    ],
    hasUnifiedOverallTeamScore: false,
    hasTdmBlockAggregation: true,
    hasTdmDomainAggregations: true,
    hasPsychologicalSafetyAggregation: true,
    hasSjtAggregation: true,
    hasOutcomePulseAggregation: true,
    includedMemberCount: 6,
    completedMemberCount: 6,
    readyScoredMemberCount: 6,
    incompleteMemberCount: 0,
    missingScoreCount: 0,
    invalidScoreCount: 0,
    createdAt: "2026-07-22T09:30:00.000Z",
    updatedAt: "2026-07-22T09:30:00.000Z",
    calculatedAt: "2026-07-22T09:30:00.000Z",
    reason: null,
  };
}

function buildReadOnlySupabase() {
  const rows = {
    organizations: [{ id: "org-1", name: "Org" }],
    teams: [{ id: "team-1", organization_id: "org-1", name: "Team", archived_at: null }],
    participants: [{ id: "participant-1", organization_id: "org-1", full_name: "Candidate" }],
    assessment_assignments: [{
      id: "candidate-assignment-1",
      organization_id: "org-1",
      participant_id: "participant-1",
      assignment_type: "standard_battery",
      status: "active",
      locale: "bs",
      created_at: "2026-07-22T09:00:00.000Z",
    }],
    team_assessment_aggregation_snapshots: [{
      id: "aggregation-snapshot-1",
      team_assessment_assignment_id: "team-assignment-1",
      team_id: "team-1",
      aggregation_version: "team_dynamics_final_aggregation_v1",
    }],
    team_assessment_assignments: [{
      id: "team-assignment-1",
      team_id: "team-1",
      package_slug: "tdm-31-v1",
    }],
  };
  const operations = [];

  return {
    operations,
    from(table) {
      const filters = [];
      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          filters.push({ column, value });
          return builder;
        },
        async maybeSingle() {
          operations.push({ table, filters: [...filters] });
          const row = (rows[table] ?? []).find((candidate) =>
            filters.every((filter) => candidate[filter.column] === filter.value),
          );
          return { data: row ?? null, error: null };
        },
      };
      return builder;
    },
  };
}

async function main() {
  const skipped = buildSkippedArtifact(buildDryRunInputsFromEnv({}), "test");
  assert.equal(skipped.metadata.databaseReads, false);
  assert.equal(skipped.metadata.openAiCalled, false);

  let skippedSourceCalls = 0;
  let skippedProviderCalls = 0;
  const skippedFs = buildFakeFs();
  const skippedResult = await runTeamFitOpenAiDryRun({
    env: {},
    dependencies: {
      sourceDirectBuilder: async () => {
        skippedSourceCalls += 1;
        throw new Error("source builder must not run");
      },
      provider: async () => {
        skippedProviderCalls += 1;
        throw new Error("provider must not run");
      },
      fsImpl: skippedFs,
    },
  });
  assert.equal(skippedResult.skipped, true);
  assert.equal(skippedSourceCalls, 0);
  assert.equal(skippedProviderCalls, 0);
  assert.equal(skippedFs.writes.length, 0);

  const missingEnvResult = await runTeamFitOpenAiDryRun({
    env: { CONFIRM_TEAM_FIT_OPENAI_DRY_RUN: "true" },
    dependencies: {
      sourceDirectBuilder: async () => {
        throw new Error("source builder must not run");
      },
      provider: async () => {
        throw new Error("provider must not run");
      },
    },
  });
  assert.equal(missingEnvResult.metadata.openAiCalled, false);
  assert.ok(missingEnvResult.sourcePreflight.blockers.some((blocker) => /missing_required_env/.test(blocker)));

  const validDependencies = buildDependencies();
  const validResult = await runTeamFitOpenAiDryRun({
    env: buildEnv(),
    dependencies: validDependencies,
  });
  assert.equal(validDependencies.calls.source, 1);
  assert.equal(validDependencies.calls.provider, 1);
  assert.equal(validResult.metadata.databaseReads, true);
  assert.equal(validResult.metadata.databaseWrites, false);
  assert.equal(validResult.metadata.openAiCalled, true);
  assert.equal(validResult.metadata.openAiCallCount, 1);
  assert.equal(validResult.metadata.reportPersisted, false);
  assert.equal(validResult.metadata.queueUsed, false);
  assert.equal(validResult.sourcePreflight.status, "ready");
  assert.equal(validResult.sourcePreflight.candidateSourceStatus, "available");
  assert.deepEqual(validResult.sourcePreflight.candidateCoverage, {
    requiredCount: 3,
    completedCount: 3,
    missingTestSlugs: [],
  });
  assert.equal(validResult.sourcePreflight.teamSourceStatus, "available");
  assert.equal(validResult.sourcePreflight.teamFullCoverage, true);
  assert.equal(validResult.requestMetadata.model, "gpt-5.6-sol");
  assert.equal(validResult.requestMetadata.reasoningEffort, "low");
  assert.equal(validResult.requestMetadata.temperatureIncluded, false);
  assert.equal(validDependencies.fakeFs.writes[0].options.mode, 0o600);
  assert.equal(validDependencies.fakeFs.writes[1].mode, 0o600);
  assert.equal(validDependencies.fakeFs.writes[0].filePath, DEFAULT_OUTPUT_PATH);

  installTypeScriptRuntime();
  const {
    buildTeamFitReportInputSnapshotFromSources,
  } = require(inputPath);
  const sourceSupabase = buildReadOnlySupabase();
  const sourceDirectResult = await buildTeamFitReportInputSnapshotFromSources(
    {
      ephemeralReportReferenceId: "ephemeral-1",
      organizationId: "org-1",
      teamId: "team-1",
      participantId: "participant-1",
      candidateAssessmentAssignmentId: "candidate-assignment-1",
      teamAggregationSourceId: "aggregation-snapshot-1",
      locale: "bs",
      generatedAt: "2026-07-22T10:00:00.000Z",
    },
    {
      supabase: sourceSupabase,
      buildCompositeInputSnapshot: async () => buildCompositeFixture(),
      loadTeamAggregationVerification: async () => buildTeamVerificationFixture(),
    },
  );
  assert.equal(sourceDirectResult.ok, true);
  assert.equal(sourceDirectResult.inputSnapshot.inputVersion, "team_fit_report_input_v2_enriched");
  assert.equal(sourceDirectResult.inputSnapshot.sourceReferences.teamFitReportId, "ephemeral-1");
  assert.equal(sourceDirectResult.inputSnapshot.candidateSignals.sourceStatus, "available");
  assert.equal(sourceDirectResult.inputSnapshot.teamSignals.sourceStatus, "available");
  assert.equal(sourceSupabase.operations.some((operation) => operation.table === "team_fit_reports"), false);

  const blockedDependencies = buildDependencies({
    sourceResult: {
      ok: false,
      reason: "candidate_source_invalid",
      message: "candidate coverage is partial",
      candidateSourceStatus: "source_invalid",
      candidateCoverage: null,
      teamSourceStatus: "available",
      teamFullCoverage: true,
    },
  });
  const blockedResult = await runTeamFitOpenAiDryRun({
    env: buildEnv(),
    dependencies: blockedDependencies,
  });
  assert.equal(blockedDependencies.calls.provider, 0);
  assert.equal(blockedResult.sourcePreflight.status, "blocked");
  assert.match(blockedResult.sourcePreflight.blockers.join(" "), /candidate_source_invalid/);

  const blockedTeamDependencies = buildDependencies({
    sourceResult: {
      ok: false,
      reason: "team_source_invalid",
      message: "team aggregation is not full coverage",
      candidateSourceStatus: "available",
      candidateCoverage: {
        requiredCount: 3,
        completedCount: 3,
        missingTestSlugs: [],
      },
      teamSourceStatus: "source_invalid",
      teamFullCoverage: false,
    },
  });
  const blockedTeamResult = await runTeamFitOpenAiDryRun({
    env: buildEnv(),
    dependencies: blockedTeamDependencies,
  });
  assert.equal(blockedTeamDependencies.calls.provider, 0);
  assert.equal(blockedTeamResult.sourcePreflight.teamSourceStatus, "source_invalid");
  assert.equal(blockedTeamResult.sourcePreflight.teamFullCoverage, false);

  const failureDependencies = buildDependencies({
    provider: async () => {
      throw new Error("controlled provider failure");
    },
  });
  const failureResult = await runTeamFitOpenAiDryRun({
    env: buildEnv(),
    dependencies: failureDependencies,
  });
  assert.equal(failureDependencies.calls.provider, 1);
  assert.equal(failureResult.metadata.openAiCallCount, 1);
  assert.equal(failureResult.providerResult.ok, false);
  assert.match(failureResult.providerResult.reason, /controlled provider failure/);
  assert.equal(failureResult.metadata.reportPersisted, false);

  assert.doesNotMatch(inspectorSource, /\.insert\s*\(/);
  assert.doesNotMatch(inspectorSource, /\.update\s*\(/);
  assert.doesNotMatch(inspectorSource, /\.delete\s*\(/);
  assert.doesNotMatch(inspectorSource, /\.upsert\s*\(/);
  assert.doesNotMatch(inspectorSource, /queueTeamFitReportShell|processTeamFitReport|persistTeamFitReportInputSnapshot/);
  assert.doesNotMatch(inspectorSource, /team_fit_reports/);
  assert.match(inspectorSource, /reasoningEffort/);
  assert.match(inspectorSource, /temperatureIncluded/);
  assert.match(inspectorSource, /gpt-5\.6-sol/);

  console.log("test-inspect-team-fit-openai-dry-run: ok");
}

main().catch((error) => {
  console.error("test-inspect-team-fit-openai-dry-run failed");
  console.error(error);
  process.exitCode = 1;
});
