const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;

    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
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
    return originalResolveFilename.call(
      this,
      resolveWithExtensions(path.join(projectRoot, request.slice(2))),
      parent,
      isMain,
      options,
    );
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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildPromptInput(locale) {
  const {
    IPIP_NEO_120_DOMAIN_ORDER,
    IPIP_NEO_120_FACETS_BY_DOMAIN,
    IPIP_NEO_120_TEST_FAMILY,
    IPIP_NEO_120_TEST_SLUG,
    getIpipNeo120DomainLabel,
    getIpipNeo120FacetLabel,
  } = require("../lib/assessment/ipip-neo-120-labels.ts");

  return {
    attempt_id: `attempt-ipip-v2-bhs-${locale ?? "null"}`,
    test_id: "test-ipip-neo-120",
    test_slug: IPIP_NEO_120_TEST_SLUG,
    test_name: "IPIP-NEO-120",
    test_family: IPIP_NEO_120_TEST_FAMILY,
    audience: "participant",
    locale,
    scoring_method: "average",
    prompt_version: "ipip_neo_120_participant_v2_bhs_language_policy",
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

function buildPreparedInput(locale) {
  const { resolveReportContract } = require("../lib/assessment/report-providers.ts");
  const promptInput = buildPromptInput(locale);

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

function buildV2Input(locale = "bs") {
  const {
    buildIpipNeo120ParticipantAiInputV2,
    validateIpipNeo120ParticipantAiInputV2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");
  const input = buildIpipNeo120ParticipantAiInputV2(buildPromptInput(locale));
  const validation = validateIpipNeo120ParticipantAiInputV2(input);

  assert.equal(validation.ok, true, validation.ok ? "" : validation.errors.join(" | "));
  return validation.value;
}

function buildSingleOutputReport(v2Input) {
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
      headline: "Ti ovaj snapshot možeš čitati kao moderate razvojni pregled.",
      overview:
        "Ovaj snapshot pokazuje high signal koji je najkorisnije povezati sa stvarnim kontekstom rada i saradnje.",
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
        "Ovaj obrazac pokazuje kako se signal može pojaviti kroz konkretan radni kontekst bez mijenjanja canonical podataka.",
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
      summary: `Ti ovaj snapshot možeš čitati kao high signal koji se za ${domain.participant_display_label.toLowerCase()} pokazuje kroz konkretan kontekst.`,
      practical_signal:
        "U radu se može vidjeti kroz ritam, izbor prioriteta i kvalitet saradnje u konkretnim situacijama.",
      candidate_reflection: `Najkorisnije je da ${domain.participant_display_label.toLowerCase()} pratiš kroz situacije u kojima ti ovaj signal pomaže.`,
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
        candidate_reflection: `Najkorisnije je da ${subdimension.participant_display_label.toLowerCase()} pratiš kroz praksu.`,
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
        "Ti ovaj snapshot možeš čitati kao signal koji traži miran i konkretan radni kontekst.",
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

function buildOverviewSegment(v2Input) {
  return {
    segment_type: "overview",
    contract_version: "ipip_neo_120_participant_v2_segment_overview",
    summary: {
      headline: "Ti ovaj snapshot možeš čitati kao overview signal.",
      overview:
        "Ovaj snapshot daje high pregled koji treba povezati sa kontekstom rada i saradnje.",
      badges: [
        { label: "Izražen signal", related_domains: ["EXTRAVERSION"], related_facets: ["FRIENDLINESS"] },
        { label: "Saradnja", related_domains: ["AGREEABLENESS"], related_facets: ["TRUST"] },
        { label: "Razvojni fokus", related_domains: ["CONSCIENTIOUSNESS"], related_facets: ["SELF_DISCIPLINE"] },
      ],
    },
    key_patterns: [0, 1, 2].map((index) => ({
      title: `Obrazac ${index + 1}`,
      description: "Ovaj obrazac povezuje signale sa konkretnim kontekstom rada.",
      related_domains: v2Input.deterministic_summary.ranked_domains.slice(0, 2),
      related_facets: v2Input.deterministic_summary.top_subdimensions.slice(0, 2),
    })),
    work_style: {
      title: "Radni stil",
      paragraphs: [
        "Ti ovaj snapshot možeš čitati kao pregled radnog stila kroz kontekst.",
        "Najkorisnije ga je povezati sa stvarnim situacijama.",
      ],
    },
  };
}

function buildDomainSegment(domain) {
  return {
    segment_type: "domain",
    contract_version: "ipip_neo_120_participant_v2_segment_domain",
    domain_code: domain.domain_code,
    domain: {
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
      summary: `Ti ovaj snapshot možeš čitati kao high signal za ${domain.participant_display_label.toLowerCase()} u konkretnim situacijama.`,
      practical_signal: `${domain.participant_display_label} može se pratiti kroz konkretan radni obrazac.`,
      candidate_reflection: `Najkorisnije je da ${domain.participant_display_label.toLowerCase()} pratiš kroz jasne situacije u kojima ti ovaj signal pomaže.`,
      strengths: [
        `${domain.participant_display_label} može biti koristan razvojni oslonac.`,
        "Korisno je povezati signal sa stvarnim ponašanjem.",
      ],
      watchouts: [
        "Vrijedi pratiti kako se signal mijenja kroz kontekst.",
        "Korisno je primijetiti kada tempo ili zahtjevi postanu drugačiji.",
      ],
      development_tip: "Odaberi jednu situaciju u kojoj ćeš pratiti ovaj obrazac.",
      subdimensions: domain.subdimensions.map((subdimension) => ({
        facet_code: subdimension.facet_code,
        label: subdimension.label,
        participant_display_label: subdimension.participant_display_label,
        score: subdimension.score,
        band: subdimension.band,
        band_label: subdimension.band_label,
        card_title: `${subdimension.participant_display_label} signal`,
        summary: `${subdimension.participant_display_label} je prikazana kao high signal u ovom snapshot prikazu.`,
        practical_signal: "U radu se može pratiti kroz konkretan način reagovanja.",
        candidate_reflection: `Najkorisnije je da ${subdimension.participant_display_label.toLowerCase()} pratiš kroz praksu.`,
      })),
    },
  };
}

function buildPracticalSegment(v2Input) {
  return {
    segment_type: "practical",
    contract_version: "ipip_neo_120_participant_v2_segment_practical",
    strengths: [0, 1, 2, 3].map((index) => ({
      title: `Snaga ${index + 1}`,
      description: "Ovaj signal pomaže da razvojni obrazac povežeš sa praksom.",
      related_domains: v2Input.deterministic_summary.ranked_domains.slice(0, 1),
      related_facets: v2Input.deterministic_summary.top_subdimensions.slice(0, 1),
    })),
    watchouts: [0, 1, 2].map((index) => ({
      title: `Oprez ${index + 1}`,
      description: "Vrijedi pratiti kontekst u kojem se ovaj signal pokazuje.",
      related_domains: v2Input.deterministic_summary.lowest_domains.slice(0, 1),
      related_facets: v2Input.deterministic_summary.lowest_subdimensions.slice(0, 1),
    })),
    development_recommendations: [0, 1, 2, 3].map((index) => ({
      title: `Preporuka ${index + 1}`,
      description: "Ova preporuka pomaže da rezultat pretvoriš u mali razvojni korak.",
      action: "Izaberi jednu situaciju i zabilježi šta se promijenilo.",
      related_domains: v2Input.deterministic_summary.ranked_domains.slice(0, 1),
      related_facets: v2Input.deterministic_summary.top_subdimensions.slice(0, 1),
    })),
    interpretation_note: v2Input.static_text.interpretation_note,
  };
}

function buildFetchResponse(jsonPayload) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [
          {
            message: {
              content: JSON.stringify(jsonPayload),
            },
          },
        ],
      };
    },
  };
}

async function main() {
  const previousVersion = process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION;
  const previousMode = process.env.IPIP_NEO_120_PARTICIPANT_GENERATION_MODE;
  const originalFetch = global.fetch;

  try {
    const {
      validateStructuredReport,
      createOpenAiReportProvider,
      prepareIpipNeo120ParticipantAiInputV2ForOpenAi,
    } = require("../lib/assessment/report-provider-openai.ts");
    const {
      validateIpipNeo120ParticipantReportV2,
      isDeclarativeCandidateReflection,
    } = require("../lib/assessment/ipip-neo-120-participant-report-v2.ts");

    process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION = "v2";
    process.env.IPIP_NEO_120_PARTICIPANT_GENERATION_MODE = "single";

    const bsInput = buildPreparedInput("bs");
    const v2Input = buildV2Input("bs");
    const rawSingleReport = buildSingleOutputReport(v2Input);
    const validatedSingleReport = validateStructuredReport(clone(rawSingleReport), bsInput);

    assert.equal(validatedSingleReport.summary.headline.includes("snapshot"), true);
    assert.equal(validatedSingleReport.summary.overview.includes("high"), true);
    assert.equal(validatedSingleReport.work_style.paragraphs[0].includes("snapshot"), true);
    assert.equal(validatedSingleReport.domains[0].summary.includes("high"), true);
    assert.equal(validatedSingleReport.domains[0].candidate_reflection.includes("ti"), true);
    assert.equal(
      validatedSingleReport.domains[0].participant_display_label,
      rawSingleReport.domains[0].participant_display_label,
    );
    assert.equal(validatedSingleReport.domains[0].display_score, rawSingleReport.domains[0].display_score);
    assert.equal(validatedSingleReport.domains[0].display_band, rawSingleReport.domains[0].display_band);
    assert.equal(
      validatedSingleReport.domains[0].display_band_label,
      rawSingleReport.domains[0].display_band_label,
    );
    assert.equal(validatedSingleReport.domains[0].band_label, rawSingleReport.domains[0].band_label);
    assert.equal(validatedSingleReport.meta.report_type, rawSingleReport.meta.report_type);
    assert.equal(validatedSingleReport.test.locale, rawSingleReport.test.locale);
    assert.equal(
      isDeclarativeCandidateReflection(validatedSingleReport.domains[0].candidate_reflection),
      true,
    );

    for (const locale of ["hr", "sr", "en", "unknown", "de"]) {
      const noPolicyInput = buildPreparedInput(locale);
      const noPolicyRawReport = clone(rawSingleReport);
      noPolicyRawReport.test.locale =
        prepareIpipNeo120ParticipantAiInputV2ForOpenAi(noPolicyInput).locale;
      const noPolicyReport = validateStructuredReport(noPolicyRawReport, noPolicyInput);
      assert.equal(
        noPolicyReport.summary.headline.includes("snapshot"),
        true,
        `Expected no-policy locale ${String(locale)} to preserve snapshot.`,
      );
      assert.equal(
        noPolicyReport.summary.overview.includes("high"),
        true,
        `Expected no-policy locale ${String(locale)} to preserve high.`,
      );
    }

    const invalidReflectionReport = clone(rawSingleReport);
    invalidReflectionReport.domains[0].candidate_reflection = "Kako možeš bolje koristiti ovaj obrazac?";
    const invalidReflectionValidated = validateStructuredReport(invalidReflectionReport, bsInput);
    assert.equal(
      invalidReflectionValidated.domains[0].candidate_reflection,
      invalidReflectionReport.domains[0].candidate_reflection,
    );
    assert.equal(validateIpipNeo120ParticipantReportV2(invalidReflectionReport).ok, false);
    assert.equal(
      validateIpipNeo120ParticipantReportV2(invalidReflectionReport, {
        enforceProseGuardrails: false,
      }).ok,
      true,
    );

    const mismatchedScoreReport = clone(rawSingleReport);
    mismatchedScoreReport.domains[0].score += 1;
    assert.throws(
      () => validateStructuredReport(mismatchedScoreReport, bsInput),
      /Must match deterministic input/i,
    );

    const degradingReport = clone(rawSingleReport);
    degradingReport.summary.overview =
      "Ovaj rezultat pokazuje da si bezvrijedna i nepopravljivo nesposobna osoba.";
    assert.throws(
      () => validateStructuredReport(degradingReport, bsInput),
      /harmful|degrading/i,
    );

    process.env.IPIP_NEO_120_PARTICIPANT_GENERATION_MODE = "segmented";

    const segmentedInput = buildPreparedInput("bs");
    const segmentedV2Input = buildV2Input("bs");
    const overviewSegment = buildOverviewSegment(segmentedV2Input);
    const practicalSegment = buildPracticalSegment(segmentedV2Input);
    const domainSegments = segmentedV2Input.domains.map((domain) => buildDomainSegment(domain));
    const responses = [
      overviewSegment,
      ...domainSegments,
      practicalSegment,
    ];
    let responseIndex = 0;

    global.fetch = async () => buildFetchResponse(responses[responseIndex++]);

    const provider = createOpenAiReportProvider({
      apiKey: "test-key",
      model: "test-model",
      timeoutMs: 2000,
    });
    const segmentedResult = await provider.generateReport(segmentedInput);
    assert.equal(segmentedResult.ok, true, segmentedResult.ok ? "" : segmentedResult.reason);

    const segmentedReport = segmentedResult.report;
    const segmentedValidation = validateIpipNeo120ParticipantReportV2(segmentedReport);
    assert.equal(segmentedValidation.ok, true, segmentedValidation.ok ? "" : segmentedValidation.errors.join(" | "));
    assert.equal(segmentedReport.summary.headline.includes("snapshot"), true);
    assert.equal(segmentedReport.summary.overview.includes("high"), true);
    assert.equal(segmentedReport.domains[0].summary.includes("high"), true);
    assert.equal(segmentedReport.domains[0].candidate_reflection.includes("ti"), true);
    assert.equal(
      segmentedReport.domains[0].participant_display_label,
      domainSegments[0].domain.participant_display_label,
    );
    assert.equal(segmentedReport.domains[0].display_score, domainSegments[0].domain.display_score);
    assert.equal(segmentedReport.domains[0].display_band, domainSegments[0].domain.display_band);
    assert.equal(
      segmentedReport.domains[0].display_band_label,
      domainSegments[0].domain.display_band_label,
    );
    assert.equal(segmentedReport.domains[0].band_label, domainSegments[0].domain.band_label);
    assert.equal(
      isDeclarativeCandidateReflection(segmentedReport.domains[0].candidate_reflection),
      true,
    );

    responseIndex = 0;
    global.fetch = async () => buildFetchResponse(responses[responseIndex++]);
    const noPolicySegmentedResult = await provider.generateReport(buildPreparedInput("en"));
    assert.equal(noPolicySegmentedResult.ok, true, noPolicySegmentedResult.ok ? "" : noPolicySegmentedResult.reason);
    assert.equal(noPolicySegmentedResult.report.summary.headline.includes("snapshot"), true);
    assert.equal(noPolicySegmentedResult.report.domains[0].summary.includes("high"), true);

    console.log("test-ipip-participant-v2-bhs-language-policy: ok");
  } finally {
    if (previousVersion === undefined) {
      delete process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION;
    } else {
      process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION = previousVersion;
    }

    if (previousMode === undefined) {
      delete process.env.IPIP_NEO_120_PARTICIPANT_GENERATION_MODE;
    } else {
      process.env.IPIP_NEO_120_PARTICIPANT_GENERATION_MODE = previousMode;
    }

    global.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error("test-ipip-participant-v2-bhs-language-policy failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
