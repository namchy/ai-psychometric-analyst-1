const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");
const ACCEPTED_ARTIFACT_PATH = "/tmp/team-dynamics-gdt01-prompt-v2-final-preview.json";
const AUDIT_PATH = "/tmp/team-dynamics-gdt01-accepted-persistence.json";
const CONFIRM_TOKEN = "PERSIST_ACCEPTED_GDT01_TEAM_DYNAMICS_PROMPT_V2";
const EXPECTED_PREVIEW_SHA = "49e70f69cfb66184f4461d570b0bbcb5da40e3183609947ee81026b96e2a5aa9";
const EXPECTED_PROMPT_VERSION = "team_dynamics_executive_overview_prompt_v2";
const EXPECTED_MODEL = "gpt-5.6-sol";
const REPORT_TYPE = "team_dynamics_report_v1";
const REPORT_VERSION = "team_dynamics_executive_overview_v1";
const CANONICAL = {
  organizationId: "e392aae0-564e-4741-90a6-731bc28b0572",
  teamId: "617c86d2-fb9a-415c-9108-b79042e43816",
  assignmentId: "c93a0448-64a3-4b69-81c9-d8037ad0fb1f",
  aggregationId: "a3e1d801-3156-487b-8465-d282a1dc8562",
  teamName: "Kreditno poslovanje i rad s klijentima",
  oldReportId: "fdfab035-d040-4da0-ab19-67a119be6c00",
};

const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") return emptyModulePath;
  if (request.startsWith("@/")) {
    const candidate = path.join(ROOT, request.slice(2));
    for (const ext of ["", ".ts", ".tsx", ".js", ".mjs", ".cjs"]) {
      if (fs.existsSync(candidate + ext)) return originalResolve.call(this, candidate + ext, parent, isMain, options);
    }
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.NodeJs, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const value = line.trim();
    const index = value.indexOf("=");
    if (index > 0 && !value.startsWith("#") && !(value.slice(0, index) in process.env)) process.env[value.slice(0, index)] = value.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}
function stableStringify(value) { return JSON.stringify(stableValue(value)); }
function semanticSha256(value) { return crypto.createHash("sha256").update(stableStringify(value)).digest("hex"); }
function previewSha256(inputSnapshot) { return crypto.createHash("sha256").update(JSON.stringify(inputSnapshot)).digest("hex"); }

function parseCli(argv = process.argv.slice(2)) {
  let apply = false;
  let confirmation = null;
  const unknown = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--apply") apply = true;
    else if (argv[i] === "--confirm") confirmation = argv[++i] ?? null;
    else unknown.push(argv[i]);
  }
  if (unknown.length) throw new Error(`Unknown CLI argument: ${unknown.join(", ")}`);
  if (apply && confirmation !== CONFIRM_TOKEN) throw new Error(`--apply requires --confirm ${CONFIRM_TOKEN}.`);
  if (!apply && confirmation) throw new Error("--confirm is valid only together with --apply.");
  return { apply, confirmation };
}

