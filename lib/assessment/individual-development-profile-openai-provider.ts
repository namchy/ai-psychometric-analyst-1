import "server-only";

import { resolveAiReportLanguagePolicy } from "@/lib/assessment/ai-report-language-policy";
import {
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
  validateIndividualDevelopmentProfileSnapshot,
  type IndividualDevelopmentProfileSnapshot,
} from "@/lib/assessment/individual-development-profile-contract";
import {
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
  type IndividualDevelopmentProfileInputSnapshot,
} from "@/lib/assessment/individual-development-profile-input";

export const INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI = "openai" as const;
export const INDIVIDUAL_DEVELOPMENT_PROFILE_OPENAI_GENERATOR_VERSION =
  "individual_development_profile_openai_v1" as const;

export type IndividualDevelopmentProfileOpenAiRequest = {
  model: string;
  temperature?: number;
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

export type IndividualDevelopmentProfileOpenAiClient = {
  createChatCompletion: (
    request: IndividualDevelopmentProfileOpenAiRequest,
  ) => Promise<{ content: string }>;
};

export type IndividualDevelopmentProfileOpenAiProviderOptions = {
  apiKey: string | null;
  model: string | null;
  timeoutMs?: number;
  temperature?: number | null;
  fetchImpl?: typeof fetch;
  client?: IndividualDevelopmentProfileOpenAiClient;
  now?: () => string;
};

export type IndividualDevelopmentProfileOpenAiProviderResult =
  | {
      ok: true;
      reportSnapshot: IndividualDevelopmentProfileSnapshot;
      modelName: string;
    }
  | {
      ok: false;
      reason:
        | "invalid_input"
        | "config_error"
        | "provider_error"
        | "parse_failure"
        | "validation_failed";
      errors: string[];
      modelName: string | null;
    };

const MAX_VALIDATION_DIAGNOSTICS = 5;
const MAX_DIAGNOSTIC_VALUE_LENGTH = 500;

const nonEmptyStringSchema = {
  type: "string",
  minLength: 1,
} as const;

const narrativeArraySchema = {
  type: "array",
  minItems: 1,
  items: nonEmptyStringSchema,
} as const;

const onboardingStageSchema = {
  type: "object",
  additionalProperties: false,
  required: ["focus", "managerActions", "feedbackGuidance", "riskSignals"],
  properties: {
    focus: nonEmptyStringSchema,
    managerActions: narrativeArraySchema,
    feedbackGuidance: narrativeArraySchema,
    riskSignals: narrativeArraySchema,
  },
} as const;

export const individualDevelopmentProfileOpenAiSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "reportType",
    "reportVersion",
    "locale",
    "audience",
    "developmentSummary",
    "contributionPattern",
    "developmentRisks",
    "communicationAndFeedbackGuidance",
    "motivationAndEnergyGuidance",
    "oneOnOneGuidance",
    "onboardingPlan",
    "managerWatchpoints",
    "interpretationLimits",
    "metadata",
  ],
  properties: {
    reportType: {
      type: "string",
      const: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
    },
    reportVersion: {
      type: "string",
      const: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
    },
    locale: { type: "string", const: "bs" },
    audience: {
      type: "string",
      const: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
    },
    developmentSummary: {
      type: "object",
      additionalProperties: false,
      required: [
        "headline",
        "overallPattern",
        "strongestContributionSignals",
        "mainSupportNeed",
        "usageNote",
      ],
      properties: {
        headline: nonEmptyStringSchema,
        overallPattern: nonEmptyStringSchema,
        strongestContributionSignals: narrativeArraySchema,
        mainSupportNeed: nonEmptyStringSchema,
        usageNote: nonEmptyStringSchema,
      },
    },
    contributionPattern: {
      type: "object",
      additionalProperties: false,
      required: [
        "bestConditions",
        "collaborationConditions",
        "supportPreferences",
        "roleShapingImplications",
      ],
      properties: {
        bestConditions: narrativeArraySchema,
        collaborationConditions: narrativeArraySchema,
        supportPreferences: narrativeArraySchema,
        roleShapingImplications: narrativeArraySchema,
      },
    },
    developmentRisks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "possibleBlocker",
          "whyItMatters",
          "whatToCheck",
          "howToSupport",
        ],
        properties: {
          possibleBlocker: nonEmptyStringSchema,
          whyItMatters: nonEmptyStringSchema,
          whatToCheck: nonEmptyStringSchema,
          howToSupport: nonEmptyStringSchema,
        },
      },
    },
    communicationAndFeedbackGuidance: {
      type: "object",
      additionalProperties: false,
      required: ["whatHelps", "whatToAvoid", "howToPhraseFeedback", "whatToClarify"],
      properties: {
        whatHelps: narrativeArraySchema,
        whatToAvoid: narrativeArraySchema,
        howToPhraseFeedback: narrativeArraySchema,
        whatToClarify: narrativeArraySchema,
      },
    },
    motivationAndEnergyGuidance: {
      type: "object",
      additionalProperties: false,
      required: [
        "likelySourcesOfEnergy",
        "likelySourcesOfDrain",
        "supportSignals",
        "whatToValidate",
      ],
      properties: {
        likelySourcesOfEnergy: narrativeArraySchema,
        likelySourcesOfDrain: narrativeArraySchema,
        supportSignals: narrativeArraySchema,
        whatToValidate: narrativeArraySchema,
      },
    },
    oneOnOneGuidance: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "question",
          "whatToListenFor",
          "signalBeingChecked",
          "possibleFollowUp",
        ],
        properties: {
          question: nonEmptyStringSchema,
          whatToListenFor: nonEmptyStringSchema,
          signalBeingChecked: nonEmptyStringSchema,
          possibleFollowUp: {
            ...nonEmptyStringSchema,
            description:
              'Must be an open HR/manager question suitable for a one-on-one conversation and must end with "?". It must not be a statement, advice, imperative, title or conversation topic. Good examples: "Koji uslovi rada vam najviše pomažu da održite fokus kada zadatak traži preciznost?" and "Kako prepoznajete da vam je povratna informacija dovoljno jasna za sljedeći korak?"',
          },
        },
      },
    },
    onboardingPlan: {
      type: "object",
      additionalProperties: false,
      required: [
        "summary",
        "first7Days",
        "first30Days",
        "days31To60",
        "days61To90",
        "managerCheckpoints",
        "watchouts",
      ],
      properties: {
        summary: nonEmptyStringSchema,
        first7Days: onboardingStageSchema,
        first30Days: onboardingStageSchema,
        days31To60: onboardingStageSchema,
        days61To90: onboardingStageSchema,
        managerCheckpoints: narrativeArraySchema,
        watchouts: narrativeArraySchema,
      },
    },
    managerWatchpoints: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "watchpoint",
          "whyItMatters",
          "earlySignal",
          "suggestedManagerResponse",
        ],
        properties: {
          watchpoint: nonEmptyStringSchema,
          whyItMatters: nonEmptyStringSchema,
          earlySignal: nonEmptyStringSchema,
          suggestedManagerResponse: nonEmptyStringSchema,
        },
      },
    },
    interpretationLimits: narrativeArraySchema,
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["generatedAt", "generatorType", "generatorVersion", "inputVersion"],
      properties: {
        generatedAt: nonEmptyStringSchema,
        generatorType: {
          type: "string",
          const: INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI,
        },
        generatorVersion: {
          type: "string",
          const: INDIVIDUAL_DEVELOPMENT_PROFILE_OPENAI_GENERATOR_VERSION,
        },
        inputVersion: {
          type: "string",
          const: INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
        },
      },
    },
  },
} as const satisfies Record<string, unknown>;

