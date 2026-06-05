import {
  parseSafranAiScoreLabel,
  type SafranParticipantAiReport,
} from "@/lib/assessment/safran-participant-ai-report-v1";
import {
  buildSafranCandidateInterpretation,
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
  segments?: Array<{
    label: string;
    body: string;
  }>;
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
  narrativeAvailable: boolean;
  header: SafranParticipantReportHeader;
  sections: [
    SafranParticipantReportSummarySection,
    SafranParticipantReportDomainsSection,
    SafranParticipantReportSignalsSection,
    SafranParticipantReportReadingGuideSection,
    SafranParticipantReportNextStepSection,
  ];
};

export type SafranParticipantNarrativeState = "pending" | "failed";

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

  return {
    scoreKey,
    label,
    score,
    maxPossible,
    helper: isOutOfRange || !domain ? "Rezultat nije dostupan" : domain.bandLabelBs,
    summary: "",
  };
}

function getOverallSummary(
  scores: SafranCandidateInterpretationScores,
): SafranParticipantReportSummarySection["overall"] {
  const interpretation = buildSafranCandidateInterpretation(scores);
  const score = scores.cognitive_composite_v1 ?? null;
  const isOutOfRange = isFiniteScore(score) && (score < 0 || score > 54);

  return {
    label: "Ukupni rezultat",
    score,
    maxPossible: 54,
    helper:
      isOutOfRange || !interpretation.overall
        ? "Rezultat nije dostupan"
        : interpretation.overall.bandLabelBs,
    summary: "",
  };
}

export function buildSafranParticipantReportDisplay({
  scores,
  testName,
  narrativeState = "pending",
}: {
  scores: SafranCandidateInterpretationScores;
  testName?: string | null;
  narrativeState?: SafranParticipantNarrativeState;
}): SafranParticipantReportDisplay {
  const overall = getOverallSummary(scores);
  const domains: SafranParticipantReportDomainsSection["rows"] = [
    getDomainRow("verbal_score", "Verbalni rezultat", 18, scores),
    getDomainRow("figural_score", "Figuralni rezultat", 18, scores),
    getDomainRow("numerical_series_score", "Numerički rezultat", 18, scores),
  ];

  return {
    narrativeAvailable: false,
    header: {
      eyebrow: "Rezultati procjene",
      title: normalizeTitle(testName),
      subtitle: "Dostupni su bodovani rezultati ove procjene.",
    },
    sections: [
      {
        id: "summary",
        title: "Rezultati testa",
        body:
          narrativeState === "failed"
            ? "Rezultati testa su dostupni, ali detaljan narativni izvještaj trenutno nije moguće prikazati. Ako se problem ponovi, kontaktiraj support."
            : "Rezultati testa su dostupni, ali detaljan narativni izvještaj još nije spreman za prikaz.",
        overall,
      },
      {
        id: "domains",
        title: "Pregled po oblastima",
        rows: domains,
      },
      {
        id: "signals",
        title: "",
        body: "",
        items: [],
      },
      {
        id: "reading_guide",
        title: "",
        items: [],
      },
      {
        id: "next_step",
        title: "",
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
      const scoreKey =
        domain.code === "verbal"
          ? "verbal_score"
          : domain.code === "figural"
            ? "figural_score"
            : "numerical_series_score";

      return {
        scoreKey,
        label: domain.title,
        score: score.score,
        maxPossible: score.maxPossible,
        helper: domain.bandLabel,
        summary: domain.interpretation,
      };
    },
  ) as SafranParticipantReportDomainsSection["rows"];

  return {
    narrativeAvailable: true,
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
          summary: "",
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
        body: "",
        items: [],
        segments: [
          {
            label: "Glavni signal",
            body: report.cognitiveSignals.primarySignal,
          },
          {
            label: "Balans rezultata",
            body: report.cognitiveSignals.balanceNote,
          },
          {
            label: "Oprez pri čitanju",
            body: report.cognitiveSignals.cautionSignal,
          },
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
  narrativeState,
}: {
  scores: SafranCandidateInterpretationScores;
  testName?: string | null;
  aiReport?: SafranParticipantAiReport | null;
  narrativeState?: SafranParticipantNarrativeState;
}): SafranParticipantReportDisplay {
  if (aiReport) {
    return buildSafranParticipantReportDisplayFromAiReport(aiReport);
  }

  return buildSafranParticipantReportDisplay({
    scores,
    testName,
    narrativeState,
  });
}
