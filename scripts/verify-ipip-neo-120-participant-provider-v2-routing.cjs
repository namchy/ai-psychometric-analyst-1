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

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function buildMockPromptInput() {
  const {
    IPIP_NEO_120_DOMAIN_ORDER,
    IPIP_NEO_120_FACETS_BY_DOMAIN,
    IPIP_NEO_120_TEST_FAMILY,
    IPIP_NEO_120_TEST_SLUG,
    getIpipNeo120DomainLabel,
    getIpipNeo120FacetLabel,
  } = require("../lib/assessment/ipip-neo-120-labels.ts");

  return {
    attempt_id: "attempt-provider-v2-routing",
    test_id: "test-ipip-neo-120",
    test_slug: IPIP_NEO_120_TEST_SLUG,
    test_name: "IPIP-NEO-120",
    test_family: IPIP_NEO_120_TEST_FAMILY,
    audience: "participant",
    locale: "bs",
    scoring_method: "average",
    prompt_version: "ipip_neo_120_participant_v1",
    scored_response_count: 120,
    scale_hint: {
      min: 1,
      max: 5,
      display_mode: "visual_with_discreet_numeric_support",
    },
    domains: IPIP_NEO_120_DOMAIN_ORDER.map((domainCode, domainIndex) => ({
      domain_code: domainCode,
      label: getIpipNeo120DomainLabel(domainCode),
      score: 4.4 - domainIndex * 0.45,
      band: domainIndex < 2 ? "higher" : domainIndex === 3 ? "lower" : "balanced",
      subdimensions: IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map(
        (facetCode, facetIndex) => ({
          facet_code: facetCode,
          label: getIpipNeo120FacetLabel(facetCode),
          score: 4.7 - domainIndex * 0.35 - facetIndex * 0.06,
          band: facetIndex < 2 ? "higher" : facetIndex > 3 ? "lower" : "balanced",
        }),
      ),
    })),
    deterministic_summary: {
      highest_domain: "EXTRAVERSION",
      lowest_domain: "OPENNESS_TO_EXPERIENCE",
      ranked_domains: [],
      top_subdimensions: [],
    },
  };
}

function buildPreparedInput() {
  const { resolveReportContract } = require("../lib/assessment/report-providers.ts");
  const promptInput = buildMockPromptInput();

  return {
    attemptId: promptInput.attempt_id,
    testSlug: promptInput.test_slug,
    promptVersion: promptInput.prompt_version,
    promptVersionId: null,
    promptTemplate: null,
    promptInput,
    reportContract: resolveReportContract(promptInput.test_slug, "participant"),
  };
}

function buildValidV1Report() {
  const {
    IPIP_NEO_120_DOMAIN_ORDER,
    IPIP_NEO_120_FACETS_BY_DOMAIN,
    getIpipNeo120DomainLabel,
    getIpipNeo120FacetLabel,
  } = require("../lib/assessment/ipip-neo-120-labels.ts");

  return {
    contract_version: "ipip_neo_120_participant_v1",
    test: {
      slug: "ipip-neo-120-v1",
      name: "IPIP-NEO-120",
      locale: "bs",
    },
    meta: {
      report_type: "participant",
      generated_at: "2026-01-01T00:00:00.000Z",
      scale_hint: {
        min: 1,
        max: 5,
        display_mode: "visual_with_discreet_numeric_support",
      },
    },
    summary: {
      headline: "Sažetak profila",
      overview: "Ovo je kratak razvojni opis profila.",
    },
    dominant_signals: ["Signal 1", "Signal 2", "Signal 3", "Signal 4", "Signal 5"],
    domains: IPIP_NEO_120_DOMAIN_ORDER.map((domainCode) => ({
      domain_code: domainCode,
      label: getIpipNeo120DomainLabel(domainCode),
      score: 3,
      band: "balanced",
      summary: "Uravnotežen opis domena.",
      strengths: ["Prva snaga.", "Druga snaga."],
      watchouts: ["Prvi fokus.", "Drugi fokus."],
      development_tip: "Kratak razvojni prijedlog.",
      subdimensions: IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map((facetCode) => ({
        facet_code: facetCode,
        label: getIpipNeo120FacetLabel(facetCode),
        score: 3,
        band: "balanced",
        summary: "Uravnotežen opis poddimenzije.",
      })),
    })),
    strengths: ["Snaga 1", "Snaga 2", "Snaga 3"],
    watchouts: ["Fokus 1", "Fokus 2", "Fokus 3"],
    development_recommendations: ["Preporuka 1", "Preporuka 2", "Preporuka 3"],
    interpretation_note: "Ovaj izvještaj je razvojna interpretacija.",
  };
}

