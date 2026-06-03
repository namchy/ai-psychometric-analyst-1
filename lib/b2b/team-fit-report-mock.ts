import "server-only";

import type { TeamFitReportInputSnapshot } from "@/lib/b2b/team-fit-report-input";
import {
  TEAM_FIT_RELATIONSHIP_PATTERNS,
  TEAM_FIT_REPORT_TYPE,
  TEAM_FIT_REPORT_VERSION,
  type TeamFitReportV1,
} from "@/lib/b2b/team-fit-report-contract";

function normalizeText(value: string | null | undefined, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

export function buildMockTeamFitReportSnapshot(
  inputSnapshot: TeamFitReportInputSnapshot,
): TeamFitReportV1 {
  const relationshipPattern =
    TEAM_FIT_RELATIONSHIP_PATTERNS.includes("needs_validation") === true
      ? "needs_validation"
      : "mixed_signal";
  const organizationId = inputSnapshot.organizationContext.organizationId;
  const teamId = inputSnapshot.teamContext.teamId;
  const participantId = inputSnapshot.candidateContext.participantId;
  const teamName = normalizeText(inputSnapshot.teamContext.teamName, "Tim");
  const displayName = normalizeText(inputSnapshot.candidateContext.displayName, "Kandidat");
  const generatedAt = inputSnapshot.generatedAt;

  return {
    reportType: TEAM_FIT_REPORT_TYPE,
    reportVersion: TEAM_FIT_REPORT_VERSION,
    locale: inputSnapshot.locale,
    generatedAt,
    inputSnapshotVersion: inputSnapshot.inputVersion,
    teamFitReportVersion: TEAM_FIT_REPORT_VERSION,
    audience: "hr_internal",
    sourceType: "candidate_team_relational",
    teamContext: {
      organizationId,
      teamId,
      teamName,
      teamDynamicsAggregationSnapshotId: inputSnapshot.teamContext.teamSourceId,
      teamDynamicsReportId: null,
      teamAssessmentAssignmentId: null,
    },
    candidateContext: {
      organizationId,
      participantId,
      compositeInputSnapshotId: inputSnapshot.candidateContext.candidateSourceId,
      compositeReportId: null,
      assessmentAssignmentId: null,
      displayName,
    },
    source: {
      candidateCompositeInputVersion: inputSnapshot.inputVersion,
      candidateSourceReportIds: [],
      candidateSourceTestSlugs: [],
      teamInputVersion: inputSnapshot.inputVersion,
      teamSourceReportIds: [],
      teamSourceSnapshotIds: inputSnapshot.teamContext.teamSourceId
        ? [inputSnapshot.teamContext.teamSourceId]
        : [],
      optionalContextKeys: [],
    },
    fitOverview: {
      relationshipPattern,
      headline: "Početni pregled odnosa kandidata i tima traži dodatnu provjeru.",
      summary:
        "Ovaj razvojni pregled koristi postojeći input snapshot kao oprezan početni signal. Nalaze vrijedi potvrditi kroz strukturisan razgovor o radu, saradnji i očekivanjima.",
    },
    teamContextSummary: {
      relevantTeamPatterns: [
        {
          title: "Timski kontekst se čita kroz postojeći snapshot",
          summary: `${teamName} je trenutno predstavljen kroz siguran agregirani kontekst bez pojedinačnih prikaza članova.`,
        },
      ],
    },
    candidateSignals: [
      {
        title: "Kandidatov signal ostaje razvojni ulaz",
        summary: `${displayName} je u ovom mock prikazu predstavljen samo kroz siguran kandidatski kontekst bez dodatnog rangiranja.`,
        relevanceToFit: "Najkorisnije ga je čitati kao temu za provjeru radnog stila i načina saradnje sa timom.",
      },
    ],
    complementaritySignals: [
      {
        title: "Moguća dopuna postojećem ritmu rada",
        summary: "Kandidatski signal može otvoriti korisna pitanja o tome kako tim prima novu perspektivu i kako raspoređuje odgovornosti.",
        practicalValue: "To može pomoći strukturisanju onboarding razgovora i ranih dogovora o saradnji.",
      },
    ],
    frictionRisks: [
      {
        title: "Potrebna je rana provjera očekivanja",
        summary: "Ako očekivanja o tempu rada i koordinaciji ostanu previše implicitna, može doći do nejasnoća u početnoj saradnji.",
        whyItMayMatter: "Takve nejasnoće mogu usporiti zajedničko usklađivanje prioriteta i načina komunikacije.",
        mitigationFocus: "Vrijedi rano dogovoriti kako tim i kandidat usklađuju prioritete, povratne informacije i odgovornosti.",
      },
    ],
    interviewFocus: {
      areas: [
        {
          title: "Saradnja u novom timu",
          rationale: "Korisno je provjeriti kako kandidat opisuje usklađivanje očekivanja, ritma rada i komunikacije.",
          prompts: [
            "Kako u novom timu najbrže razjašnjavate očekivanja oko prioriteta i odgovornosti?",
            "Koji stil saradnje vam najviše pomaže da ostanete usklađeni sa timom?",
          ],
        },
      ],
    },
    onboardingGuidance: {
      priorities: [
        "U prvim sedmicama eksplicitno dogovoriti očekivanja oko saradnje, prioriteta i ritma komunikacije.",
      ],
      supportNeeds: [
        "Postaviti jednostavan ritam check-in razgovora kako bi se rana nejasnoća pretvorila u konkretan dogovor.",
      ],
    },
    managerGuidance: {
      workingStyleGuidance: [
        "Držati radni okvir dovoljno jasnim da kandidat razumije kako tim usklađuje prioritete i odgovornosti.",
      ],
      communicationGuidance: [
        "Koristiti kratke, konkretne razgovore koji provjeravaju da li obje strane isto razumiju naredne korake.",
      ],
    },
    watchouts: [
      "Ne čitati ovaj mock pregled kao završni sud, nego kao razvojni okvir za dodatnu provjeru kroz razgovor i konkretne primjere rada.",
    ],
    interpretationLimits: [
      "Ovaj izvještaj je interni razvojni signal za HR i timski kontekst, nije automatska odluka.",
      "Izvještaj ne prikazuje pojedinačne odgovore ni pojedinačne score vrijednosti članova tima.",
      "Nalaze treba tumačiti uz stvarni radni kontekst, onboarding plan i dodatni razgovor sa relevantnim akterima.",
    ],
    metadata: {
      generatedAt,
    },
  };
}
