"use client";

import { useState } from "react";

import type { CompletedAssessmentReportState } from "@/lib/assessment/reports";
import {
  formatDimensionLabel,
  formatScoreLabel,
  getDimensionHelperLabel,
} from "@/lib/assessment/result-display";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";

type CompletedAssessmentSummaryProps = {
  completedAt?: string | null;
  organizationName?: string | null;
  participantName?: string | null;
  testName?: string | null;
  results: CompletedAssessmentResults | null;
  reportState: CompletedAssessmentReportState | null;
};

type DimensionViewModel = {
  key: string;
  label: string;
  helperLabel: string | null;
  score: number;
  averageScore: number;
  scoredQuestionCount: number;
  shortInterpretation: string;
  scoreWidth: number;
  rank: number;
  totalDimensions: number;
};

type DimensionDetailBlock = {
  heading:
    | "Kako se to kod tebe često pokazuje"
    | "Šta ti to može donositi kao prednost"
    | "Na šta vrijedi obratiti pažnju";
  body: string;
};

type ReportDimensionSnapshot = {
  dimension_code: string;
  summary: string;
  work_style: string;
  risks: string;
  development_focus: string;
};

function getReportDimensionsByKey(
  reportState: CompletedAssessmentReportState | null,
): Map<string, ReportDimensionSnapshot> {
  if (reportState?.status !== "ready") {
    return new Map();
  }

  return reportState.report.dimension_insights.reduce((dimensionsByKey, dimension) => {
    if (!dimension.dimension_code || dimensionsByKey.has(dimension.dimension_code)) {
      return dimensionsByKey;
    }

    dimensionsByKey.set(dimension.dimension_code, dimension);
    return dimensionsByKey;
  }, new Map<string, ReportDimensionSnapshot>());
}

