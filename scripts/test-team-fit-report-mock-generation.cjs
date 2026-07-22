const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const mockPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-mock.ts");
const processorPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-processor.ts");
const contractPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-contract.ts");
const inputPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-input.ts");
const todoPath = path.join(projectRoot, "docs", "deep-profile-todo.md");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const mockSource = fs.readFileSync(mockPath, "utf8");
const processorSource = fs.readFileSync(processorPath, "utf8");

assert.doesNotMatch(mockSource, /\.from\("/);
assert.doesNotMatch(mockSource, /OpenAI|provider|renderer|worker|scheduler/i);
assert.doesNotMatch(mockSource, /rawAnswers|teamMemberScores|candidateVisible:\s*true/);
assert.doesNotMatch(processorSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(processorSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(processorSource, /\.from\("team_assessment_reports"\)/);
assert.match(processorSource, /createTeamFitOpenAiProvider/);
assert.doesNotMatch(processorSource, /renderer|worker|scheduler/i);
assert.match(processorSource, /processTeamFitReportWithProvider/);
assert.match(processorSource, /TEAM_FIT_PROVIDER_VALIDATION_FAILURE/);
assert.match(processorSource, /claimTeamFitReportForProcessing/);
assert.match(processorSource, /markTeamFitReportProcessingFailed/);
assert.match(processorSource, /report_status:\s*"ready"/);

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

const { buildMockTeamFitReportSnapshot } = require(mockPath);
const { validateTeamFitReportSnapshot } = require(contractPath);
const {
  TEAM_FIT_REPORT_INPUT_TYPE,
  TEAM_FIT_REPORT_INPUT_VERSION,
} = require(inputPath);
const { processTeamFitReportWithMock } = require(processorPath);

function buildInputSnapshot() {
  return {
    inputType: TEAM_FIT_REPORT_INPUT_TYPE,
    inputVersion: TEAM_FIT_REPORT_INPUT_VERSION,
    reportType: "team_fit_report_v1",
    reportVersion: "v1",
    locale: "bs",
    generatedAt: "2026-05-30T12:00:00.000Z",
    organizationContext: {
      organizationId: "org-1",
      organizationName: "Deep Profile",
    },
    teamContext: {
      teamId: "team-1",
      teamName: "Tim A",
      teamSourceType: "team_dynamics_aggregation_input_snapshot",
      teamSourceId: "team-source-1",
    },
    candidateContext: {
      participantId: "participant-1",
      displayName: "Amina Candidate",
      candidateSourceType: "composite_deterministic_input_snapshot",
      candidateSourceId: "candidate-source-1",
    },
    sourceReferences: {
      teamFitReportId: "report-1",
      candidateSourceType: "composite_deterministic_input_snapshot",
      candidateSourceId: "candidate-source-1",
      teamSourceType: "team_dynamics_aggregation_input_snapshot",
      teamSourceId: "team-source-1",
      executiveOverviewContextIncluded: false,
      roleContextIncluded: false,
    },
    candidateSignals: {
      sourceStatus: "placeholder_pending_composite_input",
      summary: null,
      sourceMetadata: {
        sourceTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
      },
    },
    teamSignals: {
      sourceStatus: "placeholder_pending_team_aggregation_input",
      summary: null,
    },
    interpretationGuardrails: {
      noNumericFitScore: true,
      noHireNoHire: true,
      noRawTeamMemberAnswers: true,
      noIndividualTeamMemberScoreDisplay: true,
      noCandidateFacingOutput: true,
    },
  };
}

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
              updated_at: "2026-05-30T12:30:00.000Z",
            });
            return { data: row, error: null };
          }

          const rows = applyFilters(state[table] ?? [], query.filters);
          return { data: rows[0] ?? null, error: null };
        },
      };

      return builder;
    },
  };
}

function buildBaseState() {
  return {
    organizations: [{ id: "org-1", name: "Deep Profile" }],
    teams: [{ id: "team-1", organization_id: "org-1", name: "Tim A", archived_at: null }],
    participants: [{ id: "participant-1", organization_id: "org-1", full_name: "Amina Candidate" }],
    team_fit_reports: [
      {
        id: "report-1",
        organization_id: "org-1",
        team_id: "team-1",
        participant_id: "participant-1",
        candidate_source_type: "composite_deterministic_input_snapshot",
        candidate_source_id: "candidate-source-1",
        team_source_type: "team_dynamics_aggregation_input_snapshot",
        team_source_id: "team-source-1",
        optional_context: { locale: "bs" },
        report_type: "team_fit_report_v1",
        report_version: "v1",
        report_status: "queued",
        input_snapshot: null,
        report_snapshot: null,
        error_message: null,
        queued_at: "2026-05-30T12:00:00.000Z",
        started_at: null,
        completed_at: null,
        failed_at: null,
        created_by: "user-1",
        created_at: "2026-05-30T12:00:00.000Z",
        updated_at: "2026-05-30T12:00:00.000Z",
      },
    ],
    attempt_reports: [{ id: "attempt-report-1", report_status: "queued" }],
    assessment_reports: [{ id: "assessment-report-1", report_status: "queued" }],
    team_assessment_reports: [{ id: "team-assessment-report-1", report_status: "queued" }],
  };
}

