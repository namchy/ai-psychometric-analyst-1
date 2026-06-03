const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const lifecyclePath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-dynamics-report-lifecycle.ts",
);
const contractPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-dynamics-executive-overview-contract.ts",
);
const lifecycleSource = fs.readFileSync(lifecyclePath, "utf8");
const processorSection =
  lifecycleSource.match(
    /export async function processTeamDynamicsExecutiveOverviewWithOpenAI[\s\S]*?export async function resetFailedTeamDynamicsReportToQueued/,
  )?.[0] ?? "";
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "team-dynamics-executive-overview-openai-processor-"),
);
const teamDynamicsStubPath = path.join(tempDir, "team-dynamics-stub.cjs");
const originalResolveFilename = Module._resolveFilename;

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
  if (
    request === "server-only" ||
    request === "@/lib/supabase/admin" ||
    request === "@/lib/assessment/team-assessment-aggregation-read" ||
    request === "@/lib/b2b/team-dynamics-report-input"
  ) {
    return emptyModulePath;
  }

  if (request === "@/lib/assessment/team-dynamics") {
    return teamDynamicsStubPath;
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

assert.match(lifecycleSource, /export async function processTeamDynamicsExecutiveOverviewWithOpenAI/);
assert.match(
  lifecycleSource,
  /TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_CONFIG_ERROR/,
);
assert.match(
  lifecycleSource,
  /TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_ERROR/,
);
assert.match(
  lifecycleSource,
  /TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PARSE_FAILURE/,
);
assert.match(
  lifecycleSource,
  /TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_VALIDATION_FAILURE/,
);
assert.doesNotMatch(processorSection, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(processorSection, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(processorSection, /worker|cron|renderer|route|Team Fit/i);
assert.doesNotMatch(processorSection, /raw responses read|scoring rerun|aggregation refresh/i);

fs.writeFileSync(
  teamDynamicsStubPath,
  'module.exports = { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG: "team_dynamics_assessment_v1" };',
);

const {
  processTeamDynamicsExecutiveOverviewWithOpenAI,
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_INPUT_SNAPSHOT_INVALID,
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_INPUT_SNAPSHOT_MISSING,
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_CONFIG_ERROR,
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_ERROR,
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PARSE_FAILURE,
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_VALIDATION_FAILURE,
  TEAM_DYNAMICS_REPORT_TYPE,
  TEAM_DYNAMICS_REPORT_VERSION,
} = require(lifecyclePath);
const {
  buildMockTeamDynamicsExecutiveOverviewSnapshot,
  validateTeamDynamicsExecutiveOverviewSnapshot,
} = require(contractPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSupabaseStub(initialState = {}) {
  const state = {
    team_assessment_reports: [...(initialState.team_assessment_reports ?? [])],
    attempt_reports: [...(initialState.attempt_reports ?? [])],
    assessment_reports: [...(initialState.assessment_reports ?? [])],
  };
  const operations = [];

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
    operations,
    from(table) {
      operations.push({ type: "from", table });

      const query = {
        filters: [],
        mode: "select",
        patch: null,
        select() {
          return query;
        },
        eq(column, value) {
          query.filters.push({ type: "eq", column, value });
          return query;
        },
        update(patch) {
          operations.push({ type: "update", table, patch });
          query.mode = "update";
          query.patch = patch;
          return query;
        },
        async maybeSingle() {
          if (query.mode === "update") {
            const rows = applyFilters(state[table] ?? [], query.filters);
            const row = rows[0] ?? null;

            if (!row) {
              return { data: null, error: null };
            }

            Object.assign(row, query.patch);
            return { data: row, error: null };
          }

          const rows = applyFilters(state[table] ?? [], query.filters);
          return {
            data: rows[0] ?? null,
            error: null,
          };
        },
      };

      return query;
    },
  };
}

function buildInputSnapshot(overrides = {}) {
  return {
    inputType: "team_dynamics_report_input_v1",
    inputVersion: "team_dynamics_report_input_v1",
    reportType: TEAM_DYNAMICS_REPORT_TYPE,
    reportVersion: TEAM_DYNAMICS_REPORT_VERSION,
    teamAssessmentReportId: "report-1",
    organizationId: "org-1",
    teamId: "team-1",
    teamAssessmentAssignmentId: "assignment-1",
    selectionDraftId: "draft-1",
    aggregationSnapshotId: "aggregation-1",
    includedMemberCount: 4,
    includedMemberIdsSnapshot: ["tap-1", "tap-2", "tap-3", "tap-4"],
    teamContext: {
      teamName: "Delivery Team",
      assignment: {
        packageSlug: "team_dynamics_assessment_v1",
        status: "closed",
        openedAt: "2026-05-28T08:00:00.000Z",
        closedAt: "2026-05-29T08:00:00.000Z",
        createdAt: "2026-05-28T08:00:00.000Z",
        updatedAt: "2026-05-29T08:00:00.000Z",
      },
    },
    aggregationSummary: {
      aggregationVersion: "team_dynamics_final_aggregation_v1",
      aggregationSnapshotId: "aggregation-1",
      calculatedAt: "2026-05-29T08:55:00.000Z",
      includedMemberCount: 4,
      completedMemberCount: 4,
      readyScoredMemberCount: 4,
      incompleteMemberCount: 0,
      missingScoreCount: 0,
      invalidScoreCount: 0,
      scoreEntryAggregations: [
        {
          scoreKey: "tdm_collaboration",
          label: "Saradnja i koordinacija",
          blockKey: "tdm-31-V1",
          scoreModel: "simple_linear_v1",
          entryType: "domain",
          memberCount: 4,
          meanScore0To100: 62,
          minScore0To100: 41,
          maxScore0To100: 79,
          standardDeviationScore0To100: 14,
        },
      ],
      tdmBlockAggregationPresent: true,
      tdmDomainAggregationsPresent: true,
      psychologicalSafetyAggregationPresent: true,
      sjtAggregationPresent: true,
      outcomePulseAggregationPresent: true,
    },
    guardrails: {
      noHireNoHire: true,
      noIndividualNamingInMainReport: true,
      noRawResponseAnalysis: true,
      reportScope: "team_level_only",
      teamFitOutputExcluded: true,
    },
    createdAt: "2026-05-29T08:55:00.000Z",
    ...overrides,
  };
}

function buildBaseState(overrides = {}) {
  return {
    team_assessment_reports: [
      {
        id: "report-1",
        organization_id: "org-1",
        team_id: "team-1",
        team_assessment_assignment_id: "assignment-1",
        selection_draft_id: "draft-1",
        aggregation_snapshot_id: "aggregation-1",
        report_type: TEAM_DYNAMICS_REPORT_TYPE,
        report_version: TEAM_DYNAMICS_REPORT_VERSION,
        report_status: "queued",
        generator_type: null,
        model_name: null,
        included_member_ids_snapshot: ["tap-1", "tap-2", "tap-3", "tap-4"],
        input_snapshot: null,
        report_snapshot: null,
        error_message: null,
        queued_at: "2026-05-29T08:00:00.000Z",
        started_at: null,
        completed_at: null,
        created_at: "2026-05-29T08:00:00.000Z",
        updated_at: "2026-05-29T08:00:00.000Z",
      },
    ],
    attempt_reports: [{ id: "attempt-report-1", report_status: "queued" }],
    assessment_reports: [{ id: "assessment-report-1", report_status: "queued" }],
    ...overrides,
  };
}

function buildClaimSuccess(stateRow, inputSnapshot) {
  return {
    ok: true,
    operation: "claimed",
    report: {
      id: stateRow.id,
      organizationId: stateRow.organization_id,
      teamId: stateRow.team_id,
      teamAssessmentAssignmentId: stateRow.team_assessment_assignment_id,
      selectionDraftId: stateRow.selection_draft_id,
      aggregationSnapshotId: stateRow.aggregation_snapshot_id,
      reportType: stateRow.report_type,
      reportVersion: stateRow.report_version,
      reportStatus: stateRow.report_status,
      generatorType: stateRow.generator_type,
      modelName: stateRow.model_name,
      includedMemberIdsSnapshot: [...stateRow.included_member_ids_snapshot],
      inputSnapshot: stateRow.input_snapshot,
      reportSnapshot: stateRow.report_snapshot,
      errorMessage: stateRow.error_message,
      queuedAt: stateRow.queued_at,
      startedAt: stateRow.started_at,
      completedAt: stateRow.completed_at,
      createdAt: stateRow.created_at,
      updatedAt: stateRow.updated_at,
    },
    snapshot: {
      ok: true,
      snapshot: inputSnapshot,
      reportRowId: stateRow.id,
    },
  };
}

async function main() {
  const validSnapshot = buildMockTeamDynamicsExecutiveOverviewSnapshot();

  const happySupabase = createSupabaseStub(buildBaseState());
  const statusHistory = [];
  let happyProviderCalls = 0;
  const happyInputSnapshot = buildInputSnapshot();
  const happyResult = await processTeamDynamicsExecutiveOverviewWithOpenAI(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: happySupabase,
      now: () => "2026-05-29T09:15:00.000Z",
      claimReportForProcessing: async () => {
        const row = happySupabase.state.team_assessment_reports[0];
        statusHistory.push(row.report_status);
        row.input_snapshot = happyInputSnapshot;
        row.report_status = "processing";
        row.started_at = "2026-05-29T09:00:00.000Z";
        statusHistory.push(row.report_status);
        return buildClaimSuccess(row, happyInputSnapshot);
      },
      generateExecutiveOverviewWithOpenAI: async (inputSnapshot) => {
        happyProviderCalls += 1;
        assert.deepEqual(inputSnapshot, happyInputSnapshot);
        return {
          ok: true,
          code: "success",
          snapshot: validSnapshot,
          provider: "openai",
          providerVersion: "v1",
          modelName: "gpt-5.1",
          generatedAt: "2026-05-29T09:05:00.000Z",
          rawContent: JSON.stringify(validSnapshot),
        };
      },
      executiveOverviewOpenAiOptions: {
        apiKey: "test-key",
        model: "gpt-5.1",
      },
    },
  );

  assert.equal(happyResult.ok, true);
  assert.equal(happyProviderCalls, 1);
  assert.equal(happyResult.operation, "completed_ready");
  assert.equal(happyResult.finalStatus, "ready");
  assert.equal(happyResult.provider.code, "success");
  assert.equal(happySupabase.state.team_assessment_reports[0].report_status, "ready");
  assert.equal(happySupabase.state.team_assessment_reports[0].completed_at, "2026-05-29T09:15:00.000Z");
  assert.equal(happySupabase.state.team_assessment_reports[0].error_message, null);
  assert.deepEqual(happySupabase.state.team_assessment_reports[0].included_member_ids_snapshot, [
    "tap-1",
    "tap-2",
    "tap-3",
    "tap-4",
  ]);
  assert.equal(happySupabase.state.team_assessment_reports[0].report_snapshot == null, false);
  assert.equal(
    validateTeamDynamicsExecutiveOverviewSnapshot(
      happySupabase.state.team_assessment_reports[0].report_snapshot,
    ).ok,
    true,
  );
  statusHistory.push(happySupabase.state.team_assessment_reports[0].report_status);
  assert.equal(statusHistory.join(" -> "), "queued -> processing -> ready");
  assert.equal(
    happySupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "attempt_reports",
    ),
    false,
  );
  assert.equal(
    happySupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "assessment_reports",
    ),
    false,
  );

  async function expectProviderFailure(providerFailure, expectedMarker, expectedReasonPattern) {
    const supabase = createSupabaseStub(
      buildBaseState({
        team_assessment_reports: [
          {
            ...buildBaseState().team_assessment_reports[0],
            id: `report-${expectedMarker.toLowerCase()}`,
          },
        ],
      }),
    );
    let providerCalls = 0;
    const inputSnapshot = buildInputSnapshot({
      teamAssessmentReportId: `report-${expectedMarker.toLowerCase()}`,
    });

    const result = await processTeamDynamicsExecutiveOverviewWithOpenAI(
      {
        teamAssessmentReportId: inputSnapshot.teamAssessmentReportId,
        organizationId: "org-1",
      },
      {
        supabase,
        now: () => "2026-05-29T09:20:00.000Z",
        claimReportForProcessing: async () => {
          const row = supabase.state.team_assessment_reports[0];
          row.input_snapshot = inputSnapshot;
          row.report_status = "processing";
          row.started_at = "2026-05-29T09:10:00.000Z";
          return buildClaimSuccess(row, inputSnapshot);
        },
        generateExecutiveOverviewWithOpenAI: async () => {
          providerCalls += 1;
          return providerFailure;
        },
        executiveOverviewOpenAiOptions: {
          apiKey: "test-key",
          model: "gpt-5.1",
        },
      },
    );

    assert.equal(result.ok, false);
    assert.equal(providerCalls, 1);
    assert.equal(result.operation, "provider_failed");
    assert.equal(result.marker, expectedMarker);
    assert.equal(supabase.state.team_assessment_reports[0].report_status, "failed");
    assert.match(supabase.state.team_assessment_reports[0].error_message, expectedReasonPattern);
    assert.equal(supabase.state.team_assessment_reports[0].report_snapshot, null);
    assert.equal(
      supabase.operations.some(
        (entry) => entry.type === "update" && entry.table === "attempt_reports",
      ),
      false,
    );
    assert.equal(
      supabase.operations.some(
        (entry) => entry.type === "update" && entry.table === "assessment_reports",
      ),
      false,
    );
  }

  await expectProviderFailure(
    {
      ok: false,
      code: "parse_failure",
      reason: "OpenAI Team Dynamics Executive Overview returned invalid JSON: Unexpected token",
      provider: "openai",
      providerVersion: "v1",
      modelName: "gpt-5.1",
      generatedAt: "2026-05-29T09:12:00.000Z",
      rawContent: "{invalid",
    },
    TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PARSE_FAILURE,
    /TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PARSE_FAILURE \| parse_failure/,
  );

  await expectProviderFailure(
    {
      ok: false,
      code: "validation_failure",
      reason: "OpenAI Team Dynamics Executive Overview failed runtime validation.",
      provider: "openai",
      providerVersion: "v1",
      modelName: "gpt-5.1",
      generatedAt: "2026-05-29T09:12:00.000Z",
      rawContent: "{\"reportType\":\"wrong\"}",
      validationErrors: ["reportType: Expected team_dynamics_executive_overview_v1."],
    },
    TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_VALIDATION_FAILURE,
    /TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_VALIDATION_FAILURE \| validation_failure/,
  );

  await expectProviderFailure(
    {
      ok: false,
      code: "config_error",
      reason: "Missing required env var: OPENAI_API_KEY",
      provider: "openai",
      providerVersion: "v1",
      modelName: null,
      generatedAt: "2026-05-29T09:12:00.000Z",
    },
    TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_CONFIG_ERROR,
    /TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_CONFIG_ERROR \| config_error/,
  );

  await expectProviderFailure(
    {
      ok: false,
      code: "provider_error",
      reason: "OpenAI request failed upstream.",
      provider: "openai",
      providerVersion: "v1",
      modelName: "gpt-5.1",
      generatedAt: "2026-05-29T09:12:00.000Z",
    },
    TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_ERROR,
    /TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_ERROR \| provider_error/,
  );

  const invalidInputSupabase = createSupabaseStub(buildBaseState());
  const invalidInputResult = await processTeamDynamicsExecutiveOverviewWithOpenAI(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: invalidInputSupabase,
      now: () => "2026-05-29T09:25:00.000Z",
      claimReportForProcessing: async () => {
        const row = invalidInputSupabase.state.team_assessment_reports[0];
        row.input_snapshot = { inputType: "team_dynamics_report_input_v1" };
        row.report_status = "processing";
        row.started_at = "2026-05-29T09:20:00.000Z";
        return buildClaimSuccess(row, row.input_snapshot);
      },
    },
  );
  assert.equal(invalidInputResult.ok, false);
  assert.equal(invalidInputResult.operation, "input_snapshot_invalid");
  assert.equal(invalidInputResult.marker, TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_INPUT_SNAPSHOT_INVALID);
  assert.match(
    invalidInputSupabase.state.team_assessment_reports[0].error_message,
    /TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_INPUT_SNAPSHOT_INVALID \| input_snapshot_invalid/,
  );

  const missingInputSupabase = createSupabaseStub(buildBaseState());
  const missingInputResult = await processTeamDynamicsExecutiveOverviewWithOpenAI(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: missingInputSupabase,
      now: () => "2026-05-29T09:25:00.000Z",
      claimReportForProcessing: async () => {
        const row = missingInputSupabase.state.team_assessment_reports[0];
        row.input_snapshot = null;
        row.report_status = "processing";
        row.started_at = "2026-05-29T09:20:00.000Z";
        return buildClaimSuccess(row, null);
      },
    },
  );
  assert.equal(missingInputResult.ok, false);
  assert.equal(missingInputResult.operation, "input_snapshot_missing");
  assert.equal(missingInputResult.marker, TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_INPUT_SNAPSHOT_MISSING);
  assert.match(
    missingInputSupabase.state.team_assessment_reports[0].error_message,
    /TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_INPUT_SNAPSHOT_MISSING \| input_snapshot_missing/,
  );

  const claimDeniedSupabase = createSupabaseStub(buildBaseState());
  let claimDeniedProviderCalls = 0;
  let claimDeniedFailCalls = 0;
  const claimDeniedBefore = JSON.stringify(claimDeniedSupabase.state.team_assessment_reports[0]);
  const claimDeniedResult = await processTeamDynamicsExecutiveOverviewWithOpenAI(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: claimDeniedSupabase,
      claimReportForProcessing: async () => ({
        ok: false,
        operation: "already_processing",
        reason: "Team Dynamics report is already processing.",
        report: null,
      }),
      generateExecutiveOverviewWithOpenAI: async () => {
        claimDeniedProviderCalls += 1;
        return {
          ok: false,
          code: "provider_error",
          reason: "Should not be called.",
          provider: "openai",
          providerVersion: "v1",
          modelName: "gpt-5.1",
          generatedAt: "2026-05-29T09:30:00.000Z",
        };
      },
      markReportProcessingFailed: async () => {
        claimDeniedFailCalls += 1;
        throw new Error("Should not be called.");
      },
    },
  );
  assert.equal(claimDeniedResult.ok, false);
  assert.equal(claimDeniedResult.operation, "claim_not_acquired");
  assert.equal(claimDeniedProviderCalls, 0);
  assert.equal(claimDeniedFailCalls, 0);
  assert.equal(
    JSON.stringify(claimDeniedSupabase.state.team_assessment_reports[0]),
    claimDeniedBefore,
  );

  const providerSuccessInvalidSnapshotSupabase = createSupabaseStub(buildBaseState());
  const providerSuccessInvalidSnapshot = clone(validSnapshot);
  providerSuccessInvalidSnapshot.reportType = "wrong_report_type";
  const providerSuccessInvalidResult = await processTeamDynamicsExecutiveOverviewWithOpenAI(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: providerSuccessInvalidSnapshotSupabase,
      now: () => "2026-05-29T09:35:00.000Z",
      claimReportForProcessing: async () => {
        const row = providerSuccessInvalidSnapshotSupabase.state.team_assessment_reports[0];
        const inputSnapshot = buildInputSnapshot();
        row.input_snapshot = inputSnapshot;
        row.report_status = "processing";
        row.started_at = "2026-05-29T09:30:00.000Z";
        return buildClaimSuccess(row, inputSnapshot);
      },
      generateExecutiveOverviewWithOpenAI: async () => ({
        ok: true,
        code: "success",
        snapshot: providerSuccessInvalidSnapshot,
        provider: "openai",
        providerVersion: "v1",
        modelName: "gpt-5.1",
        generatedAt: "2026-05-29T09:31:00.000Z",
        rawContent: JSON.stringify(providerSuccessInvalidSnapshot),
      }),
      executiveOverviewOpenAiOptions: {
        apiKey: "test-key",
        model: "gpt-5.1",
      },
    },
  );
  assert.equal(providerSuccessInvalidResult.ok, false);
  assert.equal(providerSuccessInvalidResult.operation, "snapshot_invalid");
  assert.equal(
    providerSuccessInvalidResult.marker,
    TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_VALIDATION_FAILURE,
  );
  assert.match(
    providerSuccessInvalidSnapshotSupabase.state.team_assessment_reports[0].error_message,
    /TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_VALIDATION_FAILURE \| post_provider_snapshot_validation_failed/,
  );
}

main()
  .then(() => {
    console.log("Team Dynamics Executive Overview OpenAI processor tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