function isValidInputSnapshot(
  input: IndividualDevelopmentProfileInputSnapshot,
): boolean {
  return (
    input.inputType === INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE &&
    input.inputVersion === INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION &&
    input.locale === "bs" &&
    typeof input.participant?.participantId === "string" &&
    input.participant.participantId.length > 0
  );
}

function readValueAtValidationPath(value: unknown, path: string): unknown {
  const segments = path.match(/[^.[\]]+/g);

  if (!segments) {
    return undefined;
  }

  return segments.reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (current !== null && typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, value);
}

function truncateDiagnosticValue(value: unknown): string {
  let serialized: string;

  try {
    serialized = JSON.stringify(value);
  } catch {
    serialized = String(value);
  }

  if (serialized === undefined) {
    serialized = "undefined";
  }

  return serialized.length > MAX_DIAGNOSTIC_VALUE_LENGTH
    ? `${serialized.slice(0, MAX_DIAGNOSTIC_VALUE_LENGTH - 3)}...`
    : serialized;
}

function buildDevelopmentValidationDiagnostics(
  errors: string[],
  parsed: unknown,
): string[] {
  return errors.slice(0, MAX_VALIDATION_DIAGNOSTICS).map((error) => {
    const separatorIndex = error.indexOf(":");
    const path =
      separatorIndex >= 0 ? error.slice(0, separatorIndex).trim() : error.trim();
    const message =
      separatorIndex >= 0 ? error.slice(separatorIndex + 1).trim() : error.trim();
    const offendingValue = truncateDiagnosticValue(
      readValueAtValidationPath(parsed, path),
    );

    return `${path}: ${message} Offending value: ${offendingValue}`;
  });
}

