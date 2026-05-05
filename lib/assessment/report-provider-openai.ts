import "server-only";

import type { ActivePromptVersion } from "@/lib/assessment/prompt-version";
import {
  getIpipNeo120ParticipantGenerationMode,
  getIpipNeo120ParticipantReportVersion,
} from "@/lib/assessment/report-config";
import {
  formatIpipNeo120ReportValidationErrors,
  validateIpipNeo120HrReportV1,
  validateIpipNeo120ParticipantReportV1,
} from "@/lib/assessment/ipip-neo-120-report-v1";
import {
  buildIpipNeo120ParticipantAiInputV2,
  validateIpipNeo120ParticipantAiInputV2,
  type IpipNeo120ParticipantAiInputV2,
} from "@/lib/assessment/ipip-neo-120-participant-ai-input-v2";
import {
  formatIpipNeo120ParticipantReportV2ValidationErrors,
  ipipNeo120ParticipantReportV2OpenAiSchema,
  validateIpipNeo120ParticipantReportV2,
} from "@/lib/assessment/ipip-neo-120-participant-report-v2";
import type { MwmsParticipantReportPromptInput } from "@/lib/assessment/mwms-report-contract";
import {
  formatMwmsParticipantReportV1ValidationErrors,
  mwmsParticipantReportV1OpenAiSchema,
  validateMwmsParticipantReportV1,
} from "@/lib/assessment/mwms-participant-report-v1";
import type { SafranAiReportInput } from "@/lib/assessment/safran-participant-ai-report-v1";
import {
  formatSafranParticipantAiReportValidationErrors,
  safranParticipantAiReportV1OpenAiSchema,
  validateSafranParticipantAiReport,
} from "@/lib/assessment/safran-participant-ai-report-v1";
import {
  assembleIpipNeo120ParticipantReportV2FromSegments,
  buildIpipNeo120ParticipantDomainSegmentPromptInput,
  buildIpipNeo120ParticipantOverviewSegmentPromptInput,
  buildIpipNeo120ParticipantPracticalSegmentPromptInput,
  formatIpipNeo120ParticipantReportV2SegmentValidationErrors,
  ipipNeo120ParticipantReportV2DomainSegmentOpenAiSchema,
  ipipNeo120ParticipantReportV2OverviewSegmentOpenAiSchema,
  ipipNeo120ParticipantReportV2PracticalSegmentOpenAiSchema,
  validateIpipNeo120ParticipantReportV2DomainSegment,
  validateIpipNeo120ParticipantReportV2OverviewSegment,
  validateIpipNeo120ParticipantReportV2PracticalSegment,
  validateIpipNeo120ParticipantReportV2SegmentsBundle,
} from "@/lib/assessment/ipip-neo-120-participant-report-v2-segments";
import { IPIP_NEO_120_DOMAIN_ORDER } from "@/lib/assessment/ipip-neo-120-labels";
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

export type IpipNeo120ParticipantProviderMode = "v1" | "v2-single" | "v2-segmented";

function isIpipNeo120ParticipantPromptInput(
  promptInput: ReportPromptInput,
): promptInput is Extract<ReportPromptInput, { audience: "participant"; domains: unknown[] }> {
  return "domains" in promptInput && promptInput.audience === "participant";
}

function isMwmsParticipantPromptInput(
  promptInput: ReportPromptInput,
): promptInput is MwmsParticipantReportPromptInput {
  return (
    "dimensions" in promptInput &&
    promptInput.test_slug === "mwms_v1" &&
    promptInput.audience === "participant"
  );
}

function isSafranParticipantPromptInput(
  promptInput: ReportPromptInput,
): promptInput is SafranAiReportInput {
  return (
    "test" in promptInput &&
    promptInput.test.slug === "safran_v1" &&
    promptInput.test.audience === "participant"
  );
}

function shouldUseIpipNeo120ParticipantReportV2(
  input: PreparedReportGenerationInput,
): boolean {
  return (
    input.testSlug === "ipip-neo-120-v1" &&
    isIpipNeo120ParticipantPromptInput(input.promptInput) &&
    getIpipNeo120ParticipantReportVersion() === "v2"
  );
}