function buildValidV2ReportFromAiInput(v2Input) {
  return {
    contract_version: "ipip_neo_120_participant_v2",
    test: {
      slug: v2Input.test_slug,
      name: v2Input.test_name,
      locale: v2Input.locale,
    },
    meta: {
      report_type: "participant",
      generated_at: "2026-01-01T00:00:00.000Z",
      scale_hint: {
        min: v2Input.scale_hint.min,
        max: v2Input.scale_hint.max,
      },
    },
    summary: {
      headline: "Uravnotežen razvojni profil",
      overview:
        "Ovaj profil opisuje razvojne signale koji se mogu različito pokazati zavisno od konteksta.",
      badges: [
        { label: "Signal jedan", related_domains: ["EXTRAVERSION"], related_facets: ["FRIENDLINESS"] },
        { label: "Signal dva", related_domains: ["AGREEABLENESS"], related_facets: ["TRUST"] },
        {
          label: "Signal tri",
          related_domains: ["CONSCIENTIOUSNESS"],
          related_facets: ["SELF_DISCIPLINE"],
        },
      ],
    },
    key_patterns: [0, 1, 2].map((index) => ({
      title: `Obrazac ${index + 1}`,
      description:
        "Ovaj obrazac opisuje kako se razvojni signali mogu pokazati u radu i saradnji.",
      related_domains: ["CONSCIENTIOUSNESS"],
      related_facets: ["SELF_DISCIPLINE"],
    })),
    domains: v2Input.domains.map((domain) => ({
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
      summary: "Ovaj domen opisuje signal koji se može pokazati zavisno od situacije.",
      practical_signal: "U radu se može vidjeti kroz ritam, izbor prioriteta i saradnju.",
      candidate_reflection: "Vrijedi pratiti kada ti ovaj obrazac najviše pomaže.",
      strengths: ["Može podržati stabilan rad.", "Može pomoći u prilagođavanju."],
      watchouts: ["Vrijedi pratiti promjenu konteksta.", "Korisno je čuvati jasne prioritete."],
      development_tip: "Odaberi jedan mali korak za praćenje ovog obrasca.",
      subdimensions: domain.subdimensions.map((subdimension) => ({
        facet_code: subdimension.facet_code,
        label: subdimension.label,
        participant_display_label: subdimension.participant_display_label,
        score: subdimension.score,
        band: subdimension.band,
        band_label: subdimension.band_label,
        card_title: `${subdimension.participant_display_label} signal`,
        summary: "Ova poddimenzija opisuje signal koji se može pokazati kontekstualno.",
        practical_signal: "U radu se može vidjeti kroz konkretan način reagovanja.",
        candidate_reflection: "Primijeti kada ti ovaj obrazac pomaže.",
      })),
    })),
    strengths: [0, 1, 2, 3].map((index) => ({
      title: `Snaga ${index + 1}`,
      description: "Ovaj signal može pomoći kada postoji dovoljno prostora za promišljen odgovor.",
      related_domains: ["CONSCIENTIOUSNESS"],
      related_facets: ["SELF_DISCIPLINE"],
    })),
    watchouts: [0, 1, 2].map((index) => ({
      title: `Fokus ${index + 1}`,
      description: "Vrijedi obratiti pažnju na situacije u kojima kontekst postaje zahtjevniji.",
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
    interpretation_note: v2Input.static_text.interpretation_note,
  };
}

async function main() {
  const previousVersion = process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION;

  try {
    const {
      getIpipNeo120ParticipantReportVersion,
      normalizeIpipNeo120ParticipantReportVersion,
    } = require("../lib/assessment/report-config.ts");
    const {
      buildIpipNeo120ParticipantV2SingleUserPrompt,
      prepareIpipNeo120ParticipantAiInputV2ForOpenAi,
      resolveIpipNeo120ParticipantOpenAiRouteForInput,
    } = require("../lib/assessment/report-provider-openai.ts");
    const {
      validateRuntimeCompletedAssessmentReport,
    } = require("../lib/assessment/report-providers.ts");
    const {
      validateIpipNeo120ParticipantAiInputV2,
    } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");
    const {
      validateIpipNeo120ParticipantReportV2,
    } = require("../lib/assessment/ipip-neo-120-participant-report-v2.ts");
    const {
      validateIpipNeo120ParticipantReportV1,
    } = require("../lib/assessment/ipip-neo-120-report-v1.ts");

    delete process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION;
    assert(getIpipNeo120ParticipantReportVersion() === "v1", "Expected default config v1.");
    assert(normalizeIpipNeo120ParticipantReportVersion("invalid") === "v1", "Expected invalid version to normalize to v1.");

    const preparedInput = buildPreparedInput();

    process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION = "v1";
    const v1Route = resolveIpipNeo120ParticipantOpenAiRouteForInput(preparedInput);
    assert(v1Route.version === "v1", "Expected V1 route when switch is v1.");
    assert(v1Route.schemaName === "ipip-neo-120-participant-v1", "Expected V1 schema name.");

    process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION = "v2";
    const v2Route = resolveIpipNeo120ParticipantOpenAiRouteForInput(preparedInput);
    assert(v2Route.version === "v2", "Expected V2 route when switch is v2.");
    assert(v2Route.schemaName === "ipip-neo-120-participant-v2", "Expected V2 schema name.");

    const v2Input = prepareIpipNeo120ParticipantAiInputV2ForOpenAi(preparedInput);
    const v2InputValidation = validateIpipNeo120ParticipantAiInputV2(v2Input);
    assert(v2InputValidation.ok, "Expected V2 AI input validation to pass.");
    assert(
      v2Input.domains[0]?.display_label === "Ekstraverzija",
      "Expected EXTRAVERSION display_label in V2 AI input.",
    );
    assert(
      v2Input.domains[0]?.narrative_label === "ekstraverzija",
      "Expected EXTRAVERSION narrative_label in V2 AI input.",
    );
    assert(
      v2Input.domains[1]?.display_label === "Spremnost na saradnju",
      "Expected AGREEABLENESS display_label in V2 AI input.",
    );
    assert(
      v2Input.domains[1]?.narrative_label === "spremnost na saradnju",
      "Expected AGREEABLENESS narrative_label in V2 AI input.",
    );

    const singlePromptPayload = JSON.parse(
      buildIpipNeo120ParticipantV2SingleUserPrompt(preparedInput),
    );
    assert(
      singlePromptPayload.instructions.label_usage_rule.includes("display_label") &&
        singlePromptPayload.instructions.label_usage_rule.includes("narrative_label"),
      "Expected V2 single prompt to distinguish display_label and narrative_label.",
    );
    assert(
      singlePromptPayload.instructions.bosnian_capitalization_rule.includes(
        "must not be capitalized in the middle of a sentence",
      ),
      "Expected V2 single prompt to contain Bosnian capitalization rule.",
    );
    assert(
      singlePromptPayload.input.domains.every(
        (domain) =>
          typeof domain.display_label === "string" &&
          typeof domain.narrative_label === "string",
      ),
      "Expected every V2 input domain to include display_label and narrative_label.",
    );

    const v2Report = buildValidV2ReportFromAiInput(v2Input);
    const v2ReportValidation = validateIpipNeo120ParticipantReportV2(v2Report);
    assert(v2ReportValidation.ok, "Expected V2 report validation to pass.");

    const runtimeV2Validation = validateRuntimeCompletedAssessmentReport(v2Report, {
      testSlug: "ipip-neo-120-v1",
      audience: "participant",
    });
    assert(runtimeV2Validation.ok, "Expected runtime validation to accept V2 report snapshot.");

    const v1ReportValidation = validateIpipNeo120ParticipantReportV1(buildValidV1Report());
    assert(v1ReportValidation.ok, "Expected V1 validation to still pass for V1 sample.");

    console.info("IPIP-NEO-120 participant provider V2 routing verification passed");
  } finally {
    if (previousVersion === undefined) {
      delete process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION;
    } else {
      process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION = previousVersion;
    }
  }
}

main().catch((error) => {
  console.error("verify-ipip-neo-120-participant-provider-v2-routing failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
