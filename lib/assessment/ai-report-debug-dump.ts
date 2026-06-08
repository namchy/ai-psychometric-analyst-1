import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import type { PreparedReportGenerationInput } from "@/lib/assessment/report-providers";

export type AiReportDebugDumpRequestBody = {
  model: string;
  response_format: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: true;
      schema: Record<string, unknown>;
    };
  };
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
  temperature?: number;
};

export type AiReportDebugDumpContext = {
  provider: string;
  systemPrompt: string;
  renderedUserPrompt: string;
  requestBody: AiReportDebugDumpRequestBody;
  model: string;
  promptVersionId?: string | null;
  promptVersion?: string | null;
  promptSource?: string | null;
  promptKey?: string | null;
  promptTemplateId?: string | null;
  promptTemplateVersion?: string | null;
  testId?: string | null;
  testSlug?: string | null;
  audience?: string | null;
};

export type AiReportDebugDumpOptions = {
  tmpDir?: string;
  now?: Date;
  randomSuffix?: string;
  redactValues?: Array<string | null | undefined>;
  writeFile?: (filePath: string, data: string, encoding: BufferEncoding) => Promise<void>;
  warn?: (message: string, details?: Record<string, unknown>) => void;
};

const DEBUG_DUMP_FLAG = "AI_REPORT_DEBUG_DUMP_PROMPTS";
const DEBUG_DUMP_DIR_NAME = "ai-report-debug-dumps";
const SENSITIVE_KEY_PATTERN =
  /(api[_-]?key|authorization|bearer|token|secret|password|cookie|session|private[_-]?key|client[_-]?secret|refresh[_-]?token)/i;

function isDebugDumpEnabled(): boolean {
  return process.env[DEBUG_DUMP_FLAG]?.trim().toLowerCase() === "true";
}

function readStringField(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of keys) {
    if (typeof record[key] === "string") {
      return record[key];
    }
  }

  return null;
}

function readNestedStringField(value: unknown, keyPath: string[][]): string | null {
  for (const pathParts of keyPath) {
    let current: unknown = value;
    let valid = true;

    for (const part of pathParts) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        valid = false;
        break;
      }

      current = (current as Record<string, unknown>)[part];
    }

    if (valid && typeof current === "string") {
      return current;
    }
  }

  return null;
}

function normalizeFilePart(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized.length > 0 ? normalized.slice(0, 48) : fallback;
}

function redactString(value: string, redactValues: Array<string | null | undefined>): string {
  let output = value;

  for (const secret of redactValues) {
    if (typeof secret === "string" && secret.length > 0) {
      output = output.split(secret).join("[REDACTED]");
    }
  }

  output = output.replace(/\bOPENAI_API_KEY\b/g, "[REDACTED_ENV]");
  output = output.replace(/\bAuthorization\b/g, "[REDACTED_HEADER]");
  output = output.replace(/\bBearer\b/g, "[REDACTED_BEARER]");

  return output;
}

function sanitizeValue(value: unknown, redactValues: Array<string | null | undefined>, key?: string): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    return redactString(value, redactValues);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, redactValues));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeValue(childValue, redactValues, childKey),
      ]),
    );
  }

  return value;
}

function getPromptAudience(input: PreparedReportGenerationInput): "hr" | "participant" | null {
  const directAudience = readStringField(input.promptInput, ["audience"]);

  if (directAudience === "hr" || directAudience === "participant") {
    return directAudience;
  }

  return readNestedStringField(input.promptInput, [["test", "audience"]]) as
    | "hr"
    | "participant"
    | null;
}

function getPromptTestId(input: PreparedReportGenerationInput): string | null {
  return (
    readStringField(input.promptInput, ["test_id", "testId"]) ??
    readNestedStringField(input.promptInput, [["test", "id"]])
  );
}

function getPromptSlug(input: PreparedReportGenerationInput): string | null {
  return (
    readStringField(input.promptInput, ["test_slug", "testSlug"]) ??
    readNestedStringField(input.promptInput, [["test", "slug"]])
  );
}

function isTargetDebugDumpLane(input: PreparedReportGenerationInput): boolean {
  return (
    getPromptAudience(input) === "hr" &&
    (input.reportContract.family === "big_five" ||
      input.reportContract.family === "mwms" ||
      input.reportContract.family === "safran")
  );
}

