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
    const resolvedPath = `${candidatePath}${extension}`;

    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
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

const { getAiReportConfig } = require("../lib/assessment/report-config.ts");
const {
  buildStandardReportGenerationOverrides,
} = require("../lib/assessment/report-job-worker.ts");
const {
  buildOpenAiChatCompletionsRequestBody,
} = require("../lib/assessment/report-provider-openai.ts");
const {
  generateCompositeHrReportSnapshot,
} = require("../lib/assessment/composite-hr-report-provider.ts");
const {
  generateIndividualDevelopmentProfileReport,
} = require("../lib/assessment/individual-development-profile-provider.ts");
const {
  generateTeamDynamicsExecutiveOverviewWithOpenAI,
} = require("../lib/b2b/team-dynamics-executive-overview-openai.ts");

const EXPECTED = {
  provider: "openai",
  model: "gpt-5.6-sol",
  reasoningEffort: "medium",
  timeoutMs: 600000,
  fallbackToMock: false,
};

function withEnvironment(values, callback) {
  const previous = {};

  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function assertEffectiveRequest(name, request) {
  assert.equal(request.model, EXPECTED.model, `${name} must use the env model`);
  assert.equal(
    request.reasoning_effort,
    EXPECTED.reasoningEffort,
    `${name} must use the env reasoning effort`,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(request, "temperature"),
    false,
    `${name} must omit temperature for gpt-5.6-sol`,
  );
}

async function main() {
  await withEnvironment(
    {
      AI_REPORT_PROVIDER: EXPECTED.provider,
      AI_REPORT_MODEL: EXPECTED.model,
      AI_REPORT_REASONING_EFFORT: EXPECTED.reasoningEffort,
      AI_REPORT_OPENAI_TIMEOUT_MS: String(EXPECTED.timeoutMs),
      AI_REPORT_FALLBACK_TO_MOCK: "false",
      OPENAI_API_KEY: "offline-test-key",
    },
    async () => {
      const config = getAiReportConfig();
      assert.deepEqual(
        {
          provider: config.provider,
          model: config.model,
          reasoningEffort: config.reasoningEffort,
          timeoutMs: config.openAiTimeoutMs,
          fallbackToMock: config.fallbackToMock,
        },
        EXPECTED,
      );

      const standardOverrides = buildStandardReportGenerationOverrides("v2", {
        promptVersionId: "prompt-id",
      });
      assert.deepEqual(
        {
          provider: standardOverrides.provider,
          model: standardOverrides.model,
          reasoningEffort: standardOverrides.reasoningEffort,
          timeoutMs: standardOverrides.openAiTimeoutMs,
          fallbackToMock: standardOverrides.fallbackToMock,
        },
        EXPECTED,
        "standard worker overrides must be env-derived",
      );

      const standardRequest = buildOpenAiChatCompletionsRequestBody(
        {
          apiKey: config.openAiApiKey,
          model: standardOverrides.model,
          reasoningEffort: standardOverrides.reasoningEffort,
          timeoutMs: standardOverrides.openAiTimeoutMs,
        },
        {
          schemaName: "standard-ai-report",
          schema: { type: "object" },
          systemPrompt: "system",
          userPrompt: "user",
        },
      );
      assertEffectiveRequest("standard report", standardRequest);

      let compositeOptions;
      await generateCompositeHrReportSnapshot({}, {
        config,
        generateOpenAiReport: async (_input, options) => {
          compositeOptions = options;
          return {};
        },
      });
      assert.deepEqual(compositeOptions, {
        apiKey: config.openAiApiKey,
        model: EXPECTED.model,
        reasoningEffort: EXPECTED.reasoningEffort,
        timeoutMs: EXPECTED.timeoutMs,
      });

      let idpOptions;
      const idpResult = await generateIndividualDevelopmentProfileReport({}, {
        config,
        runtimeConfig: {
          modelName: "gpt-5.5",
          temperature: 0.2,
        },
        generateOpenAi: async (_input, options) => {
          idpOptions = options;
          return {
            ok: true,
            reportSnapshot: {},
            modelName: options.model,
          };
        },
      });
      assert.equal(idpResult.ok, true);
      assert.deepEqual(
        {
          apiKey: idpOptions.apiKey,
          model: idpOptions.model,
          reasoningEffort: idpOptions.reasoningEffort,
          timeoutMs: idpOptions.timeoutMs,
          temperature: idpOptions.temperature,
        },
        {
          apiKey: config.openAiApiKey,
          model: EXPECTED.model,
          reasoningEffort: EXPECTED.reasoningEffort,
          timeoutMs: EXPECTED.timeoutMs,
          temperature: null,
        },
        "IDP must ignore stale DB runtime model and temperature",
      );

      let teamDynamicsRequest;
      const teamDynamicsResult = await generateTeamDynamicsExecutiveOverviewWithOpenAI(
        {},
        {
          apiKey: config.openAiApiKey,
          model: config.model,
          reasoningEffort: config.reasoningEffort,
          timeoutMs: config.openAiTimeoutMs,
          client: {
            async createChatCompletion(request) {
              teamDynamicsRequest = request;
              throw new Error("offline capture");
            },
          },
        },
      );
      assert.equal(teamDynamicsResult.ok, false);
      assertEffectiveRequest("Team Dynamics", teamDynamicsRequest);

      const teamAssessmentsSource = fs.readFileSync(
        path.join(projectRoot, "app/actions/team-assessments.ts"),
        "utf8",
      );
      assert.match(teamAssessmentsSource, /const config = getAiReportConfig\(\);/);
      assert.match(teamAssessmentsSource, /reasoningEffort: config\.reasoningEffort/);
      assert.match(teamAssessmentsSource, /generateTeamFitReportV2WithOpenAI\(inputSnapshot, \{/);

      const productionSources = [
        "lib/assessment/report-job-worker.ts",
        "lib/assessment/report-provider-registry.ts",
        "lib/assessment/composite-hr-report-provider.ts",
        "lib/assessment/individual-development-profile-provider.ts",
        "lib/b2b/team-dynamics-report-lifecycle.ts",
        "app/actions/team-assessments.ts",
      ];
      const directEnvPattern = /process\.env\.(AI_REPORT_PROVIDER|AI_REPORT_MODEL|AI_REPORT_REASONING_EFFORT|AI_REPORT_OPENAI_TIMEOUT_MS|OPENAI_API_KEY|AI_REPORT_FALLBACK_TO_MOCK)/;

      for (const relativePath of productionSources) {
        const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
        assert.doesNotMatch(
          source,
          directEnvPattern,
          `${relativePath} must use getAiReportConfig instead of direct env authority`,
        );
      }

      withEnvironment({ AI_REPORT_MODEL: undefined }, () => {
        const missingModelConfig = getAiReportConfig();
        assert.equal(missingModelConfig.model, null);
        assert.throws(
          () =>
            buildOpenAiChatCompletionsRequestBody(
              {
                apiKey: missingModelConfig.openAiApiKey,
                model: missingModelConfig.model,
                reasoningEffort: missingModelConfig.reasoningEffort,
              },
              {
                schemaName: "standard-ai-report",
                schema: { type: "object" },
                systemPrompt: "system",
                userPrompt: "user",
              },
            ),
          /Missing required env var: AI_REPORT_MODEL/,
        );
      });

      withEnvironment({ AI_REPORT_REASONING_EFFORT: "unsupported" }, () => {
        const invalidReasoningConfig = getAiReportConfig();
        assert.equal(invalidReasoningConfig.reasoningEffort, null);
        const request = buildOpenAiChatCompletionsRequestBody(
          {
            apiKey: config.openAiApiKey,
            model: config.model,
            reasoningEffort: invalidReasoningConfig.reasoningEffort,
          },
          {
            schemaName: "standard-ai-report",
            schema: { type: "object" },
            systemPrompt: "system",
            userPrompt: "user",
          },
        );
        assert.equal(Object.prototype.hasOwnProperty.call(request, "reasoning_effort"), false);
      });
    },
  );

  console.log("test-global-ai-runtime-env-authority: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
