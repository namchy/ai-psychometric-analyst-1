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
  resolveTeamAssessmentExecutionShellState,
} = require("../lib/assessment/team-assessment-execution.ts");

const introRouteSource = fs.readFileSync(
  path.join(
    projectRoot,
    "app",
    "(protected)",
    "app",
    "team-assessments",
    "[teamAssessmentParticipantId]",
    "page.tsx",
  ),
  "utf8",
);
const runRouteSource = fs.readFileSync(
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

const introInvited = resolveTeamAssessmentExecutionShellState({
  route: "intro",
  wrapperStatus: "invited",
});
assert.equal(introInvited.isRunnable, true);
assert.equal(introInvited.shouldTransitionToStarted, false);

const introStarted = resolveTeamAssessmentExecutionShellState({
  route: "intro",
  wrapperStatus: "started",
});
assert.equal(introStarted.isRunnable, true);
assert.equal(introStarted.shouldTransitionToStarted, false);

const introCompleted = resolveTeamAssessmentExecutionShellState({
  route: "intro",
  wrapperStatus: "completed",
});
assert.equal(introCompleted.isRunnable, false);
assert.equal(introCompleted.kind, "intro_completed");

const introExpired = resolveTeamAssessmentExecutionShellState({
  route: "intro",
  wrapperStatus: "expired",
});
assert.equal(introExpired.isRunnable, false);
assert.equal(introExpired.kind, "intro_expired");

const runInvited = resolveTeamAssessmentExecutionShellState({
  route: "run",
  wrapperStatus: "invited",
});
assert.equal(runInvited.isRunnable, true);
assert.equal(runInvited.shouldTransitionToStarted, true);

const runStarted = resolveTeamAssessmentExecutionShellState({
  route: "run",
  wrapperStatus: "started",
});
assert.equal(runStarted.isRunnable, true);
assert.equal(runStarted.shouldTransitionToStarted, false);

const runCompleted = resolveTeamAssessmentExecutionShellState({
  route: "run",
  wrapperStatus: "completed",
});
assert.equal(runCompleted.isRunnable, false);
assert.equal(runCompleted.kind, "run_completed");

const runExpired = resolveTeamAssessmentExecutionShellState({
  route: "run",
  wrapperStatus: "expired",
});
assert.equal(runExpired.isRunnable, false);
assert.equal(runExpired.kind, "run_expired");

const runUnknown = resolveTeamAssessmentExecutionShellState({
  route: "run",
  wrapperStatus: "mystery",
});
assert.equal(runUnknown.isRunnable, false);
assert.equal(runUnknown.kind, "unavailable");

assert.match(introRouteSource, /resolveTeamAssessmentExecutionShellState/);
assert.doesNotMatch(introRouteSource, /markTeamAssessmentExecutionStartedIfInvited/);
assert.doesNotMatch(introRouteSource, /AssessmentForm/);
assert.doesNotMatch(introRouteSource, /attemptId/);
assert.doesNotMatch(introRouteSource, /responses/i);
assert.doesNotMatch(introRouteSource, /score/i);
assert.doesNotMatch(introRouteSource, /AI report/i);
assert.doesNotMatch(introRouteSource, /Team Fit/);

assert.match(runRouteSource, /resolveTeamAssessmentExecutionShellState/);
assert.match(runRouteSource, /markTeamAssessmentExecutionStartedIfInvited/);
assert.match(runRouteSource, /shellState\.shouldTransitionToStarted/);
assert.doesNotMatch(runRouteSource, /AssessmentForm/);
assert.doesNotMatch(runRouteSource, /attemptId/);
assert.doesNotMatch(runRouteSource, /responses/i);
assert.doesNotMatch(runRouteSource, /score/i);
assert.doesNotMatch(runRouteSource, /AI report/i);
assert.doesNotMatch(runRouteSource, /Team Fit/);

console.log("Team Dynamics execution safe-state tests passed.");
