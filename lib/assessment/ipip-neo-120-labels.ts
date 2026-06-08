export const IPIP_NEO_120_TEST_SLUG = "ipip-neo-120-v1";
export const IPIP_NEO_120_TEST_FAMILY = "ipip_neo_120";

export const IPIP_NEO_120_DOMAIN_ORDER = [
  "EXTRAVERSION",
  "AGREEABLENESS",
  "CONSCIENTIOUSNESS",
  "NEUROTICISM",
  "OPENNESS_TO_EXPERIENCE",
] as const;

export type IpipNeo120DomainCode = (typeof IPIP_NEO_120_DOMAIN_ORDER)[number];

export const IPIP_NEO_120_DOMAIN_LABELS_BS: Record<IpipNeo120DomainCode, string> = {
  EXTRAVERSION: "Ekstraverzija",
  AGREEABLENESS: "Ugodnost",
  CONSCIENTIOUSNESS: "Savjesnost",
  NEUROTICISM: "Neuroticizam",
  OPENNESS_TO_EXPERIENCE: "Otvorenost prema iskustvu",
};

export const IPIP_NEO_120_HR_DOMAIN_LABELS_BS: Record<IpipNeo120DomainCode, string> = {
  EXTRAVERSION: "Ekstraverzija",
  AGREEABLENESS: "Spremnost na saradnju",
  CONSCIENTIOUSNESS: "Savjesnost",
  NEUROTICISM: "Neuroticizam",
  OPENNESS_TO_EXPERIENCE: "Otvorenost prema iskustvu",
};

export const IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_LABEL =
  IPIP_NEO_120_HR_DOMAIN_LABELS_BS.AGREEABLENESS;
export const IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_NARRATIVE_LABEL =
  "spremnost na saradnju";
export const IPIP_NEO_120_HR_CANONICAL_STRENGTHS_AND_RISK_TITLE =
  "Snage i mogući rizici prekomjernog oslanjanja";
export const IPIP_NEO_120_HR_CANONICAL_RISK_TITLE =
  "Mogući rizici prekomjernog oslanjanja";
export const IPIP_NEO_120_HR_CANONICAL_HANDLING_TITLE = "HR smjernica za postupanje";

export const IPIP_NEO_120_HR_FORBIDDEN_AGREEABLENESS_SHORTHANDS = [
  "ugodnost",
  "saradljivost",
  "kooperativnost",
  "saradnički profil",
] as const;

export const IPIP_NEO_120_HR_FORBIDDEN_ENGLISH_LEAK_TERMS = [
  "overuse",
  "handling",
] as const;

export const IPIP_NEO_120_FACETS_BY_DOMAIN = {
  EXTRAVERSION: [
    "FRIENDLINESS",
    "GREGARIOUSNESS",
    "ASSERTIVENESS",
    "ACTIVITY_LEVEL",
    "EXCITEMENT_SEEKING",
    "CHEERFULNESS",
  ],
  AGREEABLENESS: [
    "TRUST",
    "MORALITY",
    "ALTRUISM",
    "COOPERATION",
    "MODESTY",
    "SYMPATHY",
  ],
  CONSCIENTIOUSNESS: [
    "SELF_EFFICACY",
    "ORDERLINESS",
    "DUTIFULNESS",
    "ACHIEVEMENT_STRIVING",
    "SELF_DISCIPLINE",
    "CAUTIOUSNESS",
  ],
  NEUROTICISM: [
    "ANXIETY",
    "ANGER",
    "DEPRESSION",
    "SELF_CONSCIOUSNESS",
    "IMMODERATION",
    "VULNERABILITY",
  ],
  OPENNESS_TO_EXPERIENCE: [
    "IMAGINATION",
    "ARTISTIC_INTERESTS",
    "EMOTIONALITY",
    "ADVENTUROUSNESS",
    "INTELLECT",
    "LIBERALISM",
  ],
} as const satisfies Record<IpipNeo120DomainCode, readonly string[]>;

type FacetTuple = (typeof IPIP_NEO_120_FACETS_BY_DOMAIN)[IpipNeo120DomainCode];
export type IpipNeo120FacetCode = FacetTuple[number];

export const IPIP_NEO_120_FACET_LABELS_BS: Record<IpipNeo120FacetCode, string> = {
  FRIENDLINESS: "Srdačnost",
  GREGARIOUSNESS: "Društvenost",
  ASSERTIVENESS: "Asertivnost",
  ACTIVITY_LEVEL: "Nivo aktivnosti",
  EXCITEMENT_SEEKING: "Traženje uzbuđenja",
  CHEERFULNESS: "Vedrina",
  TRUST: "Povjerenje",
  MORALITY: "Iskrenost",
  ALTRUISM: "Altruizam",
  COOPERATION: "Saradljivost",
  MODESTY: "Skromnost",
  SYMPATHY: "Saosjećajnost",
  SELF_EFFICACY: "Samoefikasnost",
  ORDERLINESS: "Urednost",
  DUTIFULNESS: "Odgovornost prema obavezama",
  ACHIEVEMENT_STRIVING: "Težnja postignuću",
  SELF_DISCIPLINE: "Samodisciplina",
  CAUTIOUSNESS: "Promišljenost",
  ANXIETY: "Anksioznost",
  ANGER: "Ljutitost",
  DEPRESSION: "Potištenost",
  SELF_CONSCIOUSNESS: "Samosvjesna nelagoda",
  IMMODERATION: "Neumjerenost",
  VULNERABILITY: "Ranjivost na stres",
  IMAGINATION: "Maštovitost",
  ARTISTIC_INTERESTS: "Umjetnički interesi",
  EMOTIONALITY: "Emocionalnost",
  ADVENTUROUSNESS: "Spremnost na nova iskustva",
  INTELLECT: "Intelekt",
  LIBERALISM: "Liberalizam",
};

