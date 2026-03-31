import "server-only";

import {
  formatDetailedReportValidationErrors,
  validateDetailedReportV1,
  type DetailedReportDimensionCode,
  type DetailedReportScoreBand,
} from "@/lib/assessment/detailed-report-v1";
import {
  formatIpcReportValidationErrors,
  validateIpcHrReportV1,
  validateIpcParticipantReportV1,
} from "@/lib/assessment/ipc-report-v1";
import type {
  AiReportPromptInput,
  PreparedReportGenerationInput,
  ReportProvider,
  RuntimeCompletedAssessmentReport,
} from "@/lib/assessment/report-providers";

function getPrimaryDimensions(
  promptInput: AiReportPromptInput,
): DetailedReportDimensionCode[] {
  return promptInput.deterministic_summary.dimensions_ranked.slice(0, 3);
}

function getLowestDimensions(
  promptInput: AiReportPromptInput,
): DetailedReportDimensionCode[] {
  return [...promptInput.deterministic_summary.dimensions_ranked].reverse().slice(0, 3);
}

function getDimensionInsightCopy(
  dimensionCode: DetailedReportDimensionCode,
  scoreBand: DetailedReportScoreBand,
) {
  const copyByDimension: Record<
    DetailedReportDimensionCode,
    Record<
      DetailedReportScoreBand,
      {
        summary: string;
        work_style: string;
        risks: string;
        development_focus: string;
      }
    >
  > = {
    EXTRAVERSION: {
      high: {
        summary: "Rezultat ukazuje na izraženiju sklonost vidljivom angažmanu, socijalnoj energiji i bržem uključivanju u kontakt s drugima.",
        work_style: "U radu se to često vidi kroz spremnost da pokreneš razgovor, daš energiju grupi i lakše radiš u okruženjima s više interakcije.",
        risks: "U zahtjevnijim situacijama vrijedi paziti da brzina uključivanja ne potisne slušanje, tuđi ritam ili potrebu za fokusiranijim, mirnijim radom.",
        development_focus: "Korisno je svjesno uparivati energiju i inicijativu s kratkim pauzama za provjeru prioriteta i prostora koji drugima treba.",
      },
      moderate: {
        summary: "Rezultat ukazuje na uravnotežen spoj otvorenosti prema ljudima i potrebe za vlastitim tempom.",
        work_style: "U radu se to često vidi kroz sposobnost da se prilagodiš i timskoj dinamici i samostalnijem, mirnijem načinu rada.",
        risks: "Kako stil može djelovati fleksibilno, drugi ponekad teže procijene kada ti treba više interakcije, a kada više prostora.",
        development_focus: "Korisno je ranije komunicirati koji ritam saradnje ti najviše pomaže u konkretnoj situaciji.",
      },
      low: {
        summary: "Rezultat ukazuje na mirniji interpersonalni tempo i manju potrebu za stalnom socijalnom aktivacijom.",
        work_style: "U radu se to često vidi kroz bolji osjećaj za fokus, promišljeniji pristup i preferenciju za sadržajniji kontakt umjesto stalne izloženosti.",
        risks: "Vrijedi paziti da mirniji stil ne bude pogrešno protumačen kao distanca ili manjak interesa kada to nije slučaj.",
        development_focus: "Korisno je ranije pokazati namjeru, kontekst ili očekivanja kako bi tvoj doprinos bio vidljiv bez nepotrebnog trošenja energije.",
      },
    },
    AGREEABLENESS: {
      high: {
        summary: "Rezultat ukazuje na jači naglasak na saradnji, obzirnosti i očuvanju kvalitetnih odnosa.",
        work_style: "U radu se to često vidi kroz taktičnu komunikaciju, spremnost na saradnju i ulaganje u povjerenje unutar tima.",
        risks: "Vrijedi paziti da želja za skladom ne odgodi direktan razgovor ili jasnu granicu kada su oni potrebni.",
        development_focus: "Korisno je vježbati situacije u kojima obzirnost i jasnoća mogu ići zajedno, bez povlačenja važnih tema.",
      },
      moderate: {
        summary: "Rezultat ukazuje na balans između saradnje i direktnosti, bez izraženog oslanjanja samo na jedan stil.",
        work_style: "U radu se to često vidi kroz sposobnost da zadržiš odnos, a da ipak kažeš šta je potrebno kada procijeniš da to pomaže poslu.",
        risks: "U nejasnim situacijama može se javiti produženo vaganje između očuvanja mira i potpune jasnoće.",
        development_focus: "Korisno je ranije odlučiti kada je važniji odnos, a kada brže i direktnije rješavanje pitanja.",
      },
      low: {
        summary: "Rezultat ukazuje na direktniji, manje prilagodljiv stil i veću spremnost da se ide pravo na suštinu.",
        work_style: "U radu se to često vidi kroz otvoreno osporavanje slabih rješenja i veću spremnost da se pokrenu teške teme bez puno uvoda.",
        risks: "Vrijedi paziti da jasnoća ne zazvuči oštrije nego što je namjera, posebno kada druga strana traži više takta ili pripreme.",
        development_focus: "Korisno je namjerno dodati malo više konteksta i topline u formi kada poruka treba da ostane jasna, ali bolje primljena.",
      },
    },
    CONSCIENTIOUSNESS: {
      high: {
        summary: "Rezultat ukazuje na jači naglasak na strukturi, odgovornosti i dosljednom provođenju obaveza.",
        work_style: "U radu se to često vidi kroz planiranje, praćenje detalja i visok osjećaj odgovornosti za dovršavanje onoga što je preuzeto.",
        risks: "Vrijedi paziti da visoki standardi ne prerastu u nepotreban pritisak, odgađanje kretanja ili preuzimanje previše kontrole.",
        development_focus: "Korisno je povremeno razlikovati šta zaista traži preciznost, a šta može ići naprijed i kad je dovoljno dobro.",
      },
      moderate: {
        summary: "Rezultat ukazuje na praktičan balans između organizacije i fleksibilnosti.",
        work_style: "U radu se to često vidi kroz sposobnost da pratiš dogovor i rokove bez pretjerane ukočenosti kada se okolnosti promijene.",
        risks: "U promjenjivim situacijama ponekad kasno postane vidljivo da zadatak ipak traži više strukture nego što je prvobitno dato.",
        development_focus: "Korisno je ranije procijeniti kada je dosta fleksibilnosti, a kada se isplati postaviti čvršći okvir rada.",
      },
      low: {
        summary: "Rezultat ukazuje na spontaniji pristup i manju oslonjenost na fiksnu strukturu ili strogu rutinu.",
        work_style: "U radu se to često vidi kroz bržu prilagodbu, kretanje iz momenta i lakše reagovanje kada okolnosti traže improvizaciju.",
        risks: "Vrijedi paziti da spontanost ne oslabi kontinuitet u zadacima koji traže praćenje, dovršavanje i stabilan sistem rada.",
        development_focus: "Korisno je uvesti nekoliko jednostavnih vanjskih oslonaca koji održavaju ritam bez gušenja fleksibilnosti.",
      },
    },
    EMOTIONAL_STABILITY: {
      high: {
        summary: "Rezultat ukazuje na stabilniji odgovor na uobičajen pritisak i manju vjerovatnoću da emocije brzo preuzmu tempo.",
        work_style: "U radu se to često vidi kroz smireniju komunikaciju, održavanje fokusa i stabilniji ritam kada okolina postane zahtjevna.",
        risks: "Vrijedi paziti da smirenost ne preraste u preveliku distancu prema vlastitim signalima umora ili tuđem emocionalnom stanju.",
        development_focus: "Korisno je zadržati ono što te stabilizuje, uz svjesniji prostor za pokazivanje signala opterećenja kada je to važno.",
      },
      moderate: {
        summary: "Rezultat ukazuje na mješovit, kontekstualan obrazac reagovanja na pritisak bez izražene krajnosti.",
        work_style: "U radu se to često vidi kroz sposobnost da u nekim situacijama ostaneš vrlo sabran, dok u drugima treba više vremena za povratak fokusa.",
        risks: "Kako reakcija zavisi od opterećenja i kontrole nad situacijom, okidači mogu postati vidljivi tek kad se pritisak već nagomila.",
        development_focus: "Korisno je ranije prepoznati obrasce koji te stabilizuju i namjerno ih ugraditi u svakodnevni ritam rada.",
      },
      low: {
        summary: "Rezultat ukazuje na osjetljiviji odgovor na pritisak, neizvjesnost i veće opterećenje, bez kliničkog značenja.",
        work_style: "U radu se to često vidi kroz brže registrovanje napetosti i veći uticaj zahtjevnih okolnosti na unutrašnji osjećaj opterećenja.",
        risks: "Vrijedi paziti da intenzitet trenutnog pritiska ne postane jedina slika cijele situacije ili sopstvenih kapaciteta.",
        development_focus: "Korisno je unaprijed graditi male, ponovljive navike oporavka i jasne oslonce koji vraćaju osjećaj kontrole.",
      },
    },
    INTELLECT: {
      high: {
        summary: "Rezultat ukazuje na veću otvorenost prema idejama, konceptualnom razmišljanju i istraživanju različitih pristupa.",
        work_style: "U radu se to često vidi kroz radoznalost, povezivanje tema i spremnost da se traže širi obrasci ili svježiji uglovi gledanja.",
        risks: "Vrijedi paziti da širina interesa ne odvuče fokus sa onoga što trenutno treba zatvoriti ili prevesti u konkretan korak.",
        development_focus: "Korisno je radoznalost svjesno vezati za jasan ishod kako bi istraživanje ostalo korisno i operativno.",
      },
      moderate: {
        summary: "Rezultat ukazuje na balans između otvorenosti prema novim idejama i poštovanja prema provjerenim pristupima.",
        work_style: "U radu se to često vidi kroz sposobnost da prihvatiš novu ideju kada vidiš smisao, bez potrebe da sve mora biti eksperimentalno.",
        risks: "U nekim situacijama može doći do produženog zadržavanja između istraživanja i odluke jer obje strane djeluju razumno.",
        development_focus: "Korisno je unaprijed odrediti kada je vrijeme za dodatna pitanja, a kada ima dovoljno jasnoće za odluku i primjenu.",
      },
      low: {
        summary: "Rezultat ukazuje na sklonost prema praktičnoj jasnoći, primjenjivosti i konkretnijim okvirima razmišljanja.",
        work_style: "U radu se to često vidi kroz fokus na izvedivost, korisnost i brže spuštanje ideja na zemlju umjesto dužeg zadržavanja u apstrakciji.",
        risks: "Vrijedi paziti da potreba za jasnoćom ne zatvori prerano prostor ideji koja još nema potpuno definisan oblik.",
        development_focus: "Korisno je sebi dati kratku, kontrolisanu fazu istraživanja prije zaključka kada tema traži više opcija ili širu sliku.",
      },
    },
  };

  return copyByDimension[dimensionCode][scoreBand];
}

