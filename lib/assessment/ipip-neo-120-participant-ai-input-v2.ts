import {
  getIpipNeo120DomainLabel,
  getIpipNeo120FacetLabel,
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
  IPIP_NEO_120_TEST_SLUG,
  type IpipNeo120DomainCode,
  type IpipNeo120FacetCode,
} from "./ipip-neo-120-labels";
import type { IpipNeo120ParticipantReportPromptInput } from "./ipip-neo-120-report-contract";

export type IpipNeo120ParticipantBandV2 = "lower" | "balanced" | "higher";

export type IpipNeo120DisplayDirectionV2 =
  | "direct"
  | "inverted_for_participant_domain_display"
  | "direct_but_non_clinical";

export type IpipNeo120TextBudgetRuleV2 = {
  max_chars?: number;
  max_words?: number;
  sentence_range?: readonly [number, number];
};

export type IpipNeo120DomainDefinitionV2 = {
  code: IpipNeo120DomainCode;
  label: string;
  display_label: string;
  participant_display_label: string;
  narrative_label: string;
  display_direction: IpipNeo120DisplayDirectionV2;
  definition: string;
  display_rule: string;
};

export type IpipNeo120FacetDefinitionV2 = {
  code: IpipNeo120FacetCode;
  domain_code: IpipNeo120DomainCode;
  label: string;
  participant_display_label: string;
  display_direction: IpipNeo120DisplayDirectionV2;
  definition: string;
};

export type IpipNeo120BandMeaningV2 = {
  band: IpipNeo120ParticipantBandV2;
  label: string;
  meaning: string;
  allowed_language: readonly string[];
  forbidden_language: readonly string[];
};

export type IpipNeo120ParticipantBandMeaningV2 = IpipNeo120BandMeaningV2 & {
  display_phrases?: readonly string[];
};

export type IpipNeo120ParticipantFacetInputV2 = {
  facet_code: IpipNeo120FacetCode;
  label: string;
  participant_display_label: string;
  score: number;
  band: IpipNeo120ParticipantBandV2;
  band_label: string;
  display_direction: IpipNeo120DisplayDirectionV2;
  definition: string;
  band_meaning: IpipNeo120ParticipantBandMeaningV2;
};

export type IpipNeo120ParticipantDomainInputV2 = {
  domain_code: IpipNeo120DomainCode;
  label: string;
  display_label: string;
  participant_display_label: string;
  narrative_label: string;
  score: number;
  band: IpipNeo120ParticipantBandV2;
  band_label: string;
  display_score: number;
  display_band: IpipNeo120ParticipantBandV2;
  display_band_label: string;
  display_direction: IpipNeo120DisplayDirectionV2;
  definition: string;
  display_rule: string;
  band_meaning: IpipNeo120ParticipantBandMeaningV2;
  subdimensions: IpipNeo120ParticipantFacetInputV2[];
};

export type IpipNeo120ParticipantAiInputV2 = {
  input_version: "ipip_neo_120_participant_input_v2";
  target_contract_version: "ipip_neo_120_participant_v2";
  test_slug: "ipip-neo-120-v1";
  test_name: string;
  audience: "participant";
  locale: "bs";
  language_rules: {
    language: "bosnian";
    script: "latin";
    variant: "ijekavica";
    address_style: "second_person_singular";
  };
  report_blueprint: {
    summary: {
      badges_count: 3;
    };
    key_patterns_count: 3;
    domains_count: 5;
    subdimensions_per_domain: 6;
    total_subdimensions: 30;
    strengths_count: 4;
    watchouts_count: 3;
    work_style_paragraphs_count: 2;
    development_recommendations_count: 4;
    interpretation_note_mode: "static_or_controlled";
  };
  text_budgets: typeof IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2;
  band_meanings: typeof IPIP_NEO_120_BAND_MEANINGS_V2;
  vocabulary_rules: typeof IPIP_NEO_120_PARTICIPANT_VOCABULARY_RULES_V2;
  consistency_rules: readonly string[];
  guardrails: readonly string[];
  static_text: typeof IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2;
  scale_hint: {
    min: 1;
    max: 5;
    display_mode: "visual_with_discreet_numeric_support";
  };
  deterministic_summary: {
    ranked_domains: string[];
    highest_domains: string[];
    lowest_domains: string[];
    balanced_domains: string[];
    top_subdimensions: string[];
    lowest_subdimensions: string[];
  };
  domains: IpipNeo120ParticipantDomainInputV2[];
};

export const IPIP_NEO_120_DOMAIN_DEFINITIONS_V2 = {
  EXTRAVERSION: {
    code: "EXTRAVERSION",
    label: "Ekstraverzija",
    display_label: "Ekstraverzija",
    participant_display_label: "Ekstraverzija",
    narrative_label: "ekstraverzija",
    display_direction: "direct",
    definition:
      "Opisuje socijalnu energiju, potrebu za kontaktom, aktivno uključivanje, asertivnost, tempo i sklonost ka stimulativnijem okruženju.",
    display_rule:
      "Higher znači izraženiju socijalnu energiju, aktivnije uključivanje i veću potrebu za stimulacijom. Lower znači mirniji interpersonalni tempo i manju potrebu za stalnom socijalnom aktivacijom.",
  },
  AGREEABLENESS: {
    code: "AGREEABLENESS",
    label: "Ugodnost",
    display_label: "Spremnost na saradnju",
    participant_display_label: "Spremnost na saradnju",
    narrative_label: "spremnost na saradnju",
    display_direction: "direct",
    definition:
      "Opisuje način na koji osoba gradi odnose, pokazuje povjerenje, obzirnost, saradnju, spremnost na dogovor i osjetljivost za potrebe drugih.",
    display_rule:
      "Higher znači izraženiju saradljivost, obzirnost i orijentaciju na odnos. Lower znači direktniji, manje prilagodljiv stil, ali ne nužno manjak korektnosti.",
  },
  CONSCIENTIOUSNESS: {
    code: "CONSCIENTIOUSNESS",
    label: "Savjesnost",
    display_label: "Savjesnost",
    participant_display_label: "Savjesnost",
    narrative_label: "savjesnost",
    display_direction: "direct",
    definition:
      "Opisuje odnos prema organizaciji, odgovornosti, ciljevima, istrajnosti, pouzdanosti, planiranju i samodisciplini.",
    display_rule:
      "Higher znači izraženiju organizovanost, odgovornost, istrajnost i oslonac na strukturu. Lower znači spontaniji i fleksibilniji pristup, ali ne nužno neodgovornost.",
  },
  NEUROTICISM: {
    code: "NEUROTICISM",
    label: "Neuroticizam",
    display_label: "Emocionalna stabilnost",
    participant_display_label: "Emocionalna stabilnost",
    narrative_label: "emocionalna stabilnost",
    display_direction: "inverted_for_participant_domain_display",
    definition:
      "Opisuje način na koji osoba doživljava i reguliše pritisak, zabrinutost, emocionalnu napetost i oporavak nakon stresnih situacija. U participant reportu ovu domenu treba pisati ne-klinički, kroz jezik emocionalne stabilnosti i reagovanja na pritisak.",
    display_rule:
      "Canonical higher Neuroticism znači izraženiju emocionalnu reaktivnost i osjetljivije reagovanje na pritisak. U participant reportu domen se prikazuje kroz jezik emocionalne stabilnosti: canonical lower Neuroticism može se opisati kao veća emocionalna stabilnost, a canonical higher Neuroticism kao osjetljivije reagovanje na pritisak. Ne koristiti klinički jezik.",
  },
  OPENNESS_TO_EXPERIENCE: {
    code: "OPENNESS_TO_EXPERIENCE",
    label: "Otvorenost prema iskustvu",
    display_label: "Otvorenost prema iskustvu",
    participant_display_label: "Otvorenost prema iskustvu",
    narrative_label: "otvorenost prema iskustvu",
    display_direction: "direct",
    definition:
      "Opisuje odnos prema novim idejama, mašti, estetskoj osjetljivosti, učenju, promjenama i fleksibilnosti u razmišljanju.",
    display_rule:
      "Higher znači izraženiju otvorenost prema idejama, učenju, promjenama i istraživanju. Lower znači praktičniji, konkretniji i oprezniji odnos prema novom, ali ne manjak sposobnosti.",
  },
} as const satisfies Record<IpipNeo120DomainCode, IpipNeo120DomainDefinitionV2>;

