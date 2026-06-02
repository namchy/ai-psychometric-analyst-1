import "server-only";

import {
  TEAM_FIT_RELATIONSHIP_PATTERNS,
  TEAM_FIT_REPORT_TYPE,
  TEAM_FIT_REPORT_VERSION,
  validateTeamFitReportSnapshot,
  type TeamFitReportV1,
} from "@/lib/b2b/team-fit-report-contract";
import type { TeamFitReportInputSnapshot } from "@/lib/b2b/team-fit-report-input";
import type {
  TeamFitReportProvider,
  TeamFitReportProviderFailureReason,
  TeamFitReportProviderResult,
} from "@/lib/b2b/team-fit-report-provider";

export const TEAM_FIT_OPENAI_PROVIDER = "openai" as const;
export const TEAM_FIT_OPENAI_PROVIDER_VERSION = "v1" as const;

type TeamFitOpenAiClientRequest = {
  model: string;
  temperature: number;
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

export type TeamFitOpenAiClient = {
  createChatCompletion: (
    request: TeamFitOpenAiClientRequest,
  ) => Promise<{ content: string }>;
};

export type TeamFitOpenAiProviderOptions = {
  apiKey: string | null;
  model: string | null;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  client?: TeamFitOpenAiClient;
  now?: () => string;
};

export type GenerateTeamFitReportWithOpenAIResult =
  | {
      ok: true;
      code: "success";
      snapshot: TeamFitReportV1;
      provider: typeof TEAM_FIT_OPENAI_PROVIDER;
      providerVersion: typeof TEAM_FIT_OPENAI_PROVIDER_VERSION;
      modelName: string;
      generatedAt: string;
      rawContent: string;
    }
  | {
      ok: false;
      code: "config_error" | "provider_error" | "parse_failure" | "validation_failure";
      reason: string;
      provider: typeof TEAM_FIT_OPENAI_PROVIDER;
      providerVersion: typeof TEAM_FIT_OPENAI_PROVIDER_VERSION;
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function buildSchemaName(schemaName: string): string {
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

function buildTeamFitSchema(): Record<string, unknown> {
  const nonEmptyString = {
    type: "string",
    minLength: 1,
  };
  const nullableString = {
    anyOf: [nonEmptyString, { type: "null" }],
  };
  const stringArray = {
    type: "array",
    items: nonEmptyString,
  };
  const patternSummary = {
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
      "generatedAt",
      "inputSnapshotVersion",
      "teamFitReportVersion",
      "audience",
      "sourceType",
      "teamContext",
      "candidateContext",
      "source",
      "fitOverview",
      "teamContextSummary",
      "candidateSignals",
      "complementaritySignals",
      "frictionRisks",
      "interviewFocus",
      "onboardingGuidance",
      "managerGuidance",
      "watchouts",
      "interpretationLimits",
      "metadata",
    ],
    properties: {
      reportType: { type: "string", const: TEAM_FIT_REPORT_TYPE },
      reportVersion: { type: "string", const: TEAM_FIT_REPORT_VERSION },
      locale: nonEmptyString,
      generatedAt: nonEmptyString,
      inputSnapshotVersion: nonEmptyString,
      teamFitReportVersion: { type: "string", const: TEAM_FIT_REPORT_VERSION },
      audience: { type: "string", const: "hr_internal" },
      sourceType: { type: "string", const: "candidate_team_relational" },
      teamContext: {
        type: "object",
        additionalProperties: false,
        required: ["organizationId", "teamId", "teamName", "teamAssessmentAssignmentId", "teamDynamicsAggregationSnapshotId", "teamDynamicsReportId"],
        properties: {
          organizationId: nonEmptyString,
          teamId: nonEmptyString,
          teamName: nullableString,
          teamAssessmentAssignmentId: nullableString,
          teamDynamicsAggregationSnapshotId: nullableString,
          teamDynamicsReportId: nullableString,
        },
      },
      candidateContext: {
        type: "object",
        additionalProperties: false,
        required: ["organizationId", "participantId", "assessmentAssignmentId", "compositeInputSnapshotId", "compositeReportId", "displayName"],
        properties: {
          organizationId: nonEmptyString,
          participantId: nonEmptyString,
          assessmentAssignmentId: nullableString,
          compositeInputSnapshotId: nullableString,
          compositeReportId: nullableString,
          displayName: nullableString,
        },
      },
      source: {
        type: "object",
        additionalProperties: false,
        required: [
          "candidateCompositeInputVersion",
          "candidateSourceReportIds",
          "candidateSourceTestSlugs",
          "teamInputVersion",
          "teamSourceReportIds",
          "teamSourceSnapshotIds",
          "optionalContextKeys",
        ],
        properties: {
          candidateCompositeInputVersion: nonEmptyString,
          candidateSourceReportIds: stringArray,
          candidateSourceTestSlugs: stringArray,
          teamInputVersion: nonEmptyString,
          teamSourceReportIds: stringArray,
          teamSourceSnapshotIds: stringArray,
          optionalContextKeys: stringArray,
        },
      },
      fitOverview: {
        type: "object",
        additionalProperties: false,
        required: ["relationshipPattern", "headline", "summary"],
        properties: {
          relationshipPattern: {
            type: "string",
            enum: [...TEAM_FIT_RELATIONSHIP_PATTERNS],
          },
          headline: nonEmptyString,
          summary: nonEmptyString,
        },
      },
      teamContextSummary: {
        type: "object",
        additionalProperties: false,
        required: ["relevantTeamPatterns"],
        properties: {
          relevantTeamPatterns: {
            type: "array",
            minItems: 1,
            items: patternSummary,
          },
        },
      },
      candidateSignals: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "summary", "relevanceToFit"],
          properties: {
            title: nonEmptyString,
            summary: nonEmptyString,
            relevanceToFit: nonEmptyString,
          },
        },
      },
      complementaritySignals: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "summary", "practicalValue"],
          properties: {
            title: nonEmptyString,
            summary: nonEmptyString,
            practicalValue: nonEmptyString,
          },
        },
      },
      frictionRisks: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "summary", "whyItMayMatter", "mitigationFocus"],
          properties: {
            title: nonEmptyString,
            summary: nonEmptyString,
            whyItMayMatter: nonEmptyString,
            mitigationFocus: nonEmptyString,
          },
        },
      },
      interviewFocus: {
        type: "object",
        additionalProperties: false,
        required: ["areas"],
        properties: {
          areas: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "rationale", "prompts"],
              properties: {
                title: nonEmptyString,
                rationale: nonEmptyString,
                prompts: {
                  type: "array",
                  minItems: 1,
                  items: nonEmptyString,
                },
              },
            },
          },
        },
      },
      onboardingGuidance: {
        type: "object",
        additionalProperties: false,
        required: ["priorities", "supportNeeds"],
        properties: {
          priorities: {
            type: "array",
            minItems: 1,
            items: nonEmptyString,
          },
          supportNeeds: {
            type: "array",
            minItems: 1,
            items: nonEmptyString,
          },
        },
      },
      managerGuidance: {
        type: "object",
        additionalProperties: false,
        required: ["workingStyleGuidance", "communicationGuidance"],
        properties: {
          workingStyleGuidance: {
            type: "array",
            minItems: 1,
            items: nonEmptyString,
          },
          communicationGuidance: {
            type: "array",
            minItems: 1,
            items: nonEmptyString,
          },
        },
      },
      watchouts: {
        type: "array",
        minItems: 1,
        items: nonEmptyString,
      },
      interpretationLimits: {
        type: "array",
        minItems: 1,
        items: nonEmptyString,
      },
      metadata: {
        type: "object",
        additionalProperties: false,
        required: ["provider", "providerVersion", "generatedAt"],
        properties: {
          provider: nonEmptyString,
          providerVersion: nonEmptyString,
          generatedAt: nonEmptyString,
        },
      },
    },
  };
}

