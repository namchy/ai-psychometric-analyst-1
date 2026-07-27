const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const migrationPath = path.join(
  projectRoot,
  "supabase",
  "migrations",
  "20260528133000_add_team_assessment_reports.sql",
);
const helperPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-dynamics-report-lifecycle.ts",
);
const routePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "teams",
  "[teamId]",
  "reports",
  "new",
  "page.tsx",
);
const componentPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "team-dynamics-report-member-selection.tsx",
);
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "team-dynamics-report-lifecycle-"));
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
    request === "@/lib/assessment/team-assessment-aggregation-read"
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

const migrationSource = fs.readFileSync(migrationPath, "utf8");
const helperSource = fs.readFileSync(helperPath, "utf8");
const routeSource = fs.readFileSync(routePath, "utf8");
const componentSource = fs.readFileSync(componentPath, "utf8");

assert.match(
  migrationSource,
  /create table if not exists public\.team_assessment_reports/i,
);
assert.match(
  migrationSource,
  /organization_id uuid not null references public\.organizations\(id\) on delete cascade/i,
);
assert.match(
  migrationSource,
  /team_assessment_assignment_id uuid not null references public\.team_assessment_assignments\(id\) on delete cascade/i,
);
assert.match(
  migrationSource,
  /selection_draft_id uuid not null references public\.team_assessment_report_selection_drafts\(id\) on delete restrict/i,
);
assert.match(
  migrationSource,
  /aggregation_snapshot_id uuid null references public\.team_assessment_aggregation_snapshots\(id\) on delete set null/i,
);
assert.match(
  migrationSource,
  /included_member_ids_snapshot jsonb not null default '\[\]'::jsonb/i,
);
assert.match(
  migrationSource,
  /check \(report_status in \('queued', 'processing', 'ready', 'failed'\)\)/i,
);
assert.match(
  migrationSource,
  /jsonb_typeof\(included_member_ids_snapshot\) = 'array'/i,
);
assert.match(
  migrationSource,
  /create policy "team_assessment_reports_read_member"/i,
);
assert.match(
  migrationSource,
  /alter table public\.team_assessment_reports enable row level security/i,
);
assert.doesNotMatch(migrationSource, /attempt_reports/i);
assert.doesNotMatch(migrationSource, /public\.assessment_reports/i);

assert.match(helperSource, /TEAM_DYNAMICS_REPORT_TYPE = "team_dynamics_report_v1"/);
assert.match(helperSource, /TEAM_DYNAMICS_REPORT_VERSION =\s*"team_dynamics_executive_overview_v1"/);
assert.match(helperSource, /"queued",\s*"processing",\s*"ready",\s*"failed"/);
assert.match(helperSource, /export async function listTeamDynamicsReportRowsForAssignment/);
assert.match(helperSource, /export async function queueTeamDynamicsReportShell/);
assert.match(helperSource, /included_member_ids_snapshot: includedMemberIdsSnapshot/);
assert.match(helperSource, /selectionDraftId is required\./);
assert.match(helperSource, /loadTeamDynamicsFinalAggregationVerification/);
assert.match(helperSource, /TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION/);
assert.match(helperSource, /aggregationVerification\.status !== "ready"/);
assert.doesNotMatch(helperSource, /loadTeamAssessmentAggregationVerification/);
assert.doesNotMatch(helperSource, /attempt_reports/);
assert.doesNotMatch(helperSource, /public\.assessment_reports/);
assert.doesNotMatch(helperSource, /refreshTeamAssessmentAggregationSnapshot/);
assert.doesNotMatch(helperSource, /persistTeamAssessmentAggregationSnapshot/);
assert.doesNotMatch(helperSource, /Team Fit|renderer/i);

