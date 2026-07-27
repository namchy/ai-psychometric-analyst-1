const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const operator = require("./run-team-fit-v2-canonical-persisted-smoke.cjs");
const { writeDiagnosticArtifact } = require("./inspect-team-fit-report-v2-canonical-preview.cjs");

const acceptedArtifact = JSON.parse(fs.readFileSync(operator.ACCEPTED_ARTIFACT_PATH, "utf8"));
const acceptedSnapshot = acceptedArtifact.reportSnapshot;
const V2_TYPE = "team_fit_report_v2";

function previewFixture(overrides = {}) {
  return {
    sourceResolution: {
      organization: { id: "e392aae0-564e-4741-90a6-731bc28b0572", name: "Partner Plus d.o.o., Mikrokreditna organizacija" },
      candidate: { fixtureKey: "GD-001", participantId: "2c895762-76f5-4d7b-adaa-ad55ebc73020", displayName: "Amel Kovačević", assignmentId: "3a5ac3a6-107c-4152-aaca-1406c5c96f78" },
      team: { fixtureKey: "GDT-01", teamId: "617c86d2-fb9a-415c-9108-b79042e43816", teamName: "Kreditno poslovanje i rad s klijentima", teamAssessmentAssignmentId: "c93a0448-64a3-4b69-81c9-d8037ad0fb1f", aggregationSnapshotId: "a3e1d801-3156-487b-8465-d282a1dc8562" },
      ambiguityChecks: { organizations: 1, participants: 1, candidateAssignments: 1, teams: 1, teamAssignments: 1, readyAggregationSnapshots: 1 },
      lineage: { sameOrganization: true, candidateAssignmentMatchesParticipant: true, teamAssignmentMatchesTeam: true, aggregationSnapshotMatchesAssignment: true },
    },
    inputSummary: {
      locale: "bs",
      candidateCoverage: { requiredCount: 3, completedCount: 3, missingTestSlugs: [], sourceTestSlugs: ["ipip-neo-120-v1", "mwms_v1", "safran_v1"] },
      teamCoverage: { teamFullCoverage: true, includedMemberCount: 6, completedMemberCount: 6, readyScoredMemberCount: 6, incompleteMemberCount: 0, missingScoreCount: 0, invalidScoreCount: 0 },
    },
    ...overrides,
  };
}

function rowFixture(overrides = {}) {
  return {
    id: "v1-1", organization_id: "e392aae0-564e-4741-90a6-731bc28b0572", team_id: "617c86d2-fb9a-415c-9108-b79042e43816", participant_id: "2c895762-76f5-4d7b-adaa-ad55ebc73020",
    candidate_source_type: "composite_deterministic_input_snapshot", candidate_source_id: "3a5ac3a6-107c-4152-aaca-1406c5c96f78",
    team_source_type: "team_dynamics_aggregation_input_snapshot", team_source_id: "a3e1d801-3156-487b-8465-d282a1dc8562",
    optional_context: {}, report_type: "team_fit_report_v1", report_version: "v1", report_status: "ready",
    input_snapshot: { stable: true }, report_snapshot: { stable: true }, error_message: null,
    queued_at: "2026-01-01", started_at: "2026-01-01", completed_at: "2026-01-01", failed_at: null,
    created_by: null, created_at: "2026-01-01", updated_at: "2026-01-01", ...overrides,
  };
}

class FakeQuery {
  constructor(database, table) { this.database = database; this.table = table; this.filters = []; this.operation = "select"; this.payload = null; this.singleMode = false; }
  select() { return this; }
  insert(payload) { this.operation = "insert"; this.payload = payload; return this; }
  update(payload) { this.operation = "update"; this.payload = payload; return this; }
  delete() { this.operation = "delete"; return this; }
  upsert(payload) { this.operation = "upsert"; this.payload = payload; return this; }
  eq(column, value) { this.filters.push([column, value]); return this; }
  in() { return this; }
  is() { return this; }
  order() { return this; }
  single() { this.singleMode = true; return this; }
  maybeSingle() { this.singleMode = true; return this; }
  execute() {
    const rows = this.database[this.table] ?? (this.database[this.table] = []);
    const matches = (row) => this.filters.every(([key, value]) => row[key] === value);
    if (this.operation === "insert") {
      const inserted = { id: "new-v2-report", created_at: "2026-07-27T12:00:00Z", updated_at: "2026-07-27T12:00:00Z", error_message: null, started_at: null, completed_at: null, failed_at: null, input_snapshot: null, report_snapshot: null, ...this.payload };
      rows.push(inserted); return { data: this.singleMode ? inserted : [inserted], error: null };
    }
    if (this.operation === "update") {
      const changed = rows.filter(matches);
      changed.forEach((row) => Object.assign(row, this.payload, { updated_at: "2026-07-27T12:01:00Z" }));
      return { data: this.singleMode ? changed[0] ?? null : changed, error: null };
    }
    const selected = rows.filter(matches);
    return { data: this.singleMode ? selected[0] ?? null : selected, error: null };
  }
  then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); }
}

