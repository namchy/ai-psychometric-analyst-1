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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  buildTeamAssessmentRunHandoff,
  resolveTeamAssessmentExecutionShellState,
} = require("../lib/assessment/team-assessment-execution.ts");

const helperSource = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-assessment-execution.ts"),
  "utf8",
);
const routeSource = fs.readFileSync(
  path.join(
    projectRoot,
    "app",
    "(protected)",
    "app",
    "team-assessments",
    "[teamAssessmentParticipantId]",
    "run",
    "page.tsx",
  ),
  "utf8",
);

assert.match(helperSource, /export function buildTeamAssessmentRunHandoff/);
assert.match(helperSource, /export async function loadTeamAssessmentRunHandoff/);
assert.match(helperSource, /activeQuestionCount/);
assert.match(helperSource, /warningCode/);
assert.match(helperSource, /testSlug/);
assert.match(helperSource, /testName/);
assert.doesNotMatch(helperSource, /responses/i);
assert.doesNotMatch(helperSource, /score fields/i);
assert.doesNotMatch(helperSource, /attempt_reports/);
assert.doesNotMatch(helperSource, /assessment_reports/);
assert.doesNotMatch(helperSource, /AI report/i);
assert.doesNotMatch(helperSource, /Team Fit/);

const completedHandoff = buildTeamAssessmentRunHandoff({
  context: {
    teamAssessmentParticipantId: "tap-completed",
    teamAssessmentAssignmentId: "assignment-1",
    teamMembershipId: "membership-1",
    participantId: "participant-1",
    attemptId: "attempt-1",
    teamId: "team-1",
    organizationId: "org-1",
    packageSlug: "team_dynamics_v1_strong",
    wrapperStatus: "completed",
    attemptStatus: "completed",
    locale: "bs",
    test: {
      id: "test-team-dynamics",
      slug: "team_dynamics_v1_strong",
      name: "Procjena timske dinamike",
      status: "active",
      isActive: true,
    },
  },
  shellState: resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus: "completed",
  }),
  activeQuestionCount: 36,
});

assert.equal(completedHandoff.handoffState, "safe_completed");
assert.equal(completedHandoff.isRunnableShellState, false);
assert.equal("responses" in completedHandoff, false);
assert.equal("scores" in completedHandoff, false);
assert.equal("attempt_reports" in completedHandoff, false);
assert.equal("assessment_reports" in completedHandoff, false);
assert.equal("teamFit" in completedHandoff, false);

const warningHandoff = buildTeamAssessmentRunHandoff({
  context: {
    teamAssessmentParticipantId: "tap-started",
    teamAssessmentAssignmentId: "assignment-2",
    teamMembershipId: "membership-2",
    participantId: "participant-2",
    attemptId: "attempt-2",
    teamId: "team-2",
    organizationId: "org-2",
    packageSlug: "team_dynamics_v1_strong",
    wrapperStatus: "started",
    attemptStatus: "in_progress",
    locale: "bs",
    test: {
      id: "test-team-dynamics",
      slug: "team_dynamics_v1_strong",
      name: "Procjena timske dinamike",
      status: "active",
      isActive: true,
    },
  },
  shellState: resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus: "started",
  }),
  activeQuestionCount: 34,
});

assert.equal(warningHandoff.handoffState, "warning_placeholder");
assert.equal(warningHandoff.warningCode, "unexpected_question_count");
assert.equal(warningHandoff.testSlug, "team_dynamics_v1_strong");
assert.equal(warningHandoff.testName, "Procjena timske dinamike");
assert.equal(warningHandoff.activeQuestionCount, 34);

assert.match(routeSource, /loadTeamAssessmentRunHandoff/);
assert.match(routeSource, /handoff\.attemptStatus/);
assert.match(routeSource, /handoff\.activeQuestionCount/);
assert.match(routeSource, /Podaci za rjesavanje su pripremljeni\./);
assert.doesNotMatch(routeSource, /AssessmentForm/);
assert.doesNotMatch(routeSource, /question_order/);
assert.doesNotMatch(routeSource, /answer_options/i);
assert.doesNotMatch(routeSource, /attemptId/);
assert.doesNotMatch(routeSource, /responses/i);
assert.doesNotMatch(routeSource, /score/i);
assert.doesNotMatch(routeSource, /AI report/i);
assert.doesNotMatch(routeSource, /Team Fit/);

console.log("Team Dynamics run handoff skeleton tests passed.");
