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