function loadAcceptedArtifact(filePath = ACCEPTED_ARTIFACT_PATH, fsImpl = fs, validateSnapshot) {
  if (!fsImpl.existsSync(filePath)) throw new Error(`Accepted artifact is missing: ${filePath}`);
  let artifact;
  try { artifact = JSON.parse(fsImpl.readFileSync(filePath, "utf8")); } catch (error) { throw new Error(`Accepted artifact is not valid JSON: ${error.message}`); }
  const snapshot = artifact?.reportSnapshot;
  if (!snapshot || typeof snapshot !== "object") throw new Error("Accepted artifact does not contain a full reportSnapshot.");
  if (artifact.promptVersion !== EXPECTED_PROMPT_VERSION) throw new Error("Accepted artifact prompt version mismatch.");
  if (artifact.runtime?.model !== EXPECTED_MODEL || artifact.runtime?.reasoningEffort !== "low") throw new Error("Accepted artifact model/reasoning mismatch.");
  if (artifact.runtime?.temperature !== null || artifact.runtime?.openAiCalls !== 1 || artifact.runtime?.retryCount !== 0 || artifact.runtime?.fallbackCount !== 0 || artifact.runtime?.databaseWrites !== 0 || artifact.runtime?.persistence !== false) throw new Error("Accepted artifact runtime envelope mismatch.");
  if (artifact.canonicalResolution?.status !== "PASS" || artifact.canonicalResolution.organizationId !== CANONICAL.organizationId || artifact.canonicalResolution.teamId !== CANONICAL.teamId || artifact.canonicalResolution.teamAssessmentAssignmentId !== CANONICAL.assignmentId || artifact.canonicalResolution.aggregationSnapshotId !== CANONICAL.aggregationId || artifact.canonicalResolution.includedMembers !== 6) throw new Error("Accepted artifact canonical resolution mismatch.");
  if (artifact.aggregationLineage?.status !== "PASS" || artifact.aggregationLineage.snapshotId !== CANONICAL.aggregationId || artifact.aggregationLineage.includedMembers !== 6) throw new Error("Accepted artifact aggregation lineage mismatch.");
  if (artifact.validation?.contract !== "PASS" || artifact.validation?.privacyGuards !== "PASS") throw new Error("Accepted artifact contract/privacy envelope mismatch.");
  if (previewSha256(artifact.inputSnapshot) !== EXPECTED_PREVIEW_SHA || artifact.canonicalSnapshotSha256 !== EXPECTED_PREVIEW_SHA) throw new Error("Accepted artifact preview SHA mismatch.");
  if (validateSnapshot) {
    const result = validateSnapshot(snapshot);
    if (!result.ok) throw new Error(`Accepted report contract failed: ${result.errors.join(" | ")}`);
  }
  if (snapshot.reportType !== "team_dynamics_executive_overview_v1" || snapshot.reportVersion !== "v1" || snapshot.locale !== "bs") throw new Error("Accepted report snapshot identity mismatch.");
  if (snapshot.teamContext?.organizationId !== CANONICAL.organizationId || snapshot.teamContext?.teamId !== CANONICAL.teamId || snapshot.teamContext?.teamAssessmentAssignmentId !== CANONICAL.assignmentId || snapshot.includedMembersSummary?.includedMemberCount !== 6 || snapshot.includedMembersSummary?.completedMemberCount !== 6) throw new Error("Accepted report snapshot lineage/member mismatch.");
  return { artifact, snapshot, previewSha: EXPECTED_PREVIEW_SHA, semanticSha: semanticSha256(snapshot) };
}

function readRows(supabase) {
  return supabase.from("team_assessment_reports").select("id, organization_id, team_id, team_assessment_assignment_id, selection_draft_id, aggregation_snapshot_id, report_type, report_version, report_status, generator_type, model_name, included_member_ids_snapshot, input_snapshot, report_snapshot, error_message, queued_at, started_at, completed_at, created_at, updated_at").eq("organization_id", CANONICAL.organizationId).eq("team_id", CANONICAL.teamId).eq("team_assessment_assignment_id", CANONICAL.assignmentId);
}

function analyzePreState(rows, acceptedSemanticSha) {
  const canonical = rows.filter((row) => row.organization_id === CANONICAL.organizationId && row.team_id === CANONICAL.teamId && row.team_assessment_assignment_id === CANONICAL.assignmentId && row.report_type === REPORT_TYPE && row.report_version === REPORT_VERSION);
  const exact = canonical.find((row) => row.report_status === "ready" && semanticSha256(row.report_snapshot) === acceptedSemanticSha);
  const inFlight = canonical.filter((row) => row.report_status === "queued" || row.report_status === "processing");
  const old = canonical.find((row) => row.id === CANONICAL.oldReportId);
  if (!old || old.report_status !== "ready") throw new Error("Existing canonical ready report is missing or not ready.");
  return { rows, canonicalRows: canonical, exactMatchNoop: Boolean(exact), acceptedReadyReportId: exact?.id ?? null, inFlightReportIds: inFlight.map((row) => row.id), oldReport: old, writeLegal: Boolean(exact) || inFlight.length === 0 };
}

