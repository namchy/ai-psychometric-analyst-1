import "server-only";

import type {
  CompletedAssessmentReport,
  PreparedReportGenerationInput,
  ReportProvider,
} from "@/lib/assessment/report-providers";
import {
  formatDimensionLabel,
  getAverageScore,
} from "@/lib/assessment/report-provider-helpers";

function getScoreBand(score: number): "high" | "mid" | "low" {
  if (score >= 3.67) {
    return "high";
  }

  if (score >= 2.34) {
    return "mid";
  }

  return "low";
}

function getDimensionInterpretation(dimensionKey: string, averageScore: number): string {
  const band = getScoreBand(averageScore);

  const interpretationsByDimension: Record<string, Record<"high" | "mid" | "low", string>> = {
    extraversion: {
      high: "Često djeluje energizirano kroz socijalni kontakt i vidljivo uključivanje.",
      mid: "Pokazuje uravnotežen spoj otvorenog angažmana i promišljenijeg tempa.",
      low: "Može preferirati mirnije okruženje i odmjereniji interpersonalni ritam.",
    },
    agreeableness: {
      high: "Naglašava saradnju, taktičnost i kvalitet međuljudskih odnosa.",
      mid: "Može dobro balansirati iskrenost i saradnju, zavisno od konteksta.",
      low: "Može češće birati direktan izazov umjesto prilagođavanja ili konsenzusa.",
    },
    conscientiousness: {
      high: "Vjerovatno vrednuje strukturu, dosljednost i pouzdanu realizaciju.",
      mid: "Može se prilagođavati između planiranja i fleksibilnosti kako se zahtjevi mijenjaju.",
      low: "Može raditi spontanije i imati korist od jasnije vanjske strukture.",
    },
    emotional_stability: {
      high: "Vjerovatno zadržava stabilnost i pod uobičajenim pritiskom.",
      mid: "Pokazuje mješovit profil nošenja sa stresom koji može varirati po opterećenju ili kontekstu.",
      low: "Može intenzivnije doživljavati pritisak i imati korist od stabilnijih navika oporavka.",
    },
    intellect: {
      high: "Često je usmjeren prema idejama, istraživanju i konceptualnoj raznolikosti.",
      mid: "Može prihvatati nove ideje uz zadržavanje vrijednosti poznatih pristupa.",
      low: "Može preferirati praktičnu jasnoću umjesto apstraktnog istraživanja.",
    },
  };

  const fallback = {
    high: "Ova oblast je relativno izražena u trenutnom obrascu odgovora.",
    mid: "Ova oblast je u srednjem rasponu u trenutnom obrascu odgovora.",
    low: "Ova oblast je relativno niže izražena u trenutnom obrascu odgovora.",
  };

  return (interpretationsByDimension[dimensionKey] ?? fallback)[band];
}

function buildMockReport(input: PreparedReportGenerationInput): CompletedAssessmentReport {
  const { promptInput } = input;
  const primaryDimension = promptInput.deterministic_summary.highest_dimension;
  const lowestDimension = promptInput.deterministic_summary.lowest_dimension;
  const secondaryDimension = promptInput.deterministic_summary.dimensions_ranked[1] ?? null;

  const dimensions = promptInput.dimension_scores
    .map((dimension) => ({
      dimension_key: dimension.dimension_key,
      score: dimension.raw_score,
      short_interpretation: getDimensionInterpretation(
        dimension.dimension_key,
        getAverageScore(dimension.raw_score, dimension.scored_question_count),
      ),
    }))
    .sort(
      (left, right) =>
        right.score - left.score || left.dimension_key.localeCompare(right.dimension_key),
    );

  const summaryParts = [
    `Izvještaj za ${input.testSlug} zasnovan je na pohranjenim skorovima metodologije ${promptInput.scoring_method}.`,
    primaryDimension
      ? `${formatDimensionLabel(primaryDimension)} je najuočljiviji signal u ovom pokušaju.`
      : "Za ovaj pokušaj nisu bili dostupni skorovi po dimenzijama.",
    lowestDimension && lowestDimension !== primaryDimension
      ? `${formatDimensionLabel(lowestDimension)} je komparativno niže izražena i treba je čitati kao razvojnu oblast, a ne kao nedostatak.`
      : null,
  ].filter((part): part is string => Boolean(part));

  const strengths = promptInput.deterministic_summary.dimensions_ranked
    .slice(0, 2)
    .map((dimensionKey) => {
      const matchingDimension = promptInput.dimension_scores.find(
        (dimension) => dimension.dimension_key === dimensionKey,
      );
      const averageScore = matchingDimension
        ? getAverageScore(matchingDimension.raw_score, matchingDimension.scored_question_count)
        : 0;

      return `${formatDimensionLabel(dimensionKey)}: ${getDimensionInterpretation(dimensionKey, averageScore)}`;
    });

  const blindSpots = lowestDimension
    ? [
        `${formatDimensionLabel(lowestDimension)} je niže izražena u ovom obrascu odgovora, pa osoba može rjeđe koristiti ponašanja vezana za tu oblast u pojedinim situacijama.`,
        "Narativne zaključke treba provjeravati kroz stvarno ponašanje, kontekst uloge i praktična opažanja.",
      ]
    : ["Tumačenje potencijalnih slijepih tačaka nije dostupno jer nisu pronađene bodovane dimenzije."];

  const workStyle = [
    primaryDimension
      ? `Vjerovatno glavno uporište radnog stila: teme povezane sa dimenzijom ${formatDimensionLabel(primaryDimension).toLowerCase()} najizraženije su u ovom završenom pokušaju.`
      : "Glavno uporište radnog stila nije moguće procijeniti bez bodovanih dimenzija.",
    secondaryDimension
      ? `Sekundarni signal: ${formatDimensionLabel(secondaryDimension).toLowerCase()} također značajno oblikuje način na koji se ukupni profil može ispoljavati iz dana u dan.`
      : "Sekundarni signal radnog stila nije bio dostupan iz trenutnog skupa skorova.",
  ];

  const developmentRecommendations = lowestDimension
    ? [
        `Uvedi jednu namjernu razvojnu naviku povezanu s ponašanjima iz oblasti ${formatDimensionLabel(lowestDimension).toLowerCase()} u sedmične radne rutine.`,
        primaryDimension
          ? `Iskoristi izraženiji obrazac u oblasti ${formatDimensionLabel(primaryDimension).toLowerCase()} kao oslonac dok se gradi veći raspon ponašanja u niže bodovanim oblastima.`
          : "Koristi redovnu refleksiju o obrascima skorova kako bi se rezultati pretvorili u konkretne bihevioralne eksperimente.",
      ]
    : ["Prikupi potpuniji bodovani pokušaj prije donošenja preporuka za razvoj."];

  return {
    attempt_id: input.attemptId,
    test_slug: input.testSlug,
    generated_at: new Date().toISOString(),
    generator_type: "mock",
    summary: summaryParts.join(" "),
    dimensions,
    strengths,
    blind_spots: blindSpots,
    work_style: workStyle,
    development_recommendations: developmentRecommendations,
    disclaimer:
      "Ovaj izvještaj je zasnovan na determinističkim scoring podacima. Opisuje tendencije i razvojne teme, a ne dijagnozu, kliničku procjenu niti preporuku za zapošljavanje.",
  };
}

export const mockReportProvider: ReportProvider = {
  type: "mock",
  async generateReport(input) {
    return {
      ok: true,
      report: buildMockReport(input),
    };
  },
};
