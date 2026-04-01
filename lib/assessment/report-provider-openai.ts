import "server-only";

import type { ActivePromptVersion } from "@/lib/assessment/prompt-version";
import type {
  PreparedReportGenerationInput,
  ReportProvider,
  RuntimeCompletedAssessmentReport,
} from "@/lib/assessment/report-providers";
import { validateRuntimeCompletedAssessmentReport } from "@/lib/assessment/report-providers";

type OpenAiProviderOptions = {
  apiKey: string | null;
  model: string | null;
  timeoutMs?: number;
};

type ErrorWithCause = Error & {
  cause?: unknown;
};

function buildDefaultSystemPrompt(input: PreparedReportGenerationInput): string {
  const baseLines = [
    `You generate completed assessment reports. Prompt version: ${input.promptVersion}.`,
    "Return only JSON that matches the supplied JSON schema exactly.",
    "Use only the provided deterministic scoring input.",
    "Do not infer raw scores, hidden traits, diagnoses, or hiring decisions.",
    "Do not use clinical language, protected-trait inferences, IQ claims, or absolute statements.",
  ];

  if (input.reportContract.family === "big_five") {
    baseLines.push(
      "Treat Emotional Stability and Intellect as non-clinical Big Five dimensions only.",
    );
  }

  return baseLines.join(" ");
}

function buildDimensionHintText(input: PreparedReportGenerationInput): string {
  if (!("dimension_scores" in input.promptInput)) {
    return [
      `dominance=${input.promptInput.derived.dominance}`,
      `warmth=${input.promptInput.derived.warmth}`,
      `primary_disc=${input.promptInput.derived.primaryDisc}`,
      `dominant_octant=${input.promptInput.derived.dominantOctant}`,
      `secondary_octant=${input.promptInput.derived.secondaryOctant}`,
      `raw_octants=${JSON.stringify(input.promptInput.rawOctants)}`,
    ].join(" | ");
  }

  return input.promptInput.dimension_scores
    .map(
      (dimension) =>
        `${dimension.dimension_code} (${dimension.dimension_label}): raw_score=${dimension.raw_score}, average_score=${dimension.average_score}, score_band=${dimension.score_band}, scored_question_count=${dimension.scored_question_count}`,
    )
    .join(" | ");
}

function buildDefaultUserPrompt(input: PreparedReportGenerationInput): string {
  if (!("dimension_scores" in input.promptInput)) {
    return JSON.stringify({
      instructions: {
        output_contract: "Return one IPC report in the exact schema.",
        audience_behavior:
          input.promptInput.audience === "participant"
            ? "Use developmental, clear, supportive language focused on interpersonal style, collaboration, communication, and growth without heavy HR wording."
            : "Use neutral, operational, professional language focused on communication style, collaboration, leadership and influence, team watchouts, and onboarding or management recommendations without hiring judgments or clinical language.",
        locale_rule:
          "Write all narrative text in the locale requested in input.locale. Do not hardcode a different language.",
        list_sizes:
          input.promptInput.audience === "participant"
            ? {
                strengths_in_collaboration: 3,
                watchouts: 2,
                development_recommendations: 3,
              }
            : {
                team_watchouts: 2,
                onboarding_or_management_recommendations: 3,
              },
        style_snapshot_rule:
          "Use the provided IPC raw octants and derived block. Do not invent different octants, DISC values, dominance values, or warmth values.",
        guardrails: [
          "Do not diagnose or use clinical language.",
          "Do not give hire/no-hire recommendations.",
          "Do not infer protected traits.",
          "Do not treat the report as final truth about the person.",
          "Do not use absolute statements such as always, never, or definitely proves.",
        ],
        ipc_hint_text: buildDimensionHintText(input),
      },
      input: input.promptInput,
    });
  }

  return JSON.stringify({
    instructions: {
      output_contract: "Return one completed assessment report in the exact schema.",
      audience_behavior:
        input.promptInput.audience === "participant"
          ? "Use developmental, clear, supportive, non-judgmental wording."
          : "Use neutral, operational, professional wording without therapeutic or hiring-prescriptive language.",
      locale_rule:
        "Write all narrative text in the locale requested in input.locale. Do not hardcode a different language.",
      dimension_order: input.promptInput.dimension_scores.map((dimension) => dimension.dimension_code),
      list_sizes: {
        strengths: 3,
        blind_spots: 3,
        development_recommendations: 3,
        dimension_insights: 5,
      },
      guardrails: [
        "Do not diagnose or use clinical language.",
        "Do not give hire/no-hire recommendations.",
        "Do not infer protected traits.",
        "Do not treat the report as final truth about the person.",
        "Do not claim IQ from INTELLECT.",
        "Do not claim clinical meaning from EMOTIONAL_STABILITY.",
        "Do not use absolute statements such as always, never, or definitely proves.",
      ],
      dimension_hint_text: buildDimensionHintText(input),
    },
    input: input.promptInput,
  });
}

