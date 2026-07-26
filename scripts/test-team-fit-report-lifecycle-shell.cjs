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
  "20260530110000_add_team_fit_reports.sql",
);
const helperPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-lifecycle.ts");
const todoPath = path.join(projectRoot, "docs", "deep-profile-todo.md");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
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
  if (request === "server-only" || request === "@/lib/supabase/admin") {
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
const todoSource = fs.readFileSync(todoPath, "utf8");

assert.match(migrationSource, /create table if not exists public\.team_fit_reports/i);
assert.match(migrationSource, /organization_id uuid not null references public\.organizations\(id\) on delete cascade/i);
assert.match(migrationSource, /team_id uuid not null references public\.teams\(id\) on delete cascade/i);
assert.match(migrationSource, /participant_id uuid not null references public\.participants\(id\) on delete cascade/i);
assert.match(migrationSource, /created_by uuid null references auth\.users\(id\) on delete set null/i);
assert.match(migrationSource, /check \(report_type = 'team_fit_report_v1'\)/i);
assert.match(migrationSource, /check \(report_version = 'v1'\)/i);
assert.match(migrationSource, /check \(report_status in \('queued', 'processing', 'ready', 'failed'\)\)/i);
assert.match(migrationSource, /candidate_source_type in \('composite_deterministic_input_snapshot'\)/i);
assert.match(migrationSource, /team_source_type in \('team_dynamics_aggregation_input_snapshot'\)/i);
assert.match(migrationSource, /create index if not exists team_fit_reports_queue_idx/i);
assert.match(migrationSource, /where report_status = 'queued'/i);
assert.match(migrationSource, /create policy "team_fit_reports_read_hr_admin"/i);
assert.match(migrationSource, /create policy "team_fit_reports_insert_hr_admin"/i);
assert.match(migrationSource, /create policy "team_fit_reports_update_hr_admin"/i);
assert.match(migrationSource, /membership\.role in \('org_owner', 'hr_admin'\)/i);
assert.doesNotMatch(migrationSource, /attempt_reports/i);
assert.doesNotMatch(migrationSource, /public\.assessment_reports/i);
assert.doesNotMatch(migrationSource, /public\.team_assessment_reports/i);

assert.match(helperSource, /TEAM_FIT_REPORT_TYPE = TEAM_FIT_REPORT_V1_TYPE/);
assert.match(helperSource, /TEAM_FIT_REPORT_VERSION = TEAM_FIT_REPORT_V1_VERSION/);
assert.match(helperSource, /TEAM_FIT_REPORT_STATUSES = \["queued", "processing", "ready", "failed"\]/);
assert.match(helperSource, /export async function queueTeamFitReportShell/);
assert.match(helperSource, /export async function queueTeamFitReportV2Shell/);
assert.match(helperSource, /export async function claimTeamFitReportForProcessing/);
assert.match(helperSource, /export async function markTeamFitReportProcessingFailed/);
assert.match(helperSource, /export async function resetFailedTeamFitReportToQueued/);
assert.match(helperSource, /candidate_source_type: input\.candidateSourceType/);
assert.match(helperSource, /team_source_type: input\.teamSourceType/);
assert.match(helperSource, /report_status: "queued"/);
assert.match(helperSource, /report_status: "processing"/);
assert.match(helperSource, /report_status: "failed"/);
assert.match(helperSource, /failed_at: failedAt/);
assert.match(helperSource, /queued_at: queuedAt/);
assert.doesNotMatch(helperSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("team_assessment_reports"\)/);
assert.doesNotMatch(helperSource, /OpenAI|provider|renderer|worker/i);
assert.doesNotMatch(helperSource, /raw answers/i);

assert.match(todoSource, /Storage\/lifecycle shell implemented \/ no provider\/renderer\/worker/);
assert.match(todoSource, /team_fit_reports/i);

const {
  TEAM_FIT_CANDIDATE_SOURCE_TYPE,
  TEAM_FIT_REPORT_TYPE,
  TEAM_FIT_REPORT_VERSION,
  TEAM_FIT_TEAM_SOURCE_TYPE,
  claimTeamFitReportForProcessing,
  markTeamFitReportProcessingFailed,
  queueTeamFitReportShell,
  queueTeamFitReportV2Shell,
  resetFailedTeamFitReportToQueued,
} = require(helperPath);
const {
  TEAM_FIT_REPORT_V1_TYPE,
  TEAM_FIT_REPORT_V1_VERSION,
  TEAM_FIT_REPORT_V2_TYPE,
  TEAM_FIT_REPORT_V2_VERSION,
} = require(path.join(projectRoot, "lib", "b2b", "team-fit-report-identity.ts"));

assert.equal(TEAM_FIT_REPORT_TYPE, TEAM_FIT_REPORT_V1_TYPE);
assert.equal(TEAM_FIT_REPORT_VERSION, TEAM_FIT_REPORT_V1_VERSION);

function createSupabaseStub(initialState = {}) {
  const state = {
    teams: [...(initialState.teams ?? [])],
    participants: [...(initialState.participants ?? [])],
    team_fit_reports: [...(initialState.team_fit_reports ?? [])],
    attempt_reports: [...(initialState.attempt_reports ?? [])],
    assessment_reports: [...(initialState.assessment_reports ?? [])],
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
        mode: "select",
        insertedRows: null,
        patch: null,
        select() {
          return query;
        },
        eq(column, value) {
          query.filters.push({ type: "eq", column, value });
          operations.push({ type: "eq", table, mode: query.mode, column, value });
          return query;
        },
        insert(payload) {
          query.mode = "insert";
          query.insertedRows = Array.isArray(payload) ? payload : [payload];
          operations.push({ type: "insert", table, payload: query.insertedRows });
          return query;
        },
        update(patch) {
          query.mode = "update";
          query.patch = patch;
          operations.push({ type: "update", table, patch });
          return query;
        },
        async maybeSingle() {
          if (query.mode === "update") {
            const rows = applyFilters(state[table] ?? [], query.filters);
            const row = rows[0] ?? null;

            if (!row) {
              return { data: null, error: null };
            }

            Object.assign(row, query.patch, {
              updated_at: row.updated_at ?? "2026-05-30T09:00:00.000Z",
            });
            return { data: row, error: null };
          }

          const rows = applyFilters(state[table] ?? [], query.filters);
          return { data: rows[0] ?? null, error: null };
        },
        async single() {
          if (query.mode === "insert") {
            const inserted = query.insertedRows.map((row, index) => {
              const materialized = {
                id: row.id ?? `${table}-row-${state[table].length + index + 1}`,
                input_snapshot: null,
                report_snapshot: null,
                error_message: null,
                started_at: null,
                completed_at: null,
                failed_at: null,
                created_by: null,
                created_at: row.created_at ?? "2026-05-30T09:00:00.000Z",
                updated_at: row.updated_at ?? "2026-05-30T09:00:00.000Z",
                ...row,
              };
              state[table].push(materialized);
              return materialized;
            });

            return { data: inserted[0] ?? null, error: null };
          }

          const rows = applyFilters(state[table] ?? [], query.filters);
          return { data: rows[0] ?? null, error: null };
        },
      };

      return query;
    },
  };
}

