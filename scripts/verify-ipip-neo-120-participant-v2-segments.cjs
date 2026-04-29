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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

  return {
    attempt_id: "segments-verify",
    test_id: "test-ipip-neo-120",
    test_slug: IPIP_NEO_120_TEST_SLUG,
    test_name: "IPIP-NEO-120",
    test_family: IPIP_NEO_120_TEST_FAMILY,
    audience: "participant",
    locale: "bs",
    scoring_method: "average",
    prompt_version: "ipip_neo_120_participant_v2_segments",
    scored_response_count: 120,
    scale_hint: {
      min: 1,
      max: 5,
      display_mode: "visual_with_discreet_numeric_support",
    },
    domains: IPIP_NEO_120_DOMAIN_ORDER.map((domainCode, domainIndex) => ({
      domain_code: domainCode,
      label: getIpipNeo120DomainLabel(domainCode),
      score: 4.5 - domainIndex * 0.42,
      band: domainIndex < 2 ? "higher" : domainIndex === 3 ? "lower" : "balanced",
      subdimensions: IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map(
        (facetCode, facetIndex) => ({
          facet_code: facetCode,
          label: getIpipNeo120FacetLabel(facetCode),
          score: 4.7 - domainIndex * 0.32 - facetIndex * 0.06,
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

function buildAiInput() {
  const {
    buildIpipNeo120ParticipantAiInputV2,
    validateIpipNeo120ParticipantAiInputV2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");
  const input = buildIpipNeo120ParticipantAiInputV2(buildPromptInput());
  const validation = validateIpipNeo120ParticipantAiInputV2(input);

  if (!validation.ok) {
    fail(`AI input failed validation: ${validation.errors.join(" | ")}`);
  }

  return validation.value;
}

function buildOverviewSegment(input) {
  return {
    segment_type: "overview",
    contract_version: "ipip_neo_120_participant_v2_segment_overview",
    summary: {
      headline: "Segmentirani pregled profila",
      overview:
        "Ovaj pregled koristi segmentirani V2 input i opisuje ključne signale na osnovu canonical domena i poddimenzija.",
      badges: [
        { label: "Izražen signal", related_domains: ["EXTRAVERSION"], related_facets: ["FRIENDLINESS"] },
        { label: "Saradnja", related_domains: ["AGREEABLENESS"], related_facets: ["TRUST"] },
        { label: "Razvojni fokus", related_domains: ["CONSCIENTIOUSNESS"], related_facets: ["SELF_DISCIPLINE"] },
      ],
    },
    key_patterns: [0, 1, 2].map((index) => ({
      title: `Obrazac ${index + 1}`,
      description:
        "Ovaj obrazac povezuje score, band i participant display labele bez mijenjanja canonical podataka.",
      related_domains: input.deterministic_summary.ranked_domains.slice(0, 2),
      related_facets: input.deterministic_summary.top_subdimensions.slice(0, 2),
    })),
    work_style: {
      title: "Radni stil",
      paragraphs: [
        "Radni stil se ovdje opisuje kroz segmentirani pregled domena i njihovih odnosa.",
        "Najkorisnije ga je čitati uz konkretan kontekst rada, saradnje i opterećenja.",
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
      summary: `${domain.participant_display_label} je opisan kroz V2 segment i canonical score.`,
      practical_signal: `${domain.participant_display_label} može se pratiti kroz konkretan radni obrazac.`,
      candidate_reflection: `Primijeti kada se ${domain.participant_display_label.toLowerCase()} pokazuje u praksi.`,
      strengths: [
        `${domain.participant_display_label} može biti koristan razvojni oslonac.`,
        "Band labela pomaže da signal ostane vezan za score.",
      ],
      watchouts: [
        "Vrijedi pratiti kako se signal mijenja kroz kontekst.",
        "Korisno je povezati rezultat sa stvarnim ponašanjem.",
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
        summary: `${subdimension.participant_display_label} je prikazana kao segmentirani signal.`,
        practical_signal: "U radu se može pratiti kroz konkretan način reagovanja.",
        candidate_reflection: "Primijeti kada se ovaj obrazac pojavljuje.",
      })),
    },
  };
}

function buildPracticalSegment(input) {
  const {
    IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");

  return {
    segment_type: "practical",
    contract_version: "ipip_neo_120_participant_v2_segment_practical",
    strengths: [0, 1, 2, 3].map((index) => ({
      title: `Snaga ${index + 1}`,
      description: "Ovaj segment pomaže da se razvojni signal poveže sa praksom.",
      related_domains: input.deterministic_summary.ranked_domains.slice(0, 1),
      related_facets: input.deterministic_summary.top_subdimensions.slice(0, 1),
    })),
    watchouts: [0, 1, 2].map((index) => ({
      title: `Oprez ${index + 1}`,
      description: "Vrijedi pratiti kontekst u kojem se ovaj signal pokazuje.",
      related_domains: input.deterministic_summary.lowest_domains.slice(0, 1),
      related_facets: input.deterministic_summary.lowest_subdimensions.slice(0, 1),
    })),
    development_recommendations: [0, 1, 2, 3].map((index) => ({
      title: `Preporuka ${index + 1}`,
      description: "Ova preporuka pomaže da se rezultat pretvori u mali razvojni korak.",
      action: "Izaberi jednu situaciju i zabilježi šta se promijenilo.",
      related_domains: input.deterministic_summary.ranked_domains.slice(0, 1),
      related_facets: input.deterministic_summary.top_subdimensions.slice(0, 1),
    })),
    interpretation_note: IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2.interpretation_note,
  };
}

function expectInvalid(label, result, expectedText) {
  assert(!result.ok, `${label}: expected invalid result.`);
  assert(
    result.errors.some((error) => error.includes(expectedText)),
    `${label}: expected error containing "${expectedText}", got ${result.errors.join(" | ")}`,
  );
}

async function main() {
  const {
    IPIP_NEO_120_DOMAIN_ORDER,
  } = require("../lib/assessment/ipip-neo-120-labels.ts");
  const {
    IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2,
    IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");
  const {
    assembleIpipNeo120ParticipantReportV2FromSegments,
    buildIpipNeo120ParticipantDomainSegmentPromptInput,
    buildIpipNeo120ParticipantOverviewSegmentPromptInput,
    buildIpipNeo120ParticipantPracticalSegmentPromptInput,
    validateIpipNeo120ParticipantReportV2DomainSegment,
    validateIpipNeo120ParticipantReportV2OverviewSegment,
    validateIpipNeo120ParticipantReportV2PracticalSegment,
    validateIpipNeo120ParticipantReportV2SegmentsBundle,
  } = require("../lib/assessment/ipip-neo-120-participant-report-v2-segments.ts");
  const {
    validateIpipNeo120ParticipantReportV2,
  } = require("../lib/assessment/ipip-neo-120-participant-report-v2.ts");

  const input = buildAiInput();
  const overview = buildOverviewSegment(input);
  const domains = input.domains.map(buildDomainSegment);
  const practical = buildPracticalSegment(input);
  const bundle = { overview, domains, practical };

  assert(validateIpipNeo120ParticipantReportV2OverviewSegment(overview).ok, "Overview segment should validate.");
  domains.forEach((domainSegment, index) => {
    assert(
      validateIpipNeo120ParticipantReportV2DomainSegment(domainSegment, IPIP_NEO_120_DOMAIN_ORDER[index]).ok,
      `Domain segment ${index} should validate.`,
    );
  });
  assert(validateIpipNeo120ParticipantReportV2PracticalSegment(practical).ok, "Practical segment should validate.");
  assert(validateIpipNeo120ParticipantReportV2SegmentsBundle(bundle).ok, "Bundle should validate.");

  const assembled = assembleIpipNeo120ParticipantReportV2FromSegments(input, bundle);
  assert(assembled.ok, assembled.ok ? "Expected assembled report." : assembled.errors.join(" | "));
  const report = assembled.value;
  assert(validateIpipNeo120ParticipantReportV2(report).ok, "Final report should validate.");
  assert(report.contract_version === "ipip_neo_120_participant_v2", "Expected V2 contract.");
  assert(report.domains.length === 5, "Expected 5 domains.");
  assert(report.domains.flatMap((domain) => domain.subdimensions).length === 30, "Expected 30 subdimensions.");
  assert(report.summary.badges.length === 3, "Expected 3 badges.");
  assert(report.key_patterns.length === 3, "Expected 3 key patterns.");
  assert(report.strengths.length === 4, "Expected 4 strengths.");
  assert(report.watchouts.length === 3, "Expected 3 watchouts.");
  assert(report.work_style.paragraphs.length === 2, "Expected 2 work style paragraphs.");
  assert(report.development_recommendations.length === 4, "Expected 4 recommendations.");
  assert(
    report.interpretation_note.text === IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2.interpretation_note.text,
    "Expected static interpretation note text.",
  );

  const overviewWithoutBadges = clone(overview);
  overviewWithoutBadges.summary.badges = overviewWithoutBadges.summary.badges.slice(0, 2);
  expectInvalid(
    "overview without 3 badges",
    validateIpipNeo120ParticipantReportV2OverviewSegment(overviewWithoutBadges),
    "summary.badges",
  );

  expectInvalid(
    "wrong expected domain",
    validateIpipNeo120ParticipantReportV2DomainSegment(domains[0], "AGREEABLENESS"),
    "Expected AGREEABLENESS",
  );

  const domainWithFiveSubdimensions = clone(domains[0]);
  domainWithFiveSubdimensions.domain.subdimensions = domainWithFiveSubdimensions.domain.subdimensions.slice(0, 5);
  expectInvalid(
    "domain with 5 subdimensions",
    validateIpipNeo120ParticipantReportV2DomainSegment(domainWithFiveSubdimensions, "EXTRAVERSION"),
    "subdimensions",
  );

  const practicalWithTwoWatchouts = clone(practical);
  practicalWithTwoWatchouts.watchouts = practicalWithTwoWatchouts.watchouts.slice(0, 2);
  expectInvalid(
    "practical with 2 watchouts",
    validateIpipNeo120ParticipantReportV2PracticalSegment(practicalWithTwoWatchouts),
    "watchouts",
  );

  const wrongOrderBundle = clone(bundle);
  [wrongOrderBundle.domains[0], wrongOrderBundle.domains[1]] = [
    wrongOrderBundle.domains[1],
    wrongOrderBundle.domains[0],
  ];
  expectInvalid(
    "bundle wrong domain order",
    validateIpipNeo120ParticipantReportV2SegmentsBundle(wrongOrderBundle),
    "Expected EXTRAVERSION",
  );

  const invalidAssemblerBundle = clone(bundle);
  invalidAssemblerBundle.domains[0].domain.summary = "x".repeat(
    IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2["domains[].summary"].max_chars + 1,
  );
  expectInvalid(
    "assembler invalid final",
    assembleIpipNeo120ParticipantReportV2FromSegments(input, invalidAssemblerBundle),
    "summary",
  );

  const longTextOverview = clone(overview);
  longTextOverview.summary.overview = "x".repeat(
    IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2["summary.overview"].max_chars + 1,
  );
  expectInvalid(
    "segment text over max chars",
    validateIpipNeo120ParticipantReportV2OverviewSegment(longTextOverview),
    "max_chars",
  );

  const overviewPromptInput = buildIpipNeo120ParticipantOverviewSegmentPromptInput(input);
  assert(
    !("definition" in overviewPromptInput.domains[0].subdimensions[0]),
    "Overview prompt input should not include full subdimension definitions.",
  );

  const domainPromptInput = buildIpipNeo120ParticipantDomainSegmentPromptInput(input, "EXTRAVERSION");
  assert(domainPromptInput.domain.domain_code === "EXTRAVERSION", "Expected EXTRAVERSION domain input.");
  assert(domainPromptInput.domain.subdimensions.length === 6, "Expected 6 EXTRAVERSION subdimensions.");
  assert(domainPromptInput.domain.display_score === domainPromptInput.domain.score, "Direct domain display_score should equal score in prompt input.");

  const neuroticismSegment = domains.find((segment) => segment.domain_code === "NEUROTICISM");
  assert(neuroticismSegment, "Expected NEUROTICISM segment.");
  assert(
    validateIpipNeo120ParticipantReportV2DomainSegment(neuroticismSegment, "NEUROTICISM").ok,
    "NEUROTICISM segment with display fields should validate.",
  );

  const invalidNeuroticismSegment = clone(neuroticismSegment);
  invalidNeuroticismSegment.domain.display_band = invalidNeuroticismSegment.domain.band;
  expectInvalid(
    "neuroticism segment wrong display band",
    validateIpipNeo120ParticipantReportV2DomainSegment(
      invalidNeuroticismSegment,
      "NEUROTICISM",
    ),
    "display_band",
  );

  const practicalPromptInput = buildIpipNeo120ParticipantPracticalSegmentPromptInput(input);
  assert(
    practicalPromptInput.static_text.interpretation_note.text ===
      IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2.interpretation_note.text,
    "Expected practical prompt input to include static interpretation note.",
  );

  console.info("IPIP-NEO-120 participant V2 segments verification passed");
}

main().catch((error) => {
  console.error("verify-ipip-neo-120-participant-v2-segments failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
