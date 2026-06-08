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
      promptVersionId: null,
      promptTemplate: null,
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

    const payloadText = JSON.stringify({
      systemPrompt: payload.systemPrompt,
      userPrompt: payload.userPrompt,
      requestBody: payload.requestBody,
    });

    assert.equal(payloadText.includes("Spremnost na saradnju"), true);
    assert.equal(payloadText.includes("Ugodnost"), false);
    assert.equal(payloadText.includes("ugodnost"), false);

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

    assert.equal(dumpText.includes("Spremnost na saradnju"), true);
    assert.equal(dumpText.includes("Ugodnost"), false);
    assert.equal(dumpText.includes("ugodnost"), false);
    assert.equal(dumpRecord.model, "gpt-4.1");
    assert.equal(dumpRecord.response_format.type, "json_schema");
    assert.equal(typeof dumpRecord.system_prompt, "string");
    assert.equal(typeof dumpRecord.rendered_user_prompt, "string");
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
