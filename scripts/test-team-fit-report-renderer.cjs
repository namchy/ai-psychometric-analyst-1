const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const viewPath = path.join(projectRoot, "components", "dashboard", "team-fit-report-view.tsx");
const displayPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-display.ts");
const mockPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-mock.ts");
const inputPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-input.ts");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const viewSource = fs.readFileSync(viewPath, "utf8");
const displaySource = fs.readFileSync(displayPath, "utf8");

assert.match(viewSource, /export function TeamFitReportView/);
assert.match(viewSource, /Signal poravnanja/);
assert.match(viewSource, /Signal dopune/);
assert.match(viewSource, /Miješani signal/);
assert.match(viewSource, /Potrebna dodatna provjera/);
assert.doesNotMatch(viewSource, /OpenAI|processTeamFitReportWithProvider|processTeamFitReportWithMock|createTeamFitFakeProvider|claimTeamFitReportForProcessing|markTeamFitReportProcessingFailed/);
assert.doesNotMatch(viewSource, /\.from\(|\.update\(|\.insert\(/);
assert.doesNotMatch(viewSource, /\bfitScore\b|\bhireScore\b/i);
assert.doesNotMatch(viewSource, /\bno-hire\b|\bhire\/no-hire\b|\bculture fit\b/i);
assert.doesNotMatch(viewSource, /rawAnswers|teamMemberScores|individualScores|errorMessage/);
assert.doesNotMatch(displaySource, /TeamFitReportView/);
assert.match(displaySource, /Izvještaj je pripremljen za obradu/);
assert.match(displaySource, /Izvještaj je trenutno u obradi/);
assert.match(displaySource, /Izvještaj trenutno nije uspješno kreiran/);

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
    request === "@/lib/supabase/admin"
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

const { TeamFitReportView } = require(viewPath);
const { buildMockTeamFitReportSnapshot } = require(mockPath);
const {
  TEAM_FIT_REPORT_INPUT_TYPE,
  TEAM_FIT_REPORT_INPUT_VERSION,
} = require(inputPath);

function buildInputSnapshot() {
  return {
    inputType: TEAM_FIT_REPORT_INPUT_TYPE,
    inputVersion: TEAM_FIT_REPORT_INPUT_VERSION,
    reportType: "team_fit_report_v1",
    reportVersion: "v1",
    locale: "bs",
    generatedAt: "2026-05-30T12:00:00.000Z",
    organizationContext: {
      organizationId: "org-1",
      organizationName: "Deep Profile",
    },
    teamContext: {
      teamId: "team-1",
      teamName: "Tim A",
      teamSourceType: "team_dynamics_aggregation_input_snapshot",
      teamSourceId: "team-source-1",
    },
    candidateContext: {
      participantId: "participant-1",
      displayName: "Amina Candidate",
      candidateSourceType: "composite_deterministic_input_snapshot",
      candidateSourceId: "candidate-source-1",
    },
    sourceReferences: {
      teamFitReportId: "report-1",
      candidateSourceType: "composite_deterministic_input_snapshot",
      candidateSourceId: "candidate-source-1",
      teamSourceType: "team_dynamics_aggregation_input_snapshot",
      teamSourceId: "team-source-1",
      executiveOverviewContextIncluded: false,
      roleContextIncluded: false,
    },
    candidateSignals: {
      sourceStatus: "placeholder_pending_composite_input",
      summary: null,
    },
    teamSignals: {
      sourceStatus: "placeholder_pending_team_aggregation_input",
      summary: null,
    },
    interpretationGuardrails: {
      noNumericFitScore: true,
      noHireNoHire: true,
      noRawTeamMemberAnswers: true,
      noIndividualTeamMemberScoreDisplay: true,
      noCandidateFacingOutput: true,
    },
  };
}

function buildRecord(status, overrides = {}) {
  const snapshot = buildMockTeamFitReportSnapshot(buildInputSnapshot());

  return {
    id: "report-1",
    organizationId: "org-1",
    teamId: "team-1",
    participantId: "participant-1",
    reportType: "team_fit_report_v1",
    reportVersion: "v1",
    status,
    team: {
      id: "team-1",
      name: "Tim A",
    },
    candidate: {
      participantId: "participant-1",
      displayName: "Amina Candidate",
    },
    createdAt: "2026-05-30T12:00:00.000Z",
    queuedAt: "2026-05-30T12:01:00.000Z",
    startedAt: status === "queued" ? null : "2026-05-30T12:03:00.000Z",
    completedAt: status === "ready" ? "2026-05-30T12:12:00.000Z" : null,
    failedAt: status === "failed" ? "2026-05-30T12:12:00.000Z" : null,
    hasInputSnapshot: true,
    hasReportSnapshot: status === "ready",
    safeStatusMessage:
      status === "queued"
        ? "Izvještaj je pripremljen za obradu."
        : status === "processing"
          ? "Izvještaj je trenutno u obradi."
          : status === "failed"
            ? "Izvještaj trenutno nije uspješno kreiran."
            : "Izvještaj je spreman za pregled.",
    reportSnapshot: status === "ready" ? snapshot : null,
    ...overrides,
  };
}

function render(record) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(TeamFitReportView, { record }),
  );
}

function main() {
  const readyHtml = render(buildRecord("ready"));
  assert.match(readyHtml, /Početni pregled odnosa kandidata i tima traži dodatnu provjeru/);
  assert.match(readyHtml, /Potrebna dodatna provjera/);
  assert.match(readyHtml, /Amina Candidate/);
  assert.match(readyHtml, /Tim A/);
  assert.match(readyHtml, /Timski kontekst se čita kroz postojeći snapshot/);
  assert.match(readyHtml, /Kandidatov signal ostaje razvojni ulaz/);
  assert.match(readyHtml, /Moguća dopuna postojećem ritmu rada/);
  assert.match(readyHtml, /Potrebna je rana provjera očekivanja/);
  assert.match(readyHtml, /Saradnja u novom timu/);
  assert.match(readyHtml, /Kako podržati onboarding/);
  assert.match(readyHtml, /Kako voditi saradnju/);
  assert.match(readyHtml, /Oprezne hipoteze/);
  assert.match(readyHtml, /Kako oprezno čitati ovaj izvještaj/);

  const queuedHtml = render(buildRecord("queued"));
  assert.match(queuedHtml, /Izvještaj je pripremljen za obradu/);
  assert.doesNotMatch(queuedHtml, /Početni pregled odnosa kandidata i tima traži dodatnu provjeru/);

  const processingHtml = render(buildRecord("processing"));
  assert.match(processingHtml, /Izvještaj je trenutno u obradi/);
  assert.doesNotMatch(processingHtml, /Početni pregled odnosa kandidata i tima traži dodatnu provjeru/);

  const failedHtml = render(
    buildRecord("failed", {
      safeStatusMessage: "Izvještaj trenutno nije uspješno kreiran.",
    }),
  );
  assert.match(failedHtml, /Izvještaj trenutno nije uspješno kreiran/);
  assert.doesNotMatch(failedHtml, /TEAM_FIT_PROVIDER_/);
  assert.doesNotMatch(failedHtml, /Početni pregled odnosa kandidata i tima traži dodatnu provjeru/);

  assert.doesNotMatch(readyHtml, /\bno-hire\b|\bhire\/no-hire\b|\bculture fit\b/i);
  assert.doesNotMatch(readyHtml, /\bfit score\b|\bfitScore\b|\bhireScore\b/i);
  assert.doesNotMatch(readyHtml, /rawAnswers|teamMemberScores|individualScores/);

  console.log("test-team-fit-report-renderer: ok");
}

main();