export const IPIP_NEO_120_FACET_DEFINITIONS_V2 = {
  FRIENDLINESS: {
    code: "FRIENDLINESS",
    domain_code: "EXTRAVERSION",
    label: "Srdačnost",
    participant_display_label: "Srdačnost",
    display_direction: "direct",
    definition:
      "Opisuje toplinu u prvom kontaktu, pristupačnost i lakoću s kojom osoba pokazuje interes za druge ljude.",
  },
  GREGARIOUSNESS: {
    code: "GREGARIOUSNESS",
    domain_code: "EXTRAVERSION",
    label: "Društvenost",
    participant_display_label: "Društvenost",
    display_direction: "direct",
    definition:
      "Opisuje koliko osobi prija društvo, grupna dinamika i boravak među ljudima.",
  },
  ASSERTIVENESS: {
    code: "ASSERTIVENESS",
    domain_code: "EXTRAVERSION",
    label: "Asertivnost",
    participant_display_label: "Asertivnost",
    display_direction: "direct",
    definition:
      "Opisuje spremnost da osoba zauzme prostor, kaže mišljenje, pokrene temu ili preuzme vidljiviju ulogu u razgovoru.",
  },
  ACTIVITY_LEVEL: {
    code: "ACTIVITY_LEVEL",
    domain_code: "EXTRAVERSION",
    label: "Nivo aktivnosti",
    participant_display_label: "Nivo aktivnosti",
    display_direction: "direct",
    definition:
      "Opisuje tempo, energiju i potrebu za aktivnošću, pokretom i dinamičnijim ritmom.",
  },
  EXCITEMENT_SEEKING: {
    code: "EXCITEMENT_SEEKING",
    domain_code: "EXTRAVERSION",
    label: "Traženje uzbuđenja",
    participant_display_label: "Traženje uzbuđenja",
    display_direction: "direct",
    definition:
      "Opisuje sklonost ka stimulaciji, novim doživljajima, promjeni ritma i situacijama koje donose više uzbuđenja.",
  },
  CHEERFULNESS: {
    code: "CHEERFULNESS",
    domain_code: "EXTRAVERSION",
    label: "Vedrina",
    participant_display_label: "Vedrina",
    display_direction: "direct",
    definition:
      "Opisuje pozitivnu emocionalnu izražajnost, vedriji ton i lakoću s kojom osoba unosi živost u interakciju.",
  },
  TRUST: {
    code: "TRUST",
    domain_code: "AGREEABLENESS",
    label: "Povjerenje",
    participant_display_label: "Povjerenje",
    display_direction: "direct",
    definition:
      "Opisuje osnovnu sklonost da osoba drugima pristupa s povjerenjem, dobronamjernošću i pretpostavkom korektne namjere.",
  },
  MORALITY: {
    code: "MORALITY",
    domain_code: "AGREEABLENESS",
    label: "Iskrenost",
    participant_display_label: "Iskrenost",
    display_direction: "direct",
    definition:
      "Opisuje otvorenost namjera i sklonost da osoba izbjegava manipulativno, prikriveno ili dvosmisleno ponašanje.",
  },
  ALTRUISM: {
    code: "ALTRUISM",
    domain_code: "AGREEABLENESS",
    label: "Altruizam",
    participant_display_label: "Altruizam",
    display_direction: "direct",
    definition:
      "Opisuje spremnost da osoba pomogne, podrži druge i obrati pažnju na potrebe ljudi oko sebe.",
  },
  COOPERATION: {
    code: "COOPERATION",
    domain_code: "AGREEABLENESS",
    label: "Saradljivost",
    participant_display_label: "Spremnost na dogovor",
    display_direction: "direct",
    definition:
      "Opisuje spremnost na dogovor, smirivanje konflikta i traženje rješenja koje čuva odnos i zajednički cilj.",
  },
  MODESTY: {
    code: "MODESTY",
    domain_code: "AGREEABLENESS",
    label: "Skromnost",
    participant_display_label: "Skromnost",
    display_direction: "direct",
    definition:
      "Opisuje koliko osoba prirodno umanjuje vlastitu vidljivost, izbjegava samopromociju i ne insistira da bude u prvom planu.",
  },
  SYMPATHY: {
    code: "SYMPATHY",
    domain_code: "AGREEABLENESS",
    label: "Saosjećajnost",
    participant_display_label: "Saosjećajnost",
    display_direction: "direct",
    definition:
      "Opisuje emocionalnu osjetljivost za druge, suosjećanje i sposobnost da osoba prepozna kada je nekome potrebna podrška.",
  },
  SELF_EFFICACY: {
    code: "SELF_EFFICACY",
    domain_code: "CONSCIENTIOUSNESS",
    label: "Samoefikasnost",
    participant_display_label: "Samoefikasnost",
    display_direction: "direct",
    definition:
      "Opisuje osjećaj lične sposobnosti, povjerenje u vlastitu organizovanost i doživljaj da osoba može iznijeti zadatke.",
  },
  ORDERLINESS: {
    code: "ORDERLINESS",
    domain_code: "CONSCIENTIOUSNESS",
    label: "Urednost",
    participant_display_label: "Urednost",
    display_direction: "direct",
    definition:
      "Opisuje potrebu za redom, jasnom strukturom, organizacijom prostora, informacija i toka rada.",
  },
  DUTIFULNESS: {
    code: "DUTIFULNESS",
    domain_code: "CONSCIENTIOUSNESS",
    label: "Odgovornost prema obavezama",
    participant_display_label: "Odgovornost prema obavezama",
    display_direction: "direct",
    definition:
      "Opisuje osjećaj obaveze, odgovornost prema dogovoru i spremnost da osoba uradi ono što je preuzela.",
  },
  ACHIEVEMENT_STRIVING: {
    code: "ACHIEVEMENT_STRIVING",
    domain_code: "CONSCIENTIOUSNESS",
    label: "Težnja postignuću",
    participant_display_label: "Težnja postignuću",
    display_direction: "direct",
    definition:
      "Opisuje težnju ka postignuću, ambiciju, ulaganje napora i potrebu da se stvari urade kvalitetno.",
  },
  SELF_DISCIPLINE: {
    code: "SELF_DISCIPLINE",
    domain_code: "CONSCIENTIOUSNESS",
    label: "Samodisciplina",
    participant_display_label: "Samodisciplina",
    display_direction: "direct",
    definition:
      "Opisuje sposobnost da osoba ostane uz zadatak, održi ritam i nastavi i kada početna motivacija oslabi.",
  },
  CAUTIOUSNESS: {
    code: "CAUTIOUSNESS",
    domain_code: "CONSCIENTIOUSNESS",
    label: "Promišljenost",
    participant_display_label: "Promišljenost",
    display_direction: "direct",
    definition:
      "Opisuje promišljenost prije odluke, oprez u procjeni posljedica i sklonost da osoba ne ulijeće naglo u važne poteze.",
  },
  ANXIETY: {
    code: "ANXIETY",
    domain_code: "NEUROTICISM",
    label: "Anksioznost",
    participant_display_label: "Zabrinutost pod pritiskom",
    display_direction: "direct_but_non_clinical",
    definition:
      "Opisuje sklonost ka zabrinutosti, napetosti i očekivanju mogućih problema, posebno u neizvjesnim ili zahtjevnim situacijama.",
  },
  ANGER: {
    code: "ANGER",
    domain_code: "NEUROTICISM",
    label: "Ljutitost",
    participant_display_label: "Reaktivnost na frustraciju",
    display_direction: "direct_but_non_clinical",
    definition:
      "Opisuje koliko se osoba brzo može iznervirati, osjetiti frustraciju ili reagovati oštrije kada stvari ne idu očekivanim tokom.",
  },
  DEPRESSION: {
    code: "DEPRESSION",
    domain_code: "NEUROTICISM",
    label: "Potištenost",
    participant_display_label: "Pad energije i raspoloženja",
    display_direction: "direct_but_non_clinical",
    definition:
      "Opisuje sklonost ka padovima raspoloženja, obeshrabrenosti ili težem vraćanju energije nakon neprijatnih iskustava. Ne tumačiti klinički.",
  },
  SELF_CONSCIOUSNESS: {
    code: "SELF_CONSCIOUSNESS",
    domain_code: "NEUROTICISM",
    label: "Samosvjesna nelagoda",
    participant_display_label: "Nelagoda pri izloženosti",
    display_direction: "direct_but_non_clinical",
    definition:
      "Opisuje osjetljivost na to kako osoba djeluje pred drugima, uključujući nelagodu, stidljivost ili oprez u socijalno izloženim situacijama.",
  },
  IMMODERATION: {
    code: "IMMODERATION",
    domain_code: "NEUROTICISM",
    label: "Neumjerenost",
    participant_display_label: "Kontrola impulsa",
    display_direction: "direct_but_non_clinical",
    definition:
      "Opisuje teškoću da se odgodi impuls, želja ili trenutna potreba kada postoji snažan unutrašnji podsticaj.",
  },
  VULNERABILITY: {
    code: "VULNERABILITY",
    domain_code: "NEUROTICISM",
    label: "Ranjivost na stres",
    participant_display_label: "Osjetljivost na stres",
    display_direction: "direct_but_non_clinical",
    definition:
      "Opisuje kako osoba reaguje kada je pod većim pritiskom, posebno koliko joj tada treba podrške, strukture ili vremena za smirivanje.",
  },
  IMAGINATION: {
    code: "IMAGINATION",
    domain_code: "OPENNESS_TO_EXPERIENCE",
    label: "Maštovitost",
    participant_display_label: "Maštovitost",
    display_direction: "direct",
    definition:
      "Opisuje maštovitost, mentalno istraživanje mogućnosti i sklonost da osoba razmišlja izvan neposredno vidljivog.",
  },
  ARTISTIC_INTERESTS: {
    code: "ARTISTIC_INTERESTS",
    domain_code: "OPENNESS_TO_EXPERIENCE",
    label: "Umjetnički interesi",
    participant_display_label: "Estetska osjetljivost",
    display_direction: "direct",
    definition:
      "Opisuje osjetljivost za estetiku, umjetnost, oblik, atmosferu i simboličke ili kreativne elemente iskustva.",
  },
  EMOTIONALITY: {
    code: "EMOTIONALITY",
    domain_code: "OPENNESS_TO_EXPERIENCE",
    label: "Emocionalnost",
    participant_display_label: "Svjesnost emocija",
    display_direction: "direct",
    definition:
      "Opisuje svjesnost unutrašnjih doživljaja i spremnost da osoba primijeti, razumije i imenuje vlastite emocije.",
  },
  ADVENTUROUSNESS: {
    code: "ADVENTUROUSNESS",
    domain_code: "OPENNESS_TO_EXPERIENCE",
    label: "Spremnost na nova iskustva",
    participant_display_label: "Spremnost na nova iskustva",
    display_direction: "direct",
    definition:
      "Opisuje spremnost na promjenu, novo iskustvo, drugačiji pristup i izlazak iz uobičajenih rutina.",
  },
  INTELLECT: {
    code: "INTELLECT",
    domain_code: "OPENNESS_TO_EXPERIENCE",
    label: "Intelekt",
    participant_display_label: "Intelektualna radoznalost",
    display_direction: "direct",
    definition:
      "Opisuje intelektualnu radoznalost, interes za ideje, konceptualno razmišljanje i zadovoljstvo u razumijevanju složenijih tema. Ne tumačiti kao IQ.",
  },
  LIBERALISM: {
    code: "LIBERALISM",
    domain_code: "OPENNESS_TO_EXPERIENCE",
    label: "Liberalizam",
    participant_display_label: "Preispitivanje stavova",
    display_direction: "direct",
    definition:
      "Opisuje spremnost da osoba preispituje ustaljene norme, pravila i vlastita uvjerenja kada za to postoje dobri razlozi.",
  },
} as const satisfies Record<IpipNeo120FacetCode, IpipNeo120FacetDefinitionV2>;

