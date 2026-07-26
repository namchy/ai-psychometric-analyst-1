const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const processorPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-v2-processor.ts");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;
const processorSource = fs.readFileSync(processorPath, "utf8");

assert.doesNotMatch(processorSource, /process\.env|fetch\s*\(|createChatCompletion|generateTeamFitReportV2WithOpenAI\s*\(/);
assert.doesNotMatch(processorSource, /actions|renderer|display|worker|scheduler|route/i);
assert.match(processorSource, /import type \{ GenerateTeamFitReportV2WithOpenAIResult \}/);

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) return candidatePath;
  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    if (fs.existsSync(`${candidatePath}${extension}`)) return `${candidatePath}${extension}`;
  }
  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only" || request === "@/lib/supabase/admin") return emptyModulePath;
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, resolveWithExtensions(path.join(projectRoot, request.slice(2))), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const transpiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
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

const { processTeamFitReportV2WithProvider } = require(processorPath);
const { validateTeamFitReportV2 } = require(path.join(projectRoot, "lib", "b2b", "team-fit-report-v2-contract.ts"));

const clone = (value) => JSON.parse(JSON.stringify(value));

function buildInput(identity = { reportType: "team_fit_report_v2", reportVersion: "v2" }) {
  return {
    inputType: "team_fit_report_input_v1",
    inputVersion: "team_fit_report_input_v2_enriched",
    ...identity,
    locale: "bs",
    generatedAt: "2026-07-26T10:00:00.000Z",
    organizationContext: { organizationId: "org-1", organizationName: "Partner Plus" },
    teamContext: {
      teamId: "team-1", teamName: "Tim A",
      teamSourceType: "team_dynamics_aggregation_input_snapshot", teamSourceId: "aggregation-1",
    },
    candidateContext: {
      participantId: "participant-1", displayName: "Amel",
      candidateSourceType: "composite_deterministic_input_snapshot", candidateSourceId: "candidate-assignment-1",
    },
    sourceReferences: {
      teamFitReportId: "report-1",
      candidateSourceType: "composite_deterministic_input_snapshot", candidateSourceId: "candidate-assignment-1",
      teamSourceType: "team_dynamics_aggregation_input_snapshot", teamSourceId: "aggregation-1",
      executiveOverviewContextIncluded: false, roleContextIncluded: false,
    },
    candidateSignals: {
      sourceStatus: "available", summary: "Kandidat",
      sourceMetadata: { assessmentAssignmentId: "candidate-assignment-1" },
      candidateEvidence: [],
    },
    teamSignals: {
      sourceStatus: "available", summary: "Tim",
      sourceMetadata: {
        teamAssessmentAssignmentId: "team-assignment-1",
        aggregationSnapshotId: "aggregation-1",
      },
      coreSignals: [], communicationAndCoordinationSignals: [],
    },
    interpretationGuardrails: {
      noNumericFitScore: true, noHireNoHire: true, noRawTeamMemberAnswers: true,
      noIndividualTeamMemberScoreDisplay: true, noCandidateFacingOutput: true,
    },
    relationshipReasoningGuardrails: { allowedPatterns: ["alignment_signal"], disallowedPatterns: [] },
  };
}

const catalog = {
  candidate: [{ key: "candidate:ipip-neo-120-v1:AGREEABLENESS", label: "Saradnja", value: {} }],
  team: [{ key: "team:tdm_domain_communication", label: "Komunikacija", value: {} }],
};

