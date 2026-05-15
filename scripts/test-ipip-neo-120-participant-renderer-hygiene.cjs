const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const nextLinkStubPath = path.join(__dirname, "test-stub-next-link.cjs");
const nextFontGoogleStubPath = path.join(__dirname, "test-stub-next-font-google.cjs");
const nextFontLocalStubPath = path.join(__dirname, "test-stub-next-font-local.cjs");
const rechartsStubPath = path.join(__dirname, "test-stub-recharts.cjs");
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

  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return emptyModulePath;
  }

  if (request === "next/link") {
    return nextLinkStubPath;
  }

  if (request === "next/font/google") {
    return nextFontGoogleStubPath;
  }

  if (request === "next/font/local") {
    return nextFontLocalStubPath;
  }

  if (request === "recharts") {
    return rechartsStubPath;
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

function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
}

require.extensions[".ts"] = compileTypeScript;
require.extensions[".tsx"] = compileTypeScript;

const {
  CompletedAssessmentSummary,
} = require("../components/assessment/completed-assessment-summary.tsx");

const reportPageSource = fs.readFileSync(
  path.join(projectRoot, "app/(protected)/app/attempts/[attemptId]/report/page.tsx"),
  "utf8",
);
const completedSummarySource = fs.readFileSync(
  path.join(projectRoot, "components/assessment/completed-assessment-summary.tsx"),
  "utf8",
);

const sampleV2Report = {
  contract_version: "ipip_neo_120_participant_v2",
  test: {
    slug: "ipip-neo-120-v1",
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
    overview: "Ovaj profil opisuje obrasce koji se mogu pokazati različito zavisno od konteksta.",
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
    description: "Ovaj obrazac se može pokazati kroz fleksibilan stil i promišljeno prilagođavanje.",
    related_domains: ["CONSCIENTIOUSNESS"],
    related_facets: ["SELF_DISCIPLINE"],
  })),
  domains: [
    "EMOTIONAL_STABILITY",
    "EXTRAVERSION",
    "OPENNESS_TO_EXPERIENCE",
    "AGREEABLENESS",
    "CONSCIENTIOUSNESS",
  ].map((domainCode, domainIndex) => ({
    domain_code: domainCode,
    label: `Domena ${domainIndex + 1}`,
    participant_display_label: `Prikaz ${domainIndex + 1}`,
    score: 3.1 + domainIndex * 0.1,
    band: "moderate",
    band_label: "Umjereno",
    display_score: 3.1 + domainIndex * 0.1,
    display_band: "balanced",
    display_band_label: "Uravnoteženo",
    card_title: `Kartica ${domainIndex + 1}`,
    summary: "Ovaj domen je opisan kao uravnotežen signal.",
    practical_signal: "U radu se može pokazati kroz stabilan i prilagodljiv pristup.",
    candidate_reflection: "Vrijedi pratiti kada ti ovaj obrazac najviše pomaže.",
    strengths: [
      "Može podržati stabilan pristup radu.",
      "Može pomoći u saradnji i prilagođavanju.",
    ],
    watchouts: [
      "Vrijedi pratiti zahtjevnije situacije.",
      "Korisno je prepoznati kada treba više strukture.",
    ],
    development_tip: "Postavi jedan mali korak za praćenje ovog obrasca.",
    subdimensions: Array.from({ length: 6 }, (_, facetIndex) => ({
      facet_code: `${domainCode}_FACET_${facetIndex + 1}`,
      label: `Facet ${facetIndex + 1}`,
      participant_display_label: `Signal ${facetIndex + 1}`,
      score: 3 + facetIndex * 0.05,
      band: "moderate",
      band_label: "Umjereno",
      card_title: `Facet kartica ${facetIndex + 1}`,
      summary: "Ova poddimenzija opisuje signal koji se može pokazati kontekstualno.",
      practical_signal: "U radu se može vidjeti kroz svakodnevne reakcije.",
      candidate_reflection: "Primijeti kada ti ovaj obrazac pomaže.",
    })),
  })),
  strengths: [0, 1, 2, 3].map((index) => ({
    title: `Snaga ${index + 1}`,
    description: "Ovaj razvojni signal može pomoći kada postoji prostor za promišljen odgovor.",
    related_domains: ["CONSCIENTIOUSNESS"],
    related_facets: ["CAUTIOUSNESS"],
  })),
  watchouts: [0, 1, 2].map((index) => ({
    title: `Fokus ${index + 1}`,
    description: "Vrijedi obratiti pažnju na situacije u kojima kontekst postaje zahtjevniji.",
    related_domains: ["EMOTIONAL_STABILITY"],
    related_facets: ["SELF_DISCIPLINE"],
  })),
  work_style: {
    title: "Radni stil",
    paragraphs: [
      "paragraphs_placeholder_removed",
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
  interpretation_note: "Ovaj izvještaj je razvojni uvid i ne predstavlja presudu.",
};

const html = renderToStaticMarkup(
  React.createElement(CompletedAssessmentSummary, {
    completedAt: "2026-05-13T10:00:00.000Z",
    locale: "bs",
    organizationName: "Test organizacija",
    participantName: "Test kandidat",
    testSlug: "ipip-neo-120-v1",
    testName: "IPIP-NEO-120",
    results: {
      attemptId: "attempt-ipip-renderer-hygiene",
      scoringMethod: "likert_sum",
      dimensions: [],
      scoredResponseCount: 120,
      unscoredResponses: [],
    },
    reportState: {
      status: "ready",
      reportFamily: "ipip_neo_120",
      reportAudience: "participant",
      reportVersion: "v2",
      reportRenderFormat: "ipip_neo_120_participant_v2",
      report: sampleV2Report,
    },
  }),
);

assert.equal(
  reportPageSource.includes("Nazad na dashboard"),
  true,
  "Expected participant report page to keep a single dashboard back link.",
);
assert.equal(
  completedSummarySource.includes("Nazad na dashboard"),
  false,
  "CompletedAssessmentSummary should not render its own dashboard back link.",
);
assert.equal(
  html.includes("paragraphs_placeholder_removed"),
  false,
  "Renderer must not emit technical placeholder markers.",
);
assert.equal(
  html.includes("Kada je kontekst zahtjevniji, korisno je osloniti se na jasne prioritete."),
  true,
  "Renderer should keep non-placeholder work style copy.",
);

console.log("IPIP participant renderer hygiene tests passed.");
