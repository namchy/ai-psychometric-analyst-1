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
  buildTeamAssessmentQuestionOutline,
  buildTeamAssessmentRunHandoff,
  resolveTeamAssessmentExecutionShellState,
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
assert.match(routeSource, /loadTeamAssessmentRunHandoff/);
assert.match(routeSource, /markTeamAssessmentExecutionStartedIfInvited/);
assert.match(routeSource, /resolveTeamAssessmentExecutionShellState/);
assert.match(routeSource, /requireAuthenticatedUser/);
assert.match(routeSource, /teamAssessmentParticipantId: params\.teamAssessmentParticipantId/);
assert.match(routeSource, /userId: user\.id/);
assert.match(routeSource, /if \(!access\.ok\) \{\s+notFound\(\);\s+\}/);
assert.match(routeSource, /route: "run"/);
assert.match(routeSource, /if \(shellState\.shouldTransitionToStarted\)/);
assert.match(routeSource, /wrapperStatus = transition\.status/);
assert.match(routeSource, /shellState = resolveTeamAssessmentExecutionShellState/);
assert.match(routeSource, /const handoff = await loadTeamAssessmentRunHandoff/);

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
assert.doesNotMatch(routeSource, /questions=/);
assert.doesNotMatch(routeSource, /questionOutline\.questions/);
assert.doesNotMatch(routeSource, /localizedTitle/);
assert.doesNotMatch(routeSource, /localizedStem/);
assert.doesNotMatch(routeSource, /answer options/i);

assert.match(routeSource, /Procjena timske dinamike/);
assert.match(routeSource, /handoff\.placeholderTitle/);
assert.match(routeSource, /handoff\.placeholderMessage/);
assert.match(routeSource, /handoff\.packageSlug/);
assert.match(routeSource, /handoff\.attemptStatus/);
assert.match(routeSource, /handoff\.activeQuestionCount/);
assert.match(routeSource, /handoff\.questionOutlineCount/);
assert.match(routeSource, /Podaci za rjesavanje su pripremljeni\./);
assert.match(routeSource, /Rjesavanje procjene jos nije omoguceno u ovoj verziji\./);
assert.match(routeSource, /Pitanja su pripremljena za sljedeci korak:/);

assert.match(helperSource, /export function buildTeamAssessmentExecutionStartedPatch/);
assert.match(helperSource, /export function buildTeamAssessmentQuestionOutline/);
assert.match(helperSource, /export function buildTeamAssessmentRunHandoff/);
assert.match(helperSource, /export async function markTeamAssessmentExecutionStartedIfInvited/);
assert.match(helperSource, /export async function loadTeamAssessmentQuestionOutline/);
assert.match(helperSource, /export async function loadTeamAssessmentRunHandoff/);
assert.match(helperSource, /export function resolveTeamAssessmentExecutionShellState/);
assert.match(helperSource, /\.from\("team_assessment_participants"\)/);
assert.match(helperSource, /\.from\("questions"\)/);
assert.match(helperSource, /\.from\("question_localizations"\)/);

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

assert.deepEqual(
  resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus: "invited",
  }),
  {
    kind: "run_invited",
    route: "run",
    wrapperStatus: "invited",
    isRunnable: true,
    shouldTransitionToStarted: true,
    title: "Rješavanje procjene još nije omogućeno u ovoj verziji.",
    message:
      "Ulaz u ovaj prostor označava početak execution konteksta, ali pitanja i rješavanje još nisu omogućeni u ovoj verziji.",
  },
);

assert.deepEqual(
  resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus: "started",
  }),
  {
    kind: "run_started",
    route: "run",
    wrapperStatus: "started",
    isRunnable: true,
    shouldTransitionToStarted: false,
    title: "Rješavanje procjene još nije omogućeno u ovoj verziji.",
    message:
      "Execution prostor je otvoren, ali pitanja i rješavanje još nisu omogućeni u ovoj verziji.",
  },
);

assert.deepEqual(
  resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus: "completed",
  }),
  {
    kind: "run_completed",
    route: "run",
    wrapperStatus: "completed",
    isRunnable: false,
    shouldTransitionToStarted: false,
    title: "Ova procjena je već završena.",
    message: "Ovdje će kasnije biti dostupan siguran pregled narednih koraka za timsku procjenu.",
  },
);