const IPIP_NEO_120_FACET_TO_DOMAIN = Object.entries(IPIP_NEO_120_FACETS_BY_DOMAIN).reduce<
  Record<string, IpipNeo120DomainCode>
>((mapping, [domainCode, facetCodes]) => {
  for (const facetCode of facetCodes) {
    mapping[facetCode] = domainCode as IpipNeo120DomainCode;
  }

  return mapping;
}, {});

export function isIpipNeo120TestSlug(testSlug: string): boolean {
  return testSlug === IPIP_NEO_120_TEST_SLUG;
}

export function getIpipNeo120DomainLabel(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  return IPIP_NEO_120_DOMAIN_LABELS_BS[normalized as IpipNeo120DomainCode] ?? null;
}

export function getIpipNeo120HrDomainLabel(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  return IPIP_NEO_120_HR_DOMAIN_LABELS_BS[normalized as IpipNeo120DomainCode] ?? null;
}

export function getIpipNeo120HrDomainLabelsInOrder(): string[] {
  return IPIP_NEO_120_DOMAIN_ORDER.map(
    (domainCode) => IPIP_NEO_120_HR_DOMAIN_LABELS_BS[domainCode],
  );
}

export function buildIpipNeo120HrStrengthsAndRisksInstruction(): string {
  return "Use 2 to 3 strengths-and-risks items. Each item must include exactly 3 possible strengths and exactly 3 possible risks of prekomjerno oslanjanje.";
}

export function applyIpipNeo120HrTerminologyCleanup(value: string): string {
  return value
    .replace(/\bstrengths and possible overuse risks\b/g, IPIP_NEO_120_HR_CANONICAL_STRENGTHS_AND_RISK_TITLE)
    .replace(/\bStrengths and possible overuse risks\b/g, IPIP_NEO_120_HR_CANONICAL_STRENGTHS_AND_RISK_TITLE)
    .replace(/\boveruse risks\b/g, "rizici prekomjernog oslanjanja")
    .replace(/\bOveruse risks\b/g, "Rizici prekomjernog oslanjanja")
    .replace(/\bpossible overuse risks\b/g, "mogući rizici prekomjernog oslanjanja")
    .replace(/\bPossible overuse risks\b/g, "Mogući rizici prekomjernog oslanjanja")
    .replace(/\bUgodnost\b/g, IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_LABEL)
    .replace(/\bugodnost\b/g, IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_NARRATIVE_LABEL)
    .replace(/\bSaradljivost\b/g, IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_LABEL)
    .replace(/\bsaradljivost\b/g, IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_NARRATIVE_LABEL)
    .replace(/\bKooperativnost\b/g, IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_LABEL)
    .replace(/\bkooperativnost\b/g, IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_NARRATIVE_LABEL)
    .replace(/\bSaradnički profil\b/g, "Profil sa izraženom spremnošću na saradnju")
    .replace(/\bsaradnički profil\b/g, "profil sa izraženom spremnošću na saradnju")
    .replace(/\bsaradničnost\b/g, IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_NARRATIVE_LABEL)
    .replace(/\bSaradničnost\b/g, IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_LABEL)
    .replace(/\boveruse\b/g, "prekomjerno oslanjanje")
    .replace(/\bOveruse\b/g, "Prekomjerno oslanjanje")
    .replace(/\bhandling\b/g, "postupanje")
    .replace(/\bHandling\b/g, "Postupanje")
    .replace(
      /([a-zčćžšđ])\s+Spremnost na saradnju\b/gu,
      `$1 ${IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_NARRATIVE_LABEL}`,
    );
}

export function canonicalizeIpipNeo120HrReportTerminology<T>(value: T): T {
  if (typeof value === "string") {
    return applyIpipNeo120HrTerminologyCleanup(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeIpipNeo120HrReportTerminology(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        canonicalizeIpipNeo120HrReportTerminology(item),
      ]),
    ) as T;
  }

  return value;
}

export function getIpipNeo120FacetLabel(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  return IPIP_NEO_120_FACET_LABELS_BS[normalized as IpipNeo120FacetCode] ?? null;
}

export function getIpipNeo120FacetDomainCode(
  facetCode: string,
): IpipNeo120DomainCode | null {
  const normalized = facetCode.trim().toUpperCase();
  return IPIP_NEO_120_FACET_TO_DOMAIN[normalized] ?? null;
}
