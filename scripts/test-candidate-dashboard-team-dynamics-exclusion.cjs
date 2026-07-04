const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
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

const {
  getCandidateAssessmentAvailability,
  shouldHideAssessmentFromCandidateDashboard,
} = require("../lib/assessment/availability.ts");

const dashboardSource = fs.readFileSync(
  path.join(projectRoot, "components", "dashboard", "candidate-dashboard.tsx"),
  "utf8",
);
const dashboardModelSource = fs.readFileSync(
  path.join(projectRoot, "lib", "dashboard", "candidate-dashboard-model.ts"),
  "utf8",
);
const dashboardDataSource = fs.readFileSync(
  path.join(projectRoot, "lib", "dashboard", "candidate-dashboard-data.ts"),
  "utf8",
);

assert.match(dashboardModelSource, /shouldHideAssessmentFromCandidateDashboard/);
assert.match(
  dashboardModelSource,
  /!shouldHideAssessmentFromCandidateDashboard\(\{ slug: test\.slug \}\)/,
);
assert.match(dashboardModelSource, /const additionalDatabaseCards = sortedDatabaseCards\.filter/);
assert.match(dashboardDataSource, /buildAssessmentCardsFromTests/);
assert.doesNotMatch(dashboardSource, /getSupabaseBrowserClient/);

assert.equal(
  shouldHideAssessmentFromCandidateDashboard({ slug: "team_dynamics_v1_strong" }),
  true,
);
assert.equal(
  shouldHideAssessmentFromCandidateDashboard({ slug: "team_dynamics_assessment_v1" }),
  true,
);
assert.equal(
  shouldHideAssessmentFromCandidateDashboard({ slug: "ipip-neo-120-v1" }),
  false,
);

const teamDynamicsAvailability = getCandidateAssessmentAvailability({
  slug: "team_dynamics_v1_strong",
  name: "Procjena timske dinamike",
  status: "active",
  isActive: true,
  hasOrganizationAccess: true,
  activeQuestionCount: 36,
});

assert.equal(teamDynamicsAvailability.canStart, true);
assert.equal(teamDynamicsAvailability.kind, "add_on");
assert.equal(teamDynamicsAvailability.reason, "add_on_available");

const testsLoadedFromDb = [
  {
    slug: "ipip-neo-120-v1",
    hidden: shouldHideAssessmentFromCandidateDashboard({ slug: "ipip-neo-120-v1" }),
  },
  {
    slug: "safran_v1",
    hidden: shouldHideAssessmentFromCandidateDashboard({ slug: "safran_v1" }),
  },
  {
    slug: "mwms_v1",
    hidden: shouldHideAssessmentFromCandidateDashboard({ slug: "mwms_v1" }),
  },
  {
    slug: "team_dynamics_v1_strong",
    hidden: shouldHideAssessmentFromCandidateDashboard({ slug: "team_dynamics_v1_strong" }),
  },
  {
    slug: "team_dynamics_assessment_v1",
    hidden: shouldHideAssessmentFromCandidateDashboard({ slug: "team_dynamics_assessment_v1" }),
  },
];

assert.deepEqual(
  testsLoadedFromDb.filter((test) => !test.hidden).map((test) => test.slug),
  ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
);
assert.equal(
  testsLoadedFromDb.some(
    (test) => test.slug === "team_dynamics_v1_strong" && test.hidden === false,
  ),
  false,
);
assert.equal(
  testsLoadedFromDb.some(
    (test) => test.slug === "team_dynamics_assessment_v1" && test.hidden === false,
  ),
  false,
);
assert.doesNotMatch(dashboardSource, /team_dynamics_v1_strong[\s\S]*Započni procjenu/);
assert.doesNotMatch(dashboardSource, /team_dynamics_v1_strong[\s\S]*Nastavi procjenu/);
assert.doesNotMatch(dashboardSource, /team_dynamics_v1_strong[\s\S]*Pogledaj rezultate/);
assert.doesNotMatch(dashboardSource, /team_dynamics_assessment_v1[\s\S]*Započni procjenu/);
assert.doesNotMatch(dashboardSource, /team_dynamics_assessment_v1[\s\S]*Nastavi procjenu/);
assert.doesNotMatch(dashboardSource, /team_dynamics_assessment_v1[\s\S]*Pogledaj rezultate/);

console.log("Candidate dashboard Team Dynamics exclusion tests passed.");
