import type { ReportLocale } from "@/lib/assessment/locale";

export type ReportLanguageAudience = "hr" | "participant";
export type ReportLanguageReportType = "composite" | "single_test";
export type ReportLanguageQualityContext =
  | "composite_hr_report"
  | "ipip_hr_report"
  | "individual_development_profile_hr_report";

export type ReportLanguageQualityIssueCode =
  | "FORBIDDEN_PHRASE"
  | "FORBIDDEN_TERM"
  | "GLOSSARY_VIOLATION"
  | "FORBIDDEN_HIRING_DECISION"
  | "FORBIDDEN_DEBUG_LANGUAGE"
  | "NARRATIVE_CASING_VIOLATION"
  | "SUMMARY_WRITING_QUALITY"
  | "FORBIDDEN_HR_SECOND_PERSON"
  | "SCORE_SUMMARY_PROSE"
  | "MECHANICAL_FACET_LIST"
  | "MISSING_HR_BEHAVIORAL_THEME"
  | "FORBIDDEN_SCRIPT"
  | "REPETITIVE_WORDING";

export type ReportLanguageQualityIssue = {
  code: ReportLanguageQualityIssueCode;
  phrase: string;
  path?: string;
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

type TextEntry = {
  path: string;
  value: string;
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
  "Composite HR summary treba biti kratak, skenabilan i akcijski: headline priblizno do 90 znakova, profileOverview najvise 3 jasne recenice, a fokus za provjeru direktna HR akcija.",
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

const COMPOSITE_HR_SUMMARY_ACTION_PATTERN =
  /\b(?:U intervjuu\s+(?:direktno\s+)?provjerite|Direktno\s+provjerite|Prvo\s+razjasnite|Tražite\s+primjer|Trazite\s+primjer|Koristite\s+ovaj\s+nalaz)\b/u;

const COMPOSITE_HR_PASSIVE_SUMMARY_FOCUS_PATTERN =
  /Područje\s+za\s+dodatnu\s+provjeru\s+je|Podrucje\s+za\s+dodatnu\s+provjeru\s+je/iu;

const IPIP_HR_FORBIDDEN_TERMS: PhraseRule[] = [
  {
    code: "GLOSSARY_VIOLATION",
    phrase: "Ugodnost",
    suggestion: "Spremnost na saradnju",
    appliesToBhsOnly: true,
  },
  {
    code: "GLOSSARY_VIOLATION",
    phrase: "Saradljivost",
    suggestion: "Spremnost na saradnju",
    appliesToBhsOnly: true,
  },
  {
    code: "GLOSSARY_VIOLATION",
    phrase: "Kooperativnost",
    suggestion: "Spremnost na saradnju",
    appliesToBhsOnly: true,
  },
  {
    code: "GLOSSARY_VIOLATION",
    phrase: "Saradnički profil",
    suggestion: "spremnost na saradnju",
    appliesToBhsOnly: true,
  },
  {
    code: "FORBIDDEN_TERM",
    phrase: "overuse",
    suggestion: "prekomjerno oslanjanje",
    appliesToBhsOnly: true,
  },
  {
    code: "FORBIDDEN_TERM",
    phrase: "handling",
    suggestion: "postupanje",
    appliesToBhsOnly: true,
  },
];

const IPIP_HR_PROMINENT_FIELD_PATHS = new Set([
  "headline",
  "executive_summary",
  "key_hr_signals[0].title",
  "key_hr_signals[0].evidence",
  "key_hr_signals[0].hr_implication",
  "key_hr_signals[1].title",
  "key_hr_signals[1].evidence",
  "key_hr_signals[1].hr_implication",
  "key_hr_signals[2].title",
  "key_hr_signals[2].evidence",
  "key_hr_signals[2].hr_implication",
  "domain_overview[0].concise_meaning",
  "domain_overview[1].concise_meaning",
  "domain_overview[2].concise_meaning",
  "domain_overview[3].concise_meaning",
  "domain_overview[4].concise_meaning",
]);

const IPIP_HR_DOMAIN_LABEL_PATTERN =
  "(?:Savjesnost|Spremnost na saradnju|Neuroticizam|Ekstraverzija|Otvorenost prema iskustvu)";

const IPIP_HR_SCORE_SUMMARY_PATTERNS: PatternRule[] = [
  {
    code: "SCORE_SUMMARY_PROSE",
    pattern: new RegExp(`^\\s*${IPIP_HR_DOMAIN_LABEL_PATTERN}\\s+je\\s+u\\s+[^.!?]{0,40}rasponu`, "iu"),
    phrase: "domain je u rasponu",
    suggestion: "Open with the HR behavior pattern, then mention domain/facet evidence if needed.",
    appliesToBhsOnly: true,
  },
  {
    code: "SCORE_SUMMARY_PROSE",
    pattern: new RegExp(`^\\s*${IPIP_HR_DOMAIN_LABEL_PATTERN}\\s+je\\s+(?:visoko|nisko|niže|umjereno)\\s+izra`, "iu"),
    phrase: "domain je izrazen",
    suggestion: "Open with the HR behavior pattern, not the score band translation.",
    appliesToBhsOnly: true,
  },
  {
    code: "SCORE_SUMMARY_PROSE",
    pattern: /\b(?:high|low|medium|moderate)\b/iu,
    phrase: "English score band term",
    suggestion: "Use BHS user-facing wording and keep bands as evidence, not prose lead.",
    appliesToBhsOnly: true,
  },
];

const IPIP_HR_MECHANICAL_FACET_PATTERNS: PatternRule[] = [
  {
    code: "MECHANICAL_FACET_LIST",
    pattern: /\buz\s+(?:visok\w*|nisk\w*|niž\w*|umjeren\w*)\s+facete\b/iu,
    phrase: "uz visoke facete",
    suggestion: "Mention at most 2-3 facets only when tied to concrete work behavior.",
    appliesToBhsOnly: true,
  },
  {
    code: "MECHANICAL_FACET_LIST",
    pattern: /\buz\s+(?:visoko|nisko|niže|umjereno)\s+izražen\w*\s+[^.!?]{0,120}(?:,\s*[^,.!?]+){3,}/iu,
    phrase: "mechanical facet list",
    suggestion: "Avoid long facet lists; write the behavioral implication first.",
    appliesToBhsOnly: true,
  },
];

const IPIP_HR_IJEKAVICA_PATTERNS: PatternRule[] = [
  {
    code: "FORBIDDEN_PHRASE",
    pattern: /\bizveštaj\b|\bizvestaj\b/iu,
    phrase: "izveštaj",
    suggestion: "izvještaj",
    appliesToBhsOnly: true,
  },
  {
    code: "FORBIDDEN_PHRASE",
    pattern: /\bprover(?:a|e|i|iti|ite|ava\w*)\b/iu,
    phrase: "proveriti",
    suggestion: "provjeriti",
    appliesToBhsOnly: true,
  },
  {
    code: "FORBIDDEN_PHRASE",
    pattern: /\bsledeć\w*\b|\bsledec\w*\b/iu,
    phrase: "sledeći",
    suggestion: "sljedeći",
    appliesToBhsOnly: true,
  },
];

const IPIP_HR_SECOND_PERSON_PATTERNS: PatternRule[] = [
  {
    code: "FORBIDDEN_HR_SECOND_PERSON",
    pattern: /(^|[^A-Za-zČĆŽŠĐčćžšđ])ti([^A-Za-zČĆŽŠĐčćžšđ]|$)/iu,
    phrase: "ti",
    suggestion: "HR report must not address the candidate in second person.",
    appliesToBhsOnly: true,
  },
  {
    code: "FORBIDDEN_HR_SECOND_PERSON",
    pattern: /(^|[^A-Za-zČĆŽŠĐčćžšđ])tvoj(?:a|e|i|ih|im|oj|om|og)?([^A-Za-zČĆŽŠĐčćžšđ]|$)/iu,
    phrase: "tvoj",
    suggestion: "HR report must not address the candidate in second person.",
    appliesToBhsOnly: true,
  },
];

const IPIP_HR_CYRILLIC_PATTERN: PatternRule = {
  code: "FORBIDDEN_SCRIPT",
  pattern: /[\u0400-\u04FF]/u,
  phrase: "Cyrillic script",
  suggestion: "Use Latin script for bs user-facing report text.",
  appliesToBhsOnly: true,
};

const IDP_HR_FORBIDDEN_TERMS: PhraseRule[] = [
  {
    code: "GLOSSARY_VIOLATION",
    phrase: "ugodnost",
    suggestion: "Spremnost na saradnju",
    appliesToBhsOnly: true,
  },
  {
    code: "FORBIDDEN_TERM",
    phrase: "HR-facing",
    suggestion: "HR razvojni",
    appliesToBhsOnly: true,
  },
  {
    code: "FORBIDDEN_TERM",
    phrase: "reduced",
    suggestion: "sažeti",
    appliesToBhsOnly: true,
  },
  {
    code: "FORBIDDEN_TERM",
    phrase: "AI narativ",
    suggestion: "razvojna interpretacija",
    appliesToBhsOnly: true,
  },
  {
    code: "FORBIDDEN_TERM",
    phrase: "AI-generated",
    suggestion: "generisani izvještaj",
    appliesToBhsOnly: true,
  },
];

const IDP_HR_INTERNAL_WORDING_PATTERNS: PatternRule[] = [
  {
    code: "FORBIDDEN_DEBUG_LANGUAGE",
    pattern: /\bnumeric\b/iu,
    phrase: "numeric",
    suggestion: "Use natural BHS report wording.",
    appliesToBhsOnly: true,
  },
  {
    code: "FORBIDDEN_DEBUG_LANGUAGE",
    pattern: /\bsource\b/iu,
    phrase: "source",
    suggestion: "Use user-facing source labels only when needed.",
    appliesToBhsOnly: true,
  },
  {
    code: "FORBIDDEN_DEBUG_LANGUAGE",
    pattern: /\bmetadata\b/iu,
    phrase: "metadata",
    suggestion: "Do not expose implementation metadata in report copy.",
    appliesToBhsOnly: true,
  },
  {
    code: "FORBIDDEN_DEBUG_LANGUAGE",
    pattern: /\bsnapshot\b/iu,
    phrase: "snapshot",
    suggestion: "Use izvještaj or nalaz in user-facing copy.",
    appliesToBhsOnly: true,
  },
];

const IDP_HR_SIGNAL_REPETITION_THRESHOLD = 32;

const IPIP_HR_DOMAIN_RESTATEMENT_TITLES = new Set([
  "savjesnost",
  "spremnost na saradnju",
  "neuroticizam",
  "ekstraverzija",
  "otvorenost prema iskustvu",
]);

const IPIP_HR_BEHAVIOR_THEME_PATTERN =
  /\b(?:pouzdanost|izvršenje|izvrsenje|saradnja|granice|pritisak|komunikacij|promjen|rokov|odluk|odgovornost|timsk|podrš|podrsk|prioritet|onboarding|intervju|radn\w*\s+ritam|način\s+rada|nacin\s+rada)\b/iu;

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

function pushStringEntry(entries: TextEntry[], path: string, value: unknown): void {
  if (typeof value === "string" && value.trim().length > 0) {
    entries.push({ path, value });
  }
}

function collectStringListEntries(entries: TextEntry[], path: string, value: unknown): void {
  if (!Array.isArray(value)) {
    return;
  }

  value.forEach((item, index) => pushStringEntry(entries, `${path}[${index}]`, item));
}

function collectIpipHrUserFacingEntries(snapshot: unknown): TextEntry[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return [];
  }

  const report = snapshot as {
    headline?: unknown;
    executive_summary?: unknown;
    key_hr_signals?: Array<{
      title?: unknown;
      evidence?: unknown;
      hr_implication?: unknown;
    }>;
    verification_focus?: Array<{
      area?: unknown;
      why_it_matters?: unknown;
      how_to_check?: unknown;
    }>;
    interview_questions?: Array<{
      question?: unknown;
      evaluates?: unknown;
      what_good_answer_may_show?: unknown;
    }>;
    strengths_and_overuse_risks?: Array<{
      trait_or_pattern?: unknown;
      possible_strengths?: unknown;
      possible_overuse_risks?: unknown;
      hr_handling_tip?: unknown;
    }>;
    domain_overview?: Array<{
      domain_name?: unknown;
      concise_meaning?: unknown;
      hr_relevance?: unknown;
      check_in_interview?: unknown;
      top_facets?: Array<{
        facet_name?: unknown;
        relevance?: unknown;
      }>;
    }>;
    onboarding_and_management_guidance?: Array<{
      recommendation?: unknown;
      why?: unknown;
      first_30_days_application?: unknown;
    }>;
    team_fit_notes?: Array<{
      fit_condition?: unknown;
      may_work_well_when?: unknown;
      watchout?: unknown;
    }>;
    decision_support_note?: unknown;
    interpretation_note?: unknown;
  };
  const entries: TextEntry[] = [];

  pushStringEntry(entries, "headline", report.headline);
  pushStringEntry(entries, "executive_summary", report.executive_summary);

  report.key_hr_signals?.forEach((signal, index) => {
    pushStringEntry(entries, `key_hr_signals[${index}].title`, signal?.title);
    pushStringEntry(entries, `key_hr_signals[${index}].evidence`, signal?.evidence);
    pushStringEntry(entries, `key_hr_signals[${index}].hr_implication`, signal?.hr_implication);
  });

  report.verification_focus?.forEach((focus, index) => {
    pushStringEntry(entries, `verification_focus[${index}].area`, focus?.area);
    pushStringEntry(entries, `verification_focus[${index}].why_it_matters`, focus?.why_it_matters);
    pushStringEntry(entries, `verification_focus[${index}].how_to_check`, focus?.how_to_check);
  });

  report.interview_questions?.forEach((question, index) => {
    pushStringEntry(entries, `interview_questions[${index}].question`, question?.question);
    pushStringEntry(entries, `interview_questions[${index}].evaluates`, question?.evaluates);
    pushStringEntry(
      entries,
      `interview_questions[${index}].what_good_answer_may_show`,
      question?.what_good_answer_may_show,
    );
  });

  report.strengths_and_overuse_risks?.forEach((item, index) => {
    pushStringEntry(entries, `strengths_and_overuse_risks[${index}].trait_or_pattern`, item?.trait_or_pattern);
    collectStringListEntries(entries, `strengths_and_overuse_risks[${index}].possible_strengths`, item?.possible_strengths);
    collectStringListEntries(entries, `strengths_and_overuse_risks[${index}].possible_overuse_risks`, item?.possible_overuse_risks);
    pushStringEntry(entries, `strengths_and_overuse_risks[${index}].hr_handling_tip`, item?.hr_handling_tip);
  });

  report.domain_overview?.forEach((domain, index) => {
    pushStringEntry(entries, `domain_overview[${index}].domain_name`, domain?.domain_name);
    pushStringEntry(entries, `domain_overview[${index}].concise_meaning`, domain?.concise_meaning);
    pushStringEntry(entries, `domain_overview[${index}].hr_relevance`, domain?.hr_relevance);
    pushStringEntry(entries, `domain_overview[${index}].check_in_interview`, domain?.check_in_interview);
    domain?.top_facets?.forEach((facet, facetIndex) => {
      pushStringEntry(
        entries,
        `domain_overview[${index}].top_facets[${facetIndex}].facet_name`,
        facet?.facet_name,
      );
      pushStringEntry(
        entries,
        `domain_overview[${index}].top_facets[${facetIndex}].relevance`,
        facet?.relevance,
      );
    });
  });

  report.onboarding_and_management_guidance?.forEach((item, index) => {
    pushStringEntry(entries, `onboarding_and_management_guidance[${index}].recommendation`, item?.recommendation);
    pushStringEntry(entries, `onboarding_and_management_guidance[${index}].why`, item?.why);
    pushStringEntry(
      entries,
      `onboarding_and_management_guidance[${index}].first_30_days_application`,
      item?.first_30_days_application,
    );
  });

  report.team_fit_notes?.forEach((item, index) => {
    pushStringEntry(entries, `team_fit_notes[${index}].fit_condition`, item?.fit_condition);
    pushStringEntry(entries, `team_fit_notes[${index}].may_work_well_when`, item?.may_work_well_when);
    pushStringEntry(entries, `team_fit_notes[${index}].watchout`, item?.watchout);
  });

  collectStringListEntries(entries, "decision_support_note", report.decision_support_note);
  pushStringEntry(entries, "interpretation_note", report.interpretation_note);

  return entries;
}

function collectIpipHrUserFacingStrings(snapshot: unknown): string[] {
  return collectIpipHrUserFacingEntries(snapshot).map((entry) => entry.value);
}

function collectIndividualDevelopmentProfileHrUserFacingEntries(snapshot: unknown): TextEntry[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return [];
  }

  const report = snapshot as {
    developmentSummary?: {
      headline?: unknown;
      overallPattern?: unknown;
      strongestContributionSignals?: unknown;
      mainSupportNeed?: unknown;
      usageNote?: unknown;
    };
    contributionPattern?: {
      bestConditions?: unknown;
      collaborationConditions?: unknown;
      supportPreferences?: unknown;
      roleShapingImplications?: unknown;
    };
    developmentRisks?: Array<{
      possibleBlocker?: unknown;
      whyItMatters?: unknown;
      whatToCheck?: unknown;
      howToSupport?: unknown;
    }>;
    communicationAndFeedbackGuidance?: {
      whatHelps?: unknown;
      whatToAvoid?: unknown;
      howToPhraseFeedback?: unknown;
      whatToClarify?: unknown;
    };
    motivationAndEnergyGuidance?: {
      likelySourcesOfEnergy?: unknown;
      likelySourcesOfDrain?: unknown;
      supportSignals?: unknown;
      whatToValidate?: unknown;
    };
    oneOnOneGuidance?: Array<{
      question?: unknown;
      whatToListenFor?: unknown;
      signalBeingChecked?: unknown;
      possibleFollowUp?: unknown;
    }>;
    onboardingPlan?: {
      summary?: unknown;
      first7Days?: unknown;
      first30Days?: unknown;
      days31To60?: unknown;
      days61To90?: unknown;
      managerCheckpoints?: unknown;
      watchouts?: unknown;
    };
    managerWatchpoints?: Array<{
      watchpoint?: unknown;
      whyItMatters?: unknown;
      earlySignal?: unknown;
      suggestedManagerResponse?: unknown;
    }>;
    interpretationLimits?: unknown;
  };
  const entries: TextEntry[] = [];

  pushStringEntry(entries, "developmentSummary.headline", report.developmentSummary?.headline);
  pushStringEntry(entries, "developmentSummary.overallPattern", report.developmentSummary?.overallPattern);
  collectStringListEntries(
    entries,
    "developmentSummary.strongestContributionSignals",
    report.developmentSummary?.strongestContributionSignals,
  );
  pushStringEntry(entries, "developmentSummary.mainSupportNeed", report.developmentSummary?.mainSupportNeed);
  pushStringEntry(entries, "developmentSummary.usageNote", report.developmentSummary?.usageNote);

  collectStringListEntries(entries, "contributionPattern.bestConditions", report.contributionPattern?.bestConditions);
  collectStringListEntries(
    entries,
    "contributionPattern.collaborationConditions",
    report.contributionPattern?.collaborationConditions,
  );
  collectStringListEntries(entries, "contributionPattern.supportPreferences", report.contributionPattern?.supportPreferences);
  collectStringListEntries(
    entries,
    "contributionPattern.roleShapingImplications",
    report.contributionPattern?.roleShapingImplications,
  );

  report.developmentRisks?.forEach((risk, index) => {
    pushStringEntry(entries, `developmentRisks[${index}].possibleBlocker`, risk?.possibleBlocker);
    pushStringEntry(entries, `developmentRisks[${index}].whyItMatters`, risk?.whyItMatters);
    pushStringEntry(entries, `developmentRisks[${index}].whatToCheck`, risk?.whatToCheck);
    pushStringEntry(entries, `developmentRisks[${index}].howToSupport`, risk?.howToSupport);
  });

  collectStringListEntries(
    entries,
    "communicationAndFeedbackGuidance.whatHelps",
    report.communicationAndFeedbackGuidance?.whatHelps,
  );
  collectStringListEntries(
    entries,
    "communicationAndFeedbackGuidance.whatToAvoid",
    report.communicationAndFeedbackGuidance?.whatToAvoid,
  );
  collectStringListEntries(
    entries,
    "communicationAndFeedbackGuidance.howToPhraseFeedback",
    report.communicationAndFeedbackGuidance?.howToPhraseFeedback,
  );
  collectStringListEntries(
    entries,
    "communicationAndFeedbackGuidance.whatToClarify",
    report.communicationAndFeedbackGuidance?.whatToClarify,
  );

  collectStringListEntries(
    entries,
    "motivationAndEnergyGuidance.likelySourcesOfEnergy",
    report.motivationAndEnergyGuidance?.likelySourcesOfEnergy,
  );
  collectStringListEntries(
    entries,
    "motivationAndEnergyGuidance.likelySourcesOfDrain",
    report.motivationAndEnergyGuidance?.likelySourcesOfDrain,
  );
  collectStringListEntries(
    entries,
    "motivationAndEnergyGuidance.supportSignals",
    report.motivationAndEnergyGuidance?.supportSignals,
  );
  collectStringListEntries(
    entries,
    "motivationAndEnergyGuidance.whatToValidate",
    report.motivationAndEnergyGuidance?.whatToValidate,
  );

  report.oneOnOneGuidance?.forEach((item, index) => {
    pushStringEntry(entries, `oneOnOneGuidance[${index}].question`, item?.question);
    pushStringEntry(entries, `oneOnOneGuidance[${index}].whatToListenFor`, item?.whatToListenFor);
    pushStringEntry(entries, `oneOnOneGuidance[${index}].signalBeingChecked`, item?.signalBeingChecked);
    pushStringEntry(entries, `oneOnOneGuidance[${index}].possibleFollowUp`, item?.possibleFollowUp);
  });

  pushStringEntry(entries, "onboardingPlan.summary", report.onboardingPlan?.summary);
  for (const stageKey of ["first7Days", "first30Days", "days31To60", "days61To90"] as const) {
    const stage = report.onboardingPlan?.[stageKey] as
      | {
          focus?: unknown;
          managerActions?: unknown;
          feedbackGuidance?: unknown;
          riskSignals?: unknown;
        }
      | undefined;
    pushStringEntry(entries, `onboardingPlan.${stageKey}.focus`, stage?.focus);
    collectStringListEntries(entries, `onboardingPlan.${stageKey}.managerActions`, stage?.managerActions);
    collectStringListEntries(entries, `onboardingPlan.${stageKey}.feedbackGuidance`, stage?.feedbackGuidance);
    collectStringListEntries(entries, `onboardingPlan.${stageKey}.riskSignals`, stage?.riskSignals);
  }
  collectStringListEntries(entries, "onboardingPlan.managerCheckpoints", report.onboardingPlan?.managerCheckpoints);
  collectStringListEntries(entries, "onboardingPlan.watchouts", report.onboardingPlan?.watchouts);

  report.managerWatchpoints?.forEach((item, index) => {
    pushStringEntry(entries, `managerWatchpoints[${index}].watchpoint`, item?.watchpoint);
    pushStringEntry(entries, `managerWatchpoints[${index}].whyItMatters`, item?.whyItMatters);
    pushStringEntry(entries, `managerWatchpoints[${index}].earlySignal`, item?.earlySignal);
    pushStringEntry(
      entries,
      `managerWatchpoints[${index}].suggestedManagerResponse`,
      item?.suggestedManagerResponse,
    );
  });

  collectStringListEntries(entries, "interpretationLimits", report.interpretationLimits);

  return entries;
}

