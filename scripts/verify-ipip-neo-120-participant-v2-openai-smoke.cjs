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

function getArgValue(name) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function requireSmokeEnv() {
  const required = {
    AI_REPORT_PROVIDER: process.env.AI_REPORT_PROVIDER,
    IPIP_NEO_120_PARTICIPANT_REPORT_VERSION:
      process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_REPORT_MODEL: process.env.AI_REPORT_MODEL,
  };

  if (required.AI_REPORT_PROVIDER !== "openai") {
    fail("AI_REPORT_PROVIDER must be openai.");
  }

  if (required.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION !== "v2") {
    fail("IPIP_NEO_120_PARTICIPANT_REPORT_VERSION must be v2.");
  }

  if (!required.OPENAI_API_KEY) {
    fail("OPENAI_API_KEY is required.");
  }

  if (!required.AI_REPORT_MODEL) {
    fail("AI_REPORT_MODEL is required.");
  }

  return {
    apiKey: required.OPENAI_API_KEY,
    model: required.AI_REPORT_MODEL,
  };
}

function buildSampleCompletedAssessmentRequest() {
  const {
    IPIP_NEO_120_DOMAIN_ORDER,
    IPIP_NEO_120_FACETS_BY_DOMAIN,
    IPIP_NEO_120_TEST_SLUG,
  } = require("../lib/assessment/ipip-neo-120-labels.ts");

  const dimensions = IPIP_NEO_120_DOMAIN_ORDER.flatMap((domainCode, domainIndex) =>
    IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map((facetCode, facetIndex) => {
      const averageScore = 4.7 - domainIndex * 0.34 - facetIndex * 0.08;
      const scoredQuestionCount = 4;

      return {
        dimension: facetCode,
        rawScore: Number((averageScore * scoredQuestionCount).toFixed(2)),
        scoredQuestionCount,
      };
    }),
  );

  return {
    attemptId: "openai-smoke-sample",
    testId: "ipip-neo-120-sample",
    testSlug: IPIP_NEO_120_TEST_SLUG,
    testName: "IPIP-NEO-120",
    audience: "participant",
    locale: "bs",
    scoringMethod: "average",
    promptVersion: "ipip_neo_120_participant_v2_openai_smoke",
    results: {
      scoredResponseCount: 120,
      dimensions,
      unscoredResponses: [],
      derived: null,
    },
  };
}

