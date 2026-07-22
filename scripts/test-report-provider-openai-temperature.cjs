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
  buildOpenAiChatCompletionsRequestBody,
} = require("../lib/assessment/report-provider-openai.ts");
const {
  getAiReportReasoningEffort,
  getAiReportReasoningEffortForModel,
  normalizeAiReportReasoningEffort,
} = require("../lib/assessment/report-config.ts");

function withoutReasoningEffort(callback) {
  const previous = process.env.AI_REPORT_REASONING_EFFORT;
  delete process.env.AI_REPORT_REASONING_EFFORT;

  try {
    return callback();
  } finally {
    if (previous === undefined) {
      delete process.env.AI_REPORT_REASONING_EFFORT;
    } else {
      process.env.AI_REPORT_REASONING_EFFORT = previous;
    }
  }
}

function assertTemperatureBehavior(model, expectedTemperaturePresent) {
  const body = buildOpenAiChatCompletionsRequestBody(
    {
      apiKey: "test-key",
      model,
      timeoutMs: 120000,
    },
    {
      schemaName: "ipip_neo_120_hr_report_v1",
      schema: { type: "object" },
      systemPrompt: "system",
      userPrompt: "user",
    },
  );

  assert.equal(body.model, model);
  assert.equal(body.response_format.type, "json_schema");
  assert.equal(body.response_format.json_schema.name, "ipip_neo_120_hr_report_v1");
  assert.equal(body.messages.length, 2);

  if (expectedTemperaturePresent) {
    assert.equal(body.temperature, 0.2);
  } else {
    assert.equal(Object.prototype.hasOwnProperty.call(body, "temperature"), false);
  }
}

function main() {
  withoutReasoningEffort(() => {
    assertTemperatureBehavior("gpt-5.5", false);
    assertTemperatureBehavior("gpt-5.5-mini", false);
    assertTemperatureBehavior("gpt-4.1", true);

    const unsetBody = buildOpenAiChatCompletionsRequestBody(
      { apiKey: "test-key", model: "gpt-5.6-sol", timeoutMs: 120000 },
      {
        schemaName: "gdt01",
        schema: { type: "object" },
        systemPrompt: "system",
        userPrompt: "user",
      },
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(unsetBody, "reasoning_effort"),
      false,
    );
    assert.equal(Object.prototype.hasOwnProperty.call(unsetBody, "temperature"), false);
    assert.equal(getAiReportReasoningEffort(), null);
    assert.equal(getAiReportReasoningEffortForModel("gpt-4.1"), null);
  });

  const previous = process.env.AI_REPORT_REASONING_EFFORT;
  process.env.AI_REPORT_REASONING_EFFORT = " medium ";

  try {
    assert.equal(getAiReportReasoningEffort(), "medium");
    assert.equal(normalizeAiReportReasoningEffort("unsupported"), null);
    assert.equal(getAiReportReasoningEffortForModel("gpt-5.6-sol"), "medium");

    const gpt56Body = buildOpenAiChatCompletionsRequestBody(
      { apiKey: "test-key", model: "gpt-5.6-sol", timeoutMs: 120000 },
      {
        schemaName: "gdt01",
        schema: { type: "object" },
        systemPrompt: "system",
        userPrompt: "user",
      },
    );
    assert.equal(gpt56Body.reasoning_effort, "medium");
    assert.equal(Object.prototype.hasOwnProperty.call(gpt56Body, "temperature"), false);

    const earlierModelBody = buildOpenAiChatCompletionsRequestBody(
      { apiKey: "test-key", model: "gpt-4.1", timeoutMs: 120000 },
      {
        schemaName: "gdt01",
        schema: { type: "object" },
        systemPrompt: "system",
        userPrompt: "user",
      },
    );
    assert.equal(earlierModelBody.temperature, 0.2);
    assert.equal(
      Object.prototype.hasOwnProperty.call(earlierModelBody, "reasoning_effort"),
      false,
    );
  } finally {
    if (previous === undefined) {
      delete process.env.AI_REPORT_REASONING_EFFORT;
    } else {
      process.env.AI_REPORT_REASONING_EFFORT = previous;
    }
  }

  console.log("test-report-provider-openai-temperature: ok");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