function formatUnscoredReason(
  reason: CompletedAssessmentResults["unscoredResponses"][number]["reason"],
): string {
  if (reason === "question_type_not_scoreable") {
    return "Zabilježeno, ali nije bodovano u trenutnom MVP modelu.";
  }

  return "Zabilježeno bez numeričkih scoring vrijednosti u trenutnim seed podacima.";
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getLeadSentence(text: string): string {
  return splitIntoSentences(text)[0] ?? text.trim();
}

function stripInsightLabel(text: string): string {
  return text.replace(/^[^:]{2,40}:\s*/, "").trim();
}

function ensureSentence(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function getAverageScore(rawScore: number, scoredQuestionCount: number): number {
  if (scoredQuestionCount === 0) {
    return 0;
  }

  return Math.round((rawScore / scoredQuestionCount) * 100) / 100;
}

function getScoreBand(score: number): "high" | "mid" | "low" {
  if (score >= 3.67) {
    return "high";
  }

  if (score >= 2.34) {
    return "mid";
  }

  return "low";
}

function toSecondPersonSingular(text: string): string {
  return text
    .replace(/\bProfil pokazuje\b/gi, "Pokazuješ")
    .replace(/\bRezultat pokazuje\b/gi, "Tvoji rezultati pokazuju")
    .replace(/\bVjerovatno glavno uporište radnog stila:\s*/gi, "U tvom radnom stilu najviše se ističe ")
    .replace(/\bSekundarni signal:\s*/gi, "Dodatno se primjećuje da ")
    .replace(/\bje najuočljiviji signal u ovom pokušaju\b/gi, "se kod tebe najviše ističe")
    .replace(/\bje komparativno niže izražena i treba je čitati kao razvojnu oblast, a ne kao nedostatak\b/gi, "je kod tebe suptilnija i najkorisnije ju je gledati kao prostor za razvoj, a ne kao nedostatak")
    .replace(/\bje niže izražena u ovom obrascu odgovora, pa osoba može\b/gi, "je kod tebe manje izražena, pa možeš")
    .replace(/\bosoba može\b/gi, "možeš")
    .replace(/\bukupni profil\b/gi, "ukupan obrazac")
    .replace(/\bukupnog profila\b/gi, "tvog ukupnog obrasca")
    .replace(/\bprofil može\b/gi, "možeš")
    .replace(/\bu ovom obrascu odgovora\b/gi, "u svojim odgovorima")
    .replace(/\bu ovom završenom pokušaju\b/gi, "u svojim odgovorima")
    .replace(/\bu ovom pokušaju\b/gi, "u svojim odgovorima")
    .replace(/\bovom pokušaju\b/gi, "tvojim odgovorima")
    .replace(/\bprofil\b/gi, "obrazac")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTopInsightSentence(text: string): string {
  const cleaned = stripInsightLabel(getLeadSentence(toSecondPersonSingular(text)));
  const normalized = cleaned.replace(/\s+/g, " ").trim();
  const rewrites: Array<[RegExp, string]> = [
    [
      /^Često djeluje energizirano kroz socijalni kontakt i vidljivo uključivanje\.?$/i,
      "Kroz kontakt s drugima često se osjećaš energizirano i prirodno se uključuješ u dešavanja.",
    ],
    [
      /^Pokazuje uravnotežen spoj otvorenog angažmana i promišljenijeg tempa\.?$/i,
      "Pokazuješ dobar balans između otvorenog angažmana i promišljenijeg tempa.",
    ],
    [
      /^Može preferirati mirnije okruženje i odmjereniji interpersonalni ritam\.?$/i,
      "Često preferiraš mirnije okruženje i odmjereniji ritam u odnosima s drugima.",
    ],
    [
      /^Naglašava saradnju, taktičnost i kvalitet međuljudskih odnosa\.?$/i,
      "U odnosima s drugima često naglašavaš saradnju, taktičnost i dobar kvalitet odnosa.",
    ],
    [
      /^Može dobro balansirati iskrenost i saradnju, zavisno od konteksta\.?$/i,
      "Zavisno od situacije, dobro balansiraš iskrenost i saradnju.",
    ],
    [
      /^Može češće birati direktan izazov umjesto prilagođavanja ili konsenzusa\.?$/i,
      "Često biraš direktan pristup umjesto prilagođavanja ili traženja konsenzusa.",
    ],
    [
      /^Vjerovatno vrednuje strukturu, dosljednost i pouzdanu realizaciju\.?$/i,
      "Vjerovatno posebno vrednuješ strukturu, dosljednost i pouzdanu realizaciju.",
    ],
    [
      /^Može se prilagođavati između planiranja i fleksibilnosti kako se zahtjevi mijenjaju\.?$/i,
      "Kako se zahtjevi mijenjaju, znaš dobro prelaziti između planiranja i fleksibilnosti.",
    ],
    [
      /^Može raditi spontanije i imati korist od jasnije vanjske strukture\.?$/i,
      "Često radiš spontanije, a jasnija vanjska struktura ti može pomoći da lakše održiš ritam.",
    ],
    [
      /^Vjerovatno zadržava stabilnost i pod uobičajenim pritiskom\.?$/i,
      "U zahtjevnijim situacijama često ostaješ pribran i pod uobičajenim pritiskom.",
    ],
    [
      /^Pokazuje mješovit profil nošenja sa stresom koji može varirati po opterećenju ili kontekstu\.?$/i,
      "Na stres reaguješ različito, zavisno od opterećenja i konkretnog konteksta.",
    ],
    [
      /^Može intenzivnije doživljavati pritisak i imati korist od stabilnijih navika oporavka\.?$/i,
      "Pritisak možeš doživjeti intenzivnije, pa ti stabilnije navike oporavka mogu biti posebno korisne.",
    ],
    [
      /^Često je usmjeren prema idejama, istraživanju i konceptualnoj raznolikosti\.?$/i,
      "Često si usmjeren prema idejama, istraživanju i konceptualnoj raznolikosti.",
    ],
    [
      /^Može prihvatati nove ideje uz zadržavanje vrijednosti poznatih pristupa\.?$/i,
      "Otvoren si za nove ideje, ali i dalje vidiš vrijednost poznatih pristupa.",
    ],
    [
      /^Može preferirati praktičnu jasnoću umjesto apstraktnog istraživanja\.?$/i,
      "Češće preferiraš praktičnu jasnoću nego apstraktno istraživanje.",
    ],
  ];

  for (const [pattern, replacement] of rewrites) {
    if (pattern.test(normalized)) {
      return replacement;
    }
  }

  const directAddressPattern =
    /\b(ti|tvoj|tvom|tvoje|tvojim|pokazuješ|ostaješ|možeš|vrednuješ|preferiraš|naglašavaš|biraš|zadržavaš|reaguješ|pristupaš|prihvataš|radiš|osjećaš|znaš|si)\b/i;

  if (directAddressPattern.test(normalized)) {
    return ensureSentence(normalized);
  }

  if (/^u tvom\b/i.test(normalized) || /^tvoji\b/i.test(normalized)) {
    return ensureSentence(normalized);
  }

  return ensureSentence(`Kod tebe se posebno vidi da ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`);
}

function joinSentences(...sentences: Array<string | null | undefined>): string {
  return sentences
    .filter((sentence): sentence is string => Boolean(sentence))
    .map((sentence) => ensureSentence(sentence))
    .join(" ");
}

function getRankContext(dimension: DimensionViewModel): string {
  if (dimension.rank === 0) {
    return "Ovo je jedna od izraženijih niti tvog trenutnog obrasca i često daje ton načinu na koji prilaziš ljudima i zadacima";
  }

  if (dimension.rank === dimension.totalDimensions - 1) {
    return "Ova dimenzija je kod tebe tiša, pa je najkorisnije pratiti kako se uključuje onda kada situacija to zaista traži";
  }

  return "Ova dimenzija kod tebe djeluje kao stabilna sredina, pa često služi kao način da zadržiš ravnotežu između impulsa i zahtjeva situacije";
}

function getFallbackDimensionDetailBlocks(dimension: DimensionViewModel): DimensionDetailBlock[] {
  return [
    {
      heading: "Kako se to kod tebe često pokazuje",
      body: joinSentences(
        getRankContext(dimension),
        "Najčešće se vidi kroz sitne izbore u tempu, komunikaciji i načinu na koji odgovaraš na očekivanja oko sebe",
      ),
    },
    {
      heading: "Šta ti to može donositi kao prednost",
      body: "Kada ovu tendenciju koristiš svjesno, može ti pomoći da prirodnije pronađeš stil rada i saradnje koji ti stvarno odgovara umjesto da radiš protiv sebe.",
    },
    {
      heading: "Na šta vrijedi obratiti pažnju",
      body: "Vrijedi paziti da ovu stranu sebe ne uzmeš kao fiksno pravilo, jer najbolji rezultat obično dolazi kada zadržiš malo fleksibilnosti prema kontekstu i ljudima oko sebe.",
    },
  ];
}

function getDimensionDetailBlocks(dimension: DimensionViewModel): DimensionDetailBlock[] {
  const band = getScoreBand(dimension.averageScore);

  const contentByDimension: Record<string, Record<"high" | "mid" | "low", DimensionDetailBlock[]>> = {
    extraversion: {
      high: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često ti prija kontakt s ljudima, brže se uključuješ u razgovor i lakše unosiš energiju u prostor. U grupi se obično ne povlačiš dugo, nego spontano zauzmeš svoje mjesto.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može pomoći u povezivanju, pokretanju saradnje i davanju zamaha timu kada treba probiti početnu rezervu. Ljudi te često lakše primijete i zapamte jer djeluješ pristupačno i angažovano.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da brzina uključivanja ne ostavi premalo prostora za tuđi ritam ili tiše signale u razgovoru. Nekad upravo kratka pauza i više slušanja pojačaju utisak koji već prirodno ostavljaš.",
        },
      ],
      mid: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Kod tebe se često vidi dobar balans između društvene otvorenosti i potrebe za vlastitim tempom. Znaš biti prisutan i topao, ali bez potrebe da budeš u centru svake situacije.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "Ovakav raspon ti može pomoći da se prilagodiš različitim ljudima i okruženjima bez velikog napora. U saradnji možeš prirodno prebacivati između angažmana, slušanja i mirnijeg promišljanja.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Pošto možeš djelovati i otvoreno i odmjereno, nekad drugi teže procijene kada ti treba više prostora, a kada više interakcije. Korisno je da to kažeš jasnije umjesto da pretpostaviš da će drugi sami prepoznati tvoj ritam.",
        },
      ],
      low: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često ti više odgovaraju mirniji razgovori, manji broj ljudi i situacije u kojima ne moraš stalno biti izložen. Obično se lakše otvaraš kada prvo osjetiš smisao, sigurnost ili dovoljno prostora za svoj tempo.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može davati smirenije prisustvo, bolju selektivnost u odnosima i više fokusa kada buka okoline raste. U radu često pomaže jer ne trošiš energiju na stalnu socijalnu aktivaciju nego je čuvaš za ono što ti je važno.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da potreba za mirom ne bude pogrešno pročitana kao nezainteresovanost ili distanca kada ti to zapravo nisi. Nekad je dovoljno da ranije pokažeš namjeru iako ne želiš odmah puno pričati.",
        },
      ],
    },
    agreeableness: {
      high: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često paziš kako tvoje riječi utiču na druge i prirodno tražiš ton koji čuva odnos. U saradnji ti je važno da komunikacija ostane korektna, a da ljudi osjete poštovanje i dobru namjeru.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može pomagati u građenju povjerenja, smirivanju tenzije i lakšem povezivanju različitih ljudi. Često si neko uz koga saradnja djeluje sigurnije i manje iscrpljujuće.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da želja za skladom ne potisne ono što ti stvarno misliš ili trebaš reći. Tvoja obzirnost ima najveću vrijednost kada uz nju ostane i dovoljno jasna granica.",
        },
      ],
      mid: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Kod tebe se često vidi balans između saradnje i direktnosti. Znaš biti obziran, ali i reći šta misliš kada procijeniš da je to korisnije od pukog slaganja.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može donositi vjerodostojnost u odnosima jer ne djeluješ ni pretjerano mekan ni nepotrebno tvrd. U radu i dogovaranju često pomaže zato što možeš čuvati odnos, a ipak gurati stvari naprijed.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Pošto se dobro krećeš između takta i iskrenosti, nekad možeš predugo vagati koji pristup je pravi. Korisno je da ranije odlučiš kada je važniji mir, a kada je važnija potpuna jasnoća.",
        },
      ],
      low: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često radije ideš direktno na suštinu nego da dugo ublažavaš poruku. Kada nešto ne vidiš kao dobro rješenje, vjerovatno ti je prirodnije da to jasno pokažeš nego da ostaneš u diplomatskoj neodređenosti.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može donositi brzinu, odlučnost i veću spremnost da otvoriš teške teme koje drugi zaobilaze. U situacijama gdje treba presjeći maglu, tvoja direktnost može biti veoma korisna.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da jasnoća ne zazvuči oštrije nego što namjeravaš, posebno kada druga strana traži više takta nego argumenta. Nekad mala doza topline u formi pojača prijem tvoje poruke bez gubitka iskrenosti.",
        },
      ],
    },
    conscientiousness: {
      high: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Vjerovatno ti prijaju struktura, red i osjećaj da stvari imaju jasan tok. Često misliš unaprijed, pratiš detalje i osjetiš unutrašnje zadovoljstvo kada obaveze držiš pod kontrolom.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može pomagati u pouzdanosti, dosljednosti i pretvaranju planova u stvarne rezultate. Ljudi te često mogu doživjeti kao nekoga na koga se može računati kada treba iznijeti posao do kraja.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da visoki kriteriji ne prerastu u nepotreban pritisak ili osjećaj da sve mora biti potpuno sređeno prije kretanja. Ponekad je dovoljno da nešto bude dovoljno dobro da bi moglo ići dalje.",
        },
      ],
      mid: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Kod tebe se često vidi praktičan balans između plana i fleksibilnosti. Možeš se organizovati kada treba, ali obično ne djeluješ ukočeno ako se okolnosti usput promijene.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može biti korisno jer znaš održati osnovni red bez gušenja spontanosti. U radu i saradnji često znači da možeš pratiti dogovor, a ipak ostati dovoljno prilagodljiv kada realnost krene drugim putem.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Pošto se dobro snalaziš između strukture i improvizacije, nekad možeš prekasno primijetiti da zadatak ipak traži više sistema nego što si mu dao. Korisno je ranije procijeniti kada je dosta fleksibilnosti, a kada treba čvršći okvir.",
        },
      ],
      low: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često ti više odgovara spontaniji tok nego strogo praćenje unaprijed zadatog reda. Možeš brzo reagovati, krenuti iz momenta i tražiti vlastiti način umjesto da se oslanjaš na rigidnu rutinu.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može donositi svježinu, bržu prilagodbu i manje zakočenosti kada se okolnosti naglo mijenjaju. Posebno može pomoći tamo gdje treba uhvatiti momentum umjesto čekati savršen plan.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da spontanost ne pojede kontinuitet u stvarima koje traže praćenje, dovršavanje i dosljedan ritam. Često nije potreban veliki sistem, nego samo nekoliko vanjskih oslonaca koji te vraćaju na bitno.",
        },
      ],
    },
    emotional_stability: {
      high: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "U zahtjevnijim situacijama često zadržiš prisebnost i ne prepuštaš se lako početnom talasu pritiska. Drugima možeš djelovati kao neko ko i pod opterećenjem ostaje dovoljno miran da razmišlja jasno.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može pomoći u donošenju odluka, smirenijoj komunikaciji i održavanju stabilnog ritma kada okolina postane napeta. Ljudi uz tebe često lakše ostaju fokusirani jer ne pojačavaš dodatno stres u prostoru.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da unutrašnju stabilnost ne pretvoriš u preveliku distancu prema vlastitim signalima umora ili tuđoj emocionalnoj reakciji. Nekad baš ono što te drži mirnim treba dopuniti malo otvorenijim pokazivanjem kako ti je.",
        },
      ],
      mid: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Na pritisak vjerovatno reaguješ zavisno od konteksta, intenziteta i toga koliko imaš kontrole nad situacijom. Nekad ostaješ vrlo sabran, a nekad ti treba više vremena da vratiš unutrašnji mir.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "Ovakav raspon ti može pomoći jer nisi ni previše tvrd prema sebi ni potpuno preplavljen kada stvari postanu zahtjevne. Kada prepoznaš šta te stabilizuje, obično možeš prilično dobro vratiti fokus i ritam.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Pošto tvoja reakcija zavisi od situacije, korisno je da ranije prepoznaš svoje okidače umjesto da ih primijetiš tek kad se nakupi pritisak. Mala, redovna briga o oporavku ovdje često pravi veću razliku nego veliki jednokratni potezi.",
        },
      ],
      low: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Pritisak možeš osjetiti brže i intenzivnije, posebno kada se nagomilaju neizvjesnost, očekivanja ili previše otvorenih frontova. To ne znači slabost, nego da tvoj sistem ranije registruje opterećenje i traži više regulacije.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "Kad to dobro upoznaš, može ti pomoći da ranije primijetiš šta nije održivo i da ozbiljnije shvatiš signale iscrpljenosti koje drugi ignorišu. Ta osjetljivost može te učiniti pažljivijim prema kvalitetu okruženja i načinu rada koji ti stvarno odgovara.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da intenzitet trenutnog osjećaja ne postane jedina slika cijele situacije. Korisno je unaprijed graditi male navike smirivanja i oslonce koji te vraćaju u osjećaj kontrole prije nego što stres preuzme tempo.",
        },
      ],
    },
    intellect: {
      high: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često te privuku nove ideje, drugačiji uglovi gledanja i prostor za istraživanje van očiglednog. Vjerovatno ti prija kada možeš povezivati teme, postavljati pitanja i širiti sliku prije nego što je zatvoriš.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može donositi kreativniji pristup, lakše učenje i veću spremnost da vidiš rješenja koja nisu odmah standardna. U razgovoru i radu često pomaže jer unosiš svježinu, radoznalost i mentalnu širinu.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da širina interesa ne odvuče fokus sa onoga što trenutno treba privesti kraju. Nekad najbolji efekat dolazi kada radoznalost namjerno spojiš s vrlo konkretnim narednim korakom.",
        },
      ],
      mid: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Kod tebe se često vidi otvorenost za novo, ali bez potrebe da svaka stvar bude potpuno drugačija ili eksperimentalna. Možeš prihvatiti novu ideju kada vidiš smisao, a istovremeno zadržati poštovanje prema onome što već radi.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može pomagati da spajaš praktičnost i svježinu bez nepotrebnog idealizovanja novog ili starog. U saradnji je korisno jer često možeš biti most između onih koji guraju promjenu i onih kojima treba više sigurnosti.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Pošto vidiš vrijednost na obje strane, nekad možeš predugo ostati između istraživanja i odluke. Korisno je ranije odrediti kad je vrijeme za još pitanja, a kad je dovoljno jasno da kreneš dalje.",
        },
      ],
      low: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često ti više odgovara jasno, konkretno i primjenjivo nego dugo zadržavanje u apstraktnim idejama. Kada nešto procjenjuješ, vjerovatno ti je važno da brzo vidiš čemu služi i kako se može stvarno upotrijebiti.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može donositi praktičnost, manje rasipanja energije i bolji osjećaj za ono što je zaista izvedivo. U radu često pomaže jer brže spuštaš stvari na zemlju i tražiš upotrebljivo rješenje umjesto teorijskog sjaja.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da potreba za jasnoćom ne zatvori vrata ideji koja u početku još nema savršen oblik. Nekad mala doza istraživanja prije zaključka otvori rješenje koje bi inače ostalo neprimijećeno.",
        },
      ],
    },
  };

  return contentByDimension[dimension.key]?.[band] ?? getFallbackDimensionDetailBlocks(dimension);
}

