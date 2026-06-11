const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const TARGET_REPORT_ID = "898e895a-bd4b-4a3b-a15c-04ac0da4ee8c";
const TARGET_PARTICIPANT_ID = "9b742094-53dc-4de5-87a5-174c5491e4dd";
const TARGET_ASSESSMENT_ASSIGNMENT_ID = "16943547-ef84-4fc4-a3d2-11801b1f1869";
const TARGET_REPORT_TYPE = "individual_development_profile";
const TARGET_AUDIENCE = "hr";
const TARGET_SOURCE_TYPE = "assessment";
const OUTPUT_PATH = path.join(os.tmpdir(), "amra-idp-openai-request-dump.json");

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

let typeScriptRuntimeInstalled = false;

function installTypeScriptRuntime() {
  if (typeScriptRuntimeInstalled) {
    return;
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

  typeScriptRuntimeInstalled = true;
}

function assertDevelopmentOnly(env = process.env) {
  if (env.NODE_ENV !== "development") {
    throw new Error("Amra IDP request dump is dev-only and requires NODE_ENV=development.");
  }
}

function sanitizeForDump(value, key = "") {
  if (
    /(?:api[_-]?key|service[_-]?role|authorization|secret|password|token)/i.test(key)
  ) {
    return "[REDACTED]";
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForDump(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeForDump(childValue, childKey),
      ]),
    );
  }

  return value;
}

function assertTargetContext(report) {
  if (
    report.id !== TARGET_REPORT_ID ||
    report.participant_id !== TARGET_PARTICIPANT_ID ||
    report.assessment_assignment_id !== TARGET_ASSESSMENT_ASSIGNMENT_ID
  ) {
    throw new Error("Loaded IDP report identity does not match the fixed Amra diagnostic target.");
  }

  if (
    report.report_type !== TARGET_REPORT_TYPE ||
    report.audience !== TARGET_AUDIENCE ||
    report.source_type !== TARGET_SOURCE_TYPE
  ) {
    throw new Error("Loaded report does not match the expected IDP HR assessment lane.");
  }
}

