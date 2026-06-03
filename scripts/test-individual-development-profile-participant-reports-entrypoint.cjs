const assert = require("node:assert/strict");
const crypto = require("node:crypto");
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
const helperPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "individual-development-profile-report-list.ts",
);
const componentPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "individual-development-profile-report-list.tsx",
);
const teamFitComponentPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "team-fit-report-list.tsx",
);
const teamDynamicsRoutePath = path.join(
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
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const nextLinkStubPath = path.join(__dirname, "next-link-stub.cjs");
const idpListHelperStubPath = path.join(__dirname, "idp-report-list-helper-stub.cjs");
const originalResolveFilename = Module._resolveFilename;

const pageSource = fs.readFileSync(pagePath, "utf8");
const helperSource = fs.readFileSync(helperPath, "utf8");
const componentSource = fs.readFileSync(componentPath, "utf8");

assert.match(pageSource, /listIndividualDevelopmentProfileReportEntries/);
assert.match(pageSource, /IndividualDevelopmentProfileReportList/);
assert.match(pageSource, /hasIndividualDevelopmentProfileReports/);
assert.doesNotMatch(
  pageSource,
  /individual-development-profile-processor|individual-development-profile-provider|mock provider|OpenAI|openai/i,
);
assert.doesNotMatch(
  pageSource,
  /buildIndividualDevelopmentProfileInputSnapshot|queueIndividualDevelopmentProfile|resetFailedIndividualDevelopmentProfile|claimIndividualDevelopmentProfile|markIndividualDevelopmentProfile|processIndividualDevelopmentProfileAssessmentReport/i,
);
assert.doesNotMatch(pageSource, /generateIndividualDevelopmentProfile|retryIndividualDevelopmentProfile/i);
assert.doesNotMatch(pageSource, /input_snapshot|report_snapshot|error_message|JSON\.stringify|raw JSON|raw payload/i);

assert.match(helperSource, /export async function listIndividualDevelopmentProfileReportEntries/);
assert.match(helperSource, /\.from\("assessment_reports"\)/);
assert.match(helperSource, /INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE/);
assert.match(helperSource, /audience/);
assert.match(helperSource, /source_type/);
assert.match(helperSource, /safeStatusMessage/);
assert.match(helperSource, /validateIndividualDevelopmentProfileSnapshot/);
assert.doesNotMatch(
  helperSource,
  /individual-development-profile-processor|individual-development-profile-provider|mock provider|OpenAI|openai/i,
);
assert.doesNotMatch(helperSource, /buildIndividualDevelopmentProfileInputSnapshot/);
assert.doesNotMatch(helperSource, /\.insert\(|\.update\(|\.delete\(/);
assert.doesNotMatch(helperSource, /attempt_reports|team_fit_reports|team_assessment_reports/);
assert.doesNotMatch(helperSource, /failure_reason|error_message/);

assert.match(componentSource, /Individualni razvojni profili/);
assert.match(componentSource, /Otvori Individualni razvojni profil/);
assert.match(componentSource, /Čeka obradu/);
assert.match(componentSource, /U obradi/);
assert.match(componentSource, /Nije dostupno/);
assert.doesNotMatch(
  componentSource,
  /individual-development-profile-processor|individual-development-profile-provider|mock provider|OpenAI|openai/i,
);
assert.doesNotMatch(componentSource, /buildIndividualDevelopmentProfileInputSnapshot/);
assert.doesNotMatch(componentSource, /Pripremi Individualni razvojni profil|Generiši Individualni razvojni profil|Pokušaj ponovo|Reset/);
assert.doesNotMatch(componentSource, /input_snapshot|report_snapshot|error_message|JSON\.stringify|raw JSON|raw payload/i);
assert.doesNotMatch(componentSource, /raw answers|raw item text|scoring keys|numeric fit score|hire\/no-hire|candidate-facing/i);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

assert.equal(
  sha256(fs.readFileSync(teamFitComponentPath, "utf8")),
  "c57918cb575eeb7b25a4c8cc7a81c97dcdaf3234c1d5e60a9b264b495d4e2485",
);
assert.equal(
  sha256(fs.readFileSync(teamDynamicsRoutePath, "utf8")),
  "087fdb3b5c26a9a9589c9e531429789b00b9d959d4c60034e8e36a5a11dc297c",
);

const stubState = {
  idpEntries: [],
  participant: {
    id: "participant-1",
    organization_id: "org-1",
    user_id: null,
    email: "participant@example.com",
    full_name: "Lejla Candidate",
    participant_type: "candidate",
    status: "active",
    created_at: "2026-05-31T10:00:00.000Z",
  },
  attempts: [],
  hrReports: [],
  teamFitReports: [],
  model: null,
};

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

  if (request === "@/lib/assessment/individual-development-profile-report-list") {
    return idpListHelperStubPath;
  }

  if (
    request === "next/navigation" ||
    request === "@/app/actions/assessment" ||
    request === "@/components/app/authenticated-app-chrome" ||
    request === "@/components/dashboard/primitives" ||
    request === "@/components/dashboard/team-fit-report-list" ||
    request === "@/lib/auth/session" ||
    request === "@/lib/b2b/team-fit-report-list" ||
    request === "@/lib/b2b/organizations" ||
    request === "@/lib/assessment/assessment-reports" ||
    request === "@/lib/dashboard/hr-candidate-assessment" ||
    request === "@/lib/dashboard/hr-ui-format"
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

require.cache[nextLinkStubPath] = {
  id: nextLinkStubPath,
  filename: nextLinkStubPath,
  loaded: true,
  exports: function Link(props) {
    const { href, children, ...rest } = props;
    return React.createElement("a", { href, ...rest }, children);
  },
};

require.cache[idpListHelperStubPath] = {
  id: idpListHelperStubPath,
  filename: idpListHelperStubPath,
  loaded: true,
  exports: {
    listIndividualDevelopmentProfileReportEntries: async () => stubState.idpEntries,
  },
};

require.cache[emptyModulePath] = {
  id: emptyModulePath,
  filename: emptyModulePath,
  loaded: true,
  exports: {
    generateCompositeHrReportAction() {},
    recoverHrCandidateAttemptReport() {},
    retryCompositeHrReportAction() {},
    AuthenticatedAppMainContent({ children, className }) {
      return React.createElement("main", { className }, children);
    },
    DashboardInfoCardShell({ children, className }) {
      return React.createElement("section", { className }, children);
    },
    PageNavigation({ backLabel }) {
      return React.createElement("nav", null, backLabel);
    },
    getDashboardCtaClassName({ variant = "primary", size } = {}) {
      return `cta-${variant}${size ? `-${size}` : ""}`;
    },
    DashboardSectionHeader({ eyebrow, title, description, className }) {
      return React.createElement(
        "header",
        { className },
        eyebrow ? React.createElement("p", null, eyebrow) : null,
        title ? React.createElement("h2", null, title) : null,
        description ? React.createElement("p", null, description) : null,
      );
    },
    DashboardSectionShell({ children, className }) {
      return React.createElement("section", { className }, children);
    },
    DashboardStatusBadge({ children }) {
      return React.createElement("span", null, children);
    },
    TeamFitReportList() {
      return React.createElement("section", { "data-section": "team-fit" }, "Team Fit");
    },
    requireAuthenticatedUser: async () => ({ id: "user-1" }),
    listTeamFitReportEntries: async () => stubState.teamFitReports,
    getActiveOrganizationForUser: async () => ({ id: "org-1", name: "Org 1" }),
    getParticipantForOrganization: async () => stubState.participant,
    getAttemptsForParticipantInOrganization: async () => stubState.attempts,
    getHrAttemptReportsForAttemptIds: async () => stubState.hrReports,
    buildCompositeReadinessForAssignment: async () => null,
    loadLatestActiveStandardAssessmentAssignment: async () => null,
    loadLatestCompositeHrAssessmentReport: async () => null,
    buildHrCandidateAssessmentDetailModel: () => stubState.model,
    formatHrDateTime(value) {
      return value ?? "Nije dostupno";
    },
    formatHrLifecycleStatus(value) {
      return value ?? "Nije dostupno";
    },
    formatHrShortId(value) {
      return value ? String(value).slice(0, 8) : "Nije dostupno";
    },
    notFound() {
      throw new Error("notFound");
    },
  },
};

const CandidateReportsPage = require(pagePath).default;

function buildBaseModel() {
  return {
    participant: stubState.participant,
    organizationName: "Org 1",
    cards: [],
    compositeCard: {
      title: "Kompozitni HR izvještaj",
      subtitle: "Integrisani profil kandidata",
      statusLabel: "Nije dostupno",
      body: "Kompozitni HR izvještaj nije dostupan jer ne postoji aktivan procjenski ciklus.",
      visualVariant: "info",
      cta: {
        label: "Nije dostupno",
        href: null,
        disabled: true,
        action: null,
      },
      assignment: null,
      readiness: null,
      report: null,
    },
    completedTests: 0,
    readyHrReports: 0,
    hasAssignedIndividualAssessments: false,
    allIndividualReportsNotAssigned: true,
    completedLabel: "0/3 testova završeno",
    readyLabel: "0 pojedinačnih HR izvještaja dostupno",
    availabilityLabel: "Procjene nisu dodijeljene",
  };
}

async function renderPage() {
  const element = await CandidateReportsPage({
    params: { participantId: "participant-1" },
    searchParams: {},
  });

  return ReactDOMServer.renderToStaticMarkup(element);
}

async function main() {
  stubState.model = buildBaseModel();
  stubState.idpEntries = [
    {
      id: "idp-ready",
      assessmentAssignmentId: "assignment-ready-1234",
      organizationId: "org-1",
      participantId: "participant-1",
      status: "ready",
      statusLabel: "Spremno",
      safeStatusMessage: "Izvještaj je spreman za pregled.",
      createdAt: "2026-06-03T09:00:00.000Z",
      updatedAt: "2026-06-03T09:15:00.000Z",
      queuedAt: "2026-06-03T09:00:00.000Z",
      startedAt: "2026-06-03T09:05:00.000Z",
      completedAt: "2026-06-03T09:15:00.000Z",
      generatedAt: "2026-06-03T09:15:00.000Z",
      hasInputSnapshot: true,
      hasReportSnapshot: true,
      href: "/dashboard/individual-development-profile-reports/idp-ready",
    },
    {
      id: "idp-queued",
      assessmentAssignmentId: "assignment-queued-1234",
      organizationId: "org-1",
      participantId: "participant-1",
      status: "queued",
      statusLabel: "Čeka obradu",
      safeStatusMessage: "Izvještaj je pripremljen za obradu.",
      createdAt: "2026-06-03T08:00:00.000Z",
      updatedAt: "2026-06-03T08:00:00.000Z",
      queuedAt: "2026-06-03T08:00:00.000Z",
      startedAt: null,
      completedAt: null,
      generatedAt: null,
      hasInputSnapshot: true,
      hasReportSnapshot: false,
      href: "/dashboard/individual-development-profile-reports/idp-queued",
    },
    {
      id: "idp-processing",
      assessmentAssignmentId: "assignment-processing-1234",
      organizationId: "org-1",
      participantId: "participant-1",
      status: "processing",
      statusLabel: "U obradi",
      safeStatusMessage: "Izvještaj je trenutno u obradi.",
      createdAt: "2026-06-03T07:00:00.000Z",
      updatedAt: "2026-06-03T07:05:00.000Z",
      queuedAt: "2026-06-03T07:00:00.000Z",
      startedAt: "2026-06-03T07:05:00.000Z",
      completedAt: null,
      generatedAt: null,
      hasInputSnapshot: true,
      hasReportSnapshot: false,
      href: "/dashboard/individual-development-profile-reports/idp-processing",
    },
    {
      id: "idp-failed",
      assessmentAssignmentId: "assignment-failed-1234",
      organizationId: "org-1",
      participantId: "participant-1",
      status: "failed",
      statusLabel: "Nije dostupno",
      safeStatusMessage: "Izvještaj trenutno nije dostupan za pregled.",
      createdAt: "2026-06-03T06:00:00.000Z",
      updatedAt: "2026-06-03T06:10:00.000Z",
      queuedAt: "2026-06-03T06:00:00.000Z",
      startedAt: "2026-06-03T06:05:00.000Z",
      completedAt: null,
      generatedAt: null,
      hasInputSnapshot: true,
      hasReportSnapshot: false,
      href: "/dashboard/individual-development-profile-reports/idp-failed",
    },
    {
      id: "idp-invalid",
      assessmentAssignmentId: "assignment-invalid-1234",
      organizationId: "org-1",
      participantId: "participant-1",
      status: "invalid",
      statusLabel: "Nije dostupno",
      safeStatusMessage: "Izvještaj trenutno nije dostupan za pregled.",
      createdAt: "2026-06-03T05:00:00.000Z",
      updatedAt: "2026-06-03T05:10:00.000Z",
      queuedAt: "2026-06-03T05:00:00.000Z",
      startedAt: "2026-06-03T05:05:00.000Z",
      completedAt: null,
      generatedAt: null,
      hasInputSnapshot: true,
      hasReportSnapshot: true,
      href: "/dashboard/individual-development-profile-reports/idp-invalid",
    },
  ];

  const html = await renderPage();

  assert.match(html, /Individualni razvojni profili/);
  assert.match(html, /Otvori Individualni razvojni profil/);
  assert.match(html, /href=\"\/dashboard\/individual-development-profile-reports\/idp-ready\"/);
  assert.match(html, /Izvještaj je pripremljen za obradu\./);
  assert.match(html, /Izvještaj je trenutno u obradi\./);
  assert.match(html, /Izvještaj trenutno nije dostupan za pregled\./);
  assert.equal(
    html.includes("/dashboard/individual-development-profile-reports/idp-queued"),
    false,
  );
  assert.equal(
    html.includes("/dashboard/individual-development-profile-reports/idp-processing"),
    false,
  );
  assert.equal(
    html.includes("/dashboard/individual-development-profile-reports/idp-failed"),
    false,
  );
  assert.equal(
    html.includes("/dashboard/individual-development-profile-reports/idp-invalid"),
    false,
  );

  for (const forbidden of [
    "input_snapshot",
    "report_snapshot",
    "error_message",
    "failure_reason",
    "JSON",
    "OpenAI",
    "openai",
    "provider",
    "fit score",
    "hire/no-hire",
    "candidate-facing",
  ]) {
    assert.equal(
      html.includes(forbidden),
      false,
      `Rendered participant reports HTML must not include ${forbidden}.`,
    );
  }

  stubState.idpEntries = [];
  const emptyHtml = await renderPage();
  assert.equal(emptyHtml.includes("Individualni razvojni profili"), false);
  assert.equal(
    emptyHtml.includes("/dashboard/individual-development-profile-reports/"),
    false,
  );
}

main();