function buildTitleDescriptionItem(
  title: string,
  description: string,
) {
  return {
    title,
    description,
  };
}

function getHrStrengthTitle(dimensionCode: DetailedReportDimensionCode): string {
  const titleByDimension: Record<DetailedReportDimensionCode, string> = {
    EXTRAVERSION: "Vidljiv angažman i timska energija",
    AGREEABLENESS: "Kooperativan i stabilan odnosni stil",
    CONSCIENTIOUSNESS: "Pouzdano izvršenje i osjećaj za strukturu",
    EMOTIONAL_STABILITY: "Staložen odgovor pod pritiskom",
    INTELLECT: "Praktično promišljanje i šira perspektiva",
  };

  return titleByDimension[dimensionCode];
}

function getHrBlindSpotTitle(dimensionCode: DetailedReportDimensionCode): string {
  const titleByDimension: Record<DetailedReportDimensionCode, string> = {
    EXTRAVERSION: "Ritam uključivanja i prostor za druge",
    AGREEABLENESS: "Direktnost i postavljanje granica",
    CONSCIENTIOUSNESS: "Balans standarda i brzine",
    EMOTIONAL_STABILITY: "Rani signali opterećenja",
    INTELLECT: "Balans istraživanja i konkretnog zatvaranja",
  };

  return titleByDimension[dimensionCode];
}