assert.deepEqual(
  resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus: "expired",
  }),
  {
    kind: "run_expired",
    route: "run",
    wrapperStatus: "expired",
    isRunnable: false,
    shouldTransitionToStarted: false,
    title: "Ova procjena više nije dostupna.",
    message: "Execution prostor za ovu timsku procjenu je istekao u ovoj verziji.",
  },
);

assert.deepEqual(
  resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus: "unexpected_status",
  }),
  {
    kind: "unavailable",
    route: "run",
    wrapperStatus: "unexpected_status",
    isRunnable: false,
    shouldTransitionToStarted: false,
    title: "Ova procjena trenutno nije dostupna.",
    message: "Status wrappera nije podržan za siguran pristup execution prostoru.",
  },
);

assert.deepEqual(
  buildTeamAssessmentQuestionOutline({
    questions: [
      {
        id: "question-2",
        text: "Fallback 2",
        question_order: 2,
      },
      {
        id: "question-1",
        text: "Fallback 1",
        question_order: 1,
      },
    ],
    localizations: [
      {
        question_id: "question-1",
        locale: "bs",
        text: "[LICENSED_ITEM_PLACEHOLDER_1]",
      },
      {
        question_id: "question-2",
        locale: "bs",
        text: "[LICENSED_ITEM_PLACEHOLDER_2]",
      },
    ],
    locale: "bs",
  }),
  {
    orderedQuestionIds: ["question-1", "question-2"],
    questions: [
      {
        id: "question-1",
        order: 1,
        localizedTitle: "[LICENSED_ITEM_PLACEHOLDER_1]",
        localizedStem: "[LICENSED_ITEM_PLACEHOLDER_1]",
        locale: "bs",
      },
      {
        id: "question-2",
        order: 2,
        localizedTitle: "[LICENSED_ITEM_PLACEHOLDER_2]",
        localizedStem: "[LICENSED_ITEM_PLACEHOLDER_2]",
        locale: "bs",
      },
    ],
    locale: "bs",
    count: 2,
  },
);

assert.deepEqual(
  buildTeamAssessmentRunHandoff({
    context: {
      teamAssessmentParticipantId: "tap-1",
      teamAssessmentAssignmentId: "assignment-1",
      teamMembershipId: "membership-1",
      participantId: "participant-1",
      attemptId: "attempt-1",
      teamId: "team-1",
      organizationId: "org-1",
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
    activeQuestionCount: 36,
    questionOutline: {
      orderedQuestionIds: Array.from({ length: 36 }, (_, index) => `question-${index + 1}`),
      questions: Array.from({ length: 36 }, (_, index) => ({
        id: `question-${index + 1}`,
        order: index + 1,
        localizedTitle: `[LICENSED_ITEM_PLACEHOLDER_${index + 1}]`,
        localizedStem: `[LICENSED_ITEM_PLACEHOLDER_${index + 1}]`,
        locale: "bs",
      })),
      locale: "bs",
      count: 36,
    },
  }),
  {
    teamAssessmentParticipantId: "tap-1",
    teamAssessmentAssignmentId: "assignment-1",
    attemptId: "attempt-1",
    packageSlug: "team_dynamics_v1_strong",
    wrapperStatus: "started",
    attemptStatus: "in_progress",
    testSlug: "team_dynamics_v1_strong",
    testName: "Procjena timske dinamike",
    activeQuestionCount: 36,
    questionOutlineCount: 36,
    questionCountMatchesActive: true,
    questionOutline: {
      orderedQuestionIds: Array.from({ length: 36 }, (_, index) => `question-${index + 1}`),
      questions: Array.from({ length: 36 }, (_, index) => ({
        id: `question-${index + 1}`,
        order: index + 1,
        localizedTitle: `[LICENSED_ITEM_PLACEHOLDER_${index + 1}]`,
        localizedStem: `[LICENSED_ITEM_PLACEHOLDER_${index + 1}]`,
        locale: "bs",
      })),
      locale: "bs",
      count: 36,
    },
    isRunnableShellState: true,
    handoffState: "ready_placeholder",
    warningCode: null,
    statusLabel: "Započeto",
    placeholderTitle: "Rješavanje procjene još nije omogućeno u ovoj verziji.",
    placeholderMessage:
      "Execution prostor je otvoren, ali pitanja i rješavanje još nisu omogućeni u ovoj verziji.",
  },
);

console.log("Team Dynamics run route shell tests passed.");