export const IPIP_NEO_120_BAND_MEANINGS_V2 = {
  lower: {
    band: "lower",
    label: "Niže izraženo",
    meaning:
      "Ovaj rezultat ukazuje da je osobina relativno manje izražena u profilu. Ne tumačiti kao nedostatak, nego kao tiši signal koji može biti koristan ili izazovan zavisno od konteksta.",
    allowed_language: [
      "manje izraženo",
      "tiši signal",
      "rjeđe dominantno",
      "suptilnije prisutno",
      "manje naglašeno",
      "mirniji izraz",
      "nije primarni oslonac profila",
      "može se uključiti kada kontekst to traži",
    ],
    forbidden_language: [
      "slabost",
      "problem",
      "nedostatak",
      "manjak sposobnosti",
      "ne možeš",
      "loše razvijeno",
      "neuspješno",
      "deficit",
      "ograničenje ličnosti",
    ],
  },
  balanced: {
    band: "balanced",
    label: "Uravnoteženo",
    meaning:
      "Ovaj rezultat ukazuje na uravnotežen izraz osobine. Ne opisivati ga kao visok ili nizak, nego kao kontekstualan, fleksibilan ili srednji raspon.",
    allowed_language: [
      "uravnoteženo",
      "srednji raspon",
      "kontekstualno",
      "zavisno od situacije",
      "fleksibilan izraz",
      "bez izražene krajnosti",
      "možeš se kretati između dva pristupa",
      "nije dominantno ni tiho",
      "stabilna sredina",
    ],
    forbidden_language: [
      "visoko",
      "vrlo visoko",
      "izrazito",
      "dominantno",
      "snažno naglašeno",
      "jako izraženo",
      "nisko",
      "vrlo nisko",
      "slabo izraženo",
      "nedovoljno izraženo",
    ],
  },
  higher: {
    band: "higher",
    label: "Više izraženo",
    meaning:
      "Ovaj rezultat ukazuje da je osobina izraženiji signal u profilu. Ne tumačiti kao garanciju ponašanja, nego kao tendenciju koja se češće može vidjeti u odgovarajućem kontekstu.",
    allowed_language: [
      "izraženije",
      "naglašenije",
      "češće prisutno",
      "prepoznatljiviji signal",
      "jače vidljivo u profilu",
      "prirodnije ti dolazi",
      "češće se može pokazati",
      "može davati oslonac",
      "može biti jedna od izraženijih niti profila",
    ],
    forbidden_language: [
      "uvijek",
      "sigurno",
      "garantuje",
      "dokazuje",
      "dominira tvojom ličnošću",
      "određuje tvoje ponašanje",
      "tvoja glavna osobina je uvijek",
      "nepromjenjivo",
    ],
  },
} as const satisfies Record<IpipNeo120ParticipantBandV2, IpipNeo120BandMeaningV2>;

