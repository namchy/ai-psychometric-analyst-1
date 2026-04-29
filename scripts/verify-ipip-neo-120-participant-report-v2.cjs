const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

function fail(message) {
  throw new Error(message);
}

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  const extensions = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"];

  for (const extension of extensions) {
    const withExtension = `${candidatePath}${extension}`;

    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  for (const extension of extensions) {
    const asIndex = path.join(candidatePath, `index${extension}`);

    if (fs.existsSync(asIndex)) {
      return asIndex;
    }
  }

  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return emptyModulePath;
  }

  if (request.startsWith("@/")) {
    const resolvedPath = resolveWithExtensions(path.join(projectRoot, request.slice(2)));
    return originalResolveFilename.call(this, resolvedPath, parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectValid(label, report, validate) {
  const result = validate(report);

  if (!result.ok) {
    fail(`${label}: expected valid report, got errors:\n${result.errors.join("\n")}`);
  }
}

function expectInvalid(label, report, validate, expectedErrorPart) {
  const result = validate(report);

  if (result.ok) {
    fail(`${label}: expected invalid report`);
  }

  if (!result.errors.some((error) => error.includes(expectedErrorPart))) {
    fail(
      `${label}: expected error containing "${expectedErrorPart}", got:\n${result.errors.join(
        "\n",
      )}`,
    );
  }
}

function buildSampleReport() {
  const {
    IPIP_NEO_120_DOMAIN_ORDER,
    IPIP_NEO_120_FACETS_BY_DOMAIN,
    IPIP_NEO_120_TEST_SLUG,
    getIpipNeo120DomainLabel,
    getIpipNeo120FacetLabel,
  } = require("../lib/assessment/ipip-neo-120-labels.ts");
  const {
    getIpipNeo120BandMeaningV2,
    getIpipNeo120DomainDefinitionV2,
    getIpipNeo120FacetDefinitionV2,
    getIpipNeo120ParticipantDisplayBandForDomainV2,
    getIpipNeo120ParticipantDisplayBandLabelForDomainV2,
    getIpipNeo120ParticipantDisplayScoreForDomainV2,
    IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");

  const band = "balanced";
  const bandLabel = getIpipNeo120BandMeaningV2(band).label;

  return {
    contract_version: "ipip_neo_120_participant_v2",
    test: {
      slug: IPIP_NEO_120_TEST_SLUG,
      name: "IPIP-NEO-120",
      locale: "bs",
    },
    meta: {
      report_type: "participant",
      generated_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      scale_hint: {
        min: 1,
        max: 5,
      },
    },
    summary: {
      headline: "Uravnotežen razvojni profil",
      overview:
        "Ovaj profil opisuje uravnotežene obrasce koji se mogu različito pokazati zavisno od konteksta.",
      badges: [
        {
          label: "Stabilan stil",
          related_domains: ["CONSCIENTIOUSNESS"],
          related_facets: ["SELF_DISCIPLINE"],
        },
        {
          label: "Kontekstualna saradnja",
          related_domains: ["AGREEABLENESS"],
          related_facets: ["COOPERATION"],
        },
        {
          label: "Razvojni fokus",
          related_domains: ["OPENNESS_TO_EXPERIENCE"],
          related_facets: ["INTELLECT"],
        },
      ],
    },
    key_patterns: [0, 1, 2].map((index) => ({
      title: `Obrazac ${index + 1}`,
      description:
        "Ovaj obrazac se može pokazati kroz fleksibilan stil, posebno kada kontekst traži prilagođavanje.",
      related_domains: ["CONSCIENTIOUSNESS"],
      related_facets: ["SELF_DISCIPLINE"],
    })),
    domains: IPIP_NEO_120_DOMAIN_ORDER.map((domainCode, domainIndex) => {
      const domainDefinition = getIpipNeo120DomainDefinitionV2(domainCode);
      const score = 3 + domainIndex * 0.1;

      return {
        domain_code: domainCode,
        label: getIpipNeo120DomainLabel(domainCode),
        participant_display_label: domainDefinition.participant_display_label,
        score,
        band,
        band_label: bandLabel,
        display_score: getIpipNeo120ParticipantDisplayScoreForDomainV2(domainCode, score),
        display_band: getIpipNeo120ParticipantDisplayBandForDomainV2(domainCode, band),
        display_band_label: getIpipNeo120ParticipantDisplayBandLabelForDomainV2(
          domainCode,
          band,
        ),
        card_title: `${domainDefinition.participant_display_label} profil`,
        summary:
          "Ovaj domen je opisan kao uravnotežen signal koji može varirati zavisno od situacije.",
        practical_signal:
          "U radu se može pokazati kroz prilagođavanje tempa i načina saradnje.",
        candidate_reflection: "Vrijedi pratiti u kojim situacijama ti ovaj stil najviše pomaže.",
        strengths: [
          "Može podržati stabilan i kontekstualan pristup.",
          "Može pomoći kada zadatak traži fleksibilnost.",
        ],
        watchouts: [
          "Vrijedi pratiti kada kontekst traži jasniji prioritet.",
          "Korisno je prepoznati situacije u kojima treba više strukture.",
        ],
        development_tip: "Postavi mali konkretan korak za praćenje ovog obrasca.",
        subdimensions: IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map(
          (facetCode, facetIndex) => {
            const facetDefinition = getIpipNeo120FacetDefinitionV2(facetCode);

            return {
              facet_code: facetCode,
              label: getIpipNeo120FacetLabel(facetCode),
              participant_display_label: facetDefinition.participant_display_label,
              score: 3 + facetIndex * 0.05,
              band,
              band_label: bandLabel,
              card_title: `${facetDefinition.participant_display_label} signal`,
              summary: "Ova poddimenzija opisuje signal koji se može pokazati kontekstualno.",
              practical_signal: "U radu se može vidjeti kroz način reagovanja na zahtjev.",
              candidate_reflection: "Primijeti kada ti ovaj obrazac pomaže u radu.",
            };
          },
        ),
      };
    }),
    strengths: [0, 1, 2, 3].map((index) => ({
      title: `Snaga ${index + 1}`,
      description:
        "Ovaj razvojni signal može pomoći kada postoji dovoljno prostora za promišljen odgovor.",
      related_domains: ["CONSCIENTIOUSNESS"],
      related_facets: ["SELF_DISCIPLINE"],
    })),
    watchouts: [0, 1, 2].map((index) => ({
      title: `Fokus ${index + 1}`,
      description:
        "Vrijedi obratiti pažnju na situacije u kojima kontekst postaje zahtjevniji.",
      related_domains: ["NEUROTICISM"],
      related_facets: ["VULNERABILITY"],
    })),
    work_style: {
      title: "Radni stil",
      paragraphs: [
        "U radu se može pokazati uravnotežen pristup zadacima i saradnji.",
        "Kada je kontekst zahtjevniji, korisno je osloniti se na jasne prioritete.",
      ],
    },
    development_recommendations: [0, 1, 2, 3].map((index) => ({
      title: `Preporuka ${index + 1}`,
      description: "Ova preporuka pomaže da obrazac bude praktično upotrebljiv u radu.",
      action: "Izaberi jedan mali korak i prati efekat tokom sedmice.",
      related_domains: ["CONSCIENTIOUSNESS"],
      related_facets: ["CAUTIOUSNESS"],
    })),
    interpretation_note: IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2.interpretation_note,
  };
}

async function main() {
  const {
    validateIpipNeo120ParticipantReportV2,
    ipipNeo120ParticipantReportV2OpenAiSchema,
  } = require("../lib/assessment/ipip-neo-120-participant-report-v2.ts");
  const {
    IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");

  if (ipipNeo120ParticipantReportV2OpenAiSchema?.additionalProperties !== false) {
    fail("OpenAI schema export is missing or malformed.");
  }

  const validReport = buildSampleReport();
  expectValid("valid sample", validReport, validateIpipNeo120ParticipantReportV2);

  const withoutSummary = clone(validReport);
  delete withoutSummary.summary;
  expectInvalid("missing summary", withoutSummary, validateIpipNeo120ParticipantReportV2, "summary");

  const wrongContract = clone(validReport);
  wrongContract.contract_version = "ipip_neo_120_participant_v1";
  expectInvalid(
    "wrong contract_version",
    wrongContract,
    validateIpipNeo120ParticipantReportV2,
    "contract_version",
  );

  const fourDomains = clone(validReport);
  fourDomains.domains = fourDomains.domains.slice(0, 4);
  expectInvalid("4 domains", fourDomains, validateIpipNeo120ParticipantReportV2, "domains");

  const wrongDomainOrder = clone(validReport);
  [wrongDomainOrder.domains[0], wrongDomainOrder.domains[1]] = [
    wrongDomainOrder.domains[1],
    wrongDomainOrder.domains[0],
  ];
  expectInvalid(
    "wrong domain order",
    wrongDomainOrder,
    validateIpipNeo120ParticipantReportV2,
    "domains[0].domain_code",
  );

  const fiveSubdimensions = clone(validReport);
  fiveSubdimensions.domains[0].subdimensions = fiveSubdimensions.domains[0].subdimensions.slice(
    0,
    5,
  );
  expectInvalid(
    "5 subdimensions",
    fiveSubdimensions,
    validateIpipNeo120ParticipantReportV2,
    "domains[0].subdimensions",
  );

  const unknownRelatedDomain = clone(validReport);
  unknownRelatedDomain.strengths[0].related_domains = ["UNKNOWN_DOMAIN"];
  expectInvalid(
    "unknown related_domain",
    unknownRelatedDomain,
    validateIpipNeo120ParticipantReportV2,
    "related_domains[0]",
  );

  const unknownRelatedFacet = clone(validReport);
  unknownRelatedFacet.watchouts[0].related_facets = ["UNKNOWN_FACET"];
  expectInvalid(
    "unknown related_facet",
    unknownRelatedFacet,
    validateIpipNeo120ParticipantReportV2,
    "related_facets[0]",
  );

  const wrongDisplayLabel = clone(validReport);
  wrongDisplayLabel.domains[0].participant_display_label = "Pogrešna labela";
  expectInvalid(
    "wrong participant_display_label",
    wrongDisplayLabel,
    validateIpipNeo120ParticipantReportV2,
    "participant_display_label",
  );

  const longDomainSummary = clone(validReport);
  longDomainSummary.domains[0].summary = "x".repeat(
    IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2["domains[].summary"].max_chars + 1,
  );
  expectInvalid(
    "long domain summary",
    longDomainSummary,
    validateIpipNeo120ParticipantReportV2,
    "domains[0].summary",
  );

  const longSubdimensionSummary = clone(validReport);
  longSubdimensionSummary.domains[0].subdimensions[0].summary = "x".repeat(
    IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2["subdimensions[].summary"].max_chars + 1,
  );
  expectInvalid(
    "long subdimension summary",
    longSubdimensionSummary,
    validateIpipNeo120ParticipantReportV2,
    "domains[0].subdimensions[0].summary",
  );

  const missingInterpretationNote = clone(validReport);
  delete missingInterpretationNote.interpretation_note;
  expectInvalid(
    "missing interpretation_note",
    missingInterpretationNote,
    validateIpipNeo120ParticipantReportV2,
    "interpretation_note",
  );

  console.info("IPIP-NEO-120 participant report V2 verification passed");
}

main().catch((error) => {
  console.error("verify-ipip-neo-120-participant-report-v2 failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
