import {
  TEAM_FIT_REPORT_V2_ACTION_OWNERS,
  TEAM_FIT_REPORT_V2_ASSESSMENT_CATEGORIES,
  TEAM_FIT_REPORT_V2_AUDIENCE,
  TEAM_FIT_REPORT_V2_EVIDENCE_SOURCES,
  TEAM_FIT_REPORT_V2_SOURCE_TYPE,
  TEAM_FIT_REPORT_V2_TYPE,
  TEAM_FIT_REPORT_V2_VERSION,
} from "@/lib/b2b/team-fit-report-v2-contract";

export const TEAM_FIT_REPORT_V2_SCHEMA_NAME = TEAM_FIT_REPORT_V2_TYPE;

export type TeamFitReportV2JsonSchema = Record<string, unknown>;

function nonEmptyStringSchema(): TeamFitReportV2JsonSchema {
  return { type: "string", minLength: 1, pattern: "\\S" };
}

function nullableStringSchema(): TeamFitReportV2JsonSchema {
  return { anyOf: [nonEmptyStringSchema(), { type: "null" }] };
}

function strictObjectSchema(
  properties: Record<string, TeamFitReportV2JsonSchema>,
): TeamFitReportV2JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}

function arraySchema(
  items: TeamFitReportV2JsonSchema,
  limits: { minItems?: number; maxItems?: number } = {},
): TeamFitReportV2JsonSchema {
  return {
    type: "array",
    items,
    ...limits,
  };
}

function stringArraySchema(
  limits: { minItems?: number; maxItems?: number } = {},
): TeamFitReportV2JsonSchema {
  return arraySchema(nonEmptyStringSchema(), limits);
}

function enumSchema(values: readonly string[]): TeamFitReportV2JsonSchema {
  return { type: "string", enum: [...values] };
}

function evidenceReferenceSchema(): TeamFitReportV2JsonSchema {
  return strictObjectSchema({
    source: enumSchema(TEAM_FIT_REPORT_V2_EVIDENCE_SOURCES),
    key: nonEmptyStringSchema(),
  });
}

function evidenceArraySchema(): TeamFitReportV2JsonSchema {
  return arraySchema(evidenceReferenceSchema(), { minItems: 2, maxItems: 6 });
}

function ownerSchema(): TeamFitReportV2JsonSchema {
  return enumSchema(TEAM_FIT_REPORT_V2_ACTION_OWNERS);
}

function ownedActionSchema(includeExpectedResult: boolean): TeamFitReportV2JsonSchema {
  return strictObjectSchema({
    action: nonEmptyStringSchema(),
    owner: ownerSchema(),
    timing: nonEmptyStringSchema(),
    ...(includeExpectedResult
      ? { expectedResult: nonEmptyStringSchema() }
      : {}),
  });
}

