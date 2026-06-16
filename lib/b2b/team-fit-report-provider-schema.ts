import {
  TEAM_FIT_RELATIONSHIP_PATTERNS,
  TEAM_FIT_REPORT_CONTRACT_AUDIENCE,
  TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE,
  TEAM_FIT_REPORT_CONTRACT_VERSION,
  TEAM_FIT_REPORT_EVIDENCE_SOURCE_TYPES,
} from "@/lib/b2b/team-fit-report-contract";

export const TEAM_FIT_REPORT_PROVIDER_SCHEMA_NAME =
  TEAM_FIT_REPORT_CONTRACT_VERSION;

export type TeamFitReportProviderJsonSchema = Record<string, unknown>;

export type TeamFitReportProviderResponseFormat = {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: true;
    schema: TeamFitReportProviderJsonSchema;
  };
};

function buildSchemaName(schemaName: string): string {
  const sanitized = schemaName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");

  if (sanitized.length <= 64) {
    return sanitized || "schema";
  }

  return sanitized.slice(0, 64) || "schema";
}

function nonEmptyStringSchema(): TeamFitReportProviderJsonSchema {
  return {
    type: "string",
    minLength: 1,
  };
}

function nullableSchema(schema: TeamFitReportProviderJsonSchema): TeamFitReportProviderJsonSchema {
  return {
    anyOf: [schema, { type: "null" }],
  };
}

function stringArraySchema(options: { minItems?: number } = {}): TeamFitReportProviderJsonSchema {
  const arraySchema: TeamFitReportProviderJsonSchema = {
    type: "array",
    items: nonEmptyStringSchema(),
  };

  if (typeof options.minItems === "number") {
    arraySchema.minItems = options.minItems;
  }

  return arraySchema;
}

function strictObjectSchema(
  properties: Record<string, TeamFitReportProviderJsonSchema>,
): TeamFitReportProviderJsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}

function arraySchema(
  items: TeamFitReportProviderJsonSchema,
  options: { minItems?: number } = {},
): TeamFitReportProviderJsonSchema {
  const schema: TeamFitReportProviderJsonSchema = {
    type: "array",
    items,
  };

  if (typeof options.minItems === "number") {
    schema.minItems = options.minItems;
  }

  return schema;
}

function buildEvidenceReferenceSchema(): TeamFitReportProviderJsonSchema {
  return strictObjectSchema({
    id: nonEmptyStringSchema(),
    sourceType: {
      type: "string",
      enum: [...TEAM_FIT_REPORT_EVIDENCE_SOURCE_TYPES],
    },
    sourceLabel: nonEmptyStringSchema(),
    signalLabel: nonEmptyStringSchema(),
    summary: nonEmptyStringSchema(),
    relationToClaim: nonEmptyStringSchema(),
    snapshotId: nullableSchema(nonEmptyStringSchema()),
    version: nullableSchema(nonEmptyStringSchema()),
  });
}

function buildEvidenceLinkedSectionSchema(): TeamFitReportProviderJsonSchema {
  return strictObjectSchema({
    headline: nonEmptyStringSchema(),
    summary: nonEmptyStringSchema(),
    evidence: arraySchema(buildEvidenceReferenceSchema(), { minItems: 1 }),
  });
}

function buildEvidenceLinkedItemSchema(): TeamFitReportProviderJsonSchema {
  return strictObjectSchema({
    title: nonEmptyStringSchema(),
    signal: nonEmptyStringSchema(),
    interpretation: nonEmptyStringSchema(),
    recommendation: nullableSchema(nonEmptyStringSchema()),
    evidence: arraySchema(buildEvidenceReferenceSchema(), { minItems: 1 }),
  });
}

function buildInterviewProbeSchema(): TeamFitReportProviderJsonSchema {
  return strictObjectSchema({
    question: nonEmptyStringSchema(),
    rationale: nonEmptyStringSchema(),
    whatToListenFor: stringArraySchema(),
    evidence: arraySchema(buildEvidenceReferenceSchema(), { minItems: 1 }),
  });
}

function buildRiskAndMitigationItemSchema(): TeamFitReportProviderJsonSchema {
  return strictObjectSchema({
    risk: nonEmptyStringSchema(),
    trigger: nonEmptyStringSchema(),
    mitigation: nonEmptyStringSchema(),
    owner: {
      type: "string",
      enum: ["hr", "manager", "team_lead"],
    },
    evidence: arraySchema(buildEvidenceReferenceSchema(), { minItems: 1 }),
  });
}

