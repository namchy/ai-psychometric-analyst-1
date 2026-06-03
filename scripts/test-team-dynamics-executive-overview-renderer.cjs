const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-dynamics-executive-overview-display.ts",
);
const routePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "teams",
  "[teamId]",
  "reports",
  "[teamAssessmentReportId]",
  "page.tsx",
);
const viewPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "team-dynamics-executive-overview-report-view.tsx",
);
const queueListPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "team-dynamics-report-queue-list.tsx",
);
const contractPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-dynamics-executive-overview-contract.ts",
);
const helperSource = fs.readFileSync(helperPath, "utf8");
const routeSource = fs.readFileSync(routePath, "utf8");
const viewSource = fs.readFileSync(viewPath, "utf8");
const queueListSource = fs.readFileSync(queueListPath, "utf8");
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
  if (
    request === "server-only" ||
    request === "@/lib/supabase/admin" ||
    request === "@/lib/auth/session" ||
    request === "@/lib/b2b/organizations" ||
    request === "@/components/app/authenticated-app-chrome"
  ) {
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

require.extensions[".tsx"] = function compileTsx(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

assert.match(helperSource, /export async function loadTeamDynamicsExecutiveOverviewReportForDisplay/);
assert.match(routeSource, /loadTeamDynamicsExecutiveOverviewReportForDisplay/);
assert.match(routeSource, /queued/);
assert.match(routeSource, /processing/);
assert.match(routeSource, /failed/);
assert.match(routeSource, /Izvještaj trenutno nije dostupan/);
assert.match(viewSource, /TeamDynamicsExecutiveOverviewReportView/);
assert.match(queueListSource, /Otvori izvještaj/);
assert.doesNotMatch(helperSource, /\.update\(/);
assert.doesNotMatch(helperSource, /\.insert\(/);
assert.doesNotMatch(helperSource, /generateTeamDynamicsExecutiveOverviewMockSnapshot/);
assert.doesNotMatch(helperSource, /processTeamDynamicsExecutiveOverviewMock/);
assert.doesNotMatch(routeSource, /generateTeamDynamicsExecutiveOverviewMockSnapshot/);
assert.doesNotMatch(routeSource, /processTeamDynamicsExecutiveOverviewMock/);
assert.doesNotMatch(routeSource, /\.update\(|\.insert\(/);
assert.doesNotMatch(viewSource, /individualAnswers|rawResponses|individualScores|memberScores|teamFitOutput|unifiedOverallTeamScore/);
assert.doesNotMatch(helperSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("assessment_reports"\)/);

const {
  loadTeamDynamicsExecutiveOverviewReportForDisplay,
} = require(helperPath);
const {
  buildMockTeamDynamicsExecutiveOverviewSnapshot,
  validateTeamDynamicsExecutiveOverviewSnapshot,
} = require(contractPath);
const {
  TeamDynamicsExecutiveOverviewReportView,
} = require(viewPath);

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
        select() {
          return query;
        },
        eq(column, value) {
          query.filters.push({ type: "eq", column, value });
          return query;
        },
        async maybeSingle() {
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

function buildReportRow(overrides = {}) {
  return {
    id: "report-1",
    organization_id: "org-1",
    team_id: "team-1",
    team_assessment_assignment_id: "assignment-1",
    report_type: "team_dynamics_report_v1",
    report_version: "team_dynamics_executive_overview_v1",
    report_status: "ready",
    generator_type: null,
    model_name: null,
    included_member_ids_snapshot: ["tap-2", "tap-1"],
    report_snapshot: buildMockTeamDynamicsExecutiveOverviewSnapshot(),
    error_message: null,
    queued_at: "2026-05-29T08:00:00.000Z",
    started_at: "2026-05-29T09:00:00.000Z",
    completed_at: "2026-05-29T09:15:00.000Z",
    created_at: "2026-05-29T08:00:00.000Z",
    updated_at: "2026-05-29T09:15:00.000Z",
    ...overrides,
  };
}

async function main() {
  const readySupabase = createSupabaseStub({
    team_assessment_reports: [buildReportRow()],
    attempt_reports: [{ id: "attempt-1" }],
    assessment_reports: [{ id: "assessment-1" }],
  });
  const readyResult = await loadTeamDynamicsExecutiveOverviewReportForDisplay(
    {
      organizationId: "org-1",
      teamId: "team-1",
      teamAssessmentReportId: "report-1",
    },
    {
      supabase: readySupabase,
    },
  );

  assert.equal(readyResult.status, "ready");
  assert.equal(
    validateTeamDynamicsExecutiveOverviewSnapshot(readyResult.snapshot).ok,
    true,
  );
  assert.equal(
    readySupabase.operations.some((entry) => entry.table === "attempt_reports"),
    false,
  );
  assert.equal(
    readySupabase.operations.some((entry) => entry.table === "assessment_reports"),
    false,
  );

  const invalidSupabase = createSupabaseStub({
    team_assessment_reports: [
      buildReportRow({
        report_snapshot: {
          reportType: "wrong_type",
          reportVersion: "v1",
        },
      }),
    ],
  });
  const invalidResult = await loadTeamDynamicsExecutiveOverviewReportForDisplay(
    {
      organizationId: "org-1",
      teamId: "team-1",
      teamAssessmentReportId: "report-1",
    },
    {
      supabase: invalidSupabase,
    },
  );
  assert.equal(invalidResult.status, "invalid_snapshot");

  for (const status of ["queued", "processing", "failed"]) {
    const statusSupabase = createSupabaseStub({
      team_assessment_reports: [buildReportRow({ report_status: status, report_snapshot: null })],
    });
    const statusResult = await loadTeamDynamicsExecutiveOverviewReportForDisplay(
      {
        organizationId: "org-1",
        teamId: "team-1",
        teamAssessmentReportId: "report-1",
      },
      {
        supabase: statusSupabase,
      },
    );

    assert.equal(statusResult.status, status);
    assert.match(statusResult.message, /Izvještaj/);
  }

  const mismatchSupabase = createSupabaseStub({
    team_assessment_reports: [buildReportRow()],
  });
  const mismatchResult = await loadTeamDynamicsExecutiveOverviewReportForDisplay(
    {
      organizationId: "org-1",
      teamId: "team-2",
      teamAssessmentReportId: "report-1",
    },
    {
      supabase: mismatchSupabase,
    },
  );
  assert.equal(mismatchResult, null);

  const snapshot = buildMockTeamDynamicsExecutiveOverviewSnapshot();
  const rendered = ReactDOMServer.renderToStaticMarkup(
    React.createElement(TeamDynamicsExecutiveOverviewReportView, {
      report: {
        id: "report-1",
        organizationId: "org-1",
        teamId: "team-1",
        teamAssessmentAssignmentId: "assignment-1",
        reportType: "team_dynamics_report_v1",
        reportVersion: "team_dynamics_executive_overview_v1",
        reportStatus: "ready",
        generatorType: null,
        modelName: null,
        includedMemberIdsSnapshot: ["tap-1", "tap-2"],
        reportSnapshot: snapshot,
        errorMessage: null,
        queuedAt: "2026-05-29T08:00:00.000Z",
        startedAt: "2026-05-29T09:00:00.000Z",
        completedAt: "2026-05-29T09:15:00.000Z",
        createdAt: "2026-05-29T08:00:00.000Z",
        updatedAt: "2026-05-29T09:15:00.000Z",
      },
      snapshot,
      backHref: "/dashboard/teams/team-1",
    }),
  );

  assert.match(rendered, /Pregled timskih signala za lidera/);
  assert.match(rendered, /Pitanja za naredni timski razgovor/);
  assert.match(rendered, /Kako čitati ovaj izvještaj/);
  assert.doesNotMatch(rendered, /individualAnswers|rawResponses|individualScores|memberScores|teamFitOutput|unifiedOverallTeamScore/);
}

main()
  .then(() => {
    console.log("Team Dynamics executive overview renderer tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
