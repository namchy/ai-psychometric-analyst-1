import type { ReportLocale } from "@/lib/assessment/locale";

export type ReportLanguageAudience = "hr" | "participant";
export type ReportLanguageReportType = "composite" | "single_test";
export type ReportLanguageQualityContext = "composite_hr_report";

export type ReportLanguageQualityIssueCode =
  | "FORBIDDEN_PHRASE"
  | "FORBIDDEN_TERM"
  | "GLOSSARY_VIOLATION"
  | "FORBIDDEN_HIRING_DECISION"
  | "FORBIDDEN_DEBUG_LANGUAGE"
  | "NARRATIVE_CASING_VIOLATION";

export type ReportLanguageQualityIssue = {
  code: ReportLanguageQualityIssueCode;
  phrase: string;
  suggestion?: string;
};

export type ReportLanguageQualityResult = {
  ok: boolean;
  issues: ReportLanguageQualityIssue[];
};

type ReportLanguageQualityParams = {
  snapshot?: unknown;
  text?: string;
  locale: ReportLocale;
  audience: ReportLanguageAudience;
  reportType: ReportLanguageReportType;
  context?: ReportLanguageQualityContext;
};

type PhraseRule = {
  code: ReportLanguageQualityIssueCode;
  phrase: string;
  suggestion?: string;
  appliesToBhsOnly?: boolean;
};

type PatternRule = {
  code: ReportLanguageQualityIssueCode;
  pattern: RegExp;
  phrase: string;
  suggestion?: string;
  appliesToBhsOnly?: boolean;
};

export const COMPOSITE_HR_BHS_LANGUAGE_RULES = [
  "Koristi prirodan bosanski/hrvatski/srpski HR jezik; MVP primarno bosanski.",
  "Bez bukvalnih prevoda, engleskih kalkova i rogobatnih konstrukcija poput 'rokovi visoki'.",
  "U BHS narativnim recenicama nazive domena i dimenzija pisi malim slovom kada nisu na pocetku recenice; display/evidence labeli mogu ostati kapitalizovani.",
  "Bez tehnickog ili debug jezika u user-facing tekstu.",
  "Bez hire/no-hire preporuka, bez fit score jezika i bez tvrdnji da report samostalno odlucuje o kandidatu.",
  "Ne mijenjaj score, band, source attempt IDs, generatedFor identitet niti bilo koju deterministicku input vrijednost.",
  "Report mora ostati HR-facing: selekcija, intervju, onboarding, menadzerska podrska i timski kontekst.",
  "Koristi oprezne hipoteze i signale za provjeru, ne presude.",
  "Ne koristi krace sinonime za psihometrijske domene ako narusavaju terminolosku konzistentnost.",
] as const;

export const COMPOSITE_HR_BHS_GLOSSARY_PROMPT = [
  "Za AGREEABLENESS uvijek koristi 'Spremnost na saradnju'.",
  "Ne koristi 'Ugodnost'.",
  "Ne koristi 'Saradljivost'.",
  "Ne koristi 'Saradnja' kao naziv domena, evidence label ili direktnu zamjenu za AGREEABLENESS.",
  "Rijec 'saradnja' moze se koristiti prirodno u obicnom narativu kada ne zamjenjuje naziv domena.",
  "Za deadline pressure preferiraj 'pritisak rokova'; dozvoljeno je 'rad pod pritiskom rokova'.",
  "Za high standards koristi 'visoki standardi' samo u prirodnoj recenici; ne koristi konstrukcije poput 'standardi visoki'.",
  "Za performance pressure preferiraj 'pritisak ucinka' ili 'zahtjevi ucinka'.",
  "Za watchout/caution koristi formulacije poput 'na sta obratiti paznju', 'sta dodatno provjeriti', 'signali za provjeru' ili 'podrucja za dodatnu provjeru'.",
] as const;

