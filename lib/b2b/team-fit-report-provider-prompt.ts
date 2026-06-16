import "server-only";

import {
  TEAM_FIT_RELATIONSHIP_PATTERNS,
  TEAM_FIT_REPORT_CONTRACT_AUDIENCE,
  TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE,
  TEAM_FIT_REPORT_CONTRACT_VERSION,
  TEAM_FIT_REPORT_EVIDENCE_SOURCE_TYPES,
  type TeamFitReportEvidenceSourceType,
} from "@/lib/b2b/team-fit-report-contract";

export const TEAM_FIT_PROVIDER_PROMPT_SCHEMA_NAME = "team_fit_report_v1_provider_request" as const;
export const TEAM_FIT_PROVIDER_OUTPUT_SECTIONS = [
  "summary",
  "fitOverview",
  "likelyTeamContribution",
  "possibleFrictionPoints",
  "teamConditionsThatImproveFit",
  "interviewProbes",
  "onboardingAndManagerGuidance",
  "riskAndMitigationMap",
  "evidenceAppendix",
  "interpretationLimits",
  "metadata",
] as const;

export type TeamFitProviderEvidenceSide =
  | "candidate"
  | "team"
  | "context"
  | "interpretive_link";

export type TeamFitProviderPromptEvidenceItem = {
  id: string;
  sourceType: TeamFitReportEvidenceSourceType;
  side: TeamFitProviderEvidenceSide;
  label: string;
  signal: string;
  relationNote?: string;
};

export type TeamFitProviderPromptInputBundle = {
  locale: string;
  generatedFor: {
    organizationId: string;
    teamId: string;
    participantId: string;
    teamName?: string | null;
    candidateDisplayName?: string | null;
  };
  candidateDeepProfileSignals: TeamFitProviderPromptEvidenceItem[];
  teamDynamicsAggregationSignals: TeamFitProviderPromptEvidenceItem[];
  teamDynamicsExecutiveOverviewSignals?: TeamFitProviderPromptEvidenceItem[];
  teamStyleCollaborationSignals?: TeamFitProviderPromptEvidenceItem[];
  hrAdminOptionalContextSignals?: TeamFitProviderPromptEvidenceItem[];
  interpretiveLinks: TeamFitProviderPromptEvidenceItem[];
  interpretationLimits: string[];
  metadata: {
    generatedAt: string;
    requestId?: string;
    inputVersion?: string;
    sourceVersion?: string;
  };
};

export type TeamFitProviderPromptInput = {
  contractVersion: typeof TEAM_FIT_REPORT_CONTRACT_VERSION;
  reportType: typeof TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE;
  audience: typeof TEAM_FIT_REPORT_CONTRACT_AUDIENCE;
  sourceType: "candidate_team_relational";
  locale: string;
  generatedFor: TeamFitProviderPromptInputBundle["generatedFor"];
  source: {
    candidateDeepProfileSignals: TeamFitProviderPromptEvidenceItem[];
    teamDynamicsAggregationSignals: TeamFitProviderPromptEvidenceItem[];
    teamDynamicsExecutiveOverviewSignals: TeamFitProviderPromptEvidenceItem[];
    teamStyleCollaborationSignals: TeamFitProviderPromptEvidenceItem[];
    hrAdminOptionalContextSignals: TeamFitProviderPromptEvidenceItem[];
    interpretiveLinks: TeamFitProviderPromptEvidenceItem[];
  };
  evidencePack: TeamFitProviderPromptEvidenceItem[];
  allowedEvidenceIds: string[];
  outputSections: readonly string[];
  interpretationLimits: string[];
  metadata: TeamFitProviderPromptInputBundle["metadata"];
};

export type TeamFitProviderMessage = {
  role: "system" | "user";
  content: string;
};

export type TeamFitProviderMessages = {
  systemPrompt: string;
  userPrompt: string;
  messages: TeamFitProviderMessage[];
};

