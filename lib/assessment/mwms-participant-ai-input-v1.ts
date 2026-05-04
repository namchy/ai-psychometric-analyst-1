import type { CompletedAssessmentReportRequest } from "@/lib/assessment/report-providers";
import {
  MWMS_DIMENSION_CODES,
  type MwmsDimensionCode,
} from "@/lib/assessment/mwms-scoring";
import type { MwmsParticipantReportPromptInput } from "@/lib/assessment/mwms-report-contract";
import { formatDimensionLabel } from "@/lib/assessment/result-display";

const MWMS_DIMENSION_DESCRIPTIONS: Record<MwmsDimensionCode, string> = {
  amotivation:
    "Signal slabije povezanosti između posla, ličnog smisla i očekivanog napora.",
  external_social:
    "Motivacija vezana za društvena očekivanja, priznanje, odobravanje ili pritisak drugih.",
  external_material:
    "Motivacija vezana za materijalne ishode, nagrade, sigurnost ili praktične vanjske koristi.",
  introjected:
    "Motivacija koja dolazi iz unutrašnjeg pritiska, osjećaja obaveze, krivice ili potrebe da se ispune očekivanja.",
  identified:
    "Motivacija zasnovana na prepoznavanju vrijednosti, svrhe ili važnosti posla.",
  intrinsic:
    "Motivacija zasnovana na interesu, zadovoljstvu, radoznalosti ili unutrašnjem angažmanu u samom radu.",
};

const MWMS_GUARDRAILS: MwmsParticipantReportPromptInput["guardrails"] = [
  "no_hiring_decision",
  "no_diagnosis",
  "no_total_score",
  "no_percentile",
  "interpret_as_profile",
  "use_as_conversation_starting_point",
];

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function getDimensionScoreMap(input: CompletedAssessmentReportRequest): Map<string, number> {
  return new Map(input.results.dimensions.map((dimension) => [dimension.dimension, dimension.rawScore]));
}

function requireMwmsScore(scoreByDimension: Map<string, number>, dimensionCode: MwmsDimensionCode): number {
  const score = scoreByDimension.get(dimensionCode);

  if (typeof score !== "number" || !Number.isFinite(score) || score < 1 || score > 7) {
    throw new Error(`MWMS AI input requires ${dimensionCode} raw_score between 1 and 7.`);
  }

  return roundScore(score);
}

function getRankedDimensions(dimensions: MwmsParticipantReportPromptInput["dimensions"]) {
  return [...dimensions].sort(
    (left, right) => right.raw_score - left.raw_score || left.code.localeCompare(right.code),
  );
}

export function buildMwmsParticipantReportPromptInput(
  input: CompletedAssessmentReportRequest,
): MwmsParticipantReportPromptInput {
  if (input.testSlug !== "mwms_v1") {
    throw new Error(`MWMS participant AI input cannot be built for ${input.testSlug}.`);
  }

  if (input.audience !== "participant") {
    throw new Error("MWMS participant AI input supports only participant audience.");
  }

  const scoreByDimension = getDimensionScoreMap(input);
  const dimensions = MWMS_DIMENSION_CODES.map((dimensionCode) => ({
    code: dimensionCode,
    label: formatDimensionLabel(dimensionCode),
    raw_score: requireMwmsScore(scoreByDimension, dimensionCode),
    short_description: MWMS_DIMENSION_DESCRIPTIONS[dimensionCode],
  }));
  const score = (dimensionCode: MwmsDimensionCode) =>
    dimensions.find((dimension) => dimension.code === dimensionCode)?.raw_score ?? 0;
  const autonomousMotivationScore = roundScore((score("identified") + score("intrinsic")) / 2);
  const controlledMotivationScore = roundScore(
    (score("introjected") + score("external_social") + score("external_material")) / 3,
  );
  const rankedDimensions = getRankedDimensions(dimensions);
  const ascendingDimensions = [...rankedDimensions].reverse();

  return {
    test_slug: "mwms_v1",
    report_type: "individual",
    audience: "participant",
    attempt_id: input.attemptId,
    test_id: input.testId,
    locale: input.locale,
    scoring_method: input.scoringMethod,
    prompt_version: input.promptVersion,
    scale: {
      min: 1,
      max: 7,
    },
    dimensions,
    derived_profile: {
      autonomous_motivation_score: autonomousMotivationScore,
      controlled_motivation_score: controlledMotivationScore,
      amotivation_score: score("amotivation"),
      dominant_dimensions: rankedDimensions.slice(0, 2).map((dimension) => dimension.code),
      lower_dimensions: ascendingDimensions.slice(0, 2).map((dimension) => dimension.code),
      caution_flags: {
        elevated_amotivation: score("amotivation") >= 5,
        high_controlled_relative_to_autonomous:
          controlledMotivationScore - autonomousMotivationScore >= 0.75,
        mixed_profile: autonomousMotivationScore >= 4.5 && controlledMotivationScore >= 4.5,
      },
    },
    guardrails: MWMS_GUARDRAILS,
  };
}

export function validateMwmsParticipantReportPromptInput(
  value: unknown,
): { ok: true; value: MwmsParticipantReportPromptInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const input = value as Partial<MwmsParticipantReportPromptInput>;

  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["<root>: Expected object."] };
  }

  if (input.test_slug !== "mwms_v1") errors.push("test_slug: Expected mwms_v1.");
  if (input.report_type !== "individual") errors.push("report_type: Expected individual.");
  if (input.audience !== "participant") errors.push("audience: Expected participant.");
  if (input.scale?.min !== 1 || input.scale?.max !== 7) {
    errors.push("scale: Expected min=1 and max=7.");
  }

  if (!Array.isArray(input.dimensions) || input.dimensions.length !== 6) {
    errors.push("dimensions: Expected exactly 6 dimensions.");
  } else {
    const codes = new Set(input.dimensions.map((dimension) => dimension.code));

    for (const dimensionCode of MWMS_DIMENSION_CODES) {
      if (!codes.has(dimensionCode)) {
        errors.push(`dimensions: Missing ${dimensionCode}.`);
      }
    }

    for (const dimension of input.dimensions) {
      if (
        typeof dimension.raw_score !== "number" ||
        !Number.isFinite(dimension.raw_score) ||
        dimension.raw_score < 1 ||
        dimension.raw_score > 7
      ) {
        errors.push(`dimensions.${dimension.code}: raw_score must be between 1 and 7.`);
      }
    }
  }

  if (!input.derived_profile) {
    errors.push("derived_profile: Expected object.");
  }

  if (!Array.isArray(input.guardrails) || input.guardrails.length !== MWMS_GUARDRAILS.length) {
    errors.push("guardrails: Expected canonical MWMS guardrails.");
  }

  return errors.length === 0
    ? { ok: true, value: value as MwmsParticipantReportPromptInput }
    : { ok: false, errors };
}