export const COMPOSITE_HR_BHS_REVIEWER_RULES = [
  "Provjeri da li je tekst prirodan bosanski/hrvatski/srpski HR jezik, MVP primarno bosanski.",
  "Odbij bukvalne prevode, engleske kalkove i neprirodne konstrukcije poput 'rokovi visoki'.",
  "Odbij rogobatne ili polumasinski prevedene formulacije.",
  "Odbij engleski-style title casing domena ili dimenzija usred BHS narativne recenice, npr. 'vise izrazene Savjesnosti' ili 'Spremnosti na saradnju'.",
  "Ne odbij kapitalizovane display/evidence labele, naslove ili pocetak recenice, npr. 'Savjesnost' ili 'Spremnost na saradnju'.",
  "AGREEABLENESS mora ostati 'Spremnost na saradnju'.",
  "Odbij 'Ugodnost'.",
  "Odbij 'Saradljivost'.",
  "Odbij 'Saradnja' kada se koristi kao naziv domena, signal label ili evidence label za AGREEABLENESS.",
  "Ne odbij obicnu rijec 'saradnja' kada je prirodno upotrijebljena u narativu i ne zamjenjuje naziv domena.",
  "Deadline pressure treba biti 'pritisak rokova' ili 'rad pod pritiskom rokova' kada je relevantno.",
  "Performance pressure treba biti 'pritisak ucinka' ili 'zahtjevi ucinka' kada je relevantno.",
  "Odbij hire/no-hire preporuke, 'fit score', 'idealni kandidat', 'zaposliti' i 'ne zaposliti'.",
  "Odbij tvrdnje da report samostalno ili automatski odlucuje o kandidatu.",
  "Tekst mora koristiti hipoteze, signale i teme za provjeru, ne presude.",
  "Odbij debug i tehnicki jezik poput 'snapshot', 'renderer', 'generator metadata', 'source attempts' i 'linked attempts' u user-facing copyju.",
  "Provjeri da score, band, sourceAttemptIds, generatedFor identitet i instrumenti ostaju vjerni dostavljenom inputu.",
] as const;

const CORE_FORBIDDEN_PHRASES: PhraseRule[] = [
  { code: "FORBIDDEN_TERM", phrase: "fit score" },
  { code: "FORBIDDEN_HIRING_DECISION", phrase: "idealni kandidat" },
  { code: "FORBIDDEN_TERM", phrase: "hire" },
  { code: "FORBIDDEN_TERM", phrase: "no-hire" },
  { code: "FORBIDDEN_HIRING_DECISION", phrase: "preporucujemo zaposljavanje" },
  { code: "FORBIDDEN_HIRING_DECISION", phrase: "preporučujemo zapošljavanje" },
  { code: "FORBIDDEN_HIRING_DECISION", phrase: "ne preporucujemo zaposljavanje" },
  { code: "FORBIDDEN_HIRING_DECISION", phrase: "ne preporučujemo zapošljavanje" },
  { code: "FORBIDDEN_HIRING_DECISION", phrase: "konacna odluka" },
  { code: "FORBIDDEN_HIRING_DECISION", phrase: "konačna odluka" },
  { code: "FORBIDDEN_HIRING_DECISION", phrase: "konacna presuda" },
  { code: "FORBIDDEN_HIRING_DECISION", phrase: "konačna presuda" },
  { code: "FORBIDDEN_HIRING_DECISION", phrase: "automatski odlucuje o kandidatu" },
  { code: "FORBIDDEN_HIRING_DECISION", phrase: "automatski odlučuje o kandidatu" },
  { code: "FORBIDDEN_HIRING_DECISION", phrase: "samostalno odlucuje o kandidatu" },
  { code: "FORBIDDEN_HIRING_DECISION", phrase: "samostalno odlučuje o kandidatu" },
  { code: "FORBIDDEN_DEBUG_LANGUAGE", phrase: "debug" },
  { code: "FORBIDDEN_DEBUG_LANGUAGE", phrase: "json schema" },
  { code: "FORBIDDEN_DEBUG_LANGUAGE", phrase: "structured output" },
];

