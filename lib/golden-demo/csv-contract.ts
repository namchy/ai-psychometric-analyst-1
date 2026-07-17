export const GOLDEN_DEMO_FIXTURE_RELATIVE_PATH =
  "fixtures/golden-demo/partner-plus/v1";

export const GOLDEN_DEMO_CSV_FILES = {
  candidates: "candidates.csv",
  answers: "answers.csv",
  expectedScores: "expected-scores.csv",
  expectedAiFindings: "expected-ai-findings.csv",
} as const;

export const GOLDEN_DEMO_CSV_HEADERS = {
  candidates: [
    "candidate_id",
    "display_name",
    "job_title",
    "team_id",
    "cohort_segment",
    "participant_type",
    "addressing_form",
    "email",
    "data_status",
  ],
  answers: [
    "candidate_id",
    "test_slug",
    "question_code",
    "response_kind",
    "answer_value",
    "answer_option_code",
    "recipe_note",
    "recipe_version",
  ],
  expectedScores: [
    "candidate_id",
    "test_slug",
    "score_scope",
    "score_key",
    "expected_value",
    "tolerance",
    "expected_band",
    "required",
    "expectation_version",
  ],
  expectedAiFindings: [
    "candidate_id",
    "report_lane",
    "finding_key",
    "expectation_type",
    "statement",
    "required",
    "expectation_version",
  ],
} as const;

export const GOLDEN_DEMO_CANDIDATE_IDS = Array.from(
  { length: 24 },
  (_, index) => `GD-${String(index + 1).padStart(3, "0")}`,
);

export const GOLDEN_DEMO_TEAM_IDS = [
  "GDT-01",
  "GDT-02",
  "GDT-03",
  "GDT-04",
] as const;

export const GOLDEN_DEMO_TEST_SLUGS = [
  "ipip-neo-120-v1",
  "mwms_v1",
  "safran_v1",
] as const;

export const GOLDEN_DEMO_COHORT_SEGMENTS = ["development", "holdout"] as const;
export const GOLDEN_DEMO_PARTICIPANT_TYPES = ["employee"] as const;
export const GOLDEN_DEMO_ADDRESSING_FORMS = ["masculine", "feminine"] as const;
export const GOLDEN_DEMO_DATA_STATUSES = [
  "identity_only",
  "profile_defined",
  "answers_ready",
  "scores_verified",
  "reports_generated",
  "demo_ready",
] as const;
export const GOLDEN_DEMO_RESPONSE_KINDS = ["single_choice", "text"] as const;
export const GOLDEN_DEMO_SCORE_SCOPES = [
  "persisted_dimension",
  "derived_domain",
  "derived_composite",
  "derived_component",
] as const;
export const GOLDEN_DEMO_REPORT_LANES = [
  "ipip_participant",
  "ipip_hr",
  "mwms_participant",
  "mwms_hr",
  "safran_participant",
  "safran_hr",
  "composite_hr",
  "individual_development_profile",
] as const;
export const GOLDEN_DEMO_EXPECTATION_TYPES = [
  "required_signal",
  "forbidden_claim",
  "required_score_reference",
  "required_recommendation",
  "known_ambiguity",
] as const;

export const IPIP_PERSISTED_DIMENSIONS = [
  "ANXIETY",
  "ANGER",
  "DEPRESSION",
  "SELF_CONSCIOUSNESS",
  "IMMODERATION",
  "VULNERABILITY",
  "FRIENDLINESS",
  "GREGARIOUSNESS",
  "ASSERTIVENESS",
  "ACTIVITY_LEVEL",
  "EXCITEMENT_SEEKING",
  "CHEERFULNESS",
  "IMAGINATION",
  "ARTISTIC_INTERESTS",
  "EMOTIONALITY",
  "ADVENTUROUSNESS",
  "INTELLECT",
  "LIBERALISM",
  "TRUST",
  "MORALITY",
  "ALTRUISM",
  "COOPERATION",
  "MODESTY",
  "SYMPATHY",
  "SELF_EFFICACY",
  "ORDERLINESS",
  "DUTIFULNESS",
  "ACHIEVEMENT_STRIVING",
  "SELF_DISCIPLINE",
  "CAUTIOUSNESS",
] as const;

