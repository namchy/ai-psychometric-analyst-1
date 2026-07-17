import fs from "node:fs";
import path from "node:path";
import {
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
  type IpipNeo120DomainCode,
} from "../assessment/ipip-neo-120-labels";
import { scoreMwmsV1Responses } from "../assessment/mwms-scoring";
import {
  GOLDEN_DEMO_FIXTURE_RELATIVE_PATH,
  GOLDEN_DEMO_REPORT_LANES,
  GOLDEN_DEMO_TEST_SLUGS,
  type GoldenDemoCsvFoundation,
  type GoldenDemoReportLane,
  type GoldenDemoScoreScope,
  type GoldenDemoTestSlug,
} from "./csv-contract";

export const GD_001_EXPECTED_QUESTION_COUNTS = {
  "ipip-neo-120-v1": 120,
  mwms_v1: 19,
  safran_v1: 45,
} as const;

type PackageItem = {
  code: string;
  question_order: number;
  mappings: Array<{
    dimension_code: string;
    reverse_scored: boolean;
  }>;
};

type PackageOption = { code: string; value: number };

type SafranItem = {
  item_id: string;
  subtest_code: "VW" | "VA" | "FA" | "FM" | "NZ";
  renderer_type: "text_choice" | "image_choice" | "numeric_input";
  display_order: number;
  options?: Array<{ option_id: string; is_correct: boolean }>;
  correct_answer_display: string;
};

export type GoldenDemoComputedScore = {
  candidateId: string;
  testSlug: GoldenDemoTestSlug;
  scoreScope: GoldenDemoScoreScope;
  scoreKey: string;
  value: number;
  band: string;
};

export type Gd001VerificationError = {
  code: string;
  message: string;
  testSlug?: GoldenDemoTestSlug;
  scoreKey?: string;
};

