const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const inspectorPath = path.join(__dirname, "inspect-team-fit-report-v2-canonical-preview.cjs");
const inspectorSource = fs.readFileSync(inspectorPath, "utf8");
const {
  CANONICAL_MODEL,
  CANONICAL_REASONING_EFFORT,
  OPENAI_CHAT_COMPLETIONS_URL,
  assertCandidateCoverage,
  assertSafeDumpPath,
  assertTeamCoverage,
  classifyCanonicalRows,
  createSingleOpenAiFetchGuard,
  loadCanonicalGdt01MemberCount,
  parseTimeoutMs,
  resolveExactCanonicalMatch,
  runCanonicalPreview,
  sanitizeForDump,
  writeDiagnosticArtifact,
} = require(inspectorPath);

const canonicalGdt01MemberCount = loadCanonicalGdt01MemberCount();
const belowCanonicalGdt01MemberCount = canonicalGdt01MemberCount - 1;
const aboveCanonicalGdt01MemberCount = canonicalGdt01MemberCount + 1;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach((entry) => deepFreeze(entry));
  return value;
}

function buildInputSnapshot() {
  return {
    inputType: "team_fit_report_input_v1",
    inputVersion: "team_fit_report_input_v2_enriched",
    reportType: "team_fit_report_v1",
    reportVersion: "v1",
    locale: "bs",
    generatedAt: "2026-07-26T10:00:00.000Z",
    organizationContext: { organizationId: "org-1", organizationName: "Partner Plus" },
    teamContext: {
      teamId: "team-1",
      teamName: "Kreditno poslovanje i rad s klijentima",
      teamSourceType: "team_dynamics_aggregation_input_snapshot",
      teamSourceId: "aggregation-1",
    },
    candidateContext: {
      participantId: "participant-1",
      displayName: "Amel Kovačević",
      candidateSourceType: "composite_deterministic_input_snapshot",
      candidateSourceId: "candidate-assignment-1",
    },
    sourceReferences: {
      teamFitReportId: "ephemeral-1",
      candidateSourceType: "composite_deterministic_input_snapshot",
      candidateSourceId: "candidate-assignment-1",
      teamSourceType: "team_dynamics_aggregation_input_snapshot",
      teamSourceId: "aggregation-1",
      executiveOverviewContextIncluded: false,
      roleContextIncluded: false,
    },
    candidateSignals: {
      sourceStatus: "available",
      summary: {},
      candidateEvidence: [
        {
          sourceTestSlug: "ipip-neo-120-v1",
          dimensionCode: "OPENNESS",
          dimensionLabel: "Otvorenost",
          rawScore: 70,
          averageScore: 3.5,
          scaleMin: 1,
          scaleMax: 5,
          band: "balanced",
          bandLabel: "Uravnoteženo",
        },
        {
          sourceTestSlug: "safran_v1",
          dimensionCode: "verbal",
          dimensionLabel: "Verbalno zaključivanje",
          rawScore: 8,
          maxScore: 10,
          band: "higher",
          bandLabel: "Više izraženo",
        },
        {
          sourceTestSlug: "mwms_v1",
          dimensionCode: "intrinsic",
          dimensionLabel: "Intrinzična motivacija",
          rawScore: 5.5,
          scaleMin: 1,
          scaleMax: 7,
          band: "higher",
          bandLabel: "Više izraženo",
        },
      ],
      sourceMetadata: {
        sourceId: "candidate-assignment-1",
        assessmentAssignmentId: "candidate-assignment-1",
        sourceTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
      },
    },
    teamSignals: {
      sourceStatus: "available",
      summary: {},
      coreSignals: [
        {
          code: "tdm_domain_coordination",
          label: "Koordinacija",
          signal: "Team pattern signal appears stable for coordination.",
        },
      ],
      sourceMetadata: {
        sourceId: "aggregation-1",
        teamAssessmentAssignmentId: "team-assignment-1",
        aggregationSnapshotId: "aggregation-1",
      },
    },
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

function buildEvidenceCatalog() {
  return {
    candidate: [
      {
        key: "candidate:ipip-neo-120-v1:OPENNESS",
        label: "Otvorenost",
        value: { sourceTestSlug: "ipip-neo-120-v1", dimensionCode: "OPENNESS" },
      },
      {
        key: "candidate:mwms_v1:intrinsic",
        label: "Intrinzična motivacija",
        value: { sourceTestSlug: "mwms_v1", dimensionCode: "intrinsic" },
      },
      {
        key: "candidate:safran_v1:verbal",
        label: "Verbalno zaključivanje",
        value: { sourceTestSlug: "safran_v1", dimensionCode: "verbal" },
      },
    ],
    team: [
      {
        key: "team:tdm_domain_coordination",
        label: "Koordinacija",
        value: { code: "tdm_domain_coordination", signal: "Stable coordination." },
      },
    ],
  };
}

function buildReportSnapshot() {
  return {
    reportType: "team_fit_report_v2",
    executiveAssessment: { mainReasons: [] },
    keySignals: [],
    likelyContributions: [],
    successConditions: [],
    frictionRisks: [],
    interviewPlan: [],
    teamIntegrationPlan: {
      adaptForThisTeam: [],
      teamPreparations: [],
      first30Days: [],
    },
    managerGuidance: [],
    interpretationLimits: [],
  };
}

function buildResolvedSource(inputSnapshot = buildInputSnapshot()) {
  return {
    inputSnapshot,
    sourceResolution: {
      organization: { id: "org-1", name: "Partner Plus", status: "active" },
      candidate: {
        fixtureKey: "GD-001",
        participantId: "participant-1",
        displayName: "Amel Kovačević",
        assignmentId: "candidate-assignment-1",
      },
      team: {
        fixtureKey: "GDT-01",
        teamId: "team-1",
        teamName: "Kreditno poslovanje i rad s klijentima",
        teamAssessmentAssignmentId: "team-assignment-1",
        aggregationSnapshotId: "aggregation-1",
      },
      ambiguityChecks: {
        organizations: 1,
        participants: 1,
        candidateAssignments: 1,
        teams: 1,
        teamAssignments: 1,
        readyAggregationSnapshots: 1,
      },
      lineage: {
        sameOrganization: true,
        candidateAssignmentMatchesParticipant: true,
        teamAssignmentMatchesTeam: true,
        aggregationSnapshotMatchesAssignment: true,
      },
      databaseTablesRead: [],
    },
    candidateCoverage: {
      requiredCount: 3,
      completedCount: 3,
      missingTestSlugs: [],
      sourceTestSlugs: ["ipip-neo-120-v1", "mwms_v1", "safran_v1"],
    },
    teamCoverage: {
      status: "ready",
      teamFullCoverage: true,
      includedMemberCount: canonicalGdt01MemberCount,
      completedMemberCount: canonicalGdt01MemberCount,
      readyScoredMemberCount: canonicalGdt01MemberCount,
      incompleteMemberCount: 0,
      missingScoreCount: 0,
      invalidScoreCount: 0,
    },
  };
}

function buildDependencies(overrides = {}) {
  const calls = { source: 0, provider: 0, fetch: 0 };
  const inputSnapshot = overrides.inputSnapshot ?? buildInputSnapshot();
  const reportSnapshot = overrides.reportSnapshot ?? buildReportSnapshot();
  const deps = {
    skipDefaultDependencies: true,
    providerVersion: "team_fit_report_v2_openai_provider_v1",
    promptVersion: "team_fit_report_v2_prompt_v1",
    schemaName: "team_fit_report_v2",
    now: () => "2026-07-26T10:00:00.000Z",
    randomUUID: () => "ephemeral-1",
    resolveCanonicalSources: async () => {
      calls.source += 1;
      return buildResolvedSource(inputSnapshot);
    },
    buildEvidenceCatalog,
    validateContract: (snapshot) => ({ ok: true, issues: [], value: snapshot }),
    validateEvidence: () => ({ ok: true, issues: [] }),
    fetchImpl: async () => {
      calls.fetch += 1;
      return { ok: true, status: 200, json: async () => ({ choices: [] }) };
    },
    provider: async (snapshot, options) => {
      calls.provider += 1;
      assert.equal(snapshot, inputSnapshot);
      assert.equal(options.model, CANONICAL_MODEL);
      assert.equal(options.reasoningEffort, CANONICAL_REASONING_EFFORT);
      await options.fetchImpl(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          Authorization: "Bearer offline-test-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          reasoning_effort: options.reasoningEffort,
          response_format: {
            type: "json_schema",
            json_schema: { name: "team_fit_report_v2", strict: true, schema: {} },
          },
          messages: [
            { role: "system", content: "system" },
            { role: "user", content: "user" },
          ],
        }),
      });
      return {
        ok: true,
        snapshot: reportSnapshot,
        rawContent: JSON.stringify(reportSnapshot),
        model: CANONICAL_MODEL,
        promptVersion: "team_fit_report_v2_prompt_v1",
        provider: "openai",
        providerVersion: "team_fit_report_v2_openai_provider_v1",
        evidenceCatalog: buildEvidenceCatalog(),
      };
    },
    ...overrides,
  };
  return { deps, calls, inputSnapshot, reportSnapshot };
}

