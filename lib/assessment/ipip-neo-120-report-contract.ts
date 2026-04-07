import type { AssessmentLocale } from "@/lib/assessment/locale";
import ipipNeo120ParticipantSchemaJson from "@/lib/assessment/schemas/ipip-neo-120-participant-v1.json";
import type { ScoringMethod } from "@/lib/assessment/types";
import {
  IPIP_NEO_120_TEST_FAMILY,
  IPIP_NEO_120_TEST_SLUG,
  type IpipNeo120DomainCode,
  type IpipNeo120FacetCode,
} from "@/lib/assessment/ipip-neo-120-labels";

export const IPIP_NEO_120_REPORT_TYPE = "individual";
export const IPIP_NEO_120_REPORT_SOURCE_TYPE = "single_test";
export const IPIP_NEO_120_PARTICIPANT_PROMPT_KEY = "ipip_neo_120_participant_v1";

export type IpipNeo120ParticipantReportBand = "lower" | "balanced" | "higher";

export type IpipNeo120ParticipantPromptSubdimension = {
  facet_code: IpipNeo120FacetCode;
  label: string;
  score: number;
  band: IpipNeo120ParticipantReportBand;
};

export type IpipNeo120ParticipantPromptDomain = {
  domain_code: IpipNeo120DomainCode;
  label: string;
  score: number;
  band: IpipNeo120ParticipantReportBand;
  subdimensions: IpipNeo120ParticipantPromptSubdimension[];
};

export type IpipNeo120ParticipantReportPromptInput = {
  attempt_id: string;
  test_id: string;
  test_slug: typeof IPIP_NEO_120_TEST_SLUG;
  test_name: string;
  test_family: typeof IPIP_NEO_120_TEST_FAMILY;
  audience: "participant";
  locale: AssessmentLocale;
  scoring_method: ScoringMethod;
  prompt_version: string;
  scored_response_count: number;
  scale_hint: {
    min: 1;
    max: 5;
    display_mode: "visual_with_discreet_numeric_support";
  };
  domains: IpipNeo120ParticipantPromptDomain[];
  deterministic_summary: {
    highest_domain: IpipNeo120DomainCode | null;
    lowest_domain: IpipNeo120DomainCode | null;
    ranked_domains: IpipNeo120DomainCode[];
    top_subdimensions: IpipNeo120FacetCode[];
  };
};

export type IpipNeo120ParticipantSchemaReference = {
  audience: "participant";
  schemaId: "ipip-neo-120-participant-v1";
  schemaPath: "@/lib/assessment/schemas/ipip-neo-120-participant-v1.json";
  outputSchemaJson: typeof ipipNeo120ParticipantSchemaJson;
  promptKey: typeof IPIP_NEO_120_PARTICIPANT_PROMPT_KEY;
};

export type IpipNeo120PromptContractDefinition = IpipNeo120ParticipantSchemaReference & {
  reportType: typeof IPIP_NEO_120_REPORT_TYPE;
  sourceType: typeof IPIP_NEO_120_REPORT_SOURCE_TYPE;
  testFamily: typeof IPIP_NEO_120_TEST_FAMILY;
  audienceGuidance:
    "Focus on a participant-facing Big Five narrative with 5 domains as the primary layer and 30 poddimenzije as the secondary layer.";
};

export const IPIP_NEO_120_PARTICIPANT_REPORT_CONTRACT: IpipNeo120PromptContractDefinition = {
  audience: "participant",
  reportType: IPIP_NEO_120_REPORT_TYPE,
  sourceType: IPIP_NEO_120_REPORT_SOURCE_TYPE,
  testFamily: IPIP_NEO_120_TEST_FAMILY,
  promptKey: IPIP_NEO_120_PARTICIPANT_PROMPT_KEY,
  schemaId: "ipip-neo-120-participant-v1",
  schemaPath: "@/lib/assessment/schemas/ipip-neo-120-participant-v1.json",
  outputSchemaJson: ipipNeo120ParticipantSchemaJson,
  audienceGuidance:
    "Focus on a participant-facing Big Five narrative with 5 domains as the primary layer and 30 poddimenzije as the secondary layer.",
};