export type TeamFitProviderRequestDraft = {
  model: string;
  contractVersion: typeof TEAM_FIT_REPORT_CONTRACT_VERSION;
  responseSchemaName: string;
  messages: TeamFitProviderMessage[];
  metadata: TeamFitProviderPromptInputBundle["metadata"] & {
    locale: string;
    allowedEvidenceIds: string[];
    outputSections: readonly string[];
  };
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function isTeamFitProviderPromptInput(
  value: TeamFitProviderPromptInputBundle | TeamFitProviderPromptInput,
): value is TeamFitProviderPromptInput {
  if (!isPlainRecord(value)) {
    return false;
  }

  const record: Record<string, unknown> = value;

  return (
    record.contractVersion === TEAM_FIT_REPORT_CONTRACT_VERSION &&
    record.reportType === TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE &&
    record.audience === TEAM_FIT_REPORT_CONTRACT_AUDIENCE
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertNonEmptyString(value: unknown, label: string): string {
  if (!isNonEmptyString(value)) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function assertStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((entry, index) =>
    assertNonEmptyString(entry, `${label}[${index}]`),
  );
}

function assertEvidenceItems(
  value: unknown,
  label: string,
): TeamFitProviderPromptEvidenceItem[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((entry, index) => {
    if (!isPlainRecord(entry)) {
      throw new Error(`${label}[${index}] must be an object.`);
    }

    const sourceType = assertNonEmptyString(
      entry.sourceType,
      `${label}[${index}].sourceType`,
    ) as TeamFitReportEvidenceSourceType;

    if (!TEAM_FIT_REPORT_EVIDENCE_SOURCE_TYPES.includes(sourceType)) {
      throw new Error(`${label}[${index}].sourceType is not allowed.`);
    }

    const side = assertNonEmptyString(
      entry.side,
      `${label}[${index}].side`,
    ) as TeamFitProviderEvidenceSide;

    if (!["candidate", "team", "context", "interpretive_link"].includes(side)) {
      throw new Error(`${label}[${index}].side is not allowed.`);
    }

    const item: TeamFitProviderPromptEvidenceItem = {
      id: assertNonEmptyString(entry.id, `${label}[${index}].id`),
      sourceType,
      side,
      label: assertNonEmptyString(entry.label, `${label}[${index}].label`),
      signal: assertNonEmptyString(entry.signal, `${label}[${index}].signal`),
    };

    if (entry.relationNote != null) {
      item.relationNote = assertNonEmptyString(
        entry.relationNote,
        `${label}[${index}].relationNote`,
      );
    }

    return item;
  });
}

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

function dedupeEvidenceItems(
  entries: TeamFitProviderPromptEvidenceItem[],
): TeamFitProviderPromptEvidenceItem[] {
  const seen = new Set<string>();
  const output: TeamFitProviderPromptEvidenceItem[] = [];

  entries.forEach((entry) => {
    if (seen.has(entry.id)) {
      return;
    }

    seen.add(entry.id);
    output.push(entry);
  });

  return output;
}

function formatEvidenceLine(entry: TeamFitProviderPromptEvidenceItem): string {
  const relation = entry.relationNote ? ` | veza: ${entry.relationNote}` : "";
  return `- ${entry.id} | ${entry.sourceType} | ${entry.side} | ${entry.label} | ${entry.signal}${relation}`;
}

export function buildTeamFitReportProviderPromptInput(
  bundle: TeamFitProviderPromptInputBundle,
): TeamFitProviderPromptInput {
  if (!isPlainRecord(bundle)) {
    throw new Error("Provider prompt bundle must be an object.");
  }

  const generatedFor = isPlainRecord(bundle.generatedFor) ? bundle.generatedFor : null;
  const metadata = isPlainRecord(bundle.metadata) ? bundle.metadata : null;

  if (!generatedFor) {
    throw new Error("generatedFor must be an object.");
  }

  if (!metadata) {
    throw new Error("metadata must be an object.");
  }

  const promptInput: TeamFitProviderPromptInput = {
    contractVersion: TEAM_FIT_REPORT_CONTRACT_VERSION,
    reportType: TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE,
    audience: TEAM_FIT_REPORT_CONTRACT_AUDIENCE,
    sourceType: "candidate_team_relational",
    locale: assertNonEmptyString(bundle.locale, "locale"),
    generatedFor: {
      organizationId: assertNonEmptyString(
        generatedFor.organizationId,
        "generatedFor.organizationId",
      ),
      teamId: assertNonEmptyString(generatedFor.teamId, "generatedFor.teamId"),
      participantId: assertNonEmptyString(
        generatedFor.participantId,
        "generatedFor.participantId",
      ),
      teamName:
        generatedFor.teamName == null
          ? null
          : assertNonEmptyString(generatedFor.teamName, "generatedFor.teamName"),
      candidateDisplayName:
        generatedFor.candidateDisplayName == null
          ? null
          : assertNonEmptyString(
              generatedFor.candidateDisplayName,
              "generatedFor.candidateDisplayName",
            ),
    },
    source: {
      candidateDeepProfileSignals: assertEvidenceItems(
        bundle.candidateDeepProfileSignals,
        "candidateDeepProfileSignals",
      ),
      teamDynamicsAggregationSignals: assertEvidenceItems(
        bundle.teamDynamicsAggregationSignals,
        "teamDynamicsAggregationSignals",
      ),
      teamDynamicsExecutiveOverviewSignals: assertEvidenceItems(
        bundle.teamDynamicsExecutiveOverviewSignals ?? [],
        "teamDynamicsExecutiveOverviewSignals",
      ),
      teamStyleCollaborationSignals: assertEvidenceItems(
        bundle.teamStyleCollaborationSignals ?? [],
        "teamStyleCollaborationSignals",
      ),
      hrAdminOptionalContextSignals: assertEvidenceItems(
        bundle.hrAdminOptionalContextSignals ?? [],
        "hrAdminOptionalContextSignals",
      ),
      interpretiveLinks: assertEvidenceItems(
        bundle.interpretiveLinks,
        "interpretiveLinks",
      ),
    },
    evidencePack: [],
    allowedEvidenceIds: [],
    outputSections: TEAM_FIT_PROVIDER_OUTPUT_SECTIONS,
    interpretationLimits: assertStringArray(
      bundle.interpretationLimits,
      "interpretationLimits",
    ),
    metadata: {
      generatedAt: assertNonEmptyString(metadata.generatedAt, "metadata.generatedAt"),
      requestId:
        metadata.requestId == null
          ? undefined
          : assertNonEmptyString(metadata.requestId, "metadata.requestId"),
      inputVersion:
        metadata.inputVersion == null
          ? undefined
          : assertNonEmptyString(metadata.inputVersion, "metadata.inputVersion"),
      sourceVersion:
        metadata.sourceVersion == null
          ? undefined
          : assertNonEmptyString(metadata.sourceVersion, "metadata.sourceVersion"),
    },
  };

  promptInput.evidencePack = dedupeEvidenceItems([
    ...promptInput.source.candidateDeepProfileSignals,
    ...promptInput.source.teamDynamicsAggregationSignals,
    ...promptInput.source.teamDynamicsExecutiveOverviewSignals,
    ...promptInput.source.teamStyleCollaborationSignals,
    ...promptInput.source.hrAdminOptionalContextSignals,
    ...promptInput.source.interpretiveLinks,
  ]);
  promptInput.allowedEvidenceIds = promptInput.evidencePack.map((entry) => entry.id);

  if (promptInput.source.candidateDeepProfileSignals.length === 0) {
    throw new Error("At least one candidateDeepProfileSignal is required.");
  }

  if (promptInput.source.teamDynamicsAggregationSignals.length === 0) {
    throw new Error("At least one teamDynamicsAggregationSignal is required.");
  }

  if (promptInput.source.interpretiveLinks.length === 0) {
    throw new Error("At least one interpretiveLink is required.");
  }

  return promptInput;
}

export function buildTeamFitReportProviderMessages(
  bundle: TeamFitProviderPromptInputBundle | TeamFitProviderPromptInput,
): TeamFitProviderMessages {
  const promptInput = isTeamFitProviderPromptInput(bundle)
    ? bundle
    : buildTeamFitReportProviderPromptInput(bundle);

  const systemPrompt = [
    "Ti pises Team Fit HR izvjestaj za Deep Profile.",
    "Ovo je candidate-vs-team HR report, nije opsti kandidat report.",
    "Izvjestaj mora biti konkretan, evidence-linked i HR-operativan.",
    "Koristi bosanski jezik, latinicu, ijekavicu i profesionalan HR advisory ton.",
    "Ne koristi candidate-facing obracanje ti/tvoj.",
    "Ne koristi pretjerano vjerovatno, ne koristi engleske user-facing termine kada postoji prirodan BHS izraz, ne pisi akademski esej i ne koristi prazne soft formulacije.",
    "Zabrane: nema numeric fit score-a, nema procentualnog fit-a, nema hire/no-hire, nema pass/fail, nema rangiranja kandidata, nema imenovanja pojedinacnih clanova tima u glavnom reportu, nema klinickih ili dijagnostickih tvrdnji.",
    "Ne iznosi tvrdnju bez input evidence-a. Ako evidence nije dovoljno jak, tvrdnju izostavi ili je pretvori u interpretation limit.",
    "Eksplicitno izbjegni genericke obrasce kao sto su: kandidat moze doprinijeti timu na razlicite nacine, tim treba obratiti paznju na komunikaciju, fit je umjeren, kandidat se dobro uklapa, potrebno je dodatno pratiti dinamiku.",
    "Svaka vazna tvrdnja mora reci: sta je signal, iz kojeg evidence itema dolazi, kako se povezuje kandidat i tim, i sta HR ili menadzer treba provjeriti ili uraditi.",
    `Dozvoljeni relationship patterni su samo: ${TEAM_FIT_RELATIONSHIP_PATTERNS.join(", ")}.`,
    `Output smije referencirati samo postojece evidence id-eve iz input paketa: ${promptInput.allowedEvidenceIds.join(", ")}.`,
  ].join("\n");

  const userPrompt = [
    "Pripremi draft strukture za Team Fit report na osnovu dozvoljenog input paketa.",
    "Output mora mapirati sljedece sekcije:",
    ...promptInput.outputSections.map((section) => `- ${section}`),
    "",
    "Svaka sekcija mora ostati u granicama product contracta `team_fit_report_v1`.",
    "Evidence appendix i sekcije sa uvidima smiju koristiti samo evidence id-eve iz nastavka.",
    "",
    "Allowed evidence items:",
    ...promptInput.evidencePack.map(formatEvidenceLine),
    "",
    "Interpretation limits:",
    ...promptInput.interpretationLimits.map((entry) => `- ${entry}`),
    "",
    "Provider input bundle:",
    JSON.stringify(
      {
        contractVersion: promptInput.contractVersion,
        reportType: promptInput.reportType,
        audience: promptInput.audience,
        sourceType: promptInput.sourceType,
        locale: promptInput.locale,
        generatedFor: promptInput.generatedFor,
        source: promptInput.source,
        outputSections: promptInput.outputSections,
        interpretationLimits: promptInput.interpretationLimits,
        metadata: promptInput.metadata,
      },
      null,
      2,
    ),
  ].join("\n");

  return {
    systemPrompt,
    userPrompt,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
}

export function buildTeamFitReportProviderRequestDraft(
  bundle: TeamFitProviderPromptInputBundle | TeamFitProviderPromptInput,
  options: {
    model?: string | null;
    responseSchemaName?: string | null;
  } = {},
): TeamFitProviderRequestDraft {
  const promptInput = isTeamFitProviderPromptInput(bundle)
    ? bundle
    : buildTeamFitReportProviderPromptInput(bundle);
  const { messages } = buildTeamFitReportProviderMessages(promptInput);

  return {
    model: isNonEmptyString(options.model) ? options.model.trim() : "team-fit-provider-placeholder",
    contractVersion: TEAM_FIT_REPORT_CONTRACT_VERSION,
    responseSchemaName: buildSchemaName(
      options.responseSchemaName ?? TEAM_FIT_PROVIDER_PROMPT_SCHEMA_NAME,
    ),
    messages,
    metadata: {
      ...promptInput.metadata,
      locale: promptInput.locale,
      allowedEvidenceIds: promptInput.allowedEvidenceIds,
      outputSections: promptInput.outputSections,
    },
  };
}
