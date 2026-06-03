const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-input.ts");
const helperSource = fs.readFileSync(helperPath, "utf8");
const todoPath = path.join(projectRoot, "docs", "deep-profile-todo.md");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const lifecycleStubDir = fs.mkdtempSync(path.join(os.tmpdir(), "team-fit-input-lifecycle-"));
const lifecycleStubPath = path.join(lifecycleStubDir, "team-fit-lifecycle-stub.cjs");
const originalResolveFilename = Module._resolveFilename;

fs.writeFileSync(
  lifecycleStubPath,
  [
    "module.exports = {",
    "  TEAM_FIT_REPORT_TYPE: \"team_fit_report_v1\",",
    "  TEAM_FIT_REPORT_VERSION: \"v1\",",
    "  TEAM_FIT_CANDIDATE_SOURCE_TYPE: \"composite_deterministic_input_snapshot\",",
    "  TEAM_FIT_TEAM_SOURCE_TYPE: \"team_dynamics_aggregation_input_snapshot\",",
    "};",
  ].join("\n"),
);

assert.match(helperSource, /\.from\("team_fit_reports"\)/);
assert.match(helperSource, /TEAM_FIT_REPORT_INPUT_TYPE = "team_fit_report_input_v1"/);
assert.match(helperSource, /TEAM_FIT_REPORT_INPUT_VERSION = "team_fit_report_input_v2_enriched"/);
assert.match(helperSource, /TEAM_FIT_REPORT_INPUT_LEGACY_VERSION = "team_fit_report_input_v1"/);
assert.match(helperSource, /buildCompositeHrInputSnapshot/);
assert.match(helperSource, /loadTeamDynamicsFinalAggregationVerification/);
assert.match(helperSource, /sourceStatus: "placeholder_pending_composite_input"/);
assert.match(helperSource, /sourceStatus: "placeholder_pending_team_aggregation_input"/);
assert.match(helperSource, /relationshipReasoningGuardrails/);
assert.match(helperSource, /executiveOverviewContextIncluded: false/);
assert.match(helperSource, /roleContextIncluded: false/);
assert.match(helperSource, /\.update\(\{\s*input_snapshot: buildResult\.inputSnapshot/s);
assert.doesNotMatch(helperSource, /\.from\("responses"\)/);
assert.doesNotMatch(helperSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("team_assessment_reports"\)/);
assert.doesNotMatch(helperSource, /report_snapshot:\s*buildResult/);
assert.doesNotMatch(helperSource, /report_status:\s*"ready"/);
assert.doesNotMatch(helperSource, /OpenAI|provider|renderer|worker/i);
assert.doesNotMatch(helperSource, /rawAnswers|rawResponses|individualAnswers|memberScores|individualScores|fullSnapshot|rawItemText|fitScore|hireRecommendation/);

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
    request === "@/lib/supabase/admin"
  ) {
    return emptyModulePath;
  }

  if (request === "@/lib/b2b/team-fit-report-lifecycle") {
    return lifecycleStubPath;
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
  TEAM_FIT_REPORT_INPUT_TYPE,
  TEAM_FIT_REPORT_INPUT_VERSION,
  buildTeamFitReportInputSnapshot,
  persistTeamFitReportInputSnapshot,
} = require(helperPath);

function createSupabaseStub(initialState = {}) {
  const state = {
    organizations: [...(initialState.organizations ?? [])],
    teams: [...(initialState.teams ?? [])],
    participants: [...(initialState.participants ?? [])],
    team_fit_reports: [...(initialState.team_fit_reports ?? [])],
    attempt_reports: [...(initialState.attempt_reports ?? [])],
    assessment_reports: [...(initialState.assessment_reports ?? [])],
    team_assessment_reports: [...(initialState.team_assessment_reports ?? [])],
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
      };

      const builder = {
        select() {
          operations.push({ type: "select", table });
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

            Object.assign(row, query.patch, {
              updated_at: "2026-05-30T12:00:00.000Z",
            });
            return { data: row, error: null };
          }

          const rows = applyFilters(state[table] ?? [], query.filters);
          return { data: rows[0] ?? null, error: null };
        },
        async then(resolve, reject) {
          try {
            const rows = applyFilters(state[table] ?? [], query.filters);

            if (query.mode === "update") {
              rows.forEach((row) =>
                Object.assign(row, query.patch, { updated_at: "2026-05-30T12:00:00.000Z" }),
              );
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

function buildBaseState() {
  return {
    organizations: [{ id: "org-1", name: "Deep Profile" }],
    teams: [{ id: "team-1", organization_id: "org-1", name: "Team A", archived_at: null }],
    participants: [{ id: "participant-1", organization_id: "org-1", full_name: "Amina Candidate" }],
    team_fit_reports: [
      {
        id: "report-1",
        organization_id: "org-1",
        team_id: "team-1",
        participant_id: "participant-1",
        candidate_source_type: "composite_deterministic_input_snapshot",
        candidate_source_id: null,
        team_source_type: "team_dynamics_aggregation_input_snapshot",
        team_source_id: null,
        optional_context: { locale: "bs" },
        report_type: "team_fit_report_v1",
        report_version: "v1",
        report_status: "queued",
        input_snapshot: null,
        report_snapshot: null,
        created_at: "2026-05-30T10:00:00.000Z",
        updated_at: "2026-05-30T10:00:00.000Z",
      },
    ],
    attempt_reports: [{ id: "attempt-report-1", report_status: "queued" }],
    assessment_reports: [{ id: "assessment-report-1", report_status: "queued" }],
    team_assessment_reports: [{ id: "team-assessment-report-1", report_status: "queued" }],
  };
}

function assertNoUndefined(value) {
  if (value === undefined) {
    assert.fail("Snapshot contains undefined value.");
  }

  if (Array.isArray(value)) {
    value.forEach(assertNoUndefined);
    return;
  }

  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      assertNoUndefined(value[key]);
    }
  }
}

async function main() {
  const buildSupabase = createSupabaseStub(buildBaseState());
  const built = await buildTeamFitReportInputSnapshot(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    { supabase: buildSupabase },
  );

  assert.equal(built.ok, true);
  assert.equal(built.reportId, "report-1");
  assert.equal(built.inputSnapshot.inputType, TEAM_FIT_REPORT_INPUT_TYPE);
  assert.equal(built.inputSnapshot.inputVersion, TEAM_FIT_REPORT_INPUT_VERSION);
  assert.equal(built.inputSnapshot.reportType, "team_fit_report_v1");
  assert.equal(built.inputSnapshot.reportVersion, "v1");
  assert.equal(built.inputSnapshot.locale, "bs");
  assert.equal(built.inputSnapshot.generatedAt, "2026-05-30T10:00:00.000Z");
  assert.deepEqual(built.inputSnapshot.organizationContext, {
    organizationId: "org-1",
    organizationName: "Deep Profile",
  });
  assert.deepEqual(built.inputSnapshot.teamContext, {
    teamId: "team-1",
    teamName: "Team A",
    teamSourceType: "team_dynamics_aggregation_input_snapshot",
    teamSourceId: null,
  });
  assert.deepEqual(built.inputSnapshot.candidateContext, {
    participantId: "participant-1",
    displayName: "Amina Candidate",
    candidateSourceType: "composite_deterministic_input_snapshot",
    candidateSourceId: null,
  });
  assert.equal(built.inputSnapshot.sourceReferences.executiveOverviewContextIncluded, false);
  assert.equal(built.inputSnapshot.sourceReferences.roleContextIncluded, false);
  assert.equal(built.inputSnapshot.candidateSignals.sourceStatus, "placeholder_pending_composite_input");
  assert.equal(built.inputSnapshot.candidateSignals.summary, null);
  assert.equal(built.inputSnapshot.teamSignals.sourceStatus, "placeholder_pending_team_aggregation_input");
  assert.equal(built.inputSnapshot.teamSignals.summary, null);
  assert.deepEqual(built.inputSnapshot.relationshipReasoningGuardrails.allowedPatterns, [
    "alignment_signal",
    "complementarity_signal",
    "mixed_signal",
    "needs_validation",
  ]);
  assert.deepEqual(built.inputSnapshot.interpretationGuardrails, {
    noNumericFitScore: true,
    noHireNoHire: true,
    noRawTeamMemberAnswers: true,
    noIndividualTeamMemberScoreDisplay: true,
    noCandidateFacingOutput: true,
  });
  assert.equal(JSON.stringify(built.inputSnapshot).includes('undefined'), false);
  assert.equal(
    /rawAnswers|rawResponses|individualAnswers|memberScores|individualScores|fullSnapshot|rawItemText|fitScore|score0To100|hireRecommendation/.test(
      JSON.stringify(built.inputSnapshot),
    ),
    false,
  );
  assertNoUndefined(built.inputSnapshot);

  const persistSupabase = createSupabaseStub(buildBaseState());
  const persisted = await persistTeamFitReportInputSnapshot(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    { supabase: persistSupabase },
  );

  assert.equal(persisted.ok, true);
  assert.deepEqual(persistSupabase.state.team_fit_reports[0].input_snapshot, persisted.inputSnapshot);
  assert.equal(persistSupabase.state.team_fit_reports[0].report_status, "queued");
  assert.equal(persistSupabase.state.team_fit_reports[0].report_snapshot, null);

  const wrongOrg = await buildTeamFitReportInputSnapshot(
    {
      teamFitReportId: "report-1",
      organizationId: "org-2",
    },
    { supabase: persistSupabase },
  );
  assert.equal(wrongOrg.ok, false);
  assert.equal(wrongOrg.reason, "report_not_found");

  const wrongContractSupabase = createSupabaseStub(buildBaseState());
  wrongContractSupabase.state.team_fit_reports[0].report_version = "v2";
  const wrongContract = await buildTeamFitReportInputSnapshot(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    { supabase: wrongContractSupabase },
  );
  assert.equal(wrongContract.ok, false);
  assert.equal(wrongContract.reason, "report_contract_mismatch");

  const wrongSourceSupabase = createSupabaseStub(buildBaseState());
  wrongSourceSupabase.state.team_fit_reports[0].candidate_source_type = "candidate_report_snapshot";
  const wrongSource = await buildTeamFitReportInputSnapshot(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    { supabase: wrongSourceSupabase },
  );
  assert.equal(wrongSource.ok, false);
  assert.equal(wrongSource.reason, "unsupported_candidate_source_type");

  const persistedReadOnlySupabase = createSupabaseStub(buildBaseState());
  persistedReadOnlySupabase.state.team_fit_reports[0].report_status = "processing";
  persistedReadOnlySupabase.state.team_fit_reports[0].input_snapshot = built.inputSnapshot;
  const readOnly = await buildTeamFitReportInputSnapshot(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    { supabase: persistedReadOnlySupabase },
  );
  assert.equal(readOnly.ok, true);
  assert.deepEqual(readOnly.inputSnapshot, built.inputSnapshot);

  assert.equal(
    persistSupabase.operations.some((entry) => entry.type === "update" && entry.table === "attempt_reports"),
    false,
  );
  assert.equal(
    persistSupabase.operations.some((entry) => entry.type === "update" && entry.table === "assessment_reports"),
    false,
  );
  assert.equal(
    persistSupabase.operations.some((entry) => entry.type === "update" && entry.table === "team_assessment_reports"),
    false,
  );

  const todoSource = fs.readFileSync(todoPath, "utf8");
  assert.match(todoSource, /Completion note — Team Fit input snapshot builder shell/);

  console.log("test-team-fit-report-input-builder: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
