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
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "team-dynamics-report-failure-lifecycle-"),
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

assert.match(helperSource, /export async function markTeamDynamicsReportProcessingFailed/);
assert.match(helperSource, /error_message: failureMessage/);
assert.match(helperSource, /completed_at: completedAt/);
assert.match(helperSource, /operation: "not_processing"/);
assert.match(helperSource, /operation: "already_ready"/);
assert.match(helperSource, /operation: "already_failed"/);
assert.match(helperSource, /operation: "not_fail_claimable"/);
assert.doesNotMatch(helperSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(helperSource, /\.update\(\{\s*report_snapshot:/s);
assert.doesNotMatch(helperSource, /report_status:\s*"ready"/);
assert.doesNotMatch(helperSource, /OpenAI|AI provider|renderer|worker|Team Fit/i);

fs.writeFileSync(
  teamDynamicsStubPath,
  'module.exports = { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG: "team_dynamics_assessment_v1" };',
);

const {
  markTeamDynamicsReportProcessingFailed,
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
        report_status: "processing",
        generator_type: null,
        model_name: null,
        included_member_ids_snapshot: ["tap-2", "tap-1"],
        input_snapshot: {
          inputType: "team_dynamics_report_input_v1",
          teamAssessmentReportId: "report-1",
        },
        report_snapshot: null,
        error_message: null,
        queued_at: "2026-05-29T08:00:00.000Z",
        started_at: "2026-05-29T08:30:00.000Z",
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
  const processingSupabase = createSupabaseStub(buildBaseState());
  const failed = await markTeamDynamicsReportProcessingFailed(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
      failure: {
        code: "TEAM_DYNAMICS_PROCESSING_FAILED",
        reason: "snapshot_validation_failed",
        message: "Team Dynamics processing shell failed.",
      },
    },
    {
      supabase: processingSupabase,
      now: () => "2026-05-29T09:15:00.000Z",
    },
  );

  assert.equal(failed.ok, true);
  assert.equal(failed.operation, "marked_failed");
  assert.equal(failed.report.reportStatus, "failed");
  assert.equal(
    failed.failure.errorMessage,
    "TEAM_DYNAMICS_PROCESSING_FAILED | snapshot_validation_failed | Team Dynamics processing shell failed.",
  );
  assert.equal(processingSupabase.state.team_assessment_reports[0].report_status, "failed");
  assert.equal(
    processingSupabase.state.team_assessment_reports[0].error_message,
    "TEAM_DYNAMICS_PROCESSING_FAILED | snapshot_validation_failed | Team Dynamics processing shell failed.",
  );
  assert.equal(
    processingSupabase.state.team_assessment_reports[0].completed_at,
    "2026-05-29T09:15:00.000Z",
  );
  assert.deepEqual(processingSupabase.state.team_assessment_reports[0].input_snapshot, {
    inputType: "team_dynamics_report_input_v1",
    teamAssessmentReportId: "report-1",
  });
  assert.equal(
    processingSupabase.state.team_assessment_reports[0].report_snapshot,
    null,
  );
  assert.equal(
    processingSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "attempt_reports",
    ),
    false,
  );
  assert.equal(
    processingSupabase.operations.some(
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
        started_at: null,
      },
    ],
  });
  const queuedBefore = JSON.stringify(queuedSupabase.state.team_assessment_reports[0]);
  const queued = await markTeamDynamicsReportProcessingFailed(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
      failure: {
        message: "Should not fail queued row.",
      },
    },
    {
      supabase: queuedSupabase,
    },
  );
  assert.equal(queued.ok, false);
  assert.equal(queued.operation, "not_processing");
  assert.equal(
    JSON.stringify(queuedSupabase.state.team_assessment_reports[0]),
    queuedBefore,
  );

  const readySupabase = createSupabaseStub({
    ...buildBaseState(),
    team_assessment_reports: [
      {
        ...buildBaseState().team_assessment_reports[0],
        report_status: "ready",
        report_snapshot: { ready: true },
        completed_at: "2026-05-29T09:00:00.000Z",
      },
    ],
  });
  const readyBefore = JSON.stringify(readySupabase.state.team_assessment_reports[0]);
  const ready = await markTeamDynamicsReportProcessingFailed(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
      failure: {
        message: "Should not fail ready row.",
      },
    },
    {
      supabase: readySupabase,
    },
  );
  assert.equal(ready.ok, false);
  assert.equal(ready.operation, "already_ready");
  assert.equal(
    JSON.stringify(readySupabase.state.team_assessment_reports[0]),
    readyBefore,
  );

  const alreadyFailedSupabase = createSupabaseStub({
    ...buildBaseState(),
    team_assessment_reports: [
      {
        ...buildBaseState().team_assessment_reports[0],
        report_status: "failed",
        error_message: "PREVIOUS_FAILURE",
        completed_at: "2026-05-29T09:00:00.000Z",
      },
    ],
  });
  const failedBefore = JSON.stringify(alreadyFailedSupabase.state.team_assessment_reports[0]);
  const alreadyFailed = await markTeamDynamicsReportProcessingFailed(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
      failure: {
        message: "Should not overwrite existing failure.",
      },
    },
    {
      supabase: alreadyFailedSupabase,
    },
  );
  assert.equal(alreadyFailed.ok, false);
  assert.equal(alreadyFailed.operation, "already_failed");
  assert.equal(
    JSON.stringify(alreadyFailedSupabase.state.team_assessment_reports[0]),
    failedBefore,
  );

  const mismatchSupabase = createSupabaseStub(buildBaseState());
  const mismatch = await markTeamDynamicsReportProcessingFailed(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-2",
      failure: {
        message: "Org mismatch should not see row.",
      },
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
    console.log("Team Dynamics report failure lifecycle tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
