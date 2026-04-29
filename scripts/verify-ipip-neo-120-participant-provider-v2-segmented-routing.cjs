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

function withEnv(overrides, callback) {
  const previous = {};

  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];

    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
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
    attempt_id: "attempt-provider-v2-segmented-routing",
    test_id: "test-ipip-neo-120",
    test_slug: IPIP_NEO_120_TEST_SLUG,
    test_name: "IPIP-NEO-120",
    test_family: IPIP_NEO_120_TEST_FAMILY,
    audience: "participant",
    locale: "bs",
    scoring_method: "average",
    prompt_version: "ipip_neo_120_participant_v2_segmented_routing",
    scored_response_count: 120,
    scale_hint: {
      min: 1,
      max: 5,
      display_mode: "visual_with_discreet_numeric_support",
    },
    domains: IPIP_NEO_120_DOMAIN_ORDER.map((domainCode, domainIndex) => ({
      domain_code: domainCode,
      label: getIpipNeo120DomainLabel(domainCode),
      score: 4.5 - domainIndex * 0.35,
      band: domainIndex < 2 ? "higher" : domainIndex === 3 ? "lower" : "balanced",
      subdimensions: IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map((facetCode, facetIndex) => ({
        facet_code: facetCode,
        label: getIpipNeo120FacetLabel(facetCode),
        score: 4.6 - domainIndex * 0.3 - facetIndex * 0.08,
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

function main() {
  const reportConfig = require("../lib/assessment/report-config.ts");
  const openAiProvider = require("../lib/assessment/report-provider-openai.ts");
  const inputV2 = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");
  const segments = require("../lib/assessment/ipip-neo-120-participant-report-v2-segments.ts");
  const labels = require("../lib/assessment/ipip-neo-120-labels.ts");

  assert(
    reportConfig.normalizeIpipNeo120ParticipantGenerationMode(undefined) === "single",
    "Default generation mode should be single.",
  );
  assert(
    reportConfig.normalizeIpipNeo120ParticipantGenerationMode("unexpected") === "single",
    "Invalid generation mode should fall back to single.",
  );
  assert(
    reportConfig.normalizeIpipNeo120ParticipantGenerationMode("segmented") === "segmented",
    "segmented env value should resolve to segmented.",
  );

  withEnv({ IPIP_NEO_120_PARTICIPANT_GENERATION_MODE: undefined }, () => {
    assert(
      reportConfig.getIpipNeo120ParticipantGenerationMode() === "single",
      "Env default generation mode should be single.",
    );
  });

  withEnv({ IPIP_NEO_120_PARTICIPANT_GENERATION_MODE: "invalid" }, () => {
    assert(
      reportConfig.getIpipNeo120ParticipantGenerationMode() === "single",
      "Invalid env generation mode should fall back to single.",
    );
  });

  withEnv({ IPIP_NEO_120_PARTICIPANT_GENERATION_MODE: "segmented" }, () => {
    assert(
      reportConfig.getIpipNeo120ParticipantGenerationMode() === "segmented",
      "segmented env generation mode should be preserved.",
    );
  });

  const preparedInput = buildPreparedInput();

  withEnv(
    {
      IPIP_NEO_120_PARTICIPANT_REPORT_VERSION: "v2",
      IPIP_NEO_120_PARTICIPANT_GENERATION_MODE: "single",
    },
    () => {
      assert(
        openAiProvider.resolveIpipNeo120ParticipantProviderMode(preparedInput) === "v2-single",
        "V2 + single should choose v2-single path.",
      );

      const route = openAiProvider.resolveIpipNeo120ParticipantOpenAiRouteForInput(preparedInput);
      assert(route.version === "v2", "V2 + single route should expose version v2.");
      assert(route.generationMode === "single", "V2 + single route should expose single mode.");
      assert(
        route.schemaName === "ipip-neo-120-participant-v2",
        "V2 + single route should keep the V2 schema name.",
      );
    },
  );

  withEnv(
    {
      IPIP_NEO_120_PARTICIPANT_REPORT_VERSION: "v2",
      IPIP_NEO_120_PARTICIPANT_GENERATION_MODE: "segmented",
    },
    () => {
      assert(
        openAiProvider.resolveIpipNeo120ParticipantProviderMode(preparedInput) === "v2-segmented",
        "V2 + segmented should choose v2-segmented path.",
      );

      const route = openAiProvider.resolveIpipNeo120ParticipantOpenAiRouteForInput(preparedInput);
      assert(route.version === "v2", "V2 + segmented route should expose version v2.");
      assert(
        route.generationMode === "segmented",
        "V2 + segmented route should expose segmented mode.",
      );
    },
  );

  withEnv(
    {
      IPIP_NEO_120_PARTICIPANT_REPORT_VERSION: undefined,
      IPIP_NEO_120_PARTICIPANT_GENERATION_MODE: "segmented",
    },
    () => {
      assert(
        openAiProvider.resolveIpipNeo120ParticipantProviderMode(preparedInput) === "v1",
        "Without V2 version switch, route should remain V1.",
      );

      const route = openAiProvider.resolveIpipNeo120ParticipantOpenAiRouteForInput(preparedInput);
      assert(route.version === "v1", "Default route should remain V1.");
      assert(route.generationMode === "single", "V1 route should expose single generation mode.");
    },
  );

  const v2Input = inputV2.buildIpipNeo120ParticipantAiInputV2(preparedInput.promptInput);
  const v2InputValidation = inputV2.validateIpipNeo120ParticipantAiInputV2(v2Input);
  assert(v2InputValidation.ok, "V2 input builder should produce valid V2 AI input.");

  const overviewPromptInput =
    segments.buildIpipNeo120ParticipantOverviewSegmentPromptInput(v2InputValidation.value);
  assert(Array.isArray(overviewPromptInput.domains), "Overview prompt input should expose domains.");
  assert(
    overviewPromptInput.domains.length === 5,
    "Overview prompt input should expose all 5 domains.",
  );

  const extraversionPromptInput = segments.buildIpipNeo120ParticipantDomainSegmentPromptInput(
    v2InputValidation.value,
    "EXTRAVERSION",
  );
  assert(
    extraversionPromptInput.domain.domain_code === "EXTRAVERSION",
    "Domain prompt input should target the requested domain only.",
  );
  assert(
    extraversionPromptInput.domain.subdimensions.length === 6,
    "Domain prompt input should expose exactly 6 subdimensions.",
  );

  const practicalPromptInput =
    segments.buildIpipNeo120ParticipantPracticalSegmentPromptInput(v2InputValidation.value);
  assert(
    practicalPromptInput.static_text.interpretation_note.text ===
      inputV2.IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2.interpretation_note.text,
    "Practical prompt input should include the static interpretation note.",
  );

  const longSchemaName =
    "ipip_neo_120_participant_v2_segment_domain_openness_to_experience";
  const safeSchemaName = openAiProvider.buildOpenAiSchemaName(longSchemaName);
  assert(safeSchemaName.length <= 64, "Safe schema name should stay within the OpenAI 64 char limit.");

  const domainSchemaName = openAiProvider.buildOpenAiSchemaName(
    `ipip_neo_120_participant_v2_segment_domain_${labels.IPIP_NEO_120_DOMAIN_ORDER[4]}`,
  );
  assert(
    domainSchemaName.length <= 64,
    "OPENNESS_TO_EXPERIENCE schema name should be compacted below 64 chars.",
  );

  console.info("IPIP-NEO-120 participant provider V2 segmented routing verification passed");
}

main();
