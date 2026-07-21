const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  GDT_01_COUNTS,
  GDT_01_RUNTIME_CHECKSUM,
  loadGdt01DbContract,
} = require("../lib/golden-demo/team-dynamics-gdt-01-db-contract.ts");

const sqlPath = path.join(root, "supabase/migrations/20260721143000_create_gdt01_team_dynamics_seed_rpc.sql");
const source = fs.readFileSync(sqlPath, "utf8");
const manifestMatch = source.match(/\$gdt01_manifest\$\n([\s\S]*?)\n\$gdt01_manifest\$::jsonb/);
assert.ok(manifestMatch, "SQL-owned manifest literal must exist.");
const manifest = JSON.parse(manifestMatch[1]);

function canonicalProjection() {
  const contract = loadGdt01DbContract(root);
  return {
    manifest_version: "gdt_01_team_dynamics_seed_manifest_v1",
    runtime_contract_checksum: GDT_01_RUNTIME_CHECKSUM,
    members: contract.members.map((member) => ({
      candidate_id: member.candidateId,
      email: member.email,
      responses: contract.responses
        .filter((response) => response.candidateId === member.candidateId)
        .map((response) => response.responseType === "likert_single"
          ? {
              question_code: response.questionCode,
              question_order: response.questionOrder,
              response_type: response.responseType,
              option_code: response.optionCode,
              option_value: response.optionValue,
              selection_roles: [],
            }
          : {
              question_code: response.questionCode,
              question_order: response.questionOrder,
              response_type: response.responseType,
              best_option_code: response.bestOptionCode,
              worst_option_code: response.worstOptionCode,
              selection_roles: [
                { role: "best", option_code: response.bestOptionCode },
                { role: "worst", option_code: response.worstOptionCode },
              ],
            }),
    })),
  };
}

assert.deepEqual(manifest, canonicalProjection(), "SQL manifest must exactly equal the canonical fixture projection.");
assert.equal(manifest.runtime_contract_checksum, GDT_01_RUNTIME_CHECKSUM, "Runtime checksum remains a runtime-contract checksum.");
assert.equal(manifest.members.length, GDT_01_COUNTS.members);
assert.equal(manifest.members.reduce((count, member) => count + member.responses.length, 0), GDT_01_COUNTS.totalResponses);
for (const member of manifest.members) {
  assert.equal(member.responses.length, GDT_01_COUNTS.responsesPerMember);
  assert.equal(member.responses.filter((response) => response.response_type === "likert_single").length, GDT_01_COUNTS.likertResponsesPerMember);
  assert.equal(member.responses.filter((response) => response.response_type === "sjt_best_worst").length, GDT_01_COUNTS.sjtResponsesPerMember);
}
const selections = manifest.members.flatMap((member) => member.responses.flatMap((response) => response.selection_roles));
assert.equal(selections.length, GDT_01_COUNTS.totalPhysicalSjtSelections);
assert.equal(manifest.members.reduce((count, member) => count + member.responses.reduce((total, response) => total + (response.response_type === "sjt_best_worst" ? 2 : 1), 0), 0), GDT_01_COUNTS.totalLogicalSelections);

function requirePattern(text, pattern, message) {
  assert.match(text, pattern, message);
}
function assertRemovalFails(needle, assertion, message) {
  assert.throws(() => assertion(source.replace(needle, "")), message);
}

requirePattern(source, /security definer/i, "SECURITY DEFINER is required.");
requirePattern(source, /set search_path = ''/i, "An empty search_path is required.");
requirePattern(source, /revoke all on function[\s\S]*from public/i, "PUBLIC execute must be revoked.");
requirePattern(source, /revoke all on function[\s\S]*from anon/i, "anon execute must be revoked.");
requirePattern(source, /revoke all on function[\s\S]*from authenticated/i, "authenticated execute must be revoked.");
requirePattern(source, /grant execute on function[\s\S]*to service_role/i, "Only service_role may execute.");
assert.doesNotMatch(source, /current_user|session_user|auth\.role|request\.jwt|payload secret|api[_ -]?key/i, "No unproven inner identity guard or payload secret may be introduced.");

