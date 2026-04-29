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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function expectInvalid(label, result, expectedText) {
  assert(!result.ok, `${label}: expected invalid result.`);
  assert(
    result.errors.some((error) => error.includes(expectedText)),
    `${label}: expected error containing "${expectedText}", got ${result.errors.join(" | ")}`,
  );
}

function buildPromptInput() {
  const {
    IPIP_NEO_120_DOMAIN_ORDER,
    IPIP_NEO_120_FACETS_BY_DOMAIN,
    IPIP_NEO_120_TEST_FAMILY,
    IPIP_NEO_120_TEST_SLUG,
    getIpipNeo120DomainLabel,
    getIpipNeo120FacetLabel,
  } = require("../lib/assessment/ipip-neo-120-labels.ts");

  const domainFixtures = {
    EXTRAVERSION: { score: 4, band: "higher" },
    AGREEABLENESS: { score: 3, band: "balanced" },
    CONSCIENTIOUSNESS: { score: 5, band: "higher" },
    NEUROTICISM: { score: 2, band: "lower" },
    OPENNESS_TO_EXPERIENCE: { score: 1, band: "lower" },
  };

  return {
    attempt_id: "verify-neuro-display",
    test_id: "test-ipip-neo-120",
    test_slug: IPIP_NEO_120_TEST_SLUG,
    test_name: "IPIP-NEO-120",
    test_family: IPIP_NEO_120_TEST_FAMILY,
    audience: "participant",
    locale: "bs",
    scoring_method: "average",
    prompt_version: "ipip_neo_120_participant_v2_neuro_display",
    scored_response_count: 120,
    scale_hint: {
      min: 1,
      max: 5,
      display_mode: "visual_with_discreet_numeric_support",
    },
    domains: IPIP_NEO_120_DOMAIN_ORDER.map((domainCode) => ({
      domain_code: domainCode,
      label: getIpipNeo120DomainLabel(domainCode),
      score: domainFixtures[domainCode].score,
      band: domainFixtures[domainCode].band,
      subdimensions: IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map((facetCode, facetIndex) => ({
        facet_code: facetCode,
        label: getIpipNeo120FacetLabel(facetCode),
        score: Math.max(1, Math.min(5, domainFixtures[domainCode].score - (facetIndex % 2) * 0.2)),
        band: facetIndex < 2 ? "higher" : facetIndex < 4 ? "balanced" : "lower",
      })),
    })),
    deterministic_summary: {
      highest_domain: "CONSCIENTIOUSNESS",
      lowest_domain: "OPENNESS_TO_EXPERIENCE",
      ranked_domains: [],
      top_subdimensions: [],
    },
  };
}

function buildAiInput() {
  const {
    buildIpipNeo120ParticipantAiInputV2,
    validateIpipNeo120ParticipantAiInputV2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");
  const input = buildIpipNeo120ParticipantAiInputV2(buildPromptInput());
  const validation = validateIpipNeo120ParticipantAiInputV2(input);

  assert(validation.ok, validation.ok ? "Expected valid AI input." : validation.errors.join(" | "));
  return validation.value;
}

function buildValidDomainSegment(domain) {
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
      summary: `${domain.participant_display_label} je opisan kroz participant display pravila uz canonical snapshot.`,
      practical_signal: `${domain.participant_display_label} možeš pratiti kroz konkretne situacije u radu i svakodnevnici.`,
      candidate_reflection: `Najkorisnije je da ${domain.participant_display_label.toLowerCase()} pratiš kroz konkretne situacije.`,
      strengths: [
        `${domain.participant_display_label} može biti stabilan razvojni oslonac u odgovarajućem kontekstu.`,
        "Korisno je ovaj signal tumačiti uz stvarne situacije i ponašanja.",
      ],
      watchouts: [
        "Vrijedi primijetiti kada kontekst pojača ili utiša ovaj signal.",
        "Najkorisnije je rezultat povezati sa stvarnim ponašanjem, ne sa etiketom.",
      ],
      development_tip: "Odaberi jednu situaciju u kojoj ćeš svjesno pratiti ovaj obrazac.",
      subdimensions: domain.subdimensions.map((subdimension) => ({
        facet_code: subdimension.facet_code,
        label: subdimension.label,
        participant_display_label: subdimension.participant_display_label,
        score: subdimension.score,
        band: subdimension.band,
        band_label: subdimension.band_label,
        card_title: `${subdimension.participant_display_label} signal`,
        summary: `${subdimension.participant_display_label} ostaje canonical poddimenzija u V2 prikazu.`,
        practical_signal: "Ovaj signal vrijedi pratiti kroz konkretne obrasce ponašanja.",
        candidate_reflection: `Najkorisnije je da ${subdimension.participant_display_label.toLowerCase()} pratiš kroz praksu.`,
      })),
    },
  };
}

