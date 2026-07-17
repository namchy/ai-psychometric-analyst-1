const assert = require("node:assert/strict");
const fs = require("node:fs"); const path = require("node:path"); const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => { const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename }); module._compile(output.outputText, filename); };
const { buildRuntimeContractSnapshot, validateRuntimeContractSnapshot } = require("../lib/golden-demo/team-dynamics-runtime-contract.ts");
const { parseCli, run } = require("./export-team-dynamics-runtime-contract.cjs");
function query(data) { return { select() { return this; }, eq() { return this; }, in() { return this; }, then(resolve) { return Promise.resolve(resolve({ data, error: null })); } }; }
const rows = { test: { id: "test-source-id", slug: "team_dynamics_assessment_v1", status: "active", is_active: true, scoring_method: "mixed_v1", metadata: { assessment_key: "team_dynamics_assessment_v1", version: "v1" } }, dimensions: [{ code: "COLLAB", display_order: 1, is_active: true, metadata: { scoring: "mean" } }], questions: [{ id: "question-source-id", code: "TDM_01", question_order: 1, question_type: "single_choice", is_required: true, is_active: true, metadata: { response_format: "single_select_likert" } }], options: [{ id: "option-source-id", question_id: "question-source-id", code: "LIKERT_1", value: 1, option_order: 1, metadata: {} }, { id: "option-source-id-2", question_id: "question-source-id", code: "LIKERT_2", value: 2, option_order: 2, metadata: {} }] };
function supabaseFor(input = rows) { return { from(table) { if (table === "tests") return query([input.test]); if (table === "test_dimensions") return query(input.dimensions); if (table === "questions") return query(input.questions); if (table === "answer_options") return query(input.options); throw new Error(`unexpected table ${table}`); } }; }
const memory = { files: new Map(), existsSync(file) { return this.files.has(file); }, readFileSync(file) { return this.files.get(file); }, writeFileSync(file, value) { this.files.set(file, value); }, mkdirSync() {} };
assert.equal(parseCli([]).mode, "dry-run");
assert.throws(() => parseCli(["--write-snapshot"]), /requires --contract/);
assert.throws(() => parseCli(["--apply"]), /not supported/);
const built = buildRuntimeContractSnapshot(rows); assert.equal(validateRuntimeContractSnapshot(built).state, "VALID");
const preview = run({ argv: [], supabase: supabaseFor(), fileSystem: memory });
Promise.resolve(preview).then(async (result) => {
  assert.equal(result.ok, true); assert.equal(result.mode, "dry-run"); assert.equal(result.localSnapshotWritten, false); assert.equal(result.questionCount, 1); assert.equal(result.optionCount, 2);
  const zero = await run({ argv: [], supabase: supabaseFor({ ...rows, test: { ...rows.test, status: "draft", is_active: false } }), fileSystem: memory }); assert.equal(zero.ok, false);
  const duplicateQuestion = buildRuntimeContractSnapshot({ ...rows, questions: [...rows.questions, { ...rows.questions[0], id: "other", question_order: 2 }] }); assert.equal(validateRuntimeContractSnapshot(duplicateQuestion).state, "INVALID");
  const changed = structuredClone(built); changed.questions[0].options[0].value = 9; assert.equal(validateRuntimeContractSnapshot(changed).state, "INVALID");
  memory.files.set(path.join(path.resolve(__dirname, ".."), "fixtures/golden-demo/contracts/team-dynamics-assessment-v1-runtime.json"), JSON.stringify(built));
  const exact = await run({ argv: ["--write-snapshot", "--contract", "team_dynamics_assessment_v1"], supabase: supabaseFor(), fileSystem: memory }); assert.equal(exact.state, "EXACT_MATCH"); assert.equal(exact.localSnapshotWritten, false);
  const drift = structuredClone(built); drift.checksum = "different"; memory.files.set(path.join(path.resolve(__dirname, ".."), "fixtures/golden-demo/contracts/team-dynamics-assessment-v1-runtime.json"), JSON.stringify(drift));
  const driftResult = await run({ argv: ["--write-snapshot", "--contract", "team_dynamics_assessment_v1"], supabase: supabaseFor(), fileSystem: memory }); assert.equal(driftResult.state, "CONTRACT_DRIFT"); assert.equal(driftResult.localSnapshotWritten, false);
  console.log("✓ Team Dynamics runtime exporter control-flow and snapshot contract are offline-safe");
}).catch((error) => { console.error(error); process.exitCode = 1; });