requirePattern(source, /v_manifest constant jsonb/, "Manifest must be SQL-owned.");
requirePattern(source, /p_payload ->> 'runtime_contract_checksum'/, "Payload must carry the runtime-contract checksum under its exact semantic key.");
assert.doesNotMatch(source, /p_payload\s*->>\s*'fixture_checksum'/, "Legacy fixture_checksum payload alias must not be accepted.");
requirePattern(source, /p_payload \? 'fixture_checksum'/, "Legacy fixture_checksum payload key must be explicitly rejected.");
requirePattern(source, /from pg_catalog\.jsonb_to_recordset\(v_manifest -> 'members'\)/, "Roster must be read from the SQL manifest.");
requirePattern(source, /from pg_catalog\.jsonb_to_recordset\(v_manifest -> 'members'\) as m[\s\S]*m\.responses/, "Answers must be read from the SQL manifest.");
requirePattern(source, /lower\(p\.email\) = lower\(m\.email\)/, "Candidate identity must resolve from server-owned email.");
requirePattern(source, /group by m\.candidate_id\n      having count\(p\.id\) <> 1/, "Participant resolution must be exactly one per canonical candidate.");
requirePattern(source, /tm\.team_id = v_team_id[\s\S]*tm\.participant_id = m\.participant_id[\s\S]*tm\.is_active = true/, "Membership must be exact and active on the target team.");
requirePattern(source, /group by m\.candidate_id\n      having count\(tm\.id\) <> 1/, "Membership resolution must be exactly one per canonical candidate.");
requirePattern(source, /q\.question_type = 'single_choice'[\s\S]*q\.metadata ->> 'response_format' = 'single_select_likert'/, "Likert runtime format guard is required.");
requirePattern(source, /q\.question_type = 'multiple_choice'[\s\S]*q\.metadata ->> 'response_format' = 'best_worst'/, "SJT runtime format guard is required.");
requirePattern(source, /o\.question_id = a\.question_id/, "Options must be resolved inside the selected question.");
requirePattern(source, /best_option_id = worst_option_id/, "Best/worst distinct-option guard is required.");
requirePattern(source, /array\['best', 'worst'\]\) role/, "SJT selection roles must be explicit.");

const lockIndex = source.indexOf("pg_advisory_xact_lock");
const emptyIndex = source.indexOf("GDT01_NOT_EMPTY");
assert.ok(lockIndex >= 0 && emptyIndex >= 0 && lockIndex < emptyIndex, "Entity-scoped transaction lock must precede EMPTY guard.");
requirePattern(source, /v_org_id::text \|\| ':' \|\| v_team_id::text \|\| ':team_dynamics_assessment_v1'/, "Lock must use resolved organization/team/package scope.");
requirePattern(source, /Canonical target-like lineage matches the seed inspector/, "EMPTY lineage definition must be documented.");
for (const entity of ["public.team_assessment_assignments", "public.team_assessment_participants", "public.attempts", "public.responses", "public.response_selections", "public.team_assessment_report_selection_drafts", "public.team_assessment_report_selection_members", "public.attempt_reports", "public.team_fit_reports"]) {
  assert.ok(source.includes(entity), `EMPTY lineage must inspect ${entity}.`);
}
assert.doesNotMatch(source, /join gdt01_members m on m\.participant_id=a\.participant_id where a\.test_id=v_test_id/, "Broad participant-only canonical attempt blocker must not return.");

for (const field of ["stateBefore", "stateAfter", "assignmentId", "assignmentCount", "wrapperCount", "attemptCount", "responseCount", "physicalSelectionCount", "logicalSelectionCount", "manifestVersion", "runtimeContractChecksum", "teamCode", "testSlug"]) {
  assert.ok(source.includes(`'${field}'`), `RPC result field ${field} is required.`);
}
requirePattern(source, /'assignmentId', v_assignment_id/, "RPC result must return a non-null assignment UUID from INSERT RETURNING.");
requirePattern(source, /'assignmentCount', 1/, "RPC result assignment count is required.");
requirePattern(source, /'wrapperCount', v_wrapper_count/, "RPC result wrapper count must be read back.");
requirePattern(source, /'attemptCount', v_attempt_count/, "RPC result attempt count must be read back.");
requirePattern(source, /v_wrapper_count <> 6 or v_attempt_count <> 6/, "Postcondition must verify wrapper and attempt counts.");
requirePattern(source, /'logicalSelectionCount', 324/, "RPC result logical selection count is required.");

assertRemovalFails("candidate_id text primary key", (mutated) => requirePattern(mutated, /candidate_id text primary key/, "candidate mapping guard"), "Removing canonical candidate mapping must fail this contract test.");
assertRemovalFails("v_manifest constant jsonb", (mutated) => requirePattern(mutated, /v_manifest constant jsonb/, "manifest guard"), "Removing SQL manifest guard must fail this contract test.");
assertRemovalFails("p_payload ->> 'runtime_contract_checksum'", (mutated) => requirePattern(mutated, /p_payload ->> 'runtime_contract_checksum'/, "runtime checksum payload key"), "Removing the runtime-contract checksum payload key must fail this contract test.");
assertRemovalFails("q.metadata ->> 'response_format' = 'best_worst'", (mutated) => requirePattern(mutated, /q\.metadata ->> 'response_format' = 'best_worst'/, "runtime format guard"), "Removing runtime format guard must fail this contract test.");
assertRemovalFails(
  "from public.response_selections s\n      join public.responses r",
  (mutated) => requirePattern(mutated, /or exists \(\n      select 1\n      from public\.response_selections s\n      join public\.responses r/, "selection lineage guard"),
  "Removing selection lineage guard must fail this contract test.",
);
assertRemovalFails("grant execute on function public.create_gdt_01_team_dynamics_seed_v1(jsonb) to service_role;", (mutated) => requirePattern(mutated, /grant execute on function[\s\S]*to service_role/i, "service-role grant"), "Removing service-role-only grant must fail this contract test.");
assertRemovalFails("'logicalSelectionCount'", (mutated) => assert.ok(mutated.includes("'logicalSelectionCount'"), "result count field"), "Removing a result count field must fail this contract test.");

console.log("GDT-01 Team Dynamics seed RPC SQL contract: PASS");