function collectIndividualDevelopmentProfileHrUserFacingStrings(snapshot: unknown): string[] {
  return collectIndividualDevelopmentProfileHrUserFacingEntries(snapshot).map((entry) => entry.value);
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
    (entry) =>
      entry.code === issue.code &&
      entry.phrase === issue.phrase &&
      entry.path === issue.path,
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

function validatePatternRulesForEntries(
  entries: TextEntry[],
  locale: ReportLocale,
  rules: PatternRule[],
  issues: ReportLanguageQualityIssue[],
  options?: {
    pathFilter?: (path: string) => boolean;
  },
): void {
  for (const entry of entries) {
    if (options?.pathFilter && !options.pathFilter(entry.path)) {
      continue;
    }

    for (const rule of rules) {
      if (!shouldApplyBhsRule(locale, rule)) {
        continue;
      }

      if (rule.pattern.test(entry.value)) {
        pushIssue(issues, {
          code: rule.code,
          phrase: rule.phrase,
          path: entry.path,
          suggestion: rule.suggestion,
        });
      }
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

  if (
    params.audience === "hr" &&
    params.reportType === "single_test" &&
    params.context === "ipip_hr_report"
  ) {
    return collectIpipHrUserFacingStrings(params.snapshot).join("\n");
  }

  if (
    params.audience === "hr" &&
    params.reportType === "single_test" &&
    params.context === "individual_development_profile_hr_report"
  ) {
    return collectIndividualDevelopmentProfileHrUserFacingStrings(params.snapshot).join("\n");
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

function validateCompositeHrSummaryWritingQuality(
  snapshot: unknown,
  locale: ReportLocale,
  issues: ReportLanguageQualityIssue[],
): void {
  if (!isBhsLocale(locale) || !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return;
  }

  const candidate = snapshot as {
    summary?: {
      headline?: unknown;
      profileOverview?: unknown;
      watchouts?: unknown;
    };
  };
  const summary = candidate.summary;

  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return;
  }

  if (typeof summary.headline === "string" && summary.headline.trim().length > 110) {
    pushIssue(issues, {
      code: "SUMMARY_WRITING_QUALITY",
      phrase: "summary.headline too long",
      suggestion: "Keep summary.headline short and close to 90 characters.",
    });
  }

  const profileOverview = typeof summary.profileOverview === "string" ? summary.profileOverview : "";
  const watchouts = Array.isArray(summary.watchouts)
    ? summary.watchouts.filter((item): item is string => typeof item === "string")
    : [];
  const summaryFocusText = [profileOverview, ...watchouts].join("\n");

  if (COMPOSITE_HR_PASSIVE_SUMMARY_FOCUS_PATTERN.test(summaryFocusText)) {
    pushIssue(issues, {
      code: "FORBIDDEN_PHRASE",
      phrase: "Područje za dodatnu provjeru je",
      suggestion: "Use a direct HR action such as 'U intervjuu provjerite...' or 'Tražite primjer...'.",
    });
  }

  if (
    summaryFocusText.trim().length > 0 &&
    !COMPOSITE_HR_SUMMARY_ACTION_PATTERN.test(summaryFocusText)
  ) {
    pushIssue(issues, {
      code: "SUMMARY_WRITING_QUALITY",
      phrase: "summary missing HR action",
      suggestion: "Include a direct action such as 'U intervjuu provjerite', 'Prvo razjasnite' or 'Tražite primjer'.",
    });
  }
}

function validateIpipHrKeySignalThemes(
  snapshot: unknown,
  locale: ReportLocale,
  issues: ReportLanguageQualityIssue[],
): void {
  if (!isBhsLocale(locale) || !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return;
  }

  const report = snapshot as {
    key_hr_signals?: Array<{
      title?: unknown;
      evidence?: unknown;
      hr_implication?: unknown;
    }>;
  };

  report.key_hr_signals?.forEach((signal, index) => {
    const title = typeof signal?.title === "string" ? signal.title.trim() : "";
    const combinedText = [signal?.title, signal?.evidence, signal?.hr_implication]
      .filter((value): value is string => typeof value === "string")
      .join(" ");
    const normalizedTitle = normalizeLabelLikeValue(title);

    if (IPIP_HR_DOMAIN_RESTATEMENT_TITLES.has(normalizedTitle)) {
      pushIssue(issues, {
        code: "MISSING_HR_BEHAVIORAL_THEME",
        phrase: title,
        path: `key_hr_signals[${index}].title`,
        suggestion: "Use a behavioral HR theme such as pouzdanost i izvršenje or saradnja i postavljanje granica.",
      });
      return;
    }

    if (combinedText.trim().length > 0 && !IPIP_HR_BEHAVIOR_THEME_PATTERN.test(combinedText)) {
      pushIssue(issues, {
        code: "MISSING_HR_BEHAVIORAL_THEME",
        phrase: title || `key_hr_signals[${index}]`,
        path: `key_hr_signals[${index}]`,
        suggestion: "Make the signal about concrete work behavior, not only a Big Five domain.",
      });
    }
  });
}

function validateIpipHrQuality(
  params: ReportLanguageQualityParams,
  issues: ReportLanguageQualityIssue[],
): void {
  const entries = collectIpipHrUserFacingEntries(params.snapshot);
  const text = entries.map((entry) => entry.value).join("\n");
  const normalizedText = normalizeText(text);

  validatePhraseRules(normalizedText, params.locale, IPIP_HR_FORBIDDEN_TERMS, issues);
  validatePatternRulesForEntries(entries, params.locale, IPIP_HR_SECOND_PERSON_PATTERNS, issues);
  validatePatternRulesForEntries(entries, params.locale, [IPIP_HR_CYRILLIC_PATTERN], issues);
  validatePatternRulesForEntries(entries, params.locale, IPIP_HR_IJEKAVICA_PATTERNS, issues);
  validatePatternRulesForEntries(
    entries,
    params.locale,
    IPIP_HR_SCORE_SUMMARY_PATTERNS,
    issues,
    {
      pathFilter: (path) => IPIP_HR_PROMINENT_FIELD_PATHS.has(path),
    },
  );
  validatePatternRulesForEntries(entries, params.locale, IPIP_HR_MECHANICAL_FACET_PATTERNS, issues);
  validateIpipHrKeySignalThemes(params.snapshot, params.locale, issues);
}

function validateIndividualDevelopmentProfileHrSignalRepetition(
  text: string,
  locale: ReportLocale,
  issues: ReportLanguageQualityIssue[],
): void {
  if (!isBhsLocale(locale)) {
    return;
  }

  const matches = text.match(/\bsignal(?:a|i|ima|om|u)?\b/giu) ?? [];

  if (matches.length > IDP_HR_SIGNAL_REPETITION_THRESHOLD) {
    pushIssue(issues, {
      code: "REPETITIVE_WORDING",
      phrase: "signal",
      suggestion: "Reduce repeated use of 'signal' and vary the HR wording.",
    });
  }
}

function validateIndividualDevelopmentProfileHrQuality(
  params: ReportLanguageQualityParams,
  issues: ReportLanguageQualityIssue[],
): void {
  const entries = collectIndividualDevelopmentProfileHrUserFacingEntries(params.snapshot);
  const text = entries.map((entry) => entry.value).join("\n");
  const normalizedText = normalizeText(text);

  validatePhraseRules(normalizedText, params.locale, IDP_HR_FORBIDDEN_TERMS, issues);
  validatePatternRulesForEntries(entries, params.locale, IDP_HR_INTERNAL_WORDING_PATTERNS, issues);
  validatePatternRulesForEntries(entries, params.locale, IPIP_HR_SECOND_PERSON_PATTERNS, issues);
  validatePatternRulesForEntries(entries, params.locale, [IPIP_HR_CYRILLIC_PATTERN], issues);
  validatePatternRulesForEntries(entries, params.locale, IPIP_HR_IJEKAVICA_PATTERNS, issues);
  validateIndividualDevelopmentProfileHrSignalRepetition(text, params.locale, issues);
}

export function formatReportLanguageQualityIssues(issues: ReportLanguageQualityIssue[]): string {
  return issues
    .map((issue) =>
      issue.suggestion
        ? `${issue.path ? `${issue.path}: ` : ""}${issue.code}: "${issue.phrase}" -> "${issue.suggestion}"`
        : `${issue.path ? `${issue.path}: ` : ""}${issue.code}: "${issue.phrase}"`,
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
    validateCompositeHrSummaryWritingQuality(params.snapshot, params.locale, issues);
  }

  if (
    params.audience === "hr" &&
    params.reportType === "single_test" &&
    params.context === "ipip_hr_report"
  ) {
    validateIpipHrQuality(params, issues);
  }

  if (
    params.audience === "hr" &&
    params.reportType === "single_test" &&
    params.context === "individual_development_profile_hr_report"
  ) {
    validateIndividualDevelopmentProfileHrQuality(params, issues);
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