export function getTeamFitReportProviderJsonSchema(): TeamFitReportProviderJsonSchema {
  return strictObjectSchema({
    contractVersion: {
      type: "string",
      const: TEAM_FIT_REPORT_CONTRACT_VERSION,
    },
    reportType: {
      type: "string",
      const: TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE,
    },
    audience: {
      type: "string",
      const: TEAM_FIT_REPORT_CONTRACT_AUDIENCE,
    },
    sourceType: {
      type: "string",
      const: "candidate_team_relational",
    },
    locale: nonEmptyStringSchema(),
    generatedFor: strictObjectSchema({
      organizationId: nonEmptyStringSchema(),
      teamId: nonEmptyStringSchema(),
      participantId: nonEmptyStringSchema(),
      teamName: nullableSchema(nonEmptyStringSchema()),
      candidateDisplayName: nullableSchema(nonEmptyStringSchema()),
    }),
    source: strictObjectSchema({
      candidateDeepProfileSignals: arraySchema(buildEvidenceReferenceSchema(), {
        minItems: 1,
      }),
      teamStyleCollaborationSignals: arraySchema(buildEvidenceReferenceSchema()),
      teamDynamicsAggregationSignals: arraySchema(buildEvidenceReferenceSchema(), {
        minItems: 1,
      }),
      teamDynamicsExecutiveOverviewSignals: arraySchema(buildEvidenceReferenceSchema()),
      hrAdminOptionalContextSignals: arraySchema(buildEvidenceReferenceSchema()),
      interpretiveLinks: arraySchema(buildEvidenceReferenceSchema(), {
        minItems: 1,
      }),
    }),
    summary: buildEvidenceLinkedSectionSchema(),
    fitOverview: strictObjectSchema({
      relationshipPattern: {
        type: "string",
        enum: [...TEAM_FIT_RELATIONSHIP_PATTERNS],
      },
      headline: nonEmptyStringSchema(),
      summary: nonEmptyStringSchema(),
      evidence: arraySchema(buildEvidenceReferenceSchema(), { minItems: 1 }),
    }),
    likelyTeamContribution: strictObjectSchema({
      items: arraySchema(buildEvidenceLinkedItemSchema(), { minItems: 1 }),
    }),
    possibleFrictionPoints: strictObjectSchema({
      items: arraySchema(buildEvidenceLinkedItemSchema(), { minItems: 1 }),
    }),
    teamConditionsThatImproveFit: strictObjectSchema({
      items: arraySchema(buildEvidenceLinkedItemSchema(), { minItems: 1 }),
    }),
    interviewProbes: strictObjectSchema({
      items: arraySchema(buildInterviewProbeSchema(), { minItems: 1 }),
    }),
    onboardingAndManagerGuidance: strictObjectSchema({
      items: arraySchema(buildEvidenceLinkedItemSchema(), { minItems: 1 }),
    }),
    riskAndMitigationMap: strictObjectSchema({
      items: arraySchema(buildRiskAndMitigationItemSchema(), { minItems: 1 }),
    }),
    evidenceAppendix: strictObjectSchema({
      entries: arraySchema(buildEvidenceReferenceSchema(), { minItems: 1 }),
    }),
    interpretationLimits: strictObjectSchema({
      limits: stringArraySchema(),
      evidence: arraySchema(buildEvidenceReferenceSchema(), { minItems: 1 }),
    }),
    metadata: strictObjectSchema({
      generatedAt: nonEmptyStringSchema(),
      schemaVersion: nonEmptyStringSchema(),
      provider: nullableSchema(nonEmptyStringSchema()),
      providerVersion: nullableSchema(nonEmptyStringSchema()),
    }),
  });
}

export function buildTeamFitReportProviderResponseFormat(
  options: { schemaName?: string | null } = {},
): TeamFitReportProviderResponseFormat {
  return {
    type: "json_schema",
    json_schema: {
      name: buildSchemaName(options.schemaName ?? TEAM_FIT_REPORT_PROVIDER_SCHEMA_NAME),
      strict: true,
      schema: getTeamFitReportProviderJsonSchema(),
    },
  };
}

export const TEAM_FIT_REPORT_PROVIDER_RESPONSE_FORMAT =
  buildTeamFitReportProviderResponseFormat();
