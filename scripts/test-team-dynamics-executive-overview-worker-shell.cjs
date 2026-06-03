const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;
const workerPath = path.join(projectRoot, "lib", "b2b", "team-dynamics-report-worker.ts");
const workerSource = fs.readFileSync(workerPath, "utf8");
const scriptPath = path.join(
  projectRoot,
  "scripts",
  "process-team-dynamics-executive-overview-reports.cjs",
);
const scriptSource = fs.readFileSync(scriptPath, "utf8");

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
  if (request === "server-only") {
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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

assert.match(workerSource, /TEAM_DYNAMICS_REPORT_WORKER_DEFAULT_LIMIT = 3/);
assert.match(workerSource, /TEAM_DYNAMICS_REPORT_WORKER_MAX_LIMIT = 10/);
assert.doesNotMatch(workerSource, /\.from\("attempt_reports"\)\.update/i);
assert.doesNotMatch(workerSource, /\.from\("assessment_reports"\)\.update/i);
assert.doesNotMatch(workerSource, /page\.tsx|components\/dashboard|renderer|view layer/i);
assert.doesNotMatch(workerSource, /setInterval|setTimeout|cron|background loop/i);
assert.doesNotMatch(scriptSource, /setInterval|setTimeout|cron|background loop/i);

const {
  TEAM_DYNAMICS_REPORT_WORKER_DEFAULT_LIMIT,
  TEAM_DYNAMICS_REPORT_WORKER_MAX_LIMIT,
  TEAM_DYNAMICS_REPORT_TYPE,
  TEAM_DYNAMICS_REPORT_VERSION,
  loadQueuedTeamDynamicsExecutiveOverviewReports,
  normalizeTeamDynamicsReportWorkerLimit,
  processQueuedTeamDynamicsExecutiveOverviewReports,
} = require("../lib/b2b/team-dynamics-report-worker.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildRow(overrides = {}) {
  return {
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
    included_member_ids_snapshot: ["member-1"],
    input_snapshot: null,
    report_snapshot: null,
    error_message: null,
    queued_at: "2026-05-29T08:00:00.000Z",
    started_at: null,
    completed_at: null,
    created_at: "2026-05-29T08:00:00.000Z",
    updated_at: "2026-05-29T08:00:00.000Z",
    ...overrides,
  };
}

function createSelectOnlySupabase(initialRows) {
  const rows = initialRows.map((row) => clone(row));
  const calls = [];

  function matchesFilters(row, filters) {
    return filters.every(({ field, value }) => row[field] === value);
  }

  function applyOrders(list, orders) {
    return [...list].sort((left, right) => {
      for (const order of orders) {
        const leftValue = left[order.field] ?? "";
        const rightValue = right[order.field] ?? "";

        if (leftValue === rightValue) {
          continue;
        }

        const comparison = String(leftValue).localeCompare(String(rightValue));
        return order.ascending ? comparison : -comparison;
      }

      return 0;
    });
  }

  return {
    rows,
    calls,
    from(table) {
      assert.equal(table, "team_assessment_reports");

      return {
        select(fields) {
          const query = {
            fields,
            filters: [],
            orders: [],
            rangeStart: 0,
            rangeEnd: Number.MAX_SAFE_INTEGER,
            eq(field, value) {
              query.filters.push({ field, value });
              return query;
            },
            order(field, options = {}) {
              query.orders.push({ field, ascending: options.ascending !== false });
              return query;
            },
            range(start, end) {
              query.rangeStart = start;
              query.rangeEnd = end;
              return query;
            },
            async execute() {
              calls.push({
                fields: query.fields,
                filters: [...query.filters],
                orders: [...query.orders],
                range: [query.rangeStart, query.rangeEnd],
              });

              const filtered = rows.filter((row) => matchesFilters(row, query.filters));
              const ordered = applyOrders(filtered, query.orders);
              const sliced = ordered.slice(query.rangeStart, query.rangeEnd + 1);

              return {
                data: clone(sliced),
                error: null,
              };
            },
            then(resolve, reject) {
              return query.execute().then(resolve, reject);
            },
          };

          return query;
        },
        update() {
          throw new Error("Worker shell must not write to team_assessment_reports directly.");
        },
      };
    },
  };
}

async function run() {
  assert.equal(TEAM_DYNAMICS_REPORT_WORKER_DEFAULT_LIMIT, 3);
  assert.equal(TEAM_DYNAMICS_REPORT_WORKER_MAX_LIMIT, 10);
  assert.equal(normalizeTeamDynamicsReportWorkerLimit(undefined), 3);
  assert.equal(normalizeTeamDynamicsReportWorkerLimit(0), 3);
  assert.equal(normalizeTeamDynamicsReportWorkerLimit(2), 2);
  assert.equal(normalizeTeamDynamicsReportWorkerLimit(11), 10);
  assert.equal(normalizeTeamDynamicsReportWorkerLimit(99), 10);

  const rows = [
    buildRow({ id: "queued-1", queued_at: "2026-05-29T08:00:00.000Z" }),
    buildRow({ id: "queued-2", queued_at: "2026-05-29T08:01:00.000Z" }),
    buildRow({ id: "ready-1", report_status: "ready" }),
    buildRow({ id: "failed-1", report_status: "failed" }),
    buildRow({ id: "processing-1", report_status: "processing" }),
    buildRow({ id: "other-type", report_type: "other_report" }),
    buildRow({ id: "other-version", report_version: "other_version" }),
  ];

  const dryRunSupabase = createSelectOnlySupabase(rows);
  let dryRunProcessorCallCount = 0;
  const dryRunResult = await processQueuedTeamDynamicsExecutiveOverviewReports(
    {
      dryRun: true,
    },
    {
      createSupabaseClient: () => dryRunSupabase,
      processReport: async () => {
        dryRunProcessorCallCount += 1;
        throw new Error("dry-run should not invoke processor");
      },
    },
  );

  assert.equal(dryRunResult.dryRun, true);
  assert.equal(dryRunResult.appliedLimit, TEAM_DYNAMICS_REPORT_WORKER_DEFAULT_LIMIT);
  assert.equal(dryRunResult.eligibleCount, 2);
  assert.equal(dryRunResult.wouldProcessCount, 2);
  assert.equal(dryRunProcessorCallCount, 0);
  assert.equal(dryRunSupabase.calls.length, 1);
  assert.deepEqual(
    dryRunSupabase.calls[0].filters,
    [
      { field: "report_status", value: "queued" },
      { field: "report_type", value: TEAM_DYNAMICS_REPORT_TYPE },
      { field: "report_version", value: TEAM_DYNAMICS_REPORT_VERSION },
    ],
  );
  assert.deepEqual(dryRunSupabase.calls[0].range, [0, 2]);
  assert.deepEqual(
    dryRunResult.eligibleReports.map((report) => report.id),
    ["queued-1", "queued-2"],
  );

  const cappedRows = Array.from({ length: 12 }, (_, index) =>
    buildRow({
      id: `queued-cap-${index + 1}`,
      queued_at: `2026-05-29T08:${String(index).padStart(2, "0")}:00.000Z`,
    }),
  );
  const cappedSupabase = createSelectOnlySupabase(cappedRows);
  const cappedResult = await loadQueuedTeamDynamicsExecutiveOverviewReports(
    { limit: 99 },
    { createSupabaseClient: () => cappedSupabase },
  );
  assert.equal(cappedSupabase.calls[0].range[1], 9);
  assert.equal(cappedResult.length, 10);

  const runSupabase = createSelectOnlySupabase(rows);
  const processorCalls = [];
  const runResult = await processQueuedTeamDynamicsExecutiveOverviewReports(
    { limit: 5 },
    {
      createSupabaseClient: () => runSupabase,
      processReport: async (input) => {
        processorCalls.push(clone(input));

        if (input.teamAssessmentReportId === "queued-1") {
          return {
            ok: true,
            operation: "completed_ready",
            claim: { ok: true, operation: "claimed", report: {}, snapshot: {} },
            provider: {
              ok: true,
              code: "success",
              snapshot: {},
              provider: "openai",
              providerVersion: "v1",
              modelName: "gpt-test",
              generatedAt: "2026-05-29T08:10:00.000Z",
              rawContent: "{}",
            },
            report: {},
            snapshot: {},
            finalStatus: "ready",
          };
        }

        if (input.teamAssessmentReportId === "queued-2") {
          return {
            ok: false,
            operation: "provider_failed",
            claim: { ok: true, operation: "claimed", report: {}, snapshot: {} },
            provider: {
              ok: false,
              code: "provider_error",
              reason: "provider exploded",
              provider: "openai",
              providerVersion: "v1",
              modelName: "gpt-test",
              generatedAt: "2026-05-29T08:11:00.000Z",
            },
            final: {
              ok: true,
              operation: "marked_failed",
              report: {},
              failure: { errorMessage: "provider exploded" },
            },
            marker: "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_ERROR",
            reason: "provider exploded",
          };
        }

        return {
          ok: false,
          operation: "claim_not_acquired",
          claim: {
            ok: false,
            operation: "already_ready",
            reason: "Already ready",
          },
          marker: "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_INPUT_SNAPSHOT_MISSING",
          reason: "Already ready",
        };
      },
    },
  );

  assert.equal(runResult.dryRun, false);
  assert.equal(runResult.appliedLimit, 5);
  assert.equal(runResult.eligibleCount, 2);
  assert.equal(runResult.processedCount, 2);
  assert.deepEqual(processorCalls, [
    {
      teamAssessmentReportId: "queued-1",
      organizationId: "org-1",
    },
    {
      teamAssessmentReportId: "queued-2",
      organizationId: "org-1",
    },
  ]);
  assert.deepEqual(runResult.summary, {
    processed: 2,
    ready: 1,
    failed: 1,
    skipped: 0,
    claimNotAcquired: 0,
    errors: 0,
  });

  const claimResult = await processQueuedTeamDynamicsExecutiveOverviewReports(
    { limit: 1 },
    {
      createSupabaseClient: () =>
        createSelectOnlySupabase([
          buildRow({ id: "claim-row", queued_at: "2026-05-29T09:00:00.000Z" }),
        ]),
      processReport: async () => ({
        ok: false,
        operation: "claim_not_acquired",
        claim: {
          ok: false,
          operation: "already_processing",
          reason: "Already processing",
        },
        marker: "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_INPUT_SNAPSHOT_MISSING",
        reason: "Already processing",
      }),
    },
  );
  assert.deepEqual(claimResult.summary, {
    processed: 1,
    ready: 0,
    failed: 0,
    skipped: 1,
    claimNotAcquired: 1,
    errors: 0,
  });
  assert.equal(claimResult.results[0].outcome, "claim_not_acquired");

  const errorResult = await processQueuedTeamDynamicsExecutiveOverviewReports(
    { limit: 1 },
    {
      createSupabaseClient: () =>
        createSelectOnlySupabase([
          buildRow({ id: "error-row", queued_at: "2026-05-29T10:00:00.000Z" }),
        ]),
      processReport: async () => {
        throw new Error("processor crash");
      },
    },
  );
  assert.deepEqual(errorResult.summary, {
    processed: 1,
    ready: 0,
    failed: 0,
    skipped: 0,
    claimNotAcquired: 0,
    errors: 1,
  });
  assert.equal(errorResult.results[0].outcome, "error");

  console.log("Team Dynamics Executive Overview worker shell tests passed.");
}

run().catch((error) => {
  console.error("Team Dynamics Executive Overview worker shell tests failed", error);
  process.exitCode = 1;
});
