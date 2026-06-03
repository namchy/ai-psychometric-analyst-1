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
const mockBuilderPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-dynamics-executive-overview-mock.ts",
);
const contractPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-dynamics-executive-overview-contract.ts",
);
const lifecycleSource = fs.readFileSync(lifecyclePath, "utf8");
const mockBuilderSource = fs.readFileSync(mockBuilderPath, "utf8");
const contractSource = fs.readFileSync(contractPath, "utf8");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "team-dynamics-executive-overview-mock-generation-"),
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

assert.match(
  lifecycleSource,
  /export async function processTeamDynamicsExecutiveOverviewMock/,
);
assert.match(lifecycleSource, /report_status: "ready"/);
assert.match(lifecycleSource, /report_snapshot: input\.reportSnapshot/);
assert.match(
  mockBuilderSource,
  /export function generateTeamDynamicsExecutiveOverviewMockSnapshot/,
);
assert.match(contractSource, /validateTeamDynamicsExecutiveOverviewSnapshot/);
assert.doesNotMatch(mockBuilderSource, /\.from\("/);
assert.doesNotMatch(lifecycleSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(lifecycleSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(mockBuilderSource, /OpenAI|provider registry|renderer|worker|Team Fit/i);
assert.doesNotMatch(lifecycleSource, /OpenAI|provider registry|renderer|worker|Team Fit/i);

fs.writeFileSync(
  teamDynamicsStubPath,
  'module.exports = { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG: "team_dynamics_assessment_v1" };',
);

const {
  processTeamDynamicsExecutiveOverviewMock,
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SNAPSHOT_INVALID,
  TEAM_DYNAMICS_REPORT_TYPE,
  TEAM_DYNAMICS_REPORT_VERSION,
} = require(lifecyclePath);
const {
  generateTeamDynamicsExecutiveOverviewMockSnapshot,
} = require(mockBuilderPath);
const {
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE,
  validateTeamDynamicsExecutiveOverviewSnapshot,
} = require(contractPath);

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
  const happySupabase = createSupabaseStub(buildBaseState());
  const statusHistory = [];
  const persistedInputSnapshot = buildInputSnapshot();
  const happyResult = await processTeamDynamicsExecutiveOverviewMock(
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
        row.input_snapshot = persistedInputSnapshot;
        row.report_status = "processing";
        row.started_at = "2026-05-29T09:00:00.000Z";
        statusHistory.push(row.report_status);
        return buildClaimSuccess(row, persistedInputSnapshot);
      },
    },
  );

  assert.equal(happyResult.ok, true);
  assert.equal(happyResult.operation, "completed_ready");
  assert.equal(happyResult.finalStatus, "ready");
  assert.equal(happyResult.snapshot.reportType, TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE);
  assert.deepEqual(happyResult.claim.snapshot.snapshot, persistedInputSnapshot);
  assert.deepEqual(happySupabase.state.team_assessment_reports[0].input_snapshot, persistedInputSnapshot);
  assert.equal(happySupabase.state.team_assessment_reports[0].report_status, "ready");
  assert.equal(happySupabase.state.team_assessment_reports[0].completed_at, "2026-05-29T09:15:00.000Z");
  assert.equal(happySupabase.state.team_assessment_reports[0].report_snapshot == null, false);
  assert.equal(happySupabase.state.team_assessment_reports[0].error_message, null);
  assert.deepEqual(happySupabase.state.team_assessment_reports[0].included_member_ids_snapshot, [
    "tap-1",
    "tap-2",
    "tap-3",
    "tap-4",
  ]);
  statusHistory.push(happySupabase.state.team_assessment_reports[0].report_status);
  assert.equal(statusHistory.join(" -> "), "queued -> processing -> ready");

  const happyValidation = validateTeamDynamicsExecutiveOverviewSnapshot(
    happySupabase.state.team_assessment_reports[0].report_snapshot,
  );
  assert.equal(happyValidation.ok, true);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      happySupabase.state.team_assessment_reports[0].report_snapshot,
      "individualAnswers",
    ),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      happySupabase.state.team_assessment_reports[0].report_snapshot,
      "rawResponses",
    ),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      happySupabase.state.team_assessment_reports[0].report_snapshot,
      "individualScores",
    ),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      happySupabase.state.team_assessment_reports[0].report_snapshot,
      "memberScores",
    ),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      happySupabase.state.team_assessment_reports[0].report_snapshot,
      "teamFitOutput",
    ),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      happySupabase.state.team_assessment_reports[0].report_snapshot,
      "unifiedOverallTeamScore",
    ),
    false,
  );
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

  const invalidSupabase = createSupabaseStub(
    buildBaseState({
      team_assessment_reports: [
        {
          ...buildBaseState().team_assessment_reports[0],
          id: "report-2",
        },
      ],
    }),
  );
  let failureCalls = 0;
  const invalidResult = await processTeamDynamicsExecutiveOverviewMock(
    {
      teamAssessmentReportId: "report-2",
      organizationId: "org-1",
    },
    {
      supabase: invalidSupabase,
      claimReportForProcessing: async () => {
        const row = invalidSupabase.state.team_assessment_reports[0];
        const inputSnapshot = buildInputSnapshot({ teamAssessmentReportId: "report-2" });
        row.input_snapshot = inputSnapshot;
        row.report_status = "processing";
        row.started_at = "2026-05-29T09:00:00.000Z";
        return buildClaimSuccess(row, inputSnapshot);
      },
      buildExecutiveOverviewMockSnapshot: () => ({
        ok: true,
        snapshot: {
          reportType: "wrong_report_type",
          reportVersion: "v1",
        },
      }),
      validateExecutiveOverviewSnapshot: validateTeamDynamicsExecutiveOverviewSnapshot,
      markReportProcessingFailed: async (failureInput) => {
        failureCalls += 1;
        const row = invalidSupabase.state.team_assessment_reports[0];
        row.report_status = "failed";
        row.error_message = [
          failureInput.failure.code,
          failureInput.failure.reason,
          failureInput.failure.message,
        ].join(" | ");
        row.completed_at = "2026-05-29T09:10:00.000Z";

        return {
          ok: true,
          operation: "marked_failed",
          report: {
            id: row.id,
            organizationId: row.organization_id,
            teamId: row.team_id,
            teamAssessmentAssignmentId: row.team_assessment_assignment_id,
            selectionDraftId: row.selection_draft_id,
            aggregationSnapshotId: row.aggregation_snapshot_id,
            reportType: row.report_type,
            reportVersion: row.report_version,
            reportStatus: row.report_status,
            generatorType: row.generator_type,
            modelName: row.model_name,
            includedMemberIdsSnapshot: [...row.included_member_ids_snapshot],
            inputSnapshot: row.input_snapshot,
            reportSnapshot: row.report_snapshot,
            errorMessage: row.error_message,
            queuedAt: row.queued_at,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
          failure: {
            errorMessage: row.error_message,
          },
        };
      },
    },
  );

  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.operation, "snapshot_invalid");
  assert.equal(invalidResult.marker, TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SNAPSHOT_INVALID);
  assert.equal(failureCalls, 1);
  assert.equal(invalidSupabase.state.team_assessment_reports[0].report_status, "failed");
  assert.match(
    invalidSupabase.state.team_assessment_reports[0].error_message,
    /TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SNAPSHOT_INVALID/,
  );
  assert.equal(invalidSupabase.state.team_assessment_reports[0].report_snapshot, null);
  assert.notEqual(invalidSupabase.state.team_assessment_reports[0].report_status, "ready");
  assert.equal(
    invalidSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "attempt_reports",
    ),
    false,
  );
  assert.equal(
    invalidSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "assessment_reports",
    ),
    false,
  );

  const generated = generateTeamDynamicsExecutiveOverviewMockSnapshot({
    inputSnapshot: buildInputSnapshot(),
  });
  assert.equal(generated.ok, true);
  assert.equal(
    validateTeamDynamicsExecutiveOverviewSnapshot(generated.snapshot).ok,
    true,
  );
}

main()
  .then(() => {
    console.log("Team Dynamics executive overview mock generation tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