const COMPOSITE_HR_PROFILE_PHRASES: PhraseRule[] = [
  {
    code: "FORBIDDEN_PHRASE",
    phrase: "rokovi visoki",
    suggestion: "pritisak rokova",
    appliesToBhsOnly: true,
  },
  {
    code: "GLOSSARY_VIOLATION",
    phrase: "ugodnost",
    suggestion: "Spremnost na saradnju",
    appliesToBhsOnly: true,
  },
  {
    code: "GLOSSARY_VIOLATION",
    phrase: "saradljivost",
    suggestion: "Spremnost na saradnju",
    appliesToBhsOnly: true,
  },
];

const COMPOSITE_HR_AGREEABLENESS_LABEL_ALIASES = [
  "ugodnost",
  "saradljivost",
  "saradnja",
] as const;

const COMPOSITE_HR_PROFILE_PATTERNS: PatternRule[] = [
  {
    code: "FORBIDDEN_TERM",
    pattern: /(?:^|\W)fit score(?:\W|$)/i,
    phrase: "fit score",
  },
  {
    code: "FORBIDDEN_HIRING_DECISION",
    pattern: /idealni kandidat/i,
    phrase: "idealni kandidat",
  },
  {
    code: "FORBIDDEN_HIRING_DECISION",
    pattern: /(?:^|\W)zaposliti(?:\W|$)/i,
    phrase: "zaposliti",
  },
  {
    code: "FORBIDDEN_HIRING_DECISION",
    pattern: /(?:^|\W)ne\s+zaposliti(?:\W|$)/i,
    phrase: "ne zaposliti",
  },
  {
    code: "FORBIDDEN_TERM",
    pattern: /(?:^|\W)hire(?:\W|$)/i,
    phrase: "hire",
  },
  {
    code: "FORBIDDEN_TERM",
    pattern: /(?:^|\W)no-hire(?:\W|$)/i,
    phrase: "no-hire",
  },
];

const COMPOSITE_HR_NARRATIVE_CASING_PATTERNS: PatternRule[] = [
  {
    code: "NARRATIVE_CASING_VIOLATION",
    pattern: /[a-zčćžšđ]\s+(Savjesnost(?:i)?|Savjesnosti)\b/u,
    phrase: "Savjesnosti",
    suggestion: "savjesnosti",
    appliesToBhsOnly: true,
  },
  {
    code: "NARRATIVE_CASING_VIOLATION",
    pattern: /[a-zčćžšđ]\s+(Spremnost(?:i)? na saradnju|Spremnosti na saradnju)\b/u,
    phrase: "Spremnosti na saradnju",
    suggestion: "spremnosti na saradnju",
    appliesToBhsOnly: true,
  },
  {
    code: "NARRATIVE_CASING_VIOLATION",
    pattern: /[a-zčćžšđ]\s+(Neuroticizam|Neuroticizma)\b/u,
    phrase: "Neuroticizma",
    suggestion: "neuroticizma",
    appliesToBhsOnly: true,
  },
  {
    code: "NARRATIVE_CASING_VIOLATION",
    pattern: /[a-zčćžšđ]\s+(Ekstraverzija|Ekstraverzije)\b/u,
    phrase: "Ekstraverzije",
    suggestion: "ekstraverzije",
    appliesToBhsOnly: true,
  },
  {
    code: "NARRATIVE_CASING_VIOLATION",
    pattern: /[a-zčćžšđ]\s+(Otvorenost|Otvorenosti)\b/u,
    phrase: "Otvorenosti",
    suggestion: "otvorenosti",
    appliesToBhsOnly: true,
  },
  {
    code: "NARRATIVE_CASING_VIOLATION",
    pattern: /[a-zčćžšđ]\s+(Intrinzična motivacija|Intrinzične motivacije)\b/u,
    phrase: "Intrinzične motivacije",
    suggestion: "intrinzične motivacije",
    appliesToBhsOnly: true,
  },
  {
    code: "NARRATIVE_CASING_VIOLATION",
    pattern: /[a-zčćžšđ]\s+(Identifikovana motivacija|Identifikovane motivacije)\b/u,
    phrase: "Identifikovane motivacije",
    suggestion: "identifikovane motivacije",
    appliesToBhsOnly: true,
  },
];

function collectStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output);
    }

    return output;
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      collectStrings(nestedValue, output);
    }
  }

  return output;
}

function collectCompositeHrUserFacingStrings(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return [];
  }

  const candidate = snapshot as {
    summary?: unknown;
    integratedSignals?: unknown;
    interviewGuidance?: unknown;
    onboardingGuidance?: unknown;
    limitations?: unknown;
  };

  return collectStrings(
    {
      summary: candidate.summary,
      integratedSignals: candidate.integratedSignals,
      interviewGuidance: candidate.interviewGuidance,
      onboardingGuidance: candidate.onboardingGuidance,
      limitations: candidate.limitations,
    },
    [],
  );
}

function collectCompositeHrNarrativeStrings(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return [];
  }

  const candidate = snapshot as {
    summary?: {
      profileOverview?: unknown;
      keyStrengths?: unknown;
      watchouts?: unknown;
    };
    integratedSignals?: Array<{
      body?: unknown;
    }>;
    interviewGuidance?: {
      focusAreas?: Array<{
        rationale?: unknown;
        questions?: unknown;
      }>;
    };
    onboardingGuidance?: {
      managementTips?: unknown;
      supportNeeds?: unknown;
    };
    limitations?: unknown;
  };

  return collectStrings(
    {
      summary: {
        profileOverview: candidate.summary?.profileOverview,
        keyStrengths: candidate.summary?.keyStrengths,
        watchouts: candidate.summary?.watchouts,
      },
      integratedSignals: candidate.integratedSignals?.map((signal) => ({
        body: signal?.body,
      })),
      interviewGuidance: {
        focusAreas: candidate.interviewGuidance?.focusAreas?.map((area) => ({
          rationale: area?.rationale,
          questions: area?.questions,
        })),
      },
      onboardingGuidance: candidate.onboardingGuidance,
      limitations: candidate.limitations,
    },
    [],
  );
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isBhsLocale(locale: ReportLocale): boolean {
  return locale === "bs" || locale === "hr" || locale === "sr";
}

function shouldApplyBhsRule(locale: ReportLocale, rule: PhraseRule | PatternRule): boolean {
  return !rule.appliesToBhsOnly || isBhsLocale(locale);
}

function pushIssue(
  issues: ReportLanguageQualityIssue[],
  issue: ReportLanguageQualityIssue,
): void {
  const alreadyPresent = issues.some(
    (entry) => entry.code === issue.code && entry.phrase === issue.phrase,
  );

  if (!alreadyPresent) {
    issues.push(issue);
  }
}

function validatePhraseRules(
  normalizedText: string,
  locale: ReportLocale,
  rules: PhraseRule[],
  issues: ReportLanguageQualityIssue[],
): void {
  for (const rule of rules) {
    if (!shouldApplyBhsRule(locale, rule)) {
      continue;
    }

    if (normalizedText.includes(normalizeText(rule.phrase))) {
      pushIssue(issues, {
        code: rule.code,
        phrase: rule.phrase,
        suggestion: rule.suggestion,
      });
    }
  }
}

function validatePatternRules(
  text: string,
  locale: ReportLocale,
  rules: PatternRule[],
  issues: ReportLanguageQualityIssue[],
): void {
  for (const rule of rules) {
    if (!shouldApplyBhsRule(locale, rule)) {
      continue;
    }

    if (rule.pattern.test(text)) {
      pushIssue(issues, {
        code: rule.code,
        phrase: rule.phrase,
        suggestion: rule.suggestion,
      });
    }
  }
}