export const IPIP_DERIVED_DOMAINS = [
  "EXTRAVERSION",
  "AGREEABLENESS",
  "CONSCIENTIOUSNESS",
  "NEUROTICISM",
  "OPENNESS_TO_EXPERIENCE",
] as const;

export const MWMS_PERSISTED_DIMENSIONS = [
  "amotivation",
  "external_social",
  "external_material",
  "introjected",
  "identified",
  "intrinsic",
] as const;

export const MWMS_DERIVED_COMPOSITES = [
  "autonomous_motivation",
  "controlled_motivation",
] as const;

export const SAFRAN_PERSISTED_DIMENSIONS = [
  "verbal_score",
  "figural_score",
  "numerical_series_score",
  "cognitive_composite_v1",
] as const;

export const SAFRAN_DERIVED_COMPONENTS = ["numerical_raw_score"] as const;

export const GOLDEN_DEMO_BANDS_BY_TEST = {
  "ipip-neo-120-v1": ["lower", "balanced", "higher"],
  mwms_v1: ["lower", "moderate", "higher"],
  safran_v1: ["lower_raw", "moderate_raw", "higher_raw"],
} as const;

export type GoldenDemoTestSlug = (typeof GOLDEN_DEMO_TEST_SLUGS)[number];
export type GoldenDemoScoreScope = (typeof GOLDEN_DEMO_SCORE_SCOPES)[number];
export type GoldenDemoResponseKind = (typeof GOLDEN_DEMO_RESPONSE_KINDS)[number];
export type GoldenDemoReportLane = (typeof GOLDEN_DEMO_REPORT_LANES)[number];

export type GoldenDemoCsvRow = {
  rowNumber: number;
  columnCount: number;
  values: Record<string, string>;
};

export type GoldenDemoCsvDocument = {
  file: string;
  headers: string[];
  rows: GoldenDemoCsvRow[];
};

export type GoldenDemoCsvFoundation = {
  candidates: GoldenDemoCsvDocument;
  answers: GoldenDemoCsvDocument;
  expectedScores: GoldenDemoCsvDocument;
  expectedAiFindings: GoldenDemoCsvDocument;
};

export type GoldenDemoQuestionContract = {
  code: string;
  responseKind: GoldenDemoResponseKind;
  optionCodes: Set<string>;
};

export type GoldenDemoTestContract = {
  slug: GoldenDemoTestSlug;
  questions: Map<string, GoldenDemoQuestionContract>;
};

export type GoldenDemoRepoContract = {
  tests: Map<GoldenDemoTestSlug, GoldenDemoTestContract>;
};

export type GoldenDemoValidationIssue = {
  code: string;
  file: string;
  row?: number;
  column?: string;
  message: string;
};

export type GoldenDemoValidationResult = {
  ok: boolean;
  errors: GoldenDemoValidationIssue[];
  warnings: GoldenDemoValidationIssue[];
  summary: {
    candidateCount: number;
    developmentCount: number;
    holdoutCount: number;
    teamCounts: Record<string, number>;
    answerCount: number;
    expectedScoreCount: number;
    expectedAiFindingCount: number;
  };
};

export type GoldenDemoCandidateInspection = {
  candidate: {
    candidateId: string;
    displayName: string;
    email: string;
    teamId: string;
    cohortSegment: string;
    dataStatus: string;
  };
  answerCountByTest: Record<GoldenDemoTestSlug, number>;
  expectedScoreCountByTest: Record<GoldenDemoTestSlug, number>;
  expectedAiFindingCountByReportLane: Record<GoldenDemoReportLane, number>;
};
