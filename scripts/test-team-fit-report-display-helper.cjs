const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const displayPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-display.ts");
const lifecyclePath = path.join(projectRoot, "lib", "b2b", "team-fit-report-lifecycle.ts");
const inputPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-input.ts");
const contractPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-contract.ts");
const providerPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-provider.ts");
const processorPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-processor.ts");
const todoPath = path.join(projectRoot, "docs", "deep-profile-todo.md");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const displaySource = fs.readFileSync(displayPath, "utf8");

assert.match(displaySource, /export async function loadTeamFitReportDisplayRecord/);
assert.match(displaySource, /TEAM_FIT_REPORT_TYPE/);
assert.match(displaySource, /TEAM_FIT_REPORT_VERSION/);
assert.match(displaySource, /Izvještaj je pripremljen za obradu/);
assert.match(displaySource, /Izvještaj je trenutno u obradi/);
assert.match(displaySource, /Izvještaj trenutno nije uspješno kreiran/);
assert.doesNotMatch(displaySource, /\.update\(/);
assert.doesNotMatch(displaySource, /\.insert\(/);
assert.doesNotMatch(displaySource, /OpenAI|api\.openai|chat\/completions|fetch\(/i);
assert.doesNotMatch(displaySource, /processTeamFitReportWithProvider|processTeamFitReportWithMock/);
assert.doesNotMatch(displaySource, /createTeamFitFakeProvider|validateTeamFitProviderSnapshotResult/);
assert.doesNotMatch(displaySource, /claimTeamFitReportForProcessing|markTeamFitReportProcessingFailed|resetFailedTeamFitReportToQueued/);
assert.doesNotMatch(displaySource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(displaySource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(displaySource, /\.from\("team_assessment_reports"\)/);

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

const { queueTeamFitReportShell } = require(lifecyclePath);
const { createTeamFitFakeProvider } = require(providerPath);
const { processTeamFitReportWithProvider } = require(processorPath);
const { validateTeamFitReportSnapshot } = require(contractPath);
const { loadTeamFitReportDisplayRecord } = require(displayPath);

function createSupabaseStub(initialState = {}) {
  const state = {
    organizations: [...(initialState.organizations ?? [])],
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
        filters: [],
        mode: "select",
        insertedRows: null,
        patch: null,
        select() {
          operations.push({ type: "select", table });
          return query;
        },
        eq(column, value) {
          query.filters.push({ type: "eq", column, value });
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
              updated_at: "2026-05-30T12:45:00.000Z",
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
                created_at: row.created_at ?? "2026-05-30T12:00:00.000Z",
                updated_at: row.updated_at ?? "2026-05-30T12:00:00.000Z",
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

function buildBaseState() {
  return {
    organizations: [{ id: "org-1", name: "Deep Profile" }],
    teams: [{ id: "team-1", organization_id: "org-1", name: "Tim A", archived_at: null }],
    participants: [{ id: "participant-1", organization_id: "org-1", full_name: "Amina Candidate" }],
    team_fit_reports: [],
    attempt_reports: [{ id: "attempt-report-1", report_status: "queued" }],
    assessment_reports: [{ id: "assessment-report-1", report_status: "queued" }],
    team_assessment_reports: [{ id: "team-assessment-report-1", report_status: "queued" }],
  };
}

async function buildReadyFixture() {
  const supabase = createSupabaseStub(buildBaseState());
  const queued = await queueTeamFitReportShell(
    {
      organizationId: "org-1",
      teamId: "team-1",
      participantId: "participant-1",
      candidateSourceType: "composite_deterministic_input_snapshot",
      candidateSourceId: "candidate-source-1",
      teamSourceType: "team_dynamics_aggregation_input_snapshot",
      teamSourceId: "team-source-1",
      optionalContext: { locale: "bs" },
      createdBy: "user-1",
    },
    {
      supabase,
      now: () => "2026-05-30T12:00:00.000Z",
    },
  );

  assert.equal(queued.ok, true);
  if (!queued.ok) {
    throw new Error(queued.message);
  }

  const processed = await processTeamFitReportWithProvider(
    {
      teamFitReportId: queued.reportId,
      organizationId: "org-1",
    },
    {
      supabase,
      now: () => "2026-05-30T12:45:00.000Z",
      provider: createTeamFitFakeProvider(),
    },
  );

  assert.deepEqual(processed, {
    ok: true,
    reportId: queued.reportId,
    status: "ready",
  });

  return { supabase, reportId: queued.reportId };
}

async function main() {
  const { supabase: readySupabase, reportId } = await buildReadyFixture();
  const readyResult = await loadTeamFitReportDisplayRecord(
    {
      organizationId: "org-1",
      teamId: "team-1",
      participantId: "participant-1",
      teamFitReportId: reportId,
    },
    {
      supabase: readySupabase,
    },
  );

  assert.ok(readyResult);
  assert.equal(readyResult.status, "ready");
  assert.equal(readyResult.reportSnapshot !== null, true);
  assert.equal(validateTeamFitReportSnapshot(readyResult.reportSnapshot).ok, true);
  assert.equal(readyResult.hasInputSnapshot, true);
  assert.equal(readyResult.hasReportSnapshot, true);
  assert.equal(readyResult.team.id, "team-1");
  assert.equal(readyResult.team.name, "Tim A");
  assert.equal(readyResult.candidate.participantId, "participant-1");
  assert.equal(readyResult.candidate.displayName, "Amina Candidate");
  assert.match(readyResult.safeStatusMessage, /spreman za pregled/i);
  assert.equal(
    readySupabase.operations.some(
      (operation) =>
        operation.table === "attempt_reports" ||
        operation.table === "assessment_reports" ||
        operation.table === "team_assessment_reports",
    ),
    false,
  );

  for (const [status, messagePattern] of [
    ["queued", /pripremljen za obradu/i],
    ["processing", /trenutno u obradi/i],
    ["failed", /nije uspješno kreiran/i],
  ]) {
    const statusSupabase = createSupabaseStub({
      ...buildBaseState(),
      team_fit_reports: [
        {
          id: "report-1",
          organization_id: "org-1",
          team_id: "team-1",
          participant_id: "participant-1",
          candidate_source_type: "composite_deterministic_input_snapshot",
          candidate_source_id: "candidate-source-1",
          team_source_type: "team_dynamics_aggregation_input_snapshot",
          team_source_id: "team-source-1",
          optional_context: { locale: "bs" },
          report_type: "team_fit_report_v1",
          report_version: "v1",
          report_status: status,
          input_snapshot: { inputType: "x" },
          report_snapshot: status === "failed" ? { hidden: true } : null,
          error_message: "TEAM_FIT_PROVIDER_VALIDATION_FAILURE",
          queued_at: "2026-05-30T12:00:00.000Z",
          started_at: status === "queued" ? null : "2026-05-30T12:10:00.000Z",
          completed_at: null,
          failed_at: status === "failed" ? "2026-05-30T12:20:00.000Z" : null,
          created_by: "user-1",
          created_at: "2026-05-30T12:00:00.000Z",
          updated_at: "2026-05-30T12:20:00.000Z",
        },
      ],
    });

    const statusResult = await loadTeamFitReportDisplayRecord(
      {
        organizationId: "org-1",
        teamId: "team-1",
        participantId: "participant-1",
        teamFitReportId: "report-1",
      },
      { supabase: statusSupabase },
    );

    assert.ok(statusResult);
    assert.equal(statusResult.status, status);
    assert.equal(statusResult.reportSnapshot, null);
    assert.match(statusResult.safeStatusMessage, messagePattern);
    assert.doesNotMatch(statusResult.safeStatusMessage, /TEAM_FIT_PROVIDER_/);
  }

  const mismatchSupabase = createSupabaseStub({
    ...buildBaseState(),
    team_fit_reports: [
      {
        id: "report-1",
        organization_id: "org-1",
        team_id: "team-1",
        participant_id: "participant-1",
        candidate_source_type: "composite_deterministic_input_snapshot",
        candidate_source_id: "candidate-source-1",
        team_source_type: "team_dynamics_aggregation_input_snapshot",
        team_source_id: "team-source-1",
        optional_context: { locale: "bs" },
        report_type: "team_fit_report_v1",
        report_version: "v1",
        report_status: "queued",
        input_snapshot: null,
        report_snapshot: null,
        error_message: null,
        queued_at: "2026-05-30T12:00:00.000Z",
        started_at: null,
        completed_at: null,
        failed_at: null,
        created_by: "user-1",
        created_at: "2026-05-30T12:00:00.000Z",
        updated_at: "2026-05-30T12:00:00.000Z",
      },
    ],
  });

  assert.equal(
    await loadTeamFitReportDisplayRecord(
      {
        organizationId: "org-2",
        teamId: "team-1",
        participantId: "participant-1",
        teamFitReportId: "report-1",
      },
      { supabase: mismatchSupabase },
    ),
    null,
  );
  assert.equal(
    await loadTeamFitReportDisplayRecord(
      {
        organizationId: "org-1",
        teamId: "team-2",
        participantId: "participant-1",
        teamFitReportId: "report-1",
      },
      { supabase: mismatchSupabase },
    ),
    null,
  );
  assert.equal(
    await loadTeamFitReportDisplayRecord(
      {
        organizationId: "org-1",
        teamId: "team-1",
        participantId: "participant-2",
        teamFitReportId: "report-1",
      },
      { supabase: mismatchSupabase },
    ),
    null,
  );
  assert.equal(
    await loadTeamFitReportDisplayRecord(
      {
        organizationId: "org-1",
        teamId: "team-1",
        participantId: "participant-1",
        teamFitReportId: "report-2",
      },
      { supabase: mismatchSupabase },
    ),
    null,
  );

  const invalidReadySupabase = createSupabaseStub({
    ...buildBaseState(),
    team_fit_reports: [
      {
        id: "report-1",
        organization_id: "org-1",
        team_id: "team-1",
        participant_id: "participant-1",
        candidate_source_type: "composite_deterministic_input_snapshot",
        candidate_source_id: "candidate-source-1",
        team_source_type: "team_dynamics_aggregation_input_snapshot",
        team_source_id: "team-source-1",
        optional_context: { locale: "bs" },
        report_type: "team_fit_report_v1",
        report_version: "v1",
        report_status: "ready",
        input_snapshot: { inputType: "x" },
        report_snapshot: { reportType: "wrong_type", reportVersion: "v1" },
        error_message: null,
        queued_at: "2026-05-30T12:00:00.000Z",
        started_at: "2026-05-30T12:10:00.000Z",
        completed_at: "2026-05-30T12:20:00.000Z",
        failed_at: null,
        created_by: "user-1",
        created_at: "2026-05-30T12:00:00.000Z",
        updated_at: "2026-05-30T12:20:00.000Z",
      },
    ],
  });

  const invalidReadyResult = await loadTeamFitReportDisplayRecord(
    {
      organizationId: "org-1",
      teamId: "team-1",
      participantId: "participant-1",
      teamFitReportId: "report-1",
    },
    { supabase: invalidReadySupabase },
  );
  assert.equal(invalidReadyResult, null);

  const refreshedTodoSource = fs.readFileSync(todoPath, "utf8");
  assert.match(refreshedTodoSource, /Completion note — Team Fit read-only display helper shell/);

  console.log("test-team-fit-report-display-helper: ok");
}

main().catch((error) => {
  console.error("test-team-fit-report-display-helper failed");
  console.error(error);
  process.exitCode = 1;
});
