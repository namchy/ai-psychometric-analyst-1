const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
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

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  buildPreparedReportGenerationInput,
  buildSingleTestHrPromptAuthorityMetadata,
} = require("../lib/assessment/report-provider-helpers.ts");
const {
  buildOpenAiStructuredRequestPayload,
} = require("../lib/assessment/report-provider-openai.ts");
const {
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
} = require("../lib/assessment/ipip-neo-120-labels.ts");

function buildIpipResults() {
  const dimensions = [];

  for (const [domainIndex, domainCode] of IPIP_NEO_120_DOMAIN_ORDER.entries()) {
    for (const [facetIndex, facetCode] of IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].entries()) {
      dimensions.push({
        dimension: facetCode,
        rawScore: 4.5 - domainIndex * 0.2 - facetIndex * 0.05,
        scoredQuestionCount: 4,
      });
    }
  }

  return {
    attemptId: "attempt-ipip-single-test-hr-prompt-authority",
    scoringMethod: "likert_mean",
    dimensions,
    scoredResponseCount: 120,
    unscoredResponses: [],
  };
}

function buildSafranResults() {
  return {
    attemptId: "attempt-safran-single-test-hr-prompt-authority",
    scoringMethod: "correct_answers",
    dimensions: [
      { dimension: "verbal_score", rawScore: 11, scoredQuestionCount: 18 },
      { dimension: "figural_score", rawScore: 10, scoredQuestionCount: 18 },
      { dimension: "numerical_series_score", rawScore: 7, scoredQuestionCount: 18 },
      { dimension: "cognitive_composite_v1", rawScore: 28, scoredQuestionCount: 54 },
    ],
    scoredResponseCount: 45,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 11,
        figuralScore: 10,
        numericalRawScore: 3.5,
        numericalAdjustedScore: 7,
        numericalScore: 7,
        numericalSeriesScore: 7,
        cognitiveCompositeScore: 28,
        cognitiveCompositeV1: 28,
      },
    },
  };
}

function buildMwmsResults() {
  return {
    attemptId: "attempt-mwms-single-test-hr-prompt-authority",
    scoringMethod: "likert_sum",
    dimensions: [
      { dimension: "amotivation", rawScore: 4, scoredQuestionCount: 3 },
      { dimension: "external_social", rawScore: 4.25, scoredQuestionCount: 3 },
      { dimension: "external_material", rawScore: 4.5, scoredQuestionCount: 3 },
      { dimension: "introjected", rawScore: 3.75, scoredQuestionCount: 4 },
      { dimension: "identified", rawScore: 4.75, scoredQuestionCount: 3 },
      { dimension: "intrinsic", rawScore: 5, scoredQuestionCount: 3 },
    ],
    scoredResponseCount: 19,
    unscoredResponses: [],
  };
}

function buildPromptTemplate(id, promptKey) {
  return {
    id,
    testId: `${id}-test`,
    reportType: "individual",
    audience: "hr",
    sourceType: "single_test",
    generatorType: "openai",
    promptKey,
    version: "db-v1",
    systemPrompt: "DB system prompt",
    userPromptTemplate: "DB user prompt {{prompt_version_id}} {{prompt_version}}",
    outputSchemaJson: null,
    notes: null,
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:00:00.000Z",
    updatedBy: null,
  };
}

function assertCommonAuthorityMetadata(metadata, expected) {
  assert.ok(metadata);
  assert.equal(metadata.reportFamily, "single_test_hr");
  assert.equal(metadata.reportKind, expected.reportKind);
  assert.equal(metadata.reportLaneId, `${expected.reportKind}:${expected.testSlug}:hr`);
  assert.equal(metadata.testSlug, expected.testSlug);
  assert.equal(metadata.audience, "hr");
  assert.equal(metadata.promptSource, "db_prompt_version");
  assert.equal(metadata.promptVersionId, expected.promptVersionId);
  assert.equal(metadata.promptVersion, "db-v1");
  assert.equal(metadata.promptKey, expected.promptKey);
  assert.deepEqual(metadata.authorityLayers, [
    "global_hr_report_rules",
    "global_terminology_rules",
    "single_test_hr_family_rules",
    "test_specific_rules",
    "runtime_input_facts",
  ]);
}

