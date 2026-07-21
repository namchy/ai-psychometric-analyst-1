import {
  GDT_01_COUNTS,
  GDT_01_ORGANIZATION_NAME,
  GDT_01_PACKAGE_SLUG,
  GDT_01_RUNTIME_CHECKSUM,
  GDT_01_TEAM_ID,
  type Gdt01DbContract,
  type Gdt01InspectionResult,
  type Gdt01ObservedState,
} from "./team-dynamics-gdt-01-db-contract";

export const GDT_01_TEAM_DYNAMICS_WRITER_RPC = "create_gdt_01_team_dynamics_seed_v1" as const;
export const GDT_01_TEAM_DYNAMICS_WRITER_CONFIRMATION = "GDT_01_TEAM_DYNAMICS" as const;
export const GDT_01_TEAM_DYNAMICS_MANIFEST_VERSION = "gdt_01_team_dynamics_seed_manifest_v1" as const;

export type Gdt01SeedPayload = {
  schema_version: "gdt_01_team_dynamics_seed_payload_v1";
  runtime_contract_checksum: typeof GDT_01_RUNTIME_CHECKSUM;
  organization_name: string;
  team_id: string;
  team_name: string;
  package_slug: string;
  locale: string;
  runtime: { contract_identity: string; version: string | null; checksum: string; question_count: number; option_count: number };
  members: Array<{ candidate_id: string; email: string; responses: Array<{ question_code: string; question_order: number; response_type: "likert_single" | "sjt_best_worst"; option_code?: string; option_value?: number | string | null; best_option_code?: string; worst_option_code?: string }> }>;
};

export type Gdt01WriterPlan = {
  stateBefore: Gdt01InspectionResult["state"];
  rpcAllowed: boolean;
  noOpEligible: boolean;
  reasonCode: "EMPTY_READY" | "EXACT_MATCH_NOOP" | "WRITE_BLOCKED";
  reason: string;
  payload: Gdt01SeedPayload;
  expectedCounts: typeof GDT_01_COUNTS;
};

export type Gdt01WriterRpcClient = {
  rpc(functionName: typeof GDT_01_TEAM_DYNAMICS_WRITER_RPC, args: { p_payload: Gdt01SeedPayload }): Promise<{ data: unknown; error: { message: string } | null }>;
};

export type Gdt01ValidatedSeedRpcResult = {
  stateBefore: "EMPTY";
  stateAfter: "EXACT_MATCH";
  assignmentId: string;
  assignmentCount: 1;
  wrapperCount: 6;
  attemptCount: 6;
  responseCount: 288;
  physicalSelectionCount: 72;
  logicalSelectionCount: 324;
  manifestVersion: typeof GDT_01_TEAM_DYNAMICS_MANIFEST_VERSION;
  runtimeContractChecksum: typeof GDT_01_RUNTIME_CHECKSUM;
  teamCode: "GDT-01";
  testSlug: "team_dynamics_assessment_v1";
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function requireExactInteger(value: unknown, expected: number, field: string) {
  if (!Number.isInteger(value) || value !== expected) throw new Error(`GDT-01 inspector contract mismatch for ${field}.`);
}

function requireExactKeys(value: Record<string, unknown>, keys: string[], label: string) {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new Error(`GDT-01 writer received an invalid ${label} shape.`);
  }
}