function countUpdates(supabase) {
  return supabase.operations.filter(
    (entry) => entry.type === "update" && entry.table === "team_fit_reports",
  ).length;
}

function assertIdentityCasFilters(supabase, reportType, reportVersion, expectedCount) {
  const typeFilters = supabase.operations.filter(
    (entry) =>
      entry.type === "eq" &&
      entry.table === "team_fit_reports" &&
      entry.mode === "update" &&
      entry.column === "report_type" &&
      entry.value === reportType,
  );
  const versionFilters = supabase.operations.filter(
    (entry) =>
      entry.type === "eq" &&
      entry.table === "team_fit_reports" &&
      entry.mode === "update" &&
      entry.column === "report_version" &&
      entry.value === reportVersion,
  );

  assert.equal(typeFilters.length, expectedCount);
  assert.equal(versionFilters.length, expectedCount);
}

async function assertReadyProtection(row) {
  const readySupabase = createSupabaseStub(buildBaseState());
  readySupabase.state.team_fit_reports.push({ ...row, report_status: "ready" });
  const before = countUpdates(readySupabase);
  const input = {
    teamFitReportId: row.id,
    organizationId: row.organization_id,
  };

  const claim = await claimTeamFitReportForProcessing(input, {
    supabase: readySupabase,
  });
  const fail = await markTeamFitReportProcessingFailed(
    { ...input, errorMessage: "MUST_NOT_WRITE" },
    { supabase: readySupabase },
  );
  const reset = await resetFailedTeamFitReportToQueued(input, {
    supabase: readySupabase,
  });

  assert.equal(claim.ok, false);
  assert.equal(claim.reason, "already_ready");
  assert.equal(fail.ok, false);
  assert.equal(fail.reason, "already_ready");
  assert.equal(reset.ok, false);
  assert.equal(reset.reason, "ready_not_resettable");
  assert.equal(countUpdates(readySupabase), before);
  assert.equal(readySupabase.state.team_fit_reports[0].report_status, "ready");
}

