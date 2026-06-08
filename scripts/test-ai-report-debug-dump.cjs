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
  buildOpenAiChatCompletionsRequestBody,
} = require("../lib/assessment/report-provider-openai.ts");
const {
  buildAiReportDebugDumpFilePath,
  maybeWriteAiReportDebugDump,
} = require("../lib/assessment/ai-report-debug-dump.ts");

function buildPreparedInput() {
  return {
    attemptId: "attempt-ai-report-debug-dump",
    testSlug: "ipip-neo-120-v1",
    promptVersion: "v1",
    promptVersionId: "prompt-version-123",
    promptTemplate: {
      id: "prompt-version-123",
      testId: "test-ipip",
      reportType: "individual",
      audience: "hr",
      sourceType: "single_test",
      generatorType: "openai",
      promptKey: "ipip_neo_120_hr_report_v1",
      version: "v1",
      systemPrompt: "DB system prompt",
      userPromptTemplate: "DB user prompt",
      outputSchemaJson: null,
      notes: null,
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
      updatedBy: null,
    },
    promptInput: {
      audience: "hr",
      test_id: "test-ipip",
      test_slug: "ipip-neo-120-v1",
    },
    reportContract: {
      family: "big_five",
      reportType: "individual",
      sourceType: "single_test",
      promptKey: "ipip_neo_120_hr_report_v1",
      schemaName: "ipip-neo-120-hr-v1",
      outputSchemaJson: {},
    },
  };
}

async function main() {
  const preparedInput = buildPreparedInput();
  const requestBody = buildOpenAiChatCompletionsRequestBody(
    {
      apiKey: "sk-test-secret-value",
      model: "gpt-4.1",
      timeoutMs: 120000,
    },
    {
      schemaName: "ipip-neo-120-hr-v1",
      schema: { type: "object" },
      systemPrompt:
        "system prompt with OPENAI_API_KEY, Authorization, Bearer and sk-test-secret-value",
      userPrompt:
        "user prompt with OPENAI_API_KEY, Authorization, Bearer and sk-test-secret-value",
    },
  );
  const dumpOptions = {
    tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), "ai-report-debug-dump-test-")),
    now: new Date("2026-06-08T12:34:56.000Z"),
    randomSuffix: "abc123",
    redactValues: ["sk-test-secret-value"],
  };

  delete process.env.AI_REPORT_DEBUG_DUMP_PROMPTS;

  let offWriteCalled = false;
  const offResult = await maybeWriteAiReportDebugDump(
    preparedInput,
    {
      provider: "openai",
      model: requestBody.model,
      systemPrompt: requestBody.messages[0].content,
      renderedUserPrompt: requestBody.messages[1].content,
      requestBody,
    },
    {
      ...dumpOptions,
      writeFile: async () => {
        offWriteCalled = true;
      },
    },
  );

  assert.equal(offResult, null);
  assert.equal(offWriteCalled, false);

  process.env.AI_REPORT_DEBUG_DUMP_PROMPTS = "true";

  let capturedPath = null;
  let capturedPayload = null;
  const onResult = await maybeWriteAiReportDebugDump(
    preparedInput,
    {
      provider: "openai",
      model: requestBody.model,
      systemPrompt: requestBody.messages[0].content,
      renderedUserPrompt: requestBody.messages[1].content,
      requestBody,
    },
    {
      ...dumpOptions,
      writeFile: async (filePath, data) => {
        capturedPath = filePath;
        capturedPayload = data;
      },
    },
  );

  const expectedPath = buildAiReportDebugDumpFilePath(
    preparedInput,
    {
      provider: "openai",
      model: requestBody.model,
      systemPrompt: requestBody.messages[0].content,
      renderedUserPrompt: requestBody.messages[1].content,
      requestBody,
    },
    dumpOptions,
  );

  assert.equal(onResult, expectedPath);
  assert.equal(capturedPath, expectedPath);
  assert.ok(typeof capturedPayload === "string" && capturedPayload.length > 0);

  const dump = JSON.parse(capturedPayload);
  const dumpText = JSON.stringify(dump);

  assert.equal(dump.timestamp, "2026-06-08T12:34:56.000Z");
  assert.equal(dump.provider, "openai");
  assert.equal(dump.report_lane_id, "big_five/single_test/individual/hr");
  assert.equal(dump.prompt_source, "single_test");
  assert.equal(dump.prompt_version_id, "prompt-version-123");
  assert.equal(dump.prompt_version, "v1");
  assert.equal(dump.prompt_key, "ipip_neo_120_hr_report_v1");
  assert.equal(dump.prompt_template_id, "prompt-version-123");
  assert.equal(dump.prompt_template_version, "v1");
  assert.equal(dump.test_id, "test-ipip");
  assert.equal(dump.test_slug, "ipip-neo-120-v1");
  assert.equal(dump.audience, "hr");
  assert.equal(dump.model, "gpt-4.1");
  assert.equal(dump.authority_metadata.reportFamily, "single_test_hr");
  assert.equal(dump.authority_metadata.reportKind, "ipip_hr");
  assert.equal(dump.authority_metadata.promptSource, "db_prompt_version");
  assert.deepEqual(dump.authority_metadata.authorityLayers, [
    "global_hr_report_rules",
    "global_terminology_rules",
    "single_test_hr_family_rules",
    "test_specific_rules",
    "runtime_input_facts",
  ]);
  assert.equal(dump.system_prompt.includes("OPENAI_API_KEY"), false);
  assert.equal(dump.system_prompt.includes("Authorization"), false);
  assert.equal(dump.system_prompt.includes("Bearer"), false);
  assert.equal(dump.system_prompt.includes("sk-test-secret-value"), false);
  assert.equal(dump.rendered_user_prompt.includes("OPENAI_API_KEY"), false);
  assert.equal(dump.rendered_user_prompt.includes("Authorization"), false);
  assert.equal(dump.rendered_user_prompt.includes("Bearer"), false);
  assert.equal(dump.rendered_user_prompt.includes("sk-test-secret-value"), false);
  assert.equal(dump.request_body.model, "gpt-4.1");
  assert.equal(dump.request_body.response_format.type, "json_schema");
  assert.equal(dump.response_format.type, "json_schema");
  assert.equal(dump.response_format.json_schema.name, "ipip-neo-120-hr-v1");
  assert.equal(dumpText.includes("OPENAI_API_KEY"), false);
  assert.equal(dumpText.includes("Authorization"), false);
  assert.equal(dumpText.includes("Bearer"), false);
  assert.equal(dumpText.includes("sk-test-secret-value"), false);
  assert.equal(path.isAbsolute(capturedPath), true);
  assert.equal(capturedPath.startsWith(dumpOptions.tmpDir), true);
  assert.equal(capturedPath.includes("ai-report-debug-dumps"), true);
  assert.match(capturedPath, /openai-big-five-single-test-individual-hr-single-test-/);

  let warned = false;
  const failureResult = await maybeWriteAiReportDebugDump(
    preparedInput,
    {
      provider: "openai",
      model: requestBody.model,
      systemPrompt: requestBody.messages[0].content,
      renderedUserPrompt: requestBody.messages[1].content,
      requestBody,
    },
    {
      ...dumpOptions,
      writeFile: async () => {
        throw new Error("tmp write failed");
      },
      warn: () => {
        warned = true;
      },
    },
  );

  assert.equal(failureResult, null);
  assert.equal(warned, true);

  delete process.env.AI_REPORT_DEBUG_DUMP_PROMPTS;
  console.log("test-ai-report-debug-dump: ok");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