export const IPIP_NEO_120_NEUROTICISM_DISPLAY_RULES_V2 = {
  canonical_domain_code: "NEUROTICISM",
  participant_domain_display_label: "Emocionalna stabilnost",
  domain_display_direction: "inverted_for_participant_domain_display",
  facet_display_direction: "direct_but_non_clinical",
  rule: "Canonical scoring ostaje NEUROTICISM. Za participant domain prikaz koristi se jezik emocionalne stabilnosti. Canonical lower Neuroticism znači veća emocionalna stabilnost i mirniji odgovor na pritisak. Canonical balanced Neuroticism znači kontekstualno reagovanje na pritisak. Canonical higher Neuroticism znači osjetljivije reagovanje na pritisak i veću potrebu za regulacijom i oporavkom. Neuroticism facete se ne invertuju, nego ostaju direct, ali se pišu ne-klinički.",
  domain_band_display_meanings: {
    lower: [
      "veća emocionalna stabilnost",
      "mirniji odgovor na pritisak",
      "lakše zadržavanje prisebnosti",
      "manja emocionalna reaktivnost",
      "stabilniji ritam pod opterećenjem",
    ],
    balanced: [
      "kontekstualno reagovanje na pritisak",
      "reakcija zavisi od opterećenja",
      "možeš biti pribran, ali ti u nekim situacijama treba više oporavka",
      "uravnotežen emocionalni odgovor",
    ],
    higher: [
      "osjetljivije reagovanje na pritisak",
      "brže registrovanje napetosti",
      "veća potreba za oporavkom",
      "jači unutrašnji odgovor na neizvjesnost",
      "korisno je graditi stabilne oslonce",
    ],
  },
} as const;

export const IPIP_NEO_120_PARTICIPANT_VOCABULARY_RULES_V2 = {
  global_forbidden_terms: [
    "uvijek",
    "nikad",
    "sigurno",
    "definitivno",
    "dokazuje",
    "garantuje",
    "moraš",
    "ne možeš",
    "nesposoban",
    "problematičan",
    "slabost",
    "poremećaj",
    "dijagnoza",
    "klinički",
    "patološki",
    "rizičan kandidat",
    "loš fit",
    "dobar fit",
    "preporučuje se zapošljavanje",
    "ne preporučuje se zapošljavanje",
    "IQ",
  ],
  preferred_participant_wording: [
    "tvoj obrazac",
    "tvoj stil",
    "možeš primijetiti",
    "može ti pomoći",
    "vrijedi pratiti",
    "u nekim situacijama",
    "kada je kontekst zahtjevniji",
    "kada imaš dovoljno prostora",
    "u radu se može pokazati",
    "u saradnji se može vidjeti",
    "može ukazivati",
    "vjerovatnije se vidi",
    "često se može pokazati",
    "zavisno od konteksta",
    "vrijedi obratiti pažnju",
  ],
  avoid_participant_wording: [
    "tvoja ličnost je",
    "ti si osoba koja uvijek",
    "ovakav kandidat",
    "poslodavac treba",
    "HR treba",
    "procjena pokazuje da moraš",
  ],
} as const;