function buildSnapshot() {
  const text = "Konkretan nalaz";
  const refs = () => [
    { source: "candidate", key: catalog.candidate[0].key },
    { source: "team", key: catalog.team[0].key },
  ];
  const owned = () => ({ action: text, owner: "shared", timing: text, expectedResult: text });
  return {
    reportType: "team_fit_report_v2", reportVersion: "v2", locale: "bs",
    generatedAt: "2026-07-26T10:05:00.000Z",
    inputSnapshotVersion: "team_fit_report_input_v2_enriched",
    teamFitReportVersion: "v2", audience: "hr_internal", sourceType: "candidate_team_relational",
    teamContext: {
      organizationId: "org-1", teamId: "team-1", teamName: "Tim A",
      teamAssessmentAssignmentId: "team-assignment-1",
      teamDynamicsAggregationSnapshotId: "aggregation-1", teamDynamicsReportId: null,
    },
    candidateContext: {
      organizationId: "org-1", participantId: "participant-1",
      assessmentAssignmentId: "candidate-assignment-1",
      compositeInputSnapshotId: "candidate-assignment-1", compositeReportId: null, displayName: "Amel",
    },
    source: {
      candidateCompositeInputVersion: "composite_hr_input_v1", candidateSourceReportIds: [],
      candidateSourceTestSlugs: ["ipip-neo-120-v1"], teamInputVersion: "team_dynamics_final_aggregation_v1",
      teamSourceReportIds: [], teamSourceSnapshotIds: ["aggregation-1"], optionalContextKeys: [],
    },
    executiveAssessment: {
      category: "good_fit_with_conditions", headline: text, conclusion: text, decisionGuidance: text,
      mainReasons: [0, 1].map(() => ({ title: text, explanation: text, practicalConsequence: text, evidenceRefs: refs() })),
    },
    keySignals: [0, 1, 2].map(() => ({ title: text, explanation: text, practicalMeaning: text, evidenceRefs: refs() })),
    likelyContributions: [0, 1].map(() => ({ title: text, explanation: text, conditions: text, evidenceRefs: refs() })),
    successConditions: [0, 1].map(() => ({ title: text, condition: text, whyItMatters: text, owner: "hiring_manager", timing: text })),
    frictionRisks: [0, 1].map(() => ({ title: text, trigger: text, likelyPattern: text, teamImpact: text, mitigation: text, owner: "team_lead", timing: text, evidenceRefs: refs() })),
    interviewPlan: [0, 1, 2].map(() => ({ question: text, purpose: text, whatToListenFor: text, positiveSignals: [text], concernSignals: [text], evidenceRefs: refs() })),
    teamIntegrationPlan: {
      summary: text, adaptForThisTeam: [owned()],
      teamPreparations: [{ action: text, owner: "team", timing: text }],
      first30Days: [owned(), owned()], successSignals: [text, text], earlyFrictionSignals: [text, text],
    },
    managerGuidance: [0, 1, 2].map(() => ({ action: text, rationale: text, timing: text, watchFor: text })),
    interpretationLimits: [text],
    metadata: { provider: "injected_test", providerVersion: "v1", generatedAt: "2026-07-26T10:05:00.000Z" },
  };
}

function buildRow(identity = { report_type: "team_fit_report_v2", report_version: "v2" }, inputSnapshot = null) {
  return {
    id: "report-1", organization_id: "org-1", team_id: "team-1", participant_id: "participant-1",
    candidate_source_type: "composite_deterministic_input_snapshot", candidate_source_id: "candidate-assignment-1",
    team_source_type: "team_dynamics_aggregation_input_snapshot", team_source_id: "aggregation-1",
    optional_context: {}, ...identity, report_status: "queued", input_snapshot: inputSnapshot,
    report_snapshot: null, error_message: null, queued_at: "2026-07-26T10:00:00.000Z",
    started_at: null, completed_at: null, failed_at: null, created_by: null,
    created_at: "2026-07-26T10:00:00.000Z", updated_at: "2026-07-26T10:00:00.000Z",
  };
}