class FakeSupabase {
  constructor(rows = []) { this.database = { team_fit_reports: rows.map((row) => ({ ...row })), teams: [], participants: [] }; }
  from(table) { return new FakeQuery(this.database, table); }
  rpc() { throw new Error("unexpected rpc"); }
}

function acceptedLoader() { return { artifact: acceptedArtifact, snapshot: acceptedSnapshot, reportSha256: operator.ACCEPTED_REPORT_SHA, semanticSha256: operator.semanticSha256(acceptedSnapshot) }; }

function runtimeFor(supabase, calls = {}) {
  return {
    candidateSourceType: "composite_deterministic_input_snapshot",
    teamSourceType: "team_dynamics_aggregation_input_snapshot",
    buildEvidence: () => ({ candidate: [], team: [] }),
    validateContract: (snapshot) => ({ ok: true, value: snapshot }),
    validateEvidence: () => ({ ok: true, issues: [] }),
    queueV2: async (input, deps) => {
      const { data, error } = await deps.supabase.from("team_fit_reports").insert({ organization_id: input.organizationId, team_id: input.teamId, participant_id: input.participantId, candidate_source_type: input.candidateSourceType, candidate_source_id: input.candidateSourceId, team_source_type: input.teamSourceType, team_source_id: input.teamSourceId, optional_context: input.optionalContext, report_type: V2_TYPE, report_version: "v2", report_status: "queued", queued_at: "2026-07-27T12:00:00Z", created_by: null }).select().single();
      if (error) return { ok: false, reason: "insert_failed", message: error.message };
      return { ok: true, reportId: data.id, status: "queued", report: { id: data.id, reportType: V2_TYPE, reportVersion: "v2" } };
    },
    processV2: async (input, deps) => {
      calls.provider = 0;
      await deps.supabase.from("team_fit_reports").update({ report_status: "processing", started_at: "2026-07-27T12:00:01Z" }).eq("id", input.teamFitReportId).eq("organization_id", input.organizationId).eq("report_type", V2_TYPE).eq("report_version", "v2").eq("report_status", "queued");
      const inputSnapshot = { reportType: V2_TYPE, reportVersion: "v2", organizationContext: { organizationId: "e392aae0-564e-4741-90a6-731bc28b0572" }, candidateContext: { participantId: "2c895762-76f5-4d7b-adaa-ad55ebc73020", candidateSourceId: "3a5ac3a6-107c-4152-aaca-1406c5c96f78" }, teamContext: { teamId: "617c86d2-fb9a-415c-9108-b79042e43816", teamSourceId: "a3e1d801-3156-487b-8465-d282a1dc8562" }, candidateSignals: { sourceMetadata: { sourceTestSlugs: ["a", "b", "c"] } }, teamSignals: { varianceAndConfidence: { includedMemberCount: 6, completedMemberCount: 6, readyScoredMemberCount: 6 } }, inputVersion: "team_fit_report_input_v2_enriched" };
      await deps.supabase.from("team_fit_reports").update({ input_snapshot: inputSnapshot }).eq("id", input.teamFitReportId).eq("organization_id", input.organizationId).eq("report_type", V2_TYPE).eq("report_version", "v2").eq("report_status", "processing");
      calls.provider += 1;
      await deps.supabase.from("team_fit_reports").update({ report_status: "ready", report_snapshot: acceptedSnapshot, completed_at: "2026-07-27T12:00:02Z" }).eq("id", input.teamFitReportId).eq("organization_id", input.organizationId).eq("report_type", V2_TYPE).eq("report_version", "v2").eq("report_status", "processing");
      return { ok: true, reportId: input.teamFitReportId, status: "ready" };
    },
    loadDisplay: async () => ({ status: "ready", reportType: V2_TYPE, reportVersion: "v2", legacyReadOnly: false, reportSnapshot: acceptedSnapshot }),
    listEntries: async () => [],
    createSupabaseAdminClient: () => supabase,
  };
}