function assertNoUndefined(value) {
  if (value === undefined) {
    assert.fail("Encountered undefined in JSON-safe payload.");
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
  const inputSnapshot = buildInputSnapshot();
  const mockSnapshot = buildMockTeamFitReportSnapshot(inputSnapshot);
  const validation = validateTeamFitReportSnapshot(mockSnapshot);

  assert.equal(mockSnapshot.reportType, "team_fit_report_v1");
  assert.equal(mockSnapshot.reportVersion, "v1");
  assert.equal(mockSnapshot.audience, "hr_internal");
  assert.equal(mockSnapshot.sourceType, "candidate_team_relational");
  assert.deepEqual(mockSnapshot.source.candidateSourceTestSlugs, [
    "ipip-neo-120-v1",
    "safran_v1",
    "mwms_v1",
  ]);
  assert.deepEqual(mockSnapshot.source.teamSourceSnapshotIds, ["team-source-1"]);
  assert.match(mockSnapshot.fitOverview.relationshipPattern, /needs_validation|mixed_signal/);
  assert.ok(mockSnapshot.fitOverview);
  assert.ok(mockSnapshot.teamContextSummary);
  assert.ok(Array.isArray(mockSnapshot.candidateSignals));
  assert.ok(Array.isArray(mockSnapshot.complementaritySignals));
  assert.ok(Array.isArray(mockSnapshot.frictionRisks));
  assert.ok(mockSnapshot.interviewFocus);
  assert.ok(mockSnapshot.onboardingGuidance);
  assert.ok(mockSnapshot.managerGuidance);
  assert.ok(Array.isArray(mockSnapshot.watchouts));
  assert.ok(Array.isArray(mockSnapshot.interpretationLimits));
  assert.equal(validation.ok, true, validation.ok ? "" : validation.errors.join("; "));
  assert.equal("fitScore" in mockSnapshot, false);
  assert.equal("hireScore" in mockSnapshot, false);
  assert.equal("hireRecommendation" in mockSnapshot, false);
  assert.equal("rejectRecommendation" in mockSnapshot, false);
  assert.equal("rawAnswers" in mockSnapshot, false);
  assert.equal("teamMemberScores" in mockSnapshot, false);
  assert.equal(mockSnapshot.candidateVisible === true, false);
  assert.doesNotMatch(
    JSON.stringify(mockSnapshot),
    /\bno-hire\b|\breject\b|\bbad fit\b|\bculture fit\b|\bwill perform\b|\bdiagnosis\b/i,
  );
  assertNoUndefined(mockSnapshot);
  JSON.stringify(mockSnapshot);

  const processSupabase = createSupabaseStub(buildBaseState());
  const processed = await processTeamFitReportWithMock(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: processSupabase,
      now: () => "2026-05-30T12:30:00.000Z",
    },
  );

  assert.deepEqual(processed, {
    ok: true,
    reportId: "report-1",
    status: "ready",
  });

  const readyRow = processSupabase.state.team_fit_reports[0];
  assert.equal(readyRow.report_status, "ready");
  assert.equal(typeof readyRow.started_at, "string");
  assert.equal(typeof readyRow.completed_at, "string");
  assert.equal(readyRow.error_message, null);
  assert.ok(readyRow.input_snapshot);
  assert.ok(readyRow.report_snapshot);

  const readyValidation = validateTeamFitReportSnapshot(readyRow.report_snapshot);
  assert.equal(readyValidation.ok, true, readyValidation.ok ? "" : readyValidation.errors.join("; "));
  assert.equal(processSupabase.operations.some((entry) => entry.table === "attempt_reports" && entry.type === "update"), false);
  assert.equal(processSupabase.operations.some((entry) => entry.table === "assessment_reports" && entry.type === "update"), false);
  assert.equal(processSupabase.operations.some((entry) => entry.table === "team_assessment_reports" && entry.type === "update"), false);

  const wrongOrgSupabase = createSupabaseStub(buildBaseState());
  const wrongOrgResult = await processTeamFitReportWithMock(
    {
      teamFitReportId: "report-1",
      organizationId: "org-2",
    },
    {
      supabase: wrongOrgSupabase,
      now: () => "2026-05-30T12:30:00.000Z",
    },
  );

  assert.equal(wrongOrgResult.ok, false);
  assert.equal(wrongOrgResult.reason, "report_not_found");

  const invalidSupabase = createSupabaseStub(buildBaseState());
  const invalidResult = await processTeamFitReportWithMock(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: invalidSupabase,
      now: () => "2026-05-30T12:30:00.000Z",
      buildMockSnapshot() {
        return {
          reportType: "team_fit_report_v1",
          reportVersion: "v1",
          locale: "bs",
        };
      },
    },
  );

  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.reason, "provider_failed");
  assert.equal(invalidResult.marker, "TEAM_FIT_PROVIDER_VALIDATION_FAILURE");
  assert.equal(invalidSupabase.state.team_fit_reports[0].report_status, "failed");
  assert.equal(typeof invalidSupabase.state.team_fit_reports[0].failed_at, "string");
  assert.equal(
    invalidSupabase.state.team_fit_reports[0].error_message,
    "TEAM_FIT_PROVIDER_VALIDATION_FAILURE",
  );

  const refreshedTodoSource = fs.readFileSync(todoPath, "utf8");
  assert.match(refreshedTodoSource, /Completion note — Team Fit mock-safe generation shell/);
  assert.match(refreshedTodoSource, /Completion note — Team Fit provider seam shell/);

  console.log("test-team-fit-report-mock-generation: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
