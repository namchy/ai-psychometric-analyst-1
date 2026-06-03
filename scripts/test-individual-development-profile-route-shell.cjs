const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const crypto = require("node:crypto");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const routePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "individual-development-profile-reports",
  "[assessmentReportId]",
  "page.tsx",
);
const displayHelperPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "individual-development-profile-display.ts",
);
const viewPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "individual-development-profile-report-view.tsx",
);
const teamFitRoutePath = path.join(
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
const originalResolveFilename = Module._resolveFilename;

assert.equal(fs.existsSync(routePath), true);

const routeSource = fs.readFileSync(routePath, "utf8");

assert.match(routeSource, /loadIndividualDevelopmentProfileDisplay/);
assert.match(routeSource, /IndividualDevelopmentProfileReportView/);
assert.match(routeSource, /requireAuthenticatedUser/);
assert.match(routeSource, /getActiveOrganizationForUser/);
assert.match(routeSource, /assessmentReportId/);
assert.match(routeSource, /notFound\(\)/);
assert.match(routeSource, /Izvještaj čeka obradu/);
assert.match(routeSource, /Izvještaj se priprema/);
assert.match(routeSource, /Izvještaj trenutno nije dostupan/);
assert.match(routeSource, /Izvještaj nije dostupan/);
assert.doesNotMatch(routeSource, /individual-development-profile-processor/i);
assert.doesNotMatch(routeSource, /provider seam|provider-seam/i);
assert.doesNotMatch(routeSource, /mock provider|mock-provider/i);
assert.doesNotMatch(routeSource, /OpenAI|openai/i);
assert.doesNotMatch(routeSource, /buildIndividualDevelopmentProfileInputSnapshot/);
assert.doesNotMatch(routeSource, /queueIndividualDevelopmentProfile|resetFailedIndividualDevelopmentProfile|claimIndividualDevelopmentProfile|markIndividualDevelopmentProfile/i);
assert.doesNotMatch(routeSource, /generateIndividualDevelopmentProfile|prepareIndividualDevelopmentProfile|retryIndividualDevelopmentProfile/i);
assert.doesNotMatch(routeSource, /processIndividualDevelopmentProfileAssessmentReport/);
assert.doesNotMatch(routeSource, /app\/actions|from \"@\/app\/actions|from \"@\/app\/\(protected\)\/app\/actions/);
assert.doesNotMatch(routeSource, /Pripremi|Generiš|Generisi|Pokušaj ponovo|Retry|Reset|Obradi|Pokreni obradu/);
assert.doesNotMatch(routeSource, /JSON\.stringify|input_snapshot|report_snapshot|error_message|raw JSON|raw payload/i);
assert.doesNotMatch(routeSource, /raw answers|raw item text|scoring keys|numeric fit score|hire\/no-hire|Team Fit zaključ|Team Dynamics zaključ|dijagnoz|candidate-facing/i);
assert.doesNotMatch(routeSource, /\.from\(|\.insert\(|\.update\(/);
assert.doesNotMatch(routeSource, /attempt_reports|team_assessment_reports|team_fit_reports/);

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
    request === "next/link" ||
    request === "@/lib/supabase/admin"
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

const routeModule = require(routePath);
const { IndividualDevelopmentProfileReportView } = require(viewPath);
const { loadIndividualDevelopmentProfileDisplay } = require(displayHelperPath);

assert.equal(typeof routeModule.default, "function");
assert.equal(typeof IndividualDevelopmentProfileReportView, "function");
assert.equal(typeof loadIndividualDevelopmentProfileDisplay, "function");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function main() {
  const currentTeamFitRouteSource = fs.readFileSync(teamFitRoutePath, "utf8");
  const currentTeamDynamicsRouteSource = fs.readFileSync(teamDynamicsRoutePath, "utf8");

  assert.equal(
    sha256(currentTeamFitRouteSource),
    "760ce7cd65bd580992fd77423b226d65953e9f3b460efe73ce5729648867154a",
  );
  assert.equal(
    sha256(currentTeamDynamicsRouteSource),
    "087fdb3b5c26a9a9589c9e531429789b00b9d959d4c60034e8e36a5a11dc297c",
  );
}

main();