assert.match(routeSource, /listTeamDynamicsReportRowsForAssignment/);
assert.doesNotMatch(routeSource, /input_snapshot/);
assert.doesNotMatch(routeSource, /report_snapshot/);
assert.doesNotMatch(componentSource, /team-dynamics-report-lifecycle/);
assert.match(componentSource, /queueTeamDynamicsReportAction/);
assert.match(componentSource, /Pripremi timski izvještaj/);
assert.doesNotMatch(componentSource, /Kreiraj timski izvještaj/);
assert.match(
  componentSource,
  /savedState\.selectionDraftId/,
);
assert.match(componentSource, /savedState\.canCreateTeamReport/);
assert.match(componentSource, /disabled=\{isPending \|\| !canQueueSavedSelection\}/);

fs.writeFileSync(
  teamDynamicsStubPath,
  'module.exports = { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG: "team_dynamics_assessment_v1" };',
);

const {
  TEAM_DYNAMICS_REPORT_TYPE,
  TEAM_DYNAMICS_REPORT_VERSION,
  listTeamDynamicsReportRowsForAssignment,
  queueTeamDynamicsReportShell,
} = require(helperPath);

function createSupabaseStub(initialState = {}) {
  const state = {
    teams: [...(initialState.teams ?? [])],
    team_assessment_assignments: [...(initialState.team_assessment_assignments ?? [])],
    team_assessment_report_selection_drafts: [
      ...(initialState.team_assessment_report_selection_drafts ?? []),
    ],
    team_assessment_report_selection_members: [
      ...(initialState.team_assessment_report_selection_members ?? []),
    ],
    team_assessment_reports: [...(initialState.team_assessment_reports ?? [])],
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
        table,
        filters: [],
        insertedRows: null,
        select() {
          return this;
        },
        eq(column, value) {
          this.filters.push({ type: "eq", column, value });
          return this;
        },
        order() {
          return this;
        },
        insert(payload) {
          this.insertedRows = Array.isArray(payload) ? payload : [payload];
          operations.push({ type: "insert", table, payload: this.insertedRows });
          return this;
        },
        async maybeSingle() {
          const rows = applyFilters(state[table] ?? [], this.filters);
          return {
            data: rows[0] ?? null,
            error: null,
          };
        },
        async single() {
          if (this.insertedRows) {
            const inserted = this.insertedRows.map((row, index) => {
              const materialized = {
                id: row.id ?? `${table}-row-${state[table].length + index + 1}`,
                generator_type: null,
                model_name: null,
                input_snapshot: null,
                report_snapshot: null,
                error_message: null,
                started_at: null,
                completed_at: null,
                created_at: row.created_at ?? "2026-05-28T12:00:00.000Z",
                updated_at: row.updated_at ?? "2026-05-28T12:00:00.000Z",
                ...row,
              };
              state[table].push(materialized);
              return materialized;
            });

            return {
              data: inserted[0] ?? null,
              error: null,
            };
          }

          const rows = applyFilters(state[table] ?? [], this.filters);
          return {
            data: rows[0] ?? null,
            error: null,
          };
        },
        then(resolve, reject) {
          const rows = applyFilters(state[table] ?? [], this.filters);
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };

      return query;
    },
  };
}

