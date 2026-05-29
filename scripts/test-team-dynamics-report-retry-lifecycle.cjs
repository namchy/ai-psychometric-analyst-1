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
const resetSection =
  helperSource.match(
    /export async function resetFailedTeamDynamicsReportToQueued[\s\S]*$/,
  )?.[0] ?? "";
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "team-dynamics-report-retry-lifecycle-"),
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

assert.match(helperSource, /export async function resetFailedTeamDynamicsReportToQueued/);
assert.match(helperSource, /report_status: "queued"/);
assert.match(helperSource, /error_message: null/);
assert.match(helperSource, /started_at: null/);
assert.match(helperSource, /completed_at: null/);
assert.match(helperSource, /operation: "already_queued"/);
assert.match(helperSource, /operation: "processing_not_resettable"/);
assert.match(helperSource, /operation: "ready_not_resettable"/);
assert.match(helperSource, /operation: "not_resettable"/);
assert.doesNotMatch(helperSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(resetSection, /\.update\(\{\s*report_snapshot:/s);
assert.doesNotMatch(resetSection, /report_status:\s*"ready"/);
assert.doesNotMatch(resetSection, /renderer|worker|Team Fit/i);

fs.writeFileSync(
  teamDynamicsStubPath,
  'module.exports = { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG: "team_dynamics_assessment_v1" };',
);

const {
  resetFailedTeamDynamicsReportToQueued,
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
        report_status: "failed",
        generator_type: null,
        model_name: null,
        included_member_ids_snapshot: ["tap-2", "tap-1"],
        input_snapshot: {
          inputType: "team_dynamics_report_input_v1",
          teamAssessmentReportId: "report-1",
        },
        report_snapshot: null,
        error_message: "PREVIOUS_FAILURE",
        queued_at: "2026-05-29T08:00:00.000Z",
        started_at: "2026-05-29T08:30:00.000Z",
        completed_at: "2026-05-29T09:15:00.000Z",
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
  const failedSupabase = createSupabaseStub(buildBaseState());
  const reset = await resetFailedTeamDynamicsReportToQueued(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: failedSupabase,
    },
  );

  assert.equal(reset.ok, true);
  assert.equal(reset.operation, "reset_to_queued");
  assert.equal(reset.report.reportStatus, "queued");
  assert.equal(failedSupabase.state.team_assessment_reports[0].report_status, "queued");
  assert.equal(failedSupabase.state.team_assessment_reports[0].error_message, null);
  assert.equal(failedSupabase.state.team_assessment_reports[0].started_at, null);
  assert.equal(failedSupabase.state.team_assessment_reports[0].completed_at, null);
  assert.deepEqual(
    failedSupabase.state.team_assessment_reports[0].included_member_ids_snapshot,
    ["tap-2", "tap-1"],
  );
  assert.deepEqual(failedSupabase.state.team_assessment_reports[0].input_snapshot, {
    inputType: "team_dynamics_report_input_v1",
    teamAssessmentReportId: "report-1",
  });
  assert.equal(failedSupabase.state.team_assessment_reports[0].report_snapshot, null);
  assert.notEqual(failedSupabase.state.team_assessment_reports[0].report_status, "ready");
  assert.equal(
    failedSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "attempt_reports",
    ),
    false,
  );
  assert.equal(
    failedSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "assessment_reports",
    ),
    false,
  );

  const queuedSupabase = createSupabaseStub({
    ...buildBaseState(),
    team_assessment_reports: [
      {
        ...buildBaseState().team_assessment_reports[0],
        report_status: "queued",
        error_message: null,
        started_at: null,
        completed_at: null,
      },
    ],
  });
  const queuedBefore = JSON.stringify(queuedSupabase.state.team_assessment_reports[0]);
  const queued = await resetFailedTeamDynamicsReportToQueued(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: queuedSupabase,
    },
  );
  assert.equal(queued.ok, false);
  assert.equal(queued.operation, "already_queued");
  assert.equal(
    JSON.stringify(queuedSupabase.state.team_assessment_reports[0]),
    queuedBefore,
  );

  const processingSupabase = createSupabaseStub({
    ...buildBaseState(),
    team_assessment_reports: [
      {
        ...buildBaseState().team_assessment_reports[0],
        report_status: "processing",
        error_message: null,
      },
    ],
  });
  const processingBefore = JSON.stringify(processingSupabase.state.team_assessment_reports[0]);
  const processing = await resetFailedTeamDynamicsReportToQueued(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: processingSupabase,
    },
  );
  assert.equal(processing.ok, false);
  assert.equal(processing.operation, "processing_not_resettable");
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
        error_message: null,
      },
    ],
  });
  const readyBefore = JSON.stringify(readySupabase.state.team_assessment_reports[0]);
  const ready = await resetFailedTeamDynamicsReportToQueued(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: readySupabase,
    },
  );
  assert.equal(ready.ok, false);
  assert.equal(ready.operation, "ready_not_resettable");
  assert.equal(
    JSON.stringify(readySupabase.state.team_assessment_reports[0]),
    readyBefore,
  );

  const mismatchSupabase = createSupabaseStub(buildBaseState());
  const mismatch = await resetFailedTeamDynamicsReportToQueued(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-2",
    },
    {
      supabase: mismatchSupabase,
    },
  );
  assert.deepEqual(mismatch, {
    ok: false,
    operation: "report_not_found",
    reason: "Team Dynamics report row was not found for this organization.",
  });
}

main()
  .then(() => {
    console.log("Team Dynamics report retry lifecycle tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
