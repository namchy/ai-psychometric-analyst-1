import {
  parseSafranAiScoreLabel,
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
  "Ako si prije glavnog testa radio ili radila Probna pitanja, ona služe samo za upoznavanje formata i ne ulaze u rezultat.",
] as const;

const SAFRAN_NEXT_STEPS: SafranParticipantReportNextStepSection["items"] = [
  "Pogledaj u kojim oblastima si imao ili imala stabilniji ritam rješavanja, a gdje je trebalo više provjere ili vremena.",
  "Za potpuniju sliku, ove rezultate poveži s iskustvom, interesima i razgovorom o tome kako pristupaš problemskim zadacima.",
] as const;

function buildSafranParticipantDomainSummary(
  scoreKey: SafranParticipantReportDomainRow["scoreKey"],
  scores: SafranCandidateInterpretationScores,
): string {
  const verbalScore = scores.verbal_score ?? null;
  const figuralScore = scores.figural_score ?? null;
  const numericalScore = scores.numerical_series_score ?? null;
  const isFiguralLowerThanBoth =
    isFiniteScore(figuralScore) &&
    isFiniteScore(verbalScore) &&
    isFiniteScore(numericalScore) &&
    figuralScore < verbalScore &&
    figuralScore < numericalScore;
  const isNumericalHighest =
    isFiniteScore(numericalScore) &&
    isFiniteScore(verbalScore) &&
    isFiniteScore(figuralScore) &&
    numericalScore > verbalScore &&
    numericalScore > figuralScore;

  if (scoreKey === "verbal_score") {
    return "Verbalni dio govori o tome kako si u ovom setu zadataka pratio ili pratila značenja pojmova i odnose među njima. U praktičnom kontekstu može biti relevantan za razumijevanje pisanih informacija, razlikovanje nijansi u značenju i povezivanje pojmova. Korisno ga je čitati kao signal iz ovih zadataka, zajedno s figuralnim i numeričkim dijelom profila.";
  }

  if (scoreKey === "figural_score") {
    return isFiguralLowerThanBoth
      ? "Figuralni rezultat ukazuje na prepoznavanje obrazaca, odnosa i promjena među oblicima u ovom setu zadataka. U odnosu na verbalni i numerički dio, ovdje se vidi blaži kontrast, što može značiti da su vizuelni odnosi tražili više provjere prije odgovora. Ovaj dio je najbolje čitati kao specifičan signal iz ove vrste zadataka, ne kao opštu procjenu vizuelnog mišljenja."
      : "Figuralni rezultat ukazuje na prepoznavanje obrazaca, odnosa i promjena među oblicima u ovom setu zadataka. U praktičnom kontekstu može biti relevantan za situacije u kojima treba uočiti pravilo, pratiti promjenu i provjeriti odnos između elemenata. Ovaj dio je najbolje čitati kao specifičan signal iz ove vrste zadataka, ne kao opštu procjenu vizuelnog mišljenja.";
  }

  return isNumericalHighest
    ? "Numerički rezultat se izdvaja kao najizraženiji dio ovog profila. U zadacima sa nizovima pokazuje kako si pratio ili pratila pravila i odnose među elementima. Ovakav rezultat može biti relevantan u situacijama gdje je važno brzo uočiti brojčani obrazac, provjeriti logiku niza ili raditi sa strukturisanim kvantitativnim informacijama."
    : "Numerički dio opisuje kako si u ovom setu zadataka pratio ili pratila pravila u nizovima i odnose među elementima. U praktičnom kontekstu može biti relevantan za rad sa strukturisanim brojčanim informacijama, posebno kada treba provjeriti logiku obrasca prije zaključka. Korisno ga je čitati kao signal iz numeričkih nizova, bez zaključka o opštoj matematičkoj sposobnosti.";
}

function normalizeSafranDisplayText(value: string): string {
  return value
    .replace(/\bjedan slabiji dio\b/gi, "jedan izdvojen rezultat")
    .replace(/\bpri čitanju nalaza\b/gi, "pri čitanju rezultata")
    .replace(/\bnalaz\b/gi, "rezultat")
    .replace(/\bpractice pitanja\b/gi, "Probna pitanja")
    .replace(/\bne ulaze u scoring\b/gi, "ne ulaze u rezultat");
}

function normalizedSafranDisplayText(value: string): string {
  return normalizeSafranDisplayText(value.trim());
}

function normalizeSafranReadingGuideItems(items: readonly string[]): string[] {
  return items.map((item) => normalizedSafranDisplayText(item));
}

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
    summary: isOutOfRange || !domain
      ? fallback
      : buildSafranParticipantDomainSummary(scoreKey, scores),
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
  const body = interpretation.relativeProfileBs
    ? normalizedSafranDisplayText(interpretation.relativeProfileBs)
    : "Pregled po oblastima ovdje daje najkorisniju sliku o tome koji su ti tipovi zadataka djelovali prirodnije i gdje je pristup tražio više prilagođavanja.";

  return {
    id: "signals",
    title: "Kognitivni signal",
    body,
    items: [],
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
        title: "Kako čitati ovaj rezultat",
        items: normalizeSafranReadingGuideItems(SAFRAN_READING_GUIDE),
      },
      {
        id: "next_step",
        title: "Korak za razmišljanje",
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
}: {
  scores: SafranCandidateInterpretationScores;
  testName?: string | null;
  aiReport?: SafranParticipantAiReport | null;
}): SafranParticipantReportDisplay {
  if (aiReport) {
    return buildSafranParticipantReportDisplayFromAiReport(aiReport);
  }

  return buildSafranParticipantReportDisplay({
    scores,
    testName,
  });
}
