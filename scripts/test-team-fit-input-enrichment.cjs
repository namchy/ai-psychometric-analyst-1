const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-input.ts");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const lifecycleStubDir = fs.mkdtempSync(path.join(os.tmpdir(), "team-fit-input-enrichment-"));
const lifecycleStubPath = path.join(lifecycleStubDir, "team-fit-lifecycle-stub.cjs");
const originalResolveFilename = Module._resolveFilename;

fs.writeFileSync(
  lifecycleStubPath,
  [
    "module.exports = {",
    "  TEAM_FIT_REPORT_TYPE: \"team_fit_report_v1\",",
    "  TEAM_FIT_REPORT_VERSION: \"v1\",",
    "  TEAM_FIT_CANDIDATE_SOURCE_TYPE: \"composite_deterministic_input_snapshot\",",
    "  TEAM_FIT_TEAM_SOURCE_TYPE: \"team_dynamics_aggregation_input_snapshot\",",
    "};",
  ].join("\n"),
);

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;

    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only" || request === "@/lib/supabase/admin") {
    return emptyModulePath;
  }

  if (request === "@/lib/b2b/team-fit-report-lifecycle") {
    return lifecycleStubPath;
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
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  TEAM_FIT_REPORT_INPUT_VERSION,
  buildTeamFitReportInputSnapshot,
} = require(helperPath);

function createSupabaseStub(initialState = {}) {
  const state = {
    organizations: [...(initialState.organizations ?? [])],
    teams: [...(initialState.teams ?? [])],
    participants: [...(initialState.participants ?? [])],
    team_fit_reports: [...(initialState.team_fit_reports ?? [])],
    team_assessment_aggregation_snapshots: [
      ...(initialState.team_assessment_aggregation_snapshots ?? []),
    ],
  };

  function applyFilters(rows, filters) {
    return rows.filter((row) =>
      filters.every((filter) => {
        if (filter.type === "eq") {
          return row[filter.column] === filter.value;
        }

        return true;
      }),
    );
  }

  return {
    state,
    from(table) {
      const query = {
        filters: [],
      };

      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          query.filters.push({ type: "eq", column, value });
          return builder;
        },
        async maybeSingle() {
          const rows = applyFilters(state[table] ?? [], query.filters);
          return { data: rows[0] ?? null, error: null };
        },
      };

      return builder;
    },
  };
}

