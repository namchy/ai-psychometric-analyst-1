import "server-only";

import type { ActivePromptVersion } from "@/lib/assessment/prompt-version";
import {
  getIpipNeo120ParticipantGenerationMode,
  getIpipNeo120ParticipantReportVersion,
} from "@/lib/assessment/report-config";
import {
  maybeWriteAiReportDebugDump,
} from "@/lib/assessment/ai-report-debug-dump";
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
import type {
  SingleTestHrPromptAuthorityMetadata,
} from "@/lib/assessment/report-providers";
import {
  buildSingleTestHrPromptAuthorityMetadata,
} from "@/lib/assessment/report-provider-helpers";
import type { MwmsParticipantReportPromptInput } from "@/lib/assessment/mwms-report-contract";
import {
  formatMwmsHrReportValidationErrors,
  mwmsHrReportV1OpenAiSchema,
  validateMwmsHrReportV1,
  type MwmsHrReportInput,
} from "@/lib/assessment/mwms-hr-report-v1";
import {
  formatMwmsParticipantReportV1ValidationErrors,
  mwmsParticipantReportV1OpenAiSchema,
  validateMwmsParticipantReportV1,
} from "@/lib/assessment/mwms-participant-report-v1";
import {
  formatSafranHrReportValidationErrors,
  safranHrReportV1OpenAiSchema,
  validateSafranHrReport,
  type SafranHrReportInput,
} from "@/lib/assessment/safran-hr-report-v1";
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
import {
  resolveAiReportLanguagePolicy,
} from "@/lib/assessment/ai-report-language-policy";
import {
  applyIpipNeo120HrTerminologyCleanup,
  buildIpipNeo120HrStrengthsAndRisksInstruction,
  canonicalizeIpipNeo120HrReportTerminology,
  getIpipNeo120HrDomainLabelsInOrder,
  IPIP_NEO_120_DOMAIN_ORDER,
} from "@/lib/assessment/ipip-neo-120-labels";
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
type OpenAiChatCompletionsRequestBody = {
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
    "test_slug" in promptInput &&
    promptInput.test_slug === "mwms_v1" &&
    promptInput.audience === "participant"
  );
}