function getHrRecommendationTitle(index: number): string {
  const titleByIndex = [
    "1. Check-in i feedback ritam",
    "2. Struktura rada i očekivanja",
    "3. Saradnja i razvojna podrška",
  ];

  return titleByIndex[index] ?? `${index + 1}. Operativna preporuka`;
}

function getHrRecommendationAction(
  index: number,
  dimensionLabel: string,
  highestDimensionLabel: string | null,
): string {
  if (index === 0) {
    return `Dogovorite kratak sedmični check-in u kojem se rano provjeravaju prioriteti, opterećenje i kvalitet izvršenja oko oblasti ${dimensionLabel.toLowerCase()}.`;
  }

  if (index === 1) {
    return `Postavite jasne ishode, rokove i nivo autonomije tako da radni okvir podrži ${dimensionLabel.toLowerCase()}, uz oslonac na postojeću snagu${highestDimensionLabel ? ` u oblasti ${highestDimensionLabel.toLowerCase()}` : ""}.`;
  }

  return `U razvojnom razgovoru otvorite konkretne primjere saradnje, komunikacije i podrške koji mogu proširiti raspon ponašanja u oblasti ${dimensionLabel.toLowerCase()}.`;
}

function buildIpcMockReport(input: PreparedReportGenerationInput): RuntimeCompletedAssessmentReport {
  if ("dimension_scores" in input.promptInput) {
    throw new Error("IPC mock report requires IPC prompt input.");
  }

  if (!input.promptInput.derived.dominantOctant || !input.promptInput.derived.secondaryOctant) {
    throw new Error("IPC mock report requires dominant and secondary octants.");
  }

  if (input.promptInput.audience === "participant") {
    const report = {
      report_title: "Tvoj IPC razvojni izvještaj",
      report_subtitle: `Pregled interpersonalnog stila i saradnje za ${input.testSlug}.`,
      summary: {
        headline:
          input.promptInput.derived.primaryDisc === null
            ? "Tvoj interpersonalni stil djeluje uravnoteženo bez jedne potpuno dominantne DISC oznake."
            : `Najizraženiji signal tvog interpersonalnog stila trenutno je ${input.promptInput.derived.primaryDisc}.`,
        overview:
          "Ovaj izvještaj opisuje vjerovatne obrasce komunikacije, saradnje i razvojnog fokusa na osnovu IPC oktanata i izvedenih osa topline i dominantnosti.",
      },
      style_snapshot: {
        primary_disc: input.promptInput.derived.primaryDisc,
        dominant_octant: input.promptInput.derived.dominantOctant,
        secondary_octant: input.promptInput.derived.secondaryOctant,
      },
      strengths_in_collaboration: [
        {
          title: "1. Saradnički ritam",
          description: "Vjerovatno donosiš prepoznatljiv interpersonalni ritam koji drugima olakšava da procijene kako pristupaš zajedničkom radu.",
        },
        {
          title: "2. Komunikacijska prepoznatljivost",
          description: "Tvoj stil komunikacije vjerovatno ima dovoljno dosljednosti da drugi lakše razumiju kako ulaziš u kontakt, inicijativu i usklađivanje.",
        },
        {
          title: "3. Razvojna upotrebljivost",
          description: "Rezultat daje konkretne signale koje možeš pretvoriti u male, praktične eksperimente u saradnji i svakodnevnoj komunikaciji.",
        },
      ],
      watchouts: [
        {
          title: "1. Pretjerano oslanjanje na dominantni stil",
          description: "Kada se previše osloniš na svoj prirodni stil, drugi mogu dobiti manje prostora nego što situacija traži.",
        },
        {
          title: "2. Suviše usko čitanje profila",
          description: "Vrijedi paziti da rezultat ne čitaš kao fiksnu etiketu, nego kao signal za svjesnije biranje ponašanja u kontekstu.",
        },
      ],
      development_recommendations: [
        {
          title: "1. Provjera utiska",
          description: "Prati kako tvoj dominantni stil utiče na druge u stvarnim razgovorima i zajedničkom radu.",
          action: "U jednoj sedmici pitaj dvije osobe kako doživljavaju tvoj stil saradnje u praksi.",
        },
        {
          title: "2. Proširenje repertoara",
          description: "Najveći razvojni pomak obično dolazi iz namjernog širenja ponašanja van automatskog obrasca.",
          action: "Uvedi jedan mali interpersonalni eksperiment koji nije tvoj podrazumijevani prvi izbor.",
        },
        {
          title: "3. Situaciona fleksibilnost",
          description: "Razvoj nije u potiskivanju tvog stila, nego u boljem prilagođavanju situaciji i potrebama drugih.",
          action: "Prije važnog razgovora kratko odredi koji ton, tempo i nivo direktnosti će toj situaciji najviše pomoći.",
        },
      ],
      disclaimer:
        "Ovaj izvještaj je razvojni, ne-klinički pregled interpersonalnog stila. Ne daje dijagnozu, ne potvrđuje zaštićene osobine i ne predstavlja preporuku za zapošljavanje ili konačnu istinu o osobi.",
    };

    const validationResult = validateIpcParticipantReportV1(report);

    if (!validationResult.ok) {
      throw new Error(
        `Mock IPC participant report failed validation: ${formatIpcReportValidationErrors(validationResult.errors)}`,
      );
    }

    return validationResult.value;
  }

  const report = {
    report_title: "IPC HR pregled interpersonalnog stila",
    report_subtitle: "Operativni pregled komunikacije, saradnje i uticaja bez hiring presuda.",
    summary: {
      headline:
        input.promptInput.derived.primaryDisc === null
          ? "Profil djeluje uravnoteženo bez jedne potpuno dominantne DISC oznake."
          : `Najizraženiji signal interpersonalnog stila trenutno je ${input.promptInput.derived.primaryDisc}.`,
      overview:
        "Ovaj izvještaj koristi IPC oktante i izvedene ose dominantnosti i topline kako bi opisao vjerovatne obrasce komunikacije, saradnje i rukovođenja uticajem u radnom kontekstu.",
    },
    style_snapshot: {
      primary_disc: input.promptInput.derived.primaryDisc,
      dominant_octant: input.promptInput.derived.dominantOctant,
      secondary_octant: input.promptInput.derived.secondaryOctant,
      dominance: input.promptInput.derived.dominance,
      warmth: input.promptInput.derived.warmth,
    },
    communication_style: {
      summary:
        "Komunikacijski stil vjerovatno prati dominantni interpersonalni obrazac i relativni odnos topline i direktivnosti.",
      manager_notes:
        "Koristan je jasan dogovor oko tona, nivoa direktnosti i načina povratne informacije koji podržavaju saradnju bez pojednostavljivanja osobe.",
    },
    collaboration_style: {
      summary:
        "Saradnički stil vjerovatno pokazuje prepoznatljiv ritam uključivanja, usklađivanja i zauzimanja prostora u grupi.",
      manager_notes:
        "Vrijedi posmatrati kako osoba ulazi u zajednički rad, koliko prostora uzima i kako reaguje na različite ritmove tima.",
    },
    leadership_and_influence: {
      summary:
        "Obrazac uticaja vjerovatno zavisi od kombinacije dominantnosti, topline i najuočljivijih IPC oktanata.",
      manager_notes:
        "Najkorisnije je pratiti kroz koje situacije osoba utiče na druge i kada joj više odgovara direktniji, a kada odnosniji pristup.",
    },
    team_watchouts: [
      {
        title: "1. Jednostrano čitanje stila",
        description: "Previše kruto tumačenje dominantnog stila može suziti prostor za razvoj i previđanje konteksta.",
      },
      {
        title: "2. Nepodudaran ritam saradnje",
        description: "U nekim timovima se može pojaviti trenje ako očekivani ton i tempo saradnje nisu rano eksplicitno usklađeni.",
      },
    ],
    onboarding_or_management_recommendations: [
      {
        title: "1. Rani check-in o saradnji",
        description: "Rano usaglašavanje interpersonalnih očekivanja obično smanjuje pogrešna tumačenja stila.",
        action: "U prvim sedmicama uvedite kratak check-in o komunikaciji, tempu i načinu davanja feedbacka.",
      },
      {
        title: "2. Jasna pravila timske interakcije",
        description: "Osobi pomaže kada zna kako tim očekuje uključivanje, neslaganje i donošenje odluka.",
        action: "Eksplicitno definišite kako tim vodi raspravu, traži pomoć i zatvara neslaganja.",
      },
      {
        title: "3. Razvoj situacione fleksibilnosti",
        description: "Najveći razvojni dobitak obično dolazi iz širenja repertoara, a ne iz potiskivanja osnovnog stila.",
        action: "Dogovorite jedan razvojni fokus kojim osoba svjesno proširuje stil komunikacije ili saradnje u realnom radu.",
      },
    ],
    disclaimer:
      "Ovaj izvještaj je profesionalni razvojni pregled interpersonalnog stila. Ne predstavlja dijagnozu, ne potvrđuje zaštićene osobine i ne daje hiring odluku ili konačnu istinu o osobi.",
  };

  const validationResult = validateIpcHrReportV1(report);

  if (!validationResult.ok) {
    throw new Error(
      `Mock IPC HR report failed validation: ${formatIpcReportValidationErrors(validationResult.errors)}`,
    );
  }

  return validationResult.value;
}

