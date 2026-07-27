const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const operator = require("./run-team-dynamics-gdt01-accepted-report-persistence.cjs");
const projectRoot = path.resolve(__dirname, "..");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gdt01-accepted-persistence-"));
const accepted = operator.loadAcceptedArtifact();
const contract = require(path.join(projectRoot, "lib/b2b/team-dynamics-executive-overview-contract.ts"));
const displaySource = fs.readFileSync(path.join(projectRoot, "lib/b2b/team-dynamics-executive-overview-display.ts"), "utf8");
const routeSource = fs.readFileSync(path.join(projectRoot, "app", "(protected)", "dashboard", "teams", "[teamId]", "reports", "[teamAssessmentReportId]", "page.tsx"), "utf8");
const operatorSource = fs.readFileSync(path.join(__dirname, "run-team-dynamics-gdt01-accepted-report-persistence.cjs"), "utf8");

function fakeQuery(result = { data: null, error: null }) {
  const query = {
    result,
    select() { return query; },
    eq() { return query; },
    order() { return query; },
    insert() { return query; },
    update() { return query; },
    delete() { return query; },
    upsert() { return query; },
    maybeSingle() { return Promise.resolve(query.result); },
    single() { return Promise.resolve(query.result); },
    then(resolve, reject) { return Promise.resolve(query.result).then(resolve, reject); },
  };
  return query;
}

function fakeClient() {
  return { from(table) { return fakeQuery({ data: table === "team_assessment_reports" ? [] : null, error: null }); }, rpc() { return Promise.resolve({ data: null, error: null }); } };
}

function tempArtifact(mutator) {
  const filePath = path.join(tempDir, `${Math.random().toString(16).slice(2)}.json`);
  const copy = JSON.parse(JSON.stringify(accepted.artifact));
  mutator(copy);
  fs.writeFileSync(filePath, JSON.stringify(copy));
  return filePath;
}

assert.deepEqual(operator.parseCli([]), { apply: false, confirmation: null });
assert.deepEqual(operator.parseCli(["--apply", "--confirm", operator.CONFIRM_TOKEN]), { apply: true, confirmation: operator.CONFIRM_TOKEN });
assert.throws(() => operator.parseCli(["--apply"]), /requires --confirm/);
assert.throws(() => operator.parseCli(["--apply", "--confirm", "wrong"]), /requires --confirm/);
assert.throws(() => operator.parseCli(["--wat"]), /Unknown CLI argument/);

assert.equal(accepted.previewSha, operator.EXPECTED_PREVIEW_SHA);
assert.equal(accepted.semanticSha, operator.semanticSha256(accepted.snapshot));
assert.throws(() => operator.loadAcceptedArtifact("/tmp/does-not-exist-gdt01.json"), /missing/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.promptVersion = "team_dynamics_executive_overview_prompt_v3"; })), /prompt version/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.runtime.model = "gpt-5.1"; })), /model\/reasoning/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.runtime.reasoningEffort = "medium"; })), /model\/reasoning/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.runtime.temperature = 0.2; })), /runtime envelope/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.runtime.openAiCalls = 2; })), /runtime envelope/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.runtime.retryCount = 1; })), /runtime envelope/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.runtime.databaseWrites = 1; })), /runtime envelope/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.canonicalSnapshotSha256 = "bad"; })), /SHA mismatch/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.canonicalResolution.aggregationSnapshotId = "bad"; })), /canonical resolution/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.aggregationLineage.includedMembers = 5; })), /aggregation lineage/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.validation.privacyGuards = "FAIL"; })), /contract\/privacy/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.reportSnapshot.executiveSummary.summary = "hire/no-hire"; }), fs, contract.validateTeamDynamicsExecutiveOverviewSnapshot), /contract failed/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.reportSnapshot.teamContext.teamId = "wrong"; })), /snapshot lineage/);
assert.throws(() => operator.loadAcceptedArtifact(tempArtifact((a) => { a.reportSnapshot.reportType = "team_dynamics_report_v2"; })), /snapshot identity/);

