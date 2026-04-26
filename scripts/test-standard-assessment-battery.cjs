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
  STANDARD_ASSESSMENT_BATTERY_SLUGS,
  planStandardAssessmentBatteryCreation,
} = require("../lib/assessment/standard-battery.ts");

const STARTED_AT = "2026-04-24T10:00:00.000Z";
const ORGANIZATION_ID = "org-1";
const PARTICIPANT_ID = "participant-1";
const PARTICIPANT_USER_ID = "user-1";

assert.deepEqual(STANDARD_ASSESSMENT_BATTERY_SLUGS, [
  "ipip-neo-120-v1",
  "safran_v1",
  "mwms_v1",
]);

const availableTests = [
  {
    id: "test-ipip",
    slug: "ipip-neo-120-v1",
    status: "active",
    is_active: true,
    hasOrganizationAccess: false,
  },
  {
    id: "test-safran",
    slug: "safran_v1",
    status: "active",
    is_active: true,
    hasOrganizationAccess: false,
  },
  {
    id: "test-mwms",
    slug: "mwms_v1",
    status: "active",
    is_active: true,
    hasOrganizationAccess: false,
  },
];

const initialPlan = planStandardAssessmentBatteryCreation({
  availableTests,
  activeQuestionTestIds: ["test-ipip", "test-safran", "test-mwms"],
  existingAttempts: [],
  organizationId: ORGANIZATION_ID,
  participantId: PARTICIPANT_ID,
  participantUserId: PARTICIPANT_USER_ID,
  locale: "de",
  startedAt: STARTED_AT,
});

assert.equal(initialPlan.outcome, "battery-created");
assert.equal(initialPlan.locale, "bs");
assert.deepEqual(initialPlan.attemptIdsToAbandon, []);
assert.deepEqual(
  initialPlan.runnableTests.map((test) => test.slug),
  ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
);
assert.deepEqual(
  initialPlan.attemptsToInsert.map((attempt) => ({
    organization_id: attempt.organization_id,
    participant_id: attempt.participant_id,
    test_id: attempt.test_id,
    locale: attempt.locale,
    user_id: attempt.user_id,
    status: attempt.status,
    started_at: attempt.started_at,
  })),
  [
    {
      organization_id: ORGANIZATION_ID,
      participant_id: PARTICIPANT_ID,
      test_id: "test-ipip",
      locale: "bs",
      user_id: PARTICIPANT_USER_ID,
      status: "in_progress",
      started_at: STARTED_AT,
    },
    {
      organization_id: ORGANIZATION_ID,
      participant_id: PARTICIPANT_ID,
      test_id: "test-safran",
      locale: "bs",
      user_id: PARTICIPANT_USER_ID,
      status: "in_progress",
      started_at: STARTED_AT,
    },
    {
      organization_id: ORGANIZATION_ID,
      participant_id: PARTICIPANT_ID,
      test_id: "test-mwms",
      locale: "bs",
      user_id: PARTICIPANT_USER_ID,
      status: "in_progress",
      started_at: STARTED_AT,
    },
  ],
);

const replacementRoundPlan = planStandardAssessmentBatteryCreation({
  availableTests,
  activeQuestionTestIds: ["test-ipip", "test-safran", "test-mwms"],
  existingAttempts: [
    { id: "attempt-ipip-1", test_id: "test-ipip", status: "in_progress" },
    { id: "attempt-safran-completed", test_id: "test-safran", status: "completed" },
  ],
  organizationId: ORGANIZATION_ID,
  participantId: PARTICIPANT_ID,
  participantUserId: PARTICIPANT_USER_ID,
  locale: "hr",
  startedAt: STARTED_AT,
});

assert.equal(replacementRoundPlan.outcome, "battery-created");
assert.equal(replacementRoundPlan.locale, "hr");
assert.deepEqual(replacementRoundPlan.attemptIdsToAbandon, ["attempt-ipip-1"]);
assert.deepEqual(
  replacementRoundPlan.attemptsToInsert.map((attempt) => attempt.test_id),
  ["test-ipip", "test-safran", "test-mwms"],
);

const multipleInProgressPlan = planStandardAssessmentBatteryCreation({
  availableTests,
  activeQuestionTestIds: ["test-ipip", "test-safran", "test-mwms"],
  existingAttempts: [
    { id: "attempt-ipip-1", test_id: "test-ipip", status: "in_progress" },
    { id: "attempt-ipip-2", test_id: "test-ipip", status: "in_progress" },
    { id: "attempt-safran-completed", test_id: "test-safran", status: "completed" },
    { id: "attempt-mwms-1", test_id: "test-mwms", status: "in_progress" },
  ],
  organizationId: ORGANIZATION_ID,
  participantId: PARTICIPANT_ID,
  participantUserId: PARTICIPANT_USER_ID,
  locale: "bs",
  startedAt: STARTED_AT,
});

assert.deepEqual(multipleInProgressPlan.attemptIdsToAbandon, [
  "attempt-ipip-1",
  "attempt-ipip-2",
  "attempt-mwms-1",
]);
assert.deepEqual(
  multipleInProgressPlan.attemptsToInsert.map((attempt) => attempt.test_id),
  ["test-ipip", "test-safran", "test-mwms"],
);

const noRunnablePlan = planStandardAssessmentBatteryCreation({
  availableTests,
  activeQuestionTestIds: [],
  existingAttempts: [],
  organizationId: ORGANIZATION_ID,
  participantId: PARTICIPANT_ID,
  participantUserId: PARTICIPANT_USER_ID,
  locale: "bs",
  startedAt: STARTED_AT,
});

assert.equal(noRunnablePlan.outcome, "battery-no-runnable-tests");
assert.deepEqual(noRunnablePlan.runnableTests, []);
assert.deepEqual(noRunnablePlan.attemptIdsToAbandon, []);
assert.deepEqual(noRunnablePlan.attemptsToInsert, []);

console.log("Standard assessment battery tests passed.");
