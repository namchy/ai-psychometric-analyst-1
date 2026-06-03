const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const actionPath = path.join(projectRoot, "app", "actions", "team-assessments.ts");
const actionSource = fs.readFileSync(actionPath, "utf8");
const replaceActionStart = actionSource.indexOf(
  "export async function replaceTeamDynamicsReportSelectionInclusionAction",
);
const queueActionStart = actionSource.indexOf(
  "export async function queueTeamDynamicsReportAction",
);
const nextBlockAfterQueueStart = actionSource.indexOf(
  "function getUnsupportedTeamDynamicsReportKindMessage",
);
const selectionActionSource =
  replaceActionStart >= 0 && queueActionStart > replaceActionStart
    ? actionSource.slice(replaceActionStart, queueActionStart)
    : actionSource;
const queueActionSource =
  queueActionStart >= 0 && nextBlockAfterQueueStart > queueActionStart
    ? actionSource.slice(queueActionStart, nextBlockAfterQueueStart)
    : actionSource;

assert.match(
  selectionActionSource,
  /export async function replaceTeamDynamicsReportSelectionInclusionAction/,
);
assert.match(selectionActionSource, /replaceTeamDynamicsReportSelectionInclusionSet/);
assert.match(selectionActionSource, /getTeamDynamicsReportSelectionReadModelForOrganization/);
assert.match(selectionActionSource, /TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG/);
assert.doesNotMatch(selectionActionSource, /attempt_reports/);
assert.doesNotMatch(selectionActionSource, /assessment_reports/);
assert.doesNotMatch(selectionActionSource, /persistTeamDynamicsMixedScoreForContext/);
assert.doesNotMatch(selectionActionSource, /loadTeamDynamicsFinalAggregation/);
assert.doesNotMatch(selectionActionSource, /AI generation/i);
assert.doesNotMatch(selectionActionSource, /report generation/i);

assert.match(queueActionSource, /export async function queueTeamDynamicsReportAction/);
assert.match(queueActionSource, /queueTeamDynamicsReportShell/);
assert.doesNotMatch(queueActionSource, /attempt_reports/);
assert.doesNotMatch(queueActionSource, /assessment_reports/);
assert.doesNotMatch(queueActionSource, /persistTeamDynamicsMixedScoreForContext/);
assert.doesNotMatch(queueActionSource, /refreshTeamAssessmentAggregationSnapshot/);
assert.doesNotMatch(queueActionSource, /OpenAI|AI provider|renderer|worker|Team Fit/i);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "team-dynamics-selection-action-"));
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const authStubPath = path.join(tmpDir, "auth-session.cjs");
const teamDynamicsStubPath = path.join(tmpDir, "team-dynamics.cjs");
const originalResolveFilename = Module._resolveFilename;

fs.writeFileSync(
  authStubPath,
  `
class AuthenticationRequiredError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

module.exports = {
  AuthenticationRequiredError,
  requireAuthenticatedUserForAction: async () => ({ id: "user-default" }),
};
`,
);

fs.writeFileSync(
  teamDynamicsStubPath,
  'module.exports = { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG: "team_dynamics_assessment_v1" };',
);

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
  if (request === "@/lib/auth/session") {
    return authStubPath;
  }

  if (request === "@/lib/assessment/team-dynamics") {
    return teamDynamicsStubPath;
  }

  if (
    request === "server-only" ||
    request === "@/lib/b2b/organizations" ||
    request === "@/lib/b2b/team-dynamics-report-selection" ||
    request === "@/lib/b2b/team-dynamics-report-selection-inclusion" ||
    request === "@/lib/b2b/team-dynamics-report-lifecycle" ||
    request === "@/lib/assessment/team-assessments" ||
    request === "@/lib/assessment/team-assessment-execution" ||
    request === "@/lib/assessment/team-assessment-score-persistence" ||
    request === "@/lib/assessment/team-assessment-responses" ||
    request === "@/lib/assessment/locale" ||
    request === "@/lib/assessment/team-dynamics-action-contract" ||
    request === "@/lib/assessment/team-dynamics-mixed-answer-persistence" ||
    request === "@/lib/assessment/team-dynamics-mixed-score-persistence" ||
    request === "@/lib/assessment/team-dynamics-mixed-answer-payload-validator" ||
    request === "@/lib/assessment/team-dynamics-mixed-completion-readiness" ||
    request === "@/lib/assessment/team-dynamics-mixed-runtime" ||
    request === "@/lib/supabase/admin"
  ) {
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
  replaceTeamDynamicsReportSelectionInclusionAction,
  queueTeamDynamicsReportAction,
} = require(actionPath);
const { AuthenticationRequiredError } = require(authStubPath);