function buildSystemPrompt(): string {
  return [
    "You generate exactly one Team Fit HR-internal report snapshot.",
    "Return JSON only.",
    "Output must match the supplied JSON schema exactly.",
    "Use only the canonical Team Fit input_snapshot provided by the caller.",
    "Do not output any numeric fit score, fit percentage, rank or score band.",
    "Do not use hiring, selection, hire/no-hire or accept/reject language.",
    "Do not produce candidate-facing advice, candidate-facing conclusions or self-reflection content for the candidate.",
    "Do not quote, reconstruct or disclose raw test items, raw answers, raw responses or response-level evidence.",
    "Do not output individual team member answers, individual team member scores, rankings or person-level diagnostics.",
    "Do not diagnose, label or pathologize the candidate or the team.",
    "Frame findings as cautious relational hypotheses for HR, interview and onboarding use.",
    "Tone: HR-facing, Bosnian, Latin script, ijekavica, cautious, developmental, non-diagnostic.",
    "Include interview guidance, onboarding guidance, manager guidance and interpretation limits.",
  ].join(" ");
}

function buildUserPrompt(inputSnapshot: TeamFitReportInputSnapshot): string {
  return JSON.stringify({
    instructions: {
      output_contract:
        "Return one Team Fit report snapshot in contract team_fit_report_v1.",
      source_rule:
        "Use only the provided input_snapshot. Do not read a database, do not infer hidden data and do not expose raw assessment content.",
      scope_rule:
        "This is HR-internal, relational and team-contextual. It is not a hiring verdict and not a candidate-facing report.",
      tone_rule:
        "Write in bosanski, latinica, ijekavica. Keep the tone cautious, developmental, relational and practical.",
      structure_rules: [
        "Return valid JSON only.",
        `Keep reportType exactly ${TEAM_FIT_REPORT_TYPE}.`,
        `Keep reportVersion exactly ${TEAM_FIT_REPORT_VERSION}.`,
        "Keep audience exactly hr_internal.",
        "Keep sourceType exactly candidate_team_relational.",
        "Use arrays with at least one item for candidateSignals, complementaritySignals, frictionRisks, interviewFocus.areas, onboardingGuidance.priorities, onboardingGuidance.supportNeeds, managerGuidance.workingStyleGuidance, managerGuidance.communicationGuidance, watchouts and interpretationLimits.",
      ],
      hard_guardrails: [
        "No numeric fit score.",
        "No hire/no-hire language.",
        "No candidate-facing output.",
        "No raw test item disclosure.",
        "No raw answer disclosure.",
        "No individual team member answers.",
        "No individual team member scores.",
        "No diagnosis or psychological labeling.",
      ],
    },
    input_snapshot: inputSnapshot,
  });
}

