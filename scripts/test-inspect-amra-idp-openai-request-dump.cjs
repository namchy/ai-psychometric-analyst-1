const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const inspectorPath = path.join(
  projectRoot,
  "scripts",
  "inspect-amra-idp-openai-request-dump.cjs",
);
const inspectorSource = fs.readFileSync(inspectorPath, "utf8");
const providerSource = fs.readFileSync(
  path.join(
    projectRoot,
    "lib",
    "assessment",
    "individual-development-profile-openai-provider.ts",
  ),
  "utf8",
);

assert.match(providerSource, /export function buildIndividualDevelopmentProfileOpenAiRequest/);
assert.match(
  providerSource,
  /const request = buildIndividualDevelopmentProfileOpenAiRequest\(\{/,
);
assert.match(inspectorSource, /buildIndividualDevelopmentProfileOpenAiRequest/);
assert.doesNotMatch(inspectorSource, /generateIndividualDevelopmentProfileWithOpenAi/);
assert.doesNotMatch(inspectorSource, /processIndividualDevelopmentProfileAssessmentReport/);
assert.doesNotMatch(inspectorSource, /\.(?:insert|update|upsert|delete)\(/);
assert.doesNotMatch(inspectorSource, /OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);

const {
  TARGET_REPORT_ID,
  TARGET_PARTICIPANT_ID,
  TARGET_ASSESSMENT_ASSIGNMENT_ID,
  OUTPUT_PATH,
  assertDevelopmentOnly,
  sanitizeForDump,
  runRequestDumpInspector,
} = require(inspectorPath);

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
        relevantSignals: [
          {
            code: "CONSCIENTIOUSNESS",
            label: "Savjesnost",
            signal: "Razvojni signal za način rada.",
          },
        ],
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
    interpretationLimits: ["Razvojna hipoteza zahtijeva provjeru kroz razgovor."],
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

  const sanitized = sanitizeForDump({
    OPENAI_API_KEY: "secret",
    authorization: "Bearer secret",
    nested: {
      serviceRoleKey: "secret",
      safe: "visible",
    },
  });
  assert.equal(sanitized.OPENAI_API_KEY, "[REDACTED]");
  assert.equal(sanitized.authorization, "[REDACTED]");
  assert.equal(sanitized.nested.serviceRoleKey, "[REDACTED]");
  assert.equal(sanitized.nested.safe, "visible");

  const inputSnapshot = buildInputSnapshot();
  const writes = [];
  const chmodCalls = [];
  const runtimeSelectors = [];
  let requestBuilderCalls = 0;
  let capturedRequestInput = null;

  const diagnostic = await runRequestDumpInspector({
    env: { NODE_ENV: "development" },
    dumpPath: "/tmp/test-amra-idp-openai-request-dump.json",
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
      openAiTimeoutMs: 120000,
    }),
    buildRequest: (input) => {
      requestBuilderCalls += 1;
      capturedRequestInput = input;
      const {
        buildIndividualDevelopmentProfileOpenAiRequest,
      } = require("../lib/assessment/individual-development-profile-openai-provider.ts");
      return buildIndividualDevelopmentProfileOpenAiRequest(input);
    },
    writeFile: (filePath, data, options) => {
      writes.push({ filePath, data, options });
    },
    chmodFile: (filePath, mode) => {
      chmodCalls.push({ filePath, mode });
    },
  });

  assert.equal(requestBuilderCalls, 1);
  assert.deepEqual(capturedRequestInput, {
    inputSnapshot,
    model: "gpt-5.5",
    temperature: null,
  });
  assert.deepEqual(runtimeSelectors, [
    {
      reportType: "individual_development_profile",
      audience: "hr",
      sourceType: "assessment",
      generatorType: "openai",
    },
  ]);
  assert.equal(diagnostic.request.model, "gpt-5.5");
  assert.equal(
    Object.prototype.hasOwnProperty.call(diagnostic.request, "temperature"),
    false,
  );
  assert.equal(diagnostic.request.messages.length, 2);
  assert.equal(diagnostic.request.messages[0].role, "system");
  assert.equal(diagnostic.request.messages[1].role, "user");
  assert.equal(diagnostic.request.response_format.type, "json_schema");
  assert.equal(diagnostic.request.response_format.json_schema.strict, true);
  assert.deepEqual(diagnostic.messages.userParsed.input, inputSnapshot);
  assert.deepEqual(diagnostic.safety, {
    openAiCalled: false,
    databaseWrites: false,
    lifecycleWrites: false,
  });
  assert.equal(diagnostic.runtimeConfig.reasoningEffort, "medium");
  assert.equal(diagnostic.dumpPath, "/tmp/test-amra-idp-openai-request-dump.json");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].filePath, diagnostic.dumpPath);
  assert.equal(writes[0].options.mode, 0o600);
  assert.deepEqual(chmodCalls, [
    {
      filePath: diagnostic.dumpPath,
      mode: 0o600,
    },
  ]);
  assert.match(writes[0].data, /"openAiCalled": false/);
  assert.match(writes[0].data, /"databaseWrites": false/);
  assert.match(writes[0].data, /"lifecycleWrites": false/);
  assert.equal(OUTPUT_PATH, "/tmp/amra-idp-openai-request-dump.json");

  console.log("test-inspect-amra-idp-openai-request-dump: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