export function resolveIpipNeo120ParticipantProviderMode(
  input: PreparedReportGenerationInput,
): IpipNeo120ParticipantProviderMode {
  if (!shouldUseIpipNeo120ParticipantReportV2(input)) {
    return "v1";
  }

  return getIpipNeo120ParticipantGenerationMode() === "segmented"
    ? "v2-segmented"
    : "v2-single";
}

export function buildOpenAiSchemaName(schemaName: string): string {
  const sanitized = schemaName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");

  if (sanitized.length <= 64) {
    return sanitized || "schema";
  }

  const compact = sanitized
    .split("_")
    .filter(Boolean)
    .map((part) => (part.length <= 4 ? part : part.slice(0, 3)))
    .join("_");

  if (compact.length <= 64) {
    return compact || "schema";
  }

  return compact.slice(0, 64) || "schema";
}

function buildIpipNeo120ParticipantSegmentSchemaName(
  segmentType: "overview" | "domain" | "practical",
  domainCode?: string,
): string {
  if (segmentType === "overview") {
    return buildOpenAiSchemaName("ipip_neo_120_participant_v2_segment_overview");
  }

  if (segmentType === "practical") {
    return buildOpenAiSchemaName("ipip_neo_120_participant_v2_segment_practical");
  }

  return buildOpenAiSchemaName(
    `ipip_neo_120_participant_v2_segment_domain_${domainCode ?? "unknown"}`,
  );
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
          `${domain.domain_code} (${domain.label}): score=${domain.score}, band=${domain.band}, subdimensions=${(Array.isArray(domain.subdimensions) ? domain.subdimensions : [])
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
          `${domain.domain_code} (${domain.label}): score=${domain.score}, score_band=${domain.score_band}, facets=${(Array.isArray(domain.facets) ? domain.facets : [])
            .map(
              (facet) =>
                `${facet.facet_code} (${facet.label})=${facet.score}/${facet.score_band}`,
            )
            .join(", ")}`,
      )
      .join(" | ");
  }

  if (!("dimension_scores" in input.promptInput)) {
    if (isSafranParticipantPromptInput(input.promptInput)) {
      return input.promptInput.scores.domains
        .map(
          (domain) =>
            `${domain.code} (${domain.label}): raw_score=${domain.rawScore}, score_label=${domain.scoreLabel}, band=${domain.band}, band_label=${domain.bandLabel}`,
        )
        .join(" | ");
    }

    if (isMwmsParticipantPromptInput(input.promptInput)) {
      return input.promptInput.dimensions
        .map(
          (dimension) =>
            `${dimension.code} (${dimension.label}): raw_score=${dimension.raw_score}, short_description=${dimension.short_description}`,
        )
        .join(" | ");
    }

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

export function buildIpipNeo120ParticipantV2SingleUserPrompt(
  input: PreparedReportGenerationInput,
): string {
  const v2Input = prepareIpipNeo120ParticipantAiInputV2ForOpenAi(input);

  return JSON.stringify({
    instructions: {
      output_contract:
        "Return one IPIP-NEO-120 participant report in contract_version ipip_neo_120_participant_v2.",
      input_rule: "Use only the provided V2 AI input.",
      narrative_rule: "Fill every narrative field in the V2 schema.",
      canonical_data_rule:
        "Do not change domain_code, facet_code, score, band, band_label, display_score, display_band, display_band_label, label, display_label, participant_display_label, narrative_label or scale_hint.",
      display_fields_rule:
        "score, band and band_label are canonical scoring values. display_score, display_band and display_band_label are participant-facing values. For NEUROTICISM, display_score and display_band may be inverted relative to canonical score and band. Return score, band, band_label, display_score, display_band and display_band_label exactly as provided in input. For all other domains, display values equal canonical values.",
      label_usage_rule:
        "For titles, cards, badges and short labels, use display_label. For narrative sentences, use narrative_label. Do not treat psychometric domain, dimension or subdimension names as proper nouns inside a sentence.",
      bosnian_capitalization_rule:
        "In Bosnian narrative text, psychometric domain, dimension and subdimension names must not be capitalized in the middle of a sentence. Capitalize them only at the start of a sentence, in headings, cards, chart labels and other UI labels.",
      text_budget_rule: "Follow text_budgets.",
      interpretation_rules:
        "Follow band_meanings, vocabulary_rules, consistency_rules and guardrails.",
      candidate_reflection_rule:
        "candidate_reflection is NOT a question. Treat candidate_reflection as a candidate_takeaway sentence. It must be a short declarative closing sentence. It must not ask the candidate to reflect, answer, notice, consider, or think about something. It must not end with '?'. It must not start with question words such as “Kako”, “Šta”, “Kada”, “Gdje”, “Zašto”, “Na koji način”, “Da li”, “Možeš li”, or “Možete li”. Do not use coaching-question style. Do not write self-reflection prompts. Good examples: “Najkorisnije je da ovaj signal posmatraš kao informaciju o tome kada ti treba više strukture i oporavka.” “Ovaj obrazac može ti pomoći da ranije prepoznaš situacije u kojima vrijedi usporiti i vratiti ritam.” “U praksi je korisno da ovaj signal povežeš sa jasnim granicama, podrškom i vremenom za oporavak.” Bad examples: “Kako možeš bolje koristiti ovaj obrazac?” “Šta ti može pomoći u ovakvim situacijama?” “Da li prepoznaješ ovaj obrazac kod sebe?”",
      static_text_rule:
        "Return static_text.interpretation_note exactly as provided in input.",
      rendering_rule:
        "Frontend will render this snapshot directly, so do not omit any required narrative field.",
    },
    input: v2Input,
  });
}

function buildDefaultUserPrompt(input: PreparedReportGenerationInput): string {
  if (resolveIpipNeo120ParticipantProviderMode(input) === "v2-single") {
    return buildIpipNeo120ParticipantV2SingleUserPrompt(input);
  }

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
    if (isSafranParticipantPromptInput(input.promptInput)) {
      return JSON.stringify({
        instructions: {
          output_contract:
            "Return one SAFRAN participant report in reportType safran_participant_ai_report_v1.",
          audience_behavior:
            "Write in the locale from input.test.locale. Address the participant directly in a calm, neutral, non-clinical tone.",
          source_rule:
            "Use only the provided structured SAFRAN input with already calculated scoreLabel, bandLabel and deterministicMeaning values. Do not calculate scores, do not change scoreLabel, and do not change bandLabel.",
          single_test_rule:
            "This is a single-test SAFRAN report. Interpret only SAFRAN results. Do not connect SAFRAN with IPIP or MWMS except in readingGuide where you may say it is useful together with other parts of Deep Profile procjene.",
          structure_rules: [
            "Return valid JSON only.",
            "Keep section order as header, summary, domains, cognitiveSignals, readingGuide, nextStep, safetyChecks.",
            "Keep domains in exact order verbal, figural, numeric.",
            'header.title must be exactly "SAFRAN".',
            "summary.scoreLabel must match input.scores.overall.scoreLabel exactly.",
            "summary.bandLabel must match input.scores.overall.bandLabel exactly.",
            "Each domain scoreLabel and bandLabel must match the provided input exactly.",
            "summary.interpretation must be at most 2 sentences.",
            "Each domain interpretation must be at most 2 sentences.",
            "Each cognitiveSignals field must be 1 sentence at most.",
            "readingGuide.bullets must contain exactly 5 items, one sentence each.",
          ],
          reading_guide_requirements: [
            "Use exactly these five readingGuide bullets in the same order, adapted only for locale while keeping the same meaning.",
            "1. The result is not a measure of general intelligence.",
            "2. The result is not a percentile and does not represent comparison with a local reference group.",
            "3. Practice questions are only for familiarization and do not enter scoring.",
            "4. SAFRAN result should not be used as a standalone decision about the candidate.",
            "5. The result is most useful when read together with other parts of Deep Profile procjene.",
            "Preferred Bosnian phrasing is acceptable and recommended: 'Ovi rezultati ne predstavljaju mjeru opšte inteligencije.' 'Ovaj rezultat nije percentil i ne predstavlja poređenje s lokalnom referentnom grupom.' 'Practice pitanja služe samo za upoznavanje s formatom zadataka i ne ulaze u scoring.' 'SAFRAN rezultat ne treba koristiti kao samostalnu odluku o kandidatu.' 'Najkorisnije ga je čitati zajedno s ostalim dijelovima Deep Profile procjene.'",
          ],
          guardrails: [
            "Do not use HR or hiring language.",
            "Do not use hire/no-hire language.",
            "Do not make IQ, percentile or norm claims.",
            "Do not diagnose and do not use clinical language.",
            "Do not make fixed-ability claims.",
            "Do not call the person smart, capable, incapable, above-average or below-average.",
            "Do not use V1, Ukupni kognitivni kompozit, or Rezultat ne znači.",
            "Do not mention raw answers, item banks, other candidates or organizational context.",
            "Do not mention AI.",
          ],
          safety_checks_rule:
            "All safetyChecks fields must be false.",
          dimension_hint_text: buildDimensionHintText(input),
        },
        input: input.promptInput,
      });
    }

    if (isMwmsParticipantPromptInput(input.promptInput)) {
      return JSON.stringify({
        instructions: {
          output_contract:
            "Return one MWMS participant report in schema_version mwms_participant_report_v1.",
          audience_behavior:
            "Write in Bosnian language, ijekavica, Latin script. Address the participant directly, neutrally, professionally and briefly.",
          source_rule:
            "Use only the provided MWMS structured input and dimension_scores already calculated by the application. Do not calculate from raw answers and do not invent scores.",
          profile_rule:
            "Interpret the six scales as a profile. Do not create a total score, percentile, pass/fail label, rank, norm comparison or hiring decision.",
          guardrails: [
            "Do not diagnose or use clinical language.",
            "Do not use hire/no-hire language.",
            "Do not say good candidate, bad candidate, recommend hiring, or do not recommend hiring.",
            "Do not invent job, organization, performance or personal context not present in the input.",
            "Do not mention AI.",
            "Use Radna motivacija as the candidate-facing title and do not mention MWMS in the title.",
            "Do not claim that the result proves the person's motivation.",
            "Frame claims as profile insights or hypotheses for reflection.",
          ],
          structure_rules: [
            "summary.headline and summary.paragraph must be short.",
            "key_observations must contain at most 3 items.",
            "possible_tensions must contain at most 3 items.",
            "reflection_questions must contain at most 3 items.",
            "development_suggestions must contain at most 3 items.",
            "interpretation_note must be neutral and state that the report is not a standalone basis for hiring decisions.",
          ],
          dimension_hint_text: buildDimensionHintText(input),
        },
        input: input.promptInput,
      });
    }

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

function getPromptInputLocale(input: ReportPromptInput): string {
  if ("locale" in input) {
    return input.locale;
  }

  return input.test.locale;
}

function getPromptInputAudience(input: ReportPromptInput): "participant" | "hr" {
  if ("audience" in input) {
    return input.audience;
  }

  return input.test.audience;
}

function applyPromptTemplate(
  template: string,
  input: PreparedReportGenerationInput,
  promptTemplate: ActivePromptVersion,
): string {
  const replacements = new Map<string, string>([
    ["{{prompt_version}}", promptTemplate.version],
    ["{{prompt_version_id}}", promptTemplate.id],
    ["{{locale}}", getPromptInputLocale(input.promptInput)],
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
  if (resolveIpipNeo120ParticipantProviderMode(input) === "v2-single") {
    return buildDefaultUserPrompt(input);
  }

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
  if (resolveIpipNeo120ParticipantProviderMode(input) === "v2-single") {
    return ipipNeo120ParticipantReportV2OpenAiSchema as Record<string, unknown>;
  }

  if (isMwmsParticipantPromptInput(input.promptInput)) {
    return mwmsParticipantReportV1OpenAiSchema as Record<string, unknown>;
  }

  if (isSafranParticipantPromptInput(input.promptInput)) {
    return safranParticipantAiReportV1OpenAiSchema as Record<string, unknown>;
  }

  return input.reportContract.outputSchemaJson;
}

function resolveOpenAiSchemaNameForInput(input: PreparedReportGenerationInput): string {
  return resolveIpipNeo120ParticipantProviderMode(input) === "v2-single"
    ? buildOpenAiSchemaName("ipip-neo-120-participant-v2")
    : buildOpenAiSchemaName(input.reportContract.schemaName);
}

export function prepareIpipNeo120ParticipantAiInputV2ForOpenAi(
  input: PreparedReportGenerationInput,
): IpipNeo120ParticipantAiInputV2 {
  if (!isIpipNeo120ParticipantPromptInput(input.promptInput)) {
    throw new Error("IPIP-NEO-120 participant V2 route requires participant prompt input.");
  }

  const v2Input = buildIpipNeo120ParticipantAiInputV2(input.promptInput);
  const validationResult = validateIpipNeo120ParticipantAiInputV2(v2Input);

  if (!validationResult.ok) {
    throw new Error(
      `IPIP-NEO-120 participant V2 AI input validation failed: ${validationResult.errors.join(" | ")}`,
    );
  }

  return validationResult.value;
}

export function resolveIpipNeo120ParticipantOpenAiRouteForInput(
  input: PreparedReportGenerationInput,
): {
  version: "v1" | "v2";
  generationMode: "single" | "segmented";
  schemaName: string;
  outputSchemaJson: Record<string, unknown>;
} {
  const mode = resolveIpipNeo120ParticipantProviderMode(input);

  if (mode !== "v1") {
    return {
      version: "v2",
      generationMode: mode === "v2-segmented" ? "segmented" : "single",
      schemaName: buildOpenAiSchemaName("ipip-neo-120-participant-v2"),
      outputSchemaJson: ipipNeo120ParticipantReportV2OpenAiSchema as Record<string, unknown>,
    };
  }

  return {
    version: "v1",
    generationMode: "single",
    schemaName: buildOpenAiSchemaName(input.reportContract.schemaName),
    outputSchemaJson: input.reportContract.outputSchemaJson,
  };
}

function buildIpipNeo120ParticipantOverviewSegmentUserPrompt(
  input: ReturnType<typeof buildIpipNeo120ParticipantOverviewSegmentPromptInput>,
): string {
  return JSON.stringify({
    instructions: [
      "Return only JSON matching the provided segment schema.",
      "Use only the provided segment input.",
      "Do not change score, band, band_label, display_score, display_band, display_band_label, canonical codes, labels, display_label, participant_display_label or narrative_label.",
      "score, band and band_label are canonical scoring values.",
      "display_score, display_band and display_band_label are participant-facing values.",
      "For NEUROTICISM, display_score and display_band may be inverted relative to canonical score and band. Return them exactly as provided in the segment input.",
      "For all other domains, display values equal canonical values.",
      "For titles, cards, badges and short labels, use display_label. For narrative sentences, use narrative_label.",
      "In Bosnian narrative text, psychometric domain, dimension and subdimension names are not proper nouns and must not be capitalized in the middle of a sentence. Capitalize them only at the start of a sentence or in headings and UI labels.",
      "Follow text_budgets, band_meanings, vocabulary_rules, consistency_rules and guardrails.",
      "Use Bosnian language, ijekavica, Latin script, second person singular.",
      "Do not include diagnosis, hire/no-hire recommendation, protected-trait inference, IQ claims or absolute claims.",
      "Generate only summary, key_patterns and work_style.",
      "Use the whole profile context from the overview segment input.",
      "Do not generate domain details here.",
    ],
    input,
  });
}

function buildIpipNeo120ParticipantDomainSegmentUserPrompt(
  input: ReturnType<typeof buildIpipNeo120ParticipantDomainSegmentPromptInput>,
  domainCode: string,
): string {
  return JSON.stringify({
    instructions: [
      "Return only JSON matching the provided segment schema.",
      "Use only the provided segment input.",
      "Do not change score, band, band_label, display_score, display_band, display_band_label, canonical codes, labels, display_label, participant_display_label or narrative_label.",
      "score, band and band_label are canonical scoring values.",
      "display_score, display_band and display_band_label are participant-facing values.",
      "For NEUROTICISM, display_score and display_band may be inverted relative to canonical score and band. Return them exactly as provided in the segment input.",
      "For all other domains, display values equal canonical values.",
      "For titles, cards and short labels, use display_label. For narrative sentences, use narrative_label.",
      "In Bosnian narrative text, psychometric domain, dimension and subdimension names are not proper nouns and must not be capitalized in the middle of a sentence. Capitalize them only at the start of a sentence or in headings and UI labels.",
      "Follow text_budgets, band_meanings, vocabulary_rules, consistency_rules and guardrails.",
      "Use Bosnian language, ijekavica, Latin script, second person singular.",
      "Do not include diagnosis, hire/no-hire recommendation, protected-trait inference, IQ claims or absolute claims.",
      `Generate only the requested domain: ${domainCode}.`,
      "Include exactly its 6 subdimensions.",
      "Do not generate other domains.",
      "Keep domain_code equal to the requested domainCode.",
      "candidate_reflection is NOT a question.",
      "Treat candidate_reflection as a candidate_takeaway sentence.",
      "It must be a short declarative closing sentence.",
      "It must not ask the candidate to reflect, answer, notice, consider, or think about something.",
      "It must not end with '?'.",
      "It must not start with question words such as “Kako”, “Šta”, “Kada”, “Gdje”, “Zašto”, “Na koji način”, “Da li”, “Možeš li”, or “Možete li”.",
      "Do not use coaching-question style.",
      "Do not write self-reflection prompts.",
      "For every domain.candidate_reflection and every subdimension.candidate_reflection, write a sentence that can stand after the phrase: “Takeaway: ...”",
      "If the sentence would sound like a question or coaching prompt, rewrite it as a declarative takeaway.",
      "In NEUROTICISM subdimensions, candidate_reflection must remain non-clinical and declarative. Do not ask reflective questions about stress, anxiety, mood, exposure, impulses or vulnerability. Write a calm takeaway sentence instead.",
      "Good examples: \"Najkorisnije je da ovaj signal posmatraš kao informaciju o tome kada ti treba više strukture i oporavka.\" \"Ovaj obrazac može ti pomoći da ranije prepoznaš situacije u kojima vrijedi usporiti i vratiti ritam.\" \"U praksi je korisno da ovaj signal povežeš sa jasnim granicama, podrškom i vremenom za oporavak.\"",
      "Bad examples: \"Kako možeš bolje koristiti ovaj obrazac?\" \"Šta ti može pomoći u ovakvim situacijama?\" \"Da li prepoznaješ ovaj obrazac kod sebe?\"",
    ],
    input,
  });
}

function buildIpipNeo120ParticipantPracticalSegmentUserPrompt(
  input: ReturnType<typeof buildIpipNeo120ParticipantPracticalSegmentPromptInput>,
): string {
  return JSON.stringify({
    instructions: [
      "Return only JSON matching the provided segment schema.",
      "Use only the provided segment input.",
      "Do not change score, band, band_label, display_score, display_band, display_band_label, canonical codes, labels, display_label, participant_display_label or narrative_label.",
      "score, band and band_label are canonical scoring values.",
      "display_score, display_band and display_band_label are participant-facing values.",
      "For NEUROTICISM, display_score and display_band may be inverted relative to canonical score and band. Return them exactly as provided in the segment input.",
      "For all other domains, display values equal canonical values.",
      "For titles and short labels, use display_label. For narrative sentences, use narrative_label.",
      "In Bosnian narrative text, psychometric domain, dimension and subdimension names are not proper nouns and must not be capitalized in the middle of a sentence. Capitalize them only at the start of a sentence or in headings and UI labels.",
      "Follow text_budgets, band_meanings, vocabulary_rules, consistency_rules and guardrails.",
      "Use Bosnian language, ijekavica, Latin script, second person singular.",
      "Do not include diagnosis, hire/no-hire recommendation, protected-trait inference, IQ claims or absolute claims.",
      "Generate only strengths, watchouts, development_recommendations and interpretation_note.",
      "Return static_text.interpretation_note exactly as provided.",
    ],
    input,
  });
}

async function requestOpenAiStructuredJson(
  options: OpenAiProviderOptions,
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
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new Error(`OpenAI ${payload.label} timed out after ${timeoutMs}ms.`),
      ),
    timeoutMs,
  );

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
      throw new Error(`OpenAI ${payload.label} request failed with status ${response.status}: ${errorText}`);
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
      throw new Error(`OpenAI ${payload.label} response did not contain structured content.`);
    }

    return parseStructuredContent(content);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`OpenAI ${payload.label} failed: ${error.message}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateIpipNeo120ParticipantV2SegmentedReport(
  input: PreparedReportGenerationInput,
  options: OpenAiProviderOptions,
): Promise<RuntimeCompletedAssessmentReport> {
  const v2Input = prepareIpipNeo120ParticipantAiInputV2ForOpenAi(input);
  const systemPrompt = buildSystemPrompt(input);

  const overviewPromptInput = buildIpipNeo120ParticipantOverviewSegmentPromptInput(v2Input);
  const overviewSegment = await requestOpenAiStructuredJson(options, {
    label: "IPIP-NEO-120 participant V2 overview segment",
    schemaName: buildIpipNeo120ParticipantSegmentSchemaName("overview"),
    schema: ipipNeo120ParticipantReportV2OverviewSegmentOpenAiSchema as Record<string, unknown>,
    systemPrompt,
    userPrompt: buildIpipNeo120ParticipantOverviewSegmentUserPrompt(overviewPromptInput),
  });
  const overviewValidation = validateIpipNeo120ParticipantReportV2OverviewSegment(overviewSegment);

  if (!overviewValidation.ok) {
    throw new Error(
      `IPIP-NEO-120 participant V2 overview segment validation failed: ${formatIpipNeo120ParticipantReportV2SegmentValidationErrors(
        overviewValidation.errors,
      )}`,
    );
  }

  const domainSegments = [];

  for (const domainCode of IPIP_NEO_120_DOMAIN_ORDER) {
    const domainPromptInput = buildIpipNeo120ParticipantDomainSegmentPromptInput(v2Input, domainCode);
    const domainSegment = await requestOpenAiStructuredJson(options, {
      label: `IPIP-NEO-120 participant V2 domain segment (${domainCode})`,
      schemaName: buildIpipNeo120ParticipantSegmentSchemaName("domain", domainCode),
      schema: ipipNeo120ParticipantReportV2DomainSegmentOpenAiSchema as Record<string, unknown>,
      systemPrompt,
      userPrompt: buildIpipNeo120ParticipantDomainSegmentUserPrompt(domainPromptInput, domainCode),
    });
    const domainValidation = validateIpipNeo120ParticipantReportV2DomainSegment(
      domainSegment,
      domainCode,
    );

    if (!domainValidation.ok) {
      throw new Error(
        `IPIP-NEO-120 participant V2 domain segment validation failed for ${domainCode}: ${formatIpipNeo120ParticipantReportV2SegmentValidationErrors(
          domainValidation.errors,
        )}`,
      );
    }

    domainSegments.push(domainValidation.value);
  }

  const practicalPromptInput = buildIpipNeo120ParticipantPracticalSegmentPromptInput(v2Input);
  const practicalSegment = await requestOpenAiStructuredJson(options, {
    label: "IPIP-NEO-120 participant V2 practical segment",
    schemaName: buildIpipNeo120ParticipantSegmentSchemaName("practical"),
    schema: ipipNeo120ParticipantReportV2PracticalSegmentOpenAiSchema as Record<string, unknown>,
    systemPrompt,
    userPrompt: buildIpipNeo120ParticipantPracticalSegmentUserPrompt(practicalPromptInput),
  });
  const practicalValidation = validateIpipNeo120ParticipantReportV2PracticalSegment(practicalSegment);

  if (!practicalValidation.ok) {
    throw new Error(
      `IPIP-NEO-120 participant V2 practical segment validation failed: ${formatIpipNeo120ParticipantReportV2SegmentValidationErrors(
        practicalValidation.errors,
      )}`,
    );
  }

  const bundle = {
    overview: overviewValidation.value,
    domains: domainSegments,
    practical: practicalValidation.value,
  };
  const bundleValidation = validateIpipNeo120ParticipantReportV2SegmentsBundle(bundle);

  if (!bundleValidation.ok) {
    throw new Error(
      `IPIP-NEO-120 participant V2 segments bundle validation failed: ${formatIpipNeo120ParticipantReportV2SegmentValidationErrors(
        bundleValidation.errors,
      )}`,
    );
  }

  const assembled = assembleIpipNeo120ParticipantReportV2FromSegments(v2Input, bundleValidation.value);

  if (!assembled.ok) {
    throw new Error(
      `IPIP-NEO-120 participant V2 final assembly failed: ${formatIpipNeo120ParticipantReportV2SegmentValidationErrors(
        assembled.errors,
      )}`,
    );
  }

  return assembled.value;
}

function validateStructuredReport(
  report: unknown,
  input: PreparedReportGenerationInput,
): RuntimeCompletedAssessmentReport {
  if (input.testSlug === "ipip-neo-120-v1" && isIpipNeo120ParticipantPromptInput(input.promptInput)) {
    if (shouldUseIpipNeo120ParticipantReportV2(input)) {
      const validationResult = validateIpipNeo120ParticipantReportV2(report);

      if (!validationResult.ok) {
        throw new Error(
          `OpenAI response JSON failed IPIP-NEO-120 participant V2 report validation: ${formatIpipNeo120ParticipantReportV2ValidationErrors(validationResult.errors)}`,
        );
      }

      return validationResult.value;
    }

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

  if (input.testSlug === "mwms_v1" && isMwmsParticipantPromptInput(input.promptInput)) {
    const validationResult = validateMwmsParticipantReportV1(report);

    if (!validationResult.ok) {
      throw new Error(
        `OpenAI response JSON failed MWMS participant report validation: ${formatMwmsParticipantReportV1ValidationErrors(validationResult.errors)}`,
      );
    }

    return validationResult.value;
  }

  if (input.testSlug === "safran_v1" && isSafranParticipantPromptInput(input.promptInput)) {
    const validationResult = validateSafranParticipantAiReport(report, {
      expectedInput: input.promptInput,
    });

    if (!validationResult.ok) {
      throw new Error(
        `OpenAI response JSON failed SAFRAN participant report validation: ${formatSafranParticipantAiReportValidationErrors(validationResult.errors)}`,
      );
    }

    return validationResult.value;
  }

  const validationResult = validateRuntimeCompletedAssessmentReport(report, {
    testSlug: input.testSlug,
    audience: getPromptInputAudience(input.promptInput),
  });

  if (!validationResult.ok) {
    const validationPrefix =
      input.reportContract.family === "ipc"
        ? "OpenAI response JSON failed IPC report validation"
        : input.testSlug === "ipip-neo-120-v1" &&
            getPromptInputAudience(input.promptInput) === "participant"
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
  const providerMode = resolveIpipNeo120ParticipantProviderMode(input);
  const timeoutMs = options.timeoutMs ?? 120000;

  console.info("OpenAI report generation started", {
    attemptId: input.attemptId,
    testSlug: input.testSlug,
    model: options.model,
    promptVersion: input.promptVersion,
    timeoutMs,
    providerMode,
  });

  try {
    const validated =
      providerMode === "v2-segmented"
        ? await generateIpipNeo120ParticipantV2SegmentedReport(input, options)
        : validateStructuredReport(
            await requestOpenAiStructuredJson(options, {
              label: "report",
              schemaName: resolveOpenAiSchemaNameForInput(input),
              schema: resolveOpenAiResponseFormatSchemaForInput(input),
              systemPrompt: buildSystemPrompt(input),
              userPrompt: buildUserPrompt(input),
            }),
            input,
          );

    console.info("OpenAI report generation succeeded", {
      attemptId: input.attemptId,
      testSlug: input.testSlug,
      model: options.model,
      timeoutMs,
      reportFamily: input.reportContract.family,
      providerMode,
    });

    return validated;
  } catch (error) {
    const normalizedError = error instanceof Error ? (error as ErrorWithCause) : null;

    console.error("OpenAI report generation failed", {
      attemptId: input.attemptId,
      testSlug: input.testSlug,
      model: options.model,
      timeoutMs,
      errorName: normalizedError?.name ?? typeof error,
      errorMessage: normalizedError?.message ?? String(error),
      errorStack: normalizedError?.stack ?? null,
      errorCause: normalizedError?.cause ?? null,
      providerMode,
    });

    throw error;
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