async function main() {
  assert.equal(TEAM_DYNAMICS_REPORT_TYPE, "team_dynamics_report_v1");
  assert.equal(TEAM_DYNAMICS_REPORT_VERSION, "team_dynamics_executive_overview_v1");

  const supabase = createSupabaseStub({
    teams: [
      {
        id: "team-1",
        organization_id: "org-1",
        archived_at: null,
      },
    ],
    team_assessment_assignments: [
      {
        id: "assignment-1",
        team_id: "team-1",
        package_slug: "team_dynamics_assessment_v1",
      },
    ],
    team_assessment_report_selection_drafts: [
      {
        id: "draft-1",
        team_assessment_assignment_id: "assignment-1",
        team_id: "team-1",
      },
    ],
    team_assessment_report_selection_members: [
      {
        selection_draft_id: "draft-1",
        team_assessment_participant_id: "tap-2",
      },
      {
        selection_draft_id: "draft-1",
        team_assessment_participant_id: "tap-1",
      },
      {
        selection_draft_id: "draft-1",
        team_assessment_participant_id: "tap-2",
      },
    ],
  });

  const queued = await queueTeamDynamicsReportShell(
    {
      organizationId: "org-1",
      teamId: "team-1",
      teamAssessmentAssignmentId: "assignment-1",
      selectionDraftId: "draft-1",
    },
    {
      supabase,
      loadAggregationVerification: async () => ({
        status: "ready",
        teamAssessmentAssignmentId: "assignment-1",
        testSlug: "team_dynamics_assessment_v1",
        aggregationVersion: "team_dynamics_assessment_v1_mixed_aggregation_v1",
        aggregationSnapshotId: "agg-1",
        aggregationSnapshot: { teamId: "team-1" },
        scoreEntryAggregations: [],
        hasUnifiedOverallTeamScore: true,
        hasTdmBlockAggregation: true,
        hasTdmDomainAggregations: true,
        hasPsychologicalSafetyAggregation: true,
        hasSjtAggregation: true,
        hasOutcomePulseAggregation: true,
        includedMemberCount: 4,
        completedMemberCount: 4,
        readyScoredMemberCount: 4,
        incompleteMemberCount: 0,
        missingScoreCount: 0,
        invalidScoreCount: 0,
        calculatedAt: "2026-05-28T11:00:00.000Z",
        updatedAt: "2026-05-28T11:00:00.000Z",
        createdAt: "2026-05-28T11:00:00.000Z",
        reason: null,
      }),
    },
  );

  assert.equal(queued.ok, true);
  assert.deepEqual(queued.report.includedMemberIdsSnapshot, ["tap-1", "tap-2"]);
  assert.equal(queued.report.aggregationSnapshotId, "agg-1");
  assert.equal(queued.report.reportType, TEAM_DYNAMICS_REPORT_TYPE);
  assert.equal(queued.report.reportVersion, TEAM_DYNAMICS_REPORT_VERSION);
  assert.equal(queued.report.reportStatus, "queued");
  assert.equal(
    supabase.operations.some(
      (operation) => operation.type === "from" && operation.table === "attempt_reports",
    ),
    false,
  );
  assert.equal(
    supabase.operations.some(
      (operation) => operation.type === "from" && operation.table === "assessment_reports",
    ),
    false,
  );

  const reports = await listTeamDynamicsReportRowsForAssignment(
    {
      organizationId: "org-1",
      teamId: "team-1",
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase,
    },
  );

  assert.equal(reports.length, 1);
  assert.deepEqual(reports[0].includedMemberIdsSnapshot, ["tap-1", "tap-2"]);

  const notReady = await queueTeamDynamicsReportShell(
    {
      organizationId: "org-1",
      teamId: "team-1",
      teamAssessmentAssignmentId: "assignment-1",
      selectionDraftId: "draft-1",
    },
    {
      supabase,
      loadAggregationVerification: async () => ({
        status: "not_ready",
        teamAssessmentAssignmentId: "assignment-1",
        testSlug: "team_dynamics_assessment_v1",
        aggregationVersion: "team_dynamics_assessment_v1_mixed_aggregation_v1",
        aggregationSnapshotId: null,
        aggregationSnapshot: null,
        scoreEntryAggregations: [],
        hasUnifiedOverallTeamScore: false,
        hasTdmBlockAggregation: false,
        hasTdmDomainAggregations: false,
        hasPsychologicalSafetyAggregation: false,
        hasSjtAggregation: false,
        hasOutcomePulseAggregation: false,
        includedMemberCount: 4,
        completedMemberCount: 3,
        readyScoredMemberCount: 3,
        incompleteMemberCount: 1,
        missingScoreCount: 1,
        invalidScoreCount: 0,
        calculatedAt: "2026-05-28T11:00:00.000Z",
        updatedAt: "2026-05-28T11:00:00.000Z",
        createdAt: "2026-05-28T11:00:00.000Z",
        reason: "aggregation_snapshot_not_ready",
      }),
    },
  );

  assert.equal(notReady.ok, false);
  assert.equal(notReady.code, "aggregation_not_ready");
  assert.equal(supabase.state.team_assessment_reports.length, 1);
}

main()
  .then(() => {
    console.log("Team Dynamics report lifecycle shell tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
