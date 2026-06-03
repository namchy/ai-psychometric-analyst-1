const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const providerPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-dynamics-executive-overview-openai.ts",
);
const contractPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-dynamics-executive-overview-contract.ts",
);
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

assert.match(
  providerSource,
  /export async function generateTeamDynamicsExecutiveOverviewWithOpenAI/,
);
assert.match(providerSource, /validateTeamDynamicsExecutiveOverviewSnapshot/);
assert.doesNotMatch(providerSource, /\.from\("/);
assert.doesNotMatch(providerSource, /attempt_reports|assessment_reports|team_assessment_reports/);
assert.doesNotMatch(providerSource, /persistTeamDynamicsReportInputSnapshot|processTeamDynamicsExecutiveOverviewMock|claimTeamDynamicsReportForProcessing/);

const {
  buildMockTeamDynamicsExecutiveOverviewSnapshot,
  validateTeamDynamicsExecutiveOverviewSnapshot,
} = require(contractPath);
const {
  generateTeamDynamicsExecutiveOverviewWithOpenAI,
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER,
} = require(providerPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildInputSnapshot() {
  return {
    inputType: "team_dynamics_report_input_v1",
    inputVersion: "team_dynamics_report_input_v1",
    reportType: "team_dynamics_report_v1",
    reportVersion: "team_dynamics_executive_overview_v1",
    teamAssessmentReportId: "report-1",
    organizationId: "org-1",
    teamId: "team-1",
    teamAssessmentAssignmentId: "assignment-1",
    selectionDraftId: "draft-1",
    aggregationSnapshotId: "aggregation-1",
    includedMemberCount: 5,
    includedMemberIdsSnapshot: ["member-1", "member-2", "member-3", "member-4", "member-5"],
    teamContext: {
      teamName: "Delivery Team",
      assignment: {
        packageSlug: "team_dynamics_assessment_v1",
        status: "closed",
        openedAt: "2026-05-28T08:00:00.000Z",
        closedAt: "2026-05-29T08:00:00.000Z",
        createdAt: "2026-05-28T08:00:00.000Z",
        updatedAt: "2026-05-29T08:00:00.000Z",
      },
    },
    aggregationSummary: {
      aggregationVersion: "team_dynamics_final_aggregation_v1",
      aggregationSnapshotId: "aggregation-1",
      calculatedAt: "2026-05-29T08:55:00.000Z",
      includedMemberCount: 5,
      completedMemberCount: 5,
      readyScoredMemberCount: 5,
      incompleteMemberCount: 0,
      missingScoreCount: 0,
      invalidScoreCount: 0,
      scoreEntryAggregations: [
        {
          scoreKey: "tdm_collaboration",
          label: "Saradnja i koordinacija",
          blockKey: "tdm-31-V1",
          scoreModel: "simple_linear_v1",
          entryType: "domain",
          memberCount: 5,
          meanScore0To100: 64,
          minScore0To100: 48,
          maxScore0To100: 76,
          standardDeviationScore0To100: 10,
        },
      ],
      tdmBlockAggregationPresent: true,
      tdmDomainAggregationsPresent: true,
      psychologicalSafetyAggregationPresent: true,
      sjtAggregationPresent: true,
      outcomePulseAggregationPresent: true,
    },
    guardrails: {
      noHireNoHire: true,
      noIndividualNamingInMainReport: true,
      noRawResponseAnalysis: true,
      reportScope: "team_level_only",
      teamFitOutputExcluded: true,
    },
    createdAt: "2026-05-29T09:00:00.000Z",
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
  const validSnapshot = buildMockTeamDynamicsExecutiveOverviewSnapshot();

  const validOps = [];
  const validResult = await generateTeamDynamicsExecutiveOverviewWithOpenAI(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.1",
    client: buildFakeClient(JSON.stringify(validSnapshot), validOps),
    now: () => "2026-05-29T10:00:00.000Z",
  });

  assert.equal(validResult.ok, true);
  if (!validResult.ok) {
    throw new Error(validResult.reason);
  }

  assert.equal(validResult.provider, TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PROVIDER);
  assert.equal(validResult.modelName, "gpt-5.1");
  assert.equal(validResult.generatedAt, "2026-05-29T10:00:00.000Z");
  assert.equal(validOps.length, 1);
  assert.equal(validOps[0].response_format.type, "json_schema");
  assert.match(validOps[0].messages[0].content, /deterministic input_snapshot/i);
  assert.match(validOps[0].messages[1].content, /No Team Fit output/i);
  assert.equal(validateTeamDynamicsExecutiveOverviewSnapshot(validResult.snapshot).ok, true);

  const invalidJsonResult = await generateTeamDynamicsExecutiveOverviewWithOpenAI(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.1",
    client: buildFakeClient("{not-json", []),
    now: () => "2026-05-29T10:00:01.000Z",
  });

  assert.equal(invalidJsonResult.ok, false);
  if (invalidJsonResult.ok) {
    throw new Error("Expected parse failure.");
  }
  assert.equal(invalidJsonResult.code, "parse_failure");

  const wrongReportType = clone(validSnapshot);
  wrongReportType.reportType = "team_dynamics_team_fit_v1";
  const wrongReportTypeResult = await generateTeamDynamicsExecutiveOverviewWithOpenAI(
    inputSnapshot,
    {
      apiKey: "test-key",
      model: "gpt-5.1",
      client: buildFakeClient(JSON.stringify(wrongReportType), []),
      now: () => "2026-05-29T10:00:02.000Z",
    },
  );

  assert.equal(wrongReportTypeResult.ok, false);
  if (wrongReportTypeResult.ok) {
    throw new Error("Expected validation failure for wrong reportType.");
  }
  assert.equal(wrongReportTypeResult.code, "validation_failure");
  assert.equal(
    wrongReportTypeResult.validationErrors.some((error) => /reportType/.test(error)),
    true,
  );

  const forbiddenFields = clone(validSnapshot);
  forbiddenFields.individualScores = [{ participantId: "p-1", score0To100: 73 }];
  forbiddenFields.teamFitOutput = { summary: "Not allowed." };
  const forbiddenFieldsResult = await generateTeamDynamicsExecutiveOverviewWithOpenAI(
    inputSnapshot,
    {
      apiKey: "test-key",
      model: "gpt-5.1",
      client: buildFakeClient(JSON.stringify(forbiddenFields), []),
      now: () => "2026-05-29T10:00:03.000Z",
    },
  );

  assert.equal(forbiddenFieldsResult.ok, false);
  if (forbiddenFieldsResult.ok) {
    throw new Error("Expected validation failure for forbidden fields.");
  }
  assert.equal(forbiddenFieldsResult.code, "validation_failure");
  assert.equal(
    forbiddenFieldsResult.validationErrors.some((error) => /individualScores/.test(error)),
    true,
  );
  assert.equal(
    forbiddenFieldsResult.validationErrors.some((error) => /teamFitOutput/.test(error)),
    true,
  );

  const configError = await generateTeamDynamicsExecutiveOverviewWithOpenAI(inputSnapshot, {
    apiKey: null,
    model: "gpt-5.1",
    client: buildFakeClient(JSON.stringify(validSnapshot), []),
    now: () => "2026-05-29T10:00:04.000Z",
  });

  assert.equal(configError.ok, false);
  if (configError.ok) {
    throw new Error("Expected config error.");
  }
  assert.equal(configError.code, "config_error");
}

main()
  .then(() => {
    console.log("Team Dynamics Executive Overview OpenAI provider tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
