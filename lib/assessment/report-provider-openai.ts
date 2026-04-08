import "server-only";

import type { ActivePromptVersion } from "@/lib/assessment/prompt-version";
import {
  formatIpipNeo120ReportValidationErrors,
  validateIpipNeo120HrReportV1,
  validateIpipNeo120ParticipantReportV1,
} from "@/lib/assessment/ipip-neo-120-report-v1";
import type {
  PreparedReportGenerationInput,
  ReportProvider,
  ReportPromptInput,
  RuntimeCompletedAssessmentReport,
} from "@/lib/assessment/report-providers";
import {
  validateRuntimeCompletedAssessmentReport,
} from "@/lib/assessment/report-providers";

type OpenAiProviderOptions = {
  apiKey: string | null;
  model: string | null;
  timeoutMs?: number;
};

type ErrorWithCause = Error & {
  cause?: unknown;
};

function isIpipNeo120ParticipantPromptInput(
  promptInput: ReportPromptInput,
): promptInput is Extract<ReportPromptInput, { audience: "participant"; domains: unknown[] }> {
  return "domains" in promptInput && promptInput.audience === "participant";
}

function isIpipNeo120HrPromptInput(
  promptInput: ReportPromptInput,
): promptInput is Extract<ReportPromptInput, { audience: "hr"; domains: unknown[] }> {
  return "domains" in promptInput && promptInput.audience === "hr";
}

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
  if (isIpipNeo120ParticipantPromptInput(input.promptInput)) {
    return input.promptInput.domains
      .map(
        (domain) =>
          `${domain.domain_code} (${domain.label}): score=${domain.score}, band=${domain.band}, subdimensions=${domain.subdimensions
            .map(
              (subdimension) =>
                `${subdimension.facet_code} (${subdimension.label})=${subdimension.score}/${subdimension.band}`,
            )
            .join(", ")}`,
      )
      .join(" | ");
  }

  if (isIpipNeo120HrPromptInput(input.promptInput)) {
    return input.promptInput.domains
      .map(
        (domain) =>
          `${domain.domain_code} (${domain.label}): score=${domain.score}, score_band=${domain.score_band}, facets=${domain.facets
            .map(
              (facet) =>
                `${facet.facet_code} (${facet.label})=${facet.score}/${facet.score_band}`,
            )
            .join(", ")}`,
      )
      .join(" | ");
  }

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
  if (isIpipNeo120ParticipantPromptInput(input.promptInput)) {
    return JSON.stringify({
      instructions: {
        output_contract: "Return one participant report in the exact schema.",
        audience_behavior:
          "Write in bosanski, ijekavica, latinica, for the participant who completed the assessment. Keep the tone professional, clear, encouraging, and non-clinical.",
        structure_rules: [
          "Use 5 dominant_signals.",
          "Use 5 domains as the primary layer.",
          "Each domain must contain exactly 6 poddimenzije as the secondary layer.",
          "Use exactly 3 development_recommendations.",
          "Include one interpretation_note.",
        ],
        source_rule:
          "Use only the provided scoring input. Do not calculate from raw answers and do not invent extra traits or hiring conclusions.",
        terminology_rule:
          "Use the provided labels and the term poddimenzija, not facet.",
        guardrails: [
          "Do not diagnose or use clinical language.",
          "Do not give hire/no-hire recommendations.",
          "Do not infer protected traits.",
          "Do not treat the report as final truth about the person.",
          "Do not use absolute statements such as always, never, or definitely proves.",
        ],
        dimension_hint_text: buildDimensionHintText(input),
      },
      input: input.promptInput,
    });
  }

  if (isIpipNeo120HrPromptInput(input.promptInput)) {
    return JSON.stringify({
      instructions: {
        output_contract: "Return one HR report in the exact schema.",
        audience_behavior:
          "Write in bosanski, ijekavica, latinica, for HR and hiring stakeholders. Keep the tone neutral, operational, workplace-oriented, and non-clinical.",
        structure_rules: [
          "Use 5 workplace_signals.",
          "Use exactly 5 domains with one entry for each of N, E, O, A, and C.",
          "Each domain must contain exactly 6 facets.",
          "Each domain must contain exactly 2 workplace_strengths, 2 workplace_watchouts, and 2 management_notes.",
          "Use exactly 3 team_watchouts and exactly 3 onboarding_or_management_recommendations.",
        ],
        source_rule:
          "Use only the provided deterministic scoring input. Do not calculate from raw answers and do not invent extra dimensions, metrics, or hiring decisions.",
        terminology_rule:
          "Use the provided domain and facet labels and stay within workplace interpretation.",
        guardrails: [
          "Do not diagnose or use clinical language.",
          "Do not give hire/no-hire recommendations.",
          "Do not infer protected traits.",
          "Do not treat the report as final truth about the person.",
          "Do not use absolute statements such as always, never, or definitely proves.",
        ],
        dimension_hint_text: buildDimensionHintText(input),
      },
      input: input.promptInput,
    });
  }

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
    ["{{locale}}", input.promptInput.locale],
    ["{{test_slug}}", input.testSlug],
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
  if (input.testSlug === "ipip-neo-120-v1" && isIpipNeo120ParticipantPromptInput(input.promptInput)) {
    const validationResult = validateIpipNeo120ParticipantReportV1(report);

    if (!validationResult.ok) {
      throw new Error(
        `OpenAI response JSON failed IPIP-NEO-120 participant report validation: ${formatIpipNeo120ReportValidationErrors(validationResult.errors)}`,
      );
    }

    return validationResult.value;
  }

  if (input.testSlug === "ipip-neo-120-v1" && isIpipNeo120HrPromptInput(input.promptInput)) {
    const validationResult = validateIpipNeo120HrReportV1(report);

    if (!validationResult.ok) {
      throw new Error(
        `OpenAI response JSON failed IPIP-NEO-120 HR report validation: ${formatIpipNeo120ReportValidationErrors(validationResult.errors)}`,
      );
    }

    return validationResult.value;
  }

  const validationResult = validateRuntimeCompletedAssessmentReport(report, {
    testSlug: input.testSlug,
    audience: input.promptInput.audience,
  });

  if (!validationResult.ok) {
    const validationPrefix =
      input.reportContract.family === "ipc"
        ? "OpenAI response JSON failed IPC report validation"
        : input.testSlug === "ipip-neo-120-v1" && input.promptInput.audience === "participant"
          ? "OpenAI response JSON failed IPIP-NEO-120 participant report validation"
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
