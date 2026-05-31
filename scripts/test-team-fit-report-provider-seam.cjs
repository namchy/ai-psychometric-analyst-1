const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const providerPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-provider.ts");
const openAiProviderPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-openai-provider.ts");
const processorPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-processor.ts");
const contractPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-contract.ts");
const inputPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-input.ts");
const mockPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-mock.ts");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const providerSource = fs.readFileSync(providerPath, "utf8");
const openAiProviderSource = fs.readFileSync(openAiProviderPath, "utf8");
const processorSource = fs.readFileSync(processorPath, "utf8");

assert.match(providerSource, /export type TeamFitReportProvider/);
assert.match(providerSource, /createTeamFitFakeProvider/);
assert.match(providerSource, /createTeamFitStaticFailureProvider/);
assert.match(providerSource, /validateTeamFitProviderSnapshotResult/);
assert.doesNotMatch(providerSource, /OpenAI|api\.openai|chat\/completions|fetch\(/i);
assert.doesNotMatch(providerSource, /\.from\("/);
assert.doesNotMatch(providerSource, /processTeamFitReportWithMock|claimTeamFitReportForProcessing/);
assert.match(openAiProviderSource, /createTeamFitOpenAiProvider/);
assert.doesNotMatch(openAiProviderSource, /\.from\("/);
assert.doesNotMatch(openAiProviderSource, /attempt_reports|assessment_reports|team_assessment_reports/);
assert.doesNotMatch(processorSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(processorSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(processorSource, /\.from\("team_assessment_reports"\)/);
assert.match(processorSource, /processTeamFitReport\(/);
assert.match(processorSource, /processTeamFitReportWithProvider/);
assert.match(processorSource, /TEAM_FIT_REPORT_PROVIDER_OPENAI/);
assert.match(processorSource, /TEAM_FIT_PROVIDER_CONFIG_ERROR/);
assert.match(processorSource, /TEAM_FIT_PROVIDER_REQUEST_FAILED/);
assert.match(processorSource, /TEAM_FIT_PROVIDER_PARSE_FAILURE/);
assert.match(processorSource, /TEAM_FIT_PROVIDER_VALIDATION_FAILURE/);
assert.match(processorSource, /TEAM_FIT_PROVIDER_UNKNOWN_ERROR/);
assert.doesNotMatch(processorSource, /renderer|worker|scheduler|cron/i);

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
  createTeamFitFakeProvider,
  validateTeamFitProviderSnapshotResult,
} = require(providerPath);
const { validateTeamFitReportSnapshot } = require(contractPath);
const { buildMockTeamFitReportSnapshot } = require(mockPath);
const {
  TEAM_FIT_REPORT_INPUT_TYPE,
  TEAM_FIT_REPORT_INPUT_VERSION,
} = require(inputPath);
const {
  processTeamFitReportWithMock,
  processTeamFitReport,
  processTeamFitReportWithProvider,
} = require(processorPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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
        select() {
          operations.push({ type: "select", table });
          return query;
        },
        eq(column, value) {
          query.filters.push({ type: "eq", column, value });
          return query;
        },
        update(patch) {
          operations.push({ type: "update", table, patch });
          query.mode = "update";
          query.patch = patch;
          return query;
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

      return query;
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

async function main() {
  const inputSnapshot = buildInputSnapshot();

  const validProvider = createTeamFitFakeProvider({
    providerMetadata: {
      provider: "team_fit_fake",
      providerVersion: "v1",
    },
  });
  const validProviderResult = await validProvider.generate(inputSnapshot);
  assert.equal(validProviderResult.ok, true);
  if (!validProviderResult.ok) {
    throw new Error(validProviderResult.message);
  }
  assert.equal(validateTeamFitReportSnapshot(validProviderResult.snapshot).ok, true);
  assert.equal(validProviderResult.providerMetadata.provider, "team_fit_fake");

  const invalidProvider = createTeamFitFakeProvider({
    invalidSnapshot: (snapshotInput) => {
      const invalid = clone(validProviderResult.snapshot);
      invalid.reportType = snapshotInput.reportType === "team_fit_report_v1" ? "bad_type" : "team_fit_report_v1";
      return invalid;
    },
  });
  const invalidProviderResult = await invalidProvider.generate(inputSnapshot);
  assert.deepEqual(invalidProviderResult, {
    ok: false,
    reason: "provider_validation_failure",
    message: invalidProviderResult.message,
    retryable: false,
  });
  assert.match(invalidProviderResult.message, /reportType/);

  for (const failureMode of ["config_error", "request_failed", "parse_failure", "validation_failure"]) {
    const failureProvider = createTeamFitFakeProvider({ failureMode });
    const failureResult = await failureProvider.generate(inputSnapshot);
    assert.equal(failureResult.ok, false);
    if (failureResult.ok) {
      throw new Error(`Expected fake provider failure for ${failureMode}.`);
    }
  }

  const helperValidation = validateTeamFitProviderSnapshotResult(validProviderResult.snapshot);
  assert.equal(helperValidation.ok, true);

  const processSupabase = createSupabaseStub(buildBaseState());
  const processReady = await processTeamFitReportWithProvider(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: processSupabase,
      now: () => "2026-05-30T12:30:00.000Z",
      provider: createTeamFitFakeProvider(),
    },
  );

  assert.deepEqual(processReady, {
    ok: true,
    reportId: "report-1",
    status: "ready",
  });
  const readyRow = processSupabase.state.team_fit_reports[0];
  assert.equal(readyRow.report_status, "ready");
  assert.equal(readyRow.completed_at, "2026-05-30T12:30:00.000Z");
  assert.equal(readyRow.error_message, null);
  assert.ok(readyRow.input_snapshot);
  assert.ok(readyRow.report_snapshot);
  const readySnapshotValidation = validateTeamFitReportSnapshot(readyRow.report_snapshot);
  assert.equal(readySnapshotValidation.ok, true);
  assert.equal(
    processSupabase.operations.some(
      (operation) =>
        operation.table === "attempt_reports" ||
        operation.table === "assessment_reports" ||
        operation.table === "team_assessment_reports",
    ),
    false,
  );

  const noInputSupabase = createSupabaseStub(buildBaseState());
  noInputSupabase.state.team_fit_reports[0].input_snapshot = null;
  const noInputResult = await processTeamFitReportWithProvider(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: noInputSupabase,
      now: () => "2026-05-30T12:31:00.000Z",
      provider: createTeamFitFakeProvider(),
    },
  );
  assert.equal(noInputResult.ok, true);
  assert.ok(noInputSupabase.state.team_fit_reports[0].input_snapshot);

  const failedSupabase = createSupabaseStub(buildBaseState());
  const failedResult = await processTeamFitReportWithProvider(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: failedSupabase,
      now: () => "2026-05-30T12:32:00.000Z",
      provider: createTeamFitFakeProvider({ failureMode: "validation_failure" }),
    },
  );
  assert.equal(failedResult.ok, false);
  if (failedResult.ok) {
    throw new Error("Expected provider failure.");
  }
  assert.equal(failedResult.reason, "provider_failed");
  assert.equal(failedResult.marker, "TEAM_FIT_PROVIDER_VALIDATION_FAILURE");
  assert.equal(failedSupabase.state.team_fit_reports[0].report_status, "failed");
  assert.equal(
    failedSupabase.state.team_fit_reports[0].error_message,
    "TEAM_FIT_PROVIDER_VALIDATION_FAILURE",
  );

  const wrongOrganizationSupabase = createSupabaseStub(buildBaseState());
  const wrongOrganizationResult = await processTeamFitReportWithProvider(
    {
      teamFitReportId: "report-1",
      organizationId: "org-wrong",
    },
    {
      supabase: wrongOrganizationSupabase,
      now: () => "2026-05-30T12:33:00.000Z",
      provider: createTeamFitFakeProvider(),
    },
  );
  assert.equal(wrongOrganizationResult.ok, false);
  if (wrongOrganizationResult.ok) {
    throw new Error("Expected wrong organization failure.");
  }
  assert.match(wrongOrganizationResult.reason, /report_not_found|not_claimable/);

  const mockCompatibleSupabase = createSupabaseStub(buildBaseState());
  const mockCompatibleResult = await processTeamFitReportWithMock(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: mockCompatibleSupabase,
      now: () => "2026-05-30T12:34:00.000Z",
    },
  );
  assert.deepEqual(mockCompatibleResult, {
    ok: true,
    reportId: "report-1",
    status: "ready",
  });

  const envMockSupabase = createSupabaseStub(buildBaseState());
  delete process.env.TEAM_FIT_REPORT_PROVIDER;
  const envMockResult = await processTeamFitReport(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: envMockSupabase,
      now: () => "2026-05-30T12:35:00.000Z",
    },
  );
  assert.deepEqual(envMockResult, {
    ok: true,
    reportId: "report-1",
    status: "ready",
  });

  const unsupportedProviderSupabase = createSupabaseStub(buildBaseState());
  const unsupportedProviderResult = await processTeamFitReport(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: unsupportedProviderSupabase,
      now: () => "2026-05-30T12:36:00.000Z",
      providerMode: "mockish",
    },
  );
  assert.equal(unsupportedProviderResult.ok, false);
  if (unsupportedProviderResult.ok) {
    throw new Error("Expected unsupported provider failure.");
  }
  assert.equal(unsupportedProviderResult.reason, "provider_failed");
  assert.equal(unsupportedProviderResult.marker, "TEAM_FIT_PROVIDER_CONFIG_ERROR");

  const openAiValidSnapshot = buildMockTeamFitReportSnapshot(buildInputSnapshot());
  openAiValidSnapshot.metadata.provider = "openai";
  openAiValidSnapshot.metadata.providerVersion = "v1";
  const openAiReadySupabase = createSupabaseStub(buildBaseState());
  const openAiReadyResult = await processTeamFitReport(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: openAiReadySupabase,
      now: () => "2026-05-30T12:37:00.000Z",
      providerMode: "openai",
      teamFitOpenAiOptions: {
        apiKey: "test-key",
        model: "gpt-5.1",
        now: () => "2026-05-30T12:37:00.000Z",
        client: {
          async createChatCompletion() {
            return { content: JSON.stringify(openAiValidSnapshot) };
          },
        },
      },
    },
  );
  assert.deepEqual(openAiReadyResult, {
    ok: true,
    reportId: "report-1",
    status: "ready",
  });
  assert.equal(openAiReadySupabase.state.team_fit_reports[0].report_status, "ready");

  const openAiInvalidSnapshot = clone(openAiValidSnapshot);
  delete openAiInvalidSnapshot.fitOverview;
  const openAiFailedSupabase = createSupabaseStub(buildBaseState());
  const openAiFailedResult = await processTeamFitReport(
    {
      teamFitReportId: "report-1",
      organizationId: "org-1",
    },
    {
      supabase: openAiFailedSupabase,
      now: () => "2026-05-30T12:38:00.000Z",
      providerMode: "openai",
      teamFitOpenAiOptions: {
        apiKey: "test-key",
        model: "gpt-5.1",
        now: () => "2026-05-30T12:38:00.000Z",
        client: {
          async createChatCompletion() {
            return { content: JSON.stringify(openAiInvalidSnapshot) };
          },
        },
      },
    },
  );
  assert.equal(openAiFailedResult.ok, false);
  if (openAiFailedResult.ok) {
    throw new Error("Expected OpenAI invalid snapshot failure.");
  }
  assert.equal(openAiFailedResult.reason, "provider_failed");
  assert.equal(openAiFailedResult.marker, "TEAM_FIT_PROVIDER_VALIDATION_FAILURE");
  assert.equal(openAiFailedSupabase.state.team_fit_reports[0].report_status, "failed");

  console.log("test-team-fit-report-provider-seam: ok");
}

main().catch((error) => {
  console.error("test-team-fit-report-provider-seam failed");
  console.error(error);
  process.exitCode = 1;
});