function buildSystemPrompt(input: PreparedReportGenerationInput): string {
  return input.promptTemplate?.systemPrompt ?? buildDefaultSystemPrompt(input);
}

function applyPromptTemplate(
  template: string,
  input: PreparedReportGenerationInput,
  promptTemplate: ActivePromptVersion,
): string {
  const replacements = new Map<string, string>([
    ["{{prompt_version}}", promptTemplate.version],
    ["{{prompt_version_id}}", promptTemplate.id],
    ["{{dimension_hint_text}}", buildDimensionHintText(input)],
    ["{{prompt_input_json}}", JSON.stringify(input.promptInput)],
  ]);

  let rendered = template;

  for (const [token, value] of replacements) {
    rendered = rendered.split(token).join(value);
  }

  return rendered;
}

function buildUserPrompt(input: PreparedReportGenerationInput): string {
  if (!input.promptTemplate) {
    return buildDefaultUserPrompt(input);
  }

  return applyPromptTemplate(input.promptTemplate.userPromptTemplate, input, input.promptTemplate);
}

function parseStructuredContent(content: string): unknown {
  return JSON.parse(content) as unknown;
}

function resolveOpenAiResponseFormatSchemaForInput(
  input: PreparedReportGenerationInput,
): Record<string, unknown> {
  return input.reportContract.outputSchemaJson;
}

function validateStructuredReport(
  report: unknown,
  input: PreparedReportGenerationInput,
): RuntimeCompletedAssessmentReport {
  const validationResult = validateRuntimeCompletedAssessmentReport(report, {
    testSlug: input.testSlug,
    audience: input.promptInput.audience,
  });

  if (!validationResult.ok) {
    const validationPrefix =
      input.reportContract.family === "ipc"
        ? "OpenAI response JSON failed IPC report validation"
        : "OpenAI response JSON failed detailed report validation";
    throw new Error(`${validationPrefix}: ${validationResult.reason}`);
  }

  return validationResult.value;
}

async function requestOpenAiReport(
  input: PreparedReportGenerationInput,
  options: OpenAiProviderOptions,
): Promise<RuntimeCompletedAssessmentReport> {
  if (!options.apiKey) {
    throw new Error("Missing required env var: OPENAI_API_KEY");
  }

  if (!options.model) {
    throw new Error("Missing required env var: AI_REPORT_MODEL");
  }

  const timeoutMs = options.timeoutMs ?? 120000;
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new Error(`OpenAI report generation timed out after ${timeoutMs}ms.`),
      ),
    timeoutMs,
  );

  console.info("OpenAI report generation started", {
    attemptId: input.attemptId,
    testSlug: input.testSlug,
    model: options.model,
    promptVersion: input.promptVersion,
    timeoutMs,
  });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
            name: input.reportContract.schemaName,
            strict: true,
            schema: resolveOpenAiResponseFormatSchemaForInput(input),
          },
        },
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(input),
          },
          {
            role: "user",
            content: buildUserPrompt(input),
          },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed with status ${response.status}: ${errorText}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      throw new Error("OpenAI response did not contain structured content.");
    }

    const parsed = parseStructuredContent(content);
    const validated = validateStructuredReport(parsed, input);

    console.info("OpenAI report generation succeeded", {
      attemptId: input.attemptId,
      testSlug: input.testSlug,
      model: options.model,
      timeoutMs,
      reportFamily: input.reportContract.family,
    });

    return validated;
  } catch (error) {
    const normalizedError = error instanceof Error ? (error as ErrorWithCause) : null;

    console.error("OpenAI report generation failed", {
      attemptId: input.attemptId,
      testSlug: input.testSlug,
      model: options.model,
      timeoutMs,
      signalAborted: controller.signal.aborted,
      errorName: normalizedError?.name ?? typeof error,
      errorMessage: normalizedError?.message ?? String(error),
      errorStack: normalizedError?.stack ?? null,
      errorCause: normalizedError?.cause ?? null,
    });

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createOpenAiReportProvider(options: OpenAiProviderOptions): ReportProvider {
  return {
    type: "openai",
    async generateReport(input) {
      try {
        const report = await requestOpenAiReport(input, options);
        return {
          ok: true,
          report,
        };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : "Unknown OpenAI provider error.",
        };
      }
    },
  };
}
