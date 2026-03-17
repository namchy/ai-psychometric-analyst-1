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
  scoredQuestionCount: number;
  shortInterpretation: string;
  scoreWidth: number;
  rank: number;
  totalDimensions: number;
};

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

function getRemainingSentences(text: string): string | null {
  const sentences = splitIntoSentences(text);

  if (sentences.length <= 1) {
    return null;
  }

  return sentences.slice(1).join(" ");
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
    return dimensions
      .slice(0, 3)
      .map((dimension) => formatTopInsightSentence(dimension.shortInterpretation));
  }

  const candidates = [
    ...reportState.report.strengths,
    ...reportState.report.work_style,
    ...reportState.report.blind_spots,
    ...reportState.report.development_recommendations,
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

function getDimensionDetail(dimension: DimensionViewModel): string[] {
  const nuance = getRemainingSentences(toSecondPersonSingular(dimension.shortInterpretation));
  const rankSummary =
    dimension.rank === 0
      ? `${dimension.label} se kod tebe trenutno najviše ističe i snažno oblikuje tvoj ukupni obrazac.`
      : dimension.rank === dimension.totalDimensions - 1
        ? `${dimension.label} je kod tebe suptilnija, pa je najbolje posmatrati kako se pokazuje u različitim situacijama.`
        : `${dimension.label} kod tebe djeluje prilično stabilno i daje važnu nijansu tvom ukupnom obrascu.`;

  return [nuance, rankSummary].filter((detail): detail is string => Boolean(detail));
}

function getConclusion(
  reportState: CompletedAssessmentReportState | null,
  dimensions: DimensionViewModel[],
): string[] {
  if (reportState?.status !== "ready") {
    return ["Tvoji rezultati pokazuju prepoznatljiv obrazac po dimenzijama, ali narativni zaključak trenutno nije dostupan."];
  }

  const highest = dimensions[0];
  const lowest = dimensions[dimensions.length - 1];
  const summaryLead = splitIntoSentences(toSecondPersonSingular(reportState.report.summary))[0] ?? null;
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
    reportState.report.work_style[0] ??
      "U načinu na koji pristupaš radu vidi se jasan i prilično dosljedan obrazac.",
  );

  return [firstParagraph, secondParagraph].filter(Boolean);
}

function getRecommendations(reportState: CompletedAssessmentReportState | null): string[] {
  if (reportState?.status !== "ready") {
    return [];
  }

  const recommendations =
    reportState.report.development_recommendations.length > 0
      ? reportState.report.development_recommendations
      : reportState.report.blind_spots;

  return recommendations.slice(0, 4);
}

function formatRecommendation(item: string): { lead: string; body: string | null } {
  const normalized = item.trim().replace(/\s+/g, " ");
  const words = normalized.split(" ");

  if (normalized.includes(":")) {
    const [lead, ...rest] = normalized.split(":");
    return {
      lead: lead.trim(),
      body: rest.join(":").trim() || null,
    };
  }

  if (words.length <= 4) {
    return { lead: normalized.replace(/[.,;:!?]+$/, ""), body: null };
  }

  return {
    lead: words.slice(0, 4).join(" ").replace(/[.,;:!?]+$/, ""),
    body: words.slice(4).join(" ").trim() || null,
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

  const maxRawScore =
    results && results.dimensions.length > 0
      ? Math.max(...results.dimensions.map((dimension) => dimension.rawScore), 0)
      : 0;

  const reportDimensionsByKey =
    reportState?.status === "ready"
      ? new Map(
          reportState.report.dimensions.map((dimension) => [dimension.dimension_key, dimension]),
        )
      : new Map();

  const dimensionCards: DimensionViewModel[] =
    results?.dimensions.map((dimension, index, dimensions) => {
      const reportDimension = reportDimensionsByKey.get(dimension.dimension);

      return {
        key: dimension.dimension,
        label: formatDimensionLabel(dimension.dimension),
        helperLabel: getDimensionHelperLabel(dimension.dimension),
        score: dimension.rawScore,
        scoredQuestionCount: dimension.scoredQuestionCount,
        shortInterpretation:
          reportDimension?.short_interpretation ??
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

  return (
    <div className="results-report stack-md">
      <section className="results-report__hero">
        <div className="results-report__hero-copy">
          <p className="results-report__eyebrow">Izvještaj procjene</p>
          <h2>{testName ?? "Rezultati procjene"}</h2>

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

        {topInsights.length > 0 ? (
          <section className="results-report__hero-insights" aria-label="Top insights">
            <p className="results-report__hero-label">Top uvidi</p>
            <ul className="results-insight-list">
              {topInsights.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>

      {results ? (
        <>
          <section className="results-report__section results-report__panel card stack-sm">
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

          {dimensionCards.length > 0 ? (
            <section className="results-report__section stack-sm">
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
                          <span>{formatScoreLabel(dimension.score)}</span>
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
                          {isExpanded ? "Manje" : "Više"}
                        </button>
                      </div>

                      {isExpanded ? (
                        <div id={detailId} className="results-dimension-card__details stack-xs">
                          {getDimensionDetail(dimension).map((detail) => (
                            <p key={detail}>{detail}</p>
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
        <>
          <section className="results-report__section results-report__panel card stack-sm">
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
            <section className="results-report__section results-report__panel card stack-sm">
              <div className="results-report__section-heading">
                <h3>Preporuke</h3>
              </div>
              <ul className="results-bullet-list">
                {recommendations.map((item) => {
                  const formatted = formatRecommendation(toSecondPersonSingular(item));

                  return (
                    <li key={item}>
                      <strong>{formatted.lead}:</strong>
                      {formatted.body ? ` ${formatted.body}` : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <p className="results-report__disclaimer">{reportState.report.disclaimer}</p>
        </>
      ) : null}

      {reportState?.status === "unavailable" ? (
        <section className="results-report__section results-report__panel card stack-sm">
          <div className="results-report__section-heading">
            <h3>Narativni izvještaj trenutno nije dostupan</h3>
          </div>
          <p className="results-report__section-body">
            AI izvještaj trenutno nije dostupan za ovaj završeni pokušaj. Numerički rezultati i
            dalje ostaju sačuvani za pregled.
          </p>
        </section>
      ) : null}
    </div>
  );
}
