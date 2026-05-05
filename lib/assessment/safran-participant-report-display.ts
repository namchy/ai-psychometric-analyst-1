import {
  parseSafranAiScoreLabel,
  validateSafranParticipantAiReport,
  type SafranParticipantAiReport,
} from "@/lib/assessment/safran-participant-ai-report-v1";
import {
  buildSafranCandidateInterpretation,
  getSafranInterpretationFallbackText,
  type SafranCandidateInterpretationScores,
  type SafranScoreKey,
} from "@/lib/assessment/safran-interpretation";

export type SafranParticipantReportHeader = {
  eyebrow: string;
  title: string;
  subtitle: string;
  statusLabel?: string;
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
  items: string[];
};

export type SafranParticipantReportNextStepSection = {
  id: "next_step";
  title: string;
  items?: [string, string];
  body?: string;
  ctaLabel?: string;
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

const SAFRAN_AI_OVERALL_CARD_SUMMARY =
  "Ukupni rezultat sažima učinak kroz verbalni, figuralni i numerički dio i najkorisnije ga je čitati zajedno s pregledom po oblastima.";

function normalizeTitle(testName?: string | null): string {
  const trimmed = testName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "SAFRAN";
}

function parseScoreLabel(scoreLabel: string, fallbackMax: number): {
  score: number | null;
  maxPossible: number;
} {
  const parsed = parseSafranAiScoreLabel(scoreLabel);

  if (!parsed) {
    return {
      score: null,
      maxPossible: fallbackMax,
    };
  }

  return {
    score: parsed.rawScore,
    maxPossible: parsed.maxScore,
  };
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

export function buildSafranParticipantReportDisplayFromAiReport(
  report: SafranParticipantAiReport,
): SafranParticipantReportDisplay {
  const overallScore = parseScoreLabel(report.summary.scoreLabel, 54);
  const domainRows: SafranParticipantReportDomainsSection["rows"] = report.domains.map(
    (domain) => {
      const score = parseScoreLabel(domain.scoreLabel, 18);

      return {
        scoreKey:
          domain.code === "verbal"
            ? "verbal_score"
            : domain.code === "figural"
              ? "figural_score"
              : "numerical_series_score",
        label: domain.title,
        score: score.score,
        maxPossible: score.maxPossible,
        helper: domain.bandLabel,
        summary: domain.interpretation,
      };
    },
  ) as SafranParticipantReportDomainsSection["rows"];

  return {
    header: {
      eyebrow: "AI izvještaj procjene",
      title: report.header.title,
      subtitle: report.header.subtitle,
      statusLabel: report.header.statusLabel,
    },
    sections: [
      {
        id: "summary",
        title: report.summary.title,
        body: report.summary.interpretation,
        overall: {
          label: "Ukupni rezultat",
          score: overallScore.score,
          maxPossible: overallScore.maxPossible,
          helper: report.summary.bandLabel,
          summary: SAFRAN_AI_OVERALL_CARD_SUMMARY,
        },
      },
      {
        id: "domains",
        title: "Pregled po oblastima",
        rows: domainRows,
      },
      {
        id: "signals",
        title: report.cognitiveSignals.title,
        body:
          "Ovaj kratki profil tumači odnos signala unutar verbalnih, figuralnih i numeričkih zadataka.",
        items: [
          report.cognitiveSignals.primarySignal,
          report.cognitiveSignals.cautionSignal,
          report.cognitiveSignals.balanceNote,
        ],
      },
      {
        id: "reading_guide",
        title: report.readingGuide.title,
        items: report.readingGuide.bullets,
      },
      {
        id: "next_step",
        title: report.nextStep.title,
        body: report.nextStep.body,
        ctaLabel: report.nextStep.ctaLabel,
      },
    ],
  };
}

export function resolveSafranParticipantReportDisplay({
  scores,
  testName,
  aiReport,
}: {
  scores: SafranCandidateInterpretationScores;
  testName?: string | null;
  aiReport?: unknown;
}): SafranParticipantReportDisplay {
  const aiValidation = aiReport
    ? validateSafranParticipantAiReport(aiReport)
    : null;

  if (aiValidation?.ok) {
    return buildSafranParticipantReportDisplayFromAiReport(aiValidation.value);
  }

  return buildSafranParticipantReportDisplay({
    scores,
    testName,
  });
}