function main() {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("fetch should not be called");
  };

  try {
    const cases = [
      {
        name: "ipip",
        preparedInput: buildPreparedReportGenerationInput(
          {
            attemptId: "attempt-ipip-single-test-hr-prompt-authority",
            testId: "test-ipip",
            testSlug: "ipip-neo-120-v1",
            audience: "hr",
            locale: "bs",
            scoringMethod: "likert_mean",
            promptVersion: "ipip_neo_120_hr_v2",
            testName: "IPIP-NEO-120",
            results: buildIpipResults(),
          },
          {
            promptVersionId: "prompt-version-ipip-hr",
            promptTemplate: buildPromptTemplate("prompt-version-ipip-hr", "ipip_neo_120_hr_v2"),
          },
        ),
        reportKind: "ipip_hr",
        promptKey: "ipip_neo_120_hr_v2",
        promptVersionId: "prompt-version-ipip-hr",
      },
      {
        name: "safran",
        preparedInput: buildPreparedReportGenerationInput(
          {
            attemptId: "attempt-safran-single-test-hr-prompt-authority",
            testId: "test-safran",
            testSlug: "safran_v1",
            audience: "hr",
            locale: "bs",
            scoringMethod: "correct_answers",
            promptVersion: "safran_hr_report_v1",
            testName: "SAFRAN",
            results: buildSafranResults(),
          },
          {
            promptVersionId: "prompt-version-safran-hr",
            promptTemplate: buildPromptTemplate("prompt-version-safran-hr", "safran_hr_report_v1"),
          },
        ),
        reportKind: "safran_hr",
        promptKey: "safran_hr_report_v1",
        promptVersionId: "prompt-version-safran-hr",
      },
      {
        name: "mwms",
        preparedInput: buildPreparedReportGenerationInput(
          {
            attemptId: "attempt-mwms-single-test-hr-prompt-authority",
            testId: "test-mwms",
            testSlug: "mwms_v1",
            audience: "hr",
            locale: "bs",
            scoringMethod: "likert_sum",
            promptVersion: "mwms_hr_report_v1",
            testName: "Procjena radne motivacije",
            results: buildMwmsResults(),
          },
          {
            promptVersionId: "prompt-version-mwms-hr",
            promptTemplate: buildPromptTemplate("prompt-version-mwms-hr", "mwms_hr_report_v1"),
          },
        ),
        reportKind: "mwms_hr",
        promptKey: "mwms_hr_report_v1",
        promptVersionId: "prompt-version-mwms-hr",
      },
    ];

    for (const testCase of cases) {
      const metadata = buildSingleTestHrPromptAuthorityMetadata(testCase.preparedInput);
      const payload = buildOpenAiStructuredRequestPayload(testCase.preparedInput, {
        apiKey: "sk-test-secret-value",
        model: "gpt-4.1",
        timeoutMs: 120000,
      });

      assertCommonAuthorityMetadata(metadata, {
        ...testCase,
        testSlug: testCase.preparedInput.testSlug,
      });
      assert.deepEqual(payload.authorityMetadata, metadata);
      assert.equal(payload.authorityMetadata.reportFamily, "single_test_hr");
      assert.equal(payload.authorityMetadata.reportKind, testCase.reportKind);
      assert.equal(payload.authorityMetadata.promptSource, "db_prompt_version");
      assert.equal(payload.authorityMetadata.promptVersionId, testCase.promptVersionId);
      assert.equal(payload.authorityMetadata.promptKey, testCase.promptKey);
      assert.equal(payload.requestBody.model, "gpt-4.1");
      assert.equal(typeof payload.systemPrompt, "string");
      assert.equal(typeof payload.userPrompt, "string");

      if (testCase.name === "ipip") {
        assert.equal(
          payload.authorityMetadata.terminologyAuthority?.key,
          "ipip_hr_canonical_terminology",
        );
        assert.equal(
          payload.authorityMetadata.terminologyAuthority?.canonicalAgreeablenessLabel,
          "Spremnost na saradnju",
        );
        assert.equal(
          payload.authorityMetadata.terminologyAuthority?.canonicalAgreeablenessNarrativeLabel,
          "spremnost na saradnju",
        );
      } else {
        assert.equal(payload.authorityMetadata.terminologyAuthority, null);
      }
    }

    console.log("test-single-test-hr-prompt-authority: ok");
  } finally {
    global.fetch = originalFetch;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