const baseRows = [{ id: operator.CANONICAL.oldReportId, organization_id: operator.CANONICAL.organizationId, team_id: operator.CANONICAL.teamId, team_assessment_assignment_id: operator.CANONICAL.assignmentId, report_type: operator.REPORT_TYPE, report_version: operator.REPORT_VERSION, report_status: "ready", report_snapshot: { old: true }, selection_draft_id: "draft-1" }];
const analyzed = operator.analyzePreState(baseRows, accepted.semanticSha);
assert.equal(analyzed.writeLegal, true);
assert.equal(analyzed.exactMatchNoop, false);
assert.throws(() => operator.analyzePreState([{ ...baseRows[0], report_status: "processing" }], accepted.semanticSha), /not ready/);
assert.equal(operator.analyzePreState([...baseRows, { ...baseRows[0], id: "exact", report_status: "ready", report_snapshot: accepted.snapshot }], accepted.semanticSha).exactMatchNoop, true);
assert.deepEqual(operator.analyzePreState([...baseRows, { ...baseRows[0], id: "queued", report_status: "queued" }], accepted.semanticSha).inFlightReportIds, ["queued"]);

const readOnlyGuard = operator.createScopedSupabaseGuard(fakeClient(), { allowWrites: false, acceptedSnapshot: accepted.snapshot });
assert.rejects(Promise.resolve().then(() => readOnlyGuard.client.from("team_assessment_reports").insert({ report_type: operator.REPORT_TYPE, report_version: operator.REPORT_VERSION }).select().single()), /read-only/);
assert.throws(() => readOnlyGuard.client.rpc("anything"), /RPC/);
assert.throws(() => readOnlyGuard.client.from("other_table").delete(), /delete/);

const writeGuard = operator.createScopedSupabaseGuard(fakeClient(), { allowWrites: true, acceptedSnapshot: accepted.snapshot });
writeGuard.setAllowedReportId("new-report");
assert.rejects(Promise.resolve().then(() => writeGuard.client.from("team_assessment_reports").update({ report_snapshot: accepted.snapshot }).eq("id", operator.CANONICAL.oldReportId).eq("organization_id", operator.CANONICAL.organizationId)), /newly inserted/);
assert.rejects(Promise.resolve().then(() => writeGuard.client.from("other_table").insert({})), /other_table/);
assert.throws(() => writeGuard.client.from("team_assessment_reports").upsert({}), /upsert/);
assert.throws(() => writeGuard.client.from("team_assessment_reports").delete(), /delete/);

const injectedResult = operator.buildAcceptedProvider(accepted)({});
assert.equal(injectedResult.ok, true);
assert.deepEqual(injectedResult.snapshot, accepted.snapshot);
assert.throws(() => operator.buildAcceptedProvider(accepted, { fetch: true })({}), /cannot use transport/);

assert.match(displaySource, /export async function loadTeamDynamicsExecutiveOverviewReportForDisplay/);
assert.match(displaySource, /report_status/);
assert.match(routeSource, /loadTeamDynamicsExecutiveOverviewReportForDisplay/);
assert.match(routeSource, /teamAssessmentReportId/);
assert.match(operatorSource, /queueTeamDynamicsReportShell/);
assert.match(operatorSource, /processTeamDynamicsExecutiveOverviewWithOpenAI/);
assert.match(operatorSource, /loadTeamDynamicsExecutiveOverviewReportForDisplay/);
assert.match(operatorSource, /listTeamDynamicsReportRowsForAssignment/);
assert.match(operatorSource, /loadTeamDynamicsFinalAggregationVerification/);
assert.doesNotMatch(operatorSource, /loadAggregationVerification:\s*async/);
assert.doesNotMatch(operatorSource, /toQueueAggregationVerification/);
assert.doesNotMatch(operatorSource, /openai\.chat|new OpenAI|https:\/\/api\.openai\.com/);
assert.doesNotMatch(operatorSource, /\.rpc\(/);
assert.equal(operator.semanticSha256(JSON.parse(JSON.stringify(accepted.snapshot))), accepted.semanticSha);

console.log("GDT-01 accepted Team Dynamics persistence operator tests passed.");
