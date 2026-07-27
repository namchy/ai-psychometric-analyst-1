const crypto = require("node:crypto");
const fs = require("node:fs");

const {
  runCanonicalPreview,
  sanitizeForDump,
  writeDiagnosticArtifact,
} = require("./inspect-team-fit-report-v2-canonical-preview.cjs");

const CONFIRM_TOKEN = "PERSIST_ACCEPTED_TEAM_FIT_V2_GD001_GDT01";
const ACCEPTED_ARTIFACT_PATH = "/tmp/team-fit-v2-gd001-gdt01-prompt-v2-final-preview.json";
const ARTIFACT_PATH = "/tmp/team-fit-v2-gd001-gdt01-persisted-smoke.json";
const TIMEOUT_ENV = "TEAM_FIT_V2_CANONICAL_PERSISTED_SMOKE_TIMEOUT_MS";
const DEFAULT_TIMEOUT_MS = 900000;
const V2_TYPE = "team_fit_report_v2";
const V2_VERSION = "v2";
const PROMPT_VERSION = "team_fit_report_v2_prompt_v2";
const ACCEPTED_REPORT_SHA = "c83dfe3ba889cc9749afbccf4ba46ed75fd466318d8884e51c5c5c1522e3dbdf";
const ROW_FIELDS = [
  "id", "organization_id", "team_id", "participant_id", "candidate_source_type",
  "candidate_source_id", "team_source_type", "team_source_id", "optional_context",
  "report_type", "report_version", "report_status", "input_snapshot", "report_snapshot",
  "error_message", "queued_at", "started_at", "completed_at", "failed_at", "created_by",
  "created_at", "updated_at",
];

