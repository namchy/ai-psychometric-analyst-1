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
    attempt_id: "attempt-mock-v2",
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
      score: 4.5 - domainIndex * 0.5,
      band: domainIndex < 2 ? "higher" : domainIndex === 3 ? "lower" : "balanced",
      subdimensions: IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map(
        (facetCode, facetIndex) => ({
          facet_code: facetCode,
          label: getIpipNeo120FacetLabel(facetCode),
          score: 4.7 - domainIndex * 0.35 - facetIndex * 0.07,
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

async function main() {
  const previousVersion = process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION;

  try {
    process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION = "v2";

    const { mockReportProvider } = require("../lib/assessment/report-provider-mock.ts");
    const {
      validateIpipNeo120ParticipantReportV2,
    } = require("../lib/assessment/ipip-neo-120-participant-report-v2.ts");
    const {
      IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2,
    } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");

    const result = await mockReportProvider.generateReport(buildPreparedInput());

    assert(result.ok === true, result.ok ? "Expected ok result." : result.reason);

    const report = result.report;
    assert(
      report.contract_version === "ipip_neo_120_participant_v2",
      "Expected V2 contract_version.",
    );

    const validationResult = validateIpipNeo120ParticipantReportV2(report);
    assert(validationResult.ok, "Expected V2 mock report validation to pass.");

    assert(report.summary.badges.length === 3, "Expected 3 summary badges.");
    assert(report.key_patterns.length === 3, "Expected 3 key patterns.");
    assert(report.domains.length === 5, "Expected 5 domains.");
    assert(
      report.domains.flatMap((domain) => domain.subdimensions).length === 30,
      "Expected 30 total subdimensions.",
    );
    assert(report.strengths.length === 4, "Expected 4 strengths.");
    assert(report.watchouts.length === 3, "Expected 3 watchouts.");
    assert(report.work_style.paragraphs.length === 2, "Expected 2 work style paragraphs.");
    assert(
      report.development_recommendations.length === 4,
      "Expected 4 development recommendations.",
    );
    assert(
      report.interpretation_note.text ===
        IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2.interpretation_note.text,
      "Expected static interpretation note text.",
    );

    const liberalism = report.domains
      .flatMap((domain) => domain.subdimensions)
      .find((subdimension) => subdimension.facet_code === "LIBERALISM");
    assert(
      liberalism?.participant_display_label === "Preispitivanje stavova",
      "Expected LIBERALISM participant display label.",
    );

    const neuroticism = report.domains.find((domain) => domain.domain_code === "NEUROTICISM");
    assert(
      neuroticism?.participant_display_label === "Emocionalna stabilnost",
      "Expected NEUROTICISM participant display label.",
    );
    assert(
      typeof neuroticism?.display_score === "number" &&
        typeof neuroticism?.display_band === "string" &&
        typeof neuroticism?.display_band_label === "string",
      "Expected NEUROTICISM mock domain display fields.",
    );
    assert(
      neuroticism?.display_band !== neuroticism?.band,
      "Expected NEUROTICISM mock domain display band to be inverted from canonical band.",
    );
    assert(
      report.domains.every(
        (domain) =>
          domain.subdimensions.every(
            (subdimension) =>
              !Object.prototype.hasOwnProperty.call(subdimension, "display_score") &&
              !Object.prototype.hasOwnProperty.call(subdimension, "display_band") &&
              !Object.prototype.hasOwnProperty.call(subdimension, "display_band_label"),
          ),
      ),
      "Expected V2 mock subdimensions to remain canonical without display fields.",
    );

    console.info("IPIP-NEO-120 participant mock V2 verification passed");
  } finally {
    if (previousVersion === undefined) {
      delete process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION;
    } else {
      process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION = previousVersion;
    }
  }
}

main().catch((error) => {
  console.error("verify-ipip-neo-120-participant-mock-v2 failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