function createSupabaseStub(row, options = {}) {
  const state = { team_fit_reports: [row] };
  const operations = [];
  return {
    state, operations,
    from(table) {
      assert.equal(table, "team_fit_reports");
      const query = { mode: "select", filters: [], patch: null };
      const builder = {
        select() { return builder; },
        eq(column, value) { query.filters.push([column, value]); operations.push({ type: "eq", mode: query.mode, column, value }); return builder; },
        update(patch) { query.mode = "update"; query.patch = patch; operations.push({ type: "update", patch }); return builder; },
        async maybeSingle() {
          const matched = state.team_fit_reports.find((candidate) => query.filters.every(([column, value]) => candidate[column] === value)) ?? null;
          if (query.mode !== "update") return { data: matched, error: null };
          if ((query.patch.report_status === "ready" && options.readyCasMiss) || (query.patch.report_status === "failed" && options.failCasMiss)) {
            return { data: null, error: null };
          }
          if (!matched) return { data: null, error: null };
          Object.assign(matched, query.patch);
          return { data: matched, error: null };
        },
      };
      return builder;
    },
  };
}

function successProvider(snapshot = buildSnapshot()) {
  const calls = [];
  return {
    calls,
    provider: {
      async generate(input) {
        calls.push(input);
        return {
          ok: true, snapshot: clone(snapshot), rawContent: "{}", model: "test",
          promptVersion: "test", provider: "injected", providerVersion: "test", evidenceCatalog: clone(catalog),
        };
      },
    },
  };
}

async function run(overrides = {}) {
  const input = overrides.input ?? buildInput();
  const row = overrides.row ?? buildRow(undefined, overrides.existingInput === true ? clone(input) : null);
  const supabase = createSupabaseStub(row, overrides.supabaseOptions);
  const providerHarness = overrides.providerHarness ?? successProvider(overrides.snapshot);
  let buildCount = 0;
  let persistCount = 0;
  const result = await processTeamFitReportV2WithProvider(
    overrides.payload ?? { teamFitReportId: "report-1", organizationId: "org-1" },
    {
      supabase,
      now: () => "2026-07-26T10:05:00.000Z",
      provider: providerHarness.provider,
      buildInputSnapshot: async () => { buildCount += 1; return { ok: true, reportId: "report-1", inputSnapshot: clone(input) }; },
      persistInputSnapshot: async () => { persistCount += 1; row.input_snapshot = clone(input); return { ok: true, reportId: "report-1", inputSnapshot: clone(input) }; },
    },
  );
  return { result, row, supabase, providerHarness, buildCount, persistCount };
}

