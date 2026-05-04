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

const { buildMwmsParticipantReportPromptInput } = require("../lib/assessment/mwms-participant-ai-input-v1.ts");
const { validateMwmsParticipantReportV1 } = require("../lib/assessment/mwms-participant-report-v1.ts");
const {
  MWMS_PARTICIPANT_REPORT_CONTRACT,
} = require("../lib/assessment/mwms-report-contract.ts");
const { mockReportProvider } = require("../lib/assessment/report-provider-mock.ts");
const {
  resolveReportContract,
  resolveReportSignal,
  validateRuntimeCompletedAssessmentReport,
} = require("../lib/assessment/report-providers.ts");

function assertOpenAiCompatibleSchemaNode(node, pathLabel) {
  assert.equal(Boolean(node && typeof node === "object"), true, `${pathLabel} must be an object.`);

  if ("const" in node) {
    assert.equal(
      typeof node.type,
      "string",
      `${pathLabel} uses const and must include an explicit type for OpenAI structured outputs.`,
    );
  }

  if (node.type === "object") {
    assert.equal(
      Boolean(node.properties && typeof node.properties === "object"),
      true,
      `${pathLabel} object must define properties.`,
    );
    assert.equal(
      Array.isArray(node.required),
      true,
      `${pathLabel} object must define required fields.`,
    );
    assert.equal(
      node.additionalProperties,
      false,
      `${pathLabel} object must set additionalProperties to false.`,
    );

    for (const [propertyKey, propertySchema] of Object.entries(node.properties)) {
      assertOpenAiCompatibleSchemaNode(propertySchema, `${pathLabel}.properties.${propertyKey}`);
    }
  }

  if (node.type === "array") {
    assertOpenAiCompatibleSchemaNode(node.items, `${pathLabel}.items`);
  }
}

async function main() {
  const promptInput = buildMwmsParticipantReportPromptInput({
    attemptId: "attempt-mwms-ai-pipeline",
    testId: "test-mwms",
    testSlug: "mwms_v1",
    audience: "participant",
    locale: "bs",
    scoringMethod: "likert_sum",
    promptVersion: "v1",
    testName: "Procjena radne motivacije",
    results: {
      attemptId: "attempt-mwms-ai-pipeline",
      scoringMethod: "likert_sum",
      dimensions: [
        { dimension: "amotivation", rawScore: 4, scoredQuestionCount: 3 },
        { dimension: "external_social", rawScore: 4, scoredQuestionCount: 3 },
        { dimension: "external_material", rawScore: 5, scoredQuestionCount: 3 },
        { dimension: "introjected", rawScore: 3.75, scoredQuestionCount: 4 },
        { dimension: "identified", rawScore: 4.67, scoredQuestionCount: 3 },
        { dimension: "intrinsic", rawScore: 5, scoredQuestionCount: 3 },
      ],
      scoredResponseCount: 19,
      unscoredResponses: [],
    },
  });
  const preparedInput = {
    attemptId: "attempt-mwms-ai-pipeline",
    testSlug: "mwms_v1",
    promptVersion: "v1",
    promptVersionId: null,
    promptTemplate: null,
    promptInput,
    reportContract: resolveReportContract("mwms_v1", "participant"),
  };
  const signal = resolveReportSignal({ testSlug: "mwms_v1", audience: "participant" });
  const packagePrompts = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "assessment-packages/mwms_v1/prompts.json"), "utf8"),
  );
  const packagePrompt = packagePrompts.find(
    (prompt) => prompt.prompt_key === "mwms_participant_report_v1",
  );

  assert.equal(Boolean(packagePrompt), true, "MWMS package prompt must exist.");
  assert.equal(signal.reportFamily, "mwms");
  assert.equal(signal.reportRenderFormat, "mwms_participant_report_v1");
  assert.equal(preparedInput.reportContract.promptKey, "mwms_participant_report_v1");
  assertOpenAiCompatibleSchemaNode(
    MWMS_PARTICIPANT_REPORT_CONTRACT.outputSchemaJson,
    "MWMS_PARTICIPANT_REPORT_CONTRACT.outputSchemaJson",
  );
  assert.deepEqual(
    packagePrompt.output_schema_json,
    MWMS_PARTICIPANT_REPORT_CONTRACT.outputSchemaJson,
    "assessment package MWMS output_schema_json must match the runtime OpenAI schema.",
  );

  const result = await mockReportProvider.generateReport(preparedInput);
  assert.equal(result.ok, true, result.ok ? undefined : result.reason);

  if (!result.ok) {
    throw new Error("Expected mock MWMS report generation to succeed.");
  }

  const reportValidation = validateMwmsParticipantReportV1(result.report);
  assert.equal(reportValidation.ok, true, reportValidation.ok ? undefined : reportValidation.errors.join(" | "));

  const runtimeValidation = validateRuntimeCompletedAssessmentReport(result.report, {
    testSlug: "mwms_v1",
    audience: "participant",
  });
  assert.equal(runtimeValidation.ok, true, runtimeValidation.ok ? undefined : runtimeValidation.reason);
  assert.equal(result.report.schema_version, "mwms_participant_report_v1");
  assert.equal(result.report.title, "Radna motivacija");
  assert.equal("responses" in promptInput, false);
  assert.equal("raw_answers" in promptInput, false);

  console.log("MWMS AI report pipeline tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
