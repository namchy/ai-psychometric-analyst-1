const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const providerPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-openai-provider.ts");
const contractPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-contract.ts");
const mockPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-mock.ts");
const providerSource = fs.readFileSync(providerPath, "utf8");
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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

assert.match(providerSource, /export async function generateTeamFitReportWithOpenAI/);
assert.match(providerSource, /createTeamFitOpenAiProvider/);
assert.match(providerSource, /validateTeamFitReportSnapshot/);
assert.match(providerSource, /response_format:\s*\{\s*type:\s*"json_schema"/);
assert.doesNotMatch(providerSource, /\.from\("/);
assert.doesNotMatch(providerSource, /attempt_reports|assessment_reports|team_assessment_reports/);
assert.doesNotMatch(providerSource, /processTeamFitReportWithProvider|claimTeamFitReportForProcessing/);

const {
  generateTeamFitReportWithOpenAI,
  createTeamFitOpenAiProvider,
  TEAM_FIT_OPENAI_PROVIDER,
  TEAM_FIT_OPENAI_PROVIDER_VERSION,
} = require(providerPath);
const { validateTeamFitReportSnapshot } = require(contractPath);
const { buildMockTeamFitReportSnapshot } = require(mockPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildInputSnapshot() {
  return {
    inputType: "team_fit_report_input_v1",
    inputVersion: "team_fit_report_input_v1",
    reportType: "team_fit_report_v1",
    reportVersion: "v1",
    locale: "bs",
    generatedAt: "2026-05-31T10:00:00.000Z",
    organizationContext: {
      organizationId: "org-1",
      organizationName: "Deep Profile",
    },
    teamContext: {
      teamId: "team-1",
      teamName: "Delivery Team",
      teamSourceType: "team_dynamics_aggregation_input_snapshot",
      teamSourceId: "team-source-1",
    },
    candidateContext: {
      participantId: "participant-1",
      displayName: "Amina Candidate",
      candidateSourceType: "composite_deterministic_input_snapshot",
      candidateSourceId: "candidate-source-1",
    },
    sourceReferences: {
      teamFitReportId: "team-fit-report-1",
      candidateSourceType: "composite_deterministic_input_snapshot",
      candidateSourceId: "candidate-source-1",
      teamSourceType: "team_dynamics_aggregation_input_snapshot",
      teamSourceId: "team-source-1",
      executiveOverviewContextIncluded: false,
      roleContextIncluded: false,
    },
    candidateSignals: {
      sourceStatus: "available",
      summary: {
        developmentTheme: "Potreban je jasan radni okvir.",
      },
      candidateEvidence: [
        {
          sourceTestSlug: "ipip-neo-120-v1",
          dimensionCode: "NEUROTICISM",
          dimensionLabel: "Neuroticizam",
          averageScore: 2.13,
          scaleMin: 1,
          scaleMax: 5,
          band: "lower",
          bandLabel: "Niže izraženo",
        },
        {
          sourceTestSlug: "safran_v1",
          dimensionCode: "verbal",
          dimensionLabel: "Verbal",
          rawScore: 8,
          maxScore: 10,
          band: "higher",
          bandLabel: "Više izraženo",
        },
        {
          sourceTestSlug: "mwms_v1",
          dimensionCode: "intrinsic",
          dimensionLabel: "Intrinsic motivation",
          rawScore: 5,
          scaleMin: 1,
          scaleMax: 7,
          band: "higher",
          bandLabel: "Više izraženo",
        },
      ],
      sourceMetadata: {
        sourceId: "candidate-source-1",
        sourceTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
      },
    },
    teamSignals: {
      sourceStatus: "available",
      summary: {
        teamTheme: "Tim traži jasno usklađivanje očekivanja.",
      },
    },
    interpretationGuardrails: {
      noNumericFitScore: true,
      noHireNoHire: true,
      noRawTeamMemberAnswers: true,
      noIndividualTeamMemberScoreDisplay: true,
      noCandidateFacingOutput: true,
    },
  };
}

function buildFakeClient(content, operations) {
  return {
    async createChatCompletion(request) {
      operations.push(request);
      return { content };
    },
  };
}

async function main() {
  const inputSnapshot = buildInputSnapshot();
  const validSnapshot = buildMockTeamFitReportSnapshot(inputSnapshot);
  validSnapshot.metadata.provider = TEAM_FIT_OPENAI_PROVIDER;
  validSnapshot.metadata.providerVersion = TEAM_FIT_OPENAI_PROVIDER_VERSION;

  const operations = [];
  const validResult = await generateTeamFitReportWithOpenAI(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.1",
    client: buildFakeClient(JSON.stringify(validSnapshot), operations),
    now: () => "2026-05-31T10:05:00.000Z",
  });

  assert.equal(validResult.ok, true);
  if (!validResult.ok) {
    throw new Error(validResult.reason);
  }

  assert.equal(validResult.provider, TEAM_FIT_OPENAI_PROVIDER);
  assert.equal(validResult.providerVersion, TEAM_FIT_OPENAI_PROVIDER_VERSION);
  assert.equal(validResult.modelName, "gpt-5.1");
  assert.equal(operations.length, 1);
  assert.equal(operations[0].response_format.type, "json_schema");
  assert.match(operations[0].messages[0].content, /numeric fit score/i);
  assert.match(operations[0].messages[1].content, /No hire\/no-hire language/i);
  assert.match(operations[0].messages[0].content, /relational hypotheses/i);
  assert.match(operations[0].messages[0].content, /relationshipPattern must never read like a score, rank, verdict, decision or recommendation/i);
  assert.match(operations[0].messages[0].content, /Samostalno izvedi relacione hipoteze/i);
  assert.match(operations[0].messages[1].content, /No final bad-fit judgment/i);
  assert.match(operations[0].messages[0].content, /validirane determinističke rezultate kandidata/i);
  assert.match(operations[0].messages[1].content, /ipip-neo-120-v1/);
  assert.match(operations[0].messages[1].content, /safran_v1/);
  assert.match(operations[0].messages[1].content, /mwms_v1/);
  assert.doesNotMatch(operations[0].messages[1].content, /To upućuje na|snažnije oslanjanje na planiranje|nižu emocionalnu reaktivnost u strukturiranim radnim uslovima|može podržati|kandidat vjerovatno/i);
  assert.deepEqual(validResult.snapshot.source.candidateSourceTestSlugs, [
    "ipip-neo-120-v1",
    "safran_v1",
    "mwms_v1",
  ]);
  assert.equal(validateTeamFitReportSnapshot(validResult.snapshot).ok, true);

  const previousReasoningEffort = process.env.AI_REPORT_REASONING_EFFORT;
  process.env.AI_REPORT_REASONING_EFFORT = "medium";
  try {
    const gpt56Operations = [];
    const gpt56Result = await generateTeamFitReportWithOpenAI(inputSnapshot, {
      apiKey: "test-key",
      model: "gpt-5.6-sol",
      client: buildFakeClient(JSON.stringify(validSnapshot), gpt56Operations),
      now: () => "2026-05-31T10:05:30.000Z",
    });

    assert.equal(gpt56Result.ok, true);
    assert.equal(gpt56Operations.length, 1);
    assert.equal(gpt56Operations[0].reasoning_effort, "medium");
    assert.equal(
      Object.prototype.hasOwnProperty.call(gpt56Operations[0], "temperature"),
      false,
    );
  } finally {
    if (previousReasoningEffort === undefined) {
      delete process.env.AI_REPORT_REASONING_EFFORT;
    } else {
      process.env.AI_REPORT_REASONING_EFFORT = previousReasoningEffort;
    }
  }

  const invalidJsonResult = await generateTeamFitReportWithOpenAI(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.1",
    client: buildFakeClient("{not-json", []),
    now: () => "2026-05-31T10:06:00.000Z",
  });
  assert.equal(invalidJsonResult.ok, false);
  if (invalidJsonResult.ok) {
    throw new Error("Expected parse failure.");
  }
  assert.equal(invalidJsonResult.code, "parse_failure");

  const invalidContractSnapshot = clone(validSnapshot);
  delete invalidContractSnapshot.fitOverview;
  const invalidContractResult = await generateTeamFitReportWithOpenAI(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.1",
    client: buildFakeClient(JSON.stringify(invalidContractSnapshot), []),
    now: () => "2026-05-31T10:07:00.000Z",
  });
  assert.equal(invalidContractResult.ok, false);
  if (invalidContractResult.ok) {
    throw new Error("Expected validation failure.");
  }
  assert.equal(invalidContractResult.code, "validation_failure");
  assert.equal(
    invalidContractResult.validationErrors.some((error) => /fitOverview/.test(error)),
    true,
  );

  const forbiddenSnapshot = clone(validSnapshot);
  forbiddenSnapshot.fitScore = 0.18;
  const forbiddenResult = await generateTeamFitReportWithOpenAI(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.1",
    client: buildFakeClient(JSON.stringify(forbiddenSnapshot), []),
    now: () => "2026-05-31T10:08:00.000Z",
  });
  assert.equal(forbiddenResult.ok, false);
  if (forbiddenResult.ok) {
    throw new Error("Expected forbidden structural field validation failure.");
  }
  assert.equal(forbiddenResult.code, "validation_failure");
  assert.equal(forbiddenResult.validationErrors.some((error) => /fitScore/.test(error)), true);

  const configError = await generateTeamFitReportWithOpenAI(inputSnapshot, {
    apiKey: null,
    model: "gpt-5.1",
    now: () => "2026-05-31T10:09:00.000Z",
  });
  assert.equal(configError.ok, false);
  if (configError.ok) {
    throw new Error("Expected config error.");
  }
  assert.equal(configError.code, "config_error");

  const provider = createTeamFitOpenAiProvider({
    apiKey: "test-key",
    model: "gpt-5.1",
    client: buildFakeClient(JSON.stringify(validSnapshot), []),
    now: () => "2026-05-31T10:10:00.000Z",
  });
  const providerResult = await provider.generate(inputSnapshot);
  assert.equal(providerResult.ok, true);
  if (!providerResult.ok) {
    throw new Error(providerResult.message);
  }
  assert.equal(providerResult.providerMetadata.provider, TEAM_FIT_OPENAI_PROVIDER);
  assert.equal(providerResult.providerMetadata.providerVersion, TEAM_FIT_OPENAI_PROVIDER_VERSION);
  assert.equal(providerResult.providerMetadata.model, "gpt-5.1");

  console.log("test-team-fit-openai-provider: ok");
}

main().catch((error) => {
  console.error("test-team-fit-openai-provider failed");
  console.error(error);
  process.exitCode = 1;
});
