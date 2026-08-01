import "server-only";

import {
  getAiReportConfig,
  getAiReportReasoningEffortForModel,
  type AiReportReasoningEffort,
} from "@/lib/assessment/report-config";
import {
  shouldOmitOpenAiTemperature,
} from "@/lib/assessment/report-provider-openai";
import type { TeamDynamicsReportInputSnapshot } from "@/lib/b2b/team-dynamics-report-input";
import {
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE,
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SCHEMA_VERSION,
  validateTeamDynamicsExecutiveOverviewSnapshot,
  type TeamDynamicsExecutiveOverviewSnapshot,
} from "@/lib/b2b/team-dynamics-executive-overview-contract";
import {
  buildSystemPrompt,
  buildUserPrompt,
} from "@/lib/b2b/team-dynamics-executive-overview-prompt";

export const TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER = "openai" as const;
export const TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_VERSION = "v1" as const;

type TeamDynamicsExecutiveOverviewOpenAiClientRequest = {
  model: string;
  temperature?: number;
  reasoning_effort?: import("@/lib/assessment/report-config").AiReportReasoningEffort;
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
};

export type TeamDynamicsExecutiveOverviewOpenAiClient = {
  createChatCompletion: (
    request: TeamDynamicsExecutiveOverviewOpenAiClientRequest,
  ) => Promise<{ content: string }>;
};

type OpenAiProviderOptions = {
  apiKey: string | null;
  model: string | null;
  reasoningEffort?: AiReportReasoningEffort | null;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  client?: TeamDynamicsExecutiveOverviewOpenAiClient;
  now?: () => string;
};

export type GenerateTeamDynamicsExecutiveOverviewWithOpenAIResult =
  | {
      ok: true;
      code: "success";
      snapshot: TeamDynamicsExecutiveOverviewSnapshot;
      provider: typeof TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER;
      providerVersion: typeof TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_VERSION;
      modelName: string;
      generatedAt: string;
      rawContent: string;
    }
  | {
      ok: false;
      code: "config_error" | "provider_error" | "parse_failure" | "validation_failure";
      reason: string;
      provider: typeof TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER;
      providerVersion: typeof TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_VERSION;
      modelName: string | null;
      generatedAt: string;
      rawContent?: string;
      validationErrors?: string[];
    };

type ErrorWithCause = Error & {
  cause?: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

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
  return JSON.parse(content);
}

function buildExecutiveOverviewSchema(): Record<string, unknown> {
  const nonEmptyString = {
    type: "string",
    minLength: 1,
  };

  const signal = {
    type: "object",
    additionalProperties: false,
    required: ["title", "summary"],
    properties: {
      title: nonEmptyString,
      summary: nonEmptyString,
    },
  };

  return {
    type: "object",
    additionalProperties: false,
    required: [
      "reportType",
      "reportVersion",
      "locale",
      "teamContext",
      "includedMembersSummary",
      "executiveSummary",
      "keyTeamSignals",
      "dimensionOverview",
      "alignmentAndFriction",
      "psychologicalSafetySignal",
      "situationalJudgmentSignal",
      "outcomePulseSignal",
      "risksToWatch",
      "leadershipRecommendations",
      "suggestedNextConversation",
      "interpretationLimits",
    ],
    properties: {
      reportType: {
        type: "string",
        const: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE,
      },
      reportVersion: {
        type: "string",
        const: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SCHEMA_VERSION,
      },
      locale: nonEmptyString,
      teamContext: {
        type: "object",
        additionalProperties: false,
        required: [
          "organizationId",
          "teamId",
          "teamName",
          "teamAssessmentAssignmentId",
        ],
        properties: {
          organizationId: nonEmptyString,
          teamId: nonEmptyString,
          teamName: nonEmptyString,
          teamAssessmentAssignmentId: nonEmptyString,
        },
      },
      includedMembersSummary: {
        type: "object",
        additionalProperties: false,
        required: ["includedMemberCount", "completedMemberCount", "note"],
        properties: {
          includedMemberCount: {
            type: "number",
          },
          completedMemberCount: {
            type: "number",
          },
          note: nonEmptyString,
        },
      },
      executiveSummary: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "summary"],
        properties: {
          headline: nonEmptyString,
          summary: nonEmptyString,
        },
      },
      keyTeamSignals: {
        type: "array",
        minItems: 1,
        items: signal,
      },
      dimensionOverview: {
        type: "object",
        additionalProperties: false,
        required: ["dimensions"],
        properties: {
          dimensions: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["key", "label", "summary"],
              properties: {
                key: nonEmptyString,
                label: nonEmptyString,
                summary: nonEmptyString,
              },
            },
          },
        },
      },
      alignmentAndFriction: {
        type: "object",
        additionalProperties: false,
        required: ["alignmentSignals", "frictionSignals"],
        properties: {
          alignmentSignals: {
            type: "array",
            minItems: 1,
            items: nonEmptyString,
          },
          frictionSignals: {
            type: "array",
            minItems: 1,
            items: nonEmptyString,
          },
        },
      },
      psychologicalSafetySignal: signal,
      situationalJudgmentSignal: signal,
      outcomePulseSignal: signal,
      risksToWatch: {
        type: "array",
        minItems: 1,
        items: nonEmptyString,
      },
      leadershipRecommendations: {
        type: "array",
        minItems: 1,
        items: nonEmptyString,
      },
      suggestedNextConversation: {
        type: "object",
        additionalProperties: false,
        required: ["title", "prompts"],
        properties: {
          title: nonEmptyString,
          prompts: {
            type: "array",
            minItems: 1,
            items: nonEmptyString,
          },
        },
      },
      interpretationLimits: {
        type: "array",
        minItems: 1,
        items: nonEmptyString,
      },
    },
  };
}