export const IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2 = {
  "summary.headline": {
    max_chars: 140,
  },
  "summary.overview": {
    sentence_range: [3, 5],
    max_chars: 900,
  },
  "summary.badges[].label": {
    max_words: 4,
    max_chars: 40,
  },
  "key_patterns[].title": {
    max_words: 5,
    max_chars: 60,
  },
  "key_patterns[].description": {
    sentence_range: [3, 4],
    max_chars: 700,
  },
  "domains[].card_title": {
    max_words: 6,
    max_chars: 70,
  },
  "domains[].summary": {
    sentence_range: [3, 5],
    max_chars: 700,
  },
  "domains[].practical_signal": {
    sentence_range: [2, 3],
    max_chars: 450,
  },
  "domains[].candidate_reflection": {
    sentence_range: [1, 1],
    max_chars: 220,
  },
  "domains[].strengths[]": {
    sentence_range: [1, 1],
    max_chars: 220,
  },
  "domains[].watchouts[]": {
    sentence_range: [1, 1],
    max_chars: 220,
  },
  "domains[].development_tip": {
    sentence_range: [1, 2],
    max_chars: 300,
  },
  "subdimensions[].card_title": {
    max_words: 6,
    max_chars: 70,
  },
  "subdimensions[].summary": {
    sentence_range: [2, 3],
    max_chars: 450,
  },
  "subdimensions[].practical_signal": {
    sentence_range: [1, 2],
    max_chars: 300,
  },
  "subdimensions[].candidate_reflection": {
    sentence_range: [1, 1],
    max_chars: 200,
  },
  "strengths[].title": {
    max_words: 6,
    max_chars: 70,
  },
  "strengths[].description": {
    sentence_range: [2, 3],
    max_chars: 450,
  },
  "watchouts[].title": {
    max_words: 6,
    max_chars: 70,
  },
  "watchouts[].description": {
    sentence_range: [2, 3],
    max_chars: 450,
  },
  "work_style.title": {
    max_words: 6,
    max_chars: 70,
  },
  "work_style.paragraphs[]": {
    sentence_range: [3, 5],
    max_chars: 900,
  },
  "development_recommendations[].title": {
    max_words: 6,
    max_chars: 70,
  },
  "development_recommendations[].description": {
    sentence_range: [2, 3],
    max_chars: 450,
  },
  "development_recommendations[].action": {
    sentence_range: [1, 1],
    max_chars: 260,
  },
  "interpretation_note.text": {
    sentence_range: [2, 3],
    max_chars: 450,
  },
} as const satisfies Record<string, IpipNeo120TextBudgetRuleV2>;

export const IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2 = {
  interpretation_note: {
    title: "Interpretacijska napomena",
    text: "Ovaj izvještaj je razvojna interpretacija rezultata IPIP-NEO-120 procjene. Opisuje obrasce, sklonosti i moguće razvojne signale, ali ne predstavlja dijagnozu, konačnu procjenu osobe, niti odluku o zapošljavanju. Najkorisnije ga je čitati zajedno sa kontekstom, razgovorom i stvarnim ponašanjem u radu.",
  },
} as const;

export const IPIP_NEO_120_PARTICIPANT_CONSISTENCY_RULES_V2 = [
  "Nikad ne opisuj domen ili poddimenziju intenzitetom koji je suprotan canonical band vrijednosti.",
  "Ako je band balanced, koristi formulacije poput uravnoteženo, srednji raspon, kontekstualno ili zavisno od situacije.",
  "Ako je band higher, možeš reći izraženije, naglašenije ili češće prisutno, ali bez apsolutnih tvrdnji.",
  "Ako je band lower, koristi formulacije poput tiši signal, manje izraženo ili rjeđe dominantno, ali ne kao nedostatak.",
  "Isti domen mora biti opisan konzistentno u summary, badges, key_patterns, domains, strengths, watchouts i recommendations.",
  "Ista poddimenzija mora biti opisana konzistentno u subdimensions, key_patterns, strengths, watchouts i recommendations.",
  "Neuroticism domain se za participant report tumači kroz emocionalnu stabilnost, ali Neuroticism facete ostaju direct i ne-kliničke.",
  "Nazivi psihometrijskih domena, dimenzija i poddimenzija nisu vlastita imena i ne pišu se velikim početnim slovom unutar narativne rečenice.",
  "display_label koristi se za naslove, kartice i kratke labele. narrative_label koristi se unutar narativnih rečenica.",
  "candidate_reflection mora biti jedna kratka deklarativna rečenica.",
  "candidate_reflection ne smije biti pitanje.",
  "candidate_reflection ne smije završavati upitnikom.",
] as const;

export const IPIP_NEO_120_PARTICIPANT_GUARDRAILS_V2 = [
  "Ne koristi klinički jezik.",
  "Ne daj dijagnozu.",
  "Ne daj hire/no-hire preporuku.",
  "Ne izvodi zaključke o zaštićenim osobinama.",
  "Ne koristi IQ tvrdnje.",
  "Ne koristi apsolutne tvrdnje kao uvijek, nikad, sigurno, definitivno.",
  "Ne tvrdi da test opisuje kompletnu osobu.",
  "Ne izmišljaj osobine koje nisu podržane score/band inputom.",
  "candidate_reflection ne smije počinjati formulacijama: Kako, Šta, Kada, Gdje, Zašto, Na koji način, Da li, Možeš li.",
] as const;

export const IPIP_NEO_120_PARTICIPANT_AI_INPUT_SPEC_V2 = {
  input_version: "ipip_neo_120_participant_input_v2",
  target_contract_version: "ipip_neo_120_participant_v2",
  test_slug: IPIP_NEO_120_TEST_SLUG,
  test_name: "IPIP-NEO-120",
  audience: "participant",
  locale: "bs",
  language_rules: {
    language: "bosnian",
    script: "latin",
    variant: "ijekavica",
    address_style: "second_person_singular",
  },
  report_blueprint: {
    summary: {
      badges_count: 3,
    },
    key_patterns_count: 3,
    domains_count: 5,
    subdimensions_per_domain: 6,
    total_subdimensions: 30,
    strengths_count: 4,
    watchouts_count: 3,
    work_style_paragraphs_count: 2,
    development_recommendations_count: 4,
    interpretation_note_mode: "static_or_controlled",
  },
  text_budgets: IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2,
  band_meanings: IPIP_NEO_120_BAND_MEANINGS_V2,
  vocabulary_rules: IPIP_NEO_120_PARTICIPANT_VOCABULARY_RULES_V2,
  consistency_rules: IPIP_NEO_120_PARTICIPANT_CONSISTENCY_RULES_V2,
  guardrails: IPIP_NEO_120_PARTICIPANT_GUARDRAILS_V2,
  static_text: IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2,
  scale_hint: {
    min: 1,
    max: 5,
    display_mode: "visual_with_discreet_numeric_support",
  },
  deterministic_summary: {
    ranked_domains: [],
    highest_domains: [],
    lowest_domains: [],
    balanced_domains: [],
    top_subdimensions: [],
    lowest_subdimensions: [],
  },
  domains: [],
} as const satisfies IpipNeo120ParticipantAiInputV2;

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function getIpipNeo120DomainDefinitionV2(
  domainCode: string,
): IpipNeo120DomainDefinitionV2 | null {
  const normalized = normalizeCode(domainCode);
  return (
    IPIP_NEO_120_DOMAIN_DEFINITIONS_V2[normalized as IpipNeo120DomainCode] ?? null
  );
}

export function getIpipNeo120FacetDefinitionV2(
  facetCode: string,
): IpipNeo120FacetDefinitionV2 | null {
  const normalized = normalizeCode(facetCode);
  return IPIP_NEO_120_FACET_DEFINITIONS_V2[normalized as IpipNeo120FacetCode] ?? null;
}

