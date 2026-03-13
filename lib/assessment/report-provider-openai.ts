import "server-only";

import { formatDimensionLabel } from "@/lib/assessment/report-provider-helpers";
import type {
  CompletedAssessmentReport,
  CompletedAssessmentReportDimension,
  PreparedReportGenerationInput,
  ReportProvider,
} from "@/lib/assessment/report-providers";

type OpenAiProviderOptions = {
  apiKey: string | null;
  model: string | null;
  timeoutMs?: number;
};

type OpenAiStructuredReport = {
  summary: string;
  dimensions: CompletedAssessmentReportDimension[];
  strengths: string[];
  blind_spots: string[];
  work_style: string[];
  development_recommendations: string[];
  disclaimer: string;
};

type ErrorWithCause = Error & {
  cause?: unknown;
};

const OPENAI_REPORT_SCHEMA = {
  name: "assessment_report_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      dimensions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            dimension_key: { type: "string" },
            score: { type: "number" },
            short_interpretation: { type: "string" },
          },
          required: ["dimension_key", "score", "short_interpretation"],
        },
      },
      strengths: { type: "array", items: { type: "string" } },
      blind_spots: { type: "array", items: { type: "string" } },
      work_style: { type: "array", items: { type: "string" } },
      development_recommendations: { type: "array", items: { type: "string" } },
      disclaimer: { type: "string" },
    },
    required: [
      "summary",
      "dimensions",
      "strengths",
      "blind_spots",
      "work_style",
      "development_recommendations",
      "disclaimer",
    ],
  },
} as const;

function isStructuredReport(value: unknown): value is OpenAiStructuredReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Record<string, unknown>;

  return (
    typeof report.summary === "string" &&
    Array.isArray(report.dimensions) &&
    report.dimensions.every((dimension) => {
      if (!dimension || typeof dimension !== "object") {
        return false;
      }

      const item = dimension as Record<string, unknown>;
      return (
        typeof item.dimension_key === "string" &&
        typeof item.score === "number" &&
        typeof item.short_interpretation === "string"
      );
    }) &&
    Array.isArray(report.strengths) &&
    report.strengths.every((item) => typeof item === "string") &&
    Array.isArray(report.blind_spots) &&
    report.blind_spots.every((item) => typeof item === "string") &&
    Array.isArray(report.work_style) &&
    report.work_style.every((item) => typeof item === "string") &&
    Array.isArray(report.development_recommendations) &&
    report.development_recommendations.every((item) => typeof item === "string") &&
    typeof report.disclaimer === "string"
  );
}

function buildSystemPrompt(promptVersion: string): string {
  return [
    `You generate structured Big Five style assessment reports. Prompt version: ${promptVersion}.`,
    "Use only the supplied deterministic scoring context.",
    "Do not infer or calculate scores from raw answers.",
    "Do not change the provided dimension keys or score values; they must be echoed exactly.",
    "Describe tendencies and likely patterns, not fixed traits or certainty.",
    "Do not provide diagnosis, clinical claims, protected-class inference, or treatment guidance.",
    "Do not provide hire/no-hire recommendations or selection decisions.",
    "Keep the tone developmental, reflective, and business-usable.",
    "Return only JSON matching the provided schema.",
  ].join(" ");
}

function buildUserPrompt(input: PreparedReportGenerationInput): string {
  const { promptInput } = input;
  const dimensionHints = promptInput.dimension_scores
    .map(
      (dimension) =>
        `${formatDimensionLabel(dimension.dimension_key)}: raw score ${dimension.raw_score} across ${dimension.scored_question_count} scored questions.`,
    )
    .join(" ");

  return JSON.stringify({
    instructions: {
      report_goal:
        "Write a concise, structured assessment narrative grounded in the provided deterministic scores.",
      guardrails: [
        "Scores are already computed and are the only quantitative source of truth.",
        "Do not speculate from raw answers or missing data.",
        "Do not overstate certainty.",
        "Use developmental language and avoid diagnosis or hiring judgments.",
      ],
      dimension_hint_text: dimensionHints,
    },
    input: promptInput,
  });
}

function normalizeStructuredReport(
  input: PreparedReportGenerationInput,
  report: OpenAiStructuredReport,
): CompletedAssessmentReport {
  const interpretationsByDimension = new Map(
    report.dimensions.map((dimension) => [dimension.dimension_key, dimension.short_interpretation]),
  );

  return {
    attempt_id: input.attemptId,
    test_slug: input.testSlug,
    generated_at: new Date().toISOString(),
    generator_type: "openai",
    summary: report.summary,
    dimensions: input.promptInput.dimension_scores.map((dimension) => ({
      dimension_key: dimension.dimension_key,
      score: dimension.raw_score,
      short_interpretation:
        interpretationsByDimension.get(dimension.dimension_key) ??
        `Score pattern for ${formatDimensionLabel(dimension.dimension_key).toLowerCase()} suggests a meaningful behavioral tendency in this attempt.`,
    })),
    strengths: report.strengths,
    blind_spots: report.blind_spots,
    work_style: report.work_style,
    development_recommendations: report.development_recommendations,
    disclaimer: report.disclaimer,
  };
}

async function requestOpenAiReport(
  input: PreparedReportGenerationInput,
  options: OpenAiProviderOptions,
): Promise<CompletedAssessmentReport> {
  if (!options.apiKey) {
    throw new Error("Missing required env var: OPENAI_API_KEY");
  }

  if (!options.model) {
    throw new Error("Missing required env var: AI_REPORT_MODEL");
  }

  const timeoutMs = options.timeoutMs ?? 120000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`OpenAI report generation timed out after ${timeoutMs}ms.`)), timeoutMs);

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
          json_schema: OPENAI_REPORT_SCHEMA,
        },
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(input.promptVersion),
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

    const parsed = JSON.parse(content) as unknown;

    if (!isStructuredReport(parsed)) {
      throw new Error("OpenAI response JSON did not match the expected report contract.");
    }

    const report = normalizeStructuredReport(input, parsed);

    console.info("OpenAI report generation succeeded", {
      attemptId: input.attemptId,
      testSlug: input.testSlug,
      model: options.model,
      timeoutMs,
      dimensionCount: report.dimensions.length,
    });

    return report;
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