async function main() {
  const canonical = operator.getCanonical(previewFixture());
  assert.equal(operator.CONFIRM_TOKEN, "PERSIST_ACCEPTED_TEAM_FIT_V2_GD001_GDT01");
  assert.equal(operator.analyzePreState([rowFixture(), rowFixture({ id: "old-v2", report_type: V2_TYPE, report_version: "v2", report_snapshot: { old: true } })], canonical).eligible, true, "different earlier ready V2 is not a blocker");

  const invalidCanonical = previewFixture({ sourceResolution: { ...previewFixture().sourceResolution, candidate: { ...previewFixture().sourceResolution.candidate, fixtureKey: "GD-002" } } });
  assert.throws(() => operator.getCanonical(invalidCanonical), /GD-001/);
  assert.equal(operator.parseCli(["--apply", "--confirm", "WRONG"]).confirmed, false);
  assert.equal(operator.parseCli([]).confirmed, false);
  assert.equal(operator.parseCli(["--apply", "--confirm", operator.CONFIRM_TOKEN]).confirmed, true);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "team-fit-v2-persist-test-"));
  assert.throws(() => operator.loadAcceptedArtifact(path.join(tempRoot, "missing.json")), /missing/i);
  const mismatchPath = path.join(tempRoot, "mismatch.json");
  fs.writeFileSync(mismatchPath, JSON.stringify({ ...acceptedArtifact, reportSnapshotSha256: "bad" }));
  assert.throws(() => operator.loadAcceptedArtifact(mismatchPath), /mismatch/i);
  const dumpPath = path.join(tempRoot, "dump.json");
  writeDiagnosticArtifact(dumpPath, { apiKey: "sk-secret", safe: true });
  assert.equal(fs.statSync(dumpPath).mode & 0o777, 0o600);
  const linkPath = path.join(tempRoot, "link.json"); fs.symlinkSync(dumpPath, linkPath);
  assert.throws(() => writeDiagnosticArtifact(linkPath, { safe: true }), /symbolic link/);

  const baseline = [rowFixture(), rowFixture({ id: "old-v2", report_type: V2_TYPE, report_version: "v2", report_snapshot: { old: true } })];
  const readDb = new FakeSupabase(baseline);
  const readOnly = await operator.runPersistedSmoke({ argv: [], dependencies: { runCanonicalPreview: async () => previewFixture(), loadAcceptedArtifact: acceptedLoader, supabase: readDb, runtime: runtimeFor(readDb) } });
  assert.equal(readOnly.verdict, "READY_TO_APPLY_ACCEPTED_TEAM_FIT_V2");
  assert.equal(readOnly.metadata.openAiCalls, 0);
  assert.equal(readOnly.mutationAudit.insertCount, 0);
  assert.equal(readDb.database.team_fit_reports.length, 2);

  const wrongGate = await operator.runPersistedSmoke({ argv: ["--apply", "--confirm", "WRONG"], dependencies: { runCanonicalPreview: async () => previewFixture(), loadAcceptedArtifact: acceptedLoader, supabase: new FakeSupabase(baseline), runtime: runtimeFor(readDb) } });
  assert.equal(wrongGate.metadata.mode, "read_only_preflight");

  const applyDb = new FakeSupabase(baseline); const calls = {};
  const applied = await operator.runPersistedSmoke({ argv: ["--apply", "--confirm", operator.CONFIRM_TOKEN], dependencies: { runCanonicalPreview: async () => previewFixture(), loadAcceptedArtifact: acceptedLoader, supabase: applyDb, runtime: runtimeFor(applyDb, calls) } });
  assert.equal(applied.verdict, "GOLDEN_DEMO_TEAM_FIT_V2_ACCEPTED_REPORT_READY_FOR_MANUAL_BROWSER_CHECK");
  assert.equal(applied.postValidation.insertCount, 1);
  assert.equal(applied.postValidation.updateCount, 3);
  assert.equal(applied.postValidation.openAiCalls, 0);
  assert.equal(calls.provider, 1, "processor/provider path is invoked exactly once");
  assert.equal(applyDb.database.team_fit_reports.filter((row) => row.report_status === "ready" && row.report_type === V2_TYPE).length, 2);
  assert.deepEqual(applyDb.database.team_fit_reports.find((row) => row.id === "old-v2").report_snapshot, { old: true });

  const rerun = await operator.runPersistedSmoke({ argv: ["--apply", "--confirm", operator.CONFIRM_TOKEN], dependencies: { runCanonicalPreview: async () => previewFixture(), loadAcceptedArtifact: acceptedLoader, supabase: applyDb, runtime: runtimeFor(applyDb) } });
  assert.equal(rerun.verdict, "EXACT_MATCH_NOOP");
  assert.equal(rerun.mutationAudit.insertCount, 0);

  const invalidContractDb = new FakeSupabase(baseline);
  await assert.rejects(() => operator.runPersistedSmoke({ argv: ["--apply", "--confirm", operator.CONFIRM_TOKEN], dependencies: { runCanonicalPreview: async () => previewFixture({ inputSnapshot: {} }), loadAcceptedArtifact: acceptedLoader, supabase: invalidContractDb, runtime: { ...runtimeFor(invalidContractDb), validateContract: () => ({ ok: false }) } } }), /contract/i);
  assert.equal(invalidContractDb.database.team_fit_reports.length, 2, "invalid contract fails before write");

  const source = fs.readFileSync(path.join(__dirname, "run-team-fit-v2-canonical-persisted-smoke.cjs"), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(/i, "accepted provider path has no fetch");
  assert.doesNotMatch(source, /\.delete\s*\(/, "operator has no delete execution path");
  assert.match(source, /runtime\.processV2/);
  assert.match(source, /validateEvidence/);
  assert.match(source, /assertReportLineage/);

  process.stdout.write("Team Fit V2 canonical accepted-snapshot persistence operator offline tests passed.\n");
}

main().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
