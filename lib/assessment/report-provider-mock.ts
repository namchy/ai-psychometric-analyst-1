import "server-only";

import {
  formatDetailedReportValidationErrors,
  validateDetailedReportV1,
  type DetailedReportDimensionCode,
  type DetailedReportScoreBand,
} from "@/lib/assessment/detailed-report-v1";
import {
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
  getIpipNeo120DomainLabel,
  getIpipNeo120FacetLabel,
  type IpipNeo120DomainCode,
} from "@/lib/assessment/ipip-neo-120-labels";
import {
  formatIpipNeo120ReportValidationErrors,
  type IpipNeo120HrReportV1,
  type IpipNeo120ParticipantReportV1,
  validateIpipNeo120HrReportV1,
  validateIpipNeo120ParticipantReportV1,
} from "@/lib/assessment/ipip-neo-120-report-v1";
import {
  buildIpipNeo120ParticipantAiInputV2,
  validateIpipNeo120ParticipantAiInputV2,
  type IpipNeo120ParticipantAiInputV2,
  type IpipNeo120ParticipantBandV2,
} from "@/lib/assessment/ipip-neo-120-participant-ai-input-v2";
import {
  formatIpipNeo120ParticipantReportV2ValidationErrors,
  validateIpipNeo120ParticipantReportV2,
  type IpipNeo120ParticipantReportV2,
} from "@/lib/assessment/ipip-neo-120-participant-report-v2";
import type { IpcReportPromptInput } from "@/lib/assessment/ipc-report-contract";
import type { MwmsParticipantReportPromptInput } from "@/lib/assessment/mwms-report-contract";
import {
  MWMS_PARTICIPANT_REPORT_SCHEMA_VERSION,
  formatMwmsParticipantReportV1ValidationErrors,
  validateMwmsParticipantReportV1,
} from "@/lib/assessment/mwms-participant-report-v1";
import type { SafranAiReportInput } from "@/lib/assessment/safran-participant-ai-report-v1";
import {
  buildMockSafranParticipantAiReport,
  formatSafranParticipantAiReportValidationErrors,
  validateSafranParticipantAiReport,
} from "@/lib/assessment/safran-participant-ai-report-v1";
import type { SafranHrReportInput } from "@/lib/assessment/safran-hr-report-v1";
import {
  buildMockSafranHrReportV1,
  formatSafranHrReportValidationErrors,
  validateSafranHrReport,
} from "@/lib/assessment/safran-hr-report-v1";
import {
  formatIpcReportValidationErrors,
  validateIpcHrReportV1,
  validateIpcParticipantReportV1,
} from "@/lib/assessment/ipc-report-v1";
import type {
  IpipNeo120HrReportPromptInput,
  IpipNeo120ParticipantReportPromptInput,
} from "@/lib/assessment/ipip-neo-120-report-contract";
import type {
  AiReportPromptInput,
  PreparedReportGenerationInput,
  ReportProvider,
  RuntimeCompletedAssessmentReport,
} from "@/lib/assessment/report-providers";
import { getIpipNeo120ParticipantReportVersion } from "@/lib/assessment/report-config";

function getNeoBandCopy(band: "lower" | "balanced" | "higher") {
  switch (band) {
    case "higher":
      return {
        summaryLead: "izraženiji razvojni signal",
        strengthLead: "Ova domena ti vjerovatno daje prirodniju razvojnu prednost",
        watchoutLead: "Vrijedi paziti da se jače izražena tendencija ne pretvori u pretjerivanje",
      };
    case "balanced":
      return {
        summaryLead: "uravnotežen razvojni signal",
        strengthLead: "Ova domena ti vjerovatno daje dobar balans između fleksibilnosti i stabilnosti",
        watchoutLead: "Vrijedi pratiti kako se ova uravnoteženost mijenja pod različitim pritiskom ili kontekstom",
      };
    default:
      return {
        summaryLead: "tiši razvojni signal",
        strengthLead: "Ova domena može biti korisna kada je koristiš svjesno i situaciono",
        watchoutLead: "Vrijedi paziti da tiša tendencija ne ostane bez podrške onda kada situacija traži više ove energije",
      };
  }
}

function getNeoDomainNarrative(domainLabel: string, band: "lower" | "balanced" | "higher") {
  const copy = getNeoBandCopy(band);

  return {
    summary: `${domainLabel} se kod tebe trenutno pokazuje kao ${copy.summaryLead}.`,
    strengths: [
      `${copy.strengthLead} u oblasti ${domainLabel.toLowerCase()}.`,
      `Kada ovu domenu koristiš svjesno, lakše usklađuješ svoj stil s onim što situacija traži u oblasti ${domainLabel.toLowerCase()}.`,
    ],
    watchouts: [
      `${copy.watchoutLead} u oblasti ${domainLabel.toLowerCase()}.`,
      `Korisno je povremeno provjeriti kako drugi doživljavaju tvoj ritam i pristup u oblasti ${domainLabel.toLowerCase()}.`,
    ],
  };
}

