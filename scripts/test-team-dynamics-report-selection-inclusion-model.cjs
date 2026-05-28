const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;
const migrationPath = path.join(
  projectRoot,
  "supabase",
  "migrations",
  "20260528113000_add_team_assessment_report_selection_drafts.sql",
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

const migrationSql = fs.readFileSync(migrationPath, "utf8");

assert.match(
  migrationSql,
  /create table if not exists public\.team_assessment_report_selection_drafts/i,
);
assert.match(
  migrationSql,
  /create table if not exists public\.team_assessment_report_selection_members/i,
);
assert.match(
  migrationSql,
  /team_assessment_assignment_id uuid not null references public\.team_assessment_assignments\(id\) on delete cascade/i,
);
assert.match(
  migrationSql,
  /team_assessment_participant_id uuid not null references public\.team_assessment_participants\(id\) on delete cascade/i,
);
assert.match(
  migrationSql,
  /create unique index if not exists team_assessment_report_selection_drafts_assignment_idx/i,
);
assert.match(
  migrationSql,
  /create unique index if not exists team_assessment_report_selection_members_draft_wrapper_idx/i,
);
assert.match(
  migrationSql,
  /create trigger set_team_assessment_report_selection_drafts_updated_at/i,
);
assert.match(
  migrationSql,
  /create trigger set_team_assessment_report_selection_members_updated_at/i,
);
assert.match(
  migrationSql,
  /alter table public\.team_assessment_report_selection_drafts enable row level security/i,
);
assert.match(
  migrationSql,
  /alter table public\.team_assessment_report_selection_members enable row level security/i,
);
assert.match(
  migrationSql,
  /create policy "team_assessment_report_selection_drafts_read_member"/i,
);
assert.match(
  migrationSql,
  /create policy "team_assessment_report_selection_members_read_member"/i,
);

const inclusionSource = fs.readFileSync(
  path.join(projectRoot, "lib", "b2b", "team-dynamics-report-selection-inclusion.ts"),
  "utf8",
);
const readSource = fs.readFileSync(
  path.join(projectRoot, "lib", "b2b", "team-dynamics-report-selection.ts"),
  "utf8",
);

assert.match(inclusionSource, /loadTeamDynamicsReportSelectionInclusionState/);
assert.match(inclusionSource, /replaceTeamDynamicsReportSelectionInclusionSet/);
assert.match(inclusionSource, /\.from\("team_assessment_report_selection_drafts"\)/);
assert.match(inclusionSource, /\.from\("team_assessment_report_selection_members"\)/);
assert.match(inclusionSource, /\.delete\(/);
assert.match(inclusionSource, /\.insert\(/);
assert.match(inclusionSource, /\.update\(/);
assert.doesNotMatch(inclusionSource, /attempt_reports/);
assert.doesNotMatch(inclusionSource, /assessment_reports/);
assert.doesNotMatch(inclusionSource, /Team Fit/i);
assert.doesNotMatch(inclusionSource, /AI generation/i);
assert.doesNotMatch(inclusionSource, /report generation/i);
assert.doesNotMatch(inclusionSource, /loadTeamDynamicsFinalAggregation\(/);
assert.doesNotMatch(inclusionSource, /buildTeamDynamicsMixedScore/);
assert.doesNotMatch(inclusionSource, /persistTeamDynamicsFinalAggregationSnapshot/);

assert.match(readSource, /loadTeamDynamicsReportSelectionInclusionState/);
assert.doesNotMatch(readSource, /\.insert\(/);
assert.doesNotMatch(readSource, /\.update\(/);
assert.doesNotMatch(readSource, /\.delete\(/);

const {
  TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
} = require("../lib/assessment/team-dynamics-mixed-score-persistence.ts");
const {
  loadTeamDynamicsReportSelectionInclusionState,
  replaceTeamDynamicsReportSelectionInclusionSet,
} = require("../lib/b2b/team-dynamics-report-selection-inclusion.ts");
const {
  getTeamDynamicsReportSelectionReadModelForOrganization,
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

function createSupabaseStub(initialState = {}) {
  let draftCounter = 0;
  let memberCounter = 0;
  const state = {
    teams: [...(initialState.teams ?? [])],
    team_assessment_assignments: [...(initialState.team_assessment_assignments ?? [])],
    team_assessment_participants: [...(initialState.team_assessment_participants ?? [])],
    team_memberships: [...(initialState.team_memberships ?? [])],
    participants: [...(initialState.participants ?? [])],
    team_assessment_participant_scores: [
      ...(initialState.team_assessment_participant_scores ?? []),
    ],
    team_assessment_report_selection_drafts: [
      ...(initialState.team_assessment_report_selection_drafts ?? []),
    ],
    team_assessment_report_selection_members: [
      ...(initialState.team_assessment_report_selection_members ?? []),
    ],
    team_membership_records: [...(initialState.team_membership_records ?? [])],
    attempts: [...(initialState.attempts ?? [])],
    responses: [...(initialState.responses ?? [])],
    attempt_reports: [...(initialState.attempt_reports ?? [])],
    assessment_reports: [...(initialState.assessment_reports ?? [])],
  };
  const operations = [];

  function applyFilters(rows, filters) {
    return rows.filter((row) =>
      filters.every((filter) => {
        if (filter.type === "eq") {
          return row[filter.column] === filter.value;
        }

        if (filter.type === "in") {
          return filter.values.includes(row[filter.column]);
        }

        return true;
      }),
    );
  }

  return {
    state,
    operations,
    from(table) {
      operations.push({ type: "from", table });

      const query = {
        filters: [],
        mode: "select",
        patch: null,
        insertRows: null,
        returnSingle: false,
        shouldReturnRows: false,
      };

      const builder = {
        select() {
          query.shouldReturnRows = true;
          operations.push({ type: "select", table });
          return builder;
        },
        eq(column, value) {
          query.filters.push({ type: "eq", column, value });
          return builder;
        },
        in(column, values) {
          query.filters.push({ type: "in", column, values });
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        update(patch) {
          operations.push({ type: "update", table });
          query.mode = "update";
          query.patch = patch;
          return builder;
        },
        insert(rows) {
          operations.push({ type: "insert", table });
          query.mode = "insert";
          query.insertRows = Array.isArray(rows) ? rows : [rows];
          return builder;
        },
        delete() {
          operations.push({ type: "delete", table });
          query.mode = "delete";
          return builder;
        },
        single() {
          query.returnSingle = true;
          return builder;
        },
        async maybeSingle() {
          const rows = applyFilters(state[table] ?? [], query.filters);
          return { data: rows[0] ?? null, error: null };
        },
        then(resolve, reject) {
          try {
            if (query.mode === "select") {
              const rows = applyFilters(state[table] ?? [], query.filters);
              const payload = query.returnSingle ? rows[0] ?? null : rows;
              return Promise.resolve({ data: payload, error: null }).then(resolve, reject);
            }

            if (query.mode === "update") {
              const rows = applyFilters(state[table] ?? [], query.filters);
              const updatedRows = rows.map((row) =>
                Object.assign(row, query.patch ?? {}, {
                  updated_at: "2026-05-28T12:05:00.000Z",
                }),
              );
              const payload = query.returnSingle ? updatedRows[0] ?? null : updatedRows;
              return Promise.resolve({ data: payload, error: null }).then(resolve, reject);
            }

            if (query.mode === "insert") {
              const insertedRows = (query.insertRows ?? []).map((row) => {
                if (table === "team_assessment_report_selection_drafts") {
                  draftCounter += 1;
                  const nextRow = {
                    id: row.id ?? `selection-draft-${draftCounter}`,
                    created_at: row.created_at ?? "2026-05-28T12:00:00.000Z",
                    updated_at: row.updated_at ?? "2026-05-28T12:00:00.000Z",
                    ...row,
                  };
                  state[table].push(nextRow);
                  return nextRow;
                }

                if (table === "team_assessment_report_selection_members") {
                  memberCounter += 1;
                  const nextRow = {
                    id: row.id ?? `selection-member-${memberCounter}`,
                    created_at: row.created_at ?? "2026-05-28T12:01:00.000Z",
                    updated_at: row.updated_at ?? "2026-05-28T12:01:00.000Z",
                    ...row,
                  };
                  state[table].push(nextRow);
                  return nextRow;
                }

                throw new Error(`Unexpected insert on ${table}.`);
              });

              const payload = query.returnSingle ? insertedRows[0] ?? null : insertedRows;
              return Promise.resolve({ data: payload, error: null }).then(resolve, reject);
            }

            if (query.mode === "delete") {
              const rows = applyFilters(state[table] ?? [], query.filters);
              state[table] = (state[table] ?? []).filter((row) => rows.includes(row) === false);
              const payload = query.returnSingle ? rows[0] ?? null : rows;
              return Promise.resolve({ data: payload, error: null }).then(resolve, reject);
            }

            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        },
      };

      return builder;
    },
  };
}

function buildBaseState() {
  const participants = Array.from({ length: 6 }, (_, index) => {
    const number = index + 1;
    return {
      id: `participant-${number}`,
      organization_id: "org-1",
      full_name: `Member ${number}`,
      email: `member${number}@example.com`,
    };
  });

  const memberships = participants.map((participant, index) => ({
    id: `membership-${index + 1}`,
    team_id: "team-1",
    participant_id: participant.id,
    role: "member",
    joined_at: `2026-05-${String(index + 1).padStart(2, "0")}T09:00:00.000Z`,
  }));

  const wrappers = participants.map((participant, index) => ({
    id: `tap-${index + 1}`,
    team_assessment_assignment_id: "assignment-1",
    team_membership_id: `membership-${index + 1}`,
    participant_id: participant.id,
    status: index === 5 ? "started" : "completed",
    invited_at: "2026-05-28T09:00:00.000Z",
    started_at: "2026-05-28T09:05:00.000Z",
    completed_at: index === 5 ? null : "2026-05-28T09:30:00.000Z",
  }));

  const scores = wrappers
    .filter((wrapper) => wrapper.status === "completed")
    .map((wrapper) => ({
      id: `score-${wrapper.id}`,
      team_assessment_participant_id: wrapper.id,
      scoring_version: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
      scoring_status: "scored",
      raw_total: null,
      mean_raw: null,
      score_0_100: null,
      score_snapshot: buildReadyScoreSnapshot(),
      calculated_at: "2026-05-28T10:30:00.000Z",
    }));

  return {
    teams: [
      {
        id: "team-1",
        organization_id: "org-1",
        archived_at: null,
      },
    ],
    team_assessment_assignments: [
      {
        id: "assignment-1",
        team_id: "team-1",
        package_slug: "team_dynamics_assessment_v1",
        created_at: "2026-05-28T08:00:00.000Z",
      },
    ],
    team_assessment_participants: wrappers,
    team_memberships: memberships,
    participants,
    team_assessment_participant_scores: scores,
    team_assessment_report_selection_drafts: [],
    team_assessment_report_selection_members: [],
    attempts: [{ id: "attempt-1" }],
    responses: [{ id: "response-1" }],
    attempt_reports: [{ id: "attempt-report-1" }],
    assessment_reports: [{ id: "assessment-report-1" }],
  };
}

(async () => {
  const supabase = createSupabaseStub(buildBaseState());

  const defaultState = await loadTeamDynamicsReportSelectionInclusionState(
    {
      organizationId: "org-1",
      teamId: "team-1",
      teamAssessmentAssignmentId: "assignment-1",
    },
    { supabase },
  );
  assert.deepEqual(defaultState, {
    hasPersistedSelectionDraft: false,
    selectionDraftId: null,
    includedTeamAssessmentParticipantIds: [],
    createdAt: null,
    updatedAt: null,
  });

  const initialRead = await getTeamDynamicsReportSelectionReadModelForOrganization(
    {
      organizationId: "org-1",
      teamId: "team-1",
      teamAssessmentAssignmentId: "assignment-1",
    },
    { supabase },
  );
  assert.equal(initialRead.hasPersistedSelectionDraft, false);
  assert.equal(initialRead.selectedCount, 0);
  assert.equal(initialRead.includedMembers.length, 0);
  assert.equal(initialRead.availableMembers.length, 6);
  assert.equal(initialRead.teamSizeStatus, "too_few");
  assert.equal(initialRead.canCreateTeamReport, false);
  assert.deepEqual(initialRead.disabledReasons, ["minimum_selected_members_not_met"]);

  const beforeTeamMembershipCount = supabase.state.team_memberships.length;
  const beforeAttemptCount = supabase.state.attempts.length;
  const beforeResponseCount = supabase.state.responses.length;
  const beforeAttemptReportCount = supabase.state.attempt_reports.length;
  const beforeAssessmentReportCount = supabase.state.assessment_reports.length;

  const replaced = await replaceTeamDynamicsReportSelectionInclusionSet(
    {
      organizationId: "org-1",
      teamId: "team-1",
      teamAssessmentAssignmentId: "assignment-1",
      includedTeamAssessmentParticipantIds: ["tap-1", "tap-2", "tap-3"],
      actorUserId: "user-1",
    },
    { supabase },
  );

  assert.equal(replaced.selectionDraftId, "selection-draft-1");
  assert.deepEqual(replaced.includedTeamAssessmentParticipantIds, ["tap-1", "tap-2", "tap-3"]);
  assert.equal(supabase.state.team_memberships.length, beforeTeamMembershipCount);
  assert.equal(supabase.state.attempts.length, beforeAttemptCount);
  assert.equal(supabase.state.responses.length, beforeResponseCount);
  assert.equal(supabase.state.attempt_reports.length, beforeAttemptReportCount);
  assert.equal(supabase.state.assessment_reports.length, beforeAssessmentReportCount);

  const tooFewRead = await getTeamDynamicsReportSelectionReadModelForOrganization(
    {
      organizationId: "org-1",
      teamId: "team-1",
      teamAssessmentAssignmentId: "assignment-1",
    },
    { supabase },
  );
  assert.equal(tooFewRead.hasPersistedSelectionDraft, true);
  assert.equal(tooFewRead.selectedCount, 3);
  assert.equal(tooFewRead.teamSizeStatus, "too_few");
  assert.equal(tooFewRead.canCreateTeamReport, false);
  assert.deepEqual(tooFewRead.disabledReasons, ["minimum_selected_members_not_met"]);
  assert.deepEqual(
    tooFewRead.availableMembers.map((member) => member.teamAssessmentParticipantId).sort(),
    ["tap-4", "tap-5", "tap-6"],
  );
  assert.deepEqual(
    tooFewRead.includedMembers.map((member) => member.teamAssessmentParticipantId).sort(),
    ["tap-1", "tap-2", "tap-3"],
  );

  await replaceTeamDynamicsReportSelectionInclusionSet(
    {
      organizationId: "org-1",
      teamId: "team-1",
      teamAssessmentAssignmentId: "assignment-1",
      includedTeamAssessmentParticipantIds: ["tap-1", "tap-2", "tap-3", "tap-4"],
      actorUserId: "user-1",
    },
    { supabase },
  );

  const readyRead = await getTeamDynamicsReportSelectionReadModelForOrganization(
    {
      organizationId: "org-1",
      teamId: "team-1",
      teamAssessmentAssignmentId: "assignment-1",
    },
    { supabase },
  );
  assert.equal(readyRead.selectedCount, 4);
  assert.equal(readyRead.teamSizeStatus, "ideal");
  assert.equal(readyRead.canCreateTeamReport, true);
  assert.deepEqual(readyRead.disabledReasons, []);
  assert.deepEqual(
    readyRead.availableMembers.map((member) => member.teamAssessmentParticipantId).sort(),
    ["tap-5", "tap-6"],
  );
  assert.equal(
    readyRead.availableMembers.some((member) => member.teamAssessmentParticipantId === "tap-6"),
    true,
  );
  assert.equal(
    readyRead.availableMembers.some((member) => member.blockingReason === "member_not_completed:started"),
    true,
  );

  await replaceTeamDynamicsReportSelectionInclusionSet(
    {
      organizationId: "org-1",
      teamId: "team-1",
      teamAssessmentAssignmentId: "assignment-1",
      includedTeamAssessmentParticipantIds: ["tap-1", "tap-2", "tap-6", "tap-4"],
      actorUserId: "user-1",
    },
    { supabase },
  );

  const blockedByIncludedIncomplete =
    await getTeamDynamicsReportSelectionReadModelForOrganization(
      {
        organizationId: "org-1",
        teamId: "team-1",
        teamAssessmentAssignmentId: "assignment-1",
      },
      { supabase },
    );
  assert.equal(blockedByIncludedIncomplete.canCreateTeamReport, false);
  assert.deepEqual(blockedByIncludedIncomplete.disabledReasons, [
    "included_members_not_completed",
    "included_members_missing_score_snapshots",
  ]);
  assert.equal(
    blockedByIncludedIncomplete.includedMembers.find(
      (member) => member.teamAssessmentParticipantId === "tap-6",
    ).blockingReason,
    "member_not_completed:started",
  );

  const writeTablesTouched = new Set(
    supabase.operations
      .filter((operation) =>
        ["insert", "update", "delete"].includes(operation.type),
      )
      .map((operation) => operation.table),
  );
  assert.deepEqual([...writeTablesTouched].sort(), [
    "team_assessment_report_selection_drafts",
    "team_assessment_report_selection_members",
  ]);

  console.log("Team Dynamics report selection inclusion model tests passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
