const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const pagePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "participants",
  "[participantId]",
  "reports",
  "page.tsx",
);
const helperPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-list.ts");
const componentPath = path.join(projectRoot, "components", "dashboard", "team-fit-report-list.tsx");
const appProtectedRoot = path.join(projectRoot, "app", "(protected)", "app");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const nextLinkStubPath = path.join(__dirname, "next-link-stub.cjs");
const originalResolveFilename = Module._resolveFilename;

const pageSource = fs.readFileSync(pagePath, "utf8");
const helperSource = fs.readFileSync(helperPath, "utf8");
const componentSource = fs.readFileSync(componentPath, "utf8");

assert.match(pageSource, /listTeamFitReportEntries/);
assert.match(pageSource, /TeamFitReportList/);
assert.doesNotMatch(pageSource, /team-fit-report-provider|team-fit-report-processor|processTeamFitReportWithMock|processTeamFitReportWithProvider/i);
assert.doesNotMatch(pageSource, /queueTeamFitReportShell|claimTeamFitReportForProcessing|markTeamFitReportProcessingFailed|resetFailedTeamFitReportToQueued/);
assert.doesNotMatch(pageSource, /error_message/);

assert.match(helperSource, /export async function listTeamFitReportEntries/);
assert.match(helperSource, /team_fit_reports/);
assert.match(helperSource, /safeStatusMessage/);
assert.doesNotMatch(helperSource, /OpenAI|team-fit-report-provider|team-fit-report-processor|processTeamFitReportWithMock|processTeamFitReportWithProvider/i);
assert.doesNotMatch(helperSource, /\.insert\(|\.update\(|\.delete\(/);
assert.doesNotMatch(helperSource, /attempt_reports|assessment_reports|team_assessment_reports/);
assert.doesNotMatch(helperSource, /error_message/);

assert.match(componentSource, /Persistirani Team Fit artefakti/);
assert.match(componentSource, /Otvori Team Fit izvještaj/);
assert.doesNotMatch(componentSource, /OpenAI|team-fit-report-provider|team-fit-report-processor/i);
assert.doesNotMatch(componentSource, /queueTeamFitReportShell|claimTeamFitReportForProcessing|markTeamFitReportProcessingFailed|resetFailedTeamFitReportToQueued/);
assert.doesNotMatch(componentSource, /\.from\(|\.insert\(|\.update\(|\.delete\(/);
assert.doesNotMatch(componentSource, /error_message|candidateVisible|fitScore|hireScore/i);
assert.doesNotMatch(componentSource, /\bno-hire\b|\bhire\/no-hire\b|\bculture fit\b/i);

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
  if (request === "next/link") {
    return nextLinkStubPath;
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

const { TeamFitReportList } = require(componentPath);

function render(entries) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(TeamFitReportList, { entries }),
  );
}

function buildEntry(status, overrides = {}) {
  return {
    id: `report-${status}`,
    organizationId: "org-1",
    teamId: "team-1",
    participantId: "participant-1",
    teamName: "Tim A",
    reportType: "team_fit_report_v1",
    reportVersion: "v1",
    status,
    statusLabel:
      status === "ready"
        ? "Spremno"
        : status === "queued"
          ? "Čeka obradu"
          : status === "processing"
            ? "U obradi"
            : "Trenutno nedostupno",
    safeStatusMessage:
      status === "ready"
        ? "Izvještaj je spreman za pregled."
        : status === "queued"
          ? "Izvještaj je pripremljen za obradu."
          : status === "processing"
            ? "Izvještaj je trenutno u obradi."
            : "Izvještaj trenutno nije uspješno kreiran.",
    createdAt: "2026-05-30T12:00:00.000Z",
    updatedAt: "2026-05-30T12:15:00.000Z",
    queuedAt: "2026-05-30T12:01:00.000Z",
    startedAt: status === "queued" ? null : "2026-05-30T12:03:00.000Z",
    completedAt: status === "ready" ? "2026-05-30T12:12:00.000Z" : null,
    failedAt: status === "failed" ? "2026-05-30T12:12:00.000Z" : null,
    hasInputSnapshot: true,
    hasReportSnapshot: status === "ready",
    href: "/dashboard/teams/team-1/participants/participant-1/team-fit-reports/report-ready",
    ...overrides,
  };
}

function main() {
  const emptyHtml = render([]);
  assert.match(emptyHtml, /Još nema dostupnih Team Fit izvještaja/);

  const readyHtml = render([buildEntry("ready")]);
  assert.match(readyHtml, /Persistirani Team Fit artefakti/);
  assert.match(readyHtml, /Tim A/);
  assert.match(readyHtml, /Izvještaj je spreman za pregled/);
  assert.match(readyHtml, /Otvori Team Fit izvještaj/);
  assert.doesNotMatch(readyHtml, /\bfit score\b|\bfitScore\b|\bhireScore\b/i);
  assert.doesNotMatch(readyHtml, /\bno-hire\b|\bhire\/no-hire\b|\bculture fit\b/i);

  const failedHtml = render([
    buildEntry("failed", {
      safeStatusMessage: "Izvještaj trenutno nije uspješno kreiran.",
    }),
  ]);
  assert.match(failedHtml, /Trenutno nedostupno/);
  assert.match(failedHtml, /Izvještaj trenutno nije uspješno kreiran/);
  assert.doesNotMatch(failedHtml, /TEAM_FIT_PROVIDER_|error_message|raw error/i);
  assert.doesNotMatch(failedHtml, /Otvori Team Fit izvještaj/);
}

main();
console.log("test-team-fit-report-list-entrypoint: ok");