function buildIpipNeo120MockReport(
  input: PreparedReportGenerationInput,
): RuntimeCompletedAssessmentReport {
  const promptInput = input.promptInput;

  if (!("domains" in promptInput)) {
    throw new Error("IPIP-NEO-120 mock report requires neo prompt input.");
  }

  const neoPromptInput = promptInput as IpipNeo120ParticipantReportPromptInput;
  const rankedDomains = [...neoPromptInput.domains]
    .sort((left, right) => right.score - left.score || left.domain_code.localeCompare(right.domain_code));
  const topDomain = rankedDomains[0] ?? null;
  const lowDomain = rankedDomains[rankedDomains.length - 1] ?? null;
  const topFacets = neoPromptInput.domains
    .flatMap((domain) =>
      (Array.isArray(domain.subdimensions) ? domain.subdimensions : []).map((subdimension) => ({
        ...subdimension,
        domain_label: domain.label,
      })),
    )
    .sort((left, right) => right.score - left.score || left.facet_code.localeCompare(right.facet_code))
    .slice(0, 5);

  const report = {
    contract_version: "ipip_neo_120_participant_v1",
    test: {
      slug: "ipip-neo-120-v1",
      name: neoPromptInput.test_name,
      locale: "bs",
    },
    meta: {
      report_type: "participant",
      generated_at: new Date().toISOString(),
      scale_hint: neoPromptInput.scale_hint,
    },
    summary: {
      headline: topDomain
        ? `${topDomain.label} trenutno daje najprepoznatljiviji ton tvom profilu.`
        : "Profil daje uravnotežen pregled bez jednog dominantnog signala.",
      overview:
        lowDomain && topDomain && lowDomain.domain_code !== topDomain.domain_code
          ? `Najizraženiji sloj vidi se u domeni ${topDomain.label.toLowerCase()}, dok domena ${lowDomain.label.toLowerCase()} djeluje kao mirniji razvojni prostor.`
          : "Ovaj izvještaj koristi već izračunate rezultate kako bi opisao 5 domena i 30 poddimenzija kao razvojni pregled, bez apsolutnih zaključaka.",
    },
    dominant_signals: topFacets.map(
      (facet) =>
        `${facet.label} se posebno ističe unutar domene ${facet.domain_label.toLowerCase()}.`,
    ) as [string, string, string, string, string],
    domains: IPIP_NEO_120_DOMAIN_ORDER.map((domainCode) => {
      const domain = neoPromptInput.domains.find(
        (item: IpipNeo120ParticipantReportPromptInput["domains"][number]) =>
          item.domain_code === domainCode,
      );

      if (!domain) {
        throw new Error(`Missing neo prompt domain ${domainCode}.`);
      }

      const narrative = getNeoDomainNarrative(domain.label, domain.band);

      return {
        domain_code: domain.domain_code,
        label: domain.label,
        score: domain.score,
        band: domain.band,
        summary: narrative.summary,
        strengths: narrative.strengths,
        watchouts: narrative.watchouts,
        development_tip: `Odaberi jednu malu sedmičnu praksu kojom ćeš svjesnije razvijati oblast ${domain.label.toLowerCase()}.`,
        subdimensions: (Array.isArray(domain.subdimensions) ? domain.subdimensions : []).map((subdimension) => ({
          facet_code: subdimension.facet_code,
          label: subdimension.label,
          score: subdimension.score,
          band: subdimension.band,
          summary: `${subdimension.label} se trenutno pokazuje kao ${getNeoBandCopy(subdimension.band).summaryLead}.`,
        })),
      };
    }) as IpipNeo120ParticipantReportV1["domains"],
    strengths: [
      topDomain
        ? `${topDomain.label} ti trenutno daje najviše razvojnog oslonca.`
        : "Profil pokazuje nekoliko stabilnih razvojnih oslonaca.",
      "Profil je dovoljno detaljan da možeš razlikovati šire domene od finijih poddimenzija.",
      "Rezultate možeš koristiti kao osnovu za male, praktične razvojne eksperimente.",
    ],
    watchouts: [
      "Rezultat je najkorisnije čitati kao razvojni signal, a ne kao fiksnu etiketu.",
      "Vrijedi pratiti kako se isti obrazac mijenja kroz kontekst, opterećenje i ulogu.",
      lowDomain
        ? `Domena ${lowDomain.label.toLowerCase()} traži nešto svjesniju pažnju i praksu.`
        : "Mirnije oblasti profila vrijedi periodično provjeravati kroz praksu.",
    ],
    development_recommendations: [
      "Odaberi jednu domenu i jednu poddimenziju koje želiš svjesno pratiti tokom naredne sedmice.",
      "Traži kratak feedback od jedne osobe o tome kako tvoj stil djeluje u stvarnoj saradnji.",
      "Razvoj mjeri kroz male promjene u ponašanju, a ne kroz pokušaj da promijeniš cijeli profil odjednom.",
    ],
    interpretation_note:
      "Ovaj izvještaj je razvojna interpretacija već izračunatih rezultata za 5 domena i 30 poddimenzija. Ne predstavlja dijagnozu, ne daje hiring odluke i ne opisuje tvoju ličnost kao konačnu ili nepromjenjivu.",
  };

  const validationResult = validateIpipNeo120ParticipantReportV1(report);

  if (!validationResult.ok) {
    throw new Error(
      `Mock IPIP-NEO-120 participant report failed validation: ${formatIpipNeo120ReportValidationErrors(validationResult.errors)}`,
    );
  }

  return validationResult.value;
}

function getIpipNeo120V2BandPhrase(band: IpipNeo120ParticipantBandV2): string {
  switch (band) {
    case "higher":
      return "izraženiji signal koji je češće prisutno vidljiv";
    case "balanced":
      return "uravnotežen signal u srednjem rasponu";
    case "lower":
      return "tiši signal koji je manje izraženo prisutan";
  }
}

function getIpipNeo120V2RelatedDomainCodes(
  input: IpipNeo120ParticipantAiInputV2,
  limit: number,
): string[] {
  return input.deterministic_summary.ranked_domains.slice(0, limit);
}

function getIpipNeo120V2RelatedFacetCodes(
  input: IpipNeo120ParticipantAiInputV2,
  limit: number,
): string[] {
  return input.deterministic_summary.top_subdimensions.slice(0, limit);
}

