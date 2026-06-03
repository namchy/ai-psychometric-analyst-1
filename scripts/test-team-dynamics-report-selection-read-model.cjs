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

const source = fs.readFileSync(
  path.join(projectRoot, "lib", "b2b", "team-dynamics-report-selection.ts"),
  "utf8",
);

assert.match(source, /export function buildTeamDynamicsReportSelectionReadModel/);
assert.match(source, /export async function getTeamDynamicsReportSelectionReadModelForOrganization/);
assert.match(source, /\.from\("teams"\)/);
assert.match(source, /\.from\("team_assessment_assignments"\)/);
assert.match(source, /\.from\("team_assessment_participants"\)/);
assert.match(source, /\.from\("team_memberships"\)/);
assert.match(source, /\.from\("participants"\)/);
assert.match(source, /\.from\("team_assessment_participant_scores"\)/);
assert.match(source, /TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG/);
assert.match(source, /TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION/);
assert.doesNotMatch(source, /\.insert\(/);
assert.doesNotMatch(source, /\.update\(/);
assert.doesNotMatch(source, /\.upsert\(/);
assert.doesNotMatch(source, /\.delete\(/);
assert.doesNotMatch(source, /loadTeamDynamicsFinalAggregation\(/);
assert.doesNotMatch(source, /persistTeamDynamicsFinalAggregationSnapshot/);
assert.doesNotMatch(source, /persistTeamDynamicsMixedScoreForContext/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /Team Fit/i);
assert.doesNotMatch(source, /AI generation/i);
assert.doesNotMatch(source, /report generation/i);

const {
  TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
} = require("../lib/assessment/team-dynamics-mixed-score-persistence.ts");
const {
  buildTeamDynamicsReportSelectionReadModel,
} = require("../lib/b2b/team-dynamics-report-selection.ts");

function buildReadyScoreSnapshot() {
  return {
    status: "scored",
    rawTotal: null,
    meanRaw: null,
    score0To100: null,
    blocks: [],
    missingQuestionIds: [],
    runtimeWarnings: [],
    unsupportedQuestionIds: [],
    scoreEntries: [
      {
        scoreKey: "tdm-31-V1_overall",
        label: "Razvojna zrelost tima",
        blockKey: "tdm-31-V1",
        scoreModel: "simple_linear_v1",
        itemCount: 10,
        scoredItemCount: 10,
        rawTotal: 26,
        meanRaw: 2.6,
        score0To100: 53.33,
        scaleMin: 1,
        scaleMax: 4,
        metadata: {},
      },
      {
        scoreKey: "tdm_domain_communication",
        label: "Communication",
        blockKey: "tdm-31-V1",
        scoreModel: "simple_linear_v1",
        itemCount: 4,
        scoredItemCount: 4,
        rawTotal: 10,
        meanRaw: 2.5,
        score0To100: 50,
        scaleMin: 1,
        scaleMax: 4,
        metadata: {},
      },
      {
        scoreKey: "psychological_safety_overall",
        label: "Psiholoska sigurnost u timu",
        blockKey: "psychological_safety",
        scoreModel: "simple_linear_v1",
        itemCount: 4,
        scoredItemCount: 4,
        rawTotal: 11,
        meanRaw: 2.75,
        score0To100: 58.33,
        scaleMin: 1,
        scaleMax: 4,
        metadata: {},
      },
      {
        scoreKey: "situational_judgment_overall",
        label: "Timsko prosudjivanje u situacijama",
        blockKey: "situational_judgment",
        scoreModel: "expert_key_partial_credit_v1",
        itemCount: 1,
        scoredItemCount: 1,
        rawTotal: 4,
        meanRaw: 4,
        score0To100: 75,
        scaleMin: 0,
        scaleMax: 5,
        metadata: {},
      },
      {
        scoreKey: "outcome_pulse_overall",
        label: "Ishodi timskog rada",
        blockKey: "outcome_pulse",
        scoreModel: "simple_linear_v1",
        itemCount: 2,
        scoredItemCount: 2,
        rawTotal: 6,
        meanRaw: 3,
        score0To100: 66.67,
        scaleMin: 1,
        scaleMax: 4,
        metadata: {},
      },
    ],
  };
}

function buildScoreRow(teamAssessmentParticipantId, overrides = {}) {
  return {
    id: `score-${teamAssessmentParticipantId}`,
    team_assessment_participant_id: teamAssessmentParticipantId,
    scoring_version: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
    scoring_status: "scored",
    raw_total: null,
    mean_raw: null,
    score_0_100: null,
    score_snapshot: buildReadyScoreSnapshot(),
    calculated_at: "2026-05-28T10:30:00.000Z",
    ...overrides,
  };
}

function buildMember(index, overrides = {}) {
  const id = `tap-${index}`;

  return {
    teamAssessmentParticipantId: id,
    teamMembershipId: `membership-${index}`,
    participantId: `participant-${index}`,
    fullName: `Member ${String(index).padStart(2, "0")}`,
    email: `member${index}@example.com`,
    role: "member",
    status: "completed",
    invitedAt: "2026-05-28T09:00:00.000Z",
    startedAt: "2026-05-28T09:05:00.000Z",
    completedAt: "2026-05-28T09:30:00.000Z",
    joinedAt: `2026-05-${String(index).padStart(2, "0")}T08:00:00.000Z`,
    scoreRow: buildScoreRow(id),
    ...overrides,
  };
}

function buildScenario(memberCount, mutateMember) {
  const members = Array.from({ length: memberCount }, (_, index) =>
    buildMember(index + 1),
  );

  if (typeof mutateMember === "function") {
    mutateMember(members);
  }

  return buildTeamDynamicsReportSelectionReadModel({
    teamId: "team-1",
    teamAssessmentAssignmentId: "assignment-1",
    members,
  });
}

const tooFew = buildScenario(3);
assert.equal(tooFew.selectedCount, 0);
assert.equal(tooFew.teamSizeStatus, "too_few");
assert.equal(tooFew.canCreateTeamReport, false);
assert.deepEqual(tooFew.disabledReasons, ["minimum_selected_members_not_met"]);
assert.equal(tooFew.includedMembers.length, 0);
assert.equal(tooFew.availableMembers.length, 3);

const ideal = buildScenario(4);
assert.equal(ideal.teamSizeStatus, "too_few");
assert.equal(ideal.canCreateTeamReport, false);
assert.deepEqual(ideal.disabledReasons, ["minimum_selected_members_not_met"]);
assert.equal(ideal.hasPersistedSelectionDraft, false);
assert.equal(ideal.selectionDraftId, null);
assert.equal(ideal.availableMembers.length, 4);
assert.equal(ideal.includedMembers.length, 0);

const warning = buildScenario(11);
assert.equal(warning.teamSizeStatus, "too_few");
assert.equal(warning.canCreateTeamReport, false);
assert.deepEqual(warning.disabledReasons, ["minimum_selected_members_not_met"]);

const tooMany = buildScenario(16);
assert.equal(tooMany.teamSizeStatus, "too_few");
assert.equal(tooMany.canCreateTeamReport, false);
assert.deepEqual(tooMany.disabledReasons, ["minimum_selected_members_not_met"]);

const incomplete = buildScenario(4, (members) => {
  members[2] = buildMember(3, {
    status: "started",
    completedAt: null,
  });
});
assert.equal(incomplete.teamSizeStatus, "too_few");
assert.equal(incomplete.canCreateTeamReport, false);
assert.deepEqual(incomplete.disabledReasons, ["minimum_selected_members_not_met"]);
assert.equal(incomplete.includedMembers.length, 0);
assert.equal(incomplete.availableMembers[2].blockingReason, "member_not_completed:started");

const missingScore = buildScenario(4, (members) => {
  members[1] = buildMember(2, {
    scoreRow: null,
  });
});
assert.equal(missingScore.canCreateTeamReport, false);
assert.deepEqual(missingScore.disabledReasons, ["minimum_selected_members_not_met"]);
assert.equal(missingScore.includedMembers.length, 0);
assert.equal(missingScore.availableMembers[1].scoreReadinessStatus, "not_found");
assert.equal(
  missingScore.availableMembers[1].blockingReason,
  "member_score_snapshot_not_found",
);

const invalidScore = buildScenario(4, (members) => {
  members[0] = buildMember(1, {
    scoreRow: buildScoreRow("tap-1", {
      score_snapshot: {
        status: "scored",
        scoreEntries: [],
      },
    }),
  });
});
assert.equal(invalidScore.canCreateTeamReport, false);
assert.deepEqual(invalidScore.disabledReasons, ["minimum_selected_members_not_met"]);
assert.equal(invalidScore.includedMembers.length, 0);
assert.equal(invalidScore.availableMembers[0].scoreReadinessStatus, "invalid");
assert.equal(
  invalidScore.availableMembers[0].blockingReason,
  "invalid_score_snapshot_shape",
);

console.log("Team Dynamics report selection read model tests passed.");
