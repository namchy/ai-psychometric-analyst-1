import "server-only";

import type { CompositeHrInputSnapshot } from "@/lib/assessment/composite-input";
import {
  COMPOSITE_HR_REPORT_AUDIENCE,
  COMPOSITE_HR_REPORT_CONTRACT_VERSION,
  COMPOSITE_HR_REPORT_SOURCE_TYPE,
  COMPOSITE_HR_REPORT_TYPE,
  formatCompositeHrReportValidationErrors,
  validateCompositeHrReportSnapshot,
  type CompositeHrReportSnapshot,
} from "@/lib/assessment/composite-hr-report-contract";

export const COMPOSITE_HR_REPORT_OPENAI_PROVIDER = "openai" as const;
export const COMPOSITE_HR_REPORT_OPENAI_PROVIDER_VERSION = "v1" as const;

type OpenAiCompositeHrProviderOptions = {
  apiKey: string | null;
  model: string | null;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => string;
};

type ErrorWithCause = Error & {
  cause?: unknown;
};

const FORBIDDEN_TEXT_PATTERNS = [
  /(?:^|\W)zaposliti(?:\W|$)/i,
  /ne\s+zaposliti/i,
  /idealni kandidat/i,
  /fit score/i,
  /hire\/no-hire/i,
  /konačna preporuka za zapošljavanje/i,
  /clinical|kliničk|klinic|medicinsk/i,
];

function buildOpenAiSchemaName(schemaName: string): string {
  const sanitized = schemaName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");

  if (sanitized.length <= 64) {
    return sanitized || "schema";
  }

  return sanitized.slice(0, 64) || "schema";
}

function parseStructuredContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `OpenAI composite HR report returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function buildLocaleInstruction(locale: CompositeHrInputSnapshot["locale"]): string {
  switch (locale) {
    case "bs":
      return "Write narrative text in Bosnian, Latin script, ijekavica.";
    case "hr":
      return "Write narrative text in Croatian, Latin script.";
    case "sr":
      return "Write narrative text in Serbian, Latin script.";
    case "en":
      return "Write narrative text in English.";
    default:
      return `Write narrative text in locale ${locale}.`;
  }
}

function collectStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output);
    }

    return output;
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      collectStrings(nestedValue, output);
    }
  }

  return output;
}

function assertForbiddenPhrasing(snapshot: CompositeHrReportSnapshot): void {
  const text = collectStrings(snapshot).join("\n");

  for (const pattern of FORBIDDEN_TEXT_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`Composite HR report contains forbidden phrasing: ${pattern}`);
    }
  }
}

function assertImmutableSource(snapshot: CompositeHrReportSnapshot, input: CompositeHrInputSnapshot): void {
  const expectedAttemptIds = input.sourceAttempts.map((attempt) => attempt.attemptId);
  const expectedTestSlugs = input.coverage.completedTestSlugs.length > 0
    ? [...input.coverage.completedTestSlugs]
    : input.sourceAttempts.map((attempt) => attempt.testSlug);

  const sourceAttemptIdsMatch =
    snapshot.source.sourceAttemptIds.length === expectedAttemptIds.length &&
    snapshot.source.sourceAttemptIds.every((value, index) => value === expectedAttemptIds[index]);
  const testSlugsMatch =
    snapshot.source.testSlugs.length === expectedTestSlugs.length &&
    snapshot.source.testSlugs.every((value, index) => value === expectedTestSlugs[index]);

  if (!sourceAttemptIdsMatch) {
    throw new Error("Composite HR report sourceAttemptIds do not match CompositeHrInputSnapshot.");
  }

  if (!testSlugsMatch) {
    throw new Error("Composite HR report testSlugs do not match CompositeHrInputSnapshot.");
  }

  if (snapshot.source.inputContractVersion !== input.contractVersion) {
    throw new Error("Composite HR report inputContractVersion does not match CompositeHrInputSnapshot.");
  }

  if (snapshot.generatedFor.organizationId !== input.generatedFor.organizationId) {
    throw new Error("Composite HR report organizationId does not match CompositeHrInputSnapshot.");
  }

  if (snapshot.generatedFor.participantId !== input.generatedFor.participantId) {
    throw new Error("Composite HR report participantId does not match CompositeHrInputSnapshot.");
  }

  if (snapshot.generatedFor.assessmentAssignmentId !== input.generatedFor.assessmentAssignmentId) {
    throw new Error("Composite HR report assessmentAssignmentId does not match CompositeHrInputSnapshot.");
  }
}

function buildCompositeHrOpenAiSystemPrompt(input: CompositeHrInputSnapshot): string {
  return [
    "You generate HR-facing composite assessment reports.",
    "Return only JSON that matches the supplied JSON schema exactly.",
    "Use only the provided deterministic CompositeHrInputSnapshot.",
    "Do not read or infer any data outside the provided snapshot.",
    "Do not change scores, bands, source attempts, completed test slugs, coverage or generatedFor identifiers.",
    "Do not invent source attempts, tests, evidence or hidden attributes.",
    "Do not produce hire/no-hire advice, fit scores, rankings, medical claims, clinical language, protected-trait inferences or absolute statements.",
    "Write cautious decision-support text for HR, focused on interpretation, interview structure and onboarding guidance.",
    "Every integrated signal must be traceable to evidence from the provided tests.",
    "Keep limitations explicit and present.",
    buildLocaleInstruction(input.locale),
  ].join(" ");
}

function buildCompositeHrOpenAiUserPrompt(input: CompositeHrInputSnapshot): string {
  return JSON.stringify({
    instructions: {
      output_contract: COMPOSITE_HR_REPORT_CONTRACT_VERSION,
      audience: "HR only",
      source_rule: "Use only the provided deterministic CompositeHrInputSnapshot as source.",
      traceability_rule:
        "sourceAttemptIds, testSlugs and generatedFor identifiers must match the provided input exactly.",
      score_integrity_rule:
        "Do not change, reinterpret or normalize score values, bands, coverage or source attempts.",
      content_rules: [
        "Do not write hire/no-hire decisions.",
        "Do not use forbidden literal phrases such as zaposliti, ne zaposliti, idealni kandidat or fit score.",
        "Do not make medical, clinical or protected-trait claims.",
        "Do not present results as absolute truth.",
        "Do not add evidence that is not directly traceable to the input snapshot.",
      ],
      structure_rules: [
        "summary.headline should be one short HR-facing headline.",
        "summary.profileOverview should be a short integrated overview for HR interpretation.",
        "summary.keyStrengths should contain 2 to 4 concise items.",
        "summary.watchouts should contain 2 to 4 cautious watchout items.",
        "integratedSignals should contain 3 to 5 items with evidence arrays tied to real tests from the input.",
        "interviewGuidance.focusAreas should contain 2 to 4 items with practical questions.",
        "onboardingGuidance.managementTips should contain 2 to 4 items.",
        "onboardingGuidance.supportNeeds should contain 2 to 4 items.",
        "limitations should contain 2 to 4 items and remain explicit.",
      ],
      metadata_rules: [
        "metadata.provider must be openai",
        "metadata.providerVersion must be v1",
        "metadata.generatedAt must be an ISO timestamp string",
      ],
    },
    input,
  });
}

export const compositeHrReportOpenAiSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "contractVersion",
    "reportType",
    "audience",
    "sourceType",
    "locale",
    "generatedFor",
    "source",
    "summary",
    "integratedSignals",
    "interviewGuidance",
    "onboardingGuidance",
    "limitations",
    "metadata",
  ],
  properties: {
    contractVersion: {
      type: "string",
      const: COMPOSITE_HR_REPORT_CONTRACT_VERSION,
    },
    reportType: {
      type: "string",
      const: COMPOSITE_HR_REPORT_TYPE,
    },
    audience: {
      type: "string",
      const: COMPOSITE_HR_REPORT_AUDIENCE,
    },
    sourceType: {
      type: "string",
      const: COMPOSITE_HR_REPORT_SOURCE_TYPE,
    },
    locale: {
      type: "string",
      minLength: 1,
    },
    generatedFor: {
      type: "object",
      additionalProperties: false,
      required: ["organizationId", "participantId", "assessmentAssignmentId"],
      properties: {
        organizationId: { type: "string", minLength: 1 },
        participantId: { type: "string", minLength: 1 },
        assessmentAssignmentId: { type: "string", minLength: 1 },
      },
    },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["inputContractVersion", "sourceAttemptIds", "testSlugs"],
      properties: {
        inputContractVersion: { type: "string", minLength: 1 },
        sourceAttemptIds: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
        testSlugs: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
      },
    },
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "profileOverview", "keyStrengths", "watchouts"],
      properties: {
        headline: { type: "string", minLength: 1 },
        profileOverview: { type: "string", minLength: 1 },
        keyStrengths: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
        watchouts: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
      },
    },
    integratedSignals: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "body", "evidence"],
        properties: {
          id: { type: "string", minLength: 1 },
          title: { type: "string", minLength: 1 },
          body: { type: "string", minLength: 1 },
          evidence: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["testSlug", "label", "value"],
              properties: {
                testSlug: { type: "string", minLength: 1 },
                label: { type: "string", minLength: 1 },
                value: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
    interviewGuidance: {
      type: "object",
      additionalProperties: false,
      required: ["focusAreas"],
      properties: {
        focusAreas: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "rationale", "questions"],
            properties: {
              title: { type: "string", minLength: 1 },
              rationale: { type: "string", minLength: 1 },
              questions: {
                type: "array",
                minItems: 1,
                items: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
    onboardingGuidance: {
      type: "object",
      additionalProperties: false,
      required: ["managementTips", "supportNeeds"],
      properties: {
        managementTips: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
        supportNeeds: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
      },
    },
    limitations: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["provider", "providerVersion", "generatedAt"],
      properties: {
        provider: { type: "string", minLength: 1 },
        providerVersion: { type: "string", minLength: 1 },
        generatedAt: { type: "string", minLength: 1 },
      },
    },
  },
} as const satisfies Record<string, unknown>;

async function requestOpenAiStructuredJson(
  options: OpenAiCompositeHrProviderOptions,
  payload: {
    label: string;
    schemaName: string;
    schema: Record<string, unknown>;
    systemPrompt: string;
    userPrompt: string;
  },
): Promise<unknown> {
  if (!options.apiKey) {
    throw new Error("Missing required env var: OPENAI_API_KEY");
  }

  if (!options.model) {
    throw new Error("Missing required env var: AI_REPORT_MODEL");
  }

  const timeoutMs = options.timeoutMs ?? 120000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new Error(`OpenAI composite HR report timed out after ${timeoutMs}ms.`),
      ),
    timeoutMs,
  );

  try {
    const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: buildOpenAiSchemaName(payload.schemaName),
            strict: true,
            schema: payload.schema,
          },
        },
        messages: [
          {
            role: "system",
            content: payload.systemPrompt,
          },
          {
            role: "user",
            content: payload.userPrompt,
          },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI composite HR report request failed with status ${response.status}: ${errorText}`,
      );
    }

    const responsePayload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = responsePayload.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      throw new Error("OpenAI composite HR report response did not contain structured content.");
    }

    return parseStructuredContent(content);
  } catch (error) {
    const normalizedError = error instanceof Error ? (error as ErrorWithCause) : null;
    throw new Error(
      `OpenAI composite HR report failed: ${normalizedError?.message ?? String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateOpenAiCompositeHrReport(
  input: CompositeHrInputSnapshot,
  options: OpenAiCompositeHrProviderOptions,
): Promise<CompositeHrReportSnapshot> {
  const rawReport = await requestOpenAiStructuredJson(options, {
    label: "composite HR report",
    schemaName: COMPOSITE_HR_REPORT_CONTRACT_VERSION,
    schema: compositeHrReportOpenAiSchema as Record<string, unknown>,
    systemPrompt: buildCompositeHrOpenAiSystemPrompt(input),
    userPrompt: buildCompositeHrOpenAiUserPrompt(input),
  });

  const initialValidation = validateCompositeHrReportSnapshot(rawReport);

  if (!initialValidation.ok) {
    throw new Error(
      `OpenAI composite HR report failed validation: ${formatCompositeHrReportValidationErrors(initialValidation.errors)}`,
    );
  }

  assertImmutableSource(initialValidation.value, input);
  assertForbiddenPhrasing(initialValidation.value);

  const normalizedReport: CompositeHrReportSnapshot = {
    ...initialValidation.value,
    metadata: {
      provider: COMPOSITE_HR_REPORT_OPENAI_PROVIDER,
      providerVersion: COMPOSITE_HR_REPORT_OPENAI_PROVIDER_VERSION,
      generatedAt: options.now?.() ?? new Date().toISOString(),
    },
  };
  const normalizedValidation = validateCompositeHrReportSnapshot(normalizedReport);

  if (!normalizedValidation.ok) {
    throw new Error(
      `OpenAI composite HR report failed normalized validation: ${formatCompositeHrReportValidationErrors(normalizedValidation.errors)}`,
    );
  }

  return normalizedValidation.value;
}
