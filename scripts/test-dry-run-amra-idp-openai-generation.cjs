const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(
  projectRoot,
  "scripts",
  "dry-run-amra-idp-openai-generation.cjs",
);
const scriptSource = fs.readFileSync(scriptPath, "utf8");

assert.doesNotMatch(
  scriptSource,
  /processIndividualDevelopmentProfileAssessmentReport/,
);
assert.doesNotMatch(
  scriptSource,
  /reprocess-amra-individual-development-profile/,
);
assert.doesNotMatch(scriptSource, /CONFIRM_AMRA_IDP_REPROCESS/);
assert.doesNotMatch(scriptSource, /\.(?:insert|update|upsert|delete)\(/);
assert.match(scriptSource, /databaseWrites:\s*false/);
assert.match(scriptSource, /lifecycleWrites:\s*false/);
assert.match(scriptSource, /persistedReportUpdated:\s*false/);
assert.match(scriptSource, /chmodFile\(dumpPath,\s*0o600\)/);

const {
  TARGET_REPORT_ID,
  TARGET_PARTICIPANT_ID,
  TARGET_ASSESSMENT_ASSIGNMENT_ID,
  CONFIRM_ENV,
  OUTPUT_PATH,
  installTypeScriptRuntime,
  assertDevelopmentOnly,
  assertExecutionConfirmed,
  runOpenAiDryRun,
} = require(scriptPath);

function buildInputSnapshot() {
  return {
    inputType: "individual_development_profile_input_v1",
    inputVersion: "individual_development_profile_input_v1",
    locale: "bs",
    participant: {
      participantId: TARGET_PARTICIPANT_ID,
      displayName: "Amra",
    },
    sourceSignals: {
      personality: {
        sourceStatus: "available",
        summary: "Ličnosni sažetak.",
        relevantSignals: [],
      },
      motivation: {
        sourceStatus: "available",
        summary: "Motivacijski sažetak.",
        relevantSignals: [],
      },
      problemSolving: {
        sourceStatus: "available",
        summary: "Problem-solving sažetak.",
        relevantSignals: [],
      },
      composite: {
        sourceStatus: "available",
        summary: "Integrisani sažetak.",
        integratedSignals: [],
      },
    },
    interpretationLimits: ["Nalaze treba provjeriti kroz radni kontekst."],
    sourceMetadata: {
      assessmentAssignmentId: TARGET_ASSESSMENT_ASSIGNMENT_ID,
      sourceVersions: [],
    },
  };
}

async function main() {
  assert.throws(
    () => assertDevelopmentOnly({ NODE_ENV: "production" }),
    /requires NODE_ENV=development/,
  );
  assert.throws(
    () => assertExecutionConfirmed({ NODE_ENV: "development" }),
    new RegExp(`${CONFIRM_ENV}=true`),
  );

  const inputSnapshot = buildInputSnapshot();
  installTypeScriptRuntime();
  const {
    generateIndividualDevelopmentProfileWithMock,
  } = require("../lib/assessment/individual-development-profile-mock-provider.ts");
  const mockResult = generateIndividualDevelopmentProfileWithMock(inputSnapshot);
  assert.equal(mockResult.ok, true);

  if (!mockResult.ok) {
    throw new Error(mockResult.errors.join(" | "));
  }

  const rawContent = JSON.stringify(mockResult.reportSnapshot);
  let capturedRequest = null;
  const writes = [];
  const chmodCalls = [];
  let openAiClientCalls = 0;

  const artifact = await runOpenAiDryRun({
    env: {
      NODE_ENV: "development",
      [CONFIRM_ENV]: "true",
    },
    dumpPath: "/tmp/test-amra-idp-openai-dry-run-output.json",
    loadTargetReport: async () => ({
      id: TARGET_REPORT_ID,
      organization_id: "org-1",
      participant_id: TARGET_PARTICIPANT_ID,
      assessment_assignment_id: TARGET_ASSESSMENT_ASSIGNMENT_ID,
      report_type: "individual_development_profile",
      audience: "hr",
      source_type: "assessment",
      report_status: "ready",
      generator_type: "openai",
      model_name: "gpt-5.5",
    }),
    buildInputSnapshot: async () => ({
      ok: true,
      inputSnapshot,
    }),
    loadRuntimeConfig: async () => ({
      id: "runtime-1",
      modelName: "gpt-5.5",
      temperature: null,
      reasoningEffort: null,
    }),
    getAiReportConfig: () => ({
      provider: "openai",
      model: "fallback-model",
      openAiApiKey: "test-key",
      openAiTimeoutMs: 120000,
    }),
    openAiClient: {
      async createChatCompletion(request) {
        openAiClientCalls += 1;
        capturedRequest = request;
        return { content: rawContent };
      },
    },
    captureRequest: () => capturedRequest,
    captureRawContent: () => rawContent,
    writeFile: (filePath, data, options) => {
      writes.push({ filePath, data, options });
    },
    chmodFile: (filePath, mode) => {
      chmodCalls.push({ filePath, mode });
    },
  });

  assert.equal(openAiClientCalls, 1);
  assert.equal(artifact.safety.openAiCalled, true);
  assert.equal(artifact.safety.databaseWrites, false);
  assert.equal(artifact.safety.lifecycleWrites, false);
  assert.equal(artifact.safety.persistedReportUpdated, false);
  assert.equal(artifact.requestSummary.model, "gpt-5.5");
  assert.equal(artifact.requestSummary.temperaturePresent, false);
  assert.equal(artifact.requestSummary.messageCount, 2);
  assert.equal(
    artifact.requestSummary.responseFormatSchemaName,
    "individual_development_profile_v1",
  );
  assert.equal(artifact.rawContent, rawContent);
  assert.equal(artifact.validation.rawJsonParse.ok, true);
  assert.equal(artifact.validation.provider.ok, true);
  assert.equal(artifact.validation.contract.ok, true);
  assert.equal(artifact.validation.bhs.ok, true);
  assert.equal(artifact.validation.quality.ok, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].filePath, artifact.dumpPath);
  assert.equal(writes[0].options.mode, 0o600);
  assert.match(writes[0].filePath, /^\/tmp\//);
  assert.match(writes[0].data, /"databaseWrites": false/);
  assert.match(writes[0].data, /"lifecycleWrites": false/);
  assert.match(writes[0].data, /"persistedReportUpdated": false/);
  assert.deepEqual(chmodCalls, [
    {
      filePath: artifact.dumpPath,
      mode: 0o600,
    },
  ]);
  assert.equal(OUTPUT_PATH, "/tmp/amra-idp-openai-dry-run-output.json");

  console.log("test-dry-run-amra-idp-openai-generation: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