export function validateGdt01InspectionResult(value: unknown): Gdt01InspectionResult {
  if (!isPlainRecord(value) || !isPlainRecord(value.target) || !isPlainRecord(value.counts) || !Array.isArray(value.blockingFindings) || !Array.isArray(value.diagnosticFindings) || !isPlainRecord(value.safety)) {
    throw new Error("GDT-01 writer received an invalid inspector result object.");
  }
  requireExactKeys(value, ["target", "state", "writerEligible", "counts", "blockingFindings", "diagnosticFindings", "safety"], "inspector result");
  requireExactKeys(value.target, ["organization", "teamId", "packageSlug", "runtimeChecksum"], "inspector target");
  requireExactKeys(value.counts, ["membersExpected", "wrappersObserved", "attemptsObserved", "responsesExpected", "responsesObserved", "physicalSjtSelectionsExpected", "physicalSjtSelectionsObserved", "logicalSelectionsExpected", "logicalSelectionsObserved"], "inspector counts");
  requireExactKeys(value.safety, ["readOnly", "databaseWrites", "rpcCalls", "scoringExecuted", "aggregationExecuted", "reportsGenerated", "openaiCalled"], "inspector safety");
  const inspection = value as unknown as Gdt01InspectionResult;
  if (inspection.target.organization !== GDT_01_ORGANIZATION_NAME || inspection.target.teamId !== GDT_01_TEAM_ID || inspection.target.packageSlug !== GDT_01_PACKAGE_SLUG || inspection.target.runtimeChecksum !== GDT_01_RUNTIME_CHECKSUM) {
    throw new Error("GDT-01 writer received a noncanonical inspector target.");
  }
  if (!["EMPTY", "EXACT_MATCH", "PARTIAL", "CONFLICT"].includes(inspection.state)) {
    throw new Error(`GDT-01 writer received an unknown inspector state: ${String(inspection.state)}.`);
  }
  const counts = inspection.counts;
  requireExactInteger(counts.membersExpected, GDT_01_COUNTS.members, "membersExpected");
  requireExactInteger(counts.responsesExpected, GDT_01_COUNTS.totalResponses, "responsesExpected");
  requireExactInteger(counts.physicalSjtSelectionsExpected, GDT_01_COUNTS.totalPhysicalSjtSelections, "physicalSjtSelectionsExpected");
  requireExactInteger(counts.logicalSelectionsExpected, GDT_01_COUNTS.totalLogicalSelections, "logicalSelectionsExpected");
  for (const field of ["wrappersObserved", "attemptsObserved", "responsesObserved", "physicalSjtSelectionsObserved", "logicalSelectionsObserved"] as const) {
    if (!Number.isInteger(counts[field]) || counts[field] < 0) throw new Error(`GDT-01 inspector contract mismatch for ${field}.`);
  }
  if (inspection.safety.readOnly !== true || inspection.safety.databaseWrites !== false || inspection.safety.rpcCalls !== false || inspection.safety.scoringExecuted !== false || inspection.safety.aggregationExecuted !== false || inspection.safety.reportsGenerated !== false || inspection.safety.openaiCalled !== false) {
    throw new Error("GDT-01 writer requires a read-only inspector result.");
  }
  for (const finding of inspection.blockingFindings) {
    if (!isPlainRecord(finding) || typeof finding.code !== "string" || !finding.code || typeof finding.message !== "string" || !finding.message) {
      throw new Error("GDT-01 writer received an invalid blocking finding.");
    }
  }
  const allZero = counts.wrappersObserved === 0 && counts.attemptsObserved === 0 && counts.responsesObserved === 0 && counts.physicalSjtSelectionsObserved === 0 && counts.logicalSelectionsObserved === 0;
  const exact = counts.wrappersObserved === GDT_01_COUNTS.members && counts.attemptsObserved === GDT_01_COUNTS.members && counts.responsesObserved === GDT_01_COUNTS.totalResponses && counts.physicalSjtSelectionsObserved === GDT_01_COUNTS.totalPhysicalSjtSelections && counts.logicalSelectionsObserved === GDT_01_COUNTS.totalLogicalSelections;
  if (inspection.state === "EMPTY" && (!inspection.writerEligible || inspection.blockingFindings.length !== 0 || !allZero)) {
    throw new Error("GDT-01 EMPTY inspector result is semantically inconsistent.");
  }
  if (inspection.state === "EXACT_MATCH" && (inspection.writerEligible || inspection.blockingFindings.length !== 0 || !exact)) {
    throw new Error("GDT-01 EXACT_MATCH inspector result is semantically inconsistent.");
  }
  if ((inspection.state === "PARTIAL" || inspection.state === "CONFLICT") && (inspection.writerEligible || inspection.blockingFindings.length === 0)) {
    throw new Error(`GDT-01 ${inspection.state} inspector result is semantically inconsistent.`);
  }
  return Object.freeze({
    ...inspection,
    target: Object.freeze({ ...inspection.target }),
    counts: Object.freeze({ ...inspection.counts }),
    blockingFindings: Object.freeze(inspection.blockingFindings.map((finding) => Object.freeze({ ...finding }))),
    diagnosticFindings: Object.freeze(inspection.diagnosticFindings.map((finding) => Object.freeze({ ...finding }))),
    safety: Object.freeze({ ...inspection.safety }),
  }) as unknown as Gdt01InspectionResult;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateGdt01SeedRpcResult(value: unknown): Gdt01ValidatedSeedRpcResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GDT-01 seed RPC returned an invalid result object.");
  }
  const data = value as Record<string, unknown>;
  const expected: Record<keyof Omit<Gdt01ValidatedSeedRpcResult, "assignmentId">, unknown> = {
    stateBefore: "EMPTY",
    stateAfter: "EXACT_MATCH",
    assignmentCount: 1,
    wrapperCount: 6,
    attemptCount: 6,
    responseCount: 288,
    physicalSelectionCount: 72,
    logicalSelectionCount: 324,
    manifestVersion: GDT_01_TEAM_DYNAMICS_MANIFEST_VERSION,
    runtimeContractChecksum: GDT_01_RUNTIME_CHECKSUM,
    teamCode: "GDT-01",
    testSlug: "team_dynamics_assessment_v1",
  };
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (data[field] !== expectedValue) {
      throw new Error(`GDT-01 seed RPC result contract mismatch for ${field}.`);
    }
  }
  if (typeof data.assignmentId !== "string" || !UUID_PATTERN.test(data.assignmentId)) {
    throw new Error("GDT-01 seed RPC result has no valid assignmentId UUID.");
  }
  return {
    stateBefore: "EMPTY",
    stateAfter: "EXACT_MATCH",
    assignmentId: data.assignmentId,
    assignmentCount: 1,
    wrapperCount: 6,
    attemptCount: 6,
    responseCount: 288,
    physicalSelectionCount: 72,
    logicalSelectionCount: 324,
    manifestVersion: GDT_01_TEAM_DYNAMICS_MANIFEST_VERSION,
    runtimeContractChecksum: GDT_01_RUNTIME_CHECKSUM,
    teamCode: "GDT-01",
    testSlug: "team_dynamics_assessment_v1",
  };
}

