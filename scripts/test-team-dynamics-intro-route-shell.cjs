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
const routePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "app",
  "team-assessments",
  "[teamAssessmentParticipantId]",
  "page.tsx",
);

assert.equal(fs.existsSync(routePath), true, "Expected Team Dynamics intro route file to exist.");

const source = fs.readFileSync(routePath, "utf8");

assert.match(source, /loadTeamAssessmentExecutionContext/);
assert.match(source, /resolveTeamAssessmentExecutionShellState/);
assert.match(source, /requireAuthenticatedUser/);
assert.match(source, /teamAssessmentParticipantId: params\.teamAssessmentParticipantId/);
assert.match(source, /userId: user\.id/);
assert.match(source, /if \(!access\.ok\) \{\s+notFound\(\);\s+\}/);
assert.match(source, /route: "intro"/);

assert.doesNotMatch(source, /getCandidateAttemptForUser/);
assert.doesNotMatch(source, /getGenericCandidateAttemptForUser/);
assert.doesNotMatch(source, /AssessmentForm/);
assert.doesNotMatch(source, /saveAssessmentProgress/);
assert.doesNotMatch(source, /completeAssessmentAttempt/);
assert.doesNotMatch(source, /completeProtectedAssessmentAttempt/);
assert.doesNotMatch(source, /markTeamAssessmentExecutionStartedIfInvited/);
assert.doesNotMatch(source, /update\(\{/);
assert.doesNotMatch(source, /attemptId/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /report snapshot/i);
assert.doesNotMatch(source, /Team Fit/);
assert.doesNotMatch(source, /AI report/i);

assert.match(source, /Procjena timske dinamike/);
assert.match(source, /Ova procjena je dio timske procjene, ne individualni psihološki profil\./);
assert.match(source, /shellState\.title/);
assert.match(source, /shellState\.message/);
assert.match(source, /context\.packageSlug/);
assert.match(source, /Procjena je već završena i nije potrebno ponovo otvarati aktivni run za ovaj wrapper\./);
assert.doesNotMatch(source, /Započni procjenu/);
assert.doesNotMatch(source, /Nastavi procjenu/);

assert.deepEqual(
  resolveTeamAssessmentExecutionShellState({
    route: "intro",
    wrapperStatus: "invited",
  }),
  {
    kind: "intro_invited",
    route: "intro",
    wrapperStatus: "invited",
    isRunnable: true,
    shouldTransitionToStarted: false,
    title: "Rješavanje još nije omogućeno u ovoj verziji.",
    message: "Uskoro ćeš ovdje moći započeti procjenu timske dinamike.",
  },
);

assert.deepEqual(
  resolveTeamAssessmentExecutionShellState({
    route: "intro",
    wrapperStatus: "started",
  }),
  {
    kind: "intro_started",
    route: "intro",
    wrapperStatus: "started",
    isRunnable: true,
    shouldTransitionToStarted: false,
    title: "Nastavak procjene još nije omogućen u ovoj verziji.",
    message: "Ova procjena je već otvorena kroz execution prostor, ali pitanja još nisu omogućena.",
  },
);

assert.deepEqual(
  resolveTeamAssessmentExecutionShellState({
    route: "intro",
    wrapperStatus: "completed",
  }),
  {
    kind: "intro_completed",
    route: "intro",
    wrapperStatus: "completed",
    isRunnable: false,
    shouldTransitionToStarted: false,
    title: "Ova procjena je već završena.",
    message: "Ovdje će kasnije biti dostupan siguran pregled narednih koraka za timsku procjenu.",
  },
);

assert.deepEqual(
  resolveTeamAssessmentExecutionShellState({
    route: "intro",
    wrapperStatus: "expired",
  }),
  {
    kind: "intro_expired",
    route: "intro",
    wrapperStatus: "expired",
    isRunnable: false,
    shouldTransitionToStarted: false,
    title: "Ova procjena više nije dostupna.",
    message: "Vrijeme ili dostupnost za ovu timsku procjenu je istekla u ovoj verziji.",
  },
);

console.log("Team Dynamics intro route shell tests passed.");