function buildMember(id, status = "completed", scoreReadinessStatus = "ready") {
  return {
    teamAssessmentParticipantId: id,
    teamMembershipId: `membership-${id}`,
    participantId: `participant-${id}`,
    fullName: `Member ${id}`,
    email: `${id}@example.com`,
    role: "member",
    status,
    invitedAt: "2026-05-28T09:00:00.000Z",
    startedAt: "2026-05-28T09:05:00.000Z",
    completedAt: status === "completed" ? "2026-05-28T09:30:00.000Z" : null,
    joinedAt: "2026-05-28T08:00:00.000Z",
    scoreReadinessStatus,
    eligibleForReport: status === "completed" && scoreReadinessStatus === "ready",
    blockingReason:
      status === "completed"
        ? scoreReadinessStatus === "ready"
          ? null
          : `score_${scoreReadinessStatus}`
        : `member_not_completed:${status}`,
  };
}

function buildSelection(teamAssessmentAssignmentId, includedIds, availableIds) {
  return {
    teamId: "team-1",
    teamAssessmentAssignmentId,
    hasPersistedSelectionDraft: true,
    selectionDraftId: "draft-1",
    includedMembers: includedIds.map((id) => buildMember(id)),
    availableMembers: availableIds.map((id) => buildMember(id)),
    selectedCount: includedIds.length,
    minRequiredMembers: 4,
    recommendedMaxMembers: 10,
    warningMaxMembers: 15,
    hardMaxMembers: 15,
    teamSizeStatus: includedIds.length < 4 ? "too_few" : "ideal",
    canCreateTeamReport: includedIds.length >= 4,
    disabledReasons:
      includedIds.length < 4 ? ["minimum_selected_members_not_met"] : [],
  };
}

function createHarness() {
  let currentIncludedIds = [];
  const replaceCalls = [];
  const participantLookupCalls = [];
  const state = {
    knownParticipantsById: new Map([
      ["tap-1", { id: "tap-1", teamAssessmentAssignmentId: "assignment-1" }],
      ["tap-2", { id: "tap-2", teamAssessmentAssignmentId: "assignment-1" }],
      ["tap-3", { id: "tap-3", teamAssessmentAssignmentId: "assignment-1" }],
      ["tap-4", { id: "tap-4", teamAssessmentAssignmentId: "assignment-1" }],
      ["tap-5", { id: "tap-5", teamAssessmentAssignmentId: "assignment-1" }],
      ["tap-other", { id: "tap-other", teamAssessmentAssignmentId: "assignment-2" }],
    ]),
  };

  const deps = {
    requireUser: async () => ({ id: "user-1" }),
    getActiveOrganization: async () => ({ id: "org-1", name: "Org 1" }),
    loadAssignmentContext: async ({ teamAssessmentAssignmentId }) => ({
      assignmentId: teamAssessmentAssignmentId,
      teamId: "team-1",
      packageSlug: "team_dynamics_assessment_v1",
      organizationId: "org-1",
      teamArchivedAt: null,
    }),
    loadAssignmentParticipantsByIds: async ({ teamAssessmentParticipantIds }) => {
      participantLookupCalls.push([...teamAssessmentParticipantIds]);
      return teamAssessmentParticipantIds
        .map((id) => state.knownParticipantsById.get(id) ?? null)
        .filter(Boolean);
    },
    replaceSelectionInclusionSet: async (input) => {
      currentIncludedIds = [...input.includedTeamAssessmentParticipantIds];
      replaceCalls.push({
        ...input,
        includedTeamAssessmentParticipantIds: [...input.includedTeamAssessmentParticipantIds],
      });
      return {
        selectionDraftId: "draft-1",
        teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
        includedTeamAssessmentParticipantIds: [...input.includedTeamAssessmentParticipantIds],
        createdAt: "2026-05-28T10:00:00.000Z",
        updatedAt: "2026-05-28T10:05:00.000Z",
      };
    },
    loadSelectionReadModel: async ({ teamAssessmentAssignmentId }) => {
      const allIds = ["tap-1", "tap-2", "tap-3", "tap-4", "tap-5"];
      const availableIds = allIds.filter((id) => currentIncludedIds.includes(id) === false);
      return buildSelection(teamAssessmentAssignmentId, currentIncludedIds, availableIds);
    },
  };

  return {
    deps,
    replaceCalls,
    participantLookupCalls,
    setIncluded(ids) {
      currentIncludedIds = [...ids];
    },
    setAssignmentContext(loader) {
      deps.loadAssignmentContext = loader;
    },
    setParticipantLookup(loader) {
      deps.loadAssignmentParticipantsByIds = loader;
    },
    setRequireUser(loader) {
      deps.requireUser = loader;
    },
    setOrganizationLoader(loader) {
      deps.getActiveOrganization = loader;
    },
  };
}