function buildMockReport(input: PreparedReportGenerationInput): RuntimeCompletedAssessmentReport {
  if (!("dimension_scores" in input.promptInput)) {
    return buildIpcMockReport(input);
  }

  const promptInput = input.promptInput;
  const highestDimension = promptInput.deterministic_summary.highest_dimension;
  const lowestDimension = promptInput.deterministic_summary.lowest_dimension;
  const primaryDimensions = getPrimaryDimensions(promptInput);
  const lowestDimensions = getLowestDimensions(promptInput);

  const dimensionsByCode = new Map(
    promptInput.dimension_scores.map((dimension) => [dimension.dimension_code, dimension]),
  );

  const dimensionInsights = promptInput.dimension_scores.map((dimension) => {
    const insightCopy = getDimensionInsightCopy(dimension.dimension_code, dimension.score_band);

    return {
      dimension_code: dimension.dimension_code,
      dimension_label: dimension.dimension_label,
      score_band: dimension.score_band,
      summary: insightCopy.summary,
      work_style: insightCopy.work_style,
      risks: insightCopy.risks,
      development_focus: insightCopy.development_focus,
    };
  });

  const strengths = primaryDimensions.map((dimensionCode, index) => {
    const dimension = dimensionsByCode.get(dimensionCode);
    const insight = dimensionInsights.find((item) => item.dimension_code === dimensionCode);
    const isHrAudience = input.promptInput.audience === "hr";

    return buildTitleDescriptionItem(
      isHrAudience
        ? `${index + 1}. ${getHrStrengthTitle(dimensionCode)}`
        : `${index + 1}. ${dimension?.dimension_label ?? dimensionCode}`,
      insight?.work_style ??
        "Ova dimenzija je među jačim signalima u trenutnom obrascu odgovora i vjerovatno donosi korisnu radnu prednost u odgovarajućem kontekstu.",
    );
  });

  const blindSpots = lowestDimensions.map((dimensionCode, index) => {
    const dimension = dimensionsByCode.get(dimensionCode);
    const insight = dimensionInsights.find((item) => item.dimension_code === dimensionCode);
    const isHrAudience = input.promptInput.audience === "hr";

    return buildTitleDescriptionItem(
      isHrAudience
        ? `${index + 1}. ${getHrBlindSpotTitle(dimensionCode)}`
        : `${index + 1}. ${dimension?.dimension_label ?? dimensionCode}`,
      insight?.risks ??
        "Ovu oblast vrijedi čitati kao razvojni signal i provjeravati je kroz stvarno ponašanje i kontekst rada, a ne kao konačnu etiketu.",
    );
  });

  const developmentRecommendations = lowestDimensions.map((dimensionCode, index) => {
    const dimension = dimensionsByCode.get(dimensionCode);
    const insight = dimensionInsights.find((item) => item.dimension_code === dimensionCode);
    const highestDimensionLabel =
      highestDimension !== null
        ? dimensionsByCode.get(highestDimension)?.dimension_label ?? highestDimension
        : null;
    const isHrAudience = input.promptInput.audience === "hr";

    return {
      title: isHrAudience
        ? getHrRecommendationTitle(index)
        : `${index + 1}. Fokus na ${dimension?.dimension_label ?? dimensionCode}`,
      description:
        insight?.development_focus ??
        "Odaberi mali, ponovljiv eksperiment u radu koji proširuje tvoj raspon ponašanja u ovoj oblasti.",
      action: isHrAudience
        ? getHrRecommendationAction(
            index,
            dimension?.dimension_label ?? dimensionCode,
            highestDimensionLabel,
          )
        : highestDimension && highestDimension !== dimensionCode
          ? `Upari razvoj ove oblasti s postojećom snagom koju pokazuje ${dimensionsByCode.get(highestDimension)?.dimension_label ?? highestDimension}.`
          : "Pretvori razvojni fokus u jednu konkretnu sedmičnu naviku i kratko ga prati kroz praksu.",
    };
  });

  const titleByAudience =
    input.promptInput.audience === "hr"
      ? "HR pregled radnog i saradničkog stila"
      : "Tvoj detaljni izvještaj procjene";
  const subtitleByAudience =
    input.promptInput.audience === "hr"
      ? "Sažetak vjerovatnih obrazaca rada, saradnje i razvoja."
      : `Razvojni pregled obrasca rezultata za ${input.testSlug}.`;

  const report = {
    report_title: titleByAudience,
    report_subtitle: subtitleByAudience,
    summary: {
      headline:
        highestDimension !== null
          ? input.promptInput.audience === "hr"
            ? `${dimensionsByCode.get(highestDimension)?.dimension_label ?? highestDimension} se izdvaja kao najjači signal za radni stil i saradnju.`
            : `${dimensionsByCode.get(highestDimension)?.dimension_label ?? highestDimension} se najviše ističe u ovom obrascu rezultata.`
          : "Rezultati daju uravnotežen pregled radnog obrasca bez jednog dominantnog signala.",
      overview:
        input.promptInput.audience === "hr"
          ? lowestDimension && highestDimension && lowestDimension !== highestDimension
            ? `Profil ukazuje na izraženiji oslonac na ${dimensionsByCode.get(highestDimension)?.dimension_label ?? highestDimension}, dok oblast ${dimensionsByCode.get(lowestDimension)?.dimension_label ?? lowestDimension} traži nešto svjesniju podršku kroz način rada, komunikaciju i razvojni feedback.`
            : "Profil daje uravnotežen pregled vjerovatnih obrazaca rada, saradnje i razvoja, bez pojednostavljenih ili apsolutnih zaključaka."
          : lowestDimension && highestDimension && lowestDimension !== highestDimension
            ? `Izvještaj koristi determinističke skorove po svih pet dimenzija. Najizraženiji signal je ${dimensionsByCode.get(highestDimension)?.dimension_label ?? highestDimension}, dok ${dimensionsByCode.get(lowestDimension)?.dimension_label ?? lowestDimension} djeluje kao komparativno mirnija razvojna oblast.`
            : "Izvještaj koristi determinističke skorove po svih pet dimenzija i opisuje vjerovatne obrasce rada, komunikacije i razvoja bez apsolutnih zaključaka.",
    },
    strengths,
    blind_spots: blindSpots,
    development_recommendations: developmentRecommendations,
    dimension_insights: dimensionInsights,
    disclaimer:
      input.promptInput.audience === "hr"
        ? "Ovaj izvještaj je profesionalni razvojni pregled vjerovatnih obrazaca rada i saradnje. Ne predstavlja dijagnozu, ne potvrđuje zaštićene osobine i ne daje hiring odluku ili konačnu istinu o osobi."
        : "Ovaj izvještaj je razvojni, ne-klinički pregled zasnovan na determinističkim skorovima procjene. Ne daje dijagnozu, ne potvrđuje zaštićene osobine i ne predstavlja preporuku za zapošljavanje ili konačnu istinu o osobi.",
  };

  const validationResult = validateDetailedReportV1(report);

  if (!validationResult.ok) {
    throw new Error(
      `Mock report failed detailed report validation: ${formatDetailedReportValidationErrors(validationResult.errors)}`,
    );
  }

  return validationResult.value;
}

export const mockReportProvider: ReportProvider = {
  type: "mock",
  async generateReport(input) {
    try {
      return {
        ok: true,
        report: buildMockReport(input),
      };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "Unknown mock provider error.",
      };
    }
  },
};