export function getIpipNeo120BandMeaningV2(
  band: string,
): IpipNeo120BandMeaningV2 | null {
  return IPIP_NEO_120_BAND_MEANINGS_V2[band as IpipNeo120ParticipantBandV2] ?? null;
}

export function getIpipNeo120ParticipantDisplayLabelV2(code: string): string | null {
  const domainDefinition = getIpipNeo120DomainDefinitionV2(code);

  if (domainDefinition) {
    return domainDefinition.participant_display_label;
  }

  const facetDefinition = getIpipNeo120FacetDefinitionV2(code);
  return facetDefinition?.participant_display_label ?? null;
}

export function getIpipNeo120ParticipantDisplayDirectionV2(
  code: string,
): IpipNeo120DisplayDirectionV2 | null {
  const domainDefinition = getIpipNeo120DomainDefinitionV2(code);

  if (domainDefinition) {
    return domainDefinition.display_direction;
  }

  const facetDefinition = getIpipNeo120FacetDefinitionV2(code);
  return facetDefinition?.display_direction ?? null;
}

export function getIpipNeo120ParticipantBandMeaningForDomainV2(
  domainCode: string,
  band: string,
): IpipNeo120ParticipantBandMeaningV2 | null {
  const bandMeaning = getIpipNeo120BandMeaningV2(band);

  if (!bandMeaning) {
    return null;
  }

  const normalizedDomainCode = normalizeCode(domainCode);

  if (normalizedDomainCode !== IPIP_NEO_120_NEUROTICISM_DISPLAY_RULES_V2.canonical_domain_code) {
    return bandMeaning;
  }

  return {
    ...bandMeaning,
    display_phrases:
      IPIP_NEO_120_NEUROTICISM_DISPLAY_RULES_V2.domain_band_display_meanings[
        band as IpipNeo120ParticipantBandV2
      ],
  };
}

export function getIpipNeo120ParticipantBandMeaningForFacetV2(
  facetCode: string,
  band: string,
): IpipNeo120ParticipantBandMeaningV2 | null {
  const facetDefinition = getIpipNeo120FacetDefinitionV2(facetCode);

  if (!facetDefinition) {
    return null;
  }

  return getIpipNeo120BandMeaningV2(band);
}

export function getIpipNeo120ParticipantDisplayScoreForDomainV2(
  domainCode: string,
  score: number,
): number | null {
  if (!Number.isFinite(score)) {
    return null;
  }

  const normalizedDomainCode = normalizeCode(domainCode);

  if (normalizedDomainCode === IPIP_NEO_120_NEUROTICISM_DISPLAY_RULES_V2.canonical_domain_code) {
    return 6 - score;
  }

  if (getIpipNeo120DomainDefinitionV2(normalizedDomainCode)) {
    return score;
  }

  return null;
}

export function getIpipNeo120ParticipantDisplayBandForDomainV2(
  domainCode: string,
  band: string,
): IpipNeo120ParticipantBandV2 | null {
  if (!getIpipNeo120BandMeaningV2(band)) {
    return null;
  }

  const normalizedDomainCode = normalizeCode(domainCode);

  if (normalizedDomainCode === IPIP_NEO_120_NEUROTICISM_DISPLAY_RULES_V2.canonical_domain_code) {
    if (band === "lower") {
      return "higher";
    }

    if (band === "higher") {
      return "lower";
    }

    return "balanced";
  }

  if (getIpipNeo120DomainDefinitionV2(normalizedDomainCode)) {
    return band as IpipNeo120ParticipantBandV2;
  }

  return null;
}

export function getIpipNeo120ParticipantDisplayBandLabelForDomainV2(
  domainCode: string,
  band: string,
): string | null {
  const displayBand = getIpipNeo120ParticipantDisplayBandForDomainV2(domainCode, band);

  if (!displayBand) {
    return null;
  }

  return getIpipNeo120BandMeaningV2(displayBand)?.label ?? null;
}

export function requireIpipNeo120DomainDefinitionV2(
  domainCode: string,
): IpipNeo120DomainDefinitionV2 {
  const definition = getIpipNeo120DomainDefinitionV2(domainCode);

  if (!definition) {
    throw new Error(`Unknown IPIP-NEO-120 domain code: ${domainCode}`);
  }

  return definition;
}

export function requireIpipNeo120FacetDefinitionV2(
  facetCode: string,
): IpipNeo120FacetDefinitionV2 {
  const definition = getIpipNeo120FacetDefinitionV2(facetCode);

  if (!definition) {
    throw new Error(`Unknown IPIP-NEO-120 facet code: ${facetCode}`);
  }

  return definition;
}

export function requireIpipNeo120BandMeaningV2(
  band: string,
): IpipNeo120BandMeaningV2 {
  const meaning = getIpipNeo120BandMeaningV2(band);

  if (!meaning) {
    throw new Error(`Unknown IPIP-NEO-120 participant band: ${band}`);
  }

  return meaning;
}

function requireIpipNeo120ParticipantBandMeaningForDomainV2(
  domainCode: string,
  band: string,
): IpipNeo120ParticipantBandMeaningV2 {
  const meaning = getIpipNeo120ParticipantBandMeaningForDomainV2(domainCode, band);

  if (!meaning) {
    throw new Error(`Unknown IPIP-NEO-120 domain band: ${domainCode}:${band}`);
  }

  return meaning;
}

function requireIpipNeo120ParticipantBandMeaningForFacetV2(
  facetCode: string,
  band: string,
): IpipNeo120ParticipantBandMeaningV2 {
  const meaning = getIpipNeo120ParticipantBandMeaningForFacetV2(facetCode, band);

  if (!meaning) {
    throw new Error(`Unknown IPIP-NEO-120 facet band: ${facetCode}:${band}`);
  }

  return meaning;
}

function assertKnownBand(band: string, path: string): asserts band is IpipNeo120ParticipantBandV2 {
  if (!getIpipNeo120BandMeaningV2(band)) {
    throw new Error(`${path}: Unknown IPIP-NEO-120 participant band: ${band}`);
  }
}

function sortDomainsByScoreDesc(
  domains: IpipNeo120ParticipantDomainInputV2[],
): IpipNeo120ParticipantDomainInputV2[] {
  return [...domains].sort((left, right) => {
    const scoreDifference = right.score - left.score;

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return (
      IPIP_NEO_120_DOMAIN_ORDER.indexOf(left.domain_code) -
      IPIP_NEO_120_DOMAIN_ORDER.indexOf(right.domain_code)
    );
  });
}

function sortSubdimensionsByScore(
  domains: IpipNeo120ParticipantDomainInputV2[],
  direction: "asc" | "desc",
): IpipNeo120ParticipantFacetInputV2[] {
  const canonicalFacetOrder = Object.values(IPIP_NEO_120_FACETS_BY_DOMAIN).flat();
  const subdimensions = domains.flatMap((domain) => domain.subdimensions);

  return [...subdimensions].sort((left, right) => {
    const scoreDifference =
      direction === "desc" ? right.score - left.score : left.score - right.score;

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return (
      canonicalFacetOrder.indexOf(left.facet_code) -
      canonicalFacetOrder.indexOf(right.facet_code)
    );
  });
}