function buildIpipNeo120ParticipantV2MockReport(
  input: PreparedReportGenerationInput,
): RuntimeCompletedAssessmentReport {
  const promptInput = input.promptInput;

  if (!("domains" in promptInput) || promptInput.audience !== "participant") {
    throw new Error("IPIP-NEO-120 participant V2 mock report requires participant prompt input.");
  }

  const aiInput = buildIpipNeo120ParticipantAiInputV2(
    promptInput as IpipNeo120ParticipantReportPromptInput,
  );
  const aiInputValidation = validateIpipNeo120ParticipantAiInputV2(aiInput);

  if (!aiInputValidation.ok) {
    throw new Error(
      `Mock IPIP-NEO-120 participant V2 AI input failed validation: ${aiInputValidation.errors.join(" | ")}`,
    );
  }

  const v2Input = aiInputValidation.value;
  const rankedDomains = v2Input.deterministic_summary.ranked_domains;
  const highestDomainCode = rankedDomains[0] ?? v2Input.domains[0]?.domain_code ?? null;
  const highestDomain = v2Input.domains.find(
    (domain) => domain.domain_code === highestDomainCode,
  );
  const relatedDomains = getIpipNeo120V2RelatedDomainCodes(v2Input, 2);
  const relatedFacets = getIpipNeo120V2RelatedFacetCodes(v2Input, 2);

  const report: IpipNeo120ParticipantReportV2 = {
    contract_version: "ipip_neo_120_participant_v2",
    test: {
      slug: v2Input.test_slug,
      name: v2Input.test_name,
      locale: v2Input.locale,
    },
    meta: {
      report_type: "participant",
      generated_at: new Date().toISOString(),
      scale_hint: {
        min: v2Input.scale_hint.min,
        max: v2Input.scale_hint.max,
      },
    },
    summary: {
      headline: highestDomain
        ? `${highestDomain.participant_display_label} daje izraženiji ton ovom profilu.`
        : "Profil daje razvojni pregled pet domena.",
      overview:
        "Ovaj V2 mock izvještaj koristi pripremljeni AI input, canonical skorove i V2 pravila prikaza. Svaki domen i svaka poddimenzija zadržavaju izvorni score, band, labelu i participant labelu. Narativ je jednostavan i služi za provjeru V2 contracta.",
      badges: [
        {
          label: "Izraženiji signal",
          related_domains: relatedDomains.slice(0, 1),
          related_facets: relatedFacets.slice(0, 1),
        },
        {
          label: "Srednji raspon",
          related_domains: v2Input.deterministic_summary.balanced_domains.slice(0, 1),
          related_facets: relatedFacets.slice(1, 2),
        },
        {
          label: "Tiši signal",
          related_domains: v2Input.deterministic_summary.lowest_domains.slice(0, 1),
          related_facets: v2Input.deterministic_summary.lowest_subdimensions.slice(0, 1),
        },
      ],
    },
    key_patterns: [
      {
        title: "Pregled domena",
        description:
          "Pet domena je prikazano u canonical redoslijedu i svaka koristi V2 participant labelu. Opis se oslanja na band meaning pravila, bez mijenjanja score vrijednosti.",
        related_domains: relatedDomains,
        related_facets: relatedFacets,
      },
      {
        title: "Pregled poddimenzija",
        description:
          "Trideset poddimenzija zadržava canonical facet kodove i pripadajuće domene. Neuroticism facete ostaju direct_but_non_clinical i ne invertuju se.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["ANXIETY", "VULNERABILITY"],
      },
      {
        title: "Razvojni fokus",
        description:
          "Viši, srednji i niži bandovi se opisuju kao izraženiji, uravnoteženi ili tiši signali. Tekst ostaje razvojni i vezan za dati input.",
        related_domains: v2Input.deterministic_summary.ranked_domains.slice(0, 2),
        related_facets: v2Input.deterministic_summary.lowest_subdimensions.slice(0, 2),
      },
    ],
    domains: v2Input.domains.map((domain) => {
      const domainPhrase =
        domain.domain_code === "NEUROTICISM" && domain.band_meaning.display_phrases?.[0]
          ? domain.band_meaning.display_phrases[0]
          : getIpipNeo120V2BandPhrase(domain.band);

      return {
        domain_code: domain.domain_code,
        label: domain.label,
        participant_display_label: domain.participant_display_label,
        score: domain.score,
        band: domain.band,
        band_label: domain.band_label,
        display_score: domain.display_score,
        display_band: domain.display_band,
        display_band_label: domain.display_band_label,
        card_title: `${domain.participant_display_label} profil`,
        summary: `${domain.participant_display_label} se u ovom profilu prikazuje kao ${domainPhrase}. Opis koristi definiciju domene: ${domain.definition}`,
        practical_signal: `${domain.participant_display_label} može se u radu pratiti kroz ponašanja koja odgovaraju V2 display pravilu. Band se čita kao ${getIpipNeo120V2BandPhrase(domain.band)}.`,
        candidate_reflection: `Najkorisnije je da ${domain.participant_display_label.toLowerCase()} pratiš kroz jasan kontekst i svjesno prilagođavanje situaciji.`,
        strengths: [
          `${domain.participant_display_label} može dati oslonac kada je kontekst usklađen sa ovim obrascem.`,
          `Band ${domain.band_label.toLowerCase()} pomaže da signal čitaš nijansirano i kontekstualno.`,
        ],
        watchouts: [
          `Vrijedi pratiti kada ${domain.participant_display_label.toLowerCase()} traži dodatni kontekst.`,
          "Korisno je povezati ovaj signal sa stvarnim ponašanjem u radu i saradnji.",
        ],
        development_tip: `Izaberi jednu situaciju u kojoj ćeš pratiti kako se pokazuje ${domain.participant_display_label.toLowerCase()}.`,
        subdimensions: domain.subdimensions.map((subdimension) => ({
          facet_code: subdimension.facet_code,
          label: subdimension.label,
          participant_display_label: subdimension.participant_display_label,
          score: subdimension.score,
          band: subdimension.band,
          band_label: subdimension.band_label,
          card_title: `${subdimension.participant_display_label} signal`,
          summary: `${subdimension.participant_display_label} se prikazuje kao ${getIpipNeo120V2BandPhrase(subdimension.band)}. Ova poddimenzija koristi V2 definiciju i canonical score.`,
          practical_signal: `${subdimension.participant_display_label} može se pratiti kroz konkretan obrazac u svakodnevnom radu.`,
          candidate_reflection: `Najkorisnije je da ${subdimension.participant_display_label.toLowerCase()} pratiš kroz konkretne situacije u praksi.`,
        })) as IpipNeo120ParticipantReportV2["domains"][number]["subdimensions"],
      };
    }) as IpipNeo120ParticipantReportV2["domains"],
    strengths: [
      {
        title: "Canonical struktura",
        description:
          "V2 snapshot čuva canonical redoslijed domena i poddimenzija, što olakšava stabilan prikaz i provjeru.",
        related_domains: relatedDomains,
        related_facets: relatedFacets,
      },
      {
        title: "Participant labele",
        description:
          "Svaki domen i svaka poddimenzija koriste participant display labelu iz V2 definition seta.",
        related_domains: ["AGREEABLENESS"],
        related_facets: ["COOPERATION"],
      },
      {
        title: "Band značenja",
        description:
          "Niži, srednji i viši bandovi koriste kontrolisan razvojni jezik kao tiši, uravnotežen ili izraženiji signal.",
        related_domains: v2Input.deterministic_summary.ranked_domains.slice(0, 2),
        related_facets: v2Input.deterministic_summary.top_subdimensions.slice(0, 2),
      },
      {
        title: "Neuroticism prikaz",
        description:
          "Domena se prikazuje kao Emocionalna stabilnost, dok poddimenzije ostaju direct_but_non_clinical.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["ANXIETY", "VULNERABILITY"],
      },
    ],
    watchouts: [
      {
        title: "Kontekst čitanja",
        description:
          "Rezultat je najkorisnije povezati sa konkretnim situacijama, zadacima i saradnjom.",
        related_domains: relatedDomains,
        related_facets: relatedFacets,
      },
      {
        title: "Tiši signali",
        description:
          "Niže izraženi dijelovi profila bolje se čitaju kao tiši signali, ne kao zaključak o sposobnosti.",
        related_domains: v2Input.deterministic_summary.lowest_domains.slice(0, 2),
        related_facets: v2Input.deterministic_summary.lowest_subdimensions.slice(0, 2),
      },
      {
        title: "Srednji raspon",
        description:
          "Uravnoteženi bandovi traže situaciono čitanje jer se mogu različito pokazati u različitim uslovima.",
        related_domains: v2Input.deterministic_summary.balanced_domains.slice(0, 2),
        related_facets: relatedFacets,
      },
    ],
    work_style: {
      title: "Radni stil",
      paragraphs: [
        "Radni stil se u ovom V2 mock izvještaju opisuje kroz kombinaciju canonical domena, poddimenzija i band meaning pravila.",
        "Praktično čitanje profila najbolje je vezati za stvarne situacije, povratnu informaciju i male razvojne korake.",
      ],
    },
    development_recommendations: [
      {
        title: "Prati jedan domen",
        description:
          "Odaberi jedan domen i posmatraj kako se njegov signal pokazuje u konkretnim zadacima i saradnji.",
        action: "Zabilježi jednu situaciju u kojoj se signal jasno pokazao.",
        related_domains: relatedDomains.slice(0, 1),
        related_facets: relatedFacets.slice(0, 1),
      },
      {
        title: "Poveži poddimenziju",
        description:
          "Izaberi jednu poddimenziju i poveži je sa ponašanjem koje možeš stvarno pratiti u radu.",
        action: "Napiši jedan primjer ponašanja koji odgovara toj poddimenziji.",
        related_domains: relatedDomains.slice(0, 1),
        related_facets: relatedFacets.slice(0, 1),
      },
      {
        title: "Provjeri kontekst",
        description:
          "Isti signal može izgledati drugačije kada se promijeni nivo pritiska, samostalnosti ili saradnje.",
        action: "Uporedi jednu mirniju i jednu zahtjevniju situaciju.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["VULNERABILITY"],
      },
      {
        title: "Koristi feedback",
        description:
          "Povratna informacija može pomoći da razvojni signal povežeš sa stvarnim utiskom drugih.",
        action: "Zatraži kratak konkretan feedback o jednom obrascu.",
        related_domains: v2Input.deterministic_summary.ranked_domains.slice(0, 1),
        related_facets: v2Input.deterministic_summary.top_subdimensions.slice(0, 1),
      },
    ],
    interpretation_note: v2Input.static_text.interpretation_note,
  };

  const validationResult = validateIpipNeo120ParticipantReportV2(report);

  if (!validationResult.ok) {
    throw new Error(
      `Mock IPIP-NEO-120 participant V2 report failed validation: ${formatIpipNeo120ParticipantReportV2ValidationErrors(validationResult.errors)}`,
    );
  }

  return validationResult.value;
}

