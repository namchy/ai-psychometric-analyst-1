const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const queueListPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "team-dynamics-report-queue-list.tsx",
);
const actionUiPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "team-dynamics-report-process-action.tsx",
);
const retryActionUiPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "team-dynamics-report-retry-action.tsx",
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
const queueListSource = fs.readFileSync(queueListPath, "utf8");
const actionUiSource = fs.readFileSync(actionUiPath, "utf8");
const retryActionUiSource = fs.readFileSync(retryActionUiPath, "utf8");
const routeSource = fs.readFileSync(routePath, "utf8");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const nextLinkStubPath = path.join(__dirname, "next-link-stub.cjs");
const processActionStubPath = path.join(__dirname, "td-process-action-stub.cjs");
const retryActionStubPath = path.join(__dirname, "td-retry-action-stub.cjs");
const originalResolveFilename = Module._resolveFilename;

assert.match(queueListSource, /TeamDynamicsReportProcessAction/);
assert.match(queueListSource, /TeamDynamicsReportRetryAction/);
assert.match(queueListSource, /Obrada u toku/);
assert.match(queueListSource, /Otvori izvještaj/);
assert.match(queueListSource, /Nije uspješno kreiran/);
assert.match(queueListSource, /Timski izvještaji/);
assert.match(queueListSource, /Prati status izvještaja i otvori one koji su spremni\./);
assert.match(queueListSource, /Spreman za otvaranje/);
assert.doesNotMatch(queueListSource, /Pripremljeni timski izvještaji/);
assert.match(actionUiSource, /Obradi izvještaj/);
assert.match(retryActionUiSource, /Pokušaj ponovo/);
assert.match(
  actionUiSource,
  /processTeamDynamicsExecutiveOverviewReportAction/,
);
assert.doesNotMatch(
  actionUiSource,
  /generateTeamDynamicsExecutiveOverviewWithOpenAI/,
);
assert.doesNotMatch(
  actionUiSource,
  /processTeamDynamicsExecutiveOverviewWithOpenAI/,
);
assert.doesNotMatch(
  retryActionUiSource,
  /generateTeamDynamicsExecutiveOverviewWithOpenAI|processTeamDynamicsExecutiveOverviewWithOpenAI/,
);
assert.doesNotMatch(actionUiSource, /attempt_reports|assessment_reports/);
assert.doesNotMatch(retryActionUiSource, /attempt_reports|assessment_reports/);
assert.doesNotMatch(routeSource, /processTeamDynamicsExecutiveOverviewReportAction/);
assert.doesNotMatch(routeSource, /resetTeamDynamicsExecutiveOverviewReportAction/);
assert.doesNotMatch(routeSource, /processTeamDynamicsExecutiveOverviewWithOpenAI/);
assert.doesNotMatch(routeSource, /generateTeamDynamicsExecutiveOverviewWithOpenAI/);

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
  if (request === "next/link") {
    return nextLinkStubPath;
  }

  if (request === "@/components/dashboard/team-dynamics-report-process-action") {
    return processActionStubPath;
  }

  if (request === "@/components/dashboard/team-dynamics-report-retry-action") {
    return retryActionStubPath;
  }

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

require.cache[nextLinkStubPath] = {
  id: nextLinkStubPath,
  filename: nextLinkStubPath,
  loaded: true,
  exports: function Link(props) {
    const { href, children, ...rest } = props;
    return React.createElement("a", { href, ...rest }, children);
  },
};

require.cache[processActionStubPath] = {
  id: processActionStubPath,
  filename: processActionStubPath,
  loaded: true,
  exports: {
    TeamDynamicsReportProcessAction({ teamAssessmentReportId, teamId }) {
      return React.createElement(
        "button",
        {
          type: "button",
          "data-report-id": teamAssessmentReportId,
          "data-team-id": teamId,
        },
        "Obradi izvještaj",
      );
    },
  },
};

require.cache[retryActionStubPath] = {
  id: retryActionStubPath,
  filename: retryActionStubPath,
  loaded: true,
  exports: {
    TeamDynamicsReportRetryAction({ teamAssessmentReportId, teamId }) {
      return React.createElement(
        "button",
        {
          type: "button",
          "data-retry-report-id": teamAssessmentReportId,
          "data-retry-team-id": teamId,
        },
        "Pokušaj ponovo",
      );
    },
  },
};

const { TeamDynamicsReportQueueList } = require(queueListPath);

function buildReportRow(status) {
  return {
    id: `report-${status}`,
    organizationId: "org-1",
    teamId: "team-1",
    teamAssessmentAssignmentId: "assignment-1",
    selectionDraftId: "draft-1",
    aggregationSnapshotId: "agg-1",
    reportType: "team_dynamics_report_v1",
    reportVersion: "team_dynamics_executive_overview_v1",
    reportStatus: status,
    generatorType: null,
    modelName: null,
    includedMemberIdsSnapshot: ["tap-1", "tap-2", "tap-3", "tap-4"],
    inputSnapshot: null,
    reportSnapshot: null,
    errorMessage: null,
    queuedAt: "2026-05-29T08:00:00.000Z",
    startedAt: null,
    completedAt: null,
    createdAt: "2026-05-29T08:00:00.000Z",
    updatedAt: "2026-05-29T08:00:00.000Z",
  };
}

function renderForStatus(status) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(TeamDynamicsReportQueueList, {
      teamId: "team-1",
      reportRows: [buildReportRow(status)],
    }),
  );
}

const queuedMarkup = renderForStatus("queued");
assert.match(queuedMarkup, /Obradi izvještaj/);
assert.doesNotMatch(queuedMarkup, /Otvori izvještaj/);
assert.doesNotMatch(queuedMarkup, /Obrada u toku/);

const processingMarkup = renderForStatus("processing");
assert.match(processingMarkup, /Obrada u toku/);
assert.doesNotMatch(processingMarkup, /Obradi izvještaj/);

const readyMarkup = renderForStatus("ready");
assert.match(readyMarkup, /Otvori izvještaj/);
assert.match(readyMarkup, /Spreman za otvaranje/);
assert.doesNotMatch(readyMarkup, /Obradi izvještaj/);

console.log(
  JSON.stringify(
    {
      ok: true,
      verified: [
        "queued report shows Obradi izvjestaj",
        "processing report shows Obrada u toku",
        "ready report keeps Otvori izvjestaj and marks status as Spreman za otvaranje",
        "queue list uses server action boundary through dedicated action components",
        "UI does not import OpenAI provider or lifecycle processor directly",
        "report view route does not generate reports",
      ],
    },
    null,
    2,
  ),
);