function formatCompletedAt(value?: string | null): string {
  if (!value) {
    return "Nije dostupno";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Nije dostupno";
  }

  const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}. ${month} ${year}, ${hours}:${minutes}`;
}

function getTopInsights(
  reportState: CompletedAssessmentReportState | null,
  dimensions: DimensionViewModel[],
): string[] {
  if (reportState?.status !== "ready") {
    return [];
  }

  const candidates = [
    ...reportState.report.strengths.map((item) => item.description),
    ...reportState.report.blind_spots.map((item) => item.description),
    ...reportState.report.development_recommendations.map((item) => item.description),
    ...reportState.report.dimension_insights.map((item) => item.work_style),
    ...dimensions.map((dimension) => dimension.shortInterpretation),
  ];

  const uniqueItems = candidates.filter((item, index) => {
    const normalized = item.trim().toLowerCase();
    return normalized.length > 0 && candidates.findIndex((candidate) => candidate.trim().toLowerCase() === normalized) === index;
  });

  return uniqueItems
    .slice(0, 3)
    .map((item) => formatTopInsightSentence(item));
}

function getConclusion(
  reportState: CompletedAssessmentReportState | null,
  dimensions: DimensionViewModel[],
): string[] {
  if (reportState?.status !== "ready") {
    return [];
  }

  const highest = dimensions[0];
  const lowest = dimensions[dimensions.length - 1];
  const summaryLead =
    splitIntoSentences(toSecondPersonSingular(reportState.report.summary.headline))[0] ?? null;
  const firstParagraph = [
    summaryLead,
    highest ? `${highest.label} se kod tebe najviše ističe.` : null,
    lowest
      ? `${lowest.label} je suptilnija i daje mirniji ton tvom ukupnom obrascu.`
      : null,
  ]
    .filter((sentence): sentence is string => Boolean(sentence))
    .join(" ");
  const secondParagraph = toSecondPersonSingular(
    reportState.report.summary.overview,
  );

  return [firstParagraph, secondParagraph].filter(Boolean);
}

function getRecommendations(
  reportState: CompletedAssessmentReportState | null,
): Array<{ title: string; description: string; action: string }> {
  if (reportState?.status !== "ready") {
    return [];
  }

  return reportState.report.development_recommendations.slice(0, 3);
}

function formatRecommendation(item: {
  title: string;
  description: string;
  action: string;
}): { lead: string; body: string | null } {
  return {
    lead: item.title.trim().replace(/[.,;:!?]+$/, ""),
    body: `${item.description.trim()} ${item.action.trim()}`.trim(),
  };
}

export function CompletedAssessmentSummary({
  completedAt,
  organizationName,
  participantName,
  testName,
  results,
  reportState,
}: CompletedAssessmentSummaryProps) {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const hasResults = results !== null;

  const maxRawScore =
    results && results.dimensions.length > 0
      ? Math.max(...results.dimensions.map((dimension) => dimension.rawScore), 0)
      : 0;

  const reportDimensionsByKey = getReportDimensionsByKey(reportState);

  const dimensionCards: DimensionViewModel[] =
    results?.dimensions.map((dimension, index, dimensions) => {
      const reportDimension = reportDimensionsByKey.get(dimension.dimension);

      return {
        key: dimension.dimension,
        label: formatDimensionLabel(dimension.dimension),
        helperLabel: getDimensionHelperLabel(dimension.dimension),
        score: dimension.rawScore,
        averageScore: getAverageScore(dimension.rawScore, dimension.scoredQuestionCount),
        scoredQuestionCount: dimension.scoredQuestionCount,
        shortInterpretation:
          reportDimension?.summary ??
          "Detaljna interpretacija za ovu dimenziju trenutno nije dostupna.",
        scoreWidth: maxRawScore > 0 ? Math.max((dimension.rawScore / maxRawScore) * 100, 10) : 0,
        rank: index,
        totalDimensions: dimensions.length,
      };
    }) ?? [];

  const topInsights = getTopInsights(reportState, dimensionCards);
  const conclusionParagraphs = getConclusion(reportState, dimensionCards);
  const recommendations = getRecommendations(reportState);
  const scoreRangeLabel = maxRawScore > 0 ? `0–${maxRawScore} bodova` : null;
  const primaryMetaCount = [participantName, organizationName].filter(Boolean).length;
  const hasScoredDimensions = dimensionCards.length > 0;
  const shouldShowNarrativePending =
    reportState === null ||
    reportState.status === "queued" ||
    reportState.status === "processing";
  const shouldShowNarrativeFailed =
    reportState?.status === "failed" || reportState?.status === "unavailable";
  const shouldShowResultsUnavailable = !hasResults;

  return (
    <div className="results-report stack-md">
      <section className="results-report__hero">
        <div className="results-report__hero-copy">
          <p className="results-report__eyebrow">Izvještaj procjene</p>
          <h2>{testName ?? "Rezultati procjene"}</h2>

          <div className="results-report__hero-meta-wrap">
            <dl className="results-report__hero-meta">
              {participantName ? (
                <div className={primaryMetaCount === 1 ? "results-report__hero-meta-item results-report__hero-meta-item--wide" : "results-report__hero-meta-item"}>
                  <dt>Korisnik</dt>
                  <dd>{participantName}</dd>
                </div>
              ) : null}
              {organizationName ? (
                <div className={primaryMetaCount === 1 ? "results-report__hero-meta-item results-report__hero-meta-item--wide" : "results-report__hero-meta-item"}>
                  <dt>Organizacija</dt>
                  <dd>{organizationName}</dd>
                </div>
              ) : null}
              <div className="results-report__hero-meta-item results-report__hero-meta-item--wide">
                <dt>Završeno</dt>
                <dd>{formatCompletedAt(completedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {topInsights.length > 0 ? (
          <section
            className="results-report__hero-insights results-report__hero-insights--mobile"
            aria-label="Top insights"
          >
            <p className="results-report__hero-label">Top uvidi</p>
            <ul className="results-insight-list">
              {topInsights.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>

      {topInsights.length > 0 ? (
        <section
          className="results-report__section results-report__section--insights results-report__panel card stack-sm"
          aria-label="Top insights"
        >
          <div className="results-report__section-heading">
            <p className="results-report__section-kicker">Top uvidi</p>
            <h3>Sažetak ključnih obrazaca</h3>
          </div>
          <ul className="results-insight-list">
            {topInsights.map((insight) => (
              <li key={insight}>{insight}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {shouldShowNarrativePending ? (
        <section className="results-report__section results-report__status results-report__panel card stack-sm">
          <div className="results-report__section-heading">
            <h3>Izvještaj se priprema</h3>
          </div>
          <p className="results-report__section-body">
            Tvoj izvještaj je zaprimljen i trenutno se obrađuje. Ova stranica će se osvježavati
            automatski čim izvještaj bude spreman.
          </p>
        </section>
      ) : null}

      {shouldShowNarrativeFailed ? (
        <section className="results-report__section results-report__status results-report__panel card stack-sm">
          <div className="results-report__section-heading">
            <h3>Izvještaj trenutno nije dostupan</h3>
          </div>
          <p className="results-report__section-body">
            Obrada izvještaja za ovaj završeni pokušaj trenutno nije uspjela. Bodovani rezultati i
            dalje ostaju dostupni ispod.
          </p>
        </section>
      ) : null}

      {shouldShowResultsUnavailable ? (
        <section className="results-report__section results-report__status results-report__panel card stack-sm">
          <div className="results-report__section-heading">
            <h3>Rezultati trenutno nisu dostupni</h3>
          </div>
          <p className="results-report__section-body">
            Ovaj pokušaj je završen, ali pregled bodovanja trenutno nije dostupan. To najčešće
            znači da podaci za izvještaj još nisu usklađeni.
          </p>
        </section>
      ) : null}

      {results ? (
        <>
          <section className="results-report__section results-report__section--overview results-report__panel card stack-sm">
            <div className="results-report__section-heading">
              <h3>Pregled dimenzija</h3>
              {scoreRangeLabel ? <p className="results-report__section-note">{scoreRangeLabel}</p> : null}
            </div>

            {dimensionCards.length > 0 ? (
              <ol className="results-score-overview" aria-label="Pregled rezultata po dimenzijama">
                {dimensionCards.map((dimension) => (
                  <li key={dimension.key} className="results-score-overview__item">
                    <div className="results-score-overview__header">
                      <strong>{dimension.label}</strong>
                      <span>{formatScoreLabel(dimension.score)}</span>
                    </div>
                    <div
                      className="results-score-overview__bar"
                      role="img"
                      aria-label={`${dimension.label} skor ${dimension.score}`}
                    >
                      <span style={{ width: `${dimension.scoreWidth}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Za ovaj završeni pokušaj nisu dostupni odgovori koji se mogu bodovati.</p>
            )}
          </section>

          {hasScoredDimensions ? (
            <section className="results-report__section results-report__section--dimensions stack-sm">
              <div className="results-report__section-heading">
                <h3>Dimenzije</h3>
              </div>

              <ol className="results-dimension-list">
                {dimensionCards.map((dimension) => {
                  const isExpanded = expandedDimension === dimension.key;
                  const detailId = `dimension-detail-${dimension.key}`;

                  return (
                    <li key={dimension.key} className="results-dimension-card">
                      <div className="results-dimension-card__header">
                        <div className="results-dimension-card__title">
                          <h4>{dimension.label}</h4>
                          {dimension.helperLabel ? (
                            <p className="results-dimension-card__helper">{dimension.helperLabel}</p>
                          ) : null}
                        </div>
                        <div className="results-dimension-card__score">
                          <span className="results-dimension-card__score-value">
                            {formatScoreLabel(dimension.score)}
                          </span>
                        </div>
                      </div>

                      <p className="results-dimension-card__summary">
                        {getLeadSentence(toSecondPersonSingular(dimension.shortInterpretation))}
                      </p>

                      <div className="results-dimension-card__footer">
                        <button
                          type="button"
                          className="results-dimension-card__toggle"
                          aria-expanded={isExpanded}
                          aria-controls={detailId}
                          onClick={() =>
                            setExpandedDimension((current) =>
                              current === dimension.key ? null : dimension.key,
                            )
                          }
                        >
                          <span className="results-dimension-card__toggle-label-mobile">
                            {isExpanded ? "Manje" : "Više"}
                          </span>
                          <span className="results-dimension-card__toggle-label-desktop" aria-hidden="true">
                            {isExpanded ? "Sakrij detalje" : "Prikaži detalje"}
                          </span>
                        </button>
                      </div>

                      {isExpanded ? (
                        <div id={detailId} className="results-dimension-card__details stack-xs">
                          {(reportDimensionsByKey.get(dimension.key)
                            ? [
                                {
                                  heading: "Kako se to kod tebe često pokazuje" as const,
                                  body: reportDimensionsByKey.get(dimension.key)?.work_style ?? "",
                                },
                                {
                                  heading: "Šta ti to može donositi kao prednost" as const,
                                  body: reportDimensionsByKey.get(dimension.key)?.summary ?? "",
                                },
                                {
                                  heading: "Na šta vrijedi obratiti pažnju" as const,
                                  body:
                                    reportDimensionsByKey.get(dimension.key)?.risks ??
                                    reportDimensionsByKey.get(dimension.key)?.development_focus ??
                                    "",
                                },
                              ]
                            : getDimensionDetailBlocks(dimension)
                          ).map((detail) => (
                            <section key={detail.heading} className="results-dimension-card__detail-block">
                              <h5>{detail.heading}</h5>
                              <p>{detail.body}</p>
                            </section>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          {results.unscoredResponses.length > 0 ? (
            <section className="results-report__section results-report__panel card stack-sm">
              <div className="results-report__section-heading">
                <h3>Nebodovani odgovori</h3>
              </div>
              <ol className="results-inline-list">
                {results.unscoredResponses.map((response) => (
                  <li key={response.questionId}>
                    <strong>{response.questionCode}</strong>: {formatUnscoredReason(response.reason)}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      ) : null}

      {reportState?.status === "ready" ? (
        <div className="results-report__closing stack-md">
          <section className="results-report__section results-report__section--conclusion results-report__panel card stack-sm">
            <div className="results-report__section-heading">
              <h3>Zaključak</h3>
            </div>
            <div className="results-report__section-body stack-xs">
              {conclusionParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          {recommendations.length > 0 ? (
            <section className="results-report__section results-report__section--recommendations results-report__panel card stack-sm">
              <div className="results-report__section-heading">
                <h3>Preporuke</h3>
              </div>
              <ul className="results-bullet-list">
                {recommendations.map((item) => {
                  const formatted = formatRecommendation({
                    title: toSecondPersonSingular(item.title),
                    description: toSecondPersonSingular(item.description),
                    action: toSecondPersonSingular(item.action),
                  });

                  return (
                    <li key={item.title}>
                      <strong>{formatted.lead}:</strong>
                      {formatted.body ? ` ${formatted.body}` : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {reportState?.status === "ready" ? (
        <p className="results-report__disclaimer">{reportState.report.disclaimer}</p>
      ) : null}

    </div>
  );
}
