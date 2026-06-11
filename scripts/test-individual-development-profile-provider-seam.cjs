const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const seamPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "individual-development-profile-provider.ts",
);
const seamSource = fs.readFileSync(seamPath, "utf8");
const openAiProviderSource = fs.readFileSync(
  path.join(
    projectRoot,
    "lib",
    "assessment",
    "individual-development-profile-openai-provider.ts",
  ),
  "utf8",
);
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
  if (request === "server-only" || request === "@/lib/supabase/admin") {
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

assert.match(seamSource, /DEFAULT_INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER/);
assert.match(seamSource, /generateIndividualDevelopmentProfileReport/);
assert.match(seamSource, /generateIndividualDevelopmentProfileWithMock/);
assert.match(seamSource, /generateIndividualDevelopmentProfileWithOpenAi/);
assert.match(seamSource, /getAiReportConfig/);
assert.doesNotMatch(seamSource, /TEAM_FIT_REPORT_PROVIDER/i);
assert.doesNotMatch(seamSource, /\.from\("/);
assert.doesNotMatch(seamSource, /renderer|route|assessment_reports|attempt_reports|team_fit_reports/i);
assert.doesNotMatch(openAiProviderSource, /temperature:\s*0\.2/);

const {
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
} = require("../lib/assessment/individual-development-profile-input.ts");
const {
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
  validateIndividualDevelopmentProfileSnapshot,
} = require("../lib/assessment/individual-development-profile-contract.ts");
const {
  INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_MOCK,
  INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI,
  DEFAULT_INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER,
  generateIndividualDevelopmentProfileReport,
} = require(seamPath);
const {
  generateIndividualDevelopmentProfileWithOpenAi,
  buildIndividualDevelopmentProfileOpenAiSystemPrompt,
  buildIndividualDevelopmentProfileOpenAiUserPrompt,
  buildIndividualDevelopmentProfileOpenAiRequest,
  individualDevelopmentProfileOpenAiSchema,
} = require("../lib/assessment/individual-development-profile-openai-provider.ts");

const mockConfig = {
  provider: "mock",
  model: "gpt-5.1",
  openAiApiKey: "unused",
  openAiTimeoutMs: 120000,
};

const openAiConfig = {
  provider: "openai",
  model: "gpt-5.1",
  openAiApiKey: "test-key",
  openAiTimeoutMs: 45000,
};

function buildInputSnapshot(overrides = {}) {
  return {
    inputType: INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE,
    inputVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
    locale: "bs",
    participant: {
      participantId: "participant-1",
      displayName: "Amina Candidate",
    },
    sourceSignals: {
      personality: {
        sourceStatus: "available",
        summary: "Ličnosni signal je dostupan.",
        relevantSignals: [
          {
            code: "EXTRAVERSION",
            label: "Ekstraverzija",
            signal: "Povišen signal u domeni ekstraverzije vrijedi čitati kao razvojnu hipotezu za saradnju i ritam rada.",
          },
        ],
      },
      motivation: {
        sourceStatus: "available",
        summary: "Motivacijski signal je dostupan.",
        relevantSignals: [
          {
            code: "intrinsic",
            label: "Intrinzična motivacija",
            signal: "Ovaj signal može pomagati angažmanu kada rad ima smisao i vidljiv napredak.",
          },
        ],
      },
      problemSolving: {
        sourceStatus: "available",
        summary: "Problem-solving signal je dostupan.",
        relevantSignals: [
          {
            code: "verbal",
            label: "Verbalno rezonovanje",
            signal: "U ovom setu zadataka signal u domeni verbalnog rezonovanja djeluje stabilno i korisno za dalju provjeru.",
          },
        ],
      },
      composite: {
        sourceStatus: "available",
        summary: "Reduced deterministic composite sažetak je dostupan.",
        integratedSignals: [
          {
            code: "integrated",
            label: "Integrisani signal",
            signal: "Reduced deterministic composite ukazuje da se jasniji razvojni obrazac vidi kada su očekivanja pregledna i podrška operativna.",
          },
        ],
      },
    },
    interpretationLimits: [
      "Input snapshot sadrži reduced HR-safe deterministic signale, ne raw answers i ne full upstream snapshotove.",
    ],
    sourceMetadata: {
      assessmentAssignmentId: "assignment-1",
      sourceVersions: [],
    },
    ...overrides,
  };
}

async function main() {
  assert.equal(INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_MOCK, "mock");
  assert.equal(INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI, "openai");
  assert.equal(DEFAULT_INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER, "mock");

  const validInput = buildInputSnapshot();
  const validResult = await generateIndividualDevelopmentProfileReport(validInput, {
    config: mockConfig,
    loadRuntimeConfig: async () => {
      throw new Error("Mock provider must not load OpenAI runtime config.");
    },
  });

  assert.equal(validResult.ok, true, validResult.ok ? undefined : validResult.errors.join(" | "));

  if (!validResult.ok) {
    throw new Error("Expected provider seam to return a valid mock report.");
  }

  assert.equal(validResult.provider, "mock");
  assert.equal(validResult.modelName, null);
  assert.equal(validResult.reportSnapshot.reportType, INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE);
  assert.equal(
    validResult.reportSnapshot.reportVersion,
    INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
  );
  assert.equal(validResult.reportSnapshot.audience, INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE);

  const validated = validateIndividualDevelopmentProfileSnapshot(validResult.reportSnapshot);
  assert.equal(validated.ok, true, validated.ok ? undefined : validated.errors.join(" | "));

  const invalidInput = buildInputSnapshot({
    inputType: "team_fit_report_input_v2_enriched",
  });
  const invalidResult = await generateIndividualDevelopmentProfileReport(invalidInput, {
    config: mockConfig,
  });

  assert.equal(invalidResult.ok, false);
  if (invalidResult.ok) {
    throw new Error("Expected invalid input to produce controlled failure.");
  }

  assert.equal(invalidResult.provider, "mock");
  assert.equal(invalidResult.reason, "invalid_input");
  assert.equal(Array.isArray(invalidResult.errors), true);
  assert.equal(invalidResult.errors.length > 0, true);

  const openAiOperations = [];
  const openAiResult = await generateIndividualDevelopmentProfileReport(validInput, {
    config: openAiConfig,
    runtimeConfig: {
      modelName: "gpt-5.1",
      temperature: 0.2,
    },
    openAiOptions: {
      now: () => "2026-06-10T12:00:00.000Z",
      client: {
        async createChatCompletion(request) {
          openAiOperations.push(request);
          return {
            content: JSON.stringify(validResult.reportSnapshot),
          };
        },
      },
    },
  });

  assert.equal(openAiResult.ok, true);
  if (!openAiResult.ok) {
    throw new Error(openAiResult.errors.join(" | "));
  }

  assert.equal(openAiResult.provider, "openai");
  assert.equal(openAiResult.modelName, "gpt-5.1");
  assert.equal(openAiResult.reportSnapshot.metadata.generatorType, "openai");
  assert.equal(
    openAiResult.reportSnapshot.metadata.generatorVersion,
    "individual_development_profile_openai_v1",
  );
  assert.equal(openAiOperations.length, 1);
  assert.equal(openAiOperations[0].model, "gpt-5.1");
  assert.equal(openAiOperations[0].temperature, 0.2);
  assert.equal(openAiOperations[0].response_format.type, "json_schema");
  assert.equal(openAiOperations[0].response_format.json_schema.strict, true);
  assert.deepEqual(
    openAiOperations[0].response_format.json_schema.schema,
    individualDevelopmentProfileOpenAiSchema,
  );
  assert.deepEqual(
    openAiOperations[0],
    buildIndividualDevelopmentProfileOpenAiRequest({
      inputSnapshot: validInput,
      model: "gpt-5.1",
      temperature: 0.2,
    }),
  );

  const systemPrompt = openAiOperations[0].messages[0].content;
  const userPrompt = openAiOperations[0].messages[1].content;

  for (const pattern of [
    /Bosnian/i,
    /ijekavica/i,
    /Latin script/i,
    /professional.*HR tone/i,
    /Spremnost na saradnju/i,
    /ugodnost/i,
    /HR-facing/i,
    /reduced/i,
    /AI narativ/i,
    /numeric/i,
    /source/i,
    /metadata/i,
    /snapshot/i,
    /ti.*tvoj/i,
    /raw\/internal source metadata/i,
    /signal.*repeated/i,
    /Every section must serve its own purpose/i,
    /oneOnOneGuidance\[\]\.possibleFollowUp.*must be an open HR\/manager question/i,
    /possibleFollowUp must not be a statement, advice, imperative/i,
    /Koji uslovi rada vam najviše pomažu.*\?/i,
    /Kako prepoznajete da vam je povratna informacija.*\?/i,
    /IDP-specific authoring standard/,
    /assessment evidence → work pattern → managerial implication → concrete action/,
    /Assessment findings are evidence, not the final narrative structure/,
    /Do not copy the wording, order, caution pattern or sentence rhythm of the input snapshot/,
    /postepena izloženost grupnim situacijama/,
    /Write as a senior HR development advisor/,
    /The headline and overall summary must not list domains, scores, bands or tests/,
    /The usage note should be short, calm and secondary/,
  ]) {
    assert.match(systemPrompt, pattern);
  }

  const parsedUserPrompt = JSON.parse(userPrompt);
  const segmentGuidance =
    parsedUserPrompt.contentContract.creationStandard.segmentGuidance;

  assert.match(userPrompt, /sectionDistinctness/);
  assert.match(userPrompt, /signal sugeriše/);
  assert.match(userPrompt, /possibleFollowUp must be an open HR\/manager question/i);
  assert.match(userPrompt, /must end with \\"\?\\"/i);
  assert.match(userPrompt, /statement, advice, imperative/i);
  assert.match(userPrompt, /individual_development_profile_input_v1/);
  assert.equal(segmentGuidance.standard, "IDP segment-level writing standard");
  assert.match(
    segmentGuidance.developmentSummary.purpose,
    /executive HR entry point.*immediate practical value/i,
  );
  assert.match(
    segmentGuidance.onboardingPlan.purpose,
    /concrete, staged and manager-actionable/i,
  );
  assert.match(
    segmentGuidance.managerWatchpoints.suggestedManagerResponse,
    /concrete manager action.*Do not diagnose/i,
  );

  const developmentSummarySchema =
    individualDevelopmentProfileOpenAiSchema.properties.developmentSummary.properties;
  const onboardingPlanSchema =
    individualDevelopmentProfileOpenAiSchema.properties.onboardingPlan.properties;
  const managerWatchpointSchema =
    individualDevelopmentProfileOpenAiSchema.properties.managerWatchpoints.items
      .properties;
  assert.match(
    developmentSummarySchema.headline.description,
    /HR-development angle.*do not list domains, scores, bands or tests/i,
  );
  assert.match(
    developmentSummarySchema.overallPattern.description,
    /workplace-oriented synthesis.*managerial implication/i,
  );
  assert.match(
    developmentSummarySchema.usageNote.description,
    /short, calm and secondary.*must not dominate/i,
  );
  assert.match(
    onboardingPlanSchema.summary.description,
    /person-specific onboarding logic.*manager-actionable/i,
  );
  assert.match(
    managerWatchpointSchema.suggestedManagerResponse.description,
    /concrete manager action.*without diagnosing/i,
  );

  const possibleFollowUpSchema =
    individualDevelopmentProfileOpenAiSchema.properties.oneOnOneGuidance.items
      .properties.possibleFollowUp;
  assert.match(possibleFollowUpSchema.description, /open HR\/manager question/i);
  assert.match(possibleFollowUpSchema.description, /must end with "\?"/i);
  assert.match(
    possibleFollowUpSchema.description,
    /must not be a statement, advice, imperative, title or conversation topic/i,
  );
  assert.match(
    possibleFollowUpSchema.description,
    /Koji uslovi rada vam najviše pomažu.*\?/i,
  );
  assert.equal(
    validateIndividualDevelopmentProfileSnapshot(openAiResult.reportSnapshot).ok,
    true,
  );

  const gpt55Operations = [];
  const gpt55Result = await generateIndividualDevelopmentProfileReport(validInput, {
    config: {
      ...openAiConfig,
      model: "gpt-5.5",
    },
    runtimeConfig: {
      modelName: "gpt-5.5",
      temperature: null,
    },
    openAiOptions: {
      client: {
        async createChatCompletion(request) {
          gpt55Operations.push(request);
          return {
            content: JSON.stringify(validResult.reportSnapshot),
          };
        },
      },
    },
  });
  assert.equal(gpt55Result.ok, true);
  assert.equal(gpt55Operations.length, 1);
  assert.equal(gpt55Operations[0].model, "gpt-5.5");
  assert.equal(
    Object.prototype.hasOwnProperty.call(gpt55Operations[0], "temperature"),
    false,
  );
  assert.deepEqual(
    gpt55Operations[0],
    buildIndividualDevelopmentProfileOpenAiRequest({
      inputSnapshot: validInput,
      model: "gpt-5.5",
      temperature: null,
    }),
  );

  const numericTemperatureOperations = [];
  const numericTemperatureResult =
    await generateIndividualDevelopmentProfileReport(validInput, {
      config: {
        ...openAiConfig,
        model: "gpt-4.1",
      },
      runtimeConfig: {
        modelName: "gpt-4.1",
        temperature: 0.35,
      },
      openAiOptions: {
        client: {
          async createChatCompletion(request) {
            numericTemperatureOperations.push(request);
            return {
              content: JSON.stringify(validResult.reportSnapshot),
            };
          },
        },
      },
    });
  assert.equal(numericTemperatureResult.ok, true);
  assert.equal(numericTemperatureOperations.length, 1);
  assert.equal(numericTemperatureOperations[0].model, "gpt-4.1");
  assert.equal(numericTemperatureOperations[0].temperature, 0.35);

  const runtimeConfigLoads = [];
  const forwardedOptions = [];
  const runtimeConfiguredResult =
    await generateIndividualDevelopmentProfileReport(validInput, {
      config: openAiConfig,
      loadRuntimeConfig: async (selector) => {
        runtimeConfigLoads.push(selector);
        return {
          modelName: "gpt-5.5",
          temperature: null,
        };
      },
      generateOpenAi: async (_input, options) => {
        forwardedOptions.push(options);
        return {
          ok: true,
          reportSnapshot: validResult.reportSnapshot,
          modelName: options.model,
        };
      },
    });
  assert.equal(runtimeConfiguredResult.ok, true);
  assert.deepEqual(runtimeConfigLoads, [
    {
      reportType: "individual_development_profile",
      audience: "hr",
      sourceType: "assessment",
      generatorType: "openai",
    },
  ]);
  assert.equal(forwardedOptions[0].model, "gpt-5.5");
  assert.equal(forwardedOptions[0].timeoutMs, 45000);
  assert.equal(forwardedOptions[0].temperature, null);

  const directPrompt = buildIndividualDevelopmentProfileOpenAiSystemPrompt();
  assert.equal(directPrompt, systemPrompt);
  assert.match(
    buildIndividualDevelopmentProfileOpenAiUserPrompt(validInput),
    /Spremnost na saradnju/,
  );

  const invalidJsonResult = await generateIndividualDevelopmentProfileWithOpenAi(
    validInput,
    {
      apiKey: "test-key",
      model: "gpt-5.1",
      client: {
        async createChatCompletion() {
          return { content: "{not-json" };
        },
      },
    },
  );
  assert.equal(invalidJsonResult.ok, false);
  assert.equal(invalidJsonResult.reason, "parse_failure");

  const originalNodeEnv = process.env.NODE_ENV;
  const originalConsoleError = console.error;
  const diagnosticValue =
    "Ovaj kandidat sigurno pokazuje da će uvijek biti najbolji izbor za svaku buduću ulogu.";
  const invalidOpenAiSnapshot = JSON.parse(
    JSON.stringify(validResult.reportSnapshot),
  );
  invalidOpenAiSnapshot.developmentRisks[0].possibleBlocker = diagnosticValue;
  const developmentDiagnostics = [];

  try {
    process.env.NODE_ENV = "development";
    console.error = (...args) => {
      developmentDiagnostics.push(args.map(String).join(" "));
    };

    const developmentValidationResult =
      await generateIndividualDevelopmentProfileWithOpenAi(validInput, {
        apiKey: "test-key",
        model: "gpt-5.1",
        client: {
          async createChatCompletion() {
            return { content: JSON.stringify(invalidOpenAiSnapshot) };
          },
        },
      });

    assert.equal(developmentValidationResult.ok, false);
    assert.equal(developmentValidationResult.reason, "validation_failed");
    assert.match(
      developmentValidationResult.errors.join(" "),
      /developmentRisks\[0\]\.possibleBlocker/,
    );
    assert.match(developmentValidationResult.errors.join(" "), /Offending value:/);
    assert.match(developmentValidationResult.errors.join(" "), new RegExp(diagnosticValue));
    assert.match(
      developmentDiagnostics.join(" "),
      /\[IDP OpenAI validation diagnostic\]/,
    );
    assert.match(developmentDiagnostics.join(" "), new RegExp(diagnosticValue));

    process.env.NODE_ENV = "production";

    const productionValidationResult =
      await generateIndividualDevelopmentProfileWithOpenAi(validInput, {
        apiKey: "test-key",
        model: "gpt-5.1",
        client: {
          async createChatCompletion() {
            return { content: JSON.stringify(invalidOpenAiSnapshot) };
          },
        },
      });

    assert.equal(productionValidationResult.ok, false);
    assert.equal(productionValidationResult.reason, "validation_failed");
    assert.match(
      productionValidationResult.errors.join(" "),
      /developmentRisks\[0\]\.possibleBlocker/,
    );
    assert.doesNotMatch(productionValidationResult.errors.join(" "), /Offending value:/);
    assert.doesNotMatch(
      productionValidationResult.errors.join(" "),
      new RegExp(diagnosticValue),
    );
  } finally {
    console.error = originalConsoleError;

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }

  const missingConfigResult = await generateIndividualDevelopmentProfileReport(
    validInput,
    {
      config: {
        ...openAiConfig,
        openAiApiKey: null,
      },
      runtimeConfig: {
        modelName: "gpt-5.1",
        temperature: 0.2,
      },
    },
  );
  assert.equal(missingConfigResult.ok, false);
  assert.equal(missingConfigResult.provider, "openai");
  assert.equal(missingConfigResult.reason, "provider_failed");
  assert.match(missingConfigResult.errors.join(" "), /OPENAI_API_KEY/);

  console.log("test-individual-development-profile-provider-seam: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