function buildDeterministicSummaryV2(
  promptInput: IpipNeo120ParticipantReportPromptInput,
  domains: IpipNeo120ParticipantDomainInputV2[],
): IpipNeo120ParticipantAiInputV2["deterministic_summary"] {
  const rankedDomains =
    promptInput.deterministic_summary?.ranked_domains?.filter((domainCode) =>
      IPIP_NEO_120_DOMAIN_ORDER.includes(domainCode),
    ) ?? [];
  const computedRankedDomains = sortDomainsByScoreDesc(domains).map(
    (domain) => domain.domain_code,
  );

  return {
    ranked_domains:
      rankedDomains.length === IPIP_NEO_120_DOMAIN_ORDER.length
        ? rankedDomains
        : computedRankedDomains,
    highest_domains: domains
      .filter((domain) => domain.band === "higher")
      .map((domain) => domain.domain_code),
    lowest_domains: domains
      .filter((domain) => domain.band === "lower")
      .map((domain) => domain.domain_code),
    balanced_domains: domains
      .filter((domain) => domain.band === "balanced")
      .map((domain) => domain.domain_code),
    top_subdimensions:
      promptInput.deterministic_summary?.top_subdimensions?.length === 5
        ? promptInput.deterministic_summary.top_subdimensions
        : sortSubdimensionsByScore(domains, "desc")
            .slice(0, 5)
            .map((subdimension) => subdimension.facet_code),
    lowest_subdimensions: sortSubdimensionsByScore(domains, "asc")
      .slice(0, 5)
      .map((subdimension) => subdimension.facet_code),
  };
}

export function buildIpipNeo120ParticipantAiInputV2(
  promptInput: IpipNeo120ParticipantReportPromptInput,
): IpipNeo120ParticipantAiInputV2 {
  const promptDomainsByCode = new Map(
    promptInput.domains.map((domain) => [domain.domain_code, domain]),
  );

  const domains = IPIP_NEO_120_DOMAIN_ORDER.map((domainCode) => {
    const promptDomain = promptDomainsByCode.get(domainCode);

    if (!promptDomain) {
      throw new Error(`Missing IPIP-NEO-120 prompt domain: ${domainCode}`);
    }

    assertKnownBand(promptDomain.band, `domains.${domainCode}.band`);

    const domainDefinition = requireIpipNeo120DomainDefinitionV2(domainCode);
    const domainBandMeaning = requireIpipNeo120ParticipantBandMeaningForDomainV2(
      domainCode,
      promptDomain.band,
    );
    const promptSubdimensionsByCode = new Map(
      promptDomain.subdimensions.map((subdimension) => [
        subdimension.facet_code,
        subdimension,
      ]),
    );

    const subdimensions = IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map((facetCode) => {
      const promptSubdimension = promptSubdimensionsByCode.get(facetCode);

      if (!promptSubdimension) {
        throw new Error(`Missing IPIP-NEO-120 prompt facet: ${domainCode}.${facetCode}`);
      }

      assertKnownBand(
        promptSubdimension.band,
        `domains.${domainCode}.subdimensions.${facetCode}.band`,
      );

      const facetDefinition = requireIpipNeo120FacetDefinitionV2(facetCode);
      const facetBandMeaning = requireIpipNeo120ParticipantBandMeaningForFacetV2(
        facetCode,
        promptSubdimension.band,
      );

      return {
        facet_code: facetCode,
        label: getIpipNeo120FacetLabel(facetCode) ?? facetDefinition.label,
        participant_display_label: facetDefinition.participant_display_label,
        score: promptSubdimension.score,
        band: promptSubdimension.band,
        band_label: requireIpipNeo120BandMeaningV2(promptSubdimension.band).label,
        display_direction: facetDefinition.display_direction,
        definition: facetDefinition.definition,
        band_meaning: facetBandMeaning,
      };
    });

    return {
      domain_code: domainCode,
      label: getIpipNeo120DomainLabel(domainCode) ?? domainDefinition.label,
      display_label: domainDefinition.display_label,
      participant_display_label: domainDefinition.participant_display_label,
      narrative_label: domainDefinition.narrative_label,
      score: promptDomain.score,
      band: promptDomain.band,
      band_label: requireIpipNeo120BandMeaningV2(promptDomain.band).label,
      display_score:
        getIpipNeo120ParticipantDisplayScoreForDomainV2(domainCode, promptDomain.score) ??
        promptDomain.score,
      display_band:
        getIpipNeo120ParticipantDisplayBandForDomainV2(domainCode, promptDomain.band) ??
        promptDomain.band,
      display_band_label:
        getIpipNeo120ParticipantDisplayBandLabelForDomainV2(domainCode, promptDomain.band) ??
        requireIpipNeo120BandMeaningV2(promptDomain.band).label,
      display_direction: domainDefinition.display_direction,
      definition: domainDefinition.definition,
      display_rule: domainDefinition.display_rule,
      band_meaning: domainBandMeaning,
      subdimensions,
    };
  });

  return {
    input_version: "ipip_neo_120_participant_input_v2",
    target_contract_version: "ipip_neo_120_participant_v2",
    test_slug: IPIP_NEO_120_TEST_SLUG,
    test_name: promptInput.test_name,
    audience: "participant",
    locale: promptInput.locale as "bs",
    language_rules: {
      language: "bosnian",
      script: "latin",
      variant: "ijekavica",
      address_style: "second_person_singular",
    },
    report_blueprint: IPIP_NEO_120_PARTICIPANT_AI_INPUT_SPEC_V2.report_blueprint,
    text_budgets: IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2,
    band_meanings: IPIP_NEO_120_BAND_MEANINGS_V2,
    vocabulary_rules: IPIP_NEO_120_PARTICIPANT_VOCABULARY_RULES_V2,
    consistency_rules: IPIP_NEO_120_PARTICIPANT_CONSISTENCY_RULES_V2,
    guardrails: IPIP_NEO_120_PARTICIPANT_GUARDRAILS_V2,
    static_text: IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2,
    scale_hint: {
      min: promptInput.scale_hint.min,
      max: promptInput.scale_hint.max,
      display_mode: "visual_with_discreet_numeric_support",
    },
    deterministic_summary: buildDeterministicSummaryV2(promptInput, domains),
    domains,
  };
}

export type IpipNeo120ParticipantAiInputV2ValidationResult =
  | { ok: true; value: IpipNeo120ParticipantAiInputV2 }
  | { ok: false; errors: string[] };

