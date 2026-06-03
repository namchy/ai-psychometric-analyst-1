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
  buildStandardAssessmentAssignmentInsert,
  buildAssignmentAttemptLinks,
} = require("../lib/assessment/assignments.ts");
const {
  planStandardAssessmentBatteryCreation,
} = require("../lib/assessment/standard-battery.ts");

const assignmentInsert = buildStandardAssessmentAssignmentInsert({
  organizationId: "org-1",
  participantId: "participant-1",
  locale: "hr",
  createdByUserId: "user-1",
});

assert.deepEqual(assignmentInsert, {
  organization_id: "org-1",
  participant_id: "participant-1",
  assignment_type: "standard_battery",
  status: "active",
  locale: "hr",
  created_by_user_id: "user-1",
  metadata: {},
});

const batteryPlan = planStandardAssessmentBatteryCreation({
  availableTests: [
    { id: "test-ipip", slug: "ipip-neo-120-v1", status: "active", is_active: true },
    { id: "test-safran", slug: "safran_v1", status: "active", is_active: true },
    { id: "test-mwms", slug: "mwms_v1", status: "active", is_active: true },
  ],
  activeQuestionTestIds: ["test-ipip", "test-safran", "test-mwms"],
  existingAttempts: [
    { id: "old-completed-ipip", test_id: "test-ipip", status: "completed" },
    { id: "old-in-progress-safran", test_id: "test-safran", status: "in_progress" },
  ],
  organizationId: "org-1",
  participantId: "participant-1",
  participantUserId: "user-1",
  locale: "bs",
  startedAt: "2026-05-12T10:00:00.000Z",
});

assert.deepEqual(
  batteryPlan.attemptsToInsert.map((attempt) => attempt.test_id),
  ["test-safran", "test-mwms"],
);
assert.deepEqual(batteryPlan.attemptIdsToAbandon, ["old-in-progress-safran"]);

const links = buildAssignmentAttemptLinks({
  assignmentId: "assignment-1",
  attempts: [
    { id: "attempt-1", test_id: "test-ipip", test_slug: "ipip-neo-120-v1" },
    { id: "attempt-2", test_id: "test-safran", test_slug: "safran_v1" },
    { id: "attempt-3", test_id: "test-mwms", test_slug: "mwms_v1" },
  ],
});

assert.deepEqual(links, [
  {
    assessment_assignment_id: "assignment-1",
    attempt_id: "attempt-1",
    test_id: "test-ipip",
    test_slug: "ipip-neo-120-v1",
    role_in_assignment: "standard_component",
    required_for_composite: true,
    required_for_team_fit: false,
    position: 0,
    metadata: {},
  },
  {
    assessment_assignment_id: "assignment-1",
    attempt_id: "attempt-2",
    test_id: "test-safran",
    test_slug: "safran_v1",
    role_in_assignment: "standard_component",
    required_for_composite: true,
    required_for_team_fit: false,
    position: 1,
    metadata: {},
  },
  {
    assessment_assignment_id: "assignment-1",
    attempt_id: "attempt-3",
    test_id: "test-mwms",
    test_slug: "mwms_v1",
    role_in_assignment: "standard_component",
    required_for_composite: true,
    required_for_team_fit: false,
    position: 2,
    metadata: {},
  },
]);

console.log("Assessment assignment helper tests passed.");
