const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
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
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
} = require("../lib/assessment/ipip-neo-120-labels.ts");
const {
  buildPreparedReportGenerationInput,
} = require("../lib/assessment/report-provider-helpers.ts");
const {
  buildOpenAiStructuredRequestPayload,
} = require("../lib/assessment/report-provider-openai.ts");
const {
  buildAiReportDebugDumpRecord,
  maybeWriteAiReportDebugDump,
} = require("../lib/assessment/ai-report-debug-dump.ts");

function buildRequest() {
  const dimensions = [];

  for (const [domainIndex, domainCode] of IPIP_NEO_120_DOMAIN_ORDER.entries()) {
    for (const [facetIndex, facetCode] of IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].entries()) {
      dimensions.push({
        dimension: facetCode,
        rawScore: 4.7 - domainIndex * 0.35 - facetIndex * 0.08,
        scoredQuestionCount: 4,
      });
    }
  }

  return {
    attemptId: "attempt-ipip-hr-prompt-request-authority",
    testId: "test-ipip-hr-prompt-request-authority",
    testSlug: "ipip-neo-120-v1",
    audience: "hr",
    locale: "bs",
    scoringMethod: "likert_mean",
    promptVersion: "ipip_neo_120_hr_v2",
    testName: "IPIP-NEO-120",
    results: {
      attemptId: "attempt-ipip-hr-prompt-request-authority",
      scoringMethod: "likert_mean",
      dimensions,
      scoredResponseCount: 120,
      unscoredResponses: [],
    },
  };
}

function buildPromptTemplate() {
  return {
    id: "prompt-version-ipip-hr-request-authority",
    testId: "test-ipip-hr-prompt-request-authority",
    reportType: "individual",
    audience: "hr",
    sourceType: "single_test",
    generatorType: "openai",
    promptKey: "completed_assessment_report",
    version: "v1_ipip_hr_focused_20260606",
    systemPrompt:
      "DB system prompt with Ugodnost, Saradljivost i handling inside system context.",
    userPromptTemplate:
      "Koristi tačno 5 domain_overview stavki u ovom redoslijedu: Ekstraverzija, Ugodnost, Savjesnost, Neuroticizam, Otvorenost prema iskustvu. Snage i mogući overuse rizici treba da budu jasno opisani. HR handling tip mora ostati praktičan. {{prompt_input_json}}",
    outputSchemaJson: null,
    notes: null,
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:00:00.000Z",
    updatedBy: null,
  };
}