function buildRows(overrides = {}) {
  const rows = {
    organizations: [{ id: "org-1", name: "Partner Plus", status: "active" }],
    participants: [
      {
        id: "participant-1",
        organization_id: "org-1",
        full_name: "Amel Kovačević",
      },
    ],
    teams: [
      {
        id: "team-1",
        organization_id: "org-1",
        name: "Kreditno poslovanje i rad s klijentima",
      },
    ],
    candidateAssignments: [
      {
        id: "candidate-assignment-1",
        organization_id: "org-1",
        participant_id: "participant-1",
      },
    ],
    teamAssignments: [{ id: "team-assignment-1", team_id: "team-1" }],
    aggregationSnapshots: [
      {
        id: "aggregation-1",
        team_assessment_assignment_id: "team-assignment-1",
        team_id: "team-1",
      },
    ],
  };
  return { ...rows, ...overrides };
}

function buildCompositeCoverage(overrides = {}) {
  return {
    coverage: { requiredCount: 3, completedCount: 3, missingTestSlugs: [] },
    sourceAttempts: [
      { testSlug: "ipip-neo-120-v1", status: "completed", requiredForComposite: true },
      { testSlug: "safran_v1", status: "completed", requiredForComposite: true },
      { testSlug: "mwms_v1", status: "completed", requiredForComposite: true },
    ],
    ...overrides,
  };
}