export function buildGdt01SeedPayload(contract: Gdt01DbContract): Gdt01SeedPayload {
  if (!contract.runtimeSnapshot || contract.runtimeValidationErrors.length || contract.fixtureValidationErrors.length) {
    throw new Error("GDT-01 canonical fixture/runtime contract is invalid; payload construction is blocked.");
  }
  if (contract.runtimeSnapshot.checksum !== GDT_01_RUNTIME_CHECKSUM) throw new Error("GDT-01 runtime checksum mismatch; payload construction is blocked.");
  return {
    schema_version: "gdt_01_team_dynamics_seed_payload_v1",
    runtime_contract_checksum: GDT_01_RUNTIME_CHECKSUM,
    organization_name: contract.organizationName,
    team_id: contract.teamId,
    team_name: contract.teamName,
    package_slug: contract.packageSlug,
    locale: contract.lifecycle.locale,
    runtime: { contract_identity: contract.runtimeSnapshot.contract_identity, version: contract.runtimeSnapshot.test.version, checksum: contract.runtimeSnapshot.checksum, question_count: contract.runtimeSnapshot.source_summary.question_count, option_count: contract.runtimeSnapshot.source_summary.option_count },
    members: contract.members.map((member) => ({
      candidate_id: member.candidateId,
      email: member.email,
      responses: contract.responses.filter((response) => response.candidateId === member.candidateId).map((response) => ({
        question_code: response.questionCode,
        question_order: response.questionOrder,
        response_type: response.responseType,
        ...(response.responseType === "likert_single" ? { option_code: response.optionCode, option_value: response.optionValue } : { best_option_code: response.bestOptionCode, worst_option_code: response.worstOptionCode }),
      })),
    })),
  };
}

export function buildGdt01WriterPlan(input: { contract: Gdt01DbContract; observed?: Gdt01ObservedState; inspection: unknown }): Gdt01WriterPlan {
  const inspection = validateGdt01InspectionResult(input.inspection);
  const payload = buildGdt01SeedPayload(input.contract);
  if (!["EMPTY", "EXACT_MATCH", "PARTIAL", "CONFLICT"].includes(inspection.state)) {
    throw new Error(`GDT-01 writer received an unknown inspector state: ${String(inspection.state)}.`);
  }
  if (inspection.state === "EXACT_MATCH") return { stateBefore: inspection.state, rpcAllowed: false, noOpEligible: true, reasonCode: "EXACT_MATCH_NOOP", reason: "Canonical GDT-01 seed graph already exists; no RPC is allowed.", payload, expectedCounts: GDT_01_COUNTS };
  if (inspection.state !== "EMPTY" || !inspection.writerEligible) return { stateBefore: inspection.state, rpcAllowed: false, noOpEligible: false, reasonCode: "WRITE_BLOCKED", reason: `GDT-01 write requires EMPTY; observed ${inspection.state}${inspection.blockingFindings.length ? `: ${inspection.blockingFindings.map((finding) => finding.code).join(", ")}` : "."}`, payload, expectedCounts: GDT_01_COUNTS };
  return { stateBefore: inspection.state, rpcAllowed: true, noOpEligible: false, reasonCode: "EMPTY_READY", reason: "Canonical GDT-01 target graph is EMPTY; an explicitly approved RPC may seed it atomically.", payload, expectedCounts: GDT_01_COUNTS };
}

export async function executeGdt01WriterApply(input: { explicitApply: boolean; contract: Gdt01DbContract; inspection: unknown; rpcClient: Gdt01WriterRpcClient }) {
  const plan = buildGdt01WriterPlan({ contract: input.contract, inspection: input.inspection });
  if (plan.stateBefore === "EXACT_MATCH") {
    return { outcome: "exact_match_noop" as const, rpcCalled: false, plan };
  }
  if (!["EMPTY", "PARTIAL", "CONFLICT"].includes(plan.stateBefore)) {
    throw new Error(`GDT-01 writer refuses unknown plan state: ${String(plan.stateBefore)}.`);
  }
  if (plan.stateBefore !== "EMPTY" || !plan.rpcAllowed) {
    return { outcome: "blocked" as const, rpcCalled: false, plan };
  }
  if (!input.explicitApply) {
    return { outcome: "read_only_plan" as const, rpcCalled: false, plan };
  }
  if (!input.rpcClient || typeof input.rpcClient.rpc !== "function") {
    throw new Error("GDT-01 writer requires an injected RPC client for apply.");
  }
  const result = await input.rpcClient.rpc(GDT_01_TEAM_DYNAMICS_WRITER_RPC, { p_payload: plan.payload });
  if (result.error) throw new Error(`GDT-01 Team Dynamics seed RPC failed atomically: ${result.error.message}`);
  return { outcome: "applied" as const, rpcCalled: true, rpcResult: validateGdt01SeedRpcResult(result.data), plan };
}