async function loadTargetReport() {
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("assessment_reports")
    .select(
      "id, organization_id, participant_id, assessment_assignment_id, report_type, audience, source_type, report_status, generator_type, model_name",
    )
    .eq("id", TARGET_REPORT_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load target IDP assessment_report: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Target IDP assessment_report ${TARGET_REPORT_ID} was not found.`);
  }

  assertTargetContext(data);
  return data;
}

function buildInputSnapshotSummary(inputSnapshot) {
  return {
    inputType: inputSnapshot.inputType,
    inputVersion: inputSnapshot.inputVersion,
    locale: inputSnapshot.locale,
    participant: inputSnapshot.participant,
    sourceSignals: Object.fromEntries(
      Object.entries(inputSnapshot.sourceSignals).map(([key, block]) => [
        key,
        {
          sourceStatus: block.sourceStatus,
          summary: block.summary,
          relevantSignalCount: block.relevantSignals?.length ?? 0,
          integratedSignalCount: block.integratedSignals?.length ?? 0,
        },
      ]),
    ),
    interpretationLimitCount: inputSnapshot.interpretationLimits.length,
  };
}

async function runRequestDumpInspector(options = {}) {
  const env = options.env ?? process.env;
  assertDevelopmentOnly(env);
  installTypeScriptRuntime();

  const { getAiReportConfig } = require("../lib/assessment/report-config.ts");
  const {
    getActiveReportRuntimeConfig,
  } = require("../lib/assessment/report-runtime-config.ts");
  const {
    buildIndividualDevelopmentProfileInputSnapshot,
  } = require("../lib/assessment/individual-development-profile-input.ts");
  const {
    buildIndividualDevelopmentProfileOpenAiRequest,
  } = require("../lib/assessment/individual-development-profile-openai-provider.ts");

  const loadReport = options.loadTargetReport ?? loadTargetReport;
  const buildInput =
    options.buildInputSnapshot ?? buildIndividualDevelopmentProfileInputSnapshot;
  const loadRuntimeConfig =
    options.loadRuntimeConfig ?? getActiveReportRuntimeConfig;
  const loadConfig = options.getAiReportConfig ?? getAiReportConfig;
  const buildRequest =
    options.buildRequest ?? buildIndividualDevelopmentProfileOpenAiRequest;
  const writeFile = options.writeFile ?? fs.writeFileSync;
  const chmodFile = options.chmodFile ?? fs.chmodSync;
  const dumpPath = options.dumpPath ?? OUTPUT_PATH;

  const targetReport = await loadReport();
  assertTargetContext(targetReport);

  const [inputResult, runtimeConfig] = await Promise.all([
    buildInput({
      assessmentAssignmentId: TARGET_ASSESSMENT_ASSIGNMENT_ID,
      organizationId: targetReport.organization_id,
      participantId: TARGET_PARTICIPANT_ID,
    }),
    loadRuntimeConfig({
      reportType: TARGET_REPORT_TYPE,
      audience: TARGET_AUDIENCE,
      sourceType: TARGET_SOURCE_TYPE,
      generatorType: "openai",
    }),
  ]);

  if (!inputResult.ok) {
    throw new Error(
      `Failed to build canonical IDP input snapshot: ${inputResult.reason}. ${inputResult.details}`,
    );
  }

  const config = loadConfig();
  const model = runtimeConfig?.modelName ?? config.model;
  const temperature = runtimeConfig?.temperature ?? null;

  if (!model) {
    throw new Error("No OpenAI model is configured for the IDP HR report lane.");
  }

  const request = buildRequest({
    inputSnapshot: inputResult.inputSnapshot,
    model,
    temperature,
  });
  const systemMessage = request.messages.find((message) => message.role === "system");
  const userMessage = request.messages.find((message) => message.role === "user");
  let parsedUserMessage = null;

  try {
    parsedUserMessage = userMessage ? JSON.parse(userMessage.content) : null;
  } catch {
    parsedUserMessage = null;
  }

  const diagnostic = sanitizeForDump({
    generatedAt: new Date().toISOString(),
    target: {
      reportId: targetReport.id,
      participantId: targetReport.participant_id,
      assessmentAssignmentId: targetReport.assessment_assignment_id,
      organizationId: targetReport.organization_id,
      reportStatusAtRead: targetReport.report_status,
      persistedGeneratorType: targetReport.generator_type,
      persistedModelName: targetReport.model_name,
    },
    runtimeConfig: {
      configuredProvider: config.provider,
      generatorType: "openai",
      model,
      temperature,
      reasoningEffort: runtimeConfig?.reasoningEffort ?? null,
      timeoutMs: config.openAiTimeoutMs,
      runtimeConfigId: runtimeConfig?.id ?? null,
    },
    request,
    messages: {
      system: systemMessage?.content ?? null,
      user: userMessage?.content ?? null,
      userParsed: parsedUserMessage,
    },
    response_format: request.response_format,
    inputSnapshotSummary: buildInputSnapshotSummary(inputResult.inputSnapshot),
    inputSnapshot: inputResult.inputSnapshot,
    safety: {
      openAiCalled: false,
      databaseWrites: false,
      lifecycleWrites: false,
    },
    dumpPath,
  });

  writeFile(dumpPath, `${JSON.stringify(diagnostic, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodFile(dumpPath, 0o600);

  return diagnostic;
}

async function main() {
  const diagnostic = await runRequestDumpInspector();

  console.log(
    JSON.stringify(
      {
        target: diagnostic.target,
        runtimeConfig: diagnostic.runtimeConfig,
        inputSnapshotSummary: diagnostic.inputSnapshotSummary,
        safety: diagnostic.safety,
        dumpPath: diagnostic.dumpPath,
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  TARGET_REPORT_ID,
  TARGET_PARTICIPANT_ID,
  TARGET_ASSESSMENT_ASSIGNMENT_ID,
  TARGET_REPORT_TYPE,
  TARGET_AUDIENCE,
  TARGET_SOURCE_TYPE,
  OUTPUT_PATH,
  assertDevelopmentOnly,
  sanitizeForDump,
  assertTargetContext,
  buildInputSnapshotSummary,
  runRequestDumpInspector,
};
