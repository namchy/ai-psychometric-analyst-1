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
  buildTeamAssessmentBlockOutline,
  buildTeamAssessmentQuestionOutline,
  buildTeamAssessmentRunHandoff,
  buildTeamAssessmentUiOnlyItems,
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
const componentPath = path.join(
  projectRoot,
  "components",
  "assessment",
  "team-dynamics-run-ui-skeleton.tsx",
);

assert.equal(fs.existsSync(routePath), true, "Expected Team Dynamics run route file to exist.");
assert.equal(fs.existsSync(componentPath), true, "Expected Team Dynamics run UI skeleton file to exist.");

const routeSource = fs.readFileSync(routePath, "utf8");
const componentSource = fs.readFileSync(componentPath, "utf8");
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
assert.match(routeSource, /TeamDynamicsRunUiSkeleton/);

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
assert.doesNotMatch(routeSource, /saveAssessmentProgress/);
assert.doesNotMatch(routeSource, /fetch\(/);
assert.doesNotMatch(routeSource, /answer options/i);

assert.match(routeSource, /Procjena timske dinamike/);
assert.match(routeSource, /handoff\.placeholderTitle/);
assert.match(routeSource, /handoff\.placeholderMessage/);
assert.match(routeSource, /handoff\.packageSlug/);
assert.match(routeSource, /handoff\.attemptStatus/);
assert.match(routeSource, /handoff\.activeQuestionCount/);
assert.match(routeSource, /handoff\.blockOutlineCount/);
assert.match(routeSource, /handoff\.questionOutlineCount/);
assert.match(routeSource, /handoff\.uiOnlyItems/);
assert.match(routeSource, /handoff\.uiOnlyItemCount/);
assert.match(routeSource, /handoff\.uiOnlySkeletonMode/);
assert.match(routeSource, /handoff\.savedSelectedOptionIdsByQuestionId/);
assert.match(routeSource, /handoff\.savedAnswerQuestionIds/);
assert.match(routeSource, /handoff\.savedAnswerCount/);
assert.match(routeSource, /handoff\.completionReadiness/);
assert.match(routeSource, /teamAssessmentParticipantId=\{handoff\.teamAssessmentParticipantId\}/);
assert.match(routeSource, /Podaci za rjesavanje su pripremljeni\./);
assert.match(routeSource, /Rjesavanje procjene jos nije omoguceno u ovoj verziji\./);
assert.match(routeSource, /Sekcije su pripremljene za sljedeci korak:/);
assert.match(routeSource, /Pitanja su pripremljena za sljedeci korak:/);

assert.match(componentSource, /"use client"/);
assert.match(componentSource, /useState/);
assert.match(componentSource, /startTransition/);
assert.match(componentSource, /completeTeamAssessmentAction/);
assert.match(componentSource, /saveTeamAssessmentAnswerAction/);
assert.match(componentSource, /savedSelectedOptionIdsByQuestionId/);
assert.match(componentSource, /savedAnswerQuestionIds/);
assert.match(componentSource, /savedAnswerCount/);
assert.match(componentSource, /completionReadiness/);
assert.match(componentSource, /Sacuvani napredak:/);
assert.match(componentSource, /Completion readiness jos nije postignut/);
assert.match(componentSource, /Pitanje \{safeIndex \+ 1\} od \{props\.uiOnlyItemCount\}/);
assert.match(componentSource, /Prethodno/);
assert.match(componentSource, /Sljedece/);
assert.match(componentSource, /Spremi odgovor/);
assert.match(componentSource, /Završi procjenu/);
assert.match(componentSource, /disabled=\{isSaveDisabled\}/);
assert.match(componentSource, /currentSaveState/);
assert.match(componentSource, /saveStateByQuestionId/);
assert.match(componentSource, /"idle" \| "loaded" \| "saving" \| "saved" \| "overwritten" \| "unchanged" \| "error"/);
assert.match(componentSource, /Ucitano\./);
assert.match(componentSource, /Navigacija ostaje lokalna, a odgovor za trenutno pitanje se sprema samo kada kliknes/);
assert.match(componentSource, /Nema autosave-a, save-on-selecta,\s*submitovanja ni scoring-a/);
assert.doesNotMatch(componentSource, /AssessmentForm/);
assert.doesNotMatch(componentSource, /saveAssessmentProgress/);
assert.doesNotMatch(componentSource, /completeAssessmentAttempt/);
assert.doesNotMatch(componentSource, /fetch\(/);
assert.doesNotMatch(componentSource, /attemptId/);
assert.doesNotMatch(componentSource, /Team Fit/);
assert.doesNotMatch(componentSource, /autosave copy/i);
assert.doesNotMatch(componentSource, /Submit/);

assert.match(helperSource, /export function buildTeamAssessmentExecutionStartedPatch/);
assert.match(helperSource, /export function buildTeamAssessmentBlockOutline/);
assert.match(helperSource, /export function buildTeamAssessmentQuestionOutline/);
assert.match(helperSource, /export function buildTeamAssessmentRunHandoff/);
assert.match(helperSource, /export function buildTeamAssessmentUiOnlyItems/);
assert.match(helperSource, /export async function markTeamAssessmentExecutionStartedIfInvited/);
assert.match(helperSource, /export async function loadTeamAssessmentQuestionOutline/);
assert.match(helperSource, /export async function loadTeamAssessmentRunHandoff/);
assert.match(helperSource, /export async function loadTeamAssessmentUiOnlyItems/);
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

const helperOutline = {
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
};

assert.deepEqual(
  buildTeamAssessmentUiOnlyItems({
    questionOutline: helperOutline,
    locale: "bs",
    questions: [
      {
        id: "question-1",
        text: "Fallback 1",
        question_order: 1,
        question_type: "single_choice",
      },
      {
        id: "question-2",
        text: "Fallback 2",
        question_order: 2,
        question_type: "single_choice",
      },
    ],
    options: [
      {
        id: "option-2",
        question_id: "question-1",
        label: "Fallback option 2",
        option_order: 2,
      },
      {
        id: "option-1",
        question_id: "question-1",
        label: "Fallback option 1",
        option_order: 1,
      },
      {
        id: "option-4",
        question_id: "question-2",
        label: "Fallback option 4",
        option_order: 2,
      },
      {
        id: "option-3",
        question_id: "question-2",
        label: "Fallback option 3",
        option_order: 1,
      },
    ],
    optionLocalizations: [
      {
        answer_option_id: "option-1",
        locale: "bs",
        label: "Lokalizovana opcija 1",
      },
      {
        answer_option_id: "option-2",
        locale: "bs",
        label: "Lokalizovana opcija 2",
      },
      {
        answer_option_id: "option-3",
        locale: "bs",
        label: "Lokalizovana opcija 3",
      },
      {
        answer_option_id: "option-4",
        locale: "bs",
        label: "Lokalizovana opcija 4",
      },
    ],
  }),
  {
    items: [
      {
        mode: "ui_only_ready",
        questionId: "question-1",
        order: 1,
        localizedTitle: "[LICENSED_ITEM_PLACEHOLDER_1]",
        localizedStem: "[LICENSED_ITEM_PLACEHOLDER_1]",
        optionIds: ["option-1", "option-2"],
        options: [
          {
            id: "option-1",
            label: "Lokalizovana opcija 1",
            order: 1,
          },
          {
            id: "option-2",
            label: "Lokalizovana opcija 2",
            order: 2,
          },
        ],
        locale: "bs",
        isUiOnlySkeleton: true,
      },
      {
        mode: "ui_only_ready",
        questionId: "question-2",
        order: 2,
        localizedTitle: "[LICENSED_ITEM_PLACEHOLDER_2]",
        localizedStem: "[LICENSED_ITEM_PLACEHOLDER_2]",
        optionIds: ["option-3", "option-4"],
        options: [
          {
            id: "option-3",
            label: "Lokalizovana opcija 3",
            order: 1,
          },
          {
            id: "option-4",
            label: "Lokalizovana opcija 4",
            order: 2,
          },
        ],
        locale: "bs",
        isUiOnlySkeleton: true,
      },
    ],
    itemCount: 2,
    unsupportedCount: 0,
    mode: "ready",
  },
);

assert.deepEqual(
  buildTeamAssessmentBlockOutline({
    testName: "Procjena timske dinamike",
    questionOutline: {
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
  }),
  [
    {
      id: "default",
      order: 1,
      title: "Procjena timske dinamike",
      questionCount: 2,
      questionIds: ["question-1", "question-2"],
    },
  ],
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
    blockOutline: [
      {
        id: "default",
        order: 1,
        title: "Procjena timske dinamike",
        questionCount: 36,
        questionIds: Array.from({ length: 36 }, (_, index) => `question-${index + 1}`),
      },
    ],
    uiOnlyItems: [
      {
        mode: "ui_only_ready",
        questionId: "question-1",
        order: 1,
        localizedTitle: "[LICENSED_ITEM_PLACEHOLDER_1]",
        localizedStem: "[LICENSED_ITEM_PLACEHOLDER_1]",
        optionIds: ["option-1", "option-2"],
        options: [
          {
            id: "option-1",
            label: "Opcija 1",
            order: 1,
          },
          {
            id: "option-2",
            label: "Opcija 2",
            order: 2,
          },
        ],
        locale: "bs",
        isUiOnlySkeleton: true,
      },
      {
        mode: "ui_only_ready",
        questionId: "question-2",
        order: 2,
        localizedTitle: "[LICENSED_ITEM_PLACEHOLDER_2]",
        localizedStem: "[LICENSED_ITEM_PLACEHOLDER_2]",
        optionIds: ["option-3", "option-4"],
        options: [
          {
            id: "option-3",
            label: "Opcija 3",
            order: 1,
          },
          {
            id: "option-4",
            label: "Opcija 4",
            order: 2,
          },
        ],
        locale: "bs",
        isUiOnlySkeleton: true,
      },
    ],
    uiOnlyItemCount: 2,
    uiOnlyUnsupportedCount: 0,
    uiOnlySkeletonMode: "ready",
    savedSelectedOptionIdsByQuestionId: {
      "question-2": "option-4",
    },
    savedAnswerQuestionIds: ["question-2"],
    savedAnswerCount: 1,
    completionReadiness: {
      supportedQuestionCount: 2,
      savedValidAnswerCount: 1,
      missingQuestionIds: ["question-1"],
      invalidSavedAnswerCount: 0,
      isReadyForCompletion: false,
      readinessStatus: "not_ready",
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
    blockOutlineCount: 1,
    questionCountMatchesBlockOutline: true,
    blockOutline: [
      {
        id: "default",
        order: 1,
        title: "Procjena timske dinamike",
        questionCount: 36,
        questionIds: Array.from({ length: 36 }, (_, index) => `question-${index + 1}`),
      },
    ],
    uiOnlyItems: [
      {
        mode: "ui_only_ready",
        questionId: "question-1",
        order: 1,
        localizedTitle: "[LICENSED_ITEM_PLACEHOLDER_1]",
        localizedStem: "[LICENSED_ITEM_PLACEHOLDER_1]",
        optionIds: ["option-1", "option-2"],
        options: [
          {
            id: "option-1",
            label: "Opcija 1",
            order: 1,
          },
          {
            id: "option-2",
            label: "Opcija 2",
            order: 2,
          },
        ],
        locale: "bs",
        isUiOnlySkeleton: true,
      },
      {
        mode: "ui_only_ready",
        questionId: "question-2",
        order: 2,
        localizedTitle: "[LICENSED_ITEM_PLACEHOLDER_2]",
        localizedStem: "[LICENSED_ITEM_PLACEHOLDER_2]",
        optionIds: ["option-3", "option-4"],
        options: [
          {
            id: "option-3",
            label: "Opcija 3",
            order: 1,
          },
          {
            id: "option-4",
            label: "Opcija 4",
            order: 2,
          },
        ],
        locale: "bs",
        isUiOnlySkeleton: true,
      },
    ],
    uiOnlyItemCount: 2,
    uiOnlyUnsupportedCount: 0,
    uiOnlySkeletonMode: "ready",
    savedSelectedOptionIdsByQuestionId: {
      "question-2": "option-4",
    },
    savedAnswerQuestionIds: ["question-2"],
    savedAnswerCount: 1,
    completionReadiness: {
      supportedQuestionCount: 2,
      savedValidAnswerCount: 1,
      missingQuestionIds: ["question-1"],
      invalidSavedAnswerCount: 0,
      isReadyForCompletion: false,
      readinessStatus: "not_ready",
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