function buildQualityText(params: ReportLanguageQualityParams): string {
  if (typeof params.text === "string" && params.text.trim().length > 0) {
    return params.text;
  }

  if (
    params.audience === "hr" &&
    params.reportType === "composite" &&
    params.context === "composite_hr_report"
  ) {
    return collectCompositeHrUserFacingStrings(params.snapshot).join("\n");
  }

  return collectStrings(params.snapshot).join("\n");
}

function buildCompositeHrNarrativeQualityText(params: ReportLanguageQualityParams): string {
  if (typeof params.text === "string" && params.text.trim().length > 0) {
    return params.text;
  }

  return collectCompositeHrNarrativeStrings(params.snapshot).join("\n");
}

function normalizeLabelLikeValue(value: string): string {
  return normalizeText(value)
    .replace(/^[\s:;,\-.()]+|[\s:;,\-.()]+$/g, "")
    .trim();
}

function collectCompositeHrLabelLikeValues(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return [];
  }

  const candidate = snapshot as {
    integratedSignals?: Array<{
      evidence?: Array<{
        label?: unknown;
      }>;
    }>;
  };

  const labels: string[] = [];

  for (const signal of candidate.integratedSignals ?? []) {
    for (const evidence of signal?.evidence ?? []) {
      if (typeof evidence?.label === "string" && evidence.label.trim().length > 0) {
        labels.push(evidence.label);
      }
    }
  }

  return labels;
}

function validateCompositeHrAgreeablenessLabelLikeValues(
  snapshot: unknown,
  issues: ReportLanguageQualityIssue[],
): void {
  for (const label of collectCompositeHrLabelLikeValues(snapshot)) {
    const normalizedLabel = normalizeLabelLikeValue(label);

    if (normalizedLabel === "spremnost na saradnju") {
      continue;
    }

    if (COMPOSITE_HR_AGREEABLENESS_LABEL_ALIASES.includes(
      normalizedLabel as (typeof COMPOSITE_HR_AGREEABLENESS_LABEL_ALIASES)[number],
    )) {
      pushIssue(issues, {
        code: "GLOSSARY_VIOLATION",
        phrase: label,
        suggestion: "Spremnost na saradnju",
      });
    }
  }
}

export function formatReportLanguageQualityIssues(issues: ReportLanguageQualityIssue[]): string {
  return issues
    .map((issue) =>
      issue.suggestion
        ? `${issue.code}: "${issue.phrase}" -> "${issue.suggestion}"`
        : `${issue.code}: "${issue.phrase}"`,
    )
    .join("; ");
}

export function validateReportLanguageQuality(
  params: ReportLanguageQualityParams,
): ReportLanguageQualityResult {
  const text = buildQualityText(params);
  const normalizedText = normalizeText(text);
  const issues: ReportLanguageQualityIssue[] = [];

  validatePhraseRules(normalizedText, params.locale, CORE_FORBIDDEN_PHRASES, issues);

  if (
    params.audience === "hr" &&
    params.reportType === "composite" &&
    params.context === "composite_hr_report"
  ) {
    validatePhraseRules(normalizedText, params.locale, COMPOSITE_HR_PROFILE_PHRASES, issues);
    validatePatternRules(text, params.locale, COMPOSITE_HR_PROFILE_PATTERNS, issues);
    validatePatternRules(
      buildCompositeHrNarrativeQualityText(params),
      params.locale,
      COMPOSITE_HR_NARRATIVE_CASING_PATTERNS,
      issues,
    );
    validateCompositeHrAgreeablenessLabelLikeValues(params.snapshot, issues);
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function assertReportLanguageQuality(params: ReportLanguageQualityParams): void {
  const result = validateReportLanguageQuality(params);

  if (!result.ok) {
    throw new Error(
      `Report language quality validation failed: ${formatReportLanguageQualityIssues(result.issues)}`,
    );
  }
}
