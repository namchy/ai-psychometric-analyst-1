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
    attempt_id: "attempt-v2-e2e-mock",
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
      score: 4.6 - domainIndex * 0.48,
      band: domainIndex < 2 ? "higher" : domainIndex === 3 ? "lower" : "balanced",
      subdimensions: IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map(
        (facetCode, facetIndex) => ({
          facet_code: facetCode,
          label: getIpipNeo120FacetLabel(facetCode),
          score: 4.8 - domainIndex * 0.34 - facetIndex * 0.08,
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
  const promptInput = buildPromptInput();

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
  const previousProvider = process.env.AI_REPORT_PROVIDER;

  try {
    process.env.AI_REPORT_PROVIDER = "mock";
    process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION = "v2";

    const { mockReportProvider } = require("../lib/assessment/report-provider-mock.ts");
    const {
      resolveReportSignal,
      validateRuntimeCompletedAssessmentReport,
    } = require("../lib/assessment/report-providers.ts");
    const {
      validateIpipNeo120ParticipantReportV2,
    } = require("../lib/assessment/ipip-neo-120-participant-report-v2.ts");

    const preparedInput = buildPreparedInput();
    const generationResult = await mockReportProvider.generateReport(preparedInput);

    assert(
      generationResult.ok === true,
      generationResult.ok ? "Expected generation to be ok." : generationResult.reason,
    );

    const snapshot = generationResult.report;

    assert(
      snapshot.contract_version === "ipip_neo_120_participant_v2",
      "Expected V2 contract_version.",
    );

    const v2Validation = validateIpipNeo120ParticipantReportV2(snapshot);
    assert(v2Validation.ok, "Expected V2 report validator to pass.");

    const runtimeValidation = validateRuntimeCompletedAssessmentReport(snapshot, {
      testSlug: "ipip-neo-120-v1",
      audience: "participant",
    });
    assert(runtimeValidation.ok, "Expected runtime validator to accept V2 snapshot.");

    const reportSignal = resolveReportSignal({
      testSlug: "ipip-neo-120-v1",
      audience: "participant",
    });
    assert(
      reportSignal.reportRenderFormat === "ipip_neo_120_participant_v2",
      `Expected V2 render format, got ${reportSignal.reportRenderFormat ?? "null"}.`,
    );

    assert(snapshot.summary.badges.length === 3, "Expected 3 summary badges.");
    assert(snapshot.key_patterns.length === 3, "Expected 3 key patterns.");
    assert(snapshot.domains.length === 5, "Expected 5 domains.");
    assert(
      snapshot.domains.flatMap((domain) => domain.subdimensions).length === 30,
      "Expected 30 total subdimensions.",
    );
    assert(snapshot.strengths.length === 4, "Expected 4 strengths.");
    assert(snapshot.watchouts.length === 3, "Expected 3 watchouts.");
    assert(snapshot.work_style.paragraphs.length === 2, "Expected 2 work style paragraphs.");
    assert(
      snapshot.development_recommendations.length === 4,
      "Expected 4 development recommendations.",
    );
    assert(
      Boolean(snapshot.interpretation_note?.title) &&
        Boolean(snapshot.interpretation_note?.text),
      "Expected interpretation_note title and text.",
    );

    console.info("IPIP-NEO-120 participant V2 E2E mock verification passed");
  } finally {
    if (previousVersion === undefined) {
      delete process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION;
    } else {
      process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION = previousVersion;
    }

    if (previousProvider === undefined) {
      delete process.env.AI_REPORT_PROVIDER;
    } else {
      process.env.AI_REPORT_PROVIDER = previousProvider;
    }
  }
}

main().catch((error) => {
  console.error("verify-ipip-neo-120-participant-v2-e2e-mock failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
