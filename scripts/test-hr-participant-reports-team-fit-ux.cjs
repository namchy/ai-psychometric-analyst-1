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
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const nextLinkStubPath = path.join(__dirname, "next-link-stub.cjs");
const originalResolveFilename = Module._resolveFilename;

const stubState = {
  teamFitReports: [],
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

  if (request === "next/navigation") {
    return emptyModulePath;
  }

  if (
    request === "@/app/actions/assessment" ||
    request === "@/app/actions/individual-development-profile" ||
    request === "@/components/app/authenticated-app-chrome" ||
    request === "@/components/dashboard/primitives" ||
    request === "@/components/dashboard/team-fit-report-list" ||
    request === "@/lib/assessment/individual-development-profile-report-list" ||
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
    getDashboardCtaClassName() {
      return "cta";
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
    DpButton({ children, href, type = "button", disabled }) {
      if (href && !disabled) {
        return React.createElement("a", { href }, children);
      }

      return React.createElement("button", { type, disabled }, children);
    },
    DpEmptyState({ title, body }) {
      return React.createElement(
        "section",
        { "data-empty-state": true },
        React.createElement("h3", null, title),
        React.createElement("p", null, body),
      );
    },
    DpInlineMessage({ children }) {
      return React.createElement("div", { "data-inline-message": true }, children);
    },
    DpMetaGrid({ children }) {
      return React.createElement("div", { "data-meta-grid": true }, children);
    },
    DpMetaItem({ label, value }) {
      return React.createElement(
        "div",
        { "data-meta-item": true },
        React.createElement("p", null, label),
        React.createElement("p", null, value),
      );
    },
    DpPageHeader({ title, description, badges, meta, backLabel }) {
      return React.createElement(
        "section",
        { "data-page-header": true },
        React.createElement("nav", null, backLabel),
        React.createElement("h1", null, title),
        description ? React.createElement("p", null, description) : null,
        badges ? React.createElement("div", null, badges) : null,
        meta ? React.createElement("div", null, meta) : null,
      );
    },
    DpStatusBadge({ children }) {
      return React.createElement("span", null, children);
    },
    TeamFitReportList({ entries }) {
      return React.createElement(
        "section",
        { "data-section": "team-fit" },
        React.createElement("h2", null, "Team Fit izvještaji"),
        entries.map((entry) =>
          React.createElement(
            "article",
            { key: entry.id },
            React.createElement("p", null, entry.statusLabel),
            React.createElement("p", null, entry.safeStatusMessage),
            entry.status === "failed"
              ? React.createElement("button", { type: "button" }, "Pokušaj ponovo")
              : entry.status === "queued"
                ? React.createElement("button", { type: "button" }, "Pripremi Team Fit izvještaj")
                : entry.status === "processing"
                  ? React.createElement("span", null, "Priprema u toku")
                  : React.createElement("a", { href: entry.href }, "Otvori Team Fit izvještaj"),
          ),
        ),
      );
    },
    listIndividualDevelopmentProfileReportEntries: async () => [],
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
      return value ?? "Nije dostupno";
    },
    notFound() {
      throw new Error("notFound");
    },
  },
};

const CandidateReportsPage = require(pagePath).default;

async function renderPage() {
  const element = await CandidateReportsPage({
    params: { participantId: "participant-1" },
    searchParams: {},
  });

  return ReactDOMServer.renderToStaticMarkup(element);
}

function buildBaseModel() {
  return {
    participant: stubState.participant,
    organizationName: "Org 1",
    cards: [
      {
        slug: "ipip-neo-120-v1",
        title: "IPIP-NEO-120",
        subtitle: "HR interpretacija za kandidatov lični profil.",
        state: "completed_without_report",
        statusLabel: "Nije generisano",
        body: "Procjena je završena, ali HR izvještaj još nije generisan.",
        visualVariant: "info",
        action: {
          label: "Generiši HR izvještaj",
          kind: "generate",
          enabled: true,
        },
        attempt: {
          id: "attempt-1",
          lifecycle: "completed",
          completed_at: "2026-05-31T08:30:00.000Z",
        },
        report: null,
        cta: {
          label: "Nije dostupno",
          href: null,
          disabled: true,
        },
      },
    ],
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
    hasAssignedIndividualAssessments: true,
    allIndividualReportsNotAssigned: false,
    completedLabel: "0/3 testova završeno",
    readyLabel: "0 pojedinačnih HR izvještaja dostupno",
    availabilityLabel: "Čeka rezultate",
  };
}

async function main() {
  stubState.teamFitReports = [
    {
      id: "team-fit-report-1",
      organizationId: "org-1",
      teamId: "team-1",
      participantId: "participant-1",
      teamName: "Product Delivery Pod",
      reportType: "team_fit_report_v1",
      reportVersion: "v1",
      status: "failed",
      statusLabel: "Nije pripremljen",
      safeStatusMessage: "Izvještaj nije pripremljen. Možeš ga vratiti u red za pripremu.",
      createdAt: "2026-05-31T09:00:00.000Z",
      updatedAt: "2026-05-31T09:10:00.000Z",
      queuedAt: "2026-05-31T09:00:00.000Z",
      startedAt: "2026-05-31T09:05:00.000Z",
      completedAt: null,
      failedAt: "2026-05-31T09:10:00.000Z",
      hasInputSnapshot: true,
      hasReportSnapshot: false,
      href: "/dashboard/teams/team-1/participants/participant-1/team-fit-reports/team-fit-report-1",
    },
  ];
  stubState.model = buildBaseModel();

  const html = await renderPage();

  assert.match(html, /0 pojedinačnih HR izvještaja dostupno/);
  assert.match(html, /HR izvještaji nisu generisani/);
  assert.doesNotMatch(html, /Čeka rezultate/);
  assert.match(html, /Nije generisano/);
  assert.match(html, /Generiši HR izvještaj/);
  assert.equal(
    html.includes(
      '<div class="mt-6"><div class="flex flex-wrap gap-3"><form><input name="participantId" type="hidden" value="participant-1"/><input name="attemptId" type="hidden" value="attempt-1"/><input name="testSlug" type="hidden" value="ipip-neo-120-v1"/><input name="returnPath" type="hidden" value="/dashboard/participants/participant-1/reports"/><button type="submit">Generiši HR izvještaj</button></form></div></div>',
    ),
    true,
  );
  assert.match(html, /Nije pripremljen/);
  assert.match(
    html,
    /Izvještaj nije pripremljen\. Možeš ga vratiti u red za pripremu\./,
  );
  assert.match(html, /Pokušaj ponovo/);
  assert.doesNotMatch(html, />Izvještaj nije pripremljen<\/button>/);

  const teamFitIndex = html.indexOf("Team Fit izvještaji");
  const individualIndex = html.indexOf("Pojedinačni HR izvještaji");
  const compositeIndex = html.indexOf("Kompozitni HR izvještaj");

  assert.notEqual(teamFitIndex, -1);
  assert.notEqual(individualIndex, -1);
  assert.notEqual(compositeIndex, -1);
  assert.equal(teamFitIndex < individualIndex, true);
  assert.equal(individualIndex < compositeIndex, true);
}

main()
  .then(() => {
    console.log("test-hr-participant-reports-team-fit-ux: ok");
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