function createQueueHarness() {
  const queueCalls = [];
  const deps = {
    requireUser: async () => ({ id: "user-1" }),
    getActiveOrganization: async () => ({ id: "org-1", name: "Org 1" }),
    loadAssignmentContext: async ({ teamAssessmentAssignmentId }) => ({
      assignmentId: teamAssessmentAssignmentId,
      teamId: "team-1",
      packageSlug: "team_dynamics_assessment_v1",
      organizationId: "org-1",
      teamArchivedAt: null,
    }),
    queueReportShell: async (input) => {
      queueCalls.push(input);
      return {
        ok: true,
        report: {
          id: "report-1",
        },
      };
    },
  };

  return {
    deps,
    queueCalls,
    setRequireUser(loader) {
      deps.requireUser = loader;
    },
    setOrganizationLoader(loader) {
      deps.getActiveOrganization = loader;
    },
    setAssignmentContext(loader) {
      deps.loadAssignmentContext = loader;
    },
    setQueueReportShell(loader) {
      deps.queueReportShell = loader;
    },
  };
}

Promise.resolve()
  .then(async () => {
    const validHarness = createHarness();
    const validResult = await replaceTeamDynamicsReportSelectionInclusionAction(
      {
        teamAssessmentAssignmentId: "assignment-1",
        includedTeamAssessmentParticipantIds: ["tap-1", "tap-2", "tap-3", "tap-4"],
      },
      validHarness.deps,
    );

    assert.equal(validResult.ok, true);
    assert.deepEqual(validHarness.replaceCalls, [
      {
        organizationId: "org-1",
        teamId: "team-1",
        teamAssessmentAssignmentId: "assignment-1",
        includedTeamAssessmentParticipantIds: ["tap-1", "tap-2", "tap-3", "tap-4"],
        actorUserId: "user-1",
      },
    ]);
    assert.equal(validResult.selection.selectedCount, 4);
    assert.equal(validResult.selection.canCreateTeamReport, true);
    assert.deepEqual(
      validResult.selection.includedMembers.map((member) => member.teamAssessmentParticipantId),
      ["tap-1", "tap-2", "tap-3", "tap-4"],
    );
    assert.deepEqual(
      validResult.selection.availableMembers.map((member) => member.teamAssessmentParticipantId),
      ["tap-5"],
    );

    const emptyHarness = createHarness();
    const emptyResult = await replaceTeamDynamicsReportSelectionInclusionAction(
      {
        teamAssessmentAssignmentId: "assignment-1",
        includedTeamAssessmentParticipantIds: [],
      },
      emptyHarness.deps,
    );

    assert.equal(emptyResult.ok, true);
    assert.equal(emptyResult.selection.selectedCount, 0);
    assert.equal(emptyResult.selection.teamSizeStatus, "too_few");
    assert.equal(emptyResult.selection.canCreateTeamReport, false);
    assert.deepEqual(emptyResult.selection.disabledReasons, [
      "minimum_selected_members_not_met",
    ]);

    const replaceHarness = createHarness();
    replaceHarness.setIncluded(["tap-1", "tap-2", "tap-3", "tap-4"]);
    const firstReplace = await replaceTeamDynamicsReportSelectionInclusionAction(
      {
        teamAssessmentAssignmentId: "assignment-1",
        includedTeamAssessmentParticipantIds: ["tap-1", "tap-2", "tap-3", "tap-4"],
      },
      replaceHarness.deps,
    );
    assert.equal(firstReplace.ok, true);

    const secondReplace = await replaceTeamDynamicsReportSelectionInclusionAction(
      {
        teamAssessmentAssignmentId: "assignment-1",
        includedTeamAssessmentParticipantIds: ["tap-5", "tap-2", "tap-1"],
      },
      replaceHarness.deps,
    );
    assert.equal(secondReplace.ok, true);
    assert.deepEqual(
      secondReplace.selection.includedMembers.map((member) => member.teamAssessmentParticipantId),
      ["tap-1", "tap-2", "tap-5"],
    );
    assert.deepEqual(
      secondReplace.selection.availableMembers.map((member) => member.teamAssessmentParticipantId),
      ["tap-3", "tap-4"],
    );

    const duplicateHarness = createHarness();
    const duplicateResult = await replaceTeamDynamicsReportSelectionInclusionAction(
      {
        teamAssessmentAssignmentId: "assignment-1",
        includedTeamAssessmentParticipantIds: ["tap-3", "tap-3", "tap-1", "tap-1", "tap-2"],
      },
      duplicateHarness.deps,
    );

    assert.equal(duplicateResult.ok, true);
    assert.deepEqual(
      duplicateHarness.replaceCalls[0].includedTeamAssessmentParticipantIds,
      ["tap-1", "tap-2", "tap-3"],
    );
    assert.deepEqual(duplicateHarness.participantLookupCalls[0], [
      "tap-1",
      "tap-2",
      "tap-3",
    ]);

    const unknownHarness = createHarness();
    const unknownResult = await replaceTeamDynamicsReportSelectionInclusionAction(
      {
        teamAssessmentAssignmentId: "assignment-1",
        includedTeamAssessmentParticipantIds: ["tap-1", "tap-missing"],
      },
      unknownHarness.deps,
    );

    assert.deepEqual(unknownResult, {
      ok: false,
      errorCode: "unknown_participant_ids",
      message: "Unknown Team Dynamics participant ids: tap-missing.",
    });
    assert.equal(unknownHarness.replaceCalls.length, 0);

    const mismatchHarness = createHarness();
    const mismatchResult = await replaceTeamDynamicsReportSelectionInclusionAction(
      {
        teamAssessmentAssignmentId: "assignment-1",
        includedTeamAssessmentParticipantIds: ["tap-1", "tap-other"],
      },
      mismatchHarness.deps,
    );

    assert.deepEqual(mismatchResult, {
      ok: false,
      errorCode: "participant_assignment_mismatch",
      message:
        "All included Team Dynamics participants must belong to the requested assignment.",
    });
    assert.equal(mismatchHarness.replaceCalls.length, 0);

    const nonFinalHarness = createHarness();
    nonFinalHarness.setAssignmentContext(async ({ teamAssessmentAssignmentId }) => ({
      assignmentId: teamAssessmentAssignmentId,
      teamId: "team-1",
      packageSlug: "team_dynamics_beta",
      organizationId: "org-1",
      teamArchivedAt: null,
    }));
    const nonFinalResult = await replaceTeamDynamicsReportSelectionInclusionAction(
      {
        teamAssessmentAssignmentId: "assignment-1",
        includedTeamAssessmentParticipantIds: ["tap-1"],
      },
      nonFinalHarness.deps,
    );

    assert.deepEqual(nonFinalResult, {
      ok: false,
      errorCode: "assignment_not_team_dynamics_final",
      message: "The assignment does not belong to the final Team Dynamics package.",
    });

    const unauthorizedHarness = createHarness();
    unauthorizedHarness.setRequireUser(async () => {
      throw new AuthenticationRequiredError();
    });
    const unauthorizedResult = await replaceTeamDynamicsReportSelectionInclusionAction(
      {
        teamAssessmentAssignmentId: "assignment-1",
        includedTeamAssessmentParticipantIds: ["tap-1"],
      },
      unauthorizedHarness.deps,
    );

    assert.deepEqual(unauthorizedResult, {
      ok: false,
      errorCode: "authentication_required",
      message: "Authentication required.",
    });

    const queueHarness = createQueueHarness();
    const queuedResult = await queueTeamDynamicsReportAction(
      {
        teamId: "team-1",
        teamAssessmentAssignmentId: "assignment-1",
        selectionDraftId: "draft-1",
      },
      queueHarness.deps,
    );

    assert.deepEqual(queueHarness.queueCalls, [
      {
        organizationId: "org-1",
        teamId: "team-1",
        teamAssessmentAssignmentId: "assignment-1",
        selectionDraftId: "draft-1",
      },
    ]);
    assert.deepEqual(queuedResult, {
      ok: true,
      status: "queued",
      message: "Timski izvještaj je stavljen u red za pripremu.",
      reportId: "report-1",
    });

    const queueNotReadyHarness = createQueueHarness();
    queueNotReadyHarness.setQueueReportShell(async () => ({
      ok: false,
      code: "aggregation_not_ready",
      reason: "not ready",
    }));
    const queueNotReadyResult = await queueTeamDynamicsReportAction(
      {
        teamId: "team-1",
        teamAssessmentAssignmentId: "assignment-1",
        selectionDraftId: "draft-1",
      },
      queueNotReadyHarness.deps,
    );

    assert.deepEqual(queueNotReadyResult, {
      ok: false,
      status: "not_ready",
      message:
        "Izvještaj još nije moguće pripremiti. Provjeri da su uključeni članovi završili procjenu i da je timska agregacija spremna.",
    });

    const queueUnauthorizedHarness = createQueueHarness();
    queueUnauthorizedHarness.setAssignmentContext(async () => ({
      assignmentId: "assignment-1",
      teamId: "team-2",
      packageSlug: "team_dynamics_assessment_v1",
      organizationId: "org-1",
      teamArchivedAt: null,
    }));
    const queueUnauthorizedResult = await queueTeamDynamicsReportAction(
      {
        teamId: "team-1",
        teamAssessmentAssignmentId: "assignment-1",
        selectionDraftId: "draft-1",
      },
      queueUnauthorizedHarness.deps,
    );

    assert.deepEqual(queueUnauthorizedResult, {
      ok: false,
      status: "unauthorized",
      message: "Team Dynamics assignment was not found in the active organization.",
    });
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
