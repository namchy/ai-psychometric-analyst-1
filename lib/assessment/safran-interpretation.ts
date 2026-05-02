export type SafranScoreKey =
  | "verbal_score"
  | "figural_score"
  | "numerical_series_score"
  | "cognitive_composite_v1";

export type SafranBandKey = "lower_raw" | "moderate_raw" | "higher_raw";

export type SafranInterpretationRule = {
  scoreKey: SafranScoreKey;
  minScore: number;
  maxScore: number;
  maxPossible: number;
  bandKey: SafranBandKey;
  bandLabelBs: string;
  domainLabelBs: string;
  candidateTextBs: string;
};

export type SafranCandidateInterpretation = {
  introBs: string;
  overall: {
    score: number;
    maxPossible: number;
    bandKey: SafranBandKey;
    bandLabelBs: string;
    textBs: string;
  } | null;
  domains: Array<{
    scoreKey: SafranScoreKey;
    domainLabelBs: string;
    score: number;
    maxPossible: number;
    bandKey: SafranBandKey;
    bandLabelBs: string;
    textBs: string;
  }>;
  relativeProfileBs: string | null;
  limitationsBs: string[];
};

export type SafranCandidateInterpretationScores = Partial<Record<SafranScoreKey, number | null>>;

type SafranDomainDefinition = {
  scoreKey: SafranScoreKey;
  domainLabelBs: string;
  maxPossible: number;
};

const SAFRAN_INTERPRETATION_INTRO =
  "Ovo je opis tvog učinka na SAFRAN zadacima. Rezultati prikazuju broj tačnih odgovora u ovoj procjeni. Ne predstavljaju IQ, percentile niti rang u odnosu na populaciju.";

const SAFRAN_INTERPRETATION_LIMITATIONS = [
  "Rezultati su broj tačnih odgovora u ovoj procjeni, ne IQ skor, percentile ili rang.",
  "Numerički rezultat je prilagođen jer ova digitalna verzija koristi numeričke nizove, bez računskih zadataka koji zahtijevaju papir i olovku.",
  "SAFRAN ne mjeri iskustvo, motivaciju, kreativnost, komunikacijski stil ili timski doprinos.",
  "Rezultate je najbolje čitati zajedno s intervjuom, radnim zadatkom, iskustvom i drugim testovima.",
] as const;

const OVERALL_FALLBACK_BS =
  "Ukupno tumačenje trenutno nije dostupno jer nedostaje dio rezultata.";
const DOMAIN_FALLBACK_BS =
  "Za ovaj dio trenutno nema dovoljno podataka za prikaz tumačenja.";
const INVALID_RANGE_FALLBACK_BS =
  "Rezultat za ovaj dio nije u očekivanom rasponu, pa tumačenje nije prikazano.";

const SAFRAN_DOMAIN_DEFINITIONS: SafranDomainDefinition[] = [
  {
    scoreKey: "verbal_score",
    domainLabelBs: "Verbalni dio",
    maxPossible: 18,
  },
  {
    scoreKey: "figural_score",
    domainLabelBs: "Figuralni dio",
    maxPossible: 18,
  },
  {
    scoreKey: "numerical_series_score",
    domainLabelBs: "Numerički rezultat",
    maxPossible: 18,
  },
];

