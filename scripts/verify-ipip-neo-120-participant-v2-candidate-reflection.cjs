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

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
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
    attempt_id: "attempt-v2-candidate-reflection",
    test_id: "test-ipip-neo-120",
    test_slug: IPIP_NEO_120_TEST_SLUG,
    test_name: "IPIP-NEO-120",
    test_family: IPIP_NEO_120_TEST_FAMILY,
    audience: "participant",
    locale: "bs",
    scoring_method: "average",
    prompt_version: "ipip_neo_120_participant_v2_candidate_reflection",
    scored_response_count: 120,
    scale_hint: {
      min: 1,
      max: 5,
      display_mode: "visual_with_discreet_numeric_support",
    },
    domains: IPIP_NEO_120_DOMAIN_ORDER.map((domainCode, domainIndex) => ({
      domain_code: domainCode,
      label: getIpipNeo120DomainLabel(domainCode),
      score: 4.3 - domainIndex * 0.3,
      band: domainIndex < 2 ? "higher" : domainIndex === 3 ? "lower" : "balanced",
      subdimensions: IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map((facetCode, facetIndex) => ({
        facet_code: facetCode,
        label: getIpipNeo120FacetLabel(facetCode),
        score: 4.5 - domainIndex * 0.25 - facetIndex * 0.07,
        band: facetIndex < 2 ? "higher" : facetIndex > 3 ? "lower" : "balanced",
      })),
    })),
    deterministic_summary: {
      highest_domain: "EXTRAVERSION",
      lowest_domain: "NEUROTICISM",
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

function buildValidV2Report(v2Input) {
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
        "Ovaj izvještaj opisuje razvojne signale koji se mogu različito pokazati zavisno od konteksta.",
      badges: [
        { label: "Signal jedan", related_domains: ["EXTRAVERSION"], related_facets: ["FRIENDLINESS"] },
        { label: "Signal dva", related_domains: ["AGREEABLENESS"], related_facets: ["TRUST"] },
        { label: "Signal tri", related_domains: ["CONSCIENTIOUSNESS"], related_facets: ["SELF_DISCIPLINE"] },
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
      card_title: `${domain.participant_display_label} profil`,
      summary: "Ovaj domen opisuje signal koji se može pokazati zavisno od situacije.",
      practical_signal: "U radu se može vidjeti kroz ritam, izbor prioriteta i saradnju.",
      candidate_reflection:
        "Najkorisnije je kada ovaj obrazac koristiš uz jasan kontekst i svjesno prilagođavanje situaciji.",
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
        candidate_reflection:
          "Najkorisnije je da ovaj signal pratiš kroz stvarne situacije i svjesno prilagođavanje kontekstu.",
      })),
    })),
    strengths: [0, 1, 2, 3].map((index) => ({
      title: `Snaga ${index + 1}`,
      description: "Ovaj signal može pomoći kada postoji dovoljno prostora za promišljen odgovor.",
      related_domains: ["CONSCIENTIOUSNESS"],
      related_facets: ["SELF_DISCIPLINE"],
    })),
    watchouts: [0, 1, 2].map((index) => ({
      title: `Tačka opreza ${index + 1}`,
      description: "Vrijedi pratiti kako se isti obrazac mijenja kada je kontekst zahtjevniji.",
      related_domains: ["NEUROTICISM"],
      related_facets: ["ANXIETY"],
    })),
    work_style: {
      title: "Radni stil",
      paragraphs: [
        "U radu se može vidjeti balans između strukture, saradnje i ritma koji zavisi od konkretnog konteksta.",
        "Najkorisnije je posmatrati kako se ovaj profil pokazuje u stvarnim zadacima, odnosima i pritisku.",
      ],
    },
    development_recommendations: [0, 1, 2, 3].map((index) => ({
      title: `Preporuka ${index + 1}`,
      description: "Mali razvojni korak pomaže da obrazac bolje povežeš sa stvarnim ponašanjem.",
      action: "Odaberi jednu situaciju u kojoj ćeš svjesno pratiti ovaj signal.",
      related_domains: ["OPENNESS_TO_EXPERIENCE"],
      related_facets: ["LIBERALISM"],
    })),
    interpretation_note: {
      title: "Interpretacijska napomena",
      text: require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts")
        .IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2.interpretation_note.text,
    },
  };
}

