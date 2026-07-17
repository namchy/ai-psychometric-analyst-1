import crypto from "node:crypto";

export const TEAM_DYNAMICS_RUNTIME_CONTRACT_ID = "team_dynamics_assessment_v1";
export const TEAM_DYNAMICS_RUNTIME_SNAPSHOT_SCHEMA_VERSION = "team_dynamics_runtime_contract_v1";

export type RuntimeContractRow = {
  test: { id: string; slug: string; status: string; is_active: boolean; scoring_method: string | null; metadata: unknown };
  dimensions: Array<{ code: string; display_order: number; is_active: boolean; metadata: unknown }>;
  questions: Array<{ id: string; code: string; question_order: number; question_type: string; is_required: boolean; is_active: boolean; metadata: unknown }>;
  options: Array<{ id: string; question_id: string; code: string | null; value: number | string | null; option_order: number; metadata: unknown }>;
};

export type RuntimeContractSnapshot = {
  schema_version: typeof TEAM_DYNAMICS_RUNTIME_SNAPSHOT_SCHEMA_VERSION;
  contract_identity: typeof TEAM_DYNAMICS_RUNTIME_CONTRACT_ID;
  test: { slug: string; version: string | null; status: string; is_active: boolean; scoring_method: string | null; metadata: unknown };
  dimensions: Array<{ code: string; order: number; metadata: unknown }>;
  questions: Array<{ code: string; order: number; question_type: string; required: boolean; metadata: unknown; options: Array<{ code: string; value: number | string | null; order: number; metadata: unknown }> }>;
  source_summary: { question_count: number; required_question_count: number; option_count: number; dimension_count: number; runtime_readiness: "active_runtime" };
  checksum: string;
};