export function buildIndividualDevelopmentProfileOpenAiSystemPrompt(): string {
  const languagePolicy = resolveAiReportLanguagePolicy("bs");
  const globalPolicy =
    languagePolicy?.buildPromptPolicyBlock({
      audience: "hr",
      includeAuthorityOrder: true,
    }) ?? "";

  return [
    "Generate exactly one Individual Development Profile HR report.",
    "Return JSON only and match the supplied strict JSON schema exactly.",
    "Use only the supplied canonical IDP input. Do not query or infer hidden data.",
    globalPolicy,
    "Write in Bosnian, ijekavica, Latin script, with a professional, calm and practical HR tone.",
    "Use cautious developmental hypotheses, not diagnoses, verdicts or hiring recommendations.",
    'For AGREEABLENESS use the canonical term "Spremnost na saradnju"; never use "ugodnost".',
    'Never place these terms in user-facing text: "HR-facing", "reduced", "AI narativ", "numeric", "source", "metadata", "snapshot".',
    'Do not address the candidate with candidate-facing forms such as "ti" or "tvoj".',
    'Do not copy raw/internal source metadata, technical keys, versions, identifiers or implementation language into narrative fields.',
    'Do not rely on the word "signal" as a repeated sentence template. Vary professional HR wording with "nalaz", "razvojni obrazac", "radna hipoteza", "područje za provjeru", "preporuka", "pitanje za razgovor" and "onboarding fokus" where natural.',
    "Every section must serve its own purpose. Do not paste or lightly paraphrase the same upstream fragment across multiple sections.",
    "Development summary synthesizes the main pattern; contribution pattern explains work conditions; risks identify blockers and checks; communication and motivation sections give practical guidance; one-on-one items are questions; onboarding stages are time-specific; manager watchpoints describe observable early patterns and responses.",
    'Every oneOnOneGuidance[].possibleFollowUp value must be an open HR/manager question suitable for a one-on-one conversation and must end with "?".',
    "A possibleFollowUp must not be a statement, advice, imperative, title or conversation topic.",
    'Good possibleFollowUp examples: "Koji uslovi rada vam najviše pomažu da održite fokus kada zadatak traži preciznost?" and "Kako prepoznajete da vam je povratna informacija dovoljno jasna za sljedeći korak?"',
    "Use available source summaries and relevant/integrated findings as evidence, but translate them into natural HR language.",
    "When input is partial, unavailable or conflicting, lower certainty and state the limitation without exposing internal status or technical metadata.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildIndividualDevelopmentProfileOpenAiUserPrompt(
  inputSnapshot: IndividualDevelopmentProfileInputSnapshot,
): string {
  return JSON.stringify({
    task: "Generate one individual_development_profile_v1 HR report.",
    contentContract: {
      locale: "Bosnian, ijekavica, Latin script",
      audience: "HR and the responsible manager",
      grounding:
        "Use only user-relevant findings in the canonical IDP input and never expose raw/internal source metadata.",
      sectionDistinctness:
        "Each report section must add a distinct HR use: synthesis, work conditions, risk checks, communication, motivation, one-on-one conversation, onboarding or manager observation.",
      terminology:
        'Use "Spremnost na saradnju". Never use "ugodnost", "HR-facing", "reduced", "AI narativ", "numeric", "source", "metadata" or "snapshot" in user-facing text.',
      addressing:
        'Do not use candidate-facing second person such as "ti" or "tvoj".',
      wording:
        'Vary wording naturally and do not repeatedly formulate conclusions as "signal sugeriše".',
      oneOnOneGuidance:
        'Every possibleFollowUp must be an open HR/manager question for a one-on-one conversation, must end with "?", and must not be a statement, advice, imperative, title or conversation topic.',
    },
    input: inputSnapshot,
  });
}

export function buildIndividualDevelopmentProfileOpenAiRequest(input: {
  inputSnapshot: IndividualDevelopmentProfileInputSnapshot;
  model: string;
  temperature?: number | null;
}): IndividualDevelopmentProfileOpenAiRequest {
  const request: IndividualDevelopmentProfileOpenAiRequest = {
    model: input.model,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
        strict: true,
        schema: individualDevelopmentProfileOpenAiSchema,
      },
    },
    messages: [
      {
        role: "system",
        content: buildIndividualDevelopmentProfileOpenAiSystemPrompt(),
      },
      {
        role: "user",
        content: buildIndividualDevelopmentProfileOpenAiUserPrompt(input.inputSnapshot),
      },
    ],
  };

  if (typeof input.temperature === "number") {
    request.temperature = input.temperature;
  }

  return request;
}