function buildIpipNeo120HrMockReport(
  input: PreparedReportGenerationInput,
): RuntimeCompletedAssessmentReport {
  const promptInput = input.promptInput;

  if (!("domains" in promptInput) || promptInput.audience !== "hr") {
    throw new Error("IPIP-NEO-120 HR mock report requires HR neo prompt input.");
  }

  const neoPromptInput = promptInput as IpipNeo120HrReportPromptInput;
  const rankedDomains = [...neoPromptInput.domains].sort(
    (left, right) => right.score - left.score || left.domain_code.localeCompare(right.domain_code),
  );
  const highestDomain = rankedDomains[0] ?? null;
  const topFacets = neoPromptInput.domains
    .flatMap((domain) => (Array.isArray(domain.facets) ? domain.facets : []))
    .sort((left, right) => right.score - left.score || left.facet_code.localeCompare(right.facet_code))
    .slice(0, 5);
  const topFacetLabel = topFacets[0]?.label?.toLowerCase() ?? "ključne facete";
  const secondFacetLabel = topFacets[1]?.label?.toLowerCase() ?? "radne reakcije";
  const topThreeDomains = rankedDomains.slice(0, 3);
  const domainByCode = new Map(
    neoPromptInput.domains.map((domain) => [domain.domain_code, domain] as const),
  );

  function buildDomainMeaning(domainCode: IpipNeo120DomainCode, band: "low" | "moderate" | "high") {
    const label = getIpipNeo120DomainLabel(domainCode) ?? domainCode;

    if (domainCode === "AGREEABLENESS") {
      if (band === "high") {
        return {
          conciseMeaning: "Pokazuje izraženiji saradnički i obziran stil u odnosima s drugima.",
          hrRelevance: "Za HR je važno provjeriti kako održava saradnju kada mora postaviti granicu ili dati direktan feedback.",
          checkInInterview: "Tražiti primjer neslaganja, zaštite prioriteta i davanja neugodnog feedbacka.",
        };
      }

      if (band === "low") {
        return {
          conciseMeaning: "Može djelovati direktnije i manje popustljivo u svakodnevnoj saradnji.",
          hrRelevance: "Za HR je korisno provjeriti kako balansira jasnoću stava i kvalitet odnosa u timu.",
          checkInInterview: "Tražiti primjer kada je morala uskladiti odlučnost sa odnosom prema kolegama.",
        };
      }
    }

    if (domainCode === "CONSCIENTIOUSNESS") {
      if (band === "high") {
        return {
          conciseMeaning: "Profil sugeriše veću usmjerenost na standard, obaveze i dovršavanje zadataka.",
          hrRelevance: "Za HR je važno povezati ovaj domen sa rokovima, prioritetima i tolerancijom na promjenu plana.",
          checkInInterview: "Provjeriti kako reaguje kada rokovi ostanu isti, ali se prioriteti ili zahtjevi promijene.",
        };
      }

      if (band === "low") {
        return {
          conciseMeaning: "Može tražiti više strukture da bi ritam rada ostao stabilan pod više paralelnih zahtjeva.",
          hrRelevance: "Za HR je korisno provjeriti kako organizuje zadatke, prati rokove i traži pojašnjenje.",
          checkInInterview: "Tražiti primjer organizacije rada kada je istovremeno vodila više obaveza.",
        };
      }
    }

    if (domainCode === "NEUROTICISM") {
      if (band === "high") {
        return {
          conciseMeaning: "Rezultat sugeriše osjetljiviji odgovor na pritisak, neizvjesnost ili zasićenje zahtjevima.",
          hrRelevance: "Za HR je posebno važno provjeriti samoregulaciju, traženje podrške i stabilnost ponašanja pod pritiskom.",
          checkInInterview: "Tražiti primjer rada pod pritiskom i kako je održala fokus, ritam i komunikaciju.",
        };
      }

      if (band === "low") {
        return {
          conciseMeaning: "Može djelovati smirenije i stabilnije kada su zahtjevi, pritisak ili nejasnoća pojačani.",
          hrRelevance: "Za HR je korisno provjeriti da li ta stabilnost ostaje prisutna i u dužem periodu većeg opterećenja.",
          checkInInterview: "Tražiti primjer zahtjevnog perioda i kako je održala energiju, fokus i kvalitet odluka.",
        };
      }
    }

    if (domainCode === "EXTRAVERSION") {
      if (band === "high") {
        return {
          conciseMeaning: "Profil sugeriše energičniji i vidljiviji stil u interakciji, iniciranju i timskom prisustvu.",
          hrRelevance: "Za HR je važno provjeriti kako ovu energiju prevodi u saradnju, slušanje i praktične odluke.",
          checkInInterview: "Provjeriti primjer kada je trebalo balansirati inicijativu sa slušanjem drugih perspektiva.",
        };
      }

      if (band === "low") {
        return {
          conciseMeaning: "Može preferirati mirniji, promišljeniji i manje upadljiv način uključivanja u tim.",
          hrRelevance: "Za HR je korisno provjeriti kako se uključuje kada uloga traži više vidljivosti, inicijative ili uticaja.",
          checkInInterview: "Tražiti primjer kada je morala aktivnije zauzeti prostor ili preuzeti riječ u grupi.",
        };
      }
    }

    if (band === "high") {
      return {
        conciseMeaning: `${label} je izraženija i vjerovatno snažnije oblikuje svakodnevni radni obrazac.`,
        hrRelevance: `Za HR je korisno provjeriti kako se ${label.toLowerCase()} vidi u konkretnoj ulozi, tempu rada i odnosima u timu.`,
        checkInInterview: `Tražiti primjer ponašanja koji potvrđuje kako se ${label.toLowerCase()} pokazuje u realnom radnom kontekstu.`,
      };
    }

    if (band === "low") {
      return {
        conciseMeaning: `${label} je manje izražena i može tražiti više konteksta da bi se pravilno tumačila u radu.`,
        hrRelevance: `Za HR je važno provjeriti gdje tiši signal iz ${label.toLowerCase()} postaje relevantan za zahtjeve konkretne uloge.`,
        checkInInterview: `Tražiti primjer situacije u kojoj je uloga ipak tražila više ${label.toLowerCase()} nego što je bilo prirodno.`,
      };
    }

    return {
      conciseMeaning: `${label} djeluje uravnoteženo i vjerovatno se prilagođava zahtjevima konteksta bez jasnog ekstrema.`,
      hrRelevance: `Za HR je korisno provjeriti kada ${label.toLowerCase()} ostaje stabilna, a kada zavisi od vrste zadatka i okruženja.`,
      checkInInterview: `Tražiti primjer različitih radnih situacija da se vidi kako se ${label.toLowerCase()} mijenja kroz kontekst.`,
    };
  }

  const report = {
    contract_version: "ipip_neo_120_hr_v2",
    test: {
      code: "ipip_neo_120",
      name: "IPIP-NEO-120",
    },
    meta: {
      language: "bs",
      audience: "hr",
    },
    headline: highestDomain
      ? `Profil ukazuje na ${highestDomain.label.toLowerCase()} kao važan radni signal koji vrijedi provjeriti kroz konkretne situacije saradnje i odlučivanja.`
      : "Profil ukazuje na više ravnotežnih radnih obrazaca koje vrijedi provjeriti kroz konkretne situacije uloge.",
    executive_summary: highestDomain
      ? `Profil sugeriše da ${highestDomain.label.toLowerCase()} snažnije oblikuje svakodnevni radni obrazac, posebno kroz ${topFacetLabel} i ${secondFacetLabel}. U intervjuu vrijedi provjeriti kako se taj obrazac vidi kada osoba mora zaštititi prioritet, dati direktan feedback ili reagovati na pritisak. Nalaz je najkorisnije prevesti u strukturirana pitanja i rani onboarding razgovor.`
      : "Profil sugeriše više uravnoteženih obrazaca rada bez jedne potpuno dominantne domene. U intervjuu vrijedi provjeriti kako osoba održava saradnju, ritam rada i reakciju na pritisak kroz konkretne primjere. Nalaz je najkorisnije koristiti kao vodič za strukturirani intervju i rani onboarding razgovor.",
    key_hr_signals: [
      {
        title: highestDomain
          ? `${highestDomain.label} kao dominantni radni obrazac`
          : "Dominantni radni obrazac traži kontekstualnu provjeru",
        evidence: highestDomain
          ? `Najizraženiji domen u inputu je ${highestDomain.label}, uz dodatni signal iz faceta poput ${topFacetLabel}.`
          : "Najviši domeni su bliski, pa profil traži provjeru kroz više konkretnih radnih situacija.",
        hr_implication:
          "Koristiti strukturirana pitanja da se provjeri kako se ovaj obrazac vidi u stvarnoj saradnji, prioritizaciji i donošenju odluka.",
      },
      {
        title: "Provjera ponašanja pod pritiskom",
        evidence: domainByCode.get("NEUROTICISM")
          ? `Domen Neuroticizam i povezane facete daju signal kako osoba može reagovati kada su pritisak ili nejasnoća veći.`
          : "Rad pod pritiskom vrijedi provjeriti i kada nema ekstremnog signala, jer kontekst uloge može pojačati razlike u ponašanju.",
        hr_implication:
          "U intervjuu tražiti primjer zahtjevnog perioda i kako je osoba održala fokus, komunikaciju i kvalitet odluka.",
      },
      {
        title: "Prevesti profil u onboarding prakse",
        evidence:
          "Kombinacija dominantnih domena i faceta daje najviše vrijednosti kada se poveže sa stvarnim zadacima, povratnom informacijom i timskim očekivanjima.",
        hr_implication:
          "Rano dogovoriti očekivanja, granice saradnje i ritam kratkih check-in razgovora u prvih 30 dana.",
      },
    ] as IpipNeo120HrReportV1["key_hr_signals"],
    verification_focus: [
      {
        area: "Postavljanje granica",
        why_it_matters:
          "Dominantni stil saradnje ili usmjerenosti na odnos vrijedi provjeriti i kroz situacije kada osoba mora zaštititi prioritet ili reći ne.",
        how_to_check:
          "U intervjuu tražiti primjer neslaganja, odbijanja zahtjeva ili zaštite prioriteta pod vremenskim pritiskom.",
      },
      {
        area: "Direktna povratna informacija",
        why_it_matters:
          "Jače izražene interpersonalne osobine mogu izgledati drugačije kada osoba mora dati jasan i neugodan feedback.",
        how_to_check:
          "Kroz behavioral pitanje ili reference provjeriti kako osoba vodi zahtjevne razgovore i zadržava jasnoću poruke.",
      },
      {
        area: "Reakcija na pritisak",
        why_it_matters:
          "Signal iz Neuroticizma i povezanih faceta vrijedi tumačiti kroz stvarni posao, posebno kada se rokovi, nejasnoća ili opterećenje povećaju.",
        how_to_check:
          "Tražiti konkretan primjer rada pod pritiskom ili kratki case zadatak sa promjenom prioriteta i naknadnom refleksijom.",
      },
    ] as IpipNeo120HrReportV1["verification_focus"],
    interview_questions: [
      {
        question: "Opišite situaciju kada se niste slagali s odlukom tima. Kako ste reagovali?",
        evaluates: "Postavljanje granica, neslaganje i zaštitu stava pod socijalnim pritiskom.",
        what_good_answer_may_show:
          "Da osoba može ostati saradljiva, ali i jasno obrazložiti stav te preuzeti odgovornost za posljedice odluke.",
      },
      {
        question: "Kada pomažete kolegama, kako odlučujete gdje je granica između podrške i preuzimanja tuđeg posla?",
        evaluates: "Balans saradnje, prioriteta i lične odgovornosti.",
        what_good_answer_may_show:
          "Da osoba prepoznaje granice podrške, štiti prioritete i ne gubi fokus na vlastite obaveze.",
      },
      {
        question: "Kako reagujete kada morate dati direktnu, neugodnu povratnu informaciju?",
        evaluates: "Direktnu komunikaciju, emocionalnu zrelost i sposobnost vođenja teških razgovora.",
        what_good_answer_may_show:
          "Da osoba zna biti jasna, poštena i profesionalna čak i kada razgovor nije ugodan.",
      },
      {
        question: "Recite primjer kada ste morali braniti svoj stav iako je većina mislila drugačije.",
        evaluates: "Samostalnost u odlučivanju i otpornost na grupni pritisak.",
        what_good_answer_may_show:
          "Da osoba razlikuje saradnju od popuštanja i zna argumentovano ostati pri stavu kada za to postoji osnov.",
      },
      {
        question: "Kako balansirate dobar odnos s timom i potrebu da se donese brza odluka?",
        evaluates: "Balans odnosa, brzine odluke i praktičnog prosuđivanja u timskom kontekstu.",
        what_good_answer_may_show:
          "Da osoba zna kada graditi saglasnost, a kada skratiti proces i preuzeti odgovornost za odluku.",
      },
    ] as IpipNeo120HrReportV1["interview_questions"],
    strengths_and_overuse_risks: topThreeDomains.map((domain) => ({
      trait_or_pattern:
        domain.domain_code === "AGREEABLENESS"
          ? "Izraženija saradničnost"
          : domain.domain_code === "CONSCIENTIOUSNESS"
            ? "Naglašena savjesnost i usmjerenost na standard"
            : domain.domain_code === "EXTRAVERSION"
              ? "Vidljiviji i energičniji stil uključivanja"
              : domain.domain_code === "NEUROTICISM"
                ? "Osjetljiviji odgovor na pritisak"
                : `Relevantan obrazac u domeni ${domain.label.toLowerCase()}`,
      possible_strengths: [
        `Može podržati situacije u kojima je ${domain.label.toLowerCase()} direktno važna za ulogu.`,
        `Može dati prepoznatljiv obrazac rada koji je timu i menadžeru lakše operativno pratiti.`,
        `Može pomoći boljem uklapanju u dio posla gdje ova osobina nosi stvarnu radnu vrijednost.`,
      ] as [string, string, string],
      possible_overuse_risks: [
        `U određenim kontekstima ${domain.label.toLowerCase()} može otići u pretjerivanje ako zahtjevi uloge nisu dobro postavljeni.`,
        "Vrijedi provjeriti kako se obrazac mijenja kada poraste pritisak, nejasnoća ili međuzavisnost u timu.",
        "Ako se tumači bez radnog konteksta, nalaz može izgledati šire nego što stvarno jeste.",
      ] as [string, string, string],
      hr_handling_tip:
        `U intervjuu i onboardingu povezati ${domain.label.toLowerCase()} sa konkretnim zadacima, granicama odgovornosti i načinom davanja feedbacka.`,
    })) as IpipNeo120HrReportV1["strengths_and_overuse_risks"],
    domain_overview: IPIP_NEO_120_DOMAIN_ORDER.map((domainCode) => {
      const domain = neoPromptInput.domains.find(
        (item: IpipNeo120HrReportPromptInput["domains"][number]) => item.domain_code === domainCode,
      );

      if (!domain) {
        throw new Error(`Missing neo HR prompt domain ${domainCode}.`);
      }

      const overview = buildDomainMeaning(domain.domain_code, domain.score_band);
      const topDomainFacets = [...domain.facets]
        .sort((left, right) => right.score - left.score || left.facet_code.localeCompare(right.facet_code))
        .slice(0, 2);

      return {
        domain_name: domain.label,
        score_label_or_band: domain.score_band,
        concise_meaning: overview.conciseMeaning,
        hr_relevance: overview.hrRelevance,
        check_in_interview: overview.checkInInterview,
        top_facets: topDomainFacets.map((facet) => ({
          facet_name: facet.label || getIpipNeo120FacetLabel(facet.facet_code) || facet.facet_code,
          score_label_or_band: facet.score_band,
          relevance: `${facet.label} daje dodatni signal za praktičnu provjeru ovog domena u radnom kontekstu.`,
        })),
      };
    }) as IpipNeo120HrReportV1["domain_overview"],
    onboarding_and_management_guidance: [
      {
        recommendation: "U prvim sedmicama dogovoriti očekivanja oko prioriteta i granica saradnje.",
        why:
          "To pomaže da dominantni interpersonalni i radni obrasci budu čitani kroz konkretan posao, a ne kroz apstraktan opis ličnosti.",
        first_30_days_application:
          "Na prvom ili drugom check-in razgovoru pregledati kako osoba štiti prioritete i kako traži pomoć ili pojašnjenje.",
      },
      {
        recommendation: "Uvesti ritam kratkog feedbacka nakon prvih timskih interakcija.",
        why:
          "Rani feedback pokazuje kako profil izgleda u stvarnoj saradnji i gdje se javljaju jače ili tiše reakcije od očekivanih.",
        first_30_days_application:
          "Nakon prvih sastanaka ili zajedničkih zadataka tražiti osvrt na saradnju, jasnoću poruke i upravljanje neslaganjem.",
      },
      {
        recommendation: "Provjeriti kako osoba reaguje na nejasne zadatke prije nego se uloga potpuno stabilizuje.",
        why:
          "To je operativno važan test samoregulacije, traženja pojašnjenja i preuzimanja odgovornosti kada struktura nije potpuna.",
        first_30_days_application:
          "U prvom mjesecu uključiti barem jedan zadatak sa djelimično otvorenim parametrima i kasnije ga kratko analizirati.",
      },
      {
        recommendation: "Povezati onboarding razgovore sa načinom davanja i primanja direktnog feedbacka.",
        why:
          "Dominantne osobine daju veću praktičnu vrijednost kada se rano vidi kako osoba vodi zahtjevne razgovore i štiti standard rada.",
        first_30_days_application:
          "Nakon prve zahtjevnije situacije pregledati šta je osoba uradila, šta je zaštitila i kako bi drugi put postupila.",
      },
    ] as IpipNeo120HrReportV1["onboarding_and_management_guidance"],
    team_fit_notes: [
      {
        fit_condition: "Tim sa visokom potrebom za saradnjom",
        may_work_well_when:
          "Uloga traži koordinaciju, razmjenu informacija i održavanje stabilnih odnosa u svakodnevnom radu.",
        watchout:
          "Provjeriti da li tim istovremeno traži česte direktne konflikte, brze rezove ili snažno suprotstavljanje bez mnogo pripreme.",
      },
      {
        fit_condition: "Okruženje sa jasnim standardima i odgovornostima",
        may_work_well_when:
          "Radni okvir dovoljno jasno pokazuje šta znači dobar rezultat i kako se donose odluke.",
        watchout:
          "Ako je uloga stalno nejasna ili promjenjiva, vrijedi provjeriti kako osoba održava fokus, tempo i komunikaciju.",
      },
      {
        fit_condition: "Tim koji koristi strukturirani feedback",
        may_work_well_when:
          "Menadžer i tim rano prevode zapažanja u konkretno ponašanje, primjere i razvojne dogovore.",
        watchout:
          "Bez takvog ritma profil može ostati previše opšti i izgubiti praktičnu vrijednost za vođenje i onboarding.",
      },
    ] as IpipNeo120HrReportV1["team_fit_notes"],
    decision_support_note: [
      "Ne koristiti ovaj profil kao samostalnu odluku o kandidatu.",
      "Koristiti ga za pripremu strukturiranog intervjua i provjeru ponašanja u relevantnim radnim situacijama.",
      "Posebno provjeriti kako osoba postavlja granice, komunicira neslaganje i reaguje na pritisak.",
      "Zaključke kombinovati sa iskustvom, intervjuom, referencama i zahtjevima konkretne uloge.",
    ] as IpipNeo120HrReportV1["decision_support_note"],
    interpretation_note:
      "Ovaj izvještaj nije dijagnoza niti odluka o zapošljavanju, ne potvrđuje zaštićene osobine i treba ga čitati uz kontekst uloge i druge izvore informacija.",
  };

  const validationResult = validateIpipNeo120HrReportV1(report, {
    strictContract: true,
    enforceGuardrails: true,
  });

  if (!validationResult.ok) {
    throw new Error(
      `Mock IPIP-NEO-120 HR report failed validation: ${formatIpipNeo120ReportValidationErrors(validationResult.errors)}`,
    );
  }

  return validationResult.value;
}

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
  const promptInput = input.promptInput;

  if ("dimension_scores" in promptInput || "domains" in promptInput) {
    throw new Error("IPC mock report requires IPC prompt input.");
  }

  const ipcPromptInput = promptInput as IpcReportPromptInput;

  if (!ipcPromptInput.derived.dominantOctant || !ipcPromptInput.derived.secondaryOctant) {
    throw new Error("IPC mock report requires dominant and secondary octants.");
  }

  if (ipcPromptInput.audience === "participant") {
    const report = {
      report_title: "Tvoj IPC razvojni izvještaj",
      report_subtitle: `Pregled interpersonalnog stila i saradnje za ${input.testSlug}.`,
      summary: {
        headline:
          ipcPromptInput.derived.primaryDisc === null
            ? "Tvoj interpersonalni stil djeluje uravnoteženo bez jedne potpuno dominantne DISC oznake."
            : `Najizraženiji signal tvog interpersonalnog stila trenutno je ${ipcPromptInput.derived.primaryDisc}.`,
        overview:
          "Ovaj izvještaj opisuje vjerovatne obrasce komunikacije, saradnje i razvojnog fokusa na osnovu IPC oktanata i izvedenih osa topline i dominantnosti.",
      },
      style_snapshot: {
        primary_disc: ipcPromptInput.derived.primaryDisc,
        dominant_octant: ipcPromptInput.derived.dominantOctant,
        secondary_octant: ipcPromptInput.derived.secondaryOctant,
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
        ipcPromptInput.derived.primaryDisc === null
          ? "Profil djeluje uravnoteženo bez jedne potpuno dominantne DISC oznake."
          : `Najizraženiji signal interpersonalnog stila trenutno je ${ipcPromptInput.derived.primaryDisc}.`,
      overview:
        "Ovaj izvještaj koristi IPC oktante i izvedene ose dominantnosti i topline kako bi opisao vjerovatne obrasce komunikacije, saradnje i rukovođenja uticajem u radnom kontekstu.",
    },
    style_snapshot: {
      primary_disc: ipcPromptInput.derived.primaryDisc,
      dominant_octant: ipcPromptInput.derived.dominantOctant,
      secondary_octant: ipcPromptInput.derived.secondaryOctant,
      dominance: ipcPromptInput.derived.dominance,
      warmth: ipcPromptInput.derived.warmth,
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

function buildMwmsParticipantMockReport(
  input: PreparedReportGenerationInput,
): RuntimeCompletedAssessmentReport {
  const promptInput = input.promptInput as MwmsParticipantReportPromptInput;
  const scoreByCode = new Map(promptInput.dimensions.map((dimension) => [dimension.code, dimension]));
  const dominantLabels = promptInput.derived_profile.dominant_dimensions
    .map((dimensionCode) => scoreByCode.get(dimensionCode)?.label ?? dimensionCode)
    .join(" i ");
  const lowerLabels = promptInput.derived_profile.lower_dimensions
    .map((dimensionCode) => scoreByCode.get(dimensionCode)?.label ?? dimensionCode)
    .join(" i ");
  const hasElevatedAmotivation = promptInput.derived_profile.caution_flags.elevated_amotivation;
  const hasMixedProfile = promptInput.derived_profile.caution_flags.mixed_profile;

  const report = {
    schema_version: MWMS_PARTICIPANT_REPORT_SCHEMA_VERSION,
    test_slug: "mwms_v1",
    audience: "participant",
    title: "Radna motivacija",
    summary: {
      headline: dominantLabels
        ? `${dominantLabels} trenutno su najizraženiji dijelovi tvog profila motivacije.`
        : "Profil motivacije daje pregled više izvora radnog angažmana.",
      paragraph:
        "Ovaj izvještaj koristi već izračunate skorove na šest skala i čita ih kao profil, bez ukupnog rezultata ili presude o osobi.",
    },
    motivation_pattern: {
      autonomous:
        `Autonomni oblici motivacije imaju prosjek ${promptInput.derived_profile.autonomous_motivation_score.toFixed(2)} / 7 i opisuju koliko se posao može povezati sa vrijednostima, interesom ili smislom.`,
      controlled:
        `Kontrolisani oblici motivacije imaju prosjek ${promptInput.derived_profile.controlled_motivation_score.toFixed(2)} / 7 i opisuju koliko napor može dolaziti iz očekivanja, pritiska, nagrade ili izbjegavanja negativnih posljedica.`,
      amotivation: hasElevatedAmotivation
        ? "Amotivacija je povišena i vrijedi je čitati oprezno, kao poziv na razgovor o kontekstu, energiji i jasnoći uloge."
        : "Amotivacija nije jedini zaključak o profilu i korisna je uglavnom kao signal za provjeru konteksta i jasnoće uloge.",
    },
    key_observations: [
      dominantLabels
        ? `Najizraženije skale su ${dominantLabels.toLowerCase()}, što daje početnu sliku o tome koji izvori motivacije su trenutno vidljiviji.`
        : "Profil nema jedan potpuno dominantan izvor motivacije.",
      hasMixedProfile
        ? "Autonomni i kontrolisani izvori motivacije su istovremeno izraženi, pa profil vrijedi čitati kao mješovit."
        : "Skale je korisnije čitati zajedno nego izdvajati jednu vrijednost kao konačan zaključak.",
    ],
    possible_tensions: [
      lowerLabels
        ? `Niže izražene skale (${lowerLabels.toLowerCase()}) mogu pokazati gdje vrijedi dodatno provjeriti šta osobi daje ili oduzima energiju.`
        : "Moguće napetosti treba provjeravati kroz konkretan radni kontekst.",
      promptInput.derived_profile.caution_flags.high_controlled_relative_to_autonomous
        ? "Kontrolisani izvori motivacije su vidljivo jači od autonomnih, što može značiti da dio napora dolazi iz pritiska ili očekivanja."
        : "Profil ne treba tumačiti kao dokaz motivacije, nego kao hipotezu za razgovor.",
    ],
    reflection_questions: [
      "Koji aspekti posla ti najviše daju osjećaj smisla, interesa ili lične vrijednosti?",
      "U kojim situacijama osjećaš da radiš više zbog pritiska, očekivanja ili posljedica nego zbog samog značaja posla?",
      "Šta bi u konkretnom radnom kontekstu moglo povećati jasnoću, energiju i osjećaj odgovornosti?",
    ],
    development_suggestions: [
      "Poveži jedan važan zadatak sa konkretnom vrijednošću ili ishodom koji ti ima smisla.",
      "Razgovaraj o uslovima rada koji povećavaju osjećaj autonomije, jasnoće i odgovornosti.",
      "Ne koristi jednu skalu kao etiketu, nego profil poveži sa stvarnim primjerima iz rada.",
    ],
    interpretation_note:
      "Ovaj izvještaj ne predstavlja procjenu vrijednosti osobe niti samostalnu osnovu za odluku o zapošljavanju. Najkorisniji je kada se poveže sa konkretnom ulogom, razgovorom i drugim rezultatima procjene.",
  };

  const validationResult = validateMwmsParticipantReportV1(report);

  if (!validationResult.ok) {
    throw new Error(
      `Mock MWMS participant report failed validation: ${formatMwmsParticipantReportV1ValidationErrors(validationResult.errors)}`,
    );
  }

  return validationResult.value;
}

function buildSafranParticipantMockReport(
  input: PreparedReportGenerationInput,
): RuntimeCompletedAssessmentReport {
  const promptInput = input.promptInput as SafranAiReportInput;
  const report = buildMockSafranParticipantAiReport(promptInput);
  const validationResult = validateSafranParticipantAiReport(report, {
    expectedInput: promptInput,
  });

  if (!validationResult.ok) {
    throw new Error(
      `Mock SAFRAN participant report failed validation: ${formatSafranParticipantAiReportValidationErrors(validationResult.errors)}`,
    );
  }

  return validationResult.value;
}

function buildSafranHrMockReport(
  input: PreparedReportGenerationInput,
): RuntimeCompletedAssessmentReport {
  const promptInput = input.promptInput as SafranHrReportInput;
  const report = buildMockSafranHrReportV1(promptInput);
  const validationResult = validateSafranHrReport(report, {
    expectedInput: promptInput,
  });

  if (!validationResult.ok) {
    throw new Error(
      `Mock SAFRAN HR report failed validation: ${formatSafranHrReportValidationErrors(validationResult.errors)}`,
    );
  }

  return validationResult.value;
}

function buildMockReport(input: PreparedReportGenerationInput): RuntimeCompletedAssessmentReport {
  if ("domains" in input.promptInput) {
    if (input.promptInput.audience === "hr") {
      return buildIpipNeo120HrMockReport(input);
    }

    if (getIpipNeo120ParticipantReportVersion() === "v2") {
      return buildIpipNeo120ParticipantV2MockReport(input);
    }

    return buildIpipNeo120MockReport(input);
  }

  if ("dimensions" in input.promptInput && input.promptInput.test_slug === "mwms_v1") {
    return buildMwmsParticipantMockReport(input);
  }

  if ("test" in input.promptInput && input.promptInput.test.slug === "safran_v1") {
    if (input.promptInput.test.audience === "hr") {
      return buildSafranHrMockReport(input);
    }

    return buildSafranParticipantMockReport(input);
  }

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
  const promptAudience = input.promptInput.audience;

  const strengths = primaryDimensions.map((dimensionCode, index) => {
    const dimension = dimensionsByCode.get(dimensionCode);
    const insight = dimensionInsights.find((item) => item.dimension_code === dimensionCode);
    const isHrAudience = promptAudience === "hr";

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
    const isHrAudience = promptAudience === "hr";

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
    const isHrAudience = promptAudience === "hr";

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