function buildBaseState() {
  return {
    teams: [{ id: "team-1", organization_id: "org-1", archived_at: null }],
    participants: [{ id: "participant-1", organization_id: "org-1" }],
    team_fit_reports: [],
    attempt_reports: [{ id: "attempt-report-1", report_status: "queued" }],
    assessment_reports: [{ id: "assessment-report-1", report_status: "queued" }],
    team_assessment_reports: [{ id: "team-assessment-report-1", report_status: "queued" }],
  };
}

async function main() {
  const queueSupabase = createSupabaseStub(buildBaseState());
  const queued = await queueTeamFitReportShell(
    {
      organizationId: "org-1",
      teamId: "team-1",
      participantId: "participant-1",
      candidateSourceType: TEAM_FIT_CANDIDATE_SOURCE_TYPE,
      candidateSourceId: "candidate-source-1",
      teamSourceType: TEAM_FIT_TEAM_SOURCE_TYPE,
      teamSourceId: "team-source-1",
      optionalContext: { locale: "bs" },
      createdBy: "user-1",
    },
    {
      supabase: queueSupabase,
      now: () => "2026-05-30T10:00:00.000Z",
    },
  );

  assert.equal(queued.ok, true);
  assert.equal(queued.status, "queued");
  assert.equal(queued.report.reportType, TEAM_FIT_REPORT_TYPE);
  assert.equal(queued.report.reportVersion, TEAM_FIT_REPORT_VERSION);
  assert.equal(queued.report.reportStatus, "queued");
  assert.equal(queued.report.organizationId, "org-1");
  assert.equal(queued.report.teamId, "team-1");
  assert.equal(queued.report.participantId, "participant-1");
  assert.equal(queued.report.candidateSourceType, TEAM_FIT_CANDIDATE_SOURCE_TYPE);
  assert.equal(queued.report.candidateSourceId, "candidate-source-1");
  assert.equal(queued.report.teamSourceType, TEAM_FIT_TEAM_SOURCE_TYPE);
  assert.equal(queued.report.teamSourceId, "team-source-1");
  assert.deepEqual(queued.report.optionalContext, { locale: "bs" });
  assert.equal(queued.report.inputSnapshot, null);
  assert.equal(queued.report.reportSnapshot, null);
  assert.equal(queueSupabase.state.team_fit_reports.length, 1);

  const queuedV2 = await queueTeamFitReportV2Shell(
    {
      organizationId: "org-1",
      teamId: "team-1",
      participantId: "participant-1",
      candidateSourceType: TEAM_FIT_CANDIDATE_SOURCE_TYPE,
      candidateSourceId: "candidate-source-1",
      teamSourceType: TEAM_FIT_TEAM_SOURCE_TYPE,
      teamSourceId: "team-source-1",
      optionalContext: { locale: "bs" },
      createdBy: "user-1",
    },
    {
      supabase: queueSupabase,
      now: () => "2026-05-30T10:01:00.000Z",
    },
  );

  assert.equal(queuedV2.ok, true);
  assert.equal(queuedV2.report.reportType, TEAM_FIT_REPORT_V2_TYPE);
  assert.equal(queuedV2.report.reportVersion, TEAM_FIT_REPORT_V2_VERSION);
  assert.equal(queueSupabase.state.team_fit_reports.length, 2);
  assert.equal(queueSupabase.state.team_fit_reports[0].report_type, TEAM_FIT_REPORT_V1_TYPE);
  assert.equal(queueSupabase.state.team_fit_reports[1].report_type, TEAM_FIT_REPORT_V2_TYPE);
  assert.equal(queueSupabase.state.team_fit_reports[0].team_id, queueSupabase.state.team_fit_reports[1].team_id);
  assert.equal(queueSupabase.state.team_fit_reports[0].participant_id, queueSupabase.state.team_fit_reports[1].participant_id);

  const claimSupabase = createSupabaseStub(buildBaseState());
  claimSupabase.state.team_fit_reports.push({
    ...queueSupabase.state.team_fit_reports[0],
  });

  const claimed = await claimTeamFitReportForProcessing(
    {
      teamFitReportId: claimSupabase.state.team_fit_reports[0].id,
      organizationId: "org-1",
    },
    {
      supabase: claimSupabase,
      now: () => "2026-05-30T10:05:00.000Z",
    },
  );

  assert.equal(claimed.ok, true);
  assert.equal(claimed.status, "processing");
  assert.equal(claimed.report.reportStatus, "processing");
  assert.equal(claimed.report.startedAt, "2026-05-30T10:05:00.000Z");
  assert.equal(claimSupabase.state.team_fit_reports[0].report_status, "processing");

  const secondClaim = await claimTeamFitReportForProcessing(
    {
      teamFitReportId: claimSupabase.state.team_fit_reports[0].id,
      organizationId: "org-1",
    },
    {
      supabase: claimSupabase,
      now: () => "2026-05-30T10:06:00.000Z",
    },
  );

  assert.equal(secondClaim.ok, false);
  assert.equal(secondClaim.reason, "already_processing");

  claimSupabase.state.team_fit_reports[0].input_snapshot = {
    inputType: "team_fit_input_v1",
    persisted: true,
  };
  claimSupabase.state.team_fit_reports[0].report_snapshot = {
    stale: true,
  };
  const failed = await markTeamFitReportProcessingFailed(
    {
      teamFitReportId: claimSupabase.state.team_fit_reports[0].id,
      organizationId: "org-1",
      errorMessage: "TEAM_FIT_SHELL_FAILURE",
    },
    {
      supabase: claimSupabase,
      now: () => "2026-05-30T10:10:00.000Z",
    },
  );

  assert.equal(failed.ok, true);
  assert.equal(failed.status, "failed");
  assert.equal(failed.report.reportStatus, "failed");
  assert.equal(failed.report.failedAt, "2026-05-30T10:10:00.000Z");
  assert.equal(failed.report.errorMessage, "TEAM_FIT_SHELL_FAILURE");
  assert.deepEqual(claimSupabase.state.team_fit_reports[0].input_snapshot, {
    inputType: "team_fit_input_v1",
    persisted: true,
  });

  const reset = await resetFailedTeamFitReportToQueued(
    {
      teamFitReportId: claimSupabase.state.team_fit_reports[0].id,
      organizationId: "org-1",
    },
    {
      supabase: claimSupabase,
      now: () => "2026-05-30T10:15:00.000Z",
    },
  );

  assert.equal(reset.ok, true);
  assert.equal(reset.status, "queued");
  assert.equal(reset.report.reportStatus, "queued");
  assert.equal(reset.report.queuedAt, "2026-05-30T10:15:00.000Z");
  assert.equal(reset.report.startedAt, null);
  assert.equal(reset.report.failedAt, null);
  assert.equal(reset.report.completedAt, null);
  assert.equal(reset.report.errorMessage, null);
  assert.deepEqual(reset.report.inputSnapshot, {
    inputType: "team_fit_input_v1",
    persisted: true,
  });
  assert.deepEqual(reset.report.reportSnapshot, {
    stale: true,
  });
  assert.equal(reset.report.reportType, TEAM_FIT_REPORT_V1_TYPE);
  assert.equal(reset.report.reportVersion, TEAM_FIT_REPORT_V1_VERSION);
  assertIdentityCasFilters(
    claimSupabase,
    TEAM_FIT_REPORT_V1_TYPE,
    TEAM_FIT_REPORT_V1_VERSION,
    3,
  );

  claimSupabase.state.team_fit_reports[0].report_status = "queued";
  const alreadyQueuedReset = await resetFailedTeamFitReportToQueued(
    {
      teamFitReportId: claimSupabase.state.team_fit_reports[0].id,
      organizationId: "org-1",
    },
    { supabase: claimSupabase },
  );
  assert.equal(alreadyQueuedReset.ok, false);
  assert.equal(alreadyQueuedReset.reason, "already_queued");

  claimSupabase.state.team_fit_reports[0].report_status = "processing";
  const processingReset = await resetFailedTeamFitReportToQueued(
    {
      teamFitReportId: claimSupabase.state.team_fit_reports[0].id,
      organizationId: "org-1",
    },
    { supabase: claimSupabase },
  );
  assert.equal(processingReset.ok, false);
  assert.equal(processingReset.reason, "processing_not_resettable");

  claimSupabase.state.team_fit_reports[0].report_status = "ready";
  const readyReset = await resetFailedTeamFitReportToQueued(
    {
      teamFitReportId: claimSupabase.state.team_fit_reports[0].id,
      organizationId: "org-1",
    },
    { supabase: claimSupabase },
  );
  assert.equal(readyReset.ok, false);
  assert.equal(readyReset.reason, "ready_not_resettable");

  const wrongOrgClaim = await claimTeamFitReportForProcessing(
    {
      teamFitReportId: claimSupabase.state.team_fit_reports[0].id,
      organizationId: "org-2",
    },
    { supabase: claimSupabase },
  );
  assert.equal(wrongOrgClaim.ok, false);
  assert.equal(wrongOrgClaim.reason, "report_not_found");

  claimSupabase.state.team_fit_reports[0].report_status = "processing";
  const wrongOrgFail = await markTeamFitReportProcessingFailed(
    {
      teamFitReportId: claimSupabase.state.team_fit_reports[0].id,
      organizationId: "org-2",
      errorMessage: "WRONG_ORG",
    },
    { supabase: claimSupabase },
  );
  assert.equal(wrongOrgFail.ok, false);
  assert.equal(wrongOrgFail.reason, "report_not_found");

  claimSupabase.state.team_fit_reports[0].report_status = "failed";
  const wrongOrgReset = await resetFailedTeamFitReportToQueued(
    {
      teamFitReportId: claimSupabase.state.team_fit_reports[0].id,
      organizationId: "org-2",
    },
    { supabase: claimSupabase },
  );
  assert.equal(wrongOrgReset.ok, false);
  assert.equal(wrongOrgReset.reason, "report_not_found");

  const v2Supabase = createSupabaseStub(buildBaseState());
  v2Supabase.state.team_fit_reports.push({
    ...queueSupabase.state.team_fit_reports[1],
    input_snapshot: { inputType: "team_fit_input_v2", persisted: true },
    report_snapshot: { stale: true },
  });
  const v2Id = v2Supabase.state.team_fit_reports[0].id;
  const v2Claimed = await claimTeamFitReportForProcessing(
    { teamFitReportId: v2Id, organizationId: "org-1" },
    { supabase: v2Supabase },
  );
  assert.equal(v2Claimed.ok, true);
  assert.equal(v2Claimed.report.reportType, TEAM_FIT_REPORT_V2_TYPE);
  assert.equal(v2Claimed.report.reportVersion, TEAM_FIT_REPORT_V2_VERSION);

  const v2Failed = await markTeamFitReportProcessingFailed(
    {
      teamFitReportId: v2Id,
      organizationId: "org-1",
      errorMessage: "V2_FAILURE",
    },
    { supabase: v2Supabase },
  );
  assert.equal(v2Failed.ok, true);
  assert.equal(v2Failed.report.reportType, TEAM_FIT_REPORT_V2_TYPE);
  assert.equal(v2Failed.report.reportVersion, TEAM_FIT_REPORT_V2_VERSION);

  const v2Reset = await resetFailedTeamFitReportToQueued(
    { teamFitReportId: v2Id, organizationId: "org-1" },
    { supabase: v2Supabase },
  );
  assert.equal(v2Reset.ok, true);
  assert.equal(v2Reset.report.reportType, TEAM_FIT_REPORT_V2_TYPE);
  assert.equal(v2Reset.report.reportVersion, TEAM_FIT_REPORT_V2_VERSION);
  assert.deepEqual(v2Reset.report.inputSnapshot, {
    inputType: "team_fit_input_v2",
    persisted: true,
  });
  assert.deepEqual(v2Reset.report.reportSnapshot, { stale: true });
  assertIdentityCasFilters(
    v2Supabase,
    TEAM_FIT_REPORT_V2_TYPE,
    TEAM_FIT_REPORT_V2_VERSION,
    3,
  );

  await assertReadyProtection(queueSupabase.state.team_fit_reports[0]);
  await assertReadyProtection(queueSupabase.state.team_fit_reports[1]);

  assert.equal(
    claimSupabase.operations.some(
      (entry) => entry.type === "insert" && entry.table === "attempt_reports",
    ),
    false,
  );
  assert.equal(
    claimSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "attempt_reports",
    ),
    false,
  );
  assert.equal(
    claimSupabase.operations.some(
      (entry) => entry.type === "insert" && entry.table === "assessment_reports",
    ),
    false,
  );
  assert.equal(
    claimSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "assessment_reports",
    ),
    false,
  );
  assert.equal(
    claimSupabase.operations.some(
      (entry) => entry.type === "insert" && entry.table === "team_assessment_reports",
    ),
    false,
  );
  assert.equal(
    claimSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "team_assessment_reports",
    ),
    false,
  );

  console.log("test-team-fit-report-lifecycle-shell: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
