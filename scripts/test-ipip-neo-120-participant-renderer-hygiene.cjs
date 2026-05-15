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
const candidateReportsPageSource = fs.readFileSync(
  path.join(projectRoot, "app/(protected)/dashboard/participants/[participantId]/reports/page.tsx"),
  "utf8",
);
const dashboardPrimitivesSource = fs.readFileSync(
  path.join(projectRoot, "components/dashboard/primitives.tsx"),
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
  candidateReportsPageSource.includes("PageNavigation"),
  true,
  "Expected HR participant detail page to use shared PageNavigation.",
);
assert.equal(
  candidateReportsPageSource.includes('backLabel="Nazad na dashboard"'),
  true,
  "Expected HR participant detail page to keep dashboard back label in PageNavigation.",
);
assert.equal(
  candidateReportsPageSource.includes('contextLabel="HR procjena kandidata"'),
  true,
  "Expected HR participant detail page to provide HR context label in PageNavigation.",
);
assert.equal(
  candidateReportsPageSource.includes("Sažetak procjene"),
  false,
  "Expected HR participant detail page to remove the redundant summary block below the hero.",
);
assert.equal(
  candidateReportsPageSource.includes('title="Pojedinačni HR izvještaji"'),
  true,
  "Expected HR participant detail page to use the updated single-report section title.",
);
assert.equal(
  candidateReportsPageSource.includes(
    'description="Pregled statusa i izvještaja za svaku završenu procjenu kandidata."',
  ),
  true,
  "Expected HR participant detail page to use the updated single-report section description.",
);
assert.equal(
  candidateReportsPageSource.includes("Dostupni testovi i statusi"),
  false,
  "Expected outdated single-report section title to be removed.",
);
assert.equal(
  candidateReportsPageSource.includes("nalaz"),
  false,
  "Expected updated participant report page copy to avoid the word 'nalaz'.",
);
assert.equal(
  candidateReportsPageSource.includes("max-w-[920px]"),
  true,
  "Expected composite inner card to use a fixed max width on desktop.",
);
assert.equal(
  candidateReportsPageSource.includes("min-[900px]:grid-cols-[minmax(0,1fr)_auto]"),
  true,
  "Expected composite inner card to switch to a two-column desktop layout.",
);
assert.equal(
  candidateReportsPageSource.includes("min-[900px]:whitespace-nowrap"),
  true,
  "Expected composite CTA to remain nowrap on desktop.",
);
assert.equal(
  candidateReportsPageSource.includes("bg-[rgba(6,214,160,0.14)]"),
  true,
  "Expected emerald status semantics on the participant reports page.",
);
assert.equal(
  candidateReportsPageSource.includes('border-[rgba(7,59,76,0.08)] bg-[rgba(255,255,255,0.72)] text-[#073b4c]'),
  true,
  "Expected organization chip to use the neutral treatment instead of emerald.",
);
assert.equal(
  candidateReportsPageSource.includes('eyebrowClassName="text-[#118ab2]"'),
  true,
  "Expected single-report section eyebrow to use the ocean blue accent.",
);
assert.equal(
  candidateReportsPageSource.includes('eyebrowClassName="text-[#073b4c]"'),
  true,
  "Expected composite section eyebrow to use the dark teal accent.",
);
assert.equal(
  candidateReportsPageSource.includes("shadow-[inset_0_3px_0_rgba(17,138,178,0.22),0_28px_60px_rgba(15,23,42,0.12)]"),
  true,
  "Expected the single-report section shell to use an ocean-blue accent shadow.",
);
assert.equal(
  candidateReportsPageSource.includes("shadow-[inset_0_3px_0_rgba(7,59,76,0.24),0_28px_60px_rgba(15,23,42,0.12)]"),
  true,
  "Expected the composite section shell to use a dark-teal accent shadow.",
);
assert.equal(
  candidateReportsPageSource.includes("border-l-4 border-l-[#073b4c]"),
  true,
  "Expected the composite inner card to use a dark-teal left accent strip.",
);
assert.equal(
  candidateReportsPageSource.includes("bg-[rgba(255,255,255,0.82)]"),
  true,
  "Expected the composite inner card to use the specified translucent white background.",
);
assert.equal(
  dashboardPrimitivesSource.includes("bg-[#079985]"),
  true,
  "Expected shared dashboard primary CTA to use the updated default teal.",
);
assert.equal(
  dashboardPrimitivesSource.includes("hover:bg-[#073b4c]"),
  true,
  "Expected shared dashboard primary CTA to darken to dark teal on hover.",
);
assert.equal(
  dashboardPrimitivesSource.includes("text-white"),
  true,
  "Expected shared dashboard primary CTA to keep white default text.",
);
assert.equal(
  dashboardPrimitivesSource.includes("hover:text-white"),
  true,
  "Expected shared dashboard primary CTA to keep white text on hover.",
);
assert.equal(
  dashboardPrimitivesSource.includes("focus-visible:text-white"),
  true,
  "Expected shared dashboard primary CTA to keep white text on focus-visible.",
);
assert.equal(
  dashboardPrimitivesSource.includes("active:text-white"),
  true,
  "Expected shared dashboard primary CTA to keep white text when active.",
);
assert.equal(
  dashboardPrimitivesSource.includes("focus-visible:ring-[rgba(17,138,178,0.32)]"),
  true,
  "Expected shared dashboard primary CTA to use the specified focus ring color.",
);
assert.equal(
  candidateReportsPageSource.includes('title="Kompozitni HR izvještaj"'),
  false,
  "Composite section title should continue to come from model content, not be hardcoded in the page header.",
);
assert.equal(
  candidateReportsPageSource.includes("{model.organizationName}"),
  true,
  "Expected organization context to remain in hero metadata, not in page navigation.",
);
assert.equal(
  dashboardPrimitivesSource.includes("export function getDashboardCtaClassName"),
  true,
  "Expected dashboard primitives to expose a shared CTA helper.",
);
assert.equal(
  dashboardPrimitivesSource.includes("hover:text-white"),
  true,
  "Expected shared dashboard CTA helper to keep white text on darker hover states.",
);
assert.equal(
  candidateReportsPageSource.includes('getDashboardCtaClassName({ variant: "primary" })'),
  true,
  "Expected HR participant detail page to use shared primary CTA styling.",
);
assert.equal(
  candidateReportsPageSource.includes('getDashboardCtaClassName({ variant: "disabled" })'),
  true,
  "Expected HR participant detail page to use shared disabled CTA styling.",
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
