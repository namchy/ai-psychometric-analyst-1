const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-dynamics-report-input.ts",
);
const helperSource = fs.readFileSync(helperPath, "utf8");

assert.match(helperSource, /\.from\("team_assessment_reports"\)/);
assert.match(helperSource, /reportRow\.report_status !== "queued"/);
assert.match(helperSource, /loadTeamDynamicsFinalAggregationVerification/);
assert.match(helperSource, /includedMemberIdsSnapshot/);
assert.match(helperSource, /scoreEntryAggregations/);
assert.match(helperSource, /\.update\(\{\s*input_snapshot: buildResult\.snapshot/s);
assert.doesNotMatch(helperSource, /\.from\("responses"\)/);
assert.doesNotMatch(helperSource, /persistTeamDynamicsMixedScoreForContext/);
assert.doesNotMatch(helperSource, /refreshTeamAssessmentAggregationSnapshot/);
assert.doesNotMatch(helperSource, /persistTeamAssessmentAggregationSnapshot/);
assert.doesNotMatch(helperSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(helperSource, /report_snapshot:\s*buildResult/);
assert.doesNotMatch(helperSource, /report_status:\s*"ready"/);
assert.doesNotMatch(helperSource, /OpenAI|AI provider|renderer|worker|Team Fit/i);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "team-dynamics-report-input-"));
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
  if (
    request === "server-only" ||
    request === "@/lib/supabase/admin" ||
    request === "@/lib/assessment/team-dynamics-final-aggregation-read" ||
    request === "@/lib/b2b/team-dynamics-report-lifecycle"
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
  TEAM_DYNAMICS_REPORT_INPUT_TYPE,
  TEAM_DYNAMICS_REPORT_INPUT_VERSION,
  buildTeamDynamicsReportInputSnapshot,
  persistTeamDynamicsReportInputSnapshot,
} = require(helperPath);

function buildReadyAggregationVerification(overrides = {}) {
  return {
    status: "ready",
    teamAssessmentAssignmentId: "assignment-1",
    testSlug: "team_dynamics_assessment_v1",
    aggregationVersion: "team_dynamics_final_aggregation_v1",
    aggregationSnapshotId: "aggregation-1",
    aggregationSnapshot: {
      status: "ready",
      teamAssessmentAssignmentId: "assignment-1",
      teamId: "team-1",
      testSlug: "team_dynamics_assessment_v1",
      aggregationVersion: "team_dynamics_final_aggregation_v1",
      scoringVersion: "team_dynamics_assessment_v1_mixed_v1",
      participantCount: 4,
      completedParticipantCount: 4,
      incompleteMemberCount: 0,
      readyScoredMemberCount: 4,
      missingScoreCount: 0,
      invalidScoreCount: 0,
      sourceScoreSnapshotIds: ["score-1", "score-2", "score-3", "score-4"],
      incompleteMemberParticipantIds: [],
      missingScoreParticipantIds: [],
      invalidScoreParticipantIds: [],
      issues: [],
      scoreEntryAggregations: [
        {
          scoreKey: "tdm-31-V1_overall",
          label: "Razvojna zrelost tima",
          blockKey: "tdm-31-V1",
          scoreModel: "simple_linear_v1",
          entryType: "block_overall",
          memberCount: 4,
          meanScore0To100: 61.11,
          minScore0To100: 33.33,
          maxScore0To100: 80,
          standardDeviationScore0To100: 18.33,
        },
      ],
      tdmDomainAggregations: [],
      psychologicalSafetyAggregationEntry: null,
      sjtAggregationEntry: null,
      outcomePulseAggregationEntry: null,
      hasTopLevelOverallScore: false,
      teamOverallScore0To100: null,
      meanScore0To100: null,
      minScore0To100: null,
      maxScore0To100: null,
      standardDeviationScore0To100: null,
      reasons: [],
    },
    scoreEntryAggregations: [
      {
        scoreKey: "tdm-31-V1_overall",
        label: "Razvojna zrelost tima",
        blockKey: "tdm-31-V1",
        scoreModel: "simple_linear_v1",
        entryType: "block_overall",
        memberCount: 4,
        meanScore0To100: 61.11,
        minScore0To100: 33.33,
        maxScore0To100: 80,
        standardDeviationScore0To100: 18.33,
      },
    ],
    hasUnifiedOverallTeamScore: false,
    hasTdmBlockAggregation: true,
    hasTdmDomainAggregations: true,
    hasPsychologicalSafetyAggregation: true,
    hasSjtAggregation: true,
    hasOutcomePulseAggregation: true,
    includedMemberCount: 4,
    completedMemberCount: 4,
    readyScoredMemberCount: 4,
    incompleteMemberCount: 0,
    missingScoreCount: 0,
    invalidScoreCount: 0,
    createdAt: "2026-05-28T12:00:00.000Z",
    updatedAt: "2026-05-28T12:00:00.000Z",
    calculatedAt: "2026-05-28T12:00:00.000Z",
    reason: null,
    ...overrides,
  };
}

function createSupabaseStub(initialState = {}) {
  const state = {
    team_assessment_reports: [...(initialState.team_assessment_reports ?? [])],
    teams: [...(initialState.teams ?? [])],
    team_assessment_assignments: [...(initialState.team_assessment_assignments ?? [])],
    team_assessment_report_selection_members: [
      ...(initialState.team_assessment_report_selection_members ?? []),
    ],
  };
  const operations = [];

  function applyFilters(rows, filters) {
    return rows.filter((row) =>
      filters.every((filter) => {
        if (filter.type === "eq") {
          return row[filter.column] === filter.value;
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
        selected: false,
      };

      const builder = {
        select() {
          operations.push({ type: "select", table });
          query.selected = true;
          return builder;
        },
        eq(column, value) {
          query.filters.push({ type: "eq", column, value });
          return builder;
        },
        update(patch) {
          operations.push({ type: "update", table, patch });
          query.mode = "update";
          query.patch = patch;
          return builder;
        },
        async maybeSingle() {
          if (query.mode === "update") {
            const rows = applyFilters(state[table] ?? [], query.filters);
            const row = rows[0] ?? null;

            if (!row) {
              return { data: null, error: null };
            }

            Object.assign(row, query.patch);
            return { data: row, error: null };
          }

          const rows = applyFilters(state[table] ?? [], query.filters);
          return {
            data: rows[0] ?? null,
            error: null,
          };
        },
        async then(resolve, reject) {
          try {
            const rows = applyFilters(state[table] ?? [], query.filters);

            if (query.mode === "update") {
              rows.forEach((row) => Object.assign(row, query.patch));
            }

            resolve({ data: rows, error: null });
          } catch (error) {
            reject(error);
          }
        },
      };

      return builder;
    },
  };
}

async function main() {
  const baseState = {
    team_assessment_reports: [
      {
        id: "report-1",
        organization_id: "org-1",
        team_id: "team-1",
        team_assessment_assignment_id: "assignment-1",
        selection_draft_id: "draft-1",
        aggregation_snapshot_id: "aggregation-1",
        report_type: "team_dynamics_report_v1",
        report_version: "team_dynamics_report_v1",
        report_status: "queued",
        included_member_ids_snapshot: ["tap-4", "tap-1", "tap-2", "tap-3"],
        input_snapshot: null,
        report_snapshot: null,
        created_at: "2026-05-28T12:30:00.000Z",
      },
    ],
    teams: [
      {
        id: "team-1",
        organization_id: "org-1",
        name: "Product Team",
        archived_at: null,
      },
    ],
    team_assessment_assignments: [
      {
        id: "assignment-1",
        team_id: "team-1",
        package_slug: "team_dynamics_assessment_v1",
        status: "ready_for_report",
        opened_at: "2026-05-28T09:00:00.000Z",
        closed_at: "2026-05-28T11:00:00.000Z",
        created_at: "2026-05-28T08:00:00.000Z",
        updated_at: "2026-05-28T11:30:00.000Z",
      },
    ],
    team_assessment_report_selection_members: [
      { selection_draft_id: "draft-1", team_assessment_participant_id: "tap-1" },
      { selection_draft_id: "draft-1", team_assessment_participant_id: "tap-2" },
      { selection_draft_id: "draft-1", team_assessment_participant_id: "tap-3" },
      { selection_draft_id: "draft-1", team_assessment_participant_id: "tap-4" },
    ],
  };

  const readySupabase = createSupabaseStub(baseState);
  const readyAggregationCalls = [];
  const readyResult = await buildTeamDynamicsReportInputSnapshot(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: readySupabase,
      loadFinalAggregationVerification: async (input) => {
        readyAggregationCalls.push(input);
        return buildReadyAggregationVerification();
      },
    },
  );

  assert.equal(readyResult.ok, true);
  assert.equal(readyResult.snapshot.inputType, TEAM_DYNAMICS_REPORT_INPUT_TYPE);
  assert.equal(readyResult.snapshot.inputVersion, TEAM_DYNAMICS_REPORT_INPUT_VERSION);
  assert.equal(readyResult.snapshot.teamAssessmentReportId, "report-1");
  assert.equal(readyResult.snapshot.organizationId, "org-1");
  assert.equal(readyResult.snapshot.teamId, "team-1");
  assert.equal(readyResult.snapshot.teamAssessmentAssignmentId, "assignment-1");
  assert.equal(readyResult.snapshot.selectionDraftId, "draft-1");
  assert.equal(readyResult.snapshot.aggregationSnapshotId, "aggregation-1");
  assert.equal(readyResult.snapshot.includedMemberCount, 4);
  assert.deepEqual(readyResult.snapshot.includedMemberIdsSnapshot, [
    "tap-1",
    "tap-2",
    "tap-3",
    "tap-4",
  ]);
  assert.equal(readyResult.snapshot.teamContext.teamName, "Product Team");
  assert.equal(
    readyResult.snapshot.teamContext.assignment.packageSlug,
    "team_dynamics_assessment_v1",
  );
  assert.equal(
    readyResult.snapshot.aggregationSummary.scoreEntryAggregations.length,
    1,
  );
  assert.equal(readyResult.snapshot.guardrails.reportScope, "team_level_only");
  assert.equal(readyAggregationCalls.length, 1);
  assert.equal(readyAggregationCalls[0].teamAssessmentAssignmentId, "assignment-1");
  assert.equal(
    readySupabase.operations.some((entry) => entry.table === "team_assessment_reports"),
    true,
  );
  assert.equal(
    readySupabase.operations.some((entry) => entry.table === "team_assessment_report_selection_members"),
    true,
  );

  const notQueuedSupabase = createSupabaseStub({
    ...baseState,
    team_assessment_reports: [
      {
        ...baseState.team_assessment_reports[0],
        report_status: "processing",
      },
    ],
  });
  const notQueuedResult = await buildTeamDynamicsReportInputSnapshot(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: notQueuedSupabase,
      loadFinalAggregationVerification: async () => buildReadyAggregationVerification(),
    },
  );
  assert.deepEqual(notQueuedResult, {
    ok: false,
    code: "report_not_queued",
    reason: "Team Dynamics report input snapshot can only be built for queued report rows.",
  });

  const notReadySupabase = createSupabaseStub(baseState);
  const notReadyResult = await buildTeamDynamicsReportInputSnapshot(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: notReadySupabase,
      loadFinalAggregationVerification: async () =>
        buildReadyAggregationVerification({
          status: "invalid",
          aggregationSnapshotId: null,
          aggregationSnapshot: null,
          reason: "aggregation_snapshot_not_ready",
        }),
    },
  );
  assert.deepEqual(notReadyResult, {
    ok: false,
    code: "aggregation_not_ready",
    reason: "Team Dynamics report input requires a ready verified final aggregation snapshot.",
  });

  const mismatchSupabase = createSupabaseStub({
    ...baseState,
    team_assessment_report_selection_members: [
      { selection_draft_id: "draft-1", team_assessment_participant_id: "tap-1" },
      { selection_draft_id: "draft-1", team_assessment_participant_id: "tap-2" },
    ],
  });
  const mismatchResult = await buildTeamDynamicsReportInputSnapshot(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: mismatchSupabase,
      loadFinalAggregationVerification: async () => buildReadyAggregationVerification(),
    },
  );
  assert.deepEqual(mismatchResult, {
    ok: false,
    code: "selection_snapshot_mismatch",
    reason:
      "Team Dynamics report input selection snapshot no longer matches the current draft inclusion set.",
  });

  const persistSupabase = createSupabaseStub(baseState);
  const persistResult = await persistTeamDynamicsReportInputSnapshot(
    {
      teamAssessmentReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: persistSupabase,
      loadFinalAggregationVerification: async () => buildReadyAggregationVerification(),
    },
  );

  assert.equal(persistResult.ok, true);
  const persistedRow = persistSupabase.state.team_assessment_reports[0];
  assert.equal(persistedRow.report_status, "queued");
  assert.equal(persistedRow.report_snapshot, null);
  assert.equal(typeof persistedRow.input_snapshot, "object");
  assert.equal(
    persistedRow.input_snapshot.inputType,
    TEAM_DYNAMICS_REPORT_INPUT_TYPE,
  );
  assert.equal(
    persistSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "team_assessment_reports",
    ),
    true,
  );
  assert.equal(
    persistSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "attempt_reports",
    ),
    false,
  );
  assert.equal(
    persistSupabase.operations.some(
      (entry) => entry.type === "update" && entry.table === "assessment_reports",
    ),
    false,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