function buildBaseState(overrides = {}) {
  return {
    organizations: [{ id: "org-1", name: "Deep Profile" }],
    teams: [{ id: "team-1", organization_id: "org-1", name: "Team A", archived_at: null }],
    participants: [{ id: "participant-1", organization_id: "org-1", full_name: "Amina Candidate" }],
    team_fit_reports: [
      {
        id: "report-1",
        organization_id: "org-1",
        team_id: "team-1",
        participant_id: "participant-1",
        candidate_source_type: "composite_deterministic_input_snapshot",
        candidate_source_id: null,
        team_source_type: "team_dynamics_aggregation_input_snapshot",
        team_source_id: null,
        optional_context: { locale: "bs" },
        report_type: "team_fit_report_v1",
        report_version: "v1",
        report_status: "queued",
        input_snapshot: null,
        report_snapshot: null,
        created_at: "2026-06-02T10:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function buildCompositeSnapshot() {
  return {
    contractVersion: "composite_hr_input_v1",
    generatedFor: {
      assessmentAssignmentId: "assignment-1",
    },
    sourceAttempts: [
      { requiredForTeamFit: true, status: "completed", testSlug: "ipip_neo_120" },
      { requiredForTeamFit: true, status: "completed", testSlug: "mwms_v1" },
      { requiredForTeamFit: true, status: "completed", testSlug: "safran_hr_v1" },
    ],
    coverage: {
      missingTestSlugs: [],
    },
    deterministicInputs: {
      ipip: {
        domains: [
          {
            domainCode: "agreeableness",
            label: "Agreeableness",
            displayBandLabel: "Higher",
          },
          {
            domainCode: "conscientiousness",
            label: "Conscientiousness",
            displayBandLabel: "Higher",
          },
          {
            domainCode: "neuroticism",
            label: "Neuroticism",
            displayBandLabel: "Lower",
          },
        ],
      },
      mwms: {
        dimensions: [
          { code: "identified", label: "Identified motivation" },
          { code: "intrinsic", label: "Intrinsic motivation" },
          { code: "amotivation", label: "Amotivation" },
        ],
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
      personalityHighestDomains: ["agreeableness", "conscientiousness"],
      personalityLowestDomains: ["neuroticism"],
      cognitiveStrongestDomain: "verbal",
      cognitiveLowestDomain: "numeric",
      motivationHighestDrivers: ["identified", "intrinsic"],
      motivationLowestDrivers: ["amotivation"],
      crossInstrumentFlags: ["structured_follow_through_signal"],
    },
    metadata: {
      builderVersion: "v1",
    },
  };
}

function buildReadyAggregationResult() {
  return {
    status: "ready",
    aggregationVersion: "team_dynamics_final_aggregation_v1",
    teamAssessmentAssignmentId: "team-assignment-1",
    aggregationSnapshotId: "agg-snapshot-1",
    scoreEntryAggregations: [
      {
        scoreKey: "tdm-31-V1_overall",
        label: "Overall team collaboration",
        blockKey: "tdm",
        memberCount: 5,
        standardDeviationScore0To100: 12,
      },
      {
        scoreKey: "tdm_domain_communication",
        label: "Communication",
        blockKey: "tdm",
        memberCount: 5,
        standardDeviationScore0To100: 10,
      },
      {
        scoreKey: "tdm_domain_coordination",
        label: "Coordination",
        blockKey: "tdm",
        memberCount: 5,
        standardDeviationScore0To100: 20,
      },
      {
        scoreKey: "psychological_safety_overall",
        label: "Psychological safety",
        blockKey: "psychological_safety",
        memberCount: 5,
        standardDeviationScore0To100: 9,
      },
      {
        scoreKey: "situational_judgment_overall",
        label: "Situational judgment",
        blockKey: "sjt",
        memberCount: 5,
        standardDeviationScore0To100: 11,
      },
      {
        scoreKey: "outcome_pulse_overall",
        label: "Outcome pulse",
        blockKey: "outcome_pulse",
        memberCount: 5,
        standardDeviationScore0To100: 13,
      },
    ],
    hasTdmDomainAggregations: true,
    hasPsychologicalSafetyAggregation: true,
    hasSjtAggregation: true,
    hasOutcomePulseAggregation: true,
    includedMemberCount: 5,
    completedMemberCount: 5,
    readyScoredMemberCount: 5,
    incompleteMemberCount: 0,
    missingScoreCount: 0,
    invalidScoreCount: 0,
    reason: null,
  };
}

function assertForbiddenKeysAbsent(value) {
  const forbiddenKeys = new Set([
    "rawAnswers",
    "rawResponses",
    "individualAnswers",
    "memberScores",
    "individualScores",
    "fullSnapshot",
    "rawItemText",
    "fitScore",
    "score0To100",
    "hireRecommendation",
  ]);

  function walk(node) {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (!node || typeof node !== "object") {
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      assert.equal(forbiddenKeys.has(key), false, `Found forbidden key in input snapshot: ${key}`);
      walk(child);
    }
  }

  walk(value);
}

async function main() {
  const placeholderState = buildBaseState();
  const placeholderSupabase = createSupabaseStub(placeholderState);
  const placeholderResult = await buildTeamFitReportInputSnapshot(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: placeholderSupabase,
      buildCompositeInputSnapshot: async () => {
        throw new Error("placeholder path should not dereference candidate source");
      },
      loadTeamAggregationVerification: async () => {
        throw new Error("placeholder path should not dereference team source");
      },
    },
  );

  assert.equal(placeholderResult.ok, true);
  assert.equal(placeholderResult.inputSnapshot.inputVersion, TEAM_FIT_REPORT_INPUT_VERSION);
  assert.equal(
    placeholderResult.inputSnapshot.candidateSignals.sourceStatus,
    "placeholder_pending_composite_input",
  );
  assert.equal(
    placeholderResult.inputSnapshot.teamSignals.sourceStatus,
    "placeholder_pending_team_aggregation_input",
  );

  const candidateState = buildBaseState({
    team_fit_reports: [
      {
        ...buildBaseState().team_fit_reports[0],
        candidate_source_id: "assignment-1",
      },
    ],
  });
  const candidateResult = await buildTeamFitReportInputSnapshot(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: createSupabaseStub(candidateState),
      buildCompositeInputSnapshot: async () => buildCompositeSnapshot(),
      loadTeamAggregationVerification: async () => ({
        status: "not_found",
        aggregationVersion: "team_dynamics_final_aggregation_v1",
        teamAssessmentAssignmentId: "missing",
        scoreEntryAggregations: [],
        hasTdmDomainAggregations: false,
        hasPsychologicalSafetyAggregation: false,
        hasSjtAggregation: false,
        hasOutcomePulseAggregation: false,
        includedMemberCount: null,
        completedMemberCount: null,
        readyScoredMemberCount: null,
        incompleteMemberCount: null,
        missingScoreCount: null,
        invalidScoreCount: null,
        aggregationSnapshotId: null,
        reason: null,
      }),
    },
  );

  assert.equal(candidateResult.ok, true);
  assert.equal(candidateResult.inputSnapshot.candidateSignals.sourceStatus, "available");
  assert.ok(candidateResult.inputSnapshot.candidateSignals.summary);
  assert.ok(candidateResult.inputSnapshot.candidateSignals.collaborationRelevantSignals.length >= 1);
  assert.ok(candidateResult.inputSnapshot.candidateSignals.motivationSignals);
  assert.ok(candidateResult.inputSnapshot.candidateSignals.problemSolvingSignals);
  assert.equal(
    JSON.stringify(candidateResult.inputSnapshot.candidateSignals).includes("deterministicInputs"),
    false,
  );

  const teamState = buildBaseState({
    team_fit_reports: [
      {
        ...buildBaseState().team_fit_reports[0],
        team_source_id: "agg-snapshot-1",
      },
    ],
    team_assessment_aggregation_snapshots: [
      {
        id: "agg-snapshot-1",
        team_assessment_assignment_id: "team-assignment-1",
        aggregation_version: "team_dynamics_final_aggregation_v1",
      },
    ],
  });
  const teamResult = await buildTeamFitReportInputSnapshot(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: createSupabaseStub(teamState),
      buildCompositeInputSnapshot: async () => {
        throw new Error("team-only test should not need candidate dereference");
      },
      loadTeamAggregationVerification: async ({ teamAssessmentAssignmentId }) => {
        if (teamAssessmentAssignmentId === "agg-snapshot-1") {
          return {
            status: "not_found",
            aggregationVersion: "team_dynamics_final_aggregation_v1",
            teamAssessmentAssignmentId,
            scoreEntryAggregations: [],
            hasTdmDomainAggregations: false,
            hasPsychologicalSafetyAggregation: false,
            hasSjtAggregation: false,
            hasOutcomePulseAggregation: false,
            includedMemberCount: null,
            completedMemberCount: null,
            readyScoredMemberCount: null,
            incompleteMemberCount: null,
            missingScoreCount: null,
            invalidScoreCount: null,
            aggregationSnapshotId: null,
            reason: null,
          };
        }

        return buildReadyAggregationResult();
      },
    },
  );

  assert.equal(teamResult.ok, true);
  assert.equal(teamResult.inputSnapshot.teamSignals.sourceStatus, "available");
  assert.ok(teamResult.inputSnapshot.teamSignals.summary);
  assert.ok(teamResult.inputSnapshot.teamSignals.coreSignals.length >= 1);
  assert.ok(teamResult.inputSnapshot.teamSignals.communicationAndCoordinationSignals.length >= 1);
  assert.ok(teamResult.inputSnapshot.teamSignals.varianceAndConfidence);
  assert.equal(
    JSON.stringify(teamResult.inputSnapshot.teamSignals).includes("standardDeviationScore0To100"),
    false,
  );
  assert.equal(JSON.stringify(teamResult.inputSnapshot.teamSignals).includes("memberScores"), false);

  const combinedState = buildBaseState({
    team_fit_reports: [
      {
        ...buildBaseState().team_fit_reports[0],
        candidate_source_id: "assignment-1",
        team_source_id: "team-assignment-1",
      },
    ],
  });
  const combinedResult = await buildTeamFitReportInputSnapshot(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: createSupabaseStub(combinedState),
      buildCompositeInputSnapshot: async () => buildCompositeSnapshot(),
      loadTeamAggregationVerification: async () => buildReadyAggregationResult(),
    },
  );

  assert.equal(combinedResult.ok, true);
  assert.equal(combinedResult.inputSnapshot.candidateSignals.sourceStatus, "available");
  assert.equal(combinedResult.inputSnapshot.teamSignals.sourceStatus, "available");
  assert.deepEqual(combinedResult.inputSnapshot.relationshipReasoningGuardrails.allowedPatterns, [
    "alignment_signal",
    "complementarity_signal",
    "mixed_signal",
    "needs_validation",
  ]);
  assertForbiddenKeysAbsent(combinedResult.inputSnapshot);

  console.log("test-team-fit-input-enrichment: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