async function main() {
  const originalFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  };

  try {
    const request = buildRequest();
    const preparedInput = buildPreparedReportGenerationInput(request, {
      promptVersionId: "prompt-version-ipip-hr-request-authority",
      promptTemplate: buildPromptTemplate(),
    });
    const payload = buildOpenAiStructuredRequestPayload(preparedInput, {
      apiKey: "sk-test-secret-value",
      model: "gpt-4.1",
      timeoutMs: 120000,
    });

    const agreeablenessDomain = preparedInput.promptInput.domains.find(
      (domain) => domain.domain_code === "AGREEABLENESS",
    );

    assert.equal(agreeablenessDomain?.label, "Spremnost na saradnju");
    assert.equal(payload.requestBody.model, "gpt-4.1");
    assert.equal(payload.requestBody.response_format.type, "json_schema");
    assert.equal(typeof payload.systemPrompt, "string");
    assert.equal(typeof payload.userPrompt, "string");
    assert.equal(payload.requestBody.messages[0].content, payload.systemPrompt);
    assert.equal(payload.requestBody.messages[1].content, payload.userPrompt);
    assert.ok(payload.authorityMetadata);
    assert.equal(payload.authorityMetadata.reportFamily, "single_test_hr");
    assert.equal(payload.authorityMetadata.reportKind, "ipip_hr");
    assert.equal(payload.authorityMetadata.promptSource, "db_prompt_version");
    assert.equal(payload.authorityMetadata.promptVersionId, "prompt-version-ipip-hr-request-authority");
    assert.equal(payload.authorityMetadata.promptVersion, "v1_ipip_hr_focused_20260606");
    assert.equal(payload.authorityMetadata.promptKey, "completed_assessment_report");
    assert.equal(payload.authorityMetadata.reportContractKey, "ipip_neo_120_hr_v2");
    assert.equal(payload.authorityMetadata.reportSchemaName, "ipip-neo-120-hr-v2");
    assert.deepEqual(payload.authorityMetadata.authorityLayers, [
      "global_hr_report_rules",
      "global_terminology_rules",
      "single_test_hr_family_rules",
      "test_specific_rules",
      "runtime_input_facts",
    ]);
    assert.equal(payload.authorityMetadata.terminologyAuthority?.key, "ipip_hr_canonical_terminology");
    assert.equal(payload.authorityMetadata.terminologyAuthority?.canonicalAgreeablenessLabel, "Spremnost na saradnju");
    assert.equal(
      payload.authorityMetadata.terminologyAuthority?.canonicalAgreeablenessNarrativeLabel,
      "spremnost na saradnju",
    );

    const payloadText = JSON.stringify({
      systemPrompt: payload.systemPrompt,
      userPrompt: payload.userPrompt,
      requestBody: payload.requestBody,
      authorityMetadata: payload.authorityMetadata,
    });
    const promptText = `${payload.systemPrompt}\n${payload.userPrompt}`;

    assert.equal(payloadText.includes("Spremnost na saradnju"), true);
    assert.equal(payloadText.includes("Ugodnost"), false);
    assert.equal(payloadText.includes("ugodnost"), false);
    assert.equal(promptText.includes("Saradljivost"), false);
    assert.equal(promptText.includes("saradljivost"), false);
    assert.equal(promptText.includes("Kooperativnost"), false);
    assert.equal(promptText.includes("kooperativnost"), false);
    assert.equal(promptText.includes("overuse"), false);
    assert.equal(promptText.includes("Overuse"), false);
    assert.equal(promptText.includes("handling"), false);
    assert.equal(promptText.includes("Handling"), false);
    assert.equal(/prekomjern\w* oslanjanj\w*/i.test(promptText), true);
    assert.equal(
      payload.userPrompt.includes(
        "Use exactly 5 domain_overview items in this order: Ekstraverzija, Spremnost na saradnju, Savjesnost, Neuroticizam, Otvorenost prema iskustvu.",
      ) || payload.userPrompt.includes(
        "Koristi tačno 5 domain_overview stavki u ovom redoslijedu: Ekstraverzija, Spremnost na saradnju, Savjesnost, Neuroticizam, Otvorenost prema iskustvu.",
      ),
      true,
    );
    assert.equal(
      payload.userPrompt.includes("Snage i mogući rizici prekomjernog oslanjanja"),
      true,
    );
    assert.equal(
      payload.userPrompt.includes("HR smjernica za postupanje"),
      true,
    );

    const dumpRecord = buildAiReportDebugDumpRecord(
      preparedInput,
      {
        provider: "openai",
        model: payload.requestBody.model,
        systemPrompt: payload.systemPrompt,
        renderedUserPrompt: payload.userPrompt,
        requestBody: payload.requestBody,
      },
      {
        now: new Date("2026-06-08T12:34:56.000Z"),
        redactValues: ["sk-test-secret-value"],
      },
    );
    const dumpText = JSON.stringify(dumpRecord);
    const dumpPromptText = `${dumpRecord.system_prompt}\n${dumpRecord.rendered_user_prompt}`;

    assert.equal(dumpText.includes("Spremnost na saradnju"), true);
    assert.equal(dumpText.includes("Ugodnost"), false);
    assert.equal(dumpText.includes("ugodnost"), false);
    assert.equal(dumpPromptText.includes("Saradljivost"), false);
    assert.equal(dumpPromptText.includes("saradljivost"), false);
    assert.equal(dumpPromptText.includes("Kooperativnost"), false);
    assert.equal(dumpPromptText.includes("kooperativnost"), false);
    assert.equal(dumpPromptText.includes("overuse"), false);
    assert.equal(dumpPromptText.includes("Overuse"), false);
    assert.equal(dumpPromptText.includes("handling"), false);
    assert.equal(dumpPromptText.includes("Handling"), false);
    assert.equal(/prekomjern\w* oslanjanj\w*/i.test(dumpPromptText), true);
    assert.equal(dumpRecord.model, "gpt-4.1");
    assert.equal(dumpRecord.prompt_key, "completed_assessment_report");
    assert.equal(dumpRecord.report_contract_key, "ipip_neo_120_hr_v2");
    assert.equal(dumpRecord.report_schema_name, "ipip-neo-120-hr-v2");
    assert.equal(dumpRecord.response_format.type, "json_schema");
    assert.equal(typeof dumpRecord.system_prompt, "string");
    assert.equal(typeof dumpRecord.rendered_user_prompt, "string");
    assert.equal(dumpRecord.authority_metadata.reportFamily, "single_test_hr");
    assert.equal(dumpRecord.authority_metadata.reportKind, "ipip_hr");
    assert.equal(dumpRecord.authority_metadata.promptSource, "db_prompt_version");
    assert.equal(dumpRecord.authority_metadata.promptKey, "completed_assessment_report");
    assert.equal(dumpRecord.authority_metadata.reportContractKey, "ipip_neo_120_hr_v2");
    assert.equal(dumpRecord.authority_metadata.terminologyAuthority.key, "ipip_hr_canonical_terminology");
    assert.equal(fetchCalled, false);

    delete process.env.AI_REPORT_DEBUG_DUMP_PROMPTS;
    let writeCalled = false;
    const dumpWriteResult = await maybeWriteAiReportDebugDump(
      preparedInput,
      {
        provider: "openai",
        model: payload.requestBody.model,
        systemPrompt: payload.systemPrompt,
        renderedUserPrompt: payload.userPrompt,
        requestBody: payload.requestBody,
      },
      {
        tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), "ipip-hr-prompt-request-authority-")),
        now: new Date("2026-06-08T12:34:56.000Z"),
        randomSuffix: "abc123",
        redactValues: ["sk-test-secret-value"],
        writeFile: async () => {
          writeCalled = true;
        },
      },
    );

    assert.equal(dumpWriteResult, null);
    assert.equal(writeCalled, false);
    console.log("test-ipip-hr-prompt-request-authority: ok");
  } finally {
    global.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