function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function checksumRuntimeContract(value: Omit<RuntimeContractSnapshot, "checksum">): string {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function sourceVersion(metadata: any): string | null {
  const value = metadata?.version ?? metadata?.content_spec?.assessment?.version ?? null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildRuntimeContractSnapshot(rows: RuntimeContractRow): RuntimeContractSnapshot {
  const questions = [...rows.questions]
    .filter((question) => question.is_active)
    .sort((a, b) => a.question_order - b.question_order || a.code.localeCompare(b.code))
    .map((question) => ({
      code: question.code,
      order: question.question_order,
      question_type: question.question_type,
      required: question.is_required,
      metadata: canonicalize(question.metadata ?? {}),
      options: rows.options
        .filter((option) => option.question_id === question.id)
        .sort((a, b) => a.option_order - b.option_order || String(a.code).localeCompare(String(b.code)))
        .map((option) => ({ code: option.code ?? "", value: option.value, order: option.option_order, metadata: canonicalize(option.metadata ?? {}) })),
    }));
  const value: Omit<RuntimeContractSnapshot, "checksum"> = {
    schema_version: TEAM_DYNAMICS_RUNTIME_SNAPSHOT_SCHEMA_VERSION,
    contract_identity: TEAM_DYNAMICS_RUNTIME_CONTRACT_ID,
    test: { slug: rows.test.slug, version: sourceVersion(rows.test.metadata), status: rows.test.status, is_active: rows.test.is_active, scoring_method: rows.test.scoring_method, metadata: canonicalize(rows.test.metadata ?? {}) },
    dimensions: [...rows.dimensions].filter((dimension) => dimension.is_active).sort((a, b) => a.display_order - b.display_order || a.code.localeCompare(b.code)).map((dimension) => ({ code: dimension.code, order: dimension.display_order, metadata: canonicalize(dimension.metadata ?? {}) })),
    questions,
    source_summary: { question_count: questions.length, required_question_count: questions.filter((question) => question.required).length, option_count: questions.reduce((count, question) => count + question.options.length, 0), dimension_count: rows.dimensions.filter((dimension) => dimension.is_active).length, runtime_readiness: "active_runtime" as const },
  };
  return { ...value, checksum: checksumRuntimeContract(value) };
}

export type SnapshotValidation = { state: "VALID" | "INVALID"; errors: string[] };
const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const forbidden = /(?:candidate|participant|organization|service_role|secret|password|token|api_key)/i;

export function validateRuntimeContractSnapshot(snapshot: unknown): SnapshotValidation {
  const errors: string[] = [];
  const data = snapshot as RuntimeContractSnapshot;
  if (!data || typeof data !== "object") return { state: "INVALID", errors: ["Snapshot must be an object."] };
  if (data.schema_version !== TEAM_DYNAMICS_RUNTIME_SNAPSHOT_SCHEMA_VERSION) errors.push("Unsupported schema_version.");
  if (data.contract_identity !== TEAM_DYNAMICS_RUNTIME_CONTRACT_ID) errors.push("Unexpected contract identity.");
  if (!data.test || data.test.slug !== TEAM_DYNAMICS_RUNTIME_CONTRACT_ID || data.test.status !== "active" || data.test.is_active !== true || data.test.scoring_method !== "mixed_v1") errors.push("Test is not the one active mixed_v1 Team Dynamics runtime.");
  if (!Array.isArray(data.questions) || data.questions.length === 0) errors.push("Snapshot has no questions.");
  const questionCodes = new Set<string>(); let priorOrder = -Infinity; let options = 0;
  for (const question of data.questions ?? []) {
    if (!question.code || UUID.test(question.code) || /team[ _-]?fit/i.test(question.code)) errors.push(`Invalid question identity: ${question.code}.`);
    if (questionCodes.has(question.code)) errors.push(`Duplicate question identity: ${question.code}.`); questionCodes.add(question.code);
    if (!Number.isInteger(question.order) || question.order <= priorOrder) errors.push(`Question order is not stable at ${question.code}.`); priorOrder = question.order;
    if (!["single_choice", "multiple_choice", "text"].includes(question.question_type)) errors.push(`Unsupported question type: ${question.question_type}.`);
    if (typeof question.required !== "boolean") errors.push(`Missing required contract for ${question.code}.`);
    if (question.question_type !== "text" && question.options.length === 0) errors.push(`Missing option catalog for ${question.code}.`);
    const optionCodes = new Set<string>(); let priorOptionOrder = -Infinity;
    for (const option of question.options ?? []) {
      options += 1;
      if (!option.code || UUID.test(option.code)) errors.push(`Invalid option identity for ${question.code}.`);
      if (optionCodes.has(option.code)) errors.push(`Duplicate option identity for ${question.code}/${option.code}.`); optionCodes.add(option.code);
      if (!Number.isInteger(option.order) || option.order <= priorOptionOrder) errors.push(`Option order is not stable for ${question.code}.`); priorOptionOrder = option.order;
      if (option.value !== null && typeof option.value !== "number" && typeof option.value !== "string") errors.push(`Unsupported option value for ${question.code}/${option.code}.`);
    }
  }
  if (data.source_summary?.question_count !== data.questions?.length || data.source_summary?.option_count !== options || data.source_summary?.required_question_count !== data.questions?.filter((question) => question.required).length) errors.push("Source counts do not match canonical entries.");
  const scan = JSON.stringify(data); if (forbidden.test(scan)) errors.push("Snapshot contains forbidden candidate, organization, or secret-oriented data.");
  const { checksum, ...withoutChecksum } = data; if (!checksum || checksum !== checksumRuntimeContract(withoutChecksum)) errors.push("Checksum mismatch.");
  return { state: errors.length ? "INVALID" : "VALID", errors };
}

export function classifyExistingSnapshot(existing: unknown, next: RuntimeContractSnapshot): "EXACT_MATCH" | "CONTRACT_DRIFT" | "SNAPSHOT_MISSING" {
  if (!existing) return "SNAPSHOT_MISSING";
  return (existing as RuntimeContractSnapshot).checksum === next.checksum ? "EXACT_MATCH" : "CONTRACT_DRIFT";
}
