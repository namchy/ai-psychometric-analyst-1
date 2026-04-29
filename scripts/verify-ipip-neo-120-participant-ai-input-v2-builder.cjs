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

  const domainBands = {
    EXTRAVERSION: "balanced",
    AGREEABLENESS: "higher",
    CONSCIENTIOUSNESS: "higher",
    NEUROTICISM: "lower",
    OPENNESS_TO_EXPERIENCE: "balanced",
  };

  return {
    attempt_id: "attempt-v2-builder",
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
      score: 4.6 - domainIndex * 0.55,
      band: domainBands[domainCode],
      subdimensions: IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map(
        (facetCode, facetIndex) => ({
          facet_code: facetCode,
          label: getIpipNeo120FacetLabel(facetCode),
          score: 4.8 - domainIndex * 0.4 - facetIndex * 0.07,
          band: facetIndex < 2 ? "higher" : facetIndex > 3 ? "lower" : "balanced",
        }),
      ),
    })),
    deterministic_summary: {
      highest_domain: "AGREEABLENESS",
      lowest_domain: "NEUROTICISM",
      ranked_domains: [],
      top_subdimensions: [],
    },
  };
}

async function main() {
  const {
    buildIpipNeo120ParticipantAiInputV2,
    validateIpipNeo120ParticipantAiInputV2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");

  const output = buildIpipNeo120ParticipantAiInputV2(buildMockPromptInput());
  const validation = validateIpipNeo120ParticipantAiInputV2(output);

  if (!validation.ok) {
    fail(`Expected V2 AI input to validate, got:\n${validation.errors.join("\n")}`);
  }

  assert(output.domains.length === 5, "Expected 5 domains.");
  assert(
    output.domains.every((domain) => domain.subdimensions.length === 6),
    "Expected every domain to have 6 subdimensions.",
  );
  assert(
    output.domains.flatMap((domain) => domain.subdimensions).length === 30,
    "Expected 30 total subdimensions.",
  );

  const agreeableness = output.domains.find(
    (domain) => domain.domain_code === "AGREEABLENESS",
  );
  assert(
    agreeableness?.participant_display_label === "Spremnost na saradnju",
    "Expected AGREEABLENESS participant_display_label to be Spremnost na saradnju.",
  );
  assert(
    agreeableness?.display_label === "Spremnost na saradnju",
    "Expected AGREEABLENESS display_label to be Spremnost na saradnju.",
  );
  assert(
    agreeableness?.narrative_label === "spremnost na saradnju",
    "Expected AGREEABLENESS narrative_label to be spremnost na saradnju.",
  );

  const extraversion = output.domains.find((domain) => domain.domain_code === "EXTRAVERSION");
  assert(
    extraversion?.display_label === "Ekstraverzija",
    "Expected EXTRAVERSION display_label to be Ekstraverzija.",
  );
  assert(
    extraversion?.narrative_label === "ekstraverzija",
    "Expected EXTRAVERSION narrative_label to be ekstraverzija.",
  );

  const liberalism = output.domains
    .flatMap((domain) => domain.subdimensions)
    .find((subdimension) => subdimension.facet_code === "LIBERALISM");
  assert(
    liberalism?.participant_display_label === "Preispitivanje stavova",
    "Expected LIBERALISM participant_display_label to be Preispitivanje stavova.",
  );

  const neuroticism = output.domains.find((domain) => domain.domain_code === "NEUROTICISM");
  assert(
    neuroticism?.display_direction === "inverted_for_participant_domain_display",
    "Expected NEUROTICISM domain display direction to be inverted_for_participant_domain_display.",
  );

  const anxiety = output.domains
    .flatMap((domain) => domain.subdimensions)
    .find((subdimension) => subdimension.facet_code === "ANXIETY");
  assert(
    anxiety?.display_direction === "direct_but_non_clinical",
    "Expected ANXIETY display direction to be direct_but_non_clinical.",
  );

  for (const key of [
    "ranked_domains",
    "highest_domains",
    "lowest_domains",
    "balanced_domains",
    "top_subdimensions",
    "lowest_subdimensions",
  ]) {
    assert(
      Array.isArray(output.deterministic_summary[key]) &&
        output.deterministic_summary[key].length > 0,
      `Expected deterministic_summary.${key} to be populated.`,
    );
  }

  assert(output.text_budgets?.["summary.headline"], "Expected text_budgets to exist.");
  assert(
    output.static_text?.interpretation_note?.title === "Interpretacijska napomena",
    "Expected static interpretation note to exist.",
  );

  console.info("IPIP-NEO-120 participant AI input V2 builder verification passed");
}

main().catch((error) => {
  console.error("verify-ipip-neo-120-participant-ai-input-v2-builder failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
