import {
  TEAM_FIT_REPORT_CONTRACT_AUDIENCE,
  TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE,
  TEAM_FIT_REPORT_CONTRACT_VERSION,
  type TeamFitReportEvidenceReference,
  type TeamFitReportV1ContractSnapshot,
  validateTeamFitReportV1ContractSnapshot,
} from "@/lib/b2b/team-fit-report-contract";
import type {
  TeamFitProviderPromptEvidenceItem,
  TeamFitProviderPromptInputBundle,
} from "@/lib/b2b/team-fit-report-provider-prompt";
import { TEAM_FIT_REPORT_PROVIDER_SCHEMA_NAME } from "@/lib/b2b/team-fit-report-provider-schema";

export const TEAM_FIT_REPORT_MOCK_PROVIDER = "mock" as const;
export const TEAM_FIT_REPORT_MOCK_PROVIDER_VERSION =
  "team_fit_report_mock_provider_v1" as const;
export const TEAM_FIT_REPORT_MOCK_GENERATED_AT =
  "2026-06-16T12:00:00.000Z" as const;

export type GenerateTeamFitReportWithMockProviderResult =
  | {
      ok: true;
      snapshot: TeamFitReportV1ContractSnapshot;
    }
  | {
      ok: false;
      reason: "invalid_input_bundle" | "validation_failed";
      errors: string[];
    };

type GenerateOptions = {
  generatedAt?: string | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  return value.trim();
}

function normalizeString(value: string | null | undefined, fallback: string): string {
  if (!isNonEmptyString(value)) {
    return fallback;
  }

  return value.trim();
}

function sourceLabelForEvidence(item: TeamFitProviderPromptEvidenceItem): string {
  switch (item.sourceType) {
    case "candidate_deep_profile_signal":
      return "Kandidatov individualni signal";
    case "team_style_collaboration_signal":
      return "Kandidatov Team Style signal";
    case "team_dynamics_aggregation_signal":
      return "Agregirani timski signal";
    case "team_dynamics_executive_overview_signal":
      return "Executive Overview signal";
    case "hr_admin_optional_context":
      return "HR/admin kontekst";
    case "interpretive_link":
    default:
      return "Interpretativna veza kandidat-tim";
  }
}

function relationToClaimForEvidence(item: TeamFitProviderPromptEvidenceItem): string {
  if (isNonEmptyString(item.relationNote)) {
    return item.relationNote.trim();
  }

  switch (item.side) {
    case "candidate":
      return "Ovaj signal opisuje kandidatovu stranu odnosa i koristi se kao ulaz za relacijsko tumacenje.";
    case "team":
      return "Ovaj signal opisuje timski kontekst i koristi se kao ulaz za relacijsko tumacenje.";
    case "context":
      return "Ovaj signal daje dodatni kontekst za tumacenje, ali nije samostalan zakljucak.";
    case "interpretive_link":
    default:
      return "Ovaj signal eksplicitno povezuje kandidatovu i timsku stranu u jednu provjerljivu hipotezu.";
  }
}

function toEvidenceReference(
  item: TeamFitProviderPromptEvidenceItem,
  inputBundle: TeamFitProviderPromptInputBundle,
): TeamFitReportEvidenceReference {
  return {
    id: item.id,
    sourceType: item.sourceType,
    sourceLabel: sourceLabelForEvidence(item),
    signalLabel: item.label,
    summary: item.signal,
    relationToClaim: relationToClaimForEvidence(item),
    snapshotId: normalizeOptionalString(inputBundle.metadata.requestId),
    version:
      normalizeOptionalString(inputBundle.metadata.inputVersion) ??
      normalizeOptionalString(inputBundle.metadata.sourceVersion),
  };
}

function buildEvidenceReferences(
  items: TeamFitProviderPromptEvidenceItem[],
  inputBundle: TeamFitProviderPromptInputBundle,
): TeamFitReportEvidenceReference[] {
  return items.map((item) => toEvidenceReference(item, inputBundle));
}

function dedupeEvidenceReferences(
  entries: TeamFitReportEvidenceReference[],
): TeamFitReportEvidenceReference[] {
  const seen = new Set<string>();
  const output: TeamFitReportEvidenceReference[] = [];

  entries.forEach((entry) => {
    if (seen.has(entry.id)) {
      return;
    }

    seen.add(entry.id);
    output.push(entry);
  });

  return output;
}

function buildSectionEvidence(
  inputBundle: TeamFitProviderPromptInputBundle,
  references: {
    candidate: TeamFitReportEvidenceReference[];
    team: TeamFitReportEvidenceReference[];
    context: TeamFitReportEvidenceReference[];
    links: TeamFitReportEvidenceReference[];
  },
): TeamFitReportEvidenceReference[] {
  return dedupeEvidenceReferences([
    references.candidate[0],
    references.team[0],
    references.context[0],
    references.links[0],
  ].filter((entry): entry is TeamFitReportEvidenceReference => Boolean(entry)));
}

