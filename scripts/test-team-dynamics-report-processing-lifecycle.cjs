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
const claimSection =
  helperSource.match(
    /export async function claimTeamDynamicsReportForProcessing[\s\S]*?export async function markTeamDynamicsReportProcessingFailed/,
  )?.[0] ?? "";
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "team-dynamics-report-processing-lifecycle-"),
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

assert.match(helperSource, /export async function claimTeamDynamicsReportForProcessing/);
assert.match(helperSource, /persistInputSnapshot/);
assert.match(helperSource, /report_status: "processing"/);
assert.match(helperSource, /started_at: startedAt/);
assert.match(helperSource, /operation: "already_processing"/);
assert.match(helperSource, /operation: "already_ready"/);
assert.match(helperSource, /operation: "failed_not_claimable"/);
assert.match(helperSource, /operation: "not_claimable"/);
assert.doesNotMatch(helperSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(claimSection, /report_status:\s*"ready"/);
assert.doesNotMatch(claimSection, /report_snapshot:/);
assert.doesNotMatch(claimSection, /OpenAI|AI provider|renderer|worker|Team Fit/i);

fs.writeFileSync(
  teamDynamicsStubPath,
  'module.exports = { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG: "team_dynamics_assessment_v1" };',
);

const {
  claimTeamDynamicsReportForProcessing,
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

function buildBaseState() {
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
    attempt_reports: [
      {
        id: "attempt-report-1",
        report_status: "queued",
      },
    ],
    assessment_reports: [
      {
        id: "assessment-report-1",
        report_status: "queued",
      },
    ],
  };
}

async function main() {
  const claimSupabase = createSupabaseStub(buildBaseState());
  const snapshotCalls = [];
  const claimResult = await claimTeamDynamicsReportForProcessing(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: claimSupabase,
      now: () => "2026-05-29T09:00:00.000Z",
      persistInputSnapshot: async (input) => {
        snapshotCalls.push(input);
        const row = claimSupabase.state.team_assessment_reports[0];
        const snapshot = {
          inputType: "team_dynamics_report_input_v1",
          teamAssessmentReportId: input.teamAssessmentReportId,
          organizationId: input.organizationId,
        };
        row.input_snapshot = snapshot;

        return {
          ok: true,
          snapshot,
          reportRowId: row.id,
        };
      },
    },
  );

  assert.equal(claimResult.ok, true);
  assert.equal(claimResult.operation, "claimed");
  assert.equal(snapshotCalls.length, 1);
  assert.equal(snapshotCalls[0].teamAssessmentReportId, "report-1");
  assert.equal(snapshotCalls[0].organizationId, "org-1");
  assert.equal(claimResult.report.reportStatus, "processing");
  assert.equal(claimResult.report.startedAt, "2026-05-29T09:00:00.000Z");
  assert.equal(claimResult.report.reportSnapshot, null);
  assert.equal(claimResult.report.inputSnapshot.inputType, "team_dynamics_report_input_v1");
  assert.equal(claimSupabase.state.team_assessment_reports[0].report_status, "processing");
  assert.equal(
    claimSupabase.state.team_assessment_reports[0].started_at,
    "2026-05-29T09:00:00.000Z",
  );
  assert.equal(
    claimSupabase.state.team_assessment_reports[0].report_snapshot,
    null,
  );
  assert.notEqual(claimSupabase.state.team_assessment_reports[0].report_status, "ready");
  assert.deepEqual(claimSupabase.state.attempt_reports, [
    {
      id: "attempt-report-1",
      report_status: "queued",
    },
  ]);
  assert.deepEqual(claimSupabase.state.assessment_reports, [
    {
      id: "assessment-report-1",
      report_status: "queued",
    },
  ]);
  assert.equal(
    claimSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "attempt_reports",
    ),
    false,
  );
  assert.equal(
    claimSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "assessment_reports",
    ),
    false,
  );

  const processingSupabase = createSupabaseStub({
    ...buildBaseState(),
    team_assessment_reports: [
      {
        ...buildBaseState().team_assessment_reports[0],
        report_status: "processing",
        started_at: "2026-05-29T08:30:00.000Z",
      },
    ],
  });
  const processingBefore = JSON.stringify(processingSupabase.state.team_assessment_reports[0]);
  const processingResult = await claimTeamDynamicsReportForProcessing(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: processingSupabase,
      persistInputSnapshot: async () => {
        throw new Error("should not be called");
      },
    },
  );
  assert.deepEqual(
    {
      ok: processingResult.ok,
      operation: processingResult.operation,
      reason: processingResult.reason,
    },
    {
      ok: false,
      operation: "already_processing",
      reason: "Team Dynamics report is already processing.",
    },
  );
  assert.equal(
    JSON.stringify(processingSupabase.state.team_assessment_reports[0]),
    processingBefore,
  );

  const readySupabase = createSupabaseStub({
    ...buildBaseState(),
    team_assessment_reports: [
      {
        ...buildBaseState().team_assessment_reports[0],
        report_status: "ready",
        report_snapshot: { ready: true },
      },
    ],
  });
  const readyBefore = JSON.stringify(readySupabase.state.team_assessment_reports[0]);
  const readyResult = await claimTeamDynamicsReportForProcessing(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: readySupabase,
      persistInputSnapshot: async () => {
        throw new Error("should not be called");
      },
    },
  );
  assert.equal(readyResult.ok, false);
  assert.equal(readyResult.operation, "already_ready");
  assert.equal(
    JSON.stringify(readySupabase.state.team_assessment_reports[0]),
    readyBefore,
  );

  const failedSupabase = createSupabaseStub({
    ...buildBaseState(),
    team_assessment_reports: [
      {
        ...buildBaseState().team_assessment_reports[0],
        report_status: "failed",
        error_message: "provider_timeout",
      },
    ],
  });
  const failedBefore = JSON.stringify(failedSupabase.state.team_assessment_reports[0]);
  const failedResult = await claimTeamDynamicsReportForProcessing(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: failedSupabase,
      persistInputSnapshot: async () => {
        throw new Error("should not be called");
      },
    },
  );
  assert.equal(failedResult.ok, false);
  assert.equal(failedResult.operation, "failed_not_claimable");
  assert.equal(
    JSON.stringify(failedSupabase.state.team_assessment_reports[0]),
    failedBefore,
  );

  const mismatchSupabase = createSupabaseStub(buildBaseState());
  const mismatchResult = await claimTeamDynamicsReportForProcessing(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-2",
    },
    {
      supabase: mismatchSupabase,
      persistInputSnapshot: async () => {
        throw new Error("should not be called");
      },
    },
  );
  assert.deepEqual(mismatchResult, {
    ok: false,
    operation: "report_not_found",
    reason: "Team Dynamics report row was not found for this organization.",
  });
  assert.equal(mismatchSupabase.state.team_assessment_reports[0].report_status, "queued");
}

main()
  .then(() => {
    console.log("Team Dynamics report processing lifecycle tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