function buildTeamVerification(overrides = {}) {
  return {
    status: "ready",
    teamAssessmentAssignmentId: "team-assignment-1",
    aggregationSnapshotId: "aggregation-1",
    includedMemberCount: canonicalGdt01MemberCount,
    completedMemberCount: canonicalGdt01MemberCount,
    readyScoredMemberCount: canonicalGdt01MemberCount,
    incompleteMemberCount: 0,
    missingScoreCount: 0,
    invalidScoreCount: 0,
    ...overrides,
  };
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "team-fit-v2-preview-test-"));
  try {
    {
      const { deps, calls } = buildDependencies();
      const artifact = await runCanonicalPreview({ env: {}, dependencies: deps });
      assert.equal(artifact.metadata.mode, "no_call_preflight");
      assert.equal(artifact.metadata.openAiCalled, false);
      assert.equal(artifact.metadata.transportCallCount, 0);
      assert.equal(calls.source, 1);
      assert.equal(calls.provider, 0);
      assert.equal(calls.fetch, 0);
      assert.equal(artifact.metadata.databaseReads, true);
      assert.equal(artifact.metadata.databaseWrites, false);
      assert.equal(artifact.metadata.persistence, false);
      assert.equal(artifact.metadata.reportGenerated, false);
    }

    for (const confirmation of ["TRUE", "1", "yes", " true ", "false"]) {
      const { deps, calls } = buildDependencies();
      const artifact = await runCanonicalPreview({
        env: { CONFIRM_TEAM_FIT_V2_CANONICAL_PREVIEW: confirmation },
        dependencies: deps,
      });
      assert.equal(artifact.metadata.mode, "no_call_preflight");
      assert.equal(calls.provider, 0, `confirmation ${confirmation} must not call provider`);
      assert.equal(calls.fetch, 0);
    }

    assert.throws(
      () => resolveExactCanonicalMatch("candidate", []),
      /zero matches for candidate/,
    );
    assert.throws(
      () => resolveExactCanonicalMatch("candidate", [{ id: "1" }, { id: "2" }]),
      /ambiguous candidate; found 2 matches/,
    );

    assert.throws(
      () =>
        classifyCanonicalRows(
          buildRows({
            participants: [
              { id: "participant-1", organization_id: "org-2", full_name: "Amel" },
            ],
          }),
        ),
      /GD-001 organization mismatch/,
    );
    assert.throws(
      () =>
        classifyCanonicalRows(
          buildRows({
            candidateAssignments: [
              { id: "a1", organization_id: "org-1", participant_id: "participant-1" },
              { id: "a2", organization_id: "org-1", participant_id: "participant-1" },
            ],
          }),
        ),
      /ambiguous GD-001 standard-battery assignment/,
    );

    assert.deepEqual(assertCandidateCoverage(buildCompositeCoverage()).sourceTestSlugs, [
      "ipip-neo-120-v1",
      "mwms_v1",
      "safran_v1",
    ]);
    assert.throws(
      () =>
        assertCandidateCoverage(
          buildCompositeCoverage({
            coverage: {
              requiredCount: 3,
              completedCount: 2,
              missingTestSlugs: ["mwms_v1"],
            },
          }),
        ),
      /does not have exact 3\/3 deterministic coverage/,
    );

    assert.equal(
      assertTeamCoverage(buildTeamVerification(), {
        teamAssessmentAssignmentId: "team-assignment-1",
        aggregationSnapshotId: "aggregation-1",
        canonicalMemberCount: canonicalGdt01MemberCount,
      }).teamFullCoverage,
      true,
    );
    assert.throws(
      () =>
        assertTeamCoverage(buildTeamVerification({ missingScoreCount: 1 }), {
          teamAssessmentAssignmentId: "team-assignment-1",
          aggregationSnapshotId: "aggregation-1",
          canonicalMemberCount: canonicalGdt01MemberCount,
        }),
      /does not have verified full coverage/,
    );

    const countMismatchCases = [
      {
        includedMemberCount: belowCanonicalGdt01MemberCount,
        completedMemberCount: belowCanonicalGdt01MemberCount,
        readyScoredMemberCount: belowCanonicalGdt01MemberCount,
      },
      {
        includedMemberCount: aboveCanonicalGdt01MemberCount,
        completedMemberCount: aboveCanonicalGdt01MemberCount,
        readyScoredMemberCount: aboveCanonicalGdt01MemberCount,
      },
      {
        includedMemberCount: canonicalGdt01MemberCount,
        completedMemberCount: belowCanonicalGdt01MemberCount,
        readyScoredMemberCount: belowCanonicalGdt01MemberCount,
      },
      {
        includedMemberCount: belowCanonicalGdt01MemberCount,
        completedMemberCount: canonicalGdt01MemberCount,
        readyScoredMemberCount: canonicalGdt01MemberCount,
      },
      {
        includedMemberCount: canonicalGdt01MemberCount,
        completedMemberCount: canonicalGdt01MemberCount,
        readyScoredMemberCount: belowCanonicalGdt01MemberCount,
      },
      {
        includedMemberCount: undefined,
        completedMemberCount: canonicalGdt01MemberCount,
        readyScoredMemberCount: canonicalGdt01MemberCount,
      },
      {
        includedMemberCount: canonicalGdt01MemberCount,
        completedMemberCount: String(canonicalGdt01MemberCount),
        readyScoredMemberCount: canonicalGdt01MemberCount,
      },
    ];
    for (const counts of countMismatchCases) {
      const verification = deepFreeze(buildTeamVerification(counts));
      const before = JSON.stringify(verification);
      const actualCounts = `${String(counts.includedMemberCount)}/${String(counts.completedMemberCount)}/${String(counts.readyScoredMemberCount)}`;
      const expectedErrorMessage =
        `Canonical GDT-01 coverage mismatch: expected included/completed/readyScored ${canonicalGdt01MemberCount}/${canonicalGdt01MemberCount}/${canonicalGdt01MemberCount}, received ${actualCounts}.`;
      assert.throws(
        () =>
          assertTeamCoverage(verification, {
            teamAssessmentAssignmentId: "team-assignment-1",
            aggregationSnapshotId: "aggregation-1",
            canonicalMemberCount: canonicalGdt01MemberCount,
          }),
        (error) => {
          assert.equal(error.message, expectedErrorMessage);
          return true;
        },
      );
      assert.equal(JSON.stringify(verification), before);

      const frozenInput = deepFreeze(buildInputSnapshot());
      const inputBefore = JSON.stringify(frozenInput);
      const { deps, calls } = buildDependencies({ inputSnapshot: frozenInput });
      deps.resolveCanonicalSources = async () => {
        calls.source += 1;
        assertTeamCoverage(verification, {
          teamAssessmentAssignmentId: "team-assignment-1",
          aggregationSnapshotId: "aggregation-1",
          canonicalMemberCount: canonicalGdt01MemberCount,
        });
      };
      await assert.rejects(
        () =>
          runCanonicalPreview({
            env: {
              CONFIRM_TEAM_FIT_V2_CANONICAL_PREVIEW: "true",
              OPENAI_API_KEY: "offline-test-secret",
            },
            dependencies: deps,
          }),
        (error) => {
          assert.equal(error.message, expectedErrorMessage);
          return true;
        },
      );
      assert.equal(calls.source, 1);
      assert.equal(calls.provider, 0);
      const transportCallCount = calls.fetch;
      assert.equal(transportCallCount, 0);
      assert.equal(JSON.stringify(frozenInput), inputBefore);
    }

    {
      const outputPath = path.join(tempRoot, "confirmed.json");
      const { deps, calls } = buildDependencies();
      const artifact = await runCanonicalPreview({
        env: {
          CONFIRM_TEAM_FIT_V2_CANONICAL_PREVIEW: "true",
          TEAM_FIT_V2_CANONICAL_PREVIEW_PATH: outputPath,
          TEAM_FIT_V2_CANONICAL_PREVIEW_TIMEOUT_MS: "900000",
          OPENAI_API_KEY: "offline-test-secret",
        },
        dependencies: deps,
      });
      assert.equal(artifact.metadata.openAiCalled, true);
      assert.equal(artifact.metadata.transportCallCount, 1);
      assert.equal(calls.provider, 1);
      assert.equal(calls.fetch, 1);
      assert.equal(artifact.requestSummary.model, CANONICAL_MODEL);
      assert.equal(artifact.requestSummary.reasoningEffort, CANONICAL_REASONING_EFFORT);
      assert.equal(artifact.requestSummary.temperaturePropertyPresent, false);
      assert.equal(artifact.requestSummary.responseFormat, "json_schema");
      assert.equal(artifact.requestSummary.schemaName, "team_fit_report_v2");
      assert.equal(artifact.requestSummary.schemaStrict, true);
      assert.equal(artifact.providerResult.contractValidation, "passed");
      assert.equal(artifact.providerResult.evidenceValidation, "passed");
      assert.equal(artifact.metadata.databaseWrites, false);
      assert.equal(artifact.metadata.persistence, false);
      assert.equal(artifact.metadata.reportPersisted, false);
      assert.equal(fs.statSync(outputPath).mode & 0o777, 0o600);
    }

    {
      let baseCalls = 0;
      const guard = createSingleOpenAiFetchGuard(async () => {
        baseCalls += 1;
        return { ok: true };
      });
      const init = {
        method: "POST",
        body: JSON.stringify({
          model: CANONICAL_MODEL,
          reasoning_effort: CANONICAL_REASONING_EFFORT,
          response_format: {
            type: "json_schema",
            json_schema: { name: "team_fit_report_v2", strict: true },
          },
          messages: [],
        }),
      };
      await guard.fetchImpl(OPENAI_CHAT_COMPLETIONS_URL, init);
      await assert.rejects(
        () => guard.fetchImpl(OPENAI_CHAT_COMPLETIONS_URL, init),
        /Second OpenAI transport attempt is blocked/,
      );
      assert.equal(baseCalls, 1);
      assert.equal(guard.getTransportCallCount(), 1);
      assert.equal(guard.wasSecondTransportBlocked(), true);
    }

    {
      let sourceCalls = 0;
      await assert.rejects(
        () =>
          runCanonicalPreview({
            env: {
              CONFIRM_TEAM_FIT_V2_CANONICAL_PREVIEW: "true",
              OPENAI_API_KEY: "offline-test-secret",
            },
            dependencies: {
              skipDefaultDependencies: true,
              model: "gpt-4o",
              resolveCanonicalSources: async () => {
                sourceCalls += 1;
              },
            },
          }),
        /Canonical preview model must be gpt-5.6-sol/,
      );
      assert.equal(sourceCalls, 0);
    }

    assert.equal(parseTimeoutMs("900000"), 900000);
    assert.throws(() => parseTimeoutMs("0"), /must be between/);
    assert.throws(() => parseTimeoutMs("1.5"), /positive integer/);
    assert.throws(() => assertSafeDumpPath("relative.json"), /absolute/);
    assert.throws(() => assertSafeDumpPath("/var/tmp/out.json"), /inside \/tmp/);
    assert.throws(() => assertSafeDumpPath("/tmp/out.txt"), /\.json/);

    {
      const sanitized = sanitizeForDump({
        apiKey: "sk-secret",
        nested: { Authorization: "Bearer abc", safe: "Bearer xyz" },
      });
      assert.equal(sanitized.apiKey, "[REDACTED]");
      assert.equal(sanitized.nested.Authorization, "[REDACTED]");
      assert.equal(sanitized.nested.safe, "Bearer [REDACTED]");

      const secretPath = path.join(tempRoot, "secret-redaction.json");
      writeDiagnosticArtifact(secretPath, {
        metadata: { apiKey: "sk-secret", authorization: "Bearer abc" },
      });
      const written = fs.readFileSync(secretPath, "utf8");
      assert.equal(written.includes("sk-secret"), false);
      assert.equal(written.includes("Bearer abc"), false);
      assert.equal(fs.statSync(secretPath).mode & 0o777, 0o600);
    }

    {
      const frozenInput = deepFreeze(buildInputSnapshot());
      const frozenReport = deepFreeze(buildReportSnapshot());
      const inputBefore = JSON.stringify(frozenInput);
      const reportBefore = JSON.stringify(frozenReport);
      const outputPath = path.join(tempRoot, "immutable.json");
      const { deps } = buildDependencies({
        inputSnapshot: frozenInput,
        reportSnapshot: frozenReport,
      });
      const artifact = await runCanonicalPreview({
        env: {
          CONFIRM_TEAM_FIT_V2_CANONICAL_PREVIEW: "true",
          TEAM_FIT_V2_CANONICAL_PREVIEW_PATH: outputPath,
          OPENAI_API_KEY: "offline-test-secret",
        },
        dependencies: deps,
      });
      assert.equal(JSON.stringify(frozenInput), inputBefore);
      assert.equal(JSON.stringify(frozenReport), reportBefore);
      assert.deepEqual(artifact.reportSnapshot, frozenReport);
    }

    const forbiddenImports = [
      "team-fit-report-lifecycle",
      "team-fit-report-processor",
      "team-fit-report-display",
      "team-fit-report-renderer",
      "persistTeamFitReportInputSnapshot",
      "queueTeamFitReportShell",
      "processTeamFitReport",
    ];
    forbiddenImports.forEach((name) => {
      assert.equal(inspectorSource.includes(name), false, `Inspector must not import/call ${name}.`);
    });
    assert.equal(inspectorSource.includes("buildTeamFitReportInputSnapshotFromSources"), true);
    assert.equal(/\.from\([^)]*\)\s*\.\s*(insert|update|upsert|delete)\s*\(/s.test(inspectorSource), false);
    assert.equal(inspectorSource.includes(".rpc("), false);

    process.stdout.write("Team Fit V2 canonical preview inspector tests passed.\n");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
