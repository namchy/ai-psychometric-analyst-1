import type { AssessmentLocale } from "@/lib/assessment/locale";
import {
  MWMS_V1_TEST_SLUG,
  type MwmsDimensionCode,
} from "@/lib/assessment/mwms-scoring";
import mwmsParticipantReportV1SchemaJson from "@/lib/assessment/schemas/mwms-participant-report-v1.json";
import type { ScoringMethod } from "@/lib/assessment/types";

export const MWMS_REPORT_TYPE = "individual";
export const MWMS_REPORT_SOURCE_TYPE = "single_test";
export const MWMS_TEST_FAMILY = "mwms";
export const MWMS_PARTICIPANT_PROMPT_KEY = "mwms_participant_report_v1";

export type MwmsDimensionPromptInput = {
  code: MwmsDimensionCode;
  label: string;
  raw_score: number;
  short_description: string;
};

export type MwmsParticipantReportPromptInput = {
  test_slug: typeof MWMS_V1_TEST_SLUG;
  report_type: typeof MWMS_REPORT_TYPE;
  audience: "participant";
  attempt_id: string;
  test_id: string;
  locale: AssessmentLocale;
  scoring_method: ScoringMethod;
  prompt_version: string;
  scale: {
    min: 1;
    max: 7;
  };
  dimensions: MwmsDimensionPromptInput[];
  derived_profile: {
    autonomous_motivation_score: number;
    controlled_motivation_score: number;
    amotivation_score: number;
    dominant_dimensions: MwmsDimensionCode[];
    lower_dimensions: MwmsDimensionCode[];
    caution_flags: {
      elevated_amotivation: boolean;
      high_controlled_relative_to_autonomous: boolean;
      mixed_profile: boolean;
    };
  };
  guardrails: [
    "no_hiring_decision",
    "no_diagnosis",
    "no_total_score",
    "no_percentile",
    "interpret_as_profile",
    "use_as_conversation_starting_point",
  ];
};

export const MWMS_PARTICIPANT_REPORT_CONTRACT = {
  family: MWMS_TEST_FAMILY,
  reportType: MWMS_REPORT_TYPE,
  sourceType: MWMS_REPORT_SOURCE_TYPE,
  promptKey: MWMS_PARTICIPANT_PROMPT_KEY,
  schemaId: "mwms-participant-report-v1",
  schemaPath: "@/lib/assessment/schemas/mwms-participant-report-v1.json",
  outputSchemaJson: mwmsParticipantReportV1SchemaJson,
} as const;

export function isMwmsTestSlug(testSlug: string): boolean {
  return testSlug === MWMS_V1_TEST_SLUG;
}