function isMwmsHrPromptInput(
  promptInput: ReportPromptInput,
): promptInput is MwmsHrReportInput {
  return (
    "dimensions" in promptInput &&
    "testSlug" in promptInput &&
    promptInput.testSlug === "mwms_v1" &&
    promptInput.audience === "hr"
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

function isSafranHrPromptInput(
  promptInput: ReportPromptInput,
): promptInput is SafranHrReportInput {
  return (
    "test" in promptInput &&
    promptInput.test.slug === "safran_v1" &&
    promptInput.test.audience === "hr"
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

function shouldOmitOpenAiTemperature(model: string): boolean {
  return model.startsWith("gpt-5.5");
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

export function buildOpenAiChatCompletionsRequestBody(
  options: OpenAiProviderOptions,
  payload: {
    schemaName: string;
    schema: Record<string, unknown>;
    systemPrompt: string;
    userPrompt: string;
  },
): OpenAiChatCompletionsRequestBody {
  if (!options.model) {
    throw new Error("Missing required env var: AI_REPORT_MODEL");
  }

  const body: OpenAiChatCompletionsRequestBody = {
    model: options.model,
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
  };

  if (!shouldOmitOpenAiTemperature(options.model)) {
    body.temperature = 0.2;
  }

  return body;
}

export function buildOpenAiStructuredRequestPayload(
  input: PreparedReportGenerationInput,
  options: OpenAiProviderOptions,
  requestOverride?: {
    schemaName: string;
    schema: Record<string, unknown>;
    systemPrompt: string;
    userPrompt: string;
  },
): {
  schemaName: string;
  schema: Record<string, unknown>;
  systemPrompt: string;
  userPrompt: string;
  requestBody: OpenAiChatCompletionsRequestBody;
  authorityMetadata: SingleTestHrPromptAuthorityMetadata | null;
} {
  const schemaName = requestOverride?.schemaName ?? resolveOpenAiSchemaNameForInput(input);
  const schema = requestOverride?.schema ?? resolveOpenAiResponseFormatSchemaForInput(input);
  const systemPrompt = requestOverride?.systemPrompt ?? buildSystemPrompt(input);
  const userPrompt = requestOverride?.userPrompt ?? buildUserPrompt(input);
  const authorityMetadata = buildSingleTestHrPromptAuthorityMetadata(input);

  return {
    schemaName,
    schema,
    systemPrompt,
    userPrompt,
    authorityMetadata,
    requestBody: buildOpenAiChatCompletionsRequestBody(options, {
      schemaName,
      schema,
      systemPrompt,
      userPrompt,
    }),
  };
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

export function buildSafranHrMandatoryPromptGuardrails(): string {
  return [
    "SAFRAN HR mandatory guardrails:",
    "executiveSummary.summary must be a cautious HR hypothesis, not a conclusion, verdict or selection decision.",
    'executiveSummary.summary must explicitly use hypothesis wording such as "Ovaj rezultat može ukazivati...", "Ovo treba čitati kao hipotezu za provjeru..." or "Signal treba provjeriti kroz intervju, iskustvo i kontekst uloge."',
    'executiveSummary.summary must already in the first or second sentence use an explicit cautious HR hypothesis frame such as "Ovaj rezultat treba čitati kao opreznu HR hipotezu...", "Ovaj sažetak treba koristiti kao hipotezu za provjeru..." or "Ovi signali mogu pomoći HR-u da formira hipoteze koje treba provjeriti...".',
    'executiveSummary.summary must clearly say that the signal should be checked through interview, experience and role context, ideally with wording such as "ovaj signal treba provjeriti" and "čitati zajedno sa iskustvom, intervjuom i kontekstom uloge".',
    'Safe executiveSummary.summary example: "Ovaj rezultat treba čitati kao opreznu HR hipotezu, ne kao zaključak o kandidatu. Profil pokazuje jače verbalne i figuralne signale u ovom setu zadataka, uz slabiji numerički signal koji je korisno provjeriti kroz konkretne radne zadatke, intervju, iskustvo i zahtjeve uloge."',
    "executiveSummary.summary should have three short functions in separate short sentences: cautious HR hypothesis frame, main result profile, and what HR should verify against the role.",
    "executiveSummary.summary must not be one long validator-driven sentence and must not list scores without a work implication.",
    "executiveSummary.summary must not sound final, absolute, diagnostic or hire/no-hire oriented.",
    'In cognitiveSignals, do not repeat the same opening phrase across all four items; especially do not use "To može ukazivati" as the default start in every item.',
    'If you use "može ukazivati", use it at most once inside cognitiveSignals and vary the other items with HR-safe alternatives such as "Ovaj rezultat je najkorisnije čitati kao...", "U HR kontekstu, ovaj obrazac može biti relevantan za...", "Ovaj signal vrijedi provjeriti kroz...", "U ovoj procjeni, rezultat sugeriše...", "Za ovu oblast je korisno obratiti pažnju na..." or "Ovaj dio rezultata treba povezati sa iskustvom, intervjuom i zahtjevima uloge."',
    "Each cognitiveSignals item must include three content elements: a score anchor such as 18/18, 0/18 or 36/54, a short interpretation limited to this assessment, and one practical HR implication or check through interview or work sample.",
    'In cognitiveSignals, reduce repeated phrases such as "u ovoj procjeni", "u okviru ovog seta zadataka" and "za HR je korisno"; keep caution, but do not make every sentence sound defensive.',
    'For numeric cognitiveSignals, prefer practical wording like: "Ako uloga uključuje rad sa brojčanim podacima, tabelama, procjenama ili brzim kvantitativnim odlukama, ovaj signal treba dodatno provjeriti kroz kratak praktični zadatak."',
    "pointsOfCaution must be concrete HR hypotheses for checking, not generic methodological notes.",
    "pointsOfCaution must contain only real caution points or HR hypotheses for checking; do not place positive signals there just because they are high.",
    'Do not use positive-signal point titles such as "Vrlo snažan verbalni signal" or "Vrlo snažan figuralni signal" unless they are phrased as a concrete work-context check.',
    "For uneven profiles, prefer caution topics such as differences between verbal/figural and numeric results, a weaker numeric signal when the role uses numerical data, or total result hiding differences between task types.",
    'Avoid generic methodological headings in pointsOfCaution such as "Rizik od pogrešne interpretacije ukupnog rezultata", "Pogrešno tumačenje rezultata" or "Ograničenja testa".',
    "Each pointsOfCaution item must clearly state what the signal is, why it matters for work context, and how HR can check it.",
    "interviewQuestions must be short, natural to say aloud, open-ended and directly tied to the signal.",
    "Each interviewQuestions.question should be no more than two sentences and should avoid long administrative phrasing.",
    "interviewQuestions should sound like HR can ask them aloud without rewriting; avoid grammatically awkward constructions.",
    "onboardingGuidance must be tied to the concrete profile, not a generic onboarding plan.",
    "For a profile with stronger verbal/figural signals and weaker numeric signal, use clear instructions, visual examples, process maps, control steps and short accuracy checks when the role includes numerical data.",
    "Avoid unnatural onboarding wording such as 'način korištenja učinka', 'zadaci koji koriste...' or vague references to 'procjene i tabele' without work context.",
    "interpretationLimits must include at least one sentence stating that results should be read together with experience, interview and role context.",
    'interpretationLimits must include the idea: "čitati zajedno sa iskustvom, intervjuom i kontekstom uloge."',
    "interpretationLimits must state that the report is not a hiring decision.",
    "interpretationLimits must state that the result should be read only within this set of tasks.",
    "interpretationLimits must state that the report should not be used for ranking a person against others.",
    'Ranking statements in interpretationLimits must always be explicitly negative, using wording such as "Nalaze ne treba koristiti za rangiranje osobe u odnosu na druge."',
    "interpretationLimits must state that the report should not be read as a comparison with a wider population.",
    'interpretationLimits should use safe replacement wording such as "u okviru ovog seta zadataka", "ne koristiti za rangiranje osobe u odnosu na druge", "ne čitati kao poređenje sa širom populacijom" and "čitajte kao signal iz ove procjene".',
    "interpretationLimits must state that the cognitive signal is a hypothesis for checking, not a final conclusion.",
    "Report tone must feel like a professional HR decision-support artifact, not an academic test explanation or generic AI text: shorter sentences, clearer verbs, fewer repeated caveats, more concrete work implications, no selection verdicts and no psychological labeling.",
    "Forbidden phrases are validation blockers.",
    "Never output forbidden literal phrases anywhere in the JSON, including negated, quoted or cautionary statements such as 'this is not X'.",
    "If a restriction would naturally mention a forbidden phrase, rewrite the sentence with the safe replacement wording instead of naming the forbidden phrase.",
    "Forbidden literal phrases: IQ, kvocijent inteligencije, intelligent, inteligentan, neinteligentan, iznadprosječan, ispodprosječan, percentile, percentil, norma, norme, normativno, normativna poređenja, normativno poređenje, hiring score, hire/no-hire recommendation, red flag, rizičan kandidat, idealni kandidat.",
  ].join("\n");
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

    if (isMwmsHrPromptInput(input.promptInput)) {
      return input.promptInput.dimensions
        .map(
          (dimension) =>
            `${dimension.code} (${dimension.label}): raw_score=${dimension.rawScore}, band=${dimension.band}, band_label=${dimension.bandLabel}`,
        )
        .join(" | ");
    }

    if (isSafranHrPromptInput(input.promptInput)) {
      return [
        `overall=${input.promptInput.scores.overall.scoreLabel}/${input.promptInput.scores.overall.bandLabel}`,
        `verbal=${input.promptInput.scores.verbal.scoreLabel}/${input.promptInput.scores.verbal.bandLabel}`,
        `figural=${input.promptInput.scores.figural.scoreLabel}/${input.promptInput.scores.figural.bandLabel}`,
        `numeric=${input.promptInput.scores.numeric.scoreLabel}/${input.promptInput.scores.numeric.bandLabel}`,
      ].join(" | ");
    }

    if (!("derived" in input.promptInput) || !("rawOctants" in input.promptInput)) {
      return "";
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

export function buildDefaultUserPrompt(input: PreparedReportGenerationInput): string {
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
          "Write in bosanski, ijekavica, latinica, for HR stakeholders. Keep the tone formal, operational, calm, workplace-oriented, and non-clinical.",
        structure_rules: [
          "headline must be a single short paragraph with no bullets or line breaks, target up to 110 characters, and hard maximum 120 characters. It must name a practical HR signal plus one implication for interview or work context.",
          "executive_summary must be a single short paragraph with no bullets or line breaks, target up to 320 characters, and hard maximum 600 characters. Cover the dominant work pattern, what HR should verify, and optional use in interview or onboarding.",
          "Use exactly 3 key_hr_signals. Each item must include title, evidence, and hr_implication.",
          "Use exactly 3 verification_focus items. Each item must include area, why_it_matters, and how_to_check.",
          "Use exactly 5 interview_questions. Each item must include question, evaluates, and what_good_answer_may_show.",
          buildIpipNeo120HrStrengthsAndRisksInstruction(),
          buildIpipNeo120HrDomainOverviewOrderInstruction(),
          "Each domain_overview.concise_meaning must be a single short paragraph with no bullets or line breaks, target up to 180 characters, and hard maximum 300 characters.",
          "Each domain_overview.hr_relevance must be a single short paragraph with no bullets or line breaks, target up to 220 characters, and hard maximum 400 characters.",
          "Each domain_overview.check_in_interview must be a single short paragraph with no bullets or line breaks, target up to 220 characters, and hard maximum 400 characters.",
          "Each domain_overview item may include at most 2 top_facets.",
          "Use exactly 4 onboarding_and_management_guidance items.",
          "Use exactly 3 team_fit_notes items.",
          "Use 2 to 4 decision_support_note bullets.",
          "interpretation_note must be a single short paragraph with no bullets or line breaks, target up to 220 characters, and hard maximum 450 characters.",
        ],
        source_rule:
          "Use only the provided deterministic scoring input. Do not calculate from raw answers, do not change bands, and do not invent extra domains, facets, metrics, or hiring decisions.",
        terminology_rule:
          "Use the provided domain and facet labels, stay within workplace interpretation, and make each section answer what HR can do with the finding.",
        guardrails: [
          "Do not diagnose or use clinical language.",
          "Do not give hire/no-hire recommendations.",
          "Do not say employ, hire, reject, or recommend employment.",
          "Do not infer protected traits.",
          "Do not treat the report as final truth about the person.",
          "Do not use absolute statements such as always, never, or definitely proves.",
          'Do not use the phrases "najistaknutiji profesionalni signal", "djeluje kao najstabilniji izvor radnog ritma", or "može pomoći finijem razumijevanju".',
          "Do not use diagnostic, medical, or protected-attribute language.",
          "Do not reveal or mention candidate scores in interview questions.",
          "decision_support_note must clearly say the report is not a standalone hiring decision and should be combined with interview, experience, references, and role requirements.",
          "interpretation_note must say the report is not a diagnosis, is not a hiring decision, does not confirm protected traits, must be read with role context and other information sources, and must only explain how to use or limit the report rather than adding new domain interpretation.",
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
          narrative_quality_rules: [
            "deterministicMeaning is a safety/context boundary, not final copy.",
            "Do not copy deterministicMeaning verbatim or with a trivial paraphrase in any domain interpretation.",
            "Do not merely restate scoreLabel or bandLabel in summary.interpretation.",
            "summary.interpretation must explain the pattern across domains, including relation, contrast or difference between areas when visible.",
            "If there is a clear contrast, name it carefully with terms such as obrazac, odnos, kontrast, razlika, u odnosu na, verbalno-figuralni dio, numerički dio.",
            "Keep interpretation tied to SAFRAN task performance, not to the whole person.",
            "Use nextStep.body for one practical candidate-facing reflection about where the format felt clearer and where it required more checking, time or a different approach.",
          ],
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
            "summary.interpretation or cognitiveSignals must contain at least one explicit pattern term such as obrazac, odnos, kontrast, razlika or u odnosu na.",
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

    if (isSafranHrPromptInput(input.promptInput)) {
      return JSON.stringify({
        instructions: {
          output_contract:
            "Return one SAFRAN HR report in reportType safran_hr_report_v1.",
          audience_behavior:
            "Write in the locale from input.test.locale for an HR professional. Keep the tone neutral, workplace-oriented, careful and non-clinical.",
          decision_support_rule:
            "This report is decision-support only and must not make or imply a hiring decision.",
          source_rule:
            "Use only the provided structured SAFRAN input with already calculated rawScore, maxScore, scoreLabel, band and bandLabel values. Do not calculate scores, do not change scores, and do not change labels or bands.",
          interpretation_rule:
            "Frame all conclusions as signals, hypotheses and checks. Use wording such as moze ukazivati, korisno je provjeriti, u ovom setu zadataka, and signal treba citati zajedno sa iskustvom, intervjuom i kontekstom uloge.",
          field_level_rules: [
            "executiveSummary.summary must be a cautious HR hypothesis, not a conclusion or verdict.",
            'executiveSummary.summary must explicitly use at least one hypothesis phrase such as "Ovaj rezultat može ukazivati...", "Ovo treba čitati kao hipotezu za provjeru..." or "Signal treba provjeriti kroz intervju, iskustvo i kontekst uloge."',
            'executiveSummary.summary must already in the first or second sentence use an explicit cautious HR hypothesis frame such as "Ovaj rezultat treba čitati kao opreznu HR hipotezu...", "Ovaj sažetak treba koristiti kao hipotezu za provjeru..." or "Ovi signali mogu pomoći HR-u da formira hipoteze koje treba provjeriti...".',
            'executiveSummary.summary must clearly say that the signal should be checked through interview, experience and role context, ideally with wording such as "ovaj signal treba provjeriti" and "čitati zajedno sa iskustvom, intervjuom i kontekstom uloge".',
            'Safe executiveSummary.summary example: "Ovaj rezultat treba čitati kao opreznu HR hipotezu, ne kao zaključak o kandidatu. Profil pokazuje jače verbalne i figuralne signale u ovom setu zadataka, uz slabiji numerički signal koji je korisno provjeriti kroz konkretne radne zadatke, intervju, iskustvo i zahtjeve uloge."',
            "executiveSummary.summary should have three short functions in separate short sentences: cautious HR hypothesis frame, main result profile, and what HR should verify against the role.",
            "executiveSummary.summary must not be one long validator-driven sentence and must not list scores without a work implication.",
            "executiveSummary.summary must not sound final, absolute or selection-decisive.",
            'In cognitiveSignals, do not repeat the same opening phrase across overall, verbal, figural and numeric; especially do not use "To može ukazivati" in every item.',
            'If you use "može ukazivati" inside cognitiveSignals, use it at most once and vary the rest with alternatives such as "Ovaj rezultat je najkorisnije čitati kao...", "U HR kontekstu, ovaj obrazac može biti relevantan za...", "Ovaj signal vrijedi provjeriti kroz...", "U ovoj procjeni, rezultat sugeriše...", "Za ovu oblast je korisno obratiti pažnju na..." or "Ovaj dio rezultata treba povezati sa iskustvom, intervjuom i zahtjevima uloge."',
            "Each cognitiveSignals item must include the score anchor, a brief interpretation of the signal in this assessment, and one HR implication or check through interview or work sample.",
            'In cognitiveSignals, reduce repeated phrases such as "u ovoj procjeni", "u okviru ovog seta zadataka" and "za HR je korisno"; each item should still end with a practical work implication or check.',
            'For numeric cognitiveSignals, prefer practical wording like: "Ako uloga uključuje rad sa brojčanim podacima, tabelama, procjenama ili brzim kvantitativnim odlukama, ovaj signal treba dodatno provjeriti kroz kratak praktični zadatak."',
            "pointsOfCaution must be concrete HR hypotheses for checking rather than generic methodological warnings.",
            "pointsOfCaution must contain only real caution points or HR hypotheses for checking; do not place positive signals there just because they are high.",
            'Do not use positive-signal point titles such as "Vrlo snažan verbalni signal" or "Vrlo snažan figuralni signal" unless they are phrased as a concrete work-context check.',
            "For uneven profiles, prefer caution topics such as differences between verbal/figural and numeric results, weaker numeric signal when the role uses numerical data, and total result hiding differences between task types.",
            'Avoid methodological pointsOfCaution labels such as "Rizik od pogrešne interpretacije ukupnog rezultata", "Pogrešno tumačenje rezultata" or "Ograničenja testa". Move those ideas to interpretationLimits instead.',
            "interviewQuestions must be short, natural to say aloud, open-ended and practical for interview use.",
            "Each interviewQuestions.question should be no more than two sentences and should avoid long administrative constructions.",
            "interviewQuestions should sound like HR can ask them aloud without rewriting and must avoid grammatically awkward constructions.",
            "onboardingGuidance must be tied to the concrete profile, not a generic onboarding plan.",
            "For stronger verbal/figural signals with weaker numeric signal, onboardingGuidance should use clear instructions, visual examples, process maps, control steps and short accuracy checks when the role includes numerical data.",
            "Avoid unnatural onboarding wording such as 'način korištenja učinka', 'zadaci koji koriste...' or vague references to 'procjene i tabele' without work context.",
            "interpretationLimits must include at least one sentence that says the signal must be read together with experience, interview and role context.",
            'interpretationLimits must include the exact idea: "čitati zajedno sa iskustvom, intervjuom i kontekstom uloge."',
            "interpretationLimits must also make clear that this report is not a hiring decision, that the result should be read only within this set of tasks, that it should not be used for ranking a person against others, that it should not be read as a comparison with a wider population, and that the cognitive signal is a hypothesis for checking rather than a final conclusion.",
            'Ranking statements in interpretationLimits must always be explicitly negative, using wording such as "Nalaze ne treba koristiti za rangiranje osobe u odnosu na druge."',
            'Use safe replacement wording such as "u okviru ovog seta zadataka", "ne koristiti za rangiranje osobe u odnosu na druge", "ne čitati kao poređenje sa širom populacijom" and "čitajte kao signal iz ove procjene".',
            "Overall tone must feel like a professional HR decision-support artifact, not an academic test explanation or generic AI text: shorter sentences, clearer verbs, fewer repeated caveats and more concrete work implications.",
          ],
          structure_rules: [
            "Return valid JSON only.",
            "Output sections must be executiveSummary, cognitiveSignals, pointsOfCaution, interviewQuestions, onboardingGuidance, interpretationLimits and safetyChecks.",
            "Keep identity fields exact: reportType safran_hr_report_v1, testSlug safran_v1, audience hr, sourceType single_test.",
            "executiveSummary.title must be short and HR-facing.",
            "executiveSummary.summary must be 3 short sentences or fewer.",
            "cognitiveSignals must contain exactly overall, verbal, figural and numeric.",
            'Do not use the exact phrase "To može ukazivati" more than once across cognitiveSignals, and do not use it as the default opening for every item.',
            "Each cognitiveSignals item must mention the concrete provided score, keep the interpretation tied to this assessment, and end with a practical HR implication or follow-up check.",
            "pointsOfCaution must contain at least 2 items and each item must have signal, whyItMatters and howToCheck.",
            "pointsOfCaution must focus on concrete work-context hypotheses, not on generic test limitations.",
            "pointsOfCaution must not treat high verbal or figural scores as caution points unless phrased as a concrete work-context check.",
            "interviewQuestions must contain at least 3 items and each item must have category, question and whatToListenFor.",
            "interviewQuestions.question must be short, natural for spoken interview use and at most 2 sentences.",
            "onboardingGuidance must contain first30Days, days60 and days90 arrays with at least 1 item each.",
            "onboardingGuidance must connect recommendations to the observed verbal, figural and numeric pattern.",
            "interpretationLimits must contain at least 3 items.",
            "At least one interpretationLimits item must say that the result should be read together with experience, interview and role context.",
            "At least one interpretationLimits item must say that the report is not a hiring decision.",
            "At least one interpretationLimits item must say that the result should be read only within this set of tasks.",
            'At least one interpretationLimits item must say exactly or very closely: "Nalaze ne treba koristiti za rangiranje osobe u odnosu na druge."',
            "At least one interpretationLimits item must say that the result should not be read as a comparison with a wider population.",
            "At least one interpretationLimits item must say that the cognitive signal is a hypothesis for checking, not a final conclusion.",
            "All safetyChecks fields must be true.",
          ],
          hard_guardrails: [
            "Do not calculate or mutate any score.",
            "Do not change scoreLabel, band or bandLabel.",
            "Do not invent norms, percentiles, IQ, general intelligence, normative comparisons or population comparisons.",
            "Forbidden phrases are validation blockers and must never appear literally anywhere in the JSON, even in negated statements, warnings or quotes.",
            "Do not use IQ, kvocijent inteligencije, inteligentan, neinteligentan, nadaren, iznadprosjecan, ispodprosjecan, prosjecan u populaciji, percentile, percentil, norma, norme, normativno, normativna poredjenja or normativno poredjenje.",
            'When describing limits, use safe wording such as "u okviru ovog seta zadataka", "ne koristiti za rangiranje osobe u odnosu na druge", "ne citati kao poredjenje sa sirom populacijom" and "citajte kao signal iz ove procjene".',
            "Do not use hire/no-hire recommendations, hiring score, preporucuje se zaposljavanje, ne preporucuje se zaposljavanje, slab kandidat, idealni kandidat, los fit, red flag or rizican kandidat.",
            "Do not use diagnostic, clinical or fixed-ability language.",
            "Do not mention AI.",
          ],
          output_validation_rule:
            "Output must satisfy the provided SAFRAN HR JSON schema exactly.",
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

    if (isMwmsHrPromptInput(input.promptInput)) {
      return JSON.stringify({
        instructions: {
          output_contract:
            "Return one MWMS HR report in contractVersion and reportType mwms_hr_report_v1.",
          audience_behavior:
            "Write in the locale from input.locale for an HR professional. Keep the tone concise, operational and careful.",
          source_rule:
            "Use only the provided deterministic MWMS input. Do not use participant report text, raw answers, item-level data, other tests or any profile outside this input.",
          score_integrity_rule:
            "Copy every dimension code, label, rawScore, band and bandLabel exactly from input.dimensions into motivation_profile_snapshot.dimensions. Copy derivedProfile exactly from input. Do not calculate, infer, rename, round, reorder or replace those values.",
          single_test_rule:
            "This is a single-test MWMS report. Do not connect it with other assessments, composite profiles, role models or organization-specific context not present in the input.",
          interpretation_rule:
            "Frame narrative text as cautious HR hypotheses for engagement, interview, onboarding and manager support. Use practical wording such as moze biti korisno provjeriti, vrijedi istraziti, u razgovoru provjeriti and citati kao motivacijski profil.",
          structure_rules: [
            "Return valid JSON only.",
            "Keep identity fields exact: contractVersion mwms_hr_report_v1, reportType mwms_hr_report_v1, testSlug mwms_v1, audience hr, sourceType single_test.",
            "meta.language must match input.locale.",
            "motivation_profile_snapshot.scale must be min 1 and max 7.",
            "motivation_profile_snapshot.dimensions must contain exactly the six input dimensions and must preserve each code, label, rawScore, band and bandLabel exactly.",
            "motivation_profile_snapshot.derivedProfile must preserve all scores, dominantDimensions, lowerDimensions and cautionFlags exactly.",
            "key_motivational_drivers must contain exactly 3 items.",
            "potential_friction_points must contain exactly 3 items.",
            "work_context_hypotheses must contain exactly 3 items.",
            "manager_support_guidance must contain exactly 4 items.",
            "interview_questions must contain exactly 5 items.",
            "onboarding_recommendations must contain exactly 4 items.",
            "decision_support_note must contain 2 or 3 short items.",
            "safety_checks values must all be true.",
          ],
          content_rules: [
            "Focus on engagement, interview checks, onboarding needs, manager support and possible motivation friction.",
            "Do not make a selection verdict, ranking, fit score or performance forecast.",
            "Do not use clinical, medical or fixed-trait language.",
            "Do not claim the result proves motivation or causes future behavior.",
            "Do not mention other assessment names, composite reporting, protected attributes, AI or model limitations.",
            "Keep all generated text short and HR-operational.",
          ],
          output_validation_rule:
            "Output must satisfy the provided MWMS HR JSON schema and runtime validator with expected input score and band checks.",
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
  const basePrompt = input.promptTemplate?.systemPrompt ?? buildDefaultSystemPrompt(input);
  const cleanedPrompt = applyIpipHrPromptAuthorityCleanup(input, basePrompt);

  if (!isSafranHrPromptInput(input.promptInput)) {
    return cleanedPrompt;
  }

  return `${cleanedPrompt}\n\n${buildSafranHrMandatoryPromptGuardrails()}`;
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

function buildIpipNeo120HrDomainOverviewOrderInstruction(): string {
  return `Use exactly 5 domain_overview items in this order: ${getIpipNeo120HrDomainLabelsInOrder().join(", ")}.`;
}

function buildIpipNeo120HrTerminologyAuthorityBlock(): string {
  return [
    "IPIP-NEO-120 HR terminology authority rules:",
    'For Big Five Agreeableness, use only the label/title/domain form "Spremnost na saradnju".',
    'Inside narrative sentences, use only the sentence form "spremnost na saradnju".',
    'Do not use "Ugodnost", "ugodnost", "Saradljivost", "saradljivost", "Kooperativnost", "kooperativnost", "Saradnički profil" or "saradnički profil" anywhere in user-facing report text.',
    'Do not use English user-facing terms "overuse", "Overuse", "handling" or "Handling" anywhere in user-facing report text.',
    'Use BHS-safe wording such as "prekomjerno oslanjanje", "rizici prekomjernog oslanjanja", "upravljanje", "postupanje", "nošenje sa" or "način upravljanja".',
    'Schema keys such as "strengths_and_overuse_risks", "possible_overuse_risks" and "hr_handling_tip" may remain unchanged because they are contract keys; their string values must use BHS terminology.',
    'The ordinary word "saradnja" is allowed when discussing cooperation, teamwork and relationships; the forbidden shorthand labels above are not allowed.',
  ].join("\n");
}

function applyIpipHrPromptAuthorityCleanup(
  input: PreparedReportGenerationInput,
  promptText: string,
): string {
  if (!isIpipNeo120HrPromptInput(input.promptInput) || input.testSlug !== "ipip-neo-120-v1") {
    return promptText;
  }

  const languagePolicy = resolveAiReportLanguagePolicy(getPromptInputLocale(input.promptInput));

  const cleanedPrompt = promptText
    .replace(
      /Use exactly 5 domain_overview items in this order:[^.]+\./g,
      buildIpipNeo120HrDomainOverviewOrderInstruction(),
    )
    .replace(
      /Use 2 to 3 strengths_and_overuse_risks items[^.]+\./g,
      buildIpipNeo120HrStrengthsAndRisksInstruction(),
    )
    .replace(
      /Koristi 2 do 3 strengths_and_overuse_risks stavke[^.]+\./g,
      "Koristi 2 do 3 stavke za snage i moguće rizike prekomjernog oslanjanja. Svaka stavka treba imati tačno 3 moguće snage i tačno 3 moguća rizika prekomjernog oslanjanja.",
    )
    .replace(/Snage i mogući overuse rizici/g, "Snage i mogući rizici prekomjernog oslanjanja")
    .replace(/Mogući overuse rizici/g, "Mogući rizici prekomjernog oslanjanja")
    .replace(/HR handling tip/g, "HR smjernica za postupanje")
    .replace(/HR Handling Tip/g, "HR smjernica za postupanje")
    .replace(/\bpossible overuse risks\b/gi, "mogući rizici prekomjernog oslanjanja")
    .replace(/\boveruse risks\b/gi, "rizici prekomjernog oslanjanja")
    .replace(/\boveruse risk\b/gi, "rizik prekomjernog oslanjanja")
    .replace(/\bhandling\b/gi, (match) => (match[0] === "H" ? "Postupanje" : "postupanje"));

  const blocks = [applyIpipNeo120HrTerminologyCleanup(cleanedPrompt)];

  if (languagePolicy) {
    blocks.push(
      languagePolicy.buildPromptPolicyBlock({
        audience: "hr",
        includeAuthorityOrder: true,
      }),
    );
  }

  blocks.push(buildIpipNeo120HrTerminologyAuthorityBlock());

  return blocks.join("\n\n");
}

export function buildUserPrompt(input: PreparedReportGenerationInput): string {
  if (resolveIpipNeo120ParticipantProviderMode(input) === "v2-single") {
    return buildDefaultUserPrompt(input);
  }

  const basePrompt = !input.promptTemplate
    ? buildDefaultUserPrompt(input)
    : applyPromptTemplate(input.promptTemplate.userPromptTemplate, input, input.promptTemplate);
  const cleanedPrompt = applyIpipHrPromptAuthorityCleanup(input, basePrompt);

  if (!isSafranHrPromptInput(input.promptInput)) {
    return cleanedPrompt;
  }

  return `${cleanedPrompt}\n\n${buildSafranHrMandatoryPromptGuardrails()}`;
}

function parseStructuredContent(content: string): unknown {
  return JSON.parse(content) as unknown;
}

export function resolveOpenAiResponseFormatSchemaForInput(
  input: PreparedReportGenerationInput,
): Record<string, unknown> {
  if (resolveIpipNeo120ParticipantProviderMode(input) === "v2-single") {
    return ipipNeo120ParticipantReportV2OpenAiSchema as Record<string, unknown>;
  }

  if (isMwmsParticipantPromptInput(input.promptInput)) {
    return mwmsParticipantReportV1OpenAiSchema as Record<string, unknown>;
  }

  if (isMwmsHrPromptInput(input.promptInput)) {
    return mwmsHrReportV1OpenAiSchema as Record<string, unknown>;
  }

  if (isSafranParticipantPromptInput(input.promptInput)) {
    return safranParticipantAiReportV1OpenAiSchema as Record<string, unknown>;
  }

  if (isSafranHrPromptInput(input.promptInput)) {
    return safranHrReportV1OpenAiSchema as Record<string, unknown>;
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
  input: PreparedReportGenerationInput,
  options: OpenAiProviderOptions,
  payload: {
    label: string;
    schemaName: string;
    schema: Record<string, unknown>;
    systemPrompt: string;
    userPrompt: string;
    authorityMetadata?: SingleTestHrPromptAuthorityMetadata | null;
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
    const { requestBody } = buildOpenAiStructuredRequestPayload(input, options, payload);

    await maybeWriteAiReportDebugDump(
      input,
      {
        provider: "openai",
        systemPrompt: payload.systemPrompt,
        renderedUserPrompt: payload.userPrompt,
        requestBody,
        model: requestBody.model,
        authorityMetadata: payload.authorityMetadata,
      },
      {
        redactValues: [options.apiKey],
      },
    );

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(requestBody),
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
  const overviewSegment = await requestOpenAiStructuredJson(input, options, {
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
    const domainSegment = await requestOpenAiStructuredJson(input, options, {
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
  const practicalSegment = await requestOpenAiStructuredJson(input, options, {
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

export function validateStructuredReport(
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
    const languagePolicy = resolveAiReportLanguagePolicy(getPromptInputLocale(input.promptInput));
    const globalCanonicalizedReport = languagePolicy
      ? languagePolicy.canonicalizeUserFacingOutput(report)
      : report;
    const canonicalizedReport = canonicalizeIpipNeo120HrReportTerminology(globalCanonicalizedReport);
    const globalValidationErrors = languagePolicy
      ? languagePolicy.validateUserFacingOutput(canonicalizedReport, {
          audience: "hr",
        })
      : [];

    if (globalValidationErrors.length > 0) {
      throw new Error(
        `OpenAI response JSON failed global BHS HR output validation: ${globalValidationErrors
          .map((error) => `${error.path}: ${error.message}`)
          .join(" | ")}`,
      );
    }

    const validationResult = validateIpipNeo120HrReportV1(canonicalizedReport, {
      strictContract: true,
      enforceGuardrails: true,
    });

    if (!validationResult.ok) {
      throw new Error(
        `OpenAI response JSON failed IPIP-NEO-120 HR report validation: ${formatIpipNeo120ReportValidationErrors(validationResult.errors)}`,
      );
    }

    return validationResult.value;
  }

  if (input.testSlug === "mwms_v1" && isMwmsParticipantPromptInput(input.promptInput)) {
    const languagePolicy = resolveAiReportLanguagePolicy(getPromptInputLocale(input.promptInput));
    const canonicalizedReport = languagePolicy
      ? languagePolicy.canonicalizeUserFacingOutput(report)
      : report;
    const globalValidationErrors = languagePolicy
      ? languagePolicy.validateUserFacingOutput(canonicalizedReport, {
          audience: "participant",
        })
      : [];

    if (globalValidationErrors.length > 0) {
      throw new Error(
        `OpenAI response JSON failed global BHS MWMS participant output validation: ${globalValidationErrors
          .map((error) => `${error.path}: ${error.message}`)
          .join(" | ")}`,
      );
    }

    const validationResult = validateMwmsParticipantReportV1(canonicalizedReport);

    if (!validationResult.ok) {
      throw new Error(
        `OpenAI response JSON failed MWMS participant report validation: ${formatMwmsParticipantReportV1ValidationErrors(validationResult.errors)}`,
      );
    }

    return validationResult.value;
  }

  if (input.testSlug === "mwms_v1" && isMwmsHrPromptInput(input.promptInput)) {
    const languagePolicy = resolveAiReportLanguagePolicy(getPromptInputLocale(input.promptInput));
    const canonicalizedReport = languagePolicy
      ? languagePolicy.canonicalizeUserFacingOutput(report)
      : report;
    const globalValidationErrors = languagePolicy
      ? languagePolicy.validateUserFacingOutput(canonicalizedReport, {
          audience: "hr",
        })
      : [];

    if (globalValidationErrors.length > 0) {
      throw new Error(
        `OpenAI response JSON failed global BHS MWMS HR output validation: ${globalValidationErrors
          .map((error) => `${error.path}: ${error.message}`)
          .join(" | ")}`,
      );
    }

    const validationResult = validateMwmsHrReportV1(canonicalizedReport, {
      expectedInput: input.promptInput,
    });

    if (!validationResult.ok) {
      throw new Error(
        `OpenAI response JSON failed MWMS HR report validation: ${formatMwmsHrReportValidationErrors(validationResult.errors)}`,
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

  if (input.testSlug === "safran_v1" && isSafranHrPromptInput(input.promptInput)) {
    const languagePolicy = resolveAiReportLanguagePolicy(getPromptInputLocale(input.promptInput));
    const canonicalizedReport = languagePolicy
      ? languagePolicy.canonicalizeUserFacingOutput(report)
      : report;
    const globalValidationErrors = languagePolicy
      ? languagePolicy.validateUserFacingOutput(canonicalizedReport, {
          audience: "hr",
        })
      : [];

    if (globalValidationErrors.length > 0) {
      throw new Error(
        `OpenAI response JSON failed global BHS SAFRAN HR output validation: ${globalValidationErrors
          .map((error) => `${error.path}: ${error.message}`)
          .join(" | ")}`,
      );
    }

    const validationResult = validateSafranHrReport(canonicalizedReport, {
      expectedInput: input.promptInput,
    });

    if (!validationResult.ok) {
      throw new Error(
        `OpenAI response JSON failed SAFRAN HR report validation: ${formatSafranHrReportValidationErrors(validationResult.errors)}`,
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
            await requestOpenAiStructuredJson(input, options, {
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
