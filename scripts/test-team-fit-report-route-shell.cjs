const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const routePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "teams",
  "[teamId]",
  "participants",
  "[participantId]",
  "team-fit-reports",
  "[teamFitReportId]",
  "page.tsx",
);
const fixtureRoutePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "dev",
  "team-fit-report-fixture",
  "page.tsx",
);
const fixtureHelperPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-fit-report-visual-fixture.ts",
);
const viewPath = path.join(projectRoot, "components", "dashboard", "team-fit-report-view.tsx");
const appProtectedRoot = path.join(projectRoot, "app", "(protected)", "app");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const routeSource = fs.readFileSync(routePath, "utf8");
const fixtureRouteSource = fs.readFileSync(fixtureRoutePath, "utf8");
const fixtureHelperSource = fs.readFileSync(fixtureHelperPath, "utf8");
const viewSource = fs.readFileSync(viewPath, "utf8");

assert.match(routeSource, /loadTeamFitReportDisplayRecord/);
assert.match(routeSource, /TeamFitReportView/);
assert.match(routeSource, /TeamFitReportV2View/);
assert.match(routeSource, /TEAM_FIT_REPORT_V2_TYPE/);
assert.match(routeSource, /record\.reportType === TEAM_FIT_REPORT_V2_TYPE/);
assert.match(routeSource, /requireAuthenticatedUser/);
assert.match(routeSource, /getActiveOrganizationForUser/);
assert.match(routeSource, /notFound\(\)/);
assert.doesNotMatch(routeSource, /OpenAI|team-fit-report-provider|team-fit-report-processor|team-fit-report-mock/i);
assert.doesNotMatch(routeSource, /generate|process|retry|worker|scheduler|cron/i);
assert.doesNotMatch(routeSource, /\.from\(|\.insert\(|\.update\(/);
assert.doesNotMatch(routeSource, /attempt_reports|assessment_reports|team_assessment_reports/);
assert.doesNotMatch(routeSource, /error_message/);

assert.match(fixtureRouteSource, /process\.env\.NODE_ENV !== "development"/);
assert.match(fixtureRouteSource, /notFound\(\)/);
assert.match(fixtureRouteSource, /TeamFitReportView/);
assert.match(fixtureRouteSource, /buildTeamFitVisualFixtureRecord/);
assert.doesNotMatch(fixtureRouteSource, /OpenAI|team-fit-report-provider|team-fit-report-processor/i);
assert.doesNotMatch(fixtureRouteSource, /generate|processTeamFitReport|retry|worker|scheduler|cron/);
assert.doesNotMatch(fixtureRouteSource, /\.from\(|\.insert\(|\.update\(/);
assert.doesNotMatch(fixtureRouteSource, /attempt_reports|assessment_reports|team_assessment_reports/);

assert.match(fixtureHelperSource, /buildMockTeamFitReportSnapshot/);
assert.doesNotMatch(fixtureHelperSource, /processTeamFitReportWithMock|processTeamFitReportWithProvider/);
assert.doesNotMatch(fixtureHelperSource, /\.from\(|\.insert\(|\.update\(/);
assert.doesNotMatch(fixtureHelperSource, /attempt_reports|assessment_reports|team_assessment_reports/);
assert.doesNotMatch(fixtureHelperSource, /error_message/);

assert.doesNotMatch(viewSource, /error_message/);

function walkFiles(dirPath, output = []) {
  if (!fs.existsSync(dirPath)) {
    return output;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, output);
    } else {
      output.push(fullPath);
    }
  }

  return output;
}

const candidateFacingTeamFitFiles = walkFiles(appProtectedRoot).filter((filePath) =>
  /team-fit/i.test(path.relative(projectRoot, filePath)),
);

assert.deepEqual(candidateFacingTeamFitFiles, []);

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
    request === "next/link"
  ) {
    return emptyModulePath;
  }

  if (request === "next/navigation") {
    return originalResolveFilename.call(this, emptyModulePath, parent, isMain, options);
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

const { buildTeamFitVisualFixtureRecord } = require(fixtureHelperPath);
const { TeamFitReportView } = require(viewPath);

function render(record) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(TeamFitReportView, { record }),
  );
}

function main() {
  const readyHtml = render(buildTeamFitVisualFixtureRecord("ready"));
  assert.match(readyHtml, /Lejla Candidate/);
  assert.match(readyHtml, /Product Delivery Pod/);
  assert.match(readyHtml, /Spremno za pregled/);
  assert.match(readyHtml, />v1</);

  const failedHtml = render(buildTeamFitVisualFixtureRecord("failed"));
  assert.match(failedHtml, /Izvještaj trenutno nije uspješno kreiran/);
  assert.doesNotMatch(failedHtml, /error_message|TEAM_FIT_PROVIDER_|raw error/i);
  assert.doesNotMatch(failedHtml, /Lejla Candidate.*Početni pregled odnosa kandidata i tima traži dodatnu provjeru/s);
}

main();