async function buildRequestFromAttemptId(attemptId) {
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const {
    buildCompletedAssessmentReportRequest,
  } = require("../lib/assessment/reports.ts");

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attempts")
    .select("id, test_id")
    .eq("id", attemptId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load attempt ${attemptId}: ${error.message}`);
  }

  if (!data?.test_id) {
    throw new Error(`Attempt ${attemptId} was not found or has no test_id.`);
  }

  const request = await buildCompletedAssessmentReportRequest(data.test_id, attemptId, {
    audience: "participant",
    locale: "bs",
    promptVersion: "ipip_neo_120_participant_v2_openai_smoke",
  });

  if (!request) {
    throw new Error(`Could not build completed assessment report request for ${attemptId}.`);
  }

  return request;
}

async function generateOpenAiReport(request, options, useGenerationHelper) {
  if (useGenerationHelper) {
    const {
      generateCompletedAssessmentReport,
    } = require("../lib/assessment/reports.ts");

    const result = await generateCompletedAssessmentReport(request, {
      provider: "openai",
      model: options.model,
      fallbackToMock: false,
      openAiApiKey: options.apiKey,
      promptVersion: request.promptVersion,
      openAiTimeoutMs: 180000,
    });

    assert(result.status === "ready", `Expected ready generation result, got ${result.status}.`);
    return result.report;
  }

  const {
    buildPreparedReportGenerationInput,
  } = require("../lib/assessment/report-provider-helpers.ts");
  const {
    createOpenAiReportProvider,
  } = require("../lib/assessment/report-provider-openai.ts");

  const provider = createOpenAiReportProvider({
    apiKey: options.apiKey,
    model: options.model,
    timeoutMs: 180000,
  });
  const result = await provider.generateReport(
    buildPreparedReportGenerationInput(request, {
      promptVersionId: null,
      promptTemplate: null,
    }),
  );

  assert(result.ok === true, result.ok ? "Expected ok provider result." : result.reason);
  return result.report;
}

function collectMainTextSegments(report) {
  return [
    report.summary.headline,
    report.summary.overview,
    ...report.summary.badges.map((badge) => badge.label),
    ...report.key_patterns.flatMap((pattern) => [pattern.title, pattern.description]),
    ...report.domains.flatMap((domain) => [
      domain.card_title,
      domain.summary,
      domain.practical_signal,
      domain.candidate_reflection,
      ...domain.strengths,
      ...domain.watchouts,
      domain.development_tip,
      ...domain.subdimensions.flatMap((subdimension) => [
        subdimension.card_title,
        subdimension.summary,
        subdimension.practical_signal,
        subdimension.candidate_reflection,
      ]),
    ]),
    ...report.strengths.flatMap((item) => [item.title, item.description]),
    ...report.watchouts.flatMap((item) => [item.title, item.description]),
    report.work_style.title,
    ...report.work_style.paragraphs,
    ...report.development_recommendations.flatMap((item) => [
      item.title,
      item.description,
      item.action,
    ]),
  ];
}

function assertNoForbiddenTerms(report) {
  const {
    IPIP_NEO_120_PARTICIPANT_VOCABULARY_RULES_V2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");
  const text = collectMainTextSegments(report).join("\n").toLowerCase();
  const foundTerms = IPIP_NEO_120_PARTICIPANT_VOCABULARY_RULES_V2.global_forbidden_terms.filter(
    (term) => text.includes(term.toLowerCase()),
  );

  if (foundTerms.length > 0) {
    fail(`Found forbidden term(s) in main narrative text: ${foundTerms.join(", ")}`);
  }
}

function validateSnapshot(snapshot) {
  const {
    validateRuntimeCompletedAssessmentReport,
  } = require("../lib/assessment/report-providers.ts");
  const {
    validateIpipNeo120ParticipantReportV2,
    formatIpipNeo120ParticipantReportV2ValidationErrors,
  } = require("../lib/assessment/ipip-neo-120-participant-report-v2.ts");

  assert(
    snapshot.contract_version === "ipip_neo_120_participant_v2",
    "Expected contract_version ipip_neo_120_participant_v2.",
  );

  const v2Validation = validateIpipNeo120ParticipantReportV2(snapshot);

  if (!v2Validation.ok) {
    fail(
      `V2 report validation failed:\n${formatIpipNeo120ParticipantReportV2ValidationErrors(
        v2Validation.errors,
      )}`,
    );
  }

  const runtimeValidation = validateRuntimeCompletedAssessmentReport(snapshot, {
    testSlug: "ipip-neo-120-v1",
    audience: "participant",
  });

  assert(runtimeValidation.ok, "Expected runtime validation to pass.");
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
  assert(Boolean(snapshot.interpretation_note.text), "Expected interpretation_note.text.");
  assertNoForbiddenTerms(snapshot);
}

function printSample(snapshot) {
  const firstDomain = snapshot.domains[0];
  const firstSubdimension = firstDomain?.subdimensions?.[0];

  console.info("OpenAI V2 smoke sample", {
    headline: snapshot.summary.headline,
    badges: snapshot.summary.badges.map((badge) => badge.label),
    firstKeyPatternTitle: snapshot.key_patterns[0]?.title ?? null,
    firstDomain: firstDomain
      ? `${firstDomain.participant_display_label} · ${firstDomain.band_label}`
      : null,
    firstSubdimension: firstSubdimension
      ? `${firstSubdimension.participant_display_label} · ${firstSubdimension.band_label}`
      : null,
  });
}

async function main() {
  const attemptId = getArgValue("--attempt-id");
  const options = requireSmokeEnv();
  const request = attemptId
    ? await buildRequestFromAttemptId(attemptId)
    : buildSampleCompletedAssessmentRequest();
  const snapshot = await generateOpenAiReport(request, options, Boolean(attemptId));

  validateSnapshot(snapshot);
  printSample(snapshot);
  console.info("IPIP-NEO-120 participant V2 OpenAI smoke verification passed");
}

main().catch((error) => {
  console.error("verify-ipip-neo-120-participant-v2-openai-smoke failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
