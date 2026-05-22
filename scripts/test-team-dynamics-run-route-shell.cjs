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
  buildTeamAssessmentExecutionStartedPatch,
} = require("../lib/assessment/team-assessment-execution.ts");

const routePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "app",
  "team-assessments",
  "[teamAssessmentParticipantId]",
  "run",
  "page.tsx",
);

assert.equal(fs.existsSync(routePath), true, "Expected Team Dynamics run route file to exist.");

const routeSource = fs.readFileSync(routePath, "utf8");
const helperSource = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-assessment-execution.ts"),
  "utf8",
);

assert.match(routeSource, /loadTeamAssessmentExecutionContext/);
assert.match(routeSource, /markTeamAssessmentExecutionStartedIfInvited/);
assert.match(routeSource, /requireAuthenticatedUser/);
assert.match(routeSource, /teamAssessmentParticipantId: params\.teamAssessmentParticipantId/);
assert.match(routeSource, /userId: user\.id/);
assert.match(routeSource, /if \(!access\.ok\) \{\s+notFound\(\);\s+\}/);
assert.match(routeSource, /if \(wrapperStatus === "invited"\)/);
assert.match(routeSource, /wrapperStatus = transition\.status/);
assert.match(routeSource, /const isCompleted = wrapperStatus === "completed"/);

assert.doesNotMatch(routeSource, /getCandidateAttemptForUser/);
assert.doesNotMatch(routeSource, /getGenericCandidateAttemptForUser/);
assert.doesNotMatch(routeSource, /AssessmentForm/);
assert.doesNotMatch(routeSource, /saveAssessmentProgress/);
assert.doesNotMatch(routeSource, /completeAssessmentAttempt/);
assert.doesNotMatch(routeSource, /completeProtectedAssessmentAttempt/);
assert.doesNotMatch(routeSource, /attemptId/);
assert.doesNotMatch(routeSource, /responses/i);
assert.doesNotMatch(routeSource, /score/i);
assert.doesNotMatch(routeSource, /attempt_reports/);
assert.doesNotMatch(routeSource, /assessment_reports/);
assert.doesNotMatch(routeSource, /report CTA/i);
assert.doesNotMatch(routeSource, /AI report/i);
assert.doesNotMatch(routeSource, /Team Fit/);

assert.match(routeSource, /Procjena timske dinamike/);
assert.match(routeSource, /Rješavanje procjene još nije omogućeno u ovoj verziji\./);
assert.match(routeSource, /Ova procjena je već završena\./);
assert.match(routeSource, /context\.packageSlug/);

assert.match(helperSource, /export function buildTeamAssessmentExecutionStartedPatch/);
assert.match(helperSource, /export async function markTeamAssessmentExecutionStartedIfInvited/);
assert.match(helperSource, /\.from\("team_assessment_participants"\)/);

assert.deepEqual(
  buildTeamAssessmentExecutionStartedPatch({
    wrapperStatus: "invited",
    startedAt: null,
    transitionAt: "2026-05-22T13:00:00.000Z",
  }),
  {
    status: "started",
    started_at: "2026-05-22T13:00:00.000Z",
  },
);

assert.deepEqual(
  buildTeamAssessmentExecutionStartedPatch({
    wrapperStatus: "invited",
    startedAt: "2026-05-22T12:55:00.000Z",
    transitionAt: "2026-05-22T13:00:00.000Z",
  }),
  {
    status: "started",
    started_at: "2026-05-22T12:55:00.000Z",
  },
);

assert.equal(
  buildTeamAssessmentExecutionStartedPatch({
    wrapperStatus: "started",
    startedAt: "2026-05-22T12:55:00.000Z",
    transitionAt: "2026-05-22T13:00:00.000Z",
  }),
  null,
);

assert.equal(
  buildTeamAssessmentExecutionStartedPatch({
    wrapperStatus: "completed",
    startedAt: "2026-05-22T12:55:00.000Z",
    transitionAt: "2026-05-22T13:00:00.000Z",
  }),
  null,
);

console.log("Team Dynamics run route shell tests passed.");
