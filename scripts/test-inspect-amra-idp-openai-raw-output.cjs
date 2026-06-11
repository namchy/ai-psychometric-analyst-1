const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(
  projectRoot,
  "scripts",
  "inspect-amra-idp-openai-raw-output.cjs",
);
const scriptSource = fs.readFileSync(scriptPath, "utf8");

assert.match(scriptSource, /CONFIRM_AMRA_IDP_OPENAI_RAW_INSPECT/);
assert.doesNotMatch(scriptSource, /CONFIRM_AMRA_IDP_REPROCESS/);
assert.doesNotMatch(
  scriptSource,
  /processIndividualDevelopmentProfileAssessmentReport/,
);
assert.doesNotMatch(
  scriptSource,
  /generateIndividualDevelopmentProfileWithOpenAi/,
);
assert.doesNotMatch(
  scriptSource,
  /validateIndividualDevelopmentProfileSnapshot/,
);
assert.doesNotMatch(scriptSource, /validateReportLanguageQuality/);
assert.doesNotMatch(scriptSource, /validateUserFacingOutput/);
assert.doesNotMatch(scriptSource, /\.(?:insert|update|upsert|delete)\(/);
assert.match(scriptSource, /appValidationSkipped:\s*true/);
assert.match(scriptSource, /mode:\s*0o600/);
assert.match(scriptSource, /chmodFile\(dumpPath,\s*0o600\)/);
assert.match(scriptSource, /buildIndividualDevelopmentProfileOpenAiRequest/);
assert.match(scriptSource, /api\.openai\.com\/v1\/chat\/completions/);

const {
  TARGET_REPORT_ID,
  TARGET_PARTICIPANT_ID,
  TARGET_ASSESSMENT_ASSIGNMENT_ID,
  CONFIRM_ENV,
  OUTPUT_PATH,
  assertDevelopmentOnly,
  assertExecutionConfirmed,
  sanitizeForArtifact,
  runRawOutputInspector,
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

  const sanitized = sanitizeForArtifact({
    apiKey: "secret",
    authorization: "Bearer secret",
    nested: {
      serviceRoleKey: "secret",
      token: "secret",
      safe: "visible",
    },
  });
  assert.equal(sanitized.apiKey, "[REDACTED]");
  assert.equal(sanitized.authorization, "[REDACTED]");
  assert.equal(sanitized.nested.serviceRoleKey, "[REDACTED]");
  assert.equal(sanitized.nested.token, "[REDACTED]");
  assert.equal(sanitized.nested.safe, "visible");

  const inputSnapshot = buildInputSnapshot();
  const rawContent = JSON.stringify({
    diagnosticOnly: true,
    note: "This deliberately does not satisfy the application report contract.",
  });
  const writes = [];
  const chmodCalls = [];
  const runtimeSelectors = [];
  let requestBuilderCalls = 0;
  let openAiCalls = 0;
  let capturedRequest = null;

  const artifact = await runRawOutputInspector({
    env: {
      NODE_ENV: "development",
      [CONFIRM_ENV]: "true",
    },
    dumpPath: "/tmp/test-amra-idp-openai-raw-output.json",
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
    buildInputSnapshot: async (input) => {
      assert.deepEqual(input, {
        assessmentAssignmentId: TARGET_ASSESSMENT_ASSIGNMENT_ID,
        organizationId: "org-1",
        participantId: TARGET_PARTICIPANT_ID,
      });
      return { ok: true, inputSnapshot };
    },
    loadRuntimeConfig: async (selector) => {
      runtimeSelectors.push(selector);
      return {
        id: "runtime-1",
        modelName: "gpt-5.5",
        temperature: null,
        reasoningEffort: "medium",
      };
    },
    getAiReportConfig: () => ({
      provider: "openai",
      model: "fallback-model",
      openAiApiKey: "test-key",
      openAiTimeoutMs: 120000,
    }),
    buildRequest: (input) => {
      requestBuilderCalls += 1;
      const {
        buildIndividualDevelopmentProfileOpenAiRequest,
      } = require("../lib/assessment/individual-development-profile-openai-provider.ts");
      return buildIndividualDevelopmentProfileOpenAiRequest(input);
    },
    callOpenAi: async ({ request }) => {
      openAiCalls += 1;
      capturedRequest = request;
      return rawContent;
    },
    writeFile: (filePath, data, options) => {
      writes.push({ filePath, data, options });
    },
    chmodFile: (filePath, mode) => {
      chmodCalls.push({ filePath, mode });
    },
  });

  assert.equal(requestBuilderCalls, 1);
  assert.equal(openAiCalls, 1);
  assert.deepEqual(runtimeSelectors, [
    {
      reportType: "individual_development_profile",
      audience: "hr",
      sourceType: "assessment",
      generatorType: "openai",
    },
  ]);
  assert.equal(capturedRequest.model, "gpt-5.5");
  assert.equal(
    Object.prototype.hasOwnProperty.call(capturedRequest, "temperature"),
    false,
  );
  assert.equal(capturedRequest.messages.length, 2);
  assert.equal(capturedRequest.response_format.type, "json_schema");
  assert.equal(
    capturedRequest.response_format.json_schema.name,
    "individual_development_profile_v1",
  );
  assert.equal(artifact.rawContent, rawContent);
  assert.deepEqual(artifact.parsedReport, JSON.parse(rawContent));
  assert.deepEqual(artifact.diagnostics.rawJsonParse, {
    ok: true,
    error: null,
  });
  assert.equal(artifact.diagnostics.appValidationSkipped, true);
  assert.deepEqual(artifact.safety, {
    openAiCalled: true,
    databaseWrites: false,
    lifecycleWrites: false,
    persistedReportUpdated: false,
    appValidationSkipped: true,
  });
  assert.equal(artifact.requestSummary.model, "gpt-5.5");
  assert.equal(artifact.requestSummary.temperaturePresent, false);
  assert.equal(artifact.requestSummary.messageCount, 2);
  assert.equal(
    artifact.requestSummary.responseFormatSchemaName,
    "individual_development_profile_v1",
  );
  assert.equal(artifact.runtimeConfig.reasoningEffort, "medium");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].filePath, artifact.dumpPath);
  assert.equal(writes[0].options.mode, 0o600);
  assert.match(writes[0].filePath, /^\/tmp\//);
  assert.match(writes[0].data, /"appValidationSkipped": true/);
  assert.doesNotMatch(writes[0].data, /test-key/);
  assert.deepEqual(chmodCalls, [
    {
      filePath: artifact.dumpPath,
      mode: 0o600,
    },
  ]);
  assert.equal(OUTPUT_PATH, "/tmp/amra-idp-openai-raw-output.json");

  console.log("test-inspect-amra-idp-openai-raw-output: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