function createFetchOpenAiClient(
  options: Required<Pick<TeamFitOpenAiProviderOptions, "apiKey" | "model">> &
    Pick<TeamFitOpenAiProviderOptions, "timeoutMs" | "fetchImpl">,
): TeamFitOpenAiClient {
  return {
    async createChatCompletion(request) {
      const timeoutMs = options.timeoutMs ?? 120000;
      const fetchImpl = options.fetchImpl ?? fetch;
      const controller = new AbortController();
      const timeout = setTimeout(
        () =>
          controller.abort(
            new Error(`OpenAI Team Fit request timed out after ${timeoutMs}ms.`),
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
            `OpenAI Team Fit request failed with status ${response.status}: ${errorText}`,
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
          throw new Error("OpenAI Team Fit response did not contain structured content.");
        }

        return { content };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function withProviderMetadata(snapshot: unknown): unknown {
  if (!isPlainRecord(snapshot) || !isPlainRecord(snapshot.metadata)) {
    return snapshot;
  }

  return {
    ...snapshot,
    metadata: {
      ...snapshot.metadata,
      provider: TEAM_FIT_OPENAI_PROVIDER,
      providerVersion: TEAM_FIT_OPENAI_PROVIDER_VERSION,
    },
  };
}

export async function generateTeamFitReportWithOpenAI(
  inputSnapshot: TeamFitReportInputSnapshot,
  options: TeamFitOpenAiProviderOptions,
): Promise<GenerateTeamFitReportWithOpenAIResult> {
  const generatedAt = options.now?.() ?? new Date().toISOString();

  if (!options.apiKey) {
    return {
      ok: false,
      code: "config_error",
      reason: "Missing required env var: OPENAI_API_KEY",
      provider: TEAM_FIT_OPENAI_PROVIDER,
      providerVersion: TEAM_FIT_OPENAI_PROVIDER_VERSION,
      modelName: options.model ?? null,
      generatedAt,
    };
  }

  if (!options.model) {
    return {
      ok: false,
      code: "config_error",
      reason: "Missing required env var: AI_REPORT_MODEL",
      provider: TEAM_FIT_OPENAI_PROVIDER,
      providerVersion: TEAM_FIT_OPENAI_PROVIDER_VERSION,
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
    const response = await client.createChatCompletion({
      model: options.model,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: buildSchemaName(TEAM_FIT_REPORT_TYPE),
          strict: true,
          schema: buildTeamFitSchema(),
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
    });

    rawContent = response.content;
  } catch (error) {
    const normalizedError = error instanceof Error ? (error as ErrorWithCause) : null;

    return {
      ok: false,
      code: "provider_error",
      reason: normalizedError?.message ?? `OpenAI Team Fit request failed: ${String(error)}`,
      provider: TEAM_FIT_OPENAI_PROVIDER,
      providerVersion: TEAM_FIT_OPENAI_PROVIDER_VERSION,
      modelName: options.model,
      generatedAt,
    };
  }

  let parsed: unknown;

  try {
    parsed = withProviderMetadata(parseStructuredContent(rawContent));
  } catch (error) {
    return {
      ok: false,
      code: "parse_failure",
      reason:
        error instanceof Error
          ? `OpenAI Team Fit returned invalid JSON: ${error.message}`
          : `OpenAI Team Fit returned invalid JSON: ${String(error)}`,
      provider: TEAM_FIT_OPENAI_PROVIDER,
      providerVersion: TEAM_FIT_OPENAI_PROVIDER_VERSION,
      modelName: options.model,
      generatedAt,
      rawContent,
    };
  }

  const validation = validateTeamFitReportSnapshot(parsed);

  if (!validation.ok) {
    return {
      ok: false,
      code: "validation_failure",
      reason: "OpenAI Team Fit output failed runtime validation.",
      provider: TEAM_FIT_OPENAI_PROVIDER,
      providerVersion: TEAM_FIT_OPENAI_PROVIDER_VERSION,
      modelName: options.model,
      generatedAt,
      rawContent,
      validationErrors: validation.errors,
    };
  }

  return {
    ok: true,
    code: "success",
    snapshot: validation.snapshot,
    provider: TEAM_FIT_OPENAI_PROVIDER,
    providerVersion: TEAM_FIT_OPENAI_PROVIDER_VERSION,
    modelName: options.model,
    generatedAt,
    rawContent,
  };
}

function mapOpenAiFailureReason(
  code: Exclude<GenerateTeamFitReportWithOpenAIResult["code"], "success">,
): TeamFitReportProviderFailureReason {
  switch (code) {
    case "config_error":
      return "provider_config_error";
    case "provider_error":
      return "provider_request_failed";
    case "parse_failure":
      return "provider_parse_failure";
    case "validation_failure":
    default:
      return "provider_validation_failure";
  }
}

export function createTeamFitOpenAiProvider(
  options: TeamFitOpenAiProviderOptions,
): TeamFitReportProvider {
  return {
    async generate(inputSnapshot: TeamFitReportInputSnapshot): Promise<TeamFitReportProviderResult> {
      const result = await generateTeamFitReportWithOpenAI(inputSnapshot, options);

      if (!result.ok) {
        return {
          ok: false,
          reason: mapOpenAiFailureReason(result.code),
          message: result.reason,
          retryable: result.code === "provider_error",
        };
      }

      return {
        ok: true,
        snapshot: result.snapshot,
        providerMetadata: {
          provider: result.provider,
          providerVersion: result.providerVersion,
          model: result.modelName,
        },
      };
    },
  };
}