function hasMinimumBundleShape(
  bundle: TeamFitProviderPromptInputBundle | null | undefined,
): bundle is TeamFitProviderPromptInputBundle {
  return Boolean(
    bundle &&
      isNonEmptyString(bundle.locale) &&
      bundle.generatedFor &&
      isNonEmptyString(bundle.generatedFor.organizationId) &&
      isNonEmptyString(bundle.generatedFor.teamId) &&
      isNonEmptyString(bundle.generatedFor.participantId) &&
      Array.isArray(bundle.candidateDeepProfileSignals) &&
      bundle.candidateDeepProfileSignals.length > 0 &&
      Array.isArray(bundle.teamDynamicsAggregationSignals) &&
      bundle.teamDynamicsAggregationSignals.length > 0 &&
      Array.isArray(bundle.interpretiveLinks) &&
      bundle.interpretiveLinks.length > 0 &&
      Array.isArray(bundle.interpretationLimits) &&
      bundle.metadata &&
      isNonEmptyString(bundle.metadata.generatedAt),
  );
}

export function generateTeamFitReportWithMockProvider(
  inputBundle: TeamFitProviderPromptInputBundle,
  options: GenerateOptions = {},
): GenerateTeamFitReportWithMockProviderResult {
  if (!hasMinimumBundleShape(inputBundle)) {
    return {
      ok: false,
      reason: "invalid_input_bundle",
      errors: ["Team Fit mock provider requires a valid input bundle shape."],
    };
  }

  const generatedAt = normalizeString(
    options.generatedAt ?? inputBundle.metadata.generatedAt,
    TEAM_FIT_REPORT_MOCK_GENERATED_AT,
  );
  const generatedFor = {
    organizationId: inputBundle.generatedFor.organizationId.trim(),
    teamId: inputBundle.generatedFor.teamId.trim(),
    participantId: inputBundle.generatedFor.participantId.trim(),
    teamName: normalizeOptionalString(inputBundle.generatedFor.teamName),
    candidateDisplayName: normalizeOptionalString(
      inputBundle.generatedFor.candidateDisplayName,
    ),
  };

  const source = {
    candidateDeepProfileSignals: buildEvidenceReferences(
      inputBundle.candidateDeepProfileSignals,
      inputBundle,
    ),
    teamStyleCollaborationSignals: buildEvidenceReferences(
      inputBundle.teamStyleCollaborationSignals ?? [],
      inputBundle,
    ),
    teamDynamicsAggregationSignals: buildEvidenceReferences(
      inputBundle.teamDynamicsAggregationSignals,
      inputBundle,
    ),
    teamDynamicsExecutiveOverviewSignals: buildEvidenceReferences(
      inputBundle.teamDynamicsExecutiveOverviewSignals ?? [],
      inputBundle,
    ),
    hrAdminOptionalContextSignals: buildEvidenceReferences(
      inputBundle.hrAdminOptionalContextSignals ?? [],
      inputBundle,
    ),
    interpretiveLinks: buildEvidenceReferences(inputBundle.interpretiveLinks, inputBundle),
  };

  const contextEvidence = dedupeEvidenceReferences([
    ...source.hrAdminOptionalContextSignals,
    ...source.teamDynamicsExecutiveOverviewSignals,
  ]);
  const sectionEvidence = buildSectionEvidence(inputBundle, {
    candidate: source.candidateDeepProfileSignals,
    team: source.teamDynamicsAggregationSignals,
    context: contextEvidence,
    links: source.interpretiveLinks,
  });

  const candidateSignal = source.candidateDeepProfileSignals[0];
  const teamSignal = source.teamDynamicsAggregationSignals[0];
  const linkSignal = source.interpretiveLinks[0];
  const contextSignal = contextEvidence[0] ?? null;
  const teamName = generatedFor.teamName ?? "tim";
  const candidateLabel = generatedFor.candidateDisplayName ?? "Kandidat";
  const contextClause = contextSignal
    ? ` Dodatni kontekst otvara tema "${contextSignal.signalLabel}".`
    : "";

  const snapshot: TeamFitReportV1ContractSnapshot = {
    contractVersion: TEAM_FIT_REPORT_CONTRACT_VERSION,
    reportType: TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE,
    audience: TEAM_FIT_REPORT_CONTRACT_AUDIENCE,
    sourceType: "candidate_team_relational",
    locale: inputBundle.locale,
    generatedFor,
    source,
    summary: {
      headline: `${candidateLabel} i ${teamName} trenutno pokazuju relacijski signal koji vrijedi provjeriti kroz konkretan razgovor o nacinu saradnje.`,
      summary: `${candidateSignal.signalLabel} stoji na kandidatovoj strani, dok ${teamSignal.signalLabel} opisuje timski kontekst. ${linkSignal.summary}${contextClause}`,
      evidence: sectionEvidence,
    },
    fitOverview: {
      relationshipPattern: "mixed_signal",
      headline: `Najkorisnije je citati odnos kandidata i ${teamName} kao kombinaciju moguce dopune i tacke za ranu provjeru.`,
      summary: `${candidateSignal.summary} Na timskoj strani signal glasi: ${teamSignal.summary} Interpretativna veza ostaje: ${linkSignal.summary}`,
      evidence: sectionEvidence,
    },
    likelyTeamContribution: {
      items: [
        {
          title: "Moguci doprinos kroz jasnije radne dogovore",
          signal: candidateSignal.summary,
          interpretation: `${candidateLabel} moze biti koristan tamo gdje ${teamSignal.signalLabel.toLowerCase()} trazi vise eksplicitnosti oko narednih koraka i odgovornosti.`,
          recommendation:
            "U razgovoru provjeriti kako kandidat uvodi jasnocu bez preuzimanja kontrole nad timskim dogovorom.",
          evidence: sectionEvidence,
        },
      ],
    },
    possibleFrictionPoints: {
      items: [
        {
          title: "Rani nesporazum oko ritma uskladjivanja",
          signal: teamSignal.summary,
          interpretation: `${linkSignal.summary} Ako tim i kandidat razlicito ocekuju tempo uskladjivanja, pocetna saradnja moze traziti vise razjasnjavanja nego sto obje strane pretpostavljaju.`,
          recommendation:
            "Vec u ranoj fazi dogovoriti kako se eskaliraju nejasnoce i kako se zatvaraju otvoreni dogovori.",
          evidence: sectionEvidence,
        },
      ],
    },
    teamConditionsThatImproveFit: {
      items: [
        {
          title: "Jasan onboarding okvir",
          signal: contextSignal?.summary ?? teamSignal.summary,
          interpretation:
            "Relacijski signal je korisniji kada tim unaprijed razjasni kako izgleda koordinacija prioriteta, odgovornosti i povratne informacije.",
          recommendation:
            "Definisati prve check-in tacke, vlasnistvo nad zadacima i nacin potvrde narednih koraka.",
          evidence: sectionEvidence,
        },
      ],
    },
    interviewProbes: {
      items: [
        {
          question:
            "Kako u novom timu najbrze razjasnjavate ko donosi odluku, ko zatvara dogovor i kako se provjerava da svi isto razumiju naredne korake?",
          rationale:
            "Pitanje provjerava kako kandidat prevodi vlastiti radni signal u konkretan timski kontekst.",
          whatToListenFor: [
            "Da li kandidat daje konkretan primjer ranog uskladjivanja.",
            "Da li razlikuje jasnocu procesa od nepotrebne kontrole.",
            "Da li prepoznaje kako timski ritam mijenja njegov pristup.",
          ],
          evidence: sectionEvidence,
        },
      ],
    },
    onboardingAndManagerGuidance: {
      items: [
        {
          title: "Postaviti zajednicki jezik za saradnju",
          signal: contextSignal?.summary ?? linkSignal.summary,
          interpretation:
            "Najvise koristi dolazi kada menadzer rano prevede timska ocekivanja u konkretne operativne dogovore koje kandidat moze odmah koristiti.",
          recommendation:
            "U prvih nekoliko sedmica drzati kratke i konkretne razgovore o prioritetima, odgovornostima i nacinu signaliziranja blokera.",
          evidence: sectionEvidence,
        },
      ],
    },
    riskAndMitigationMap: {
      items: [
        {
          risk: "Pocetno razilazenje oko nacina koordinacije",
          trigger: teamSignal.summary,
          mitigation:
            "Dogovoriti eksplicitan ritam uskladjivanja i primjer kako se zatvara otvoreno pitanje prije nego sto preraste u trenje.",
          owner: "manager",
          evidence: sectionEvidence,
        },
      ],
    },
    evidenceAppendix: {
      entries: dedupeEvidenceReferences([
        ...source.candidateDeepProfileSignals,
        ...source.teamStyleCollaborationSignals,
        ...source.teamDynamicsAggregationSignals,
        ...source.teamDynamicsExecutiveOverviewSignals,
        ...source.hrAdminOptionalContextSignals,
        ...source.interpretiveLinks,
      ]),
    },
    interpretationLimits: {
      limits: inputBundle.interpretationLimits,
      evidence: sectionEvidence,
    },
    metadata: {
      generatedAt,
      schemaVersion: TEAM_FIT_REPORT_PROVIDER_SCHEMA_NAME,
      provider: TEAM_FIT_REPORT_MOCK_PROVIDER,
      providerVersion: TEAM_FIT_REPORT_MOCK_PROVIDER_VERSION,
    },
  };

  const validationResult = validateTeamFitReportV1ContractSnapshot(snapshot);

  if (!validationResult.ok) {
    return {
      ok: false,
      reason: "validation_failed",
      errors: validationResult.errors,
    };
  }

  return {
    ok: true,
    snapshot: validationResult.snapshot,
  };
}
