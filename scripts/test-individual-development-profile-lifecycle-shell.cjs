const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "individual-development-profile-lifecycle.ts",
);
const helperSource = fs.readFileSync(helperPath, "utf8");
const migrationPath = path.join(
  projectRoot,
  "supabase",
  "migrations",
  "20260602143000_expand_assessment_reports_for_individual_development_profile.sql",
);
const migrationSource = fs.readFileSync(migrationPath, "utf8");
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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

assert.match(helperSource, /INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE/);
assert.match(helperSource, /\.from\("assessment_reports"\)/);
assert.match(helperSource, /\.from\("assessment_assignments"\)/);
assert.doesNotMatch(helperSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("team_assessment_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("team_fit_reports"\)/);
assert.doesNotMatch(helperSource, /OpenAI|openai|provider|renderer|route|worker|scheduler/i);
assert.doesNotMatch(helperSource, /team-fit|team_dynamics/i);

assert.match(migrationSource, /assessment_reports_report_type_check/i);
assert.match(migrationSource, /report_type in \('composite', 'individual_development_profile'\)/i);
assert.doesNotMatch(migrationSource, /attempt_reports/i);
assert.doesNotMatch(migrationSource, /team_assessment_reports/i);
assert.doesNotMatch(migrationSource, /team_fit_reports/i);

const {
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE,
  buildQueuedIndividualDevelopmentProfileAssessmentReportInsert,
  buildRetryFailedIndividualDevelopmentProfileAssessmentReportPatch,
  loadIndividualDevelopmentProfileAssessmentReport,
  queueIndividualDevelopmentProfileAssessmentReport,
  resetFailedIndividualDevelopmentProfileAssessmentReportToQueued,
} = require(helperPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildAssignment(overrides = {}) {
  return {
    id: "assignment-1",
    organization_id: "org-1",
    participant_id: "participant-1",
    assignment_type: "standard_battery",
    status: "completed",
    ...overrides,
  };
}

function buildReportRow(overrides = {}) {
  return {
    id: "assessment-report-1",
    assessment_assignment_id: "assignment-1",
    organization_id: "org-1",
    participant_id: "participant-1",
    report_type: INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE,
    audience: INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE,
    source_type: INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE,
    report_status: "queued",
    generator_type: null,
    contract_version: null,
    prompt_version_id: null,
    model_name: null,
    generator_version: null,
    input_snapshot: null,
    report_snapshot: null,
    failure_code: null,
    failure_reason: null,
    queued_at: "2026-06-02T12:00:00.000Z",
    started_at: null,
    completed_at: null,
    generated_at: null,
    created_at: "2026-06-02T12:00:00.000Z",
    updated_at: "2026-06-02T12:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

function createSupabaseStub(initialState = {}) {
  const state = {
    assessment_assignments: [...(initialState.assessment_assignments ?? [])],
    assessment_reports: [...(initialState.assessment_reports ?? [])],
    attempt_reports: [...(initialState.attempt_reports ?? [])],
    team_assessment_reports: [...(initialState.team_assessment_reports ?? [])],
    team_fit_reports: [...(initialState.team_fit_reports ?? [])],
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

  function applyOrders(rows, orders) {
    return [...rows].sort((left, right) => {
      for (const order of orders) {
        const leftValue = left[order.column];
        const rightValue = right[order.column];

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
    state,
    operations,
    from(table) {
      const query = {
        filters: [],
        orders: [],
        limitCount: null,
      };

      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          query.filters.push({ type: "eq", column, value });
          return builder;
        },
        order(column, options = {}) {
          query.orders.push({ column, ascending: options.ascending !== false });
          return builder;
        },
        limit(value) {
          query.limitCount = value;
          return builder;
        },
        async maybeSingle() {
          const rows = applyFilters(state[table] ?? [], query.filters);
          const ordered = applyOrders(rows, query.orders);
          const limited =
            typeof query.limitCount === "number" ? ordered.slice(0, query.limitCount) : ordered;
          return { data: clone(limited[0] ?? null), error: null };
        },
        async single() {
          const rows = applyFilters(state[table] ?? [], query.filters);
          const ordered = applyOrders(rows, query.orders);
          const limited =
            typeof query.limitCount === "number" ? ordered.slice(0, query.limitCount) : ordered;
          return { data: clone(limited[0] ?? null), error: null };
        },
        then(resolve, reject) {
          try {
            const rows = applyFilters(state[table] ?? [], query.filters);
            const ordered = applyOrders(rows, query.orders);
            const limited =
              typeof query.limitCount === "number" ? ordered.slice(0, query.limitCount) : ordered;
            return Promise.resolve({ data: clone(limited), error: null }).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        },
      };

      return {
        select() {
          return builder.select();
        },
        insert(payload) {
          const rows = Array.isArray(payload) ? payload : [payload];
          operations.push({ type: "insert", table, payload: clone(rows) });

          for (const row of rows) {
            state[table].push({
              id: row.id ?? `generated-${state[table].length + 1}`,
              created_at: row.created_at ?? "2026-06-02T12:00:00.000Z",
              updated_at: row.updated_at ?? "2026-06-02T12:00:00.000Z",
              ...clone(row),
            });
          }

          return {
            select() {
              return {
                async single() {
                  return { data: clone(state[table][state[table].length - 1]), error: null };
                },
              };
            },
          };
        },
        update(payload) {
          const updateQuery = {
            filters: [],
            eq(column, value) {
              updateQuery.filters.push({ column, value });
              return updateQuery;
            },
            select() {
              return {
                async single() {
                  const rows = applyFilters(state[table] ?? [], updateQuery.filters.map((filter) => ({
                    type: "eq",
                    column: filter.column,
                    value: filter.value,
                  })));

                  if (rows.length === 0) {
                    return { data: null, error: null };
                  }

                  rows.forEach((row) => {
                    Object.assign(row, clone(payload), {
                      updated_at: "2026-06-02T12:05:00.000Z",
                    });
                  });

                  operations.push({
                    type: "update",
                    table,
                    payload: clone(payload),
                    filters: clone(updateQuery.filters),
                  });

                  return { data: clone(rows[0]), error: null };
                },
              };
            },
          };

          return updateQuery;
        },
      };
    },
  };
}

async function main() {
  const queuedInsert = buildQueuedIndividualDevelopmentProfileAssessmentReportInsert({
    assessmentAssignmentId: "assignment-1",
    organizationId: "org-1",
    participantId: "participant-1",
    requestedByUserId: "user-1",
    queuedAt: "2026-06-02T12:10:00.000Z",
  });
  assert.equal(
    queuedInsert.report_type,
    INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE,
  );
  assert.equal(queuedInsert.audience, "hr");
  assert.equal(queuedInsert.source_type, "assessment");
  assert.equal(queuedInsert.report_status, "queued");
  assert.equal(queuedInsert.input_snapshot, null);
  assert.equal(queuedInsert.report_snapshot, null);
  assert.equal(queuedInsert.metadata.requested_by_user_id, "user-1");

  const retryPatch = buildRetryFailedIndividualDevelopmentProfileAssessmentReportPatch({
    existingReport: buildReportRow({
      report_status: "failed",
      input_snapshot: { old: true },
      report_snapshot: { old: true },
      failure_code: "failed",
      failure_reason: "Failed",
      metadata: { previous: true },
    }),
    requestedByUserId: "user-2",
    queuedAt: "2026-06-02T12:20:00.000Z",
  });
  assert.equal(retryPatch?.report_status, "queued");
  assert.equal(retryPatch?.input_snapshot, null);
  assert.equal(retryPatch?.report_snapshot, null);
  assert.equal(retryPatch?.failure_code, null);
  assert.equal(retryPatch?.failure_reason, null);
  assert.equal(retryPatch?.metadata.previous, true);
  assert.equal(retryPatch?.metadata.last_queued_by_user_id, "user-2");

  const readMissing = await loadIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [],
      }),
    },
  );
  assert.deepEqual(readMissing, {
    ok: true,
    status: "missing",
  });

  const queuedRead = await loadIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [buildReportRow({ report_status: "queued" })],
      }),
    },
  );
  assert.equal(queuedRead.ok, true);
  assert.equal(queuedRead.status, "queued");

  const processingRead = await loadIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [buildReportRow({ report_status: "processing" })],
      }),
    },
  );
  assert.equal(processingRead.ok, true);
  assert.equal(processingRead.status, "processing");

  const readyRead = await loadIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [
          buildReportRow({
            report_status: "ready",
            report_snapshot: {
              reportType: "individual_development_profile_v1",
            },
          }),
        ],
      }),
    },
  );
  assert.equal(readyRead.ok, true);
  assert.equal(readyRead.status, "ready");

  const failedRead = await loadIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [
          buildReportRow({
            report_status: "failed",
            failure_code: "provider_failed",
            failure_reason: "No report",
          }),
        ],
      }),
    },
  );
  assert.equal(failedRead.ok, true);
  assert.equal(failedRead.status, "failed");

  const wrongOrgRead = await loadIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-2",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [buildReportRow()],
      }),
    },
  );
  assert.deepEqual(wrongOrgRead, {
    ok: true,
    status: "missing",
  });

  const queueSupabase = createSupabaseStub({
    assessment_assignments: [buildAssignment()],
    assessment_reports: [],
    attempt_reports: [{ id: "attempt-report-1", report_status: "queued" }],
    team_assessment_reports: [{ id: "team-assessment-report-1", report_status: "queued" }],
    team_fit_reports: [{ id: "team-fit-report-1", report_status: "queued" }],
  });
  const queueResult = await queueIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-1",
      participantId: "participant-1",
      requestedByUserId: "user-1",
    },
    {
      supabase: queueSupabase,
      now: () => "2026-06-02T12:30:00.000Z",
    },
  );
  assert.equal(queueResult.ok, true);
  assert.equal(queueResult.action, "queued");
  assert.equal(queueSupabase.state.assessment_reports.length, 1);
  assert.equal(queueSupabase.state.assessment_reports[0].report_status, "queued");
  assert.equal(queueSupabase.state.assessment_reports[0].report_snapshot, null);
  assert.equal(queueSupabase.state.assessment_reports[0].input_snapshot, null);
  assert.equal(queueSupabase.state.attempt_reports.length, 1);
  assert.equal(queueSupabase.state.team_assessment_reports.length, 1);
  assert.equal(queueSupabase.state.team_fit_reports.length, 1);
  assert.equal(
    queueSupabase.operations.some((entry) => entry.type === "insert" && entry.table === "assessment_reports"),
    true,
  );
  assert.equal(
    queueSupabase.operations.some((entry) => entry.table === "attempt_reports"),
    false,
  );
  assert.equal(
    queueSupabase.operations.some((entry) => entry.table === "team_assessment_reports"),
    false,
  );
  assert.equal(
    queueSupabase.operations.some((entry) => entry.table === "team_fit_reports"),
    false,
  );

  const duplicateQueueResult = await queueIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-1",
      participantId: "participant-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_assignments: [buildAssignment()],
        assessment_reports: [buildReportRow({ report_status: "queued" })],
      }),
    },
  );
  assert.equal(duplicateQueueResult.ok, true);
  assert.equal(duplicateQueueResult.action, "noop_queued");

  const readyQueueResult = await queueIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-1",
      participantId: "participant-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_assignments: [buildAssignment()],
        assessment_reports: [buildReportRow({ report_status: "ready" })],
      }),
    },
  );
  assert.equal(readyQueueResult.ok, true);
  assert.equal(readyQueueResult.action, "noop_ready");

  const failedQueueResult = await queueIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-1",
      participantId: "participant-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_assignments: [buildAssignment()],
        assessment_reports: [buildReportRow({ report_status: "failed" })],
      }),
    },
  );
  assert.equal(failedQueueResult.ok, true);
  assert.equal(failedQueueResult.action, "noop_failed");

  const wrongBoundaryQueueResult = await queueIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-2",
      participantId: "participant-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_assignments: [buildAssignment()],
      }),
    },
  );
  assert.equal(wrongBoundaryQueueResult.ok, false);
  assert.equal(wrongBoundaryQueueResult.reason, "assignment_not_found");

  const resetSupabase = createSupabaseStub({
    assessment_reports: [
      buildReportRow({
        report_status: "failed",
        input_snapshot: { old: true },
        report_snapshot: { old: true },
        failure_code: "provider_failed",
        failure_reason: "No report",
        metadata: { previous: true },
      }),
    ],
  });
  const resetResult = await resetFailedIndividualDevelopmentProfileAssessmentReportToQueued(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-1",
      participantId: "participant-1",
      requestedByUserId: "user-3",
    },
    {
      supabase: resetSupabase,
      now: () => "2026-06-02T12:40:00.000Z",
    },
  );
  assert.equal(resetResult.ok, true);
  assert.equal(resetResult.action, "reset_to_queued");
  assert.equal(resetSupabase.state.assessment_reports[0].report_status, "queued");
  assert.equal(resetSupabase.state.assessment_reports[0].failure_code, null);
  assert.equal(resetSupabase.state.assessment_reports[0].failure_reason, null);
  assert.equal(resetSupabase.state.assessment_reports[0].report_snapshot, null);
  assert.equal(resetSupabase.state.assessment_reports[0].input_snapshot, null);

  const noopReset = await resetFailedIndividualDevelopmentProfileAssessmentReportToQueued(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-1",
      participantId: "participant-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [buildReportRow({ report_status: "ready" })],
      }),
    },
  );
  assert.equal(noopReset.ok, true);
  assert.equal(noopReset.action, "noop_not_failed");

  console.log("test-individual-development-profile-lifecycle-shell: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
