import {
  buildSafranCandidateInterpretation,
  getSafranInterpretationFallbackText,
  type SafranCandidateInterpretationScores,
  type SafranScoreKey,
} from "@/lib/assessment/safran-interpretation";

type SafranParticipantReportHeader = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

export type SafranParticipantReportSummarySection = {
  id: "summary";
  title: string;
  body: string;
  overall: {
    label: string;
    score: number | null;
    maxPossible: number;
    helper: string;
    summary: string;
  };
};

export type SafranParticipantReportDomainRow = {
  scoreKey: Extract<
    SafranScoreKey,
    "verbal_score" | "figural_score" | "numerical_series_score"
  >;
  label: string;
  score: number | null;
  maxPossible: number;
  helper: string;
  summary: string;
};

export type SafranParticipantReportDomainsSection = {
  id: "domains";
  title: string;
  rows: [
    SafranParticipantReportDomainRow,
    SafranParticipantReportDomainRow,
    SafranParticipantReportDomainRow,
  ];
};

export type SafranParticipantReportSignalsSection = {
  id: "signals";
  title: string;
  body: string;
  items: string[];
};

export type SafranParticipantReportReadingGuideSection = {
  id: "reading_guide";
  title: string;
  items: [string, string, string, string];
};

export type SafranParticipantReportNextStepSection = {
  id: "next_step";
  title: string;
  items: [string, string];
};

export type SafranParticipantReportDisplay = {
  header: SafranParticipantReportHeader;
  sections: [
    SafranParticipantReportSummarySection,
    SafranParticipantReportDomainsSection,
    SafranParticipantReportSignalsSection,
    SafranParticipantReportReadingGuideSection,
    SafranParticipantReportNextStepSection,
  ];
};

const SAFRAN_READING_GUIDE: SafranParticipantReportReadingGuideSection["items"] = [
  "Rezultati prikazuju broj tačnih odgovora unutar ove procjene i najkorisnije ih je čitati kao profil po oblastima.",
  "Verbalni, figuralni i numerički dio vrijedi posmatrati zajedno, jer svaka oblast pokazuje drugačiji tip zadataka.",
  "Numerički dio u ovoj digitalnoj verziji koristi numeričke nizove, pa rezultat treba čitati u tom formatu zadataka.",
  "Ako si prije glavnog testa radio ili radila practice pitanja, ona služe samo za upoznavanje formata i ne ulaze u ove rezultate.",
] as const;

const SAFRAN_NEXT_STEPS: SafranParticipantReportNextStepSection["items"] = [
  "Pogledaj u kojim oblastima si imao ili imala stabilniji ritam rješavanja, a gdje je trebalo više provjere ili vremena.",
  "Za potpuniju sliku, ove rezultate poveži s iskustvom, interesima i razgovorom o tome kako pristupaš problemskim zadacima.",
] as const;

function normalizeTitle(testName?: string | null): string {
  const trimmed = testName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "SAFRAN";
}

function isFiniteScore(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getDomainRow(
  scoreKey: SafranParticipantReportDomainRow["scoreKey"],
  label: string,
  maxPossible: number,
  scores: SafranCandidateInterpretationScores,
): SafranParticipantReportDomainRow {
  const interpretation = buildSafranCandidateInterpretation(scores);
  const domain = interpretation.domains.find((item) => item.scoreKey === scoreKey);
  const score = scores[scoreKey] ?? null;
  const isOutOfRange = isFiniteScore(score) && (score < 0 || score > maxPossible);
  const fallback = getSafranInterpretationFallbackText({
    scoreKey,
    reason: isOutOfRange ? "invalid_range" : "missing",
  });

  return {
    scoreKey,
    label,
    score,
    maxPossible,
    helper: domain?.bandLabelBs ?? fallback,
    summary: domain?.textBs ?? fallback,
  };
}

function getOverallSummary(
  scores: SafranCandidateInterpretationScores,
): SafranParticipantReportSummarySection["overall"] {
  const interpretation = buildSafranCandidateInterpretation(scores);
  const score = scores.cognitive_composite_v1 ?? null;
  const isOutOfRange = isFiniteScore(score) && (score < 0 || score > 54);
  const fallback = getSafranInterpretationFallbackText({
    scoreKey: "cognitive_composite_v1",
    reason: isOutOfRange ? "invalid_range" : "missing",
  });

  return {
    label: "Ukupni rezultat",
    score,
    maxPossible: 54,
    helper: interpretation.overall?.bandLabelBs ?? fallback,
    summary: interpretation.overall?.textBs ?? fallback,
  };
}

function getSignalsSection(
  scores: SafranCandidateInterpretationScores,
): SafranParticipantReportSignalsSection {
  const interpretation = buildSafranCandidateInterpretation(scores);

  return {
    id: "signals",
    title: "Profil kognitivnih signala",
    body:
      "Ovaj kratki profil služi kao orijentir za to koji su ti tipovi zadataka u ovoj procjeni djelovali prirodnije.",
    items: interpretation.relativeProfileBs
      ? [interpretation.relativeProfileBs]
      : [
          "Raspored rezultata po oblastima ovdje je korisniji od jednog kratkog profila, pa pregled po oblastima ostaje glavni oslonac za tumačenje.",
        ],
  };
}

export function buildSafranParticipantReportDisplay({
  scores,
  testName,
}: {
  scores: SafranCandidateInterpretationScores;
  testName?: string | null;
}): SafranParticipantReportDisplay {
  const overall = getOverallSummary(scores);
  const domains: SafranParticipantReportDomainsSection["rows"] = [
    getDomainRow("verbal_score", "Verbalni rezultat", 18, scores),
    getDomainRow("figural_score", "Figuralni rezultat", 18, scores),
    getDomainRow("numerical_series_score", "Numerički rezultat", 18, scores),
  ];

  return {
    header: {
      eyebrow: "Rezultati procjene",
      title: normalizeTitle(testName),
      subtitle:
        "Rezultati su prikazani kroz broj tačnih odgovora i kratko tumačenje unutar ove procjene.",
    },
    sections: [
      {
        id: "summary",
        title: "Sažetak rezultata",
        body:
          "Rezultat ispod sažima učinak u ovom pokušaju, a puni smisao dobija tek zajedno s pregledom po oblastima.",
        overall,
      },
      {
        id: "domains",
        title: "Pregled po oblastima",
        rows: domains,
      },
      getSignalsSection(scores),
      {
        id: "reading_guide",
        title: "Kako čitati ove rezultate",
        items: SAFRAN_READING_GUIDE,
      },
      {
        id: "next_step",
        title: "Sljedeći korak",
        items: SAFRAN_NEXT_STEPS,
      },
    ],
  };
}
