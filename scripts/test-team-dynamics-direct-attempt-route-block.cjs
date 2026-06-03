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
  buildGenericCandidateAttemptAccessResult,
  getGenericCandidateAttemptForUser,
} = require("../lib/candidate/attempts.ts");
const {
  canUseGenericCandidateAttemptCreation,
} = require("../lib/assessment/team-dynamics.ts");

const candidateAttemptsSource = fs.readFileSync(
  path.join(projectRoot, "lib", "candidate", "attempts.ts"),
  "utf8",
);
const introRouteSource = fs.readFileSync(
  path.join(projectRoot, "app", "(protected)", "app", "attempts", "[attemptId]", "page.tsx"),
  "utf8",
);
const runRouteSource = fs.readFileSync(
  path.join(projectRoot, "app", "(protected)", "app", "attempts", "[attemptId]", "run", "page.tsx"),
  "utf8",
);
const reportRouteSource = fs.readFileSync(
  path.join(projectRoot, "app", "(protected)", "app", "attempts", "[attemptId]", "report", "page.tsx"),
  "utf8",
);
const wrapperExecutionSource = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-assessment-execution.ts"),
  "utf8",
);

assert.match(candidateAttemptsSource, /export function buildGenericCandidateAttemptAccessResult/);
assert.match(candidateAttemptsSource, /isTeamDynamicsTestSlug\(attempt\.tests\?\.slug\)/);
assert.match(candidateAttemptsSource, /reason: "team_dynamics_requires_wrapper"/);
assert.match(candidateAttemptsSource, /export async function getGenericCandidateAttemptForUser/);
assert.match(wrapperExecutionSource, /export async function loadTeamAssessmentExecutionContext/);

assert.match(introRouteSource, /getGenericCandidateAttemptForUser/);
assert.match(runRouteSource, /getGenericCandidateAttemptForUser/);
assert.match(reportRouteSource, /getGenericCandidateAttemptForUser/);

const teamDynamicsOwnedAttempt = {
  id: "attempt-td-1",
  test_id: "test-team-dynamics",
  locale: "bs",
  user_id: "user-1",
  organization_id: "org-1",
  participant_id: "participant-1",
  status: "in_progress",
  lifecycle: "in_progress",
  started_at: "2026-05-22T12:00:00.000Z",
  scored_started_at: null,
  completed_at: null,
  total_time_seconds: null,
  responseCount: 0,
  tests: {
    slug: "team_dynamics_v1_strong",
    name: "Procjena timske dinamike",
    description: null,
    duration_minutes: null,
  },
  participants: {
    id: "participant-1",
    organization_id: "org-1",
    full_name: "Amina",
    email: "amina@example.com",
  },
  organizations: {
    name: "Org 1",
    slug: "org-1",
  },
};

assert.deepEqual(buildGenericCandidateAttemptAccessResult(teamDynamicsOwnedAttempt), {
  ok: false,
  reason: "team_dynamics_requires_wrapper",
});

const ipipOwnedAttempt = {
  ...teamDynamicsOwnedAttempt,
  id: "attempt-ipip-1",
  test_id: "test-ipip",
  tests: {
    slug: "ipip-neo-120-v1",
    name: "IPIP NEO 120",
    description: null,
    duration_minutes: 20,
  },
};

assert.deepEqual(buildGenericCandidateAttemptAccessResult(ipipOwnedAttempt), {
  ok: true,
  attempt: ipipOwnedAttempt,
});

assert.equal(canUseGenericCandidateAttemptCreation("team_dynamics_v1_strong"), false);
assert.equal(canUseGenericCandidateAttemptCreation("ipip-neo-120-v1"), true);
assert.equal(typeof getGenericCandidateAttemptForUser, "function");

console.log("Team Dynamics direct attempt route block tests passed.");