function sha256(value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableStringify(value) { return JSON.stringify(stableValue(value)); }
function semanticSha256(value) { return crypto.createHash("sha256").update(stableStringify(value)).digest("hex"); }

function parseTimeoutMs(rawValue) {
  if (rawValue == null || String(rawValue).trim() === "") return DEFAULT_TIMEOUT_MS;
  if (!/^\d+$/.test(String(rawValue).trim())) throw new Error(`${TIMEOUT_ENV} must be a positive integer.`);
  const value = Number(String(rawValue).trim());
  if (!Number.isSafeInteger(value) || value < 1000 || value > DEFAULT_TIMEOUT_MS) {
    throw new Error(`${TIMEOUT_ENV} must be between 1000 and ${DEFAULT_TIMEOUT_MS}.`);
  }
  return value;
}

function parseCli(argv = process.argv.slice(2)) {
  const apply = argv.includes("--apply");
  const confirmIndex = argv.indexOf("--confirm");
  const confirmation = confirmIndex >= 0 ? argv[confirmIndex + 1] : null;
  const unknown = argv.filter((arg, index) => {
    if (arg === "--apply" || arg === "--confirm" || (confirmIndex >= 0 && index === confirmIndex + 1)) return false;
    return true;
  });
  if (unknown.length > 0) throw new Error(`Unknown CLI argument: ${unknown.join(", ")}`);
  return { apply, confirmation, confirmed: apply && confirmation === CONFIRM_TOKEN };
}

function getCanonical(sourceArtifact) {
  const source = sourceArtifact?.sourceResolution;
  const candidateCoverage = sourceArtifact?.inputSummary?.candidateCoverage;
  const teamCoverage = sourceArtifact?.inputSummary?.teamCoverage;
  if (!source || source.candidate?.fixtureKey !== "GD-001" || source.team?.fixtureKey !== "GDT-01") {
    throw new Error("Canonical source resolution did not return GD-001 × GDT-01.");
  }
  if (candidateCoverage?.requiredCount !== 3 || candidateCoverage?.completedCount !== 3 || candidateCoverage?.missingTestSlugs?.length !== 0) {
    throw new Error("Canonical candidate coverage is not exact 3/3.");
  }
  if (teamCoverage?.teamFullCoverage !== true || teamCoverage?.includedMemberCount !== 6 || teamCoverage?.completedMemberCount !== 6 || teamCoverage?.readyScoredMemberCount !== 6 || teamCoverage?.incompleteMemberCount !== 0 || teamCoverage?.missingScoreCount !== 0 || teamCoverage?.invalidScoreCount !== 0) {
    throw new Error("Canonical team coverage is not exact 6/6/6 with zero exclusions.");
  }
  if (Object.values(source.ambiguityChecks ?? {}).some((count) => count !== 1)) throw new Error("Canonical source resolution is ambiguous or incomplete.");
  if (Object.values(source.lineage ?? {}).some((value) => value !== true)) throw new Error("Canonical source lineage is incomplete.");
  return {
    organizationId: source.organization.id,
    organizationName: source.organization.name,
    participantId: source.candidate.participantId,
    participantName: source.candidate.displayName,
    candidateAssignmentId: source.candidate.assignmentId,
    teamId: source.team.teamId,
    teamName: source.team.teamName,
    teamAssignmentId: source.team.teamAssessmentAssignmentId,
    aggregationSnapshotId: source.team.aggregationSnapshotId,
    locale: sourceArtifact?.inputSummary?.locale ?? "bs",
    candidateCoverage,
    teamCoverage,
  };
}

function loadAcceptedArtifact(filePath = ACCEPTED_ARTIFACT_PATH, fsImpl = fs) {
  if (!fsImpl.existsSync(filePath)) throw new Error(`Accepted preview artifact is missing: ${filePath}`);
  let artifact;
  try { artifact = JSON.parse(fsImpl.readFileSync(filePath, "utf8")); } catch (error) {
    throw new Error(`Accepted preview artifact is not valid JSON: ${error.message}`);
  }
  const snapshot = artifact?.reportSnapshot;
  const reportSha = snapshot ? sha256(snapshot) : null;
  if (!snapshot || snapshot.reportType !== V2_TYPE || snapshot.reportVersion !== V2_VERSION || artifact.reportSnapshotSha256 !== ACCEPTED_REPORT_SHA || reportSha !== ACCEPTED_REPORT_SHA) {
    throw new Error(`Accepted preview artifact SHA or identity mismatch: expected ${ACCEPTED_REPORT_SHA}, received ${reportSha ?? artifact?.reportSnapshotSha256 ?? "missing"}.`);
  }
  if (artifact?.providerResult?.promptVersion !== PROMPT_VERSION) throw new Error("Accepted preview artifact prompt version mismatch.");
  if (artifact?.metadata?.databaseWrites !== false || artifact?.metadata?.persistence !== false || artifact?.metadata?.openAiCalled !== true || artifact?.metadata?.transportCallCount !== 1) throw new Error("Accepted preview artifact does not carry the expected no-write single-preview metadata.");
  return { artifact, snapshot, reportSha256: reportSha, semanticSha256: semanticSha256(snapshot) };
}

function analyzePreState(rows, canonical, acceptedSha = null) {
  const v2Rows = rows.filter((row) => row.report_type === V2_TYPE && row.report_version === V2_VERSION);
  const canonicalV2Rows = v2Rows.filter((row) => row.organization_id === canonical.organizationId && row.team_id === canonical.teamId && row.participant_id === canonical.participantId);
  const acceptedReady = canonicalV2Rows.find((row) => row.report_status === "ready" && row.report_snapshot && semanticSha256(row.report_snapshot) === acceptedSha);
  const inFlight = canonicalV2Rows.filter((row) => row.report_status === "queued" || row.report_status === "processing");
  return {
    eligible: !acceptedReady && inFlight.length === 0,
    exactMatchNoop: Boolean(acceptedReady),
    acceptedReadyReportId: acceptedReady?.id ?? null,
    inFlightReportIds: inFlight.map((row) => row.id),
    totalCount: rows.length,
    globalV2Count: v2Rows.length,
    canonicalV2Count: canonicalV2Rows.length,
    canonicalReadyCount: canonicalV2Rows.filter((row) => row.report_status === "ready").length,
  };
}

function createScopedSupabaseGuard(client, options) {
  const audit = { reads: [], mutations: [], blocked: [] };
  const cache = new WeakMap();
  let allowedReportId = null;
  function block(message) { audit.blocked.push(message); throw new Error(message); }
  function validateMutation(context) {
    if (!context || context.validated) return;
    context.validated = true;
    if (!options.allowWrites) block("DB mutation blocked in read-only mode.");
    if (context.table !== "team_fit_reports") block(`DB mutation blocked on ${context.table}.`);
    if (context.operation === "insert") {
      if (audit.mutations.filter((entry) => entry.operation === "insert").length > 1) block("More than one Team Fit V2 insert is blocked.");
      const row = Array.isArray(context.payload) ? context.payload[0] : context.payload;
      if (Array.isArray(context.payload) || !row || row.report_type !== V2_TYPE || row.report_version !== V2_VERSION) block("Only one V2/V2 Team Fit insert is allowed.");
      if (row.organization_id !== options.canonical.organizationId || row.team_id !== options.canonical.teamId || row.participant_id !== options.canonical.participantId) block("Team Fit insert is outside the canonical GD-001 × GDT-01 scope.");
      return;
    }
    if (context.operation !== "update") block(`${context.operation} is not allowed.`);
    const filterMap = new Map(context.filters.map(({ column, value }) => [column, value]));
    if (!allowedReportId || filterMap.get("id") !== allowedReportId) block("Team Fit update is not scoped to the newly inserted V2 row.");
    if (filterMap.get("organization_id") !== options.canonical.organizationId) block("Team Fit update is not organization scoped.");
    if (filterMap.get("report_type") !== V2_TYPE || filterMap.get("report_version") !== V2_VERSION) block("Team Fit update is not V2 identity scoped.");
    if (Object.hasOwn(context.payload ?? {}, "report_type") || Object.hasOwn(context.payload ?? {}, "report_version") || Object.hasOwn(context.payload ?? {}, "id") || Object.hasOwn(context.payload ?? {}, "organization_id")) block("Team Fit identity mutation is blocked.");
  }
  function wrap(query, table, context = null) {
    if (!query || (typeof query !== "object" && typeof query !== "function")) return query;
    if (cache.has(query) && !context) return cache.get(query);
    const proxy = new Proxy(query, { get(target, property) {
      if (["delete", "upsert", "rpc"].includes(property)) return () => block(`${String(property)} is blocked.`);
      if (["insert", "update"].includes(property)) return (payload) => {
        const next = { table, operation: property, payload, filters: [], validated: false };
        audit.mutations.push({ table, operation: property, payloadKeys: Object.keys(Array.isArray(payload) ? payload[0] ?? {} : payload ?? {}), filters: next.filters });
        return wrap(target[property](payload), table, next);
      };
      if (property === "eq" && context) return (column, value) => { context.filters.push({ column, value }); return wrap(target.eq(column, value), table, context); };
      if (property === "then") return (resolve, reject) => { try { validateMutation(context); } catch (error) { return Promise.reject(error).then(resolve, reject); } return target.then(resolve, reject); };
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      return (...args) => wrap(value.apply(target, args), table, context);
    }});
    if (!context) cache.set(query, proxy);
    return proxy;
  }
  return {
    client: { from(table) { audit.reads.push(table); return wrap(client.from(table), table); }, rpc() { return block("RPC is blocked for the canonical persisted smoke."); } },
    audit,
    setAllowedReportId(reportId) { if (allowedReportId && allowedReportId !== reportId) block("A second V2 report scope is blocked."); allowedReportId = reportId; },
    assertFinal({ requireInsert = options.allowWrites } = {}) { const inserts = audit.mutations.filter((entry) => entry.operation === "insert"); if (requireInsert && inserts.length !== 1) throw new Error("Expected exactly one V2 insert."); if (audit.mutations.some((entry) => entry.table !== "team_fit_reports")) throw new Error("Write outside team_fit_reports was detected."); return { insertCount: inserts.length, updateCount: audit.mutations.filter((entry) => entry.operation === "update").length, mutations: audit.mutations, blocked: audit.blocked }; },
  };
}

async function readAllRows(supabase) {
  const { data, error } = await supabase.from("team_fit_reports").select(ROW_FIELDS.join(", "));
  if (error) throw new Error(`Failed to read team_fit_reports: ${error.message}`);
  return data ?? [];
}

function assertPersistedInput(input, canonical) {
  if (!input || input.reportType !== V2_TYPE || input.reportVersion !== V2_VERSION) throw new Error("Persisted input is not Team Fit V2/V2.");
  const checks = [[input.organizationContext?.organizationId, canonical.organizationId, "organization"], [input.candidateContext?.participantId, canonical.participantId, "participant"], [input.teamContext?.teamId, canonical.teamId, "team"], [input.candidateContext?.candidateSourceId, canonical.candidateAssignmentId, "candidate source"], [input.teamContext?.teamSourceId, canonical.aggregationSnapshotId, "team source"]];
  for (const [actual, expected, label] of checks) if (actual !== expected) throw new Error(`Persisted input ${label} lineage mismatch.`);
  if ((input.candidateSignals?.sourceMetadata?.sourceTestSlugs ?? []).length !== 3) throw new Error("Persisted candidate input does not preserve 3/3 coverage.");
  const variance = input.teamSignals?.varianceAndConfidence;
  if (variance?.includedMemberCount !== 6 || variance?.completedMemberCount !== 6 || variance?.readyScoredMemberCount !== 6) throw new Error("Persisted team input does not preserve 6/6/6 coverage.");
}

function assertReportLineage(report, input, canonical) {
  const checks = [[report.reportType, V2_TYPE, "reportType"], [report.reportVersion, V2_VERSION, "reportVersion"], [report.inputSnapshotVersion, input.inputVersion, "inputSnapshotVersion"], [report.teamContext?.organizationId, canonical.organizationId, "team organization"], [report.teamContext?.teamId, canonical.teamId, "team"], [report.candidateContext?.organizationId, canonical.organizationId, "candidate organization"], [report.candidateContext?.participantId, canonical.participantId, "participant"]];
  for (const [actual, expected, label] of checks) if (actual !== expected) throw new Error(`Persisted report ${label} lineage mismatch.`);
  if (report.candidateContext?.compositeInputSnapshotId && report.candidateContext.compositeInputSnapshotId !== canonical.candidateAssignmentId) throw new Error("Persisted report candidate source lineage mismatch.");
  if (report.teamContext?.teamDynamicsAggregationSnapshotId && report.teamContext.teamDynamicsAggregationSnapshotId !== canonical.aggregationSnapshotId) throw new Error("Persisted report aggregation lineage mismatch.");
}

function loadRuntimeDependencies() {
  const root = require("node:path").resolve(__dirname, "..");
  const load = (relative) => require(require("node:path").join(root, relative));
  const { createSupabaseAdminClient } = load("lib/supabase/admin.ts");
  const lifecycle = load("lib/b2b/team-fit-report-lifecycle.ts");
  const { processTeamFitReportV2WithProvider } = load("lib/b2b/team-fit-report-v2-processor.ts");
  const contract = load("lib/b2b/team-fit-report-v2-contract.ts");
  const evidence = load("lib/b2b/team-fit-report-v2-evidence.ts");
  const display = load("lib/b2b/team-fit-report-display.ts");
  const list = load("lib/b2b/team-fit-report-list.ts");
  return { createSupabaseAdminClient, queueV2: lifecycle.queueTeamFitReportV2Shell, candidateSourceType: lifecycle.TEAM_FIT_CANDIDATE_SOURCE_TYPE, teamSourceType: lifecycle.TEAM_FIT_TEAM_SOURCE_TYPE, processV2: processTeamFitReportV2WithProvider, validateContract: contract.validateTeamFitReportV2, buildEvidence: evidence.buildTeamFitReportV2EvidenceCatalog, validateEvidence: evidence.validateTeamFitReportV2EvidenceReferences, loadDisplay: display.loadTeamFitReportDisplayRecord, listEntries: list.listTeamFitReportEntries };
}

function buildBaseArtifact(mode) {
  return { metadata: { operator: "team_fit_v2_canonical_persisted_smoke_v2", mode, databaseReads: true, databaseWrites: false, persistence: false, openAiCalls: 0, retryCount: 0 }, verdict: null, sourceResolution: null, acceptedArtifact: null, preState: null, queue: null, processorResult: null, postValidation: null, browserSmoke: { status: "manual_required", url: null }, mutationAudit: null };
}

async function runPersistedSmoke({ env = process.env, argv = [], dependencies = {} } = {}) {
  const cli = dependencies.cli ?? parseCli(argv);
  const artifact = buildBaseArtifact(cli.confirmed ? "confirmed_persist" : "read_only_preflight");
  const preview = await (dependencies.runCanonicalPreview ?? runCanonicalPreview)({ env: { ...env, CONFIRM_TEAM_FIT_V2_CANONICAL_PREVIEW: "false" }, dependencies: dependencies.previewDependencies ?? {} });
  const canonical = getCanonical(preview);
  artifact.sourceResolution = { ...canonical, resolution: "PASS" };
  const accepted = (dependencies.loadAcceptedArtifact ?? loadAcceptedArtifact)(dependencies.acceptedArtifactPath ?? ACCEPTED_ARTIFACT_PATH, dependencies.fsImpl ?? fs);
  artifact.acceptedArtifact = { path: dependencies.acceptedArtifactPath ?? ACCEPTED_ARTIFACT_PATH, status: "PASS", reportType: accepted.snapshot.reportType, reportVersion: accepted.snapshot.reportVersion, promptVersion: PROMPT_VERSION, reportSha256: accepted.reportSha256, semanticSha256: accepted.semanticSha256 };
  const runtime = dependencies.runtime ?? loadRuntimeDependencies();
  const rawClient = dependencies.supabase ?? runtime.createSupabaseAdminClient();
  const guard = createScopedSupabaseGuard(rawClient, { allowWrites: cli.confirmed, canonical });
  const baselineRows = await (dependencies.readAllRows ?? readAllRows)(guard.client);
  const preState = analyzePreState(baselineRows, canonical, accepted.semanticSha256);
  artifact.preState = { ...preState, writeLegal: preState.eligible || preState.exactMatchNoop };
  const acceptedContract = runtime.validateContract(accepted.snapshot);
  if (!acceptedContract.ok) throw new Error("Accepted snapshot failed Team Fit V2 contract validation.");
  const validationRow = baselineRows.find((row) => row.report_type === V2_TYPE && row.report_version === V2_VERSION && row.input_snapshot?.reportType === V2_TYPE && row.input_snapshot?.reportVersion === V2_VERSION);
  const inputSnapshotForValidation = validationRow?.input_snapshot ?? preview.inputSnapshot ?? null;
  if (inputSnapshotForValidation) {
    assertPersistedInput(inputSnapshotForValidation, canonical);
    const catalog = runtime.buildEvidence(inputSnapshotForValidation);
    const evidence = runtime.validateEvidence(acceptedContract.value, catalog);
    if (!evidence.ok) throw new Error("Accepted snapshot failed evidence validation against canonical input.");
    assertReportLineage(acceptedContract.value, inputSnapshotForValidation, canonical);
    artifact.acceptedArtifact.contract = "PASS";
    artifact.acceptedArtifact.evidence = "PASS";
    artifact.acceptedArtifact.lineage = "PASS";
  }
  if (preState.exactMatchNoop) {
    artifact.verdict = "EXACT_MATCH_NOOP";
    artifact.postValidation = { contract: "PASS", evidence: "PASS", lineage: "PASS", reportId: preState.acceptedReadyReportId, reportSha256: accepted.reportSha256, persistedJsonbSemanticSha256: accepted.semanticSha256, openAiCalls: 0, dbWrites: 0 };
    artifact.mutationAudit = guard.assertFinal({ requireInsert: false });
    return artifact;
  }
  if (!cli.confirmed) { artifact.verdict = "READY_TO_APPLY_ACCEPTED_TEAM_FIT_V2"; artifact.mutationAudit = guard.assertFinal(); return artifact; }
  if (!preState.eligible) throw new Error(`Canonical V2 write is not legal while reports are in flight: ${preState.inFlightReportIds.join(", ")}`);

  const queue = await runtime.queueV2({ organizationId: canonical.organizationId, teamId: canonical.teamId, participantId: canonical.participantId, candidateSourceType: runtime.candidateSourceType, candidateSourceId: canonical.candidateAssignmentId, teamSourceType: runtime.teamSourceType, teamSourceId: canonical.aggregationSnapshotId, optionalContext: { locale: canonical.locale }, createdBy: null }, { supabase: guard.client });
  if (!queue.ok) throw new Error(`V2 queue failed: ${queue.reason}: ${queue.message}`);
  guard.setAllowedReportId(queue.reportId);
  artifact.queue = { reportId: queue.reportId, status: queue.status, reportType: queue.report.reportType, reportVersion: queue.report.reportVersion };
  const processorResult = await runtime.processV2({ teamFitReportId: queue.reportId, organizationId: canonical.organizationId }, { supabase: guard.client, provider: { generate: async (inputSnapshot) => ({ ok: true, snapshot: accepted.snapshot, rawContent: JSON.stringify(accepted.snapshot), model: "accepted-snapshot", promptVersion: PROMPT_VERSION, provider: "openai", providerVersion: "team_fit_report_v2_openai_provider_v1", evidenceCatalog: runtime.buildEvidence(inputSnapshot) }) } });
  artifact.processorResult = processorResult;
  if (!processorResult.ok) throw new Error(`Accepted snapshot processor failed: ${processorResult.reason}: ${processorResult.message}`);
  const postRows = await (dependencies.readAllRows ?? readAllRows)(guard.client);
  const currentRow = postRows.find((row) => row.id === queue.reportId);
  const oldRowsChanged = baselineRows.filter((row) => { const next = postRows.find((candidate) => candidate.id === row.id); return JSON.stringify(next) !== JSON.stringify(row); }).map((row) => row.id);
  if (postRows.length !== baselineRows.length + 1 || oldRowsChanged.length !== 0) throw new Error("Persisted write footprint changed an existing report or inserted an unexpected number of rows.");
  if (!currentRow || currentRow.report_status !== "ready" || currentRow.report_type !== V2_TYPE || currentRow.report_version !== V2_VERSION || semanticSha256(currentRow.report_snapshot) !== accepted.semanticSha256) throw new Error("Persisted canonical V2 row failed accepted ready-state validation.");
  assertPersistedInput(currentRow.input_snapshot, canonical);
  const contract = runtime.validateContract(currentRow.report_snapshot); if (!contract.ok) throw new Error("Persisted V2 report failed contract validation.");
  const evidenceCatalog = runtime.buildEvidence(currentRow.input_snapshot); const evidence = runtime.validateEvidence(contract.value, evidenceCatalog); if (!evidence.ok) throw new Error("Persisted V2 report failed evidence validation.");
  assertReportLineage(contract.value, currentRow.input_snapshot, canonical);
  const display = await runtime.loadDisplay({ organizationId: canonical.organizationId, teamId: canonical.teamId, participantId: canonical.participantId, teamFitReportId: queue.reportId }, { supabase: guard.client });
  if (!display || display.status !== "ready" || display.reportType !== V2_TYPE || display.reportVersion !== V2_VERSION || display.legacyReadOnly !== false || !display.reportSnapshot) throw new Error("V2 display loader did not return the ready V2 snapshot.");
  const mutationAudit = guard.assertFinal();
  artifact.metadata.databaseWrites = true; artifact.metadata.persistence = true; artifact.postValidation = { contract: "PASS", evidence: "PASS", lineage: "PASS", reportId: queue.reportId, reportSha256: accepted.reportSha256, persistedJsonbSemanticSha256: semanticSha256(currentRow.report_snapshot), openAiCalls: 0, dbWrites: mutationAudit.mutations.length, insertCount: mutationAudit.insertCount, updateCount: mutationAudit.updateCount, earlierReadyReportUnchanged: true };
  artifact.browserSmoke = { status: "manual_required", url: `/dashboard/teams/${canonical.teamId}/participants/${canonical.participantId}/team-fit-reports/${queue.reportId}` };
  artifact.mutationAudit = mutationAudit;
  artifact.verdict = "GOLDEN_DEMO_TEAM_FIT_V2_ACCEPTED_REPORT_READY_FOR_MANUAL_BROWSER_CHECK";
  writeDiagnosticArtifact(dependencies.artifactPath ?? ARTIFACT_PATH, artifact, dependencies.fsImpl ?? fs);
  return artifact;
}

async function main() {
  try {
    const artifact = await runPersistedSmoke({ argv: process.argv.slice(2) });
    process.stdout.write(`${JSON.stringify(sanitizeForDump(artifact), null, 2)}\n`);
  } catch (error) {
    const failure = { verdict: error?.message?.startsWith("Accepted preview artifact") ? "BLOCKED_BY_ACCEPTED_PREVIEW_ARTIFACT_MISMATCH" : "CHANGES_REQUIRED", error: error instanceof Error ? error.message : String(error) };
    try { writeDiagnosticArtifact(ARTIFACT_PATH, failure); } catch {}
    process.stdout.write(`${JSON.stringify(sanitizeForDump(failure), null, 2)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { ACCEPTED_ARTIFACT_PATH, ACCEPTED_REPORT_SHA, ARTIFACT_PATH, CONFIRM_TOKEN, PROMPT_VERSION, ROW_FIELDS, analyzePreState, assertPersistedInput, assertReportLineage, createScopedSupabaseGuard, getCanonical, loadAcceptedArtifact, parseCli, parseTimeoutMs, readAllRows, runPersistedSmoke, semanticSha256, sha256, stableStringify };

if (require.main === module) main();