function createScopedSupabaseGuard(client, { allowWrites, acceptedSnapshot }) {
  const audit = { reads: [], mutations: [], blocked: [] };
  let allowedReportId = null;
  const cache = new WeakMap();
  function block(message) { audit.blocked.push(message); throw new Error(message); }
  function validateMutation(context) {
    if (!context || context.validated) return;
    context.validated = true;
    if (!allowWrites) block("DB mutation blocked in read-only mode.");
    if (context.table !== "team_assessment_reports") block(`DB mutation blocked on ${context.table}.`);
    if (context.operation === "insert") {
      if (audit.mutations.filter((x) => x.operation === "insert").length > 1) block("More than one Team Dynamics report insert is blocked.");
      const row = Array.isArray(context.payload) ? null : context.payload;
      if (!row || row.report_type !== REPORT_TYPE || row.report_version !== REPORT_VERSION || row.organization_id !== CANONICAL.organizationId || row.team_id !== CANONICAL.teamId || row.team_assessment_assignment_id !== CANONICAL.assignmentId || row.aggregation_snapshot_id !== CANONICAL.aggregationId) block("Insert is outside canonical Team Dynamics scope or has wrong identity.");
      return;
    }
    if (context.operation !== "update") block(`${context.operation} is blocked.`);
    const filters = new Map(context.filters.map((x) => [x.column, x.value]));
    if (!allowedReportId || filters.get("id") !== allowedReportId || filters.get("organization_id") !== CANONICAL.organizationId) block("Update is not scoped to the newly inserted canonical report.");
    if (Object.hasOwn(context.payload ?? {}, "id") || Object.hasOwn(context.payload ?? {}, "organization_id") || Object.hasOwn(context.payload ?? {}, "team_id") || Object.hasOwn(context.payload ?? {}, "team_assessment_assignment_id") || Object.hasOwn(context.payload ?? {}, "report_type") || Object.hasOwn(context.payload ?? {}, "report_version")) block("Report identity mutation is blocked.");
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
    client: { from(table) { audit.reads.push(table); return wrap(client.from(table), table); }, rpc() { return block("RPC is blocked."); } },
    audit,
    setAllowedReportId(id) { if (allowedReportId && allowedReportId !== id) block("A second report scope is blocked."); allowedReportId = id; },
    assertFinal(requireInsert) {
      const inserts = audit.mutations.filter((x) => x.operation === "insert");
      if (requireInsert && inserts.length !== 1) throw new Error("Expected exactly one report insert.");
      if (audit.mutations.some((x) => x.table !== "team_assessment_reports")) throw new Error("Write outside team_assessment_reports detected.");
      return { insertCount: inserts.length, updateCount: audit.mutations.filter((x) => x.operation === "update").length, totalMutationCount: audit.mutations.length, touchedTables: [...new Set(audit.mutations.map((x) => x.table))], touchedReportIds: allowedReportId ? [allowedReportId] : [] };
    },
  };
}

function buildAcceptedProvider(accepted, dependencies = {}) {
  return function generateAcceptedSnapshot() {
    if (dependencies.fetch || dependencies.openai || dependencies.transport) throw new Error("Injected accepted provider cannot use transport.");
    return { ok: true, code: "success", snapshot: accepted.snapshot, provider: "openai", providerVersion: "accepted-snapshot", modelName: "accepted-snapshot", generatedAt: new Date().toISOString(), rawContent: JSON.stringify(accepted.snapshot) };
  };
}

function writeAudit(value, fsImpl = fs) { fsImpl.writeFileSync(AUDIT_PATH, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 }); fsImpl.chmodSync(AUDIT_PATH, 0o600); }