export function buildAiReportDebugDumpRecord(
  input: PreparedReportGenerationInput,
  context: AiReportDebugDumpContext,
  options?: AiReportDebugDumpOptions,
): Record<string, unknown> {
  const redactValues = options?.redactValues ?? [];
  const timestamp = options?.now?.toISOString() ?? new Date().toISOString();
  const promptTemplate = input.promptTemplate;

  return {
    timestamp,
    provider: context.provider,
    report_lane_id: `${input.reportContract.family}/${input.reportContract.sourceType}/${input.reportContract.reportType}/${getPromptAudience(input) ?? "unknown"}`,
    report_family: input.reportContract.family,
    report_type: input.reportContract.reportType,
    prompt_source: context.promptSource ?? promptTemplate?.sourceType ?? input.reportContract.sourceType,
    prompt_version_id: context.promptVersionId ?? input.promptVersionId ?? null,
    prompt_version: context.promptVersion ?? input.promptVersion,
    prompt_key: context.promptKey ?? input.reportContract.promptKey,
    prompt_template_id: context.promptTemplateId ?? promptTemplate?.id ?? null,
    prompt_template_version: context.promptTemplateVersion ?? promptTemplate?.version ?? null,
    test_id: context.testId ?? getPromptTestId(input),
    test_slug: context.testSlug ?? getPromptSlug(input) ?? input.testSlug,
    audience: context.audience ?? getPromptAudience(input),
    model: context.model,
    system_prompt: redactString(context.systemPrompt, redactValues),
    rendered_user_prompt: redactString(context.renderedUserPrompt, redactValues),
    response_format: sanitizeValue(context.requestBody.response_format, redactValues),
    request_body: sanitizeValue(context.requestBody, redactValues),
  };
}

export function buildAiReportDebugDumpFilePath(
  input: PreparedReportGenerationInput,
  context: AiReportDebugDumpContext,
  options?: AiReportDebugDumpOptions,
): string {
  const timestamp = options?.now?.toISOString() ?? new Date().toISOString();
  const hash = createHash("sha1")
    .update(
      JSON.stringify({
        reportLaneId: `${input.reportContract.family}/${input.reportContract.sourceType}/${input.reportContract.reportType}/${getPromptAudience(input) ?? "unknown"}`,
        model: context.model,
        promptSource: context.promptSource ?? input.reportContract.sourceType,
        promptVersionId: context.promptVersionId ?? input.promptVersionId ?? null,
        promptKey: context.promptKey ?? input.reportContract.promptKey,
        timestamp,
        requestBody: context.requestBody,
      }),
    )
    .digest("hex")
    .slice(0, 10);
  const randomPart = options?.randomSuffix?.trim() || randomBytes(3).toString("hex");
  const lanePart = normalizeFilePart(
    `${input.reportContract.family}-${input.reportContract.sourceType}-${input.reportContract.reportType}-${getPromptAudience(input) ?? "unknown"}`,
    "lane",
  );
  const sourcePart = normalizeFilePart(
    context.promptSource ?? input.reportContract.sourceType,
    "source",
  );
  const safeTimestamp = timestamp.replace(/[:.]/g, "-");

  return path.join(
    options?.tmpDir ?? tmpdir(),
    DEBUG_DUMP_DIR_NAME,
    `${normalizeFilePart(context.provider, "provider")}-${lanePart}-${sourcePart}-${safeTimestamp}-${hash}-${randomPart}.json`,
  );
}

export async function maybeWriteAiReportDebugDump(
  input: PreparedReportGenerationInput,
  context: AiReportDebugDumpContext,
  options?: AiReportDebugDumpOptions,
): Promise<string | null> {
  if (!isDebugDumpEnabled() || !isTargetDebugDumpLane(input)) {
    return null;
  }

  const filePath = buildAiReportDebugDumpFilePath(input, context, options);
  const payload = `${JSON.stringify(
    buildAiReportDebugDumpRecord(input, context, options),
    null,
    2,
  )}\n`;
  const write = options?.writeFile ?? writeFile;
  const warn =
    options?.warn ??
    (process.env.NODE_ENV !== "production"
      ? (message: string, details?: Record<string, unknown>) => {
          console.warn(message, details);
        }
      : null);

  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await write(filePath, payload, "utf8");
    return filePath;
  } catch (error) {
    if (warn) {
      warn("AI report debug dump write failed", {
        filePath,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }
}