export const SAFRAN_INTERPRETATION_RULES: SafranInterpretationRule[] = [
  {
    scoreKey: "cognitive_composite_v1",
    minScore: 0,
    maxScore: 18,
    maxPossible: 54,
    bandKey: "lower_raw",
    bandLabelBs: "manji ukupni broj tačnih odgovora",
    domainLabelBs: "Ukupni rezultat",
    candidateTextBs:
      "Ukupni rezultat pokazuje manji broj tačnih odgovora u ovoj SAFRAN procjeni. To je opis učinka u vremenski ograničenom testu i treba ga čitati zajedno s pojedinačnim domenama i drugim informacijama iz procjene.",
  },
  {
    scoreKey: "cognitive_composite_v1",
    minScore: 19,
    maxScore: 36,
    maxPossible: 54,
    bandKey: "moderate_raw",
    bandLabelBs: "umjeren ukupni broj tačnih odgovora",
    domainLabelBs: "Ukupni rezultat",
    candidateTextBs:
      "Ukupni rezultat pokazuje umjeren broj tačnih odgovora u ovoj SAFRAN procjeni. To je opis učinka u vremenski ograničenom testu i najkorisnije ga je čitati zajedno s pojedinačnim domenama i drugim informacijama iz procjene.",
  },
  {
    scoreKey: "cognitive_composite_v1",
    minScore: 37,
    maxScore: 54,
    maxPossible: 54,
    bandKey: "higher_raw",
    bandLabelBs: "veći ukupni broj tačnih odgovora",
    domainLabelBs: "Ukupni rezultat",
    candidateTextBs:
      "Ukupni rezultat pokazuje veći broj tačnih odgovora u ovoj SAFRAN procjeni. To je opis učinka u vremenski ograničenom testu i najkorisnije ga je čitati zajedno s pojedinačnim domenama i drugim informacijama iz procjene.",
  },
  {
    scoreKey: "verbal_score",
    minScore: 0,
    maxScore: 6,
    maxPossible: 18,
    bandKey: "lower_raw",
    bandLabelBs: "manji broj tačnih odgovora",
    domainLabelBs: "Verbalni dio",
    candidateTextBs:
      "U verbalnom dijelu ostvario si manji broj tačnih odgovora. Ovaj dio prikazuje učinak na zadacima koji uključuju riječi, pojmove i odnose među njima.",
  },
  {
    scoreKey: "verbal_score",
    minScore: 7,
    maxScore: 12,
    maxPossible: 18,
    bandKey: "moderate_raw",
    bandLabelBs: "umjeren broj tačnih odgovora",
    domainLabelBs: "Verbalni dio",
    candidateTextBs:
      "U verbalnom dijelu ostvario si umjeren broj tačnih odgovora. Ovaj dio prikazuje učinak na zadacima koji uključuju riječi, pojmove i odnose među njima.",
  },
  {
    scoreKey: "verbal_score",
    minScore: 13,
    maxScore: 18,
    maxPossible: 18,
    bandKey: "higher_raw",
    bandLabelBs: "veći broj tačnih odgovora",
    domainLabelBs: "Verbalni dio",
    candidateTextBs:
      "U verbalnom dijelu ostvario si veći broj tačnih odgovora. Ovaj dio prikazuje učinak na zadacima koji uključuju riječi, pojmove i odnose među njima.",
  },
  {
    scoreKey: "figural_score",
    minScore: 0,
    maxScore: 6,
    maxPossible: 18,
    bandKey: "lower_raw",
    bandLabelBs: "manji broj tačnih odgovora",
    domainLabelBs: "Figuralni dio",
    candidateTextBs:
      "U figuralnom dijelu ostvario si manji broj tačnih odgovora. Ovaj dio prikazuje učinak na zadacima prepoznavanja obrazaca i odnosa među oblicima.",
  },
  {
    scoreKey: "figural_score",
    minScore: 7,
    maxScore: 12,
    maxPossible: 18,
    bandKey: "moderate_raw",
    bandLabelBs: "umjeren broj tačnih odgovora",
    domainLabelBs: "Figuralni dio",
    candidateTextBs:
      "U figuralnom dijelu ostvario si umjeren broj tačnih odgovora. Ovaj dio prikazuje učinak na zadacima prepoznavanja obrazaca i odnosa među oblicima.",
  },
  {
    scoreKey: "figural_score",
    minScore: 13,
    maxScore: 18,
    maxPossible: 18,
    bandKey: "higher_raw",
    bandLabelBs: "veći broj tačnih odgovora",
    domainLabelBs: "Figuralni dio",
    candidateTextBs:
      "U figuralnom dijelu ostvario si veći broj tačnih odgovora. Ovaj dio prikazuje učinak na zadacima prepoznavanja obrazaca i odnosa među oblicima.",
  },
  {
    scoreKey: "numerical_series_score",
    minScore: 0,
    maxScore: 6,
    maxPossible: 18,
    bandKey: "lower_raw",
    bandLabelBs: "manji broj tačnih odgovora",
    domainLabelBs: "Numerički rezultat",
    candidateTextBs:
      "U numeričkim nizovima ostvario si manji broj tačnih odgovora. Ovaj dio prikazuje učinak na zadacima u kojima je trebalo prepoznati pravilo u brojevnom nizu.",
  },
  {
    scoreKey: "numerical_series_score",
    minScore: 7,
    maxScore: 12,
    maxPossible: 18,
    bandKey: "moderate_raw",
    bandLabelBs: "umjeren broj tačnih odgovora",
    domainLabelBs: "Numerički rezultat",
    candidateTextBs:
      "U numeričkim nizovima ostvario si umjeren broj tačnih odgovora. Ovaj dio prikazuje učinak na zadacima u kojima je trebalo prepoznati pravilo u brojevnom nizu.",
  },
  {
    scoreKey: "numerical_series_score",
    minScore: 13,
    maxScore: 18,
    maxPossible: 18,
    bandKey: "higher_raw",
    bandLabelBs: "veći broj tačnih odgovora",
    domainLabelBs: "Numerički rezultat",
    candidateTextBs:
      "U numeričkim nizovima ostvario si veći broj tačnih odgovora. Ovaj dio prikazuje učinak na zadacima u kojima je trebalo prepoznati pravilo u brojevnom nizu.",
  },
];

function isValidScoreValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getSafranInterpretationRule(
  scoreKey: SafranScoreKey,
  score: number,
): SafranInterpretationRule | null {
  return (
    SAFRAN_INTERPRETATION_RULES.find(
      (rule) => rule.scoreKey === scoreKey && score >= rule.minScore && score <= rule.maxScore,
    ) ?? null
  );
}

function buildRelativeProfile(
  scores: SafranCandidateInterpretationScores,
): string | null {
  const overallScore = scores.cognitive_composite_v1;
  const verbalScore = scores.verbal_score;
  const figuralScore = scores.figural_score;
  const numericalScore = scores.numerical_series_score;

  if (
    !isValidScoreValue(overallScore) ||
    overallScore < 19 ||
    !isValidScoreValue(verbalScore) ||
    !isValidScoreValue(figuralScore) ||
    !isValidScoreValue(numericalScore)
  ) {
    return null;
  }

  const domainPercents = [
    { domainLabelBs: "Verbalni dio", percent: verbalScore / 18 },
    { domainLabelBs: "Figuralni dio", percent: figuralScore / 18 },
    { domainLabelBs: "Numerički rezultat", percent: numericalScore / 18 },
  ].sort((left, right) => right.percent - left.percent);

  const highest = domainPercents[0];
  const second = domainPercents[1];
  const third = domainPercents[2];

  if (!highest || !second || !third) {
    return null;
  }

  if (highest.percent - third.percent < 0.15) {
    return "Tvoji rezultati po domenama su relativno ujednačeni u okviru ove procjene. To znači da se broj tačnih odgovora ne izdvaja snažno u jednom dijelu testa, ali ne predstavlja normirani profil niti poređenje s drugim kandidatima.";
  }

  if (highest.percent - second.percent >= 0.15) {
    return `U okviru ovog testa, najviše tačnih odgovora ostvario si u dijelu: ${highest.domainLabelBs}. To može biti korisno kao orijentir za razumijevanje tvog profila u ovoj procjeni, ali ne predstavlja širu procjenu sposobnosti izvan testa.`;
  }

  if (highest.percent - second.percent < 0.15 && second.percent - third.percent >= 0.15) {
    return `U okviru ovog testa, najviše tačnih odgovora ostvario si u dijelovima: ${highest.domainLabelBs} i ${second.domainLabelBs}. Ovaj odnos opisuje samo tvoj rezultat u SAFRAN procjeni i ne treba ga čitati kao trajnu oznaku tvojih sposobnosti.`;
  }

  return null;
}

export function getSafranInterpretationFallbackText(options?: {
  scoreKey?: SafranScoreKey;
  reason?: "missing" | "invalid_range";
}): string {
  if (options?.reason === "invalid_range") {
    return INVALID_RANGE_FALLBACK_BS;
  }

  if (options?.scoreKey === "cognitive_composite_v1") {
    return OVERALL_FALLBACK_BS;
  }

  return DOMAIN_FALLBACK_BS;
}

export function buildSafranCandidateInterpretation(
  scores: SafranCandidateInterpretationScores,
): SafranCandidateInterpretation {
  const overallScore = scores.cognitive_composite_v1;
  const overallRule =
    isValidScoreValue(overallScore) && getSafranInterpretationRule("cognitive_composite_v1", overallScore);

  const domains = SAFRAN_DOMAIN_DEFINITIONS.flatMap((domainDefinition) => {
    const score = scores[domainDefinition.scoreKey];

    if (!isValidScoreValue(score)) {
      return [];
    }

    const rule = getSafranInterpretationRule(domainDefinition.scoreKey, score);

    if (!rule) {
      return [];
    }

    return [
      {
        scoreKey: domainDefinition.scoreKey,
        domainLabelBs: rule.domainLabelBs,
        score,
        maxPossible: rule.maxPossible,
        bandKey: rule.bandKey,
        bandLabelBs: rule.bandLabelBs,
        textBs: rule.candidateTextBs,
      },
    ];
  });

  return {
    introBs: SAFRAN_INTERPRETATION_INTRO,
    overall:
      isValidScoreValue(overallScore) && overallRule
        ? {
            score: overallScore,
            maxPossible: overallRule.maxPossible,
            bandKey: overallRule.bandKey,
            bandLabelBs: overallRule.bandLabelBs,
            textBs: overallRule.candidateTextBs,
          }
        : null,
    domains,
    relativeProfileBs: buildRelativeProfile(scores),
    limitationsBs: [...SAFRAN_INTERPRETATION_LIMITATIONS],
  };
}