export type Gd001OfflineScoreVerification = {
  ok: boolean;
  candidateId: "GD-001";
  errors: Gd001VerificationError[];
  targetProfileSummary: string;
  answers: {
    total: number;
    byTest: Record<GoldenDemoTestSlug, number>;
    expectedByTest: Record<GoldenDemoTestSlug, number>;
    completeByTest: Record<GoldenDemoTestSlug, boolean>;
  };
  expectedScores: {
    total: number;
    matched: number;
    byTestAndScope: Record<string, number>;
  };
  expectedAiFindingsByLane: Record<GoldenDemoReportLane, number>;
  scores: GoldenDemoComputedScore[];
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function getIpipBand(averageScore: number): "lower" | "balanced" | "higher" {
  if (averageScore >= 3.67) return "higher";
  if (averageScore >= 2.34) return "balanced";
  return "lower";
}

function getMwmsBand(score: number): "lower" | "moderate" | "higher" {
  if (score < 3) return "lower";
  if (score < 5) return "moderate";
  return "higher";
}

function getSafranBand(
  scoreKey: string,
  score: number,
): "lower_raw" | "moderate_raw" | "higher_raw" {
  const isComposite = scoreKey === "cognitive_composite_v1";
  if (score <= (isComposite ? 18 : 6)) return "lower_raw";
  if (score <= (isComposite ? 36 : 12)) return "moderate_raw";
  return "higher_raw";
}

function pushError(
  errors: Gd001VerificationError[],
  code: string,
  message: string,
  details: Pick<Gd001VerificationError, "testSlug" | "scoreKey"> = {},
): void {
  errors.push({ code, message, ...details });
}

function requireUniqueAnswers(
  foundation: GoldenDemoCsvFoundation,
  testSlug: GoldenDemoTestSlug,
  expectedCodes: string[],
  errors: Gd001VerificationError[],
): Map<string, Record<string, string>> {
  const answers = foundation.answers.rows.filter(
    (row) => row.values.candidate_id === "GD-001" && row.values.test_slug === testSlug,
  );
  const answerByQuestion = new Map<string, Record<string, string>>();

  for (const row of answers) {
    const code = row.values.question_code ?? "";
    if (answerByQuestion.has(code)) {
      pushError(errors, "duplicate_answer", `Duplicate ${testSlug} answer for ${code}.`, {
        testSlug,
      });
    }
    answerByQuestion.set(code, row.values);
  }

  for (const code of expectedCodes) {
    if (!answerByQuestion.has(code)) {
      pushError(errors, "missing_answer", `Missing ${testSlug} answer for ${code}.`, {
        testSlug,
      });
    }
  }

  for (const code of answerByQuestion.keys()) {
    if (!expectedCodes.includes(code)) {
      pushError(errors, "unexpected_answer", `Unexpected ${testSlug} answer for ${code}.`, {
        testSlug,
      });
    }
  }

  return answerByQuestion;
}

function computeIpipScores(
  items: PackageItem[],
  options: PackageOption[],
  answerByQuestion: Map<string, Record<string, string>>,
  errors: Gd001VerificationError[],
): GoldenDemoComputedScore[] {
  const optionValueByCode = new Map(options.map((option) => [option.code, option.value]));
  const facetSums = new Map<string, number>();
  const facetCounts = new Map<string, number>();

  for (const item of items) {
    const answer = answerByQuestion.get(item.code);
    const mapping = item.mappings[0];
    if (!answer || !mapping) continue;
    const rawValue = optionValueByCode.get(answer.answer_option_code ?? "");
    if (rawValue === undefined) {
      pushError(errors, "invalid_option_code", `Cannot score IPIP option for ${item.code}.`, {
        testSlug: "ipip-neo-120-v1",
      });
      continue;
    }
    const scoredValue = mapping.reverse_scored ? 6 - rawValue : rawValue;
    facetSums.set(mapping.dimension_code, (facetSums.get(mapping.dimension_code) ?? 0) + scoredValue);
    facetCounts.set(mapping.dimension_code, (facetCounts.get(mapping.dimension_code) ?? 0) + 1);
  }

  const facetScores = Object.values(IPIP_NEO_120_FACETS_BY_DOMAIN)
    .flat()
    .map<GoldenDemoComputedScore>((facet) => {
      const value = facetSums.get(facet) ?? 0;
      const count = facetCounts.get(facet) ?? 0;
      return {
        candidateId: "GD-001",
        testSlug: "ipip-neo-120-v1",
        scoreScope: "persisted_dimension",
        scoreKey: facet,
        value,
        band: getIpipBand(count > 0 ? value / count : 0),
      };
    });

  const facetsByKey = new Map(facetScores.map((score) => [score.scoreKey, score.value]));
  const domainScores = IPIP_NEO_120_DOMAIN_ORDER.map<GoldenDemoComputedScore>((domain) => {
    const facets = IPIP_NEO_120_FACETS_BY_DOMAIN[domain];
    const total = facets.reduce((sum, facet) => sum + (facetsByKey.get(facet) ?? 0), 0);
    const value = roundScore(total / (facets.length * 4));
    return {
      candidateId: "GD-001",
      testSlug: "ipip-neo-120-v1",
      scoreScope: "derived_domain",
      scoreKey: domain,
      value,
      band: getIpipBand(value),
    };
  });

  return [...facetScores, ...domainScores];
}

function computeMwmsScores(
  options: PackageOption[],
  answerByQuestion: Map<string, Record<string, string>>,
  errors: Gd001VerificationError[],
): GoldenDemoComputedScore[] {
  const optionValueByCode = new Map(options.map((option) => [option.code, option.value]));
  const responses = Object.fromEntries(
    [...answerByQuestion].map(([questionCode, answer]) => [
      questionCode,
      optionValueByCode.get(answer.answer_option_code ?? "") ?? Number.NaN,
    ]),
  );
  const result = scoreMwmsV1Responses(responses);
  if (!result.isComplete) {
    pushError(errors, "mwms_scoring_incomplete", result.error.message, { testSlug: "mwms_v1" });
    return [];
  }

  const dimensions = Object.entries(result.dimensions).map<GoldenDemoComputedScore>(
    ([scoreKey, dimension]) => ({
      candidateId: "GD-001",
      testSlug: "mwms_v1",
      scoreScope: "persisted_dimension",
      scoreKey,
      value: dimension.score,
      band: getMwmsBand(dimension.score),
    }),
  );
  const composites = Object.entries(result.composites).map<GoldenDemoComputedScore>(
    ([scoreKey, composite]) => ({
      candidateId: "GD-001",
      testSlug: "mwms_v1",
      scoreScope: "derived_composite",
      scoreKey,
      value: composite.score,
      band: getMwmsBand(composite.score),
    }),
  );
  return [...dimensions, ...composites];
}

function computeSafranScores(
  items: SafranItem[],
  answerByQuestion: Map<string, Record<string, string>>,
  errors: Gd001VerificationError[],
): GoldenDemoComputedScore[] {
  const subtestScores = { VW: 0, VA: 0, FA: 0, FM: 0, NZ: 0 };

  for (const item of items) {
    const answer = answerByQuestion.get(item.item_id);
    if (!answer) continue;
    if (item.renderer_type === "numeric_input") {
      const response = answer.answer_value ?? "";
      if (!/^-?\d+(?:\.\d+)?$/.test(response)) {
        pushError(errors, "invalid_safran_numeric", `Invalid canonical numeric answer for ${item.item_id}.`, {
          testSlug: "safran_v1",
        });
        continue;
      }
      if (Math.abs(Number(response) - Number(item.correct_answer_display)) < 1e-9) {
        subtestScores.NZ += 1;
      }
      continue;
    }

    const selected = item.options?.find(
      (option) => option.option_id === answer.answer_option_code,
    );
    if (!selected) {
      pushError(errors, "invalid_option_code", `Cannot score SAFRAN option for ${item.item_id}.`, {
        testSlug: "safran_v1",
      });
    } else if (selected.is_correct) {
      subtestScores[item.subtest_code] += 1;
    }
  }

  // Mirrors buildSafranV1CompositeScores without importing scoring.ts, whose module also owns DB lifecycle code.
  const values = {
    verbal_score: subtestScores.VW + subtestScores.VA,
    figural_score: subtestScores.FA + subtestScores.FM,
    numerical_series_score: subtestScores.NZ * 2,
    cognitive_composite_v1:
      subtestScores.VW + subtestScores.VA + subtestScores.FA + subtestScores.FM + subtestScores.NZ * 2,
  };

  return Object.entries(values).map<GoldenDemoComputedScore>(([scoreKey, value]) => ({
    candidateId: "GD-001",
    testSlug: "safran_v1",
    scoreScope: "persisted_dimension",
    scoreKey,
    value,
    band: getSafranBand(scoreKey, value),
  }));
}

function compareExpectedScores(
  foundation: GoldenDemoCsvFoundation,
  scores: GoldenDemoComputedScore[],
  errors: Gd001VerificationError[],
): number {
  const expectedRows = foundation.expectedScores.rows.filter(
    (row) => row.values.candidate_id === "GD-001",
  );
  const actualByIdentity = new Map(
    scores.map((score) => [
      `${score.testSlug}\u0000${score.scoreScope}\u0000${score.scoreKey}`,
      score,
    ]),
  );
  let matched = 0;

  for (const row of expectedRows) {
    const value = row.values;
    const identity = `${value.test_slug}\u0000${value.score_scope}\u0000${value.score_key}`;
    const actual = actualByIdentity.get(identity);
    if (!actual) {
      pushError(errors, "missing_computed_score", `No computed score for ${value.score_key}.`, {
        testSlug: value.test_slug as GoldenDemoTestSlug,
        scoreKey: value.score_key,
      });
      continue;
    }
    const expectedValue = Number(value.expected_value);
    const tolerance = Number(value.tolerance);
    if (!Number.isFinite(expectedValue) || !Number.isFinite(tolerance)) continue;
    if (Math.abs(actual.value - expectedValue) > tolerance + 1e-9) {
      pushError(
        errors,
        "expected_score_mismatch",
        `Expected ${value.score_key}=${expectedValue} ± ${tolerance}, computed ${actual.value}.`,
        { testSlug: actual.testSlug, scoreKey: actual.scoreKey },
      );
      continue;
    }
    if (actual.band !== value.expected_band) {
      pushError(
        errors,
        "expected_band_mismatch",
        `Expected ${value.score_key} band ${value.expected_band}, computed ${actual.band}.`,
        { testSlug: actual.testSlug, scoreKey: actual.scoreKey },
      );
      continue;
    }
    matched += 1;
    actualByIdentity.delete(identity);
  }

  for (const actual of actualByIdentity.values()) {
    pushError(errors, "missing_expected_score", `Missing expected score for ${actual.scoreKey}.`, {
      testSlug: actual.testSlug,
      scoreKey: actual.scoreKey,
    });
  }
  return matched;
}

export function verifyGd001ExpectedScores(input: {
  foundation: GoldenDemoCsvFoundation;
  projectRoot?: string;
}): Gd001OfflineScoreVerification {
  const projectRoot = input.projectRoot ?? process.cwd();
  const errors: Gd001VerificationError[] = [];
  const ipipRoot = path.join(projectRoot, "assessment-packages/ipip-neo-120-v1");
  const mwmsRoot = path.join(projectRoot, "assessment-packages/mwms_v1");
  const ipipItems = readJson<PackageItem[]>(path.join(ipipRoot, "items.json"));
  const ipipOptions = readJson<PackageOption[]>(path.join(ipipRoot, "options.json"));
  const mwmsItems = readJson<PackageItem[]>(path.join(mwmsRoot, "items.json"));
  const mwmsOptions = readJson<PackageOption[]>(path.join(mwmsRoot, "options.json"));
  const safranItems = readJson<{ items: SafranItem[] }>(
    path.join(projectRoot, "safran_v1_seed.json"),
  ).items;
  const profile = readJson<{ target_profile_summary: string }>(
    path.join(
      projectRoot,
      GOLDEN_DEMO_FIXTURE_RELATIVE_PATH,
      "profiles/GD-001.profile.json",
    ),
  );

  const otherCandidateAnswers = input.foundation.answers.rows.filter(
    (row) => row.values.candidate_id !== "GD-001",
  );
  if (otherCandidateAnswers.length > 0) {
    pushError(errors, "unexpected_candidate_answer", "answers.csv may currently contain only GD-001 rows.");
  }

  const ipipAnswers = requireUniqueAnswers(
    input.foundation,
    "ipip-neo-120-v1",
    ipipItems.map((item) => item.code),
    errors,
  );
  const mwmsAnswers = requireUniqueAnswers(
    input.foundation,
    "mwms_v1",
    mwmsItems.map((item) => item.code),
    errors,
  );
  const safranAnswers = requireUniqueAnswers(
    input.foundation,
    "safran_v1",
    safranItems.map((item) => item.item_id),
    errors,
  );

  const scores = [
    ...computeIpipScores(ipipItems, ipipOptions, ipipAnswers, errors),
    ...computeMwmsScores(mwmsOptions, mwmsAnswers, errors),
    ...computeSafranScores(safranItems, safranAnswers, errors),
  ];
  const matched = compareExpectedScores(input.foundation, scores, errors);

  const gd001 = input.foundation.candidates.rows.find(
    (row) => row.values.candidate_id === "GD-001",
  );
  if (gd001?.values.data_status !== "answers_ready") {
    pushError(errors, "invalid_gd001_status", "GD-001 must use data_status=answers_ready.");
  }
  for (const row of input.foundation.candidates.rows) {
    if (row.values.candidate_id !== "GD-001" && row.values.data_status !== "identity_only") {
      pushError(errors, "invalid_other_candidate_status", `${row.values.candidate_id} must remain identity_only.`);
    }
  }

  const expectedAiFindingsByLane = Object.fromEntries(
    GOLDEN_DEMO_REPORT_LANES.map((lane) => [
      lane,
      input.foundation.expectedAiFindings.rows.filter(
        (row) => row.values.candidate_id === "GD-001" && row.values.report_lane === lane,
      ).length,
    ]),
  ) as Record<GoldenDemoReportLane, number>;
  for (const lane of GOLDEN_DEMO_REPORT_LANES) {
    const rows = input.foundation.expectedAiFindings.rows.filter(
      (row) => row.values.candidate_id === "GD-001" && row.values.report_lane === lane,
    );
    if (!rows.some((row) => row.values.expectation_type === "required_signal")) {
      pushError(errors, "missing_required_signal", `${lane} requires at least one required_signal.`);
    }
    if (!rows.some((row) => row.values.expectation_type === "forbidden_claim")) {
      pushError(errors, "missing_forbidden_claim", `${lane} requires at least one forbidden_claim.`);
    }
  }

  const byTest = Object.fromEntries(
    GOLDEN_DEMO_TEST_SLUGS.map((slug) => [
      slug,
      input.foundation.answers.rows.filter(
        (row) => row.values.candidate_id === "GD-001" && row.values.test_slug === slug,
      ).length,
    ]),
  ) as Record<GoldenDemoTestSlug, number>;
  const completeByTest = Object.fromEntries(
    GOLDEN_DEMO_TEST_SLUGS.map((slug) => [
      slug,
      byTest[slug] === GD_001_EXPECTED_QUESTION_COUNTS[slug],
    ]),
  ) as Record<GoldenDemoTestSlug, boolean>;
  const expectedRows = input.foundation.expectedScores.rows.filter(
    (row) => row.values.candidate_id === "GD-001",
  );
  const byTestAndScope: Record<string, number> = {};
  for (const row of expectedRows) {
    const key = `${row.values.test_slug}/${row.values.score_scope}`;
    byTestAndScope[key] = (byTestAndScope[key] ?? 0) + 1;
  }

  return {
    ok: errors.length === 0,
    candidateId: "GD-001",
    errors,
    targetProfileSummary: profile.target_profile_summary,
    answers: {
      total: Object.values(byTest).reduce((sum, count) => sum + count, 0),
      byTest,
      expectedByTest: { ...GD_001_EXPECTED_QUESTION_COUNTS },
      completeByTest,
    },
    expectedScores: {
      total: expectedRows.length,
      matched,
      byTestAndScope,
    },
    expectedAiFindingsByLane,
    scores,
  };
}