export function validateIpipNeo120ParticipantAiInputV2(
  input: unknown,
): IpipNeo120ParticipantAiInputV2ValidationResult {
  const errors: string[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["input: Expected object."] };
  }

  const value = input as Partial<IpipNeo120ParticipantAiInputV2>;

  if (value.input_version !== "ipip_neo_120_participant_input_v2") {
    errors.push("input_version: Expected ipip_neo_120_participant_input_v2.");
  }

  if (value.target_contract_version !== "ipip_neo_120_participant_v2") {
    errors.push("target_contract_version: Expected ipip_neo_120_participant_v2.");
  }

  if (value.audience !== "participant") {
    errors.push("audience: Expected participant.");
  }

  if (!Array.isArray(value.domains)) {
    errors.push("domains: Expected array.");
  } else {
    if (value.domains.length !== 5) {
      errors.push("domains: Expected exactly 5 domains.");
    }

    let totalSubdimensions = 0;

    value.domains.forEach((domain, domainIndex) => {
      const expectedDomainCode = IPIP_NEO_120_DOMAIN_ORDER[domainIndex];

      if (!expectedDomainCode) {
        return;
      }

      if (domain.domain_code !== expectedDomainCode) {
        errors.push(`domains[${domainIndex}].domain_code: Expected ${expectedDomainCode}.`);
      }

      const domainDefinition = getIpipNeo120DomainDefinitionV2(expectedDomainCode);

      if (!domain.definition) {
        errors.push(`domains[${domainIndex}].definition: Missing definition.`);
      }

      if (!domain.participant_display_label) {
        errors.push(`domains[${domainIndex}].participant_display_label: Missing label.`);
      }

      if (!domain.display_label) {
        errors.push(`domains[${domainIndex}].display_label: Missing display label.`);
      }

      if (!domain.narrative_label) {
        errors.push(`domains[${domainIndex}].narrative_label: Missing narrative label.`);
      }

      if (domain.display_label !== domainDefinition?.display_label) {
        errors.push(
          `domains[${domainIndex}].display_label: Expected ${domainDefinition?.display_label ?? "(unknown)"}.`,
        );
      }

      if (domain.narrative_label !== domainDefinition?.narrative_label) {
        errors.push(
          `domains[${domainIndex}].narrative_label: Expected ${domainDefinition?.narrative_label ?? "(unknown)"}.`,
        );
      }

      if (!Number.isFinite(domain.display_score)) {
        errors.push(`domains[${domainIndex}].display_score: Missing display score.`);
      }

      if (!domain.display_band) {
        errors.push(`domains[${domainIndex}].display_band: Missing display band.`);
      }

      if (!domain.display_band_label) {
        errors.push(`domains[${domainIndex}].display_band_label: Missing display band label.`);
      }

      if (!domain.display_direction) {
        errors.push(`domains[${domainIndex}].display_direction: Missing display direction.`);
      }

      if (!domain.band_meaning) {
        errors.push(`domains[${domainIndex}].band_meaning: Missing band meaning.`);
      }

      if (expectedDomainCode !== "NEUROTICISM") {
        if (domain.display_score !== domain.score) {
          errors.push(`domains[${domainIndex}].display_score: Expected canonical score for direct domain.`);
        }

        if (domain.display_band !== domain.band) {
          errors.push(`domains[${domainIndex}].display_band: Expected canonical band for direct domain.`);
        }

        if (domain.display_band_label !== domain.band_label) {
          errors.push(`domains[${domainIndex}].display_band_label: Expected canonical band label for direct domain.`);
        }
      } else {
        const expectedDisplayScore = getIpipNeo120ParticipantDisplayScoreForDomainV2(
          expectedDomainCode,
          domain.score,
        );
        const expectedDisplayBand = getIpipNeo120ParticipantDisplayBandForDomainV2(
          expectedDomainCode,
          domain.band,
        );
        const expectedDisplayBandLabel = getIpipNeo120ParticipantDisplayBandLabelForDomainV2(
          expectedDomainCode,
          domain.band,
        );

        if (domain.display_score !== expectedDisplayScore) {
          errors.push(`domains[${domainIndex}].display_score: Expected inverted participant display score.`);
        }

        if (domain.display_band !== expectedDisplayBand) {
          errors.push(`domains[${domainIndex}].display_band: Expected inverted participant display band.`);
        }

        if (domain.display_band_label !== expectedDisplayBandLabel) {
          errors.push(`domains[${domainIndex}].display_band_label: Expected participant display band label.`);
        }
      }

      if (
        expectedDomainCode === "NEUROTICISM" &&
        domain.display_direction !== "inverted_for_participant_domain_display"
      ) {
        errors.push(
          "domains[3].display_direction: NEUROTICISM must use inverted_for_participant_domain_display.",
        );
      }

      if (!Array.isArray(domain.subdimensions)) {
        errors.push(`domains[${domainIndex}].subdimensions: Expected array.`);
        return;
      }

      if (domain.subdimensions.length !== 6) {
        errors.push(`domains[${domainIndex}].subdimensions: Expected exactly 6 items.`);
      }

      totalSubdimensions += domain.subdimensions.length;

      const expectedFacets = IPIP_NEO_120_FACETS_BY_DOMAIN[expectedDomainCode];

      domain.subdimensions.forEach((subdimension, facetIndex) => {
        const expectedFacetCode = expectedFacets[facetIndex];

        if (!expectedFacetCode) {
          return;
        }

        if (subdimension.facet_code !== expectedFacetCode) {
          errors.push(
            `domains[${domainIndex}].subdimensions[${facetIndex}].facet_code: Expected ${expectedFacetCode}.`,
          );
        }

        if (!subdimension.definition) {
          errors.push(
            `domains[${domainIndex}].subdimensions[${facetIndex}].definition: Missing definition.`,
          );
        }

        if (!subdimension.participant_display_label) {
          errors.push(
            `domains[${domainIndex}].subdimensions[${facetIndex}].participant_display_label: Missing label.`,
          );
        }

        if (!subdimension.display_direction) {
          errors.push(
            `domains[${domainIndex}].subdimensions[${facetIndex}].display_direction: Missing display direction.`,
          );
        }

        if (!subdimension.band_meaning) {
          errors.push(
            `domains[${domainIndex}].subdimensions[${facetIndex}].band_meaning: Missing band meaning.`,
          );
        }

        if (
          expectedDomainCode === "NEUROTICISM" &&
          subdimension.display_direction !== "direct_but_non_clinical"
        ) {
          errors.push(
            `domains[${domainIndex}].subdimensions[${facetIndex}].display_direction: NEUROTICISM facets must use direct_but_non_clinical.`,
          );
        }
      });
    });

    if (totalSubdimensions !== 30) {
      errors.push("domains.subdimensions: Expected exactly 30 total subdimensions.");
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: value as IpipNeo120ParticipantAiInputV2 };
}

// Compile-time alignment checks against the canonical source of truth.
void IPIP_NEO_120_DOMAIN_ORDER;
void IPIP_NEO_120_FACETS_BY_DOMAIN;