function createFetchOpenAiClient(
  options: Required<Pick<OpenAiProviderOptions, "apiKey" | "model">> &
    Pick<OpenAiProviderOptions, "timeoutMs" | "fetchImpl">,
): TeamDynamicsExecutiveOverviewOpenAiClient {
  return {
    async createChatCompletion(request) {
      const timeoutMs = options.timeoutMs ?? 120000;
      const fetchImpl = options.fetchImpl ?? fetch;
      const controller = new AbortController();
      const timeout = setTimeout(
        () =>
          controller.abort(
            new Error(
              `OpenAI Team Dynamics Executive Overview timed out after ${timeoutMs}ms.`,
            ),
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
          body: JSON.stringify(request),
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `OpenAI Team Dynamics Executive Overview request failed with status ${response.status}: ${errorText}`,
          );
        }

        const payload = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
            };
          }>;
        };

        const content = payload.choices?.[0]?.message?.content;

        if (!isNonEmptyString(content)) {
          throw new Error(
            "OpenAI Team Dynamics Executive Overview response did not contain structured content.",
          );
        }

        return { content };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export async function generateTeamDynamicsExecutiveOverviewWithOpenAI(
  inputSnapshot: TeamDynamicsReportInputSnapshot,
  options: OpenAiProviderOptions,
): Promise<GenerateTeamDynamicsExecutiveOverviewWithOpenAIResult> {
  const generatedAt = options.now?.() ?? new Date().toISOString();

  if (!options.apiKey) {
    return {
      ok: false,
      code: "config_error",
      reason: "Missing required env var: OPENAI_API_KEY",
      provider: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER,
      providerVersion: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_VERSION,
      modelName: options.model ?? null,
      generatedAt,
    };
  }

  if (!options.model) {
    return {
      ok: false,
      code: "config_error",
      reason: "Missing required env var: AI_REPORT_MODEL",
      provider: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER,
      providerVersion: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_VERSION,
      modelName: null,
      generatedAt,
    };
  }

  const client =
    options.client ??
    createFetchOpenAiClient({
      apiKey: options.apiKey,
      model: options.model,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });

  let rawContent: string;

  try {
    const request: TeamDynamicsExecutiveOverviewOpenAiClientRequest = {
      model: options.model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: buildOpenAiSchemaName(TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE),
          strict: true,
          schema: buildExecutiveOverviewSchema(),
        },
      },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: buildUserPrompt(inputSnapshot),
        },
      ],
    };

    if (!shouldOmitOpenAiTemperature(options.model)) {
      request.temperature = 0.2;
    }

    const reasoningEffort = getAiReportReasoningEffortForModel(
      options.model,
      options.reasoningEffort ?? getAiReportConfig().reasoningEffort,
    );

    if (reasoningEffort) {
      request.reasoning_effort = reasoningEffort;
    }

    const response = await client.createChatCompletion(request);

    rawContent = response.content;
  } catch (error) {
    const normalizedError = error instanceof Error ? (error as ErrorWithCause) : null;

    return {
      ok: false,
      code: "provider_error",
      reason:
        normalizedError?.message ??
        `OpenAI Team Dynamics Executive Overview failed: ${String(error)}`,
      provider: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER,
      providerVersion: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_VERSION,
      modelName: options.model,
      generatedAt,
    };
  }

  let parsed: unknown;

  try {
    parsed = parseStructuredContent(rawContent);
  } catch (error) {
    return {
      ok: false,
      code: "parse_failure",
      reason:
        error instanceof Error
          ? `OpenAI Team Dynamics Executive Overview returned invalid JSON: ${error.message}`
          : `OpenAI Team Dynamics Executive Overview returned invalid JSON: ${String(error)}`,
      provider: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER,
      providerVersion: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_VERSION,
      modelName: options.model,
      generatedAt,
      rawContent,
    };
  }

  const validation = validateTeamDynamicsExecutiveOverviewSnapshot(parsed);

  if (!validation.ok) {
    return {
      ok: false,
      code: "validation_failure",
      reason: "OpenAI Team Dynamics Executive Overview failed runtime validation.",
      provider: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER,
      providerVersion: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_VERSION,
      modelName: options.model,
      generatedAt,
      rawContent,
      validationErrors: validation.errors,
    };
  }

  return {
    ok: true,
    code: "success",
    snapshot: validation.value,
    provider: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER,
    providerVersion: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER_VERSION,
    modelName: options.model,
    generatedAt,
    rawContent,
  };
}
