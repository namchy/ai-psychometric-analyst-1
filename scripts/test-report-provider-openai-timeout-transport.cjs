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

const providerPath = path.join(projectRoot, "lib", "assessment", "report-provider-openai.ts");
const providerSource = fs.readFileSync(providerPath, "utf8");
const transportHelperPath = path.join(projectRoot, "lib", "assessment", "openai-fetch-transport.ts");
const transportHelperSource = fs.readFileSync(transportHelperPath, "utf8");

assert.match(providerSource, /resolveOpenAiFetchTransport/);
assert.match(providerSource, /transport\.fetchImpl/);
assert.match(transportHelperSource, /headersTimeout:\s*timeoutMs/);
assert.match(transportHelperSource, /bodyTimeout:\s*timeoutMs/);
assert.match(transportHelperSource, /fetchImplementation:\s*"undici\.fetch"/);
assert.doesNotMatch(transportHelperSource, /headersTimeout:\s*300000|bodyTimeout:\s*300000/);

const {
  buildOpenAiChatCompletionsRequestBody,
} = require(providerPath);
const {
  buildOpenAiFetchRequestInit,
  resolveOpenAiFetchTransport,
} = require(transportHelperPath);

function main() {
  const requestBody = buildOpenAiChatCompletionsRequestBody(
    {
      apiKey: "test-key",
      model: "gpt-5.5",
      timeoutMs: 900000,
    },
    {
      schemaName: "ipip-neo-120-participant-v2",
      schema: { type: "object" },
      systemPrompt: "system",
      userPrompt: "user",
    },
  );

  const controller = new AbortController();
  const dispatcher = { kind: "undici-agent-like" };
  const requestInit = buildOpenAiFetchRequestInit({
    apiKey: "test-key",
    requestBody,
    signal: controller.signal,
    dispatcher,
  });

  assert.equal(requestInit.method, "POST");
  assert.equal(requestInit.cache, "no-store");
  assert.equal(requestInit.signal, controller.signal);
  assert.equal(requestInit.dispatcher, dispatcher);
  assert.equal(requestInit.headers["Content-Type"], "application/json");
  assert.equal(requestInit.headers.Authorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(requestInit.body), requestBody);
  assert.equal(
    requestBody.response_format.json_schema.name,
    "ipip-neo-120-participant-v2",
  );

  const transport = resolveOpenAiFetchTransport(45000, {
    fetch: async () => ({ ok: true }),
    Agent: function Agent(options) {
      this.options = options;
    },
  });
  assert.equal(transport.fetchImplementation, "undici.fetch");
  assert.equal(transport.transportTimeoutApplied, true);
  assert.equal(transport.transportHeadersTimeoutMs, 45000);
  assert.equal(transport.transportBodyTimeoutMs, 45000);
  assert.deepEqual(transport.dispatcher.options, {
    headersTimeout: 45000,
    bodyTimeout: 45000,
  });

  const withoutDispatcherTransport = resolveOpenAiFetchTransport(45000, {
    fetch: async () => ({ ok: true }),
    Agent: undefined,
  });
  const withoutDispatcher = buildOpenAiFetchRequestInit({
    apiKey: "test-key",
    requestBody,
    signal: controller.signal,
    dispatcher: withoutDispatcherTransport.dispatcher,
  });

  assert.equal(Object.prototype.hasOwnProperty.call(withoutDispatcher, "dispatcher"), false);
  assert.deepEqual(JSON.parse(withoutDispatcher.body), requestBody);

  console.log("test-report-provider-openai-timeout-transport: ok");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}