async function main() {
  const {
    buildIpipNeo120ParticipantAiInputV2,
    IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");
  const {
    isDeclarativeCandidateReflection,
    validateIpipNeo120ParticipantReportV2,
  } = require("../lib/assessment/ipip-neo-120-participant-report-v2.ts");
  const {
    validateIpipNeo120ParticipantReportV2DomainSegment,
  } = require("../lib/assessment/ipip-neo-120-participant-report-v2-segments.ts");
  const { mockReportProvider } = require("../lib/assessment/report-provider-mock.ts");
  const providerPromptSource = fs.readFileSync(
    path.join(projectRoot, "lib/assessment/report-provider-openai.ts"),
    "utf8",
  );
  const segmentedSmokePromptSource = fs.readFileSync(
    path.join(projectRoot, "scripts/verify-ipip-neo-120-participant-v2-openai-segmented-smoke.cjs"),
    "utf8",
  );

  for (const source of [providerPromptSource, segmentedSmokePromptSource]) {
    assert(
      source.includes("candidate_reflection is NOT a question"),
      "Prompt should explicitly say candidate_reflection is NOT a question.",
    );
    assert(
      source.includes("Treat candidate_reflection as a candidate_takeaway sentence"),
      "Prompt should explicitly treat candidate_reflection as a candidate_takeaway sentence.",
    );
    assert(
      source.includes("Takeaway:"),
      "Prompt should contain the Takeaway marker guidance.",
    );
    assert(
      source.includes("Do not write self-reflection prompts"),
      "Prompt should explicitly forbid self-reflection prompts.",
    );
    assert(
      source.includes("NEUROTICISM subdimensions"),
      "Prompt should contain the NEUROTICISM subdimensions rule.",
    );
  }

  const preparedInput = buildPreparedInput();
  const v2Input = buildIpipNeo120ParticipantAiInputV2(preparedInput.promptInput);
  const validReport = buildValidV2Report(v2Input);

  assert(
    isDeclarativeCandidateReflection(validReport.domains[0].candidate_reflection),
    "Declarative candidate_reflection helper should accept a valid sentence.",
  );

  const validReportResult = validateIpipNeo120ParticipantReportV2(validReport);
  assert(validReportResult.ok, "Valid V2 report with declarative candidate_reflection should pass.");

  const domainQuestionReport = structuredClone(validReport);
  domainQuestionReport.domains[0].candidate_reflection = "Kako možeš ovu osobinu bolje koristiti u radu?";
  const domainQuestionResult = validateIpipNeo120ParticipantReportV2(domainQuestionReport);
  assert(!domainQuestionResult.ok, "Question-form domain candidate_reflection should fail.");
  assert(
    domainQuestionResult.errors.some((error) =>
      error.includes("domains[0].candidate_reflection: candidate_reflection must be a declarative sentence, not a question"),
    ),
    "Domain candidate_reflection failure should mention declarative sentence rule.",
  );

  const domainQuestionMarkReport = structuredClone(validReport);
  domainQuestionMarkReport.domains[0].candidate_reflection = "Ovo vrijedi pratiti?";
  const domainQuestionMarkResult = validateIpipNeo120ParticipantReportV2(domainQuestionMarkReport);
  assert(!domainQuestionMarkResult.ok, "Question-mark domain candidate_reflection should fail.");

  const subdimensionQuestionReport = structuredClone(validReport);
  subdimensionQuestionReport.domains[0].subdimensions[0].candidate_reflection = "Ovo vrijedi pratiti?";
  const subdimensionQuestionResult = validateIpipNeo120ParticipantReportV2(subdimensionQuestionReport);
  assert(!subdimensionQuestionResult.ok, "Question-mark subdimension candidate_reflection should fail.");

  const daLiReport = structuredClone(validReport);
  daLiReport.domains[0].candidate_reflection = "Da li ovu osobinu koristiš svjesno.";
  const daLiResult = validateIpipNeo120ParticipantReportV2(daLiReport);
  assert(!daLiResult.ok, "Da li starter should fail candidate_reflection validation.");

  const validDomainSegment = {
    segment_type: "domain",
    contract_version: "ipip_neo_120_participant_v2_segment_domain",
    domain_code: validReport.domains[0].domain_code,
    domain: validReport.domains[0],
  };
  const validDomainSegmentResult = validateIpipNeo120ParticipantReportV2DomainSegment(
    validDomainSegment,
    validReport.domains[0].domain_code,
  );
  assert(validDomainSegmentResult.ok, "Declarative domain segment should pass validation.");

  const invalidDomainSegment = structuredClone(validDomainSegment);
  invalidDomainSegment.domain.candidate_reflection = "Kako možeš ovu osobinu bolje koristiti u radu?";
  const invalidDomainSegmentResult = validateIpipNeo120ParticipantReportV2DomainSegment(
    invalidDomainSegment,
    validReport.domains[0].domain_code,
  );
  assert(!invalidDomainSegmentResult.ok, "Question-form domain segment candidate_reflection should fail.");

  const invalidSubdimensionSegment = structuredClone(validDomainSegment);
  invalidSubdimensionSegment.domain.subdimensions[0].candidate_reflection = "Da li ovaj signal koristiš dovoljno svjesno.";
  const invalidSubdimensionSegmentResult = validateIpipNeo120ParticipantReportV2DomainSegment(
    invalidSubdimensionSegment,
    validReport.domains[0].domain_code,
  );
  assert(!invalidSubdimensionSegmentResult.ok, "Question-form subdimension segment candidate_reflection should fail.");

  process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION = "v2";
  const resolved = await mockReportProvider.generateReport(preparedInput);
  assert(resolved.ok, resolved.ok ? "Expected mock V2 report." : resolved.reason);

  const mockReport = resolved.report;
  assert(
    mockReport.contract_version === "ipip_neo_120_participant_v2",
    "Mock V2 generator should return V2 contract.",
  );

  for (const domain of mockReport.domains) {
    assert(
      !domain.candidate_reflection.trim().endsWith("?"),
      `Mock domain candidate_reflection should not end with ?: ${domain.domain_code}`,
    );
    assert(
      isDeclarativeCandidateReflection(domain.candidate_reflection),
      `Mock domain candidate_reflection should be declarative: ${domain.domain_code}`,
    );

    for (const subdimension of domain.subdimensions) {
      assert(
        !subdimension.candidate_reflection.trim().endsWith("?"),
        `Mock subdimension candidate_reflection should not end with ?: ${subdimension.facet_code}`,
      );
      assert(
        isDeclarativeCandidateReflection(subdimension.candidate_reflection),
        `Mock subdimension candidate_reflection should be declarative: ${subdimension.facet_code}`,
      );
    }
  }

  assert(
    mockReport.interpretation_note.text ===
      IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2.interpretation_note.text,
    "Mock report should still keep static interpretation note.",
  );

  console.info("IPIP-NEO-120 participant V2 candidate_reflection verification passed");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