export function getTeamFitReportV2JsonSchema(): TeamFitReportV2JsonSchema {
  return strictObjectSchema({
    reportType: { type: "string", const: TEAM_FIT_REPORT_V2_TYPE },
    reportVersion: { type: "string", const: TEAM_FIT_REPORT_V2_VERSION },
    locale: nonEmptyStringSchema(),
    generatedAt: nonEmptyStringSchema(),
    inputSnapshotVersion: nonEmptyStringSchema(),
    teamFitReportVersion: { type: "string", const: TEAM_FIT_REPORT_V2_VERSION },
    audience: { type: "string", const: TEAM_FIT_REPORT_V2_AUDIENCE },
    sourceType: { type: "string", const: TEAM_FIT_REPORT_V2_SOURCE_TYPE },
    teamContext: strictObjectSchema({
      organizationId: nonEmptyStringSchema(),
      teamId: nonEmptyStringSchema(),
      teamName: nullableStringSchema(),
      teamAssessmentAssignmentId: nullableStringSchema(),
      teamDynamicsAggregationSnapshotId: nullableStringSchema(),
      teamDynamicsReportId: nullableStringSchema(),
    }),
    candidateContext: strictObjectSchema({
      organizationId: nonEmptyStringSchema(),
      participantId: nonEmptyStringSchema(),
      assessmentAssignmentId: nullableStringSchema(),
      compositeInputSnapshotId: nullableStringSchema(),
      compositeReportId: nullableStringSchema(),
      displayName: nullableStringSchema(),
    }),
    source: strictObjectSchema({
      candidateCompositeInputVersion: nonEmptyStringSchema(),
      candidateSourceReportIds: stringArraySchema(),
      candidateSourceTestSlugs: stringArraySchema(),
      teamInputVersion: nonEmptyStringSchema(),
      teamSourceReportIds: stringArraySchema(),
      teamSourceSnapshotIds: stringArraySchema(),
      optionalContextKeys: stringArraySchema(),
    }),
    executiveAssessment: strictObjectSchema({
      category: enumSchema(TEAM_FIT_REPORT_V2_ASSESSMENT_CATEGORIES),
      headline: nonEmptyStringSchema(),
      conclusion: nonEmptyStringSchema(),
      decisionGuidance: nonEmptyStringSchema(),
      mainReasons: arraySchema(
        strictObjectSchema({
          title: nonEmptyStringSchema(),
          explanation: nonEmptyStringSchema(),
          practicalConsequence: nonEmptyStringSchema(),
          evidenceRefs: evidenceArraySchema(),
        }),
        { minItems: 2, maxItems: 4 },
      ),
    }),
    keySignals: arraySchema(
      strictObjectSchema({
        title: nonEmptyStringSchema(),
        explanation: nonEmptyStringSchema(),
        practicalMeaning: nonEmptyStringSchema(),
        evidenceRefs: evidenceArraySchema(),
      }),
      { minItems: 3, maxItems: 6 },
    ),
    likelyContributions: arraySchema(
      strictObjectSchema({
        title: nonEmptyStringSchema(),
        explanation: nonEmptyStringSchema(),
        conditions: nonEmptyStringSchema(),
        evidenceRefs: evidenceArraySchema(),
      }),
      { minItems: 2, maxItems: 4 },
    ),
    successConditions: arraySchema(
      strictObjectSchema({
        title: nonEmptyStringSchema(),
        condition: nonEmptyStringSchema(),
        whyItMatters: nonEmptyStringSchema(),
        owner: ownerSchema(),
        timing: nonEmptyStringSchema(),
      }),
      { minItems: 2, maxItems: 4 },
    ),
    frictionRisks: arraySchema(
      strictObjectSchema({
        title: nonEmptyStringSchema(),
        trigger: nonEmptyStringSchema(),
        likelyPattern: nonEmptyStringSchema(),
        teamImpact: nonEmptyStringSchema(),
        mitigation: nonEmptyStringSchema(),
        owner: ownerSchema(),
        timing: nonEmptyStringSchema(),
        evidenceRefs: evidenceArraySchema(),
      }),
      { minItems: 2, maxItems: 4 },
    ),
    interviewPlan: arraySchema(
      strictObjectSchema({
        question: nonEmptyStringSchema(),
        purpose: nonEmptyStringSchema(),
        whatToListenFor: nonEmptyStringSchema(),
        positiveSignals: stringArraySchema({ minItems: 1, maxItems: 4 }),
        concernSignals: stringArraySchema({ minItems: 1, maxItems: 4 }),
        evidenceRefs: evidenceArraySchema(),
      }),
      { minItems: 3, maxItems: 5 },
    ),
    teamIntegrationPlan: strictObjectSchema({
      summary: nonEmptyStringSchema(),
      retainFromBaselineOnboarding: stringArraySchema({ minItems: 1 }),
      adaptForThisTeam: arraySchema(ownedActionSchema(true), {
        minItems: 1,
        maxItems: 5,
      }),
      teamPreparations: arraySchema(ownedActionSchema(false), {
        minItems: 1,
        maxItems: 5,
      }),
      first30Days: arraySchema(ownedActionSchema(true), {
        minItems: 2,
        maxItems: 6,
      }),
      successSignals: stringArraySchema({ minItems: 2, maxItems: 5 }),
      earlyFrictionSignals: stringArraySchema({ minItems: 2, maxItems: 5 }),
    }),
    managerGuidance: arraySchema(
      strictObjectSchema({
        action: nonEmptyStringSchema(),
        rationale: nonEmptyStringSchema(),
        timing: nonEmptyStringSchema(),
        watchFor: nonEmptyStringSchema(),
      }),
      { minItems: 3, maxItems: 5 },
    ),
    interpretationLimits: stringArraySchema({ minItems: 1, maxItems: 4 }),
    metadata: strictObjectSchema({
      provider: nullableStringSchema(),
      providerVersion: nullableStringSchema(),
      generatedAt: nonEmptyStringSchema(),
    }),
  });
}