async function main() {
  assert.equal(validateTeamFitReportV2(buildSnapshot()).ok, true);

  const invalidPayload = await run({ payload: { teamFitReportId: "", organizationId: "org-1" } });
  assert.equal(invalidPayload.result.reason, "invalid_payload");
  assert.equal(invalidPayload.providerHarness.calls.length, 0);

  const v1Row = buildRow({ report_type: "team_fit_report_v1", report_version: "v1" });
  const wrongIdentity = await run({ row: v1Row });
  assert.equal(wrongIdentity.result.reason, "not_claimable");
  assert.equal(wrongIdentity.providerHarness.calls.length, 0);
  assert.equal(wrongIdentity.buildCount + wrongIdentity.persistCount, 0);
  assert.equal(v1Row.report_status, "queued");
  assert.equal(v1Row.report_snapshot, null);

  const immutableInput = buildInput();
  const immutableSnapshot = buildSnapshot();
  const inputBefore = clone(immutableInput);
  const snapshotBefore = clone(immutableSnapshot);
  const ready = await run({ input: immutableInput, snapshot: immutableSnapshot });
  assert.deepEqual(ready.result, { ok: true, reportId: "report-1", status: "ready" });
  assert.equal(ready.persistCount, 1);
  assert.equal(ready.buildCount, 0);
  assert.equal(ready.providerHarness.calls.length, 1);
  assert.equal(ready.row.report_status, "ready");
  assert.deepEqual(ready.row.report_snapshot, buildSnapshot());
  assert.deepEqual(immutableInput, inputBefore);
  assert.deepEqual(immutableSnapshot, snapshotBefore);

  const reused = await run({ existingInput: true });
  assert.equal(reused.result.ok, true);
  assert.equal(reused.buildCount, 1);
  assert.equal(reused.persistCount, 0);

  for (const identity of [
    { reportType: "team_fit_report_v1", reportVersion: "v1" },
    { reportType: "team_fit_report_v2", reportVersion: "v1" },
  ]) {
    const invalidInput = await run({ input: buildInput(identity) });
    assert.equal(invalidInput.result.reason, "input_snapshot_failed");
    assert.equal(invalidInput.providerHarness.calls.length, 0);
    assert.equal(invalidInput.row.report_status, "failed");
  }

  const providerFailures = [
    ["config_error", "configuration"], ["input_incomplete", "input_validation"],
    ["evidence_catalog_collision", "input_validation"], ["provider_failure", "provider_transport"],
    ["empty_content", "response_content"], ["invalid_json", "json_parse"],
    ["contract_incomplete", "contract_validation"], ["invalid_evidence_reference", "evidence_validation"],
  ];
  for (const [code, stage] of providerFailures) {
    const harness = { calls: [], provider: { async generate(input) { harness.calls.push(input); return { ok: false, code, stage, message: "sensitive detail" }; } } };
    const failure = await run({ providerHarness: harness });
    assert.equal(failure.result.reason, "provider_failed");
    assert.equal(failure.result.providerCode, code);
    assert.equal(failure.result.providerStage, stage);
    assert.match(failure.result.marker, /^TEAM_FIT_V2_PROVIDER_/);
    assert.equal(harness.calls.length, 1);
    assert.equal(failure.row.report_status, "failed");
    assert.equal(failure.row.error_message, failure.result.marker);
    assert.equal(failure.row.error_message.includes("sensitive"), false);
  }

  const invalidContractSnapshot = buildSnapshot();
  delete invalidContractSnapshot.executiveAssessment;
  const invalidContract = await run({ snapshot: invalidContractSnapshot });
  assert.equal(invalidContract.result.reason, "provider_validation_failed");
  assert.equal(invalidContract.result.marker, "TEAM_FIT_V2_CONTRACT_VALIDATION_FAILURE");
  assert.equal(invalidContract.row.report_status, "failed");

  const invalidEvidenceSnapshot = buildSnapshot();
  invalidEvidenceSnapshot.keySignals[0].evidenceRefs[0].key = "candidate:unknown:key";
  const invalidEvidence = await run({ snapshot: invalidEvidenceSnapshot });
  assert.equal(invalidEvidence.result.marker, "TEAM_FIT_V2_EVIDENCE_VALIDATION_FAILURE");
  assert.equal(invalidEvidence.row.report_status, "failed");

  const lineageSnapshot = buildSnapshot();
  lineageSnapshot.teamContext.teamId = "other-team";
  const lineage = await run({ snapshot: lineageSnapshot });
  assert.equal(lineage.result.marker, "TEAM_FIT_V2_LINEAGE_VALIDATION_FAILURE");
  assert.match(lineage.result.message, /teamContext\.teamId/);
  assert.equal(lineage.row.report_status, "failed");

  const readyMiss = await run({ supabaseOptions: { readyCasMiss: true } });
  assert.equal(readyMiss.result.reason, "ready_update_failed");
  assert.notEqual(readyMiss.row.report_status, "ready");

  const failHarness = { calls: [], provider: { async generate(input) { failHarness.calls.push(input); return { ok: false, code: "provider_failure", stage: "provider_request", message: "x" }; } } };
  const failMiss = await run({ providerHarness: failHarness, supabaseOptions: { failCasMiss: true } });
  assert.equal(failMiss.result.reason, "fail_transition_failed");
  assert.notEqual(failMiss.row.report_status, "ready");
  assert.equal(failHarness.calls.length, 1);

  console.log("test-team-fit-report-v2-processor: ok");
}

main().catch((error) => {
  console.error("test-team-fit-report-v2-processor failed");
  console.error(error);
  process.exitCode = 1;
});
