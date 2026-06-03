const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const processorPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "individual-development-profile-processor.ts",
);
const processorSource = fs.readFileSync(processorPath, "utf8");
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

assert.match(processorSource, /processIndividualDevelopmentProfileAssessmentReport/);
assert.match(processorSource, /claimIndividualDevelopmentProfileAssessmentReportForProcessing/);
assert.match(processorSource, /buildIndividualDevelopmentProfileInputSnapshot/);
assert.match(processorSource, /generateIndividualDevelopmentProfileReport/);
assert.match(processorSource, /validateIndividualDevelopmentProfileSnapshot/);
assert.doesNotMatch(processorSource, /OpenAI|openai|external/i);
assert.doesNotMatch(processorSource, /process\.env|renderer|route|action|worker|scheduler/i);
assert.doesNotMatch(processorSource, /team-fit|team_dynamics/i);
assert.doesNotMatch(processorSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(processorSource, /\.from\("team_assessment_reports"\)/);
assert.doesNotMatch(processorSource, /\.from\("team_fit_reports"\)/);

const {
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
} = require("../lib/assessment/individual-development-profile-input.ts");
const {
  validateIndividualDevelopmentProfileSnapshot,
} = require("../lib/assessment/individual-development-profile-contract.ts");
const {
  processIndividualDevelopmentProfileAssessmentReport,
} = require(processorPath);

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
    report_type: "individual_development_profile",
    audience: "hr",
    source_type: "assessment",
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

function buildInputSnapshot() {
  return {
    inputType: INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE,
    inputVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
    locale: "bs",
    participant: {
      participantId: "participant-1",
      displayName: "Amina Candidate",
    },
    sourceSignals: {
      personality: {
        sourceStatus: "available",
        summary: "Ličnosni signal je dostupan.",
        relevantSignals: [
          {
            code: "EXTRAVERSION",
            label: "Ekstraverzija",
            signal: "Povišen signal u domeni ekstraverzije vrijedi čitati kao razvojnu hipotezu za saradnju i ritam rada.",
          },
        ],
      },
      motivation: {
        sourceStatus: "available",
        summary: "Motivacijski signal je dostupan.",
        relevantSignals: [
          {
            code: "intrinsic",
            label: "Intrinzična motivacija",
            signal: "Ovaj signal može pomagati angažmanu kada rad ima smisao i vidljiv napredak.",
          },
        ],
      },
      problemSolving: {
        sourceStatus: "available",
        summary: "Problem-solving signal je dostupan.",
        relevantSignals: [
          {
            code: "verbal",
            label: "Verbalno rezonovanje",
            signal: "U ovom setu zadataka signal u domeni verbalnog rezonovanja djeluje stabilno i korisno za dalju provjeru.",
          },
        ],
      },
      composite: {
        sourceStatus: "available",
        summary: "Reduced deterministic composite sažetak je dostupan.",
        integratedSignals: [
          {
            code: "integrated",
            label: "Integrisani signal",
            signal: "Reduced deterministic composite ukazuje da se jasniji razvojni obrazac vidi kada su očekivanja pregledna i podrška operativna.",
          },
        ],
      },
    },
    interpretationLimits: [
      "Input snapshot sadrži reduced HR-safe deterministic signale, ne raw answers i ne full upstream snapshotove.",
    ],
    sourceMetadata: {
      assessmentAssignmentId: "assignment-1",
      sourceVersions: [],
    },
  };
}

function createSupabaseStub(initialState = {}) {
  const state = {
    assessment_reports: [...(initialState.assessment_reports ?? [])],
    assessment_assignments: [...(initialState.assessment_assignments ?? [])],
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

      const selectBuilder = {
        select() {
          return selectBuilder;
        },
        eq(column, value) {
          query.filters.push({ type: "eq", column, value });
          return selectBuilder;
        },
        order(column, options = {}) {
          query.orders.push({ column, ascending: options.ascending !== false });
          return selectBuilder;
        },
        limit(value) {
          query.limitCount = value;
          return selectBuilder;
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
          return selectBuilder.select();
        },
        update(payload) {
          const updateQuery = {
            filters: [],
            eq(column, value) {
              updateQuery.filters.push({ type: "eq", column, value });
              return updateQuery;
            },
            select() {
              return {
                async maybeSingle() {
                  const rows = applyFilters(state[table] ?? [], updateQuery.filters);

                  if (rows.length === 0) {
                    operations.push({
                      type: "update",
                      table,
                      payload: clone(payload),
                      filters: clone(updateQuery.filters),
                    });
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
                async single() {
                  return this.maybeSingle();
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
  const happySupabase = createSupabaseStub({
    assessment_reports: [buildReportRow()],
    assessment_assignments: [buildAssignment()],
    attempt_reports: [{ id: "attempt-report-1", report_status: "queued" }],
    team_assessment_reports: [{ id: "team-assessment-report-1", report_status: "queued" }],
    team_fit_reports: [{ id: "team-fit-report-1", report_status: "queued" }],
  });
  const happyResult = await processIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentReportId: "assessment-report-1",
      organizationId: "org-1",
    },
    {
      supabase: happySupabase,
      now: () => "2026-06-02T12:10:00.000Z",
      buildInputSnapshot: async () => ({
        ok: true,
        inputSnapshot: buildInputSnapshot(),
      }),
    },
  );

  assert.deepEqual(happyResult, {
    ok: true,
    reportId: "assessment-report-1",
    status: "ready",
  });
  assert.equal(happySupabase.state.assessment_reports[0].report_status, "ready");
  assert.equal(
    happySupabase.state.assessment_reports[0].input_snapshot.inputType,
    "individual_development_profile_input_v1",
  );
  assert.equal(
    validateIndividualDevelopmentProfileSnapshot(
      happySupabase.state.assessment_reports[0].report_snapshot,
    ).ok,
    true,
  );
  assert.equal(happySupabase.state.assessment_reports[0].generator_type, "mock");
  assert.equal(happySupabase.state.attempt_reports.length, 1);
  assert.equal(happySupabase.state.team_assessment_reports.length, 1);
  assert.equal(happySupabase.state.team_fit_reports.length, 1);
  assert.equal(
    happySupabase.operations.some((entry) => entry.table === "attempt_reports"),
    false,
  );
  assert.equal(
    happySupabase.operations.some((entry) => entry.table === "team_assessment_reports"),
    false,
  );
  assert.equal(
    happySupabase.operations.some((entry) => entry.table === "team_fit_reports"),
    false,
  );

  const readySupabase = createSupabaseStub({
    assessment_reports: [buildReportRow({ report_status: "ready" })],
  });
  const readyResult = await processIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentReportId: "assessment-report-1",
      organizationId: "org-1",
    },
    {
      supabase: readySupabase,
    },
  );
  assert.equal(readyResult.ok, false);
  assert.equal(readyResult.reason, "already_ready");

  const failedSupabase = createSupabaseStub({
    assessment_reports: [buildReportRow({ report_status: "failed" })],
  });
  const failedResult = await processIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentReportId: "assessment-report-1",
      organizationId: "org-1",
    },
    {
      supabase: failedSupabase,
    },
  );
  assert.equal(failedResult.ok, false);
  assert.equal(failedResult.reason, "failed_not_processable");

  const inputFailureSupabase = createSupabaseStub({
    assessment_reports: [buildReportRow()],
    assessment_assignments: [buildAssignment()],
  });
  const inputFailureResult = await processIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentReportId: "assessment-report-1",
      organizationId: "org-1",
    },
    {
      supabase: inputFailureSupabase,
      buildInputSnapshot: async () => ({
        ok: false,
        reason: "assignment_not_found",
        details: "Input builder could not resolve assignment.",
      }),
    },
  );
  assert.equal(inputFailureResult.ok, false);
  assert.equal(inputFailureResult.reason, "input_snapshot_failed");
  assert.equal(inputFailureSupabase.state.assessment_reports[0].report_status, "failed");
  assert.equal(inputFailureSupabase.state.assessment_reports[0].report_snapshot, null);
  assert.equal(
    inputFailureSupabase.state.assessment_reports[0].failure_code,
    "IDP_INPUT_SNAPSHOT_FAILED",
  );

  const providerFailureSupabase = createSupabaseStub({
    assessment_reports: [buildReportRow()],
    assessment_assignments: [buildAssignment()],
  });
  const providerFailureResult = await processIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentReportId: "assessment-report-1",
      organizationId: "org-1",
    },
    {
      supabase: providerFailureSupabase,
      buildInputSnapshot: async () => ({
        ok: true,
        inputSnapshot: buildInputSnapshot(),
      }),
      generateReport: async () => ({
        ok: false,
        provider: "mock",
        reason: "validation_failed",
        errors: ["Mock provider validation failed."],
      }),
    },
  );
  assert.equal(providerFailureResult.ok, false);
  assert.equal(providerFailureResult.reason, "provider_failed");
  assert.equal(providerFailureSupabase.state.assessment_reports[0].report_status, "failed");
  assert.equal(
    providerFailureSupabase.state.assessment_reports[0].failure_code,
    "IDP_PROVIDER_FAILED",
  );

  const invalidSnapshotSupabase = createSupabaseStub({
    assessment_reports: [buildReportRow()],
    assessment_assignments: [buildAssignment()],
  });
  const invalidSnapshotResult = await processIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentReportId: "assessment-report-1",
      organizationId: "org-1",
    },
    {
      supabase: invalidSnapshotSupabase,
      buildInputSnapshot: async () => ({
        ok: true,
        inputSnapshot: buildInputSnapshot(),
      }),
      generateReport: async () => ({
        ok: true,
        provider: "mock",
        reportSnapshot: {
          reportType: "team_fit_report_v1",
        },
      }),
    },
  );
  assert.equal(invalidSnapshotResult.ok, false);
  assert.equal(invalidSnapshotResult.reason, "validation_failed");
  assert.equal(invalidSnapshotSupabase.state.assessment_reports[0].report_status, "failed");
  assert.equal(
    invalidSnapshotSupabase.state.assessment_reports[0].failure_code,
    "IDP_REPORT_VALIDATION_FAILED",
  );

  const wrongOrgResult = await processIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentReportId: "assessment-report-1",
      organizationId: "org-2",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [buildReportRow()],
      }),
    },
  );
  assert.equal(wrongOrgResult.ok, false);
  assert.equal(wrongOrgResult.reason, "report_not_found");

  const wrongTypeResult = await processIndividualDevelopmentProfileAssessmentReport(
    {
      assessmentReportId: "assessment-report-1",
      organizationId: "org-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [buildReportRow({ report_type: "composite" })],
      }),
    },
  );
  assert.equal(wrongTypeResult.ok, false);
  assert.equal(wrongTypeResult.reason, "report_not_found");

  console.log("test-individual-development-profile-processor-shell: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
