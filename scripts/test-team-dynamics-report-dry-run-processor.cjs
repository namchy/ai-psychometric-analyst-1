const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-dynamics-report-lifecycle.ts",
);
const helperSource = fs.readFileSync(helperPath, "utf8");
const dryRunSection =
  helperSource.match(
    /export async function processTeamDynamicsReportDryRun[\s\S]*?export async function processTeamDynamicsExecutiveOverviewMock/,
  )?.[0] ?? "";
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "team-dynamics-report-dry-run-processor-"),
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

assert.match(helperSource, /export async function processTeamDynamicsReportDryRun/);
assert.match(
  helperSource,
  /TEAM_DYNAMICS_REPORT_PROVIDER_NOT_IMPLEMENTED =\s*"TEAM_DYNAMICS_REPORT_PROVIDER_NOT_IMPLEMENTED"/,
);
assert.match(helperSource, /claimReportForProcessing/);
assert.match(helperSource, /markReportProcessingFailed/);
assert.doesNotMatch(helperSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(dryRunSection, /report_status:\s*"ready"/);
assert.doesNotMatch(dryRunSection, /\.update\(\{\s*report_snapshot:/s);
assert.doesNotMatch(dryRunSection, /OpenAI|AI provider|renderer|worker|Team Fit/i);

fs.writeFileSync(
  teamDynamicsStubPath,
  'module.exports = { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG: "team_dynamics_assessment_v1" };',
);

const {
  processTeamDynamicsReportDryRun,
  TEAM_DYNAMICS_REPORT_PROVIDER_NOT_IMPLEMENTED,
  TEAM_DYNAMICS_REPORT_TYPE,
  TEAM_DYNAMICS_REPORT_VERSION,
} = require(helperPath);

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
        included_member_ids_snapshot: ["tap-2", "tap-1"],
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

async function main() {
  const dryRunSupabase = createSupabaseStub(buildBaseState());
  const callOrder = [];
  const dryRun = await processTeamDynamicsReportDryRun(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: dryRunSupabase,
      claimReportForProcessing: async (input) => {
        callOrder.push("claim");
        const row = dryRunSupabase.state.team_assessment_reports[0];
        row.input_snapshot = {
          inputType: "team_dynamics_report_input_v1",
          teamAssessmentReportId: input.teamAssessmentReportId,
          organizationId: input.organizationId,
        };
        row.report_status = "processing";
        row.started_at = "2026-05-29T09:00:00.000Z";

        return {
          ok: true,
          operation: "claimed",
          report: {
            id: row.id,
            organizationId: row.organization_id,
            teamId: row.team_id,
            teamAssessmentAssignmentId: row.team_assessment_assignment_id,
            selectionDraftId: row.selection_draft_id,
            aggregationSnapshotId: row.aggregation_snapshot_id,
            reportType: row.report_type,
            reportVersion: row.report_version,
            reportStatus: "processing",
            generatorType: row.generator_type,
            modelName: row.model_name,
            includedMemberIdsSnapshot: ["tap-1", "tap-2"],
            inputSnapshot: row.input_snapshot,
            reportSnapshot: row.report_snapshot,
            errorMessage: row.error_message,
            queuedAt: row.queued_at,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
          snapshot: {
            ok: true,
            snapshot: row.input_snapshot,
            reportRowId: row.id,
          },
        };
      },
      markReportProcessingFailed: async (input) => {
        callOrder.push("fail");
        const row = dryRunSupabase.state.team_assessment_reports[0];
        row.report_status = "failed";
        row.error_message = `${input.failure.code} | ${input.failure.reason} | ${input.failure.message}`;
        row.completed_at = "2026-05-29T09:05:00.000Z";

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
            reportStatus: "failed",
            generatorType: row.generator_type,
            modelName: row.model_name,
            includedMemberIdsSnapshot: ["tap-1", "tap-2"],
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

  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.operation, "dry_run_failed_as_expected");
  assert.equal(dryRun.marker, TEAM_DYNAMICS_REPORT_PROVIDER_NOT_IMPLEMENTED);
  assert.deepEqual(callOrder, ["claim", "fail"]);
  assert.equal(dryRun.claim.report.reportStatus, "processing");
  assert.equal(dryRun.final.report.reportStatus, "failed");
  assert.equal(
    dryRunSupabase.state.team_assessment_reports[0].input_snapshot.inputType,
    "team_dynamics_report_input_v1",
  );
  assert.equal(dryRunSupabase.state.team_assessment_reports[0].report_status, "failed");
  assert.match(
    dryRunSupabase.state.team_assessment_reports[0].error_message,
    /TEAM_DYNAMICS_REPORT_PROVIDER_NOT_IMPLEMENTED/,
  );
  assert.equal(dryRunSupabase.state.team_assessment_reports[0].report_snapshot, null);
  assert.notEqual(dryRunSupabase.state.team_assessment_reports[0].report_status, "ready");
  assert.deepEqual(dryRunSupabase.state.attempt_reports, [
    { id: "attempt-report-1", report_status: "queued" },
  ]);
  assert.deepEqual(dryRunSupabase.state.assessment_reports, [
    { id: "assessment-report-1", report_status: "queued" },
  ]);
  assert.equal(
    dryRunSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "attempt_reports",
    ),
    false,
  );
  assert.equal(
    dryRunSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "assessment_reports",
    ),
    false,
  );

  const processingSupabase = createSupabaseStub(
    buildBaseState({
      team_assessment_reports: [
        {
          ...buildBaseState().team_assessment_reports[0],
          report_status: "processing",
          started_at: "2026-05-29T08:45:00.000Z",
        },
      ],
    }),
  );
  const processingBefore = JSON.stringify(processingSupabase.state.team_assessment_reports[0]);
  let processingFailCalled = false;
  const processingResult = await processTeamDynamicsReportDryRun(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: processingSupabase,
      claimReportForProcessing: async () => ({
        ok: false,
        operation: "already_processing",
        reason: "Team Dynamics report is already processing.",
        report: {
          id: "report-1",
          organizationId: "org-1",
          teamId: "team-1",
          teamAssessmentAssignmentId: "assignment-1",
          selectionDraftId: "draft-1",
          aggregationSnapshotId: "aggregation-1",
          reportType: TEAM_DYNAMICS_REPORT_TYPE,
          reportVersion: TEAM_DYNAMICS_REPORT_VERSION,
          reportStatus: "processing",
          generatorType: null,
          modelName: null,
          includedMemberIdsSnapshot: ["tap-1", "tap-2"],
          inputSnapshot: null,
          reportSnapshot: null,
          errorMessage: null,
          queuedAt: "2026-05-29T08:00:00.000Z",
          startedAt: "2026-05-29T08:45:00.000Z",
          completedAt: null,
          createdAt: "2026-05-29T08:00:00.000Z",
          updatedAt: "2026-05-29T08:00:00.000Z",
        },
      }),
      markReportProcessingFailed: async () => {
        processingFailCalled = true;
        throw new Error("should not be called");
      },
    },
  );
  assert.equal(processingResult.ok, false);
  assert.equal(processingResult.operation, "claim_not_acquired");
  assert.equal(processingResult.claim.operation, "already_processing");
  assert.equal(processingFailCalled, false);
  assert.equal(
    JSON.stringify(processingSupabase.state.team_assessment_reports[0]),
    processingBefore,
  );

  const readySupabase = createSupabaseStub(
    buildBaseState({
      team_assessment_reports: [
        {
          ...buildBaseState().team_assessment_reports[0],
          report_status: "ready",
          report_snapshot: { ready: true },
          completed_at: "2026-05-29T09:10:00.000Z",
        },
      ],
    }),
  );
  const readyBefore = JSON.stringify(readySupabase.state.team_assessment_reports[0]);
  let readyFailCalled = false;
  const readyResult = await processTeamDynamicsReportDryRun(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: readySupabase,
      claimReportForProcessing: async () => ({
        ok: false,
        operation: "already_ready",
        reason: "Team Dynamics report is already ready.",
        report: {
          id: "report-1",
          organizationId: "org-1",
          teamId: "team-1",
          teamAssessmentAssignmentId: "assignment-1",
          selectionDraftId: "draft-1",
          aggregationSnapshotId: "aggregation-1",
          reportType: TEAM_DYNAMICS_REPORT_TYPE,
          reportVersion: TEAM_DYNAMICS_REPORT_VERSION,
          reportStatus: "ready",
          generatorType: null,
          modelName: null,
          includedMemberIdsSnapshot: ["tap-1", "tap-2"],
          inputSnapshot: null,
          reportSnapshot: { ready: true },
          errorMessage: null,
          queuedAt: "2026-05-29T08:00:00.000Z",
          startedAt: "2026-05-29T08:45:00.000Z",
          completedAt: "2026-05-29T09:10:00.000Z",
          createdAt: "2026-05-29T08:00:00.000Z",
          updatedAt: "2026-05-29T08:00:00.000Z",
        },
      }),
      markReportProcessingFailed: async () => {
        readyFailCalled = true;
        throw new Error("should not be called");
      },
    },
  );
  assert.equal(readyResult.ok, false);
  assert.equal(readyResult.operation, "claim_not_acquired");
  assert.equal(readyResult.claim.operation, "already_ready");
  assert.equal(readyFailCalled, false);
  assert.equal(
    JSON.stringify(readySupabase.state.team_assessment_reports[0]),
    readyBefore,
  );

  const failedSupabase = createSupabaseStub(
    buildBaseState({
      team_assessment_reports: [
        {
          ...buildBaseState().team_assessment_reports[0],
          report_status: "failed",
          error_message: "PREVIOUS_FAILURE",
          completed_at: "2026-05-29T09:10:00.000Z",
        },
      ],
    }),
  );
  const failedBefore = JSON.stringify(failedSupabase.state.team_assessment_reports[0]);
  let failedMarkCalled = false;
  const failedResult = await processTeamDynamicsReportDryRun(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: failedSupabase,
      claimReportForProcessing: async () => ({
        ok: false,
        operation: "failed_not_claimable",
        reason: "Failed Team Dynamics report rows are not claimable.",
        report: {
          id: "report-1",
          organizationId: "org-1",
          teamId: "team-1",
          teamAssessmentAssignmentId: "assignment-1",
          selectionDraftId: "draft-1",
          aggregationSnapshotId: "aggregation-1",
          reportType: TEAM_DYNAMICS_REPORT_TYPE,
          reportVersion: TEAM_DYNAMICS_REPORT_VERSION,
          reportStatus: "failed",
          generatorType: null,
          modelName: null,
          includedMemberIdsSnapshot: ["tap-1", "tap-2"],
          inputSnapshot: null,
          reportSnapshot: null,
          errorMessage: "PREVIOUS_FAILURE",
          queuedAt: "2026-05-29T08:00:00.000Z",
          startedAt: "2026-05-29T08:45:00.000Z",
          completedAt: "2026-05-29T09:10:00.000Z",
          createdAt: "2026-05-29T08:00:00.000Z",
          updatedAt: "2026-05-29T08:00:00.000Z",
        },
      }),
      markReportProcessingFailed: async () => {
        failedMarkCalled = true;
        throw new Error("should not be called");
      },
    },
  );
  assert.equal(failedResult.ok, false);
  assert.equal(failedResult.operation, "claim_not_acquired");
  assert.equal(failedResult.claim.operation, "failed_not_claimable");
  assert.equal(failedMarkCalled, false);
  assert.equal(
    JSON.stringify(failedSupabase.state.team_assessment_reports[0]),
    failedBefore,
  );
}

main()
  .then(() => {
    console.log("Team Dynamics report dry-run processor tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