function buildValidReport(input) {
  const {
    IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");

  return {
    contract_version: "ipip_neo_120_participant_v2",
    test: {
      slug: input.test_slug,
      name: input.test_name,
      locale: input.locale,
    },
    meta: {
      report_type: "participant",
      generated_at: new Date().toISOString(),
      scale_hint: {
        min: input.scale_hint.min,
        max: input.scale_hint.max,
      },
    },
    summary: {
      headline: "Participant display provjera",
      overview:
        "Ovaj izvještaj služi za provjeru da canonical score ostaje netaknut, dok participant-facing display polja ispravno preusmjeravaju prikaz domene neuroticizma.",
      badges: [
        { label: "Prikaz domena", related_domains: ["EXTRAVERSION"], related_facets: ["FRIENDLINESS"] },
        { label: "Stabilnost", related_domains: ["NEUROTICISM"], related_facets: ["ANXIETY"] },
        { label: "Provjera", related_domains: ["CONSCIENTIOUSNESS"], related_facets: ["SELF_DISCIPLINE"] },
      ],
    },
    key_patterns: [
      {
        title: "Canonical score",
        description: "Score i band ostaju canonical vrijednosti i ne mijenjaju scoring model niti storage format.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["ANXIETY"],
      },
      {
        title: "Participant display",
        description: "Display polja služe samo za participant-facing domain prikaz i ne dodaju se poddimenzijama.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["VULNERABILITY"],
      },
      {
        title: "Direktni domeni",
        description: "Za direktne domene display vrijednosti ostaju jednake canonical vrijednostima.",
        related_domains: ["EXTRAVERSION", "AGREEABLENESS"],
        related_facets: ["FRIENDLINESS", "TRUST"],
      },
    ],
    domains: input.domains.map((domain) => buildValidDomainSegment(domain).domain),
    strengths: [
      {
        title: "Stabilan contract",
        description: "Domain-level display polja čine participant prikaz semantički tačnim bez promjene canonical scoringa.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["ANXIETY"],
      },
      {
        title: "Uski scope",
        description: "Poddimenzije ostaju canonical i ne dobijaju dodatna display polja.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["VULNERABILITY"],
      },
      {
        title: "Direktni domeni",
        description: "Ekstraverzija, ugodnost, savjesnost i otvorenost ostaju direktni i bez inversion logike.",
        related_domains: ["EXTRAVERSION", "AGREEABLENESS"],
        related_facets: ["FRIENDLINESS", "TRUST"],
      },
      {
        title: "Frontend sigurnost",
        description: "Renderer može koristiti display polja bez ručnog računanja inversion logike u UI sloju.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["ANXIETY"],
      },
    ],
    watchouts: [
      {
        title: "Pogrešan band pill",
        description: "Ako renderer koristi canonical band_label za participant prikaz neuroticizma, značenje postaje semantički pogrešno.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["ANXIETY"],
      },
      {
        title: "Pogrešan score bar",
        description: "Ako renderer koristi canonical score za participant prikaz neuroticizma, vizuelni prikaz stabilnosti ide u pogrešnom smjeru.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["VULNERABILITY"],
      },
      {
        title: "Širenje scopea",
        description: "Display polja ne treba proširivati na facete niti koristiti ih izvan participant V2 domain-level prikaza.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["ANGER"],
      },
    ],
    work_style: {
      title: "Radni stil",
      paragraphs: [
        "Ovaj verify snapshot namjerno razdvaja canonical i participant display sloj kako bi validator i renderer mogli potvrditi tačno ponašanje bez promjene scoring logike.",
        "Najvažnije je da se inversion odnosi samo na domain-level NEUROTICISM u participant V2 reportu, dok facete i svi drugi domeni ostaju canonical.",
      ],
    },
    development_recommendations: [
      {
        title: "Provjeri domain pill",
        description: "Band pill za domenu treba koristiti participant-facing display labelu i display band polje.",
        action: "Uporedi canonical i display vrijednosti samo na domeni neuroticizma.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["ANXIETY"],
      },
      {
        title: "Provjeri score bar",
        description: "Score bar za V2 domenu treba pratiti display score, ne canonical score, kada je domena neuroticizam.",
        action: "Provjeri da domena sa canonical score 2 prikazuje display score 4.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["VULNERABILITY"],
      },
      {
        title: "Ostavi facete canonical",
        description: "Poddimenzije treba ostaviti bez display polja i prikazivati njihov canonical score i band label.",
        action: "Potvrdi da facet objekti nemaju display_score, display_band ni display_band_label.",
        related_domains: ["NEUROTICISM"],
        related_facets: ["ANGER"],
      },
      {
        title: "Zaštiti direktne domene",
        description: "Direktni domeni moraju ostati identični između canonical i display sloja.",
        action: "Uporedi EXTRAVERSION score, band i label sa display poljima.",
        related_domains: ["EXTRAVERSION"],
        related_facets: ["FRIENDLINESS"],
      },
    ],
    interpretation_note: IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2.interpretation_note,
  };
}

async function main() {
  const {
    buildIpipNeo120ParticipantDomainSegmentPromptInput,
    validateIpipNeo120ParticipantReportV2DomainSegment,
  } = require("../lib/assessment/ipip-neo-120-participant-report-v2-segments.ts");
  const {
    validateIpipNeo120ParticipantReportV2,
  } = require("../lib/assessment/ipip-neo-120-participant-report-v2.ts");
  const {
    mockReportProvider,
  } = require("../lib/assessment/report-provider-mock.ts");
  const {
    resolveReportContract,
  } = require("../lib/assessment/report-providers.ts");

  const rawPromptInput = buildPromptInput();
  const input = buildAiInput();
  const extraversion = input.domains.find((domain) => domain.domain_code === "EXTRAVERSION");
  const neuroticism = input.domains.find((domain) => domain.domain_code === "NEUROTICISM");
  assert(extraversion, "Expected EXTRAVERSION input domain.");
  assert(neuroticism, "Expected NEUROTICISM input domain.");

  assert(extraversion.display_score === extraversion.score, "EXTRAVERSION display_score should equal score.");
  assert(extraversion.display_band === extraversion.band, "EXTRAVERSION display_band should equal band.");
  assert(extraversion.display_band_label === extraversion.band_label, "EXTRAVERSION display_band_label should equal band_label.");
  assert(neuroticism.display_band === "higher", "NEUROTICISM lower should map to display higher.");
  assert(neuroticism.display_score === 4, "NEUROTICISM score 2 should map to display_score 4.");

  assert(
    buildIpipNeo120ParticipantDomainSegmentPromptInput(input, "NEUROTICISM").domain.display_score === 4,
    "NEUROTICISM domain prompt input should include display_score.",
  );

  const neuroScore3 = clone(input);
  neuroScore3.domains.find((domain) => domain.domain_code === "NEUROTICISM").score = 3;
  neuroScore3.domains.find((domain) => domain.domain_code === "NEUROTICISM").band = "balanced";
  neuroScore3.domains.find((domain) => domain.domain_code === "NEUROTICISM").band_label = "Uravnoteženo";
  neuroScore3.domains.find((domain) => domain.domain_code === "NEUROTICISM").display_score = 3;
  neuroScore3.domains.find((domain) => domain.domain_code === "NEUROTICISM").display_band = "balanced";
  neuroScore3.domains.find((domain) => domain.domain_code === "NEUROTICISM").display_band_label = "Uravnoteženo";
  assert(
    neuroScore3.domains.find((domain) => domain.domain_code === "NEUROTICISM").display_score === 3,
    "NEUROTICISM score 3 should map to display_score 3.",
  );

  const neuroScore4 = clone(input);
  neuroScore4.domains.find((domain) => domain.domain_code === "NEUROTICISM").score = 4;
  neuroScore4.domains.find((domain) => domain.domain_code === "NEUROTICISM").band = "higher";
  neuroScore4.domains.find((domain) => domain.domain_code === "NEUROTICISM").band_label = "Više izraženo";
  neuroScore4.domains.find((domain) => domain.domain_code === "NEUROTICISM").display_score = 2;
  neuroScore4.domains.find((domain) => domain.domain_code === "NEUROTICISM").display_band = "lower";
  neuroScore4.domains.find((domain) => domain.domain_code === "NEUROTICISM").display_band_label = "Niže izraženo";
  assert(
    neuroScore4.domains.find((domain) => domain.domain_code === "NEUROTICISM").display_score === 2,
    "NEUROTICISM score 4 should map to display_score 2.",
  );
  assert(
    neuroScore4.domains.find((domain) => domain.domain_code === "NEUROTICISM").display_band === "lower",
    "NEUROTICISM higher should map to display lower.",
  );

  const validReport = buildValidReport(input);
  assert(validateIpipNeo120ParticipantReportV2(validReport).ok, "Valid V2 report should pass.");

  const invalidNeuroBandReport = clone(validReport);
  invalidNeuroBandReport.domains.find((domain) => domain.domain_code === "NEUROTICISM").display_band =
    "lower";
  invalidNeuroBandReport.domains.find((domain) => domain.domain_code === "NEUROTICISM").display_band_label =
    "Niže izraženo";
  expectInvalid(
    "report with canonical neuroticism display band",
    validateIpipNeo120ParticipantReportV2(invalidNeuroBandReport),
    "domains[3].display_band",
  );

  const invalidNeuroScoreReport = clone(validReport);
  invalidNeuroScoreReport.domains.find((domain) => domain.domain_code === "NEUROTICISM").display_score =
    invalidNeuroScoreReport.domains.find((domain) => domain.domain_code === "NEUROTICISM").score;
  expectInvalid(
    "report with canonical neuroticism display score",
    validateIpipNeo120ParticipantReportV2(invalidNeuroScoreReport),
    "domains[3].display_score",
  );

  const invalidDirectScoreReport = clone(validReport);
  invalidDirectScoreReport.domains.find((domain) => domain.domain_code === "EXTRAVERSION").display_score = 2;
  expectInvalid(
    "report with direct domain wrong display score",
    validateIpipNeo120ParticipantReportV2(invalidDirectScoreReport),
    "domains[0].display_score",
  );

  const invalidDirectBandReport = clone(validReport);
  invalidDirectBandReport.domains.find((domain) => domain.domain_code === "EXTRAVERSION").display_band =
    "lower";
  invalidDirectBandReport.domains.find((domain) => domain.domain_code === "EXTRAVERSION").display_band_label =
    "Niže izraženo";
  expectInvalid(
    "report with direct domain wrong display band",
    validateIpipNeo120ParticipantReportV2(invalidDirectBandReport),
    "domains[0].display_band",
  );

  const validNeuroSegment = buildValidDomainSegment(neuroticism);
  assert(
    validateIpipNeo120ParticipantReportV2DomainSegment(validNeuroSegment, "NEUROTICISM").ok,
    "Valid NEUROTICISM segment should pass.",
  );

  const invalidNeuroSegment = clone(validNeuroSegment);
  invalidNeuroSegment.domain.display_band = invalidNeuroSegment.domain.band;
  invalidNeuroSegment.domain.display_band_label = invalidNeuroSegment.domain.band_label;
  expectInvalid(
    "segment with wrong neuroticism display band",
    validateIpipNeo120ParticipantReportV2DomainSegment(invalidNeuroSegment, "NEUROTICISM"),
    "domain.display_band",
  );

  const rendererPath = path.resolve(
    __dirname,
    "../components/assessment/completed-assessment-summary.tsx",
  );
  const rendererSource = fs.readFileSync(rendererPath, "utf8");
  const componentStart = rendererSource.indexOf("function IpipNeo120ParticipantReportV2Sections");
  const componentEnd = rendererSource.indexOf("function IpipNeo120HrReportSections", componentStart);
  assert(componentStart !== -1 && componentEnd > componentStart, "Could not isolate V2 renderer body.");
  const componentBody = rendererSource.slice(componentStart, componentEnd);

  assert(componentBody.includes("domain.display_score"), "V2 renderer must use domain.display_score.");
  assert(componentBody.includes("domain.display_band_label"), "V2 renderer must use domain.display_band_label.");
  assert(componentBody.includes("domain.display_band"), "V2 renderer must use domain.display_band where relevant.");
  assert(!componentBody.includes("formatDiscreetScore(domain.score)"), "V2 domain-level score display must not use domain.score.");
  assert(!componentBody.includes("formatDiscreetScore(activeDomain.score)"), "V2 active domain score display must not use activeDomain.score.");
  assert(!componentBody.includes("{domain.band_label}"), "V2 domain-level band pill must not use domain.band_label.");
  assert(!componentBody.includes("{activeDomain.band_label}"), "V2 active domain band pill must not use activeDomain.band_label.");

  const segmentedSmokePath = path.resolve(
    __dirname,
    "../scripts/verify-ipip-neo-120-participant-v2-openai-segmented-smoke.cjs",
  );
  const segmentedSmokeSource = fs.readFileSync(segmentedSmokePath, "utf8");
  assert(
    segmentedSmokeSource.includes(
      '(domain) => `${domain.participant_display_label} · ${domain.display_band_label}`',
    ),
    "Segmented smoke sample output must use domain.display_band_label.",
  );
  assert(
    !segmentedSmokeSource.includes(
      '(domain) => `${domain.participant_display_label} · ${domain.band_label}`',
    ),
    "Segmented smoke sample output must not use domain.band_label for participant domain display.",
  );

  const previousVersion = process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION;

  try {
    process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION = "v2";

    const preparedInput = {
      attemptId: rawPromptInput.attempt_id,
      testSlug: rawPromptInput.test_slug,
      promptVersion: rawPromptInput.prompt_version,
      promptVersionId: null,
      promptTemplate: null,
      promptInput: rawPromptInput,
      reportContract: resolveReportContract(rawPromptInput.test_slug, "participant"),
    };

    const mockResult = await mockReportProvider.generateReport(preparedInput);
    assert(mockResult.ok === true, mockResult.ok ? "Expected mock report." : mockResult.reason);
    const mockReport = mockResult.report;
    const mockNeuroticism = mockReport.domains.find((domain) => domain.domain_code === "NEUROTICISM");
    assert(mockNeuroticism, "Expected NEUROTICISM mock domain.");
    assert(
      mockNeuroticism.participant_display_label === "Emocionalna stabilnost",
      "Expected mock NEUROTICISM participant display label.",
    );
    assert(
      typeof mockNeuroticism.display_score === "number" &&
        typeof mockNeuroticism.display_band === "string" &&
        typeof mockNeuroticism.display_band_label === "string",
      "Expected mock V2 domain display fields.",
    );
    assert(
      mockNeuroticism.display_band !== mockNeuroticism.band,
      "Expected mock NEUROTICISM display band to be inverted from canonical band.",
    );
  } finally {
    if (previousVersion === undefined) {
      delete process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION;
    } else {
      process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION = previousVersion;
    }
  }

  console.info("IPIP-NEO-120 participant V2 neuroticism display verification passed");
}

main().catch((error) => {
  console.error("verify-ipip-neo-120-participant-v2-neuroticism-display failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