function createFetchClient(
  options: IndividualDevelopmentProfileOpenAiProviderOptions & {
    apiKey: string;
    model: string;
  },
): IndividualDevelopmentProfileOpenAiClient {
  return {
    async createChatCompletion(request) {
      const timeoutMs = options.timeoutMs ?? 120000;
      const controller = new AbortController();
      const timeout = setTimeout(
        () =>
          controller.abort(
            new Error(`OpenAI IDP request timed out after ${timeoutMs}ms.`),
          ),
        timeoutMs,
      );

      try {
        const response = await (options.fetchImpl ?? fetch)(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${options.apiKey}`,
            },
            body: JSON.stringify(request),
            signal: controller.signal,
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            `OpenAI IDP request failed with status ${response.status}: ${await response.text()}`,
          );
        }

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = payload.choices?.[0]?.message?.content;

        if (typeof content !== "string" || content.trim().length === 0) {
          throw new Error("OpenAI IDP response did not contain structured content.");
        }

        return { content };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export async function generateIndividualDevelopmentProfileWithOpenAi(
  inputSnapshot: IndividualDevelopmentProfileInputSnapshot,
  options: IndividualDevelopmentProfileOpenAiProviderOptions,
): Promise<IndividualDevelopmentProfileOpenAiProviderResult> {
  if (!isValidInputSnapshot(inputSnapshot)) {
    return {
      ok: false,
      reason: "invalid_input",
      errors: ["Expected canonical Bosnian individual development profile input v1."],
      modelName: options.model,
    };
  }

  if (!options.apiKey || !options.model) {
    return {
      ok: false,
      reason: "config_error",
      errors: [
        !options.apiKey
          ? "Missing required env var: OPENAI_API_KEY"
          : "Missing required env var: AI_REPORT_MODEL",
      ],
      modelName: options.model,
    };
  }

  const generatedAt = options.now?.() ?? new Date().toISOString();
  const client =
    options.client ??
    createFetchClient({
      ...options,
      apiKey: options.apiKey,
      model: options.model,
    });

  let rawContent: string;

  try {
    const request = buildIndividualDevelopmentProfileOpenAiRequest({
      inputSnapshot,
      model: options.model,
      temperature: options.temperature,
    });

    const response = await client.createChatCompletion(request);
    rawContent = response.content;
  } catch (error) {
    return {
      ok: false,
      reason: "provider_error",
      errors: [error instanceof Error ? error.message : String(error)],
      modelName: options.model,
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    return {
      ok: false,
      reason: "parse_failure",
      errors: [
        `OpenAI IDP returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
      modelName: options.model,
    };
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    parsed = {
      ...parsed,
      metadata: {
        generatedAt,
        generatorType: INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI,
        generatorVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_OPENAI_GENERATOR_VERSION,
        inputVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
      },
    };
  }

  const validation = validateIndividualDevelopmentProfileSnapshot(parsed);

  if (!validation.ok) {
    const errors =
      process.env.NODE_ENV === "development"
        ? buildDevelopmentValidationDiagnostics(validation.errors, parsed)
        : validation.errors;

    if (process.env.NODE_ENV === "development") {
      console.error(
        [
          "[IDP OpenAI validation diagnostic]",
          ...errors.map((error, index) => `${index + 1}. ${error}`),
        ].join("\n"),
      );
    }

    return {
      ok: false,
      reason: "validation_failed",
      errors,
      modelName: options.model,
    };
  }

  return {
    ok: true,
    reportSnapshot: validation.value,
    modelName: options.model,
  };
}
