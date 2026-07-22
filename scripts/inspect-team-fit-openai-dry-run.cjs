const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const typescript = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_TEAM_FIT_OPENAI_DRY_RUN";
const OUTPUT_PATH_ENV = "TEAM_FIT_OPENAI_DRY_RUN_OUTPUT_PATH";
const DEFAULT_OUTPUT_PATH = "/tmp/team-fit-openai-dry-run.json";

const INPUT_ENV_KEYS = [
  "TEAM_FIT_ORGANIZATION_ID",
  "TEAM_FIT_TEAM_ID",
  "TEAM_FIT_PARTICIPANT_ID",
  "TEAM_FIT_CANDIDATE_ASSESSMENT_ASSIGNMENT_ID",
  "TEAM_FIT_TEAM_AGGREGATION_SNAPSHOT_ID",
  "AI_REPORT_MODEL",
  "AI_REPORT_REASONING_EFFORT",
  "OPENAI_API_KEY",
];

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  for (const extension of ["", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;

    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  return candidatePath;
}

function installTypeScriptRuntime() {
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
    const transpiled = typescript.transpileModule(source, {
      compilerOptions: {
        module: typescript.ModuleKind.CommonJS,
        moduleResolution: typescript.ModuleResolutionKind.NodeJs,
        target: typescript.ScriptTarget.ES2022,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
      fileName: filename,
    });

    module._compile(transpiled.outputText, filename);
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeEnvString(value) {
  return isNonEmptyString(value) ? value.trim() : null;
}

function buildDryRunInputsFromEnv(env) {
  return {
    organizationId: normalizeEnvString(env.TEAM_FIT_ORGANIZATION_ID),
    teamId: normalizeEnvString(env.TEAM_FIT_TEAM_ID),
    participantId: normalizeEnvString(env.TEAM_FIT_PARTICIPANT_ID),
    candidateAssessmentAssignmentId: normalizeEnvString(
      env.TEAM_FIT_CANDIDATE_ASSESSMENT_ASSIGNMENT_ID,
    ),
    teamAggregationSnapshotId: normalizeEnvString(
      env.TEAM_FIT_TEAM_AGGREGATION_SNAPSHOT_ID,
    ),
    model: normalizeEnvString(env.AI_REPORT_MODEL),
    reasoningEffort: normalizeEnvString(env.AI_REPORT_REASONING_EFFORT),
    apiKeyPresent: isNonEmptyString(env.OPENAI_API_KEY),
    outputPath: normalizeEnvString(env[OUTPUT_PATH_ENV]) ?? DEFAULT_OUTPUT_PATH,
  };
}

function buildBaseArtifact(inputs) {
  return {
    metadata: {
      inspector: "team_fit_openai_dry_run_v1",
      dryRun: true,
      databaseReads: false,
      databaseWrites: false,
      openAiCalled: false,
      openAiCallCount: 0,
      reportPersisted: false,
      queueUsed: false,
      processorUsed: false,
      lifecycleUsed: false,
    },
    inputs: {
      organizationId: inputs?.organizationId ?? null,
      teamId: inputs?.teamId ?? null,
      participantId: inputs?.participantId ?? null,
      candidateAssessmentAssignmentId: inputs?.candidateAssessmentAssignmentId ?? null,
      teamAggregationSnapshotId: inputs?.teamAggregationSnapshotId ?? null,
      ephemeralReportReferenceId: null,
      model: inputs?.model ?? null,
      reasoningEffort: inputs?.reasoningEffort ?? null,
    },
    sourcePreflight: {
      status: "not_checked",
      candidateSourceStatus: null,
      candidateCoverage: null,
      teamSourceStatus: null,
      teamFullCoverage: null,
      blockers: [],
    },
    requestMetadata: {
      model: inputs?.model ?? null,
      reasoningEffort: inputs?.reasoningEffort ?? null,
      temperatureIncluded: null,
    },
    providerResult: null,
  };
}

function buildSkippedArtifact(inputs, reason) {
  return {
    ...buildBaseArtifact(inputs),
    skipped: true,
    reason,
  };
}

function buildConfigFailureArtifact(inputs, blockers) {
  const artifact = buildBaseArtifact(inputs);
  artifact.sourcePreflight.status = "blocked";
  artifact.sourcePreflight.blockers = blockers;
  return artifact;
}

function buildDefaultDependencies() {
  installTypeScriptRuntime();

  const { buildTeamFitReportInputSnapshotFromSources } = require(
    path.join(projectRoot, "lib", "b2b", "team-fit-report-input.ts"),
  );
  const { generateTeamFitReportWithOpenAI } = require(
    path.join(projectRoot, "lib", "b2b", "team-fit-report-openai-provider.ts"),
  );
  const { shouldOmitOpenAiTemperature } = require(
    path.join(projectRoot, "lib", "assessment", "report-provider-openai.ts"),
  );

  return {
    sourceDirectBuilder: buildTeamFitReportInputSnapshotFromSources,
    provider: generateTeamFitReportWithOpenAI,
    shouldOmitOpenAiTemperature,
    randomUUID: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
    fsImpl: fs,
  };
}

function writeArtifact(fsImpl, outputPath, artifact) {
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  fsImpl.writeFileSync(outputPath, serialized, { mode: 0o600 });

  if (typeof fsImpl.chmodSync === "function") {
    fsImpl.chmodSync(outputPath, 0o600);
  }
}

function buildSourcePreflight(sourceResult) {
  if (sourceResult.ok) {
    return {
      status: "ready",
      candidateSourceStatus: sourceResult.candidateSourceStatus,
      candidateCoverage: sourceResult.candidateCoverage,
      teamSourceStatus: sourceResult.teamSourceStatus,
      teamFullCoverage: sourceResult.teamFullCoverage,
      blockers: [],
    };
  }

  return {
    status: "blocked",
    candidateSourceStatus: sourceResult.candidateSourceStatus ?? null,
    candidateCoverage: sourceResult.candidateCoverage ?? null,
    teamSourceStatus: sourceResult.teamSourceStatus ?? null,
    teamFullCoverage: sourceResult.teamFullCoverage ?? false,
    blockers: [sourceResult.reason, sourceResult.message],
  };
}

function sanitizeProviderResult(providerResult) {
  if (!providerResult || typeof providerResult !== "object") {
    return providerResult;
  }

  const result = { ...providerResult };
  delete result.rawContent;
  return result;
}

function withTemporaryReasoningEffort(env, callback) {
  const previous = process.env.AI_REPORT_REASONING_EFFORT;

  if (env.AI_REPORT_REASONING_EFFORT === undefined) {
    delete process.env.AI_REPORT_REASONING_EFFORT;
  } else {
    process.env.AI_REPORT_REASONING_EFFORT = env.AI_REPORT_REASONING_EFFORT;
  }

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      if (previous === undefined) {
        delete process.env.AI_REPORT_REASONING_EFFORT;
      } else {
        process.env.AI_REPORT_REASONING_EFFORT = previous;
      }
    });
}

async function runTeamFitOpenAiDryRun({
  env = process.env,
  dependencies,
} = {}) {
  const inputs = buildDryRunInputsFromEnv(env);

  if (env[CONFIRM_ENV] !== "true") {
    return buildSkippedArtifact(inputs, `${CONFIRM_ENV}=true is required.`);
  }

  const missing = INPUT_ENV_KEYS.filter((key) => {
    if (key === "OPENAI_API_KEY") {
      return !inputs.apiKeyPresent;
    }

    return !isNonEmptyString(env[key]);
  });

  if (missing.length > 0) {
    return buildConfigFailureArtifact(
      inputs,
      missing.map((key) => `missing_required_env:${key}`),
    );
  }

  const injected = dependencies ?? {};
  const defaults = dependencies ? {} : buildDefaultDependencies();
  const deps = {
    ...defaults,
    ...injected,
    randomUUID: injected.randomUUID ?? defaults.randomUUID ?? (() => crypto.randomUUID()),
    now: injected.now ?? defaults.now ?? (() => new Date().toISOString()),
    fsImpl: injected.fsImpl ?? defaults.fsImpl ?? fs,
  };
  const artifact = buildBaseArtifact(inputs);
  const ephemeralReportReferenceId = deps.randomUUID();
  artifact.inputs.ephemeralReportReferenceId = ephemeralReportReferenceId;
  artifact.requestMetadata.temperatureIncluded = deps.shouldOmitOpenAiTemperature
    ? !deps.shouldOmitOpenAiTemperature(inputs.model)
    : inputs.model !== "gpt-5.6-sol";

  const sourceResult = await deps.sourceDirectBuilder(
    {
      ephemeralReportReferenceId,
      organizationId: inputs.organizationId,
      teamId: inputs.teamId,
      participantId: inputs.participantId,
      candidateAssessmentAssignmentId: inputs.candidateAssessmentAssignmentId,
      teamAggregationSourceId: inputs.teamAggregationSnapshotId,
      locale: "bs",
      generatedAt: deps.now(),
    },
    deps.sourceDependencies,
  );

  artifact.metadata.databaseReads = true;
  artifact.sourcePreflight = buildSourcePreflight(sourceResult);

  if (!sourceResult.ok) {
    writeArtifact(deps.fsImpl ?? fs, inputs.outputPath, artifact);
    return artifact;
  }

  artifact.metadata.openAiCallCount = 1;
  let providerResult;

  try {
    providerResult = await withTemporaryReasoningEffort(env, () =>
      deps.provider(sourceResult.inputSnapshot, {
        apiKey: env.OPENAI_API_KEY,
        model: inputs.model,
      }),
    );
  } catch (error) {
    providerResult = {
      ok: false,
      code: "provider_error",
      reason: error instanceof Error ? error.message : String(error),
      modelName: inputs.model,
    };
  }

  artifact.metadata.openAiCalled = true;
  artifact.providerResult = sanitizeProviderResult(providerResult);
  writeArtifact(deps.fsImpl ?? fs, inputs.outputPath, artifact);
  return artifact;
}

async function main() {
  const artifact = await runTeamFitOpenAiDryRun();
  process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
}

module.exports = {
  CONFIRM_ENV,
  DEFAULT_OUTPUT_PATH,
  buildDryRunInputsFromEnv,
  buildSkippedArtifact,
  runTeamFitOpenAiDryRun,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