async function runOperator({ argv = process.argv.slice(2), dependencies = {} } = {}) {
  const cli = parseCli(argv);
  loadEnv(path.join(ROOT, ".env.local"));
  const runtime = dependencies.runtime ?? (() => {
    const { createSupabaseAdminClient } = require(path.join(ROOT, "lib/supabase/admin.ts"));
    const lifecycle = require(path.join(ROOT, "lib/b2b/team-dynamics-report-lifecycle.ts"));
    const finalAggregation = require(path.join(ROOT, "lib/assessment/team-dynamics-final-aggregation-read.ts"));
    const contract = require(path.join(ROOT, "lib/b2b/team-dynamics-executive-overview-contract.ts"));
    const display = require(path.join(ROOT, "lib/b2b/team-dynamics-executive-overview-display.ts"));
    return { createSupabaseAdminClient, ...lifecycle, ...finalAggregation, ...contract, ...display };
  })();
  const accepted = (dependencies.loadAcceptedArtifact ?? loadAcceptedArtifact)(dependencies.acceptedArtifactPath ?? ACCEPTED_ARTIFACT_PATH, dependencies.fsImpl ?? fs, runtime.validateTeamDynamicsExecutiveOverviewSnapshot);
  const supabase = dependencies.supabase ?? runtime.createSupabaseAdminClient();
  const guard = createScopedSupabaseGuard(supabase, { allowWrites: cli.apply, acceptedSnapshot: accepted.snapshot });
  const rowsResult = await readRows(guard.client);
  if (rowsResult.error) throw new Error(`Failed to load canonical Team Dynamics reports: ${rowsResult.error.message}`);
  const rows = rowsResult.data ?? [];
  const preState = analyzePreState(rows, accepted.semanticSha);
  const aggregation = await runtime.loadTeamDynamicsFinalAggregationVerification({ teamAssessmentAssignmentId: CANONICAL.assignmentId }, { supabase: guard.client });
  if (aggregation.status !== "ready" || aggregation.aggregationSnapshotId !== CANONICAL.aggregationId || aggregation.includedMemberCount !== 6 || aggregation.completedMemberCount !== 6 || aggregation.readyScoredMemberCount !== 6) throw new Error("Canonical aggregation lineage is not PASS.");
  const canonicalReports = preState.canonicalRows.map((row) => ({ id: row.id, status: row.report_status, semanticSha: row.report_snapshot ? semanticSha256(row.report_snapshot) : null, selectionDraftId: row.selection_draft_id }));
  const baseAudit = { mode: cli.apply ? "apply" : "read_only", acceptedArtifactPath: ACCEPTED_ARTIFACT_PATH, acceptedPreviewSha: accepted.previewSha, acceptedSemanticSha: accepted.semanticSha, reportType: REPORT_TYPE, reportVersion: REPORT_VERSION, promptVersion: EXPECTED_PROMPT_VERSION, model: EXPECTED_MODEL, reasoningEffort: "low", temperature: "absent", canonicalResolution: "PASS", aggregationLineage: "PASS", includedMembers: 6, contract: "PASS", privacy: "PASS", existingReports: canonicalReports, existingReadyReportId: CANONICAL.oldReportId, inFlightReportIds: preState.inFlightReportIds, exactMatchNoop: preState.exactMatchNoop, writeLegal: preState.writeLegal, plannedWriteFootprint: { table: "team_assessment_reports", operations: ["insert new report", "lifecycle updates scoped to new report ID"] }, openAiCalls: 0, databaseWrites: false, persistence: false };
  if (preState.exactMatchNoop) {
    const result = { ...baseAudit, verdict: "EXACT_MATCH_NOOP", writeAudit: guard.assertFinal(false), newReportId: preState.acceptedReadyReportId };
    writeAudit(result);
    return result;
  }
  if (preState.inFlightReportIds.length) throw new Error(`Canonical report is in flight: ${preState.inFlightReportIds.join(", ")}`);
  if (!cli.apply) {
    const result = { ...baseAudit, verdict: "READY_TO_APPLY_ACCEPTED_GDT01_TEAM_DYNAMICS_PROMPT_V2", writeAudit: guard.assertFinal(false) };
    writeAudit(result);
    return result;
  }
  const selectionDraftId = preState.oldReport.selection_draft_id;
  if (!selectionDraftId) throw new Error("Existing canonical ready report has no selection draft ID.");
  const queue = await runtime.queueTeamDynamicsReportShell({ organizationId: CANONICAL.organizationId, teamId: CANONICAL.teamId, teamAssessmentAssignmentId: CANONICAL.assignmentId, selectionDraftId }, { supabase: guard.client });
  if (!queue.ok) throw new Error(`Queue failed: ${queue.code}: ${queue.reason}`);
  guard.setAllowedReportId(queue.report.id);
  const process = await runtime.processTeamDynamicsExecutiveOverviewWithOpenAI({ teamAssessmentReportId: queue.report.id, organizationId: CANONICAL.organizationId }, { supabase: guard.client, generateExecutiveOverviewWithOpenAI: buildAcceptedProvider(accepted), validateExecutiveOverviewSnapshot: runtime.validateTeamDynamicsExecutiveOverviewSnapshot });
  if (!process.ok) throw new Error(`Accepted snapshot processor failed: ${process.operation}: ${process.reason}`);
  const postRowsResult = await readRows(guard.client);
  if (postRowsResult.error) throw new Error(postRowsResult.error.message);
  const postRows = postRowsResult.data ?? [];
  const current = postRows.find((row) => row.id === queue.report.id);
  const oldChanged = rows.filter((row) => JSON.stringify(postRows.find((next) => next.id === row.id)) !== JSON.stringify(row)).map((row) => row.id);
  if (postRows.length !== rows.length + 1 || oldChanged.length) throw new Error(`Unexpected persistence footprint; oldChanged=${oldChanged.join(",")}`);
  if (!current || current.report_status !== "ready" || current.report_type !== REPORT_TYPE || current.report_version !== REPORT_VERSION || semanticSha256(current.report_snapshot) !== accepted.semanticSha) throw new Error("Persisted report does not match accepted ready snapshot.");
  if (!current.input_snapshot || current.input_snapshot.aggregationSnapshotId !== CANONICAL.aggregationId || current.input_snapshot.includedMemberCount !== 6) throw new Error("Persisted input snapshot lineage/member count mismatch.");
  const contract = runtime.validateTeamDynamicsExecutiveOverviewSnapshot(current.report_snapshot); if (!contract.ok) throw new Error(`Persisted report contract failed: ${contract.errors.join(" | ")}`);
  const display = await runtime.loadTeamDynamicsExecutiveOverviewReportForDisplay({ organizationId: CANONICAL.organizationId, teamId: CANONICAL.teamId, teamAssessmentReportId: queue.report.id }, { supabase: guard.client });
  if (!display || display.status !== "ready" || semanticSha256(display.snapshot) !== accepted.semanticSha) throw new Error("Display loader did not return accepted ready report.");
  const list = await runtime.listTeamDynamicsReportRowsForAssignment({ organizationId: CANONICAL.organizationId, teamId: CANONICAL.teamId, teamAssessmentAssignmentId: CANONICAL.assignmentId }, { supabase: guard.client });
  if (!list.some((row) => row.id === queue.report.id && row.reportStatus === "ready")) throw new Error("Report list loader did not return the new ready report.");
  const mutationAudit = guard.assertFinal(true);
  const result = { ...baseAudit, verdict: "GDT01_TEAM_DYNAMICS_ACCEPTED_REPORT_READY", newReportId: queue.report.id, postcondition: { status: "ready", persistedSemanticSha: semanticSha256(current.report_snapshot), contract: "PASS", lineage: "PASS", privacy: "PASS", oldReportUnchanged: true, reportCountDelta: 1, displayLoader: "PASS", listLoader: "PASS" }, writeAudit: mutationAudit };
  writeAudit(result);
  return result;
}

async function main() {
  try { process.stdout.write(`${JSON.stringify(await runOperator(), null, 2)}\n`); }
  catch (error) { const result = { verdict: "CHANGES_REQUIRED", error: error instanceof Error ? error.message : String(error) }; try { writeAudit(result); } catch {} process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); process.exitCode = 1; }
}

module.exports = { ACCEPTED_ARTIFACT_PATH, AUDIT_PATH, CANONICAL, CONFIRM_TOKEN, EXPECTED_PREVIEW_SHA, EXPECTED_PROMPT_VERSION, REPORT_TYPE, REPORT_VERSION, analyzePreState, buildAcceptedProvider, createScopedSupabaseGuard, loadAcceptedArtifact, parseCli, previewSha256, runOperator, semanticSha256, stableStringify };
if (require.main === module) main();
