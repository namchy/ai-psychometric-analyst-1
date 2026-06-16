const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const DUMP_PATH_ENV = "TEAM_FIT_PROVIDER_REQUEST_CAPTURE_PATH";
const MODEL_ENV = "TEAM_FIT_PROVIDER_REQUEST_MODEL";
const OUTPUT_PREFIX = "team-fit-provider-request-capture";
const DEFAULT_MODEL = "gpt-5.5";
const FIXTURE_GENERATED_AT = "2026-01-01T00:00:00.000Z";

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
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function buildTimestamp(now = () => FIXTURE_GENERATED_AT) {
  return now().replace(/[:.]/g, "-");
}

function buildDefaultDumpPath(timestamp = buildTimestamp()) {
  return path.join(os.tmpdir(), `${OUTPUT_PREFIX}-${timestamp}.json`);
}

function assertSafeDumpPath(filePath) {
  if (!isNonEmptyString(filePath)) {
    throw new Error(`${DUMP_PATH_ENV} must not be empty.`);
  }

  if (!path.isAbsolute(filePath)) {
    throw new Error(`${DUMP_PATH_ENV} must be an absolute path under /tmp.`);
  }

  const resolvedPath = path.resolve(filePath);
  const tmpRoot = fs.realpathSync(os.tmpdir());
  const resolvedParent = fs.realpathSync(path.dirname(resolvedPath));

  if (!resolvedParent.startsWith(`${tmpRoot}${path.sep}`) && resolvedParent !== tmpRoot) {
    throw new Error(`${DUMP_PATH_ENV} must resolve inside ${tmpRoot}.`);
  }

  if (path.extname(resolvedPath).toLowerCase() !== ".json") {
    throw new Error(`${DUMP_PATH_ENV} must point to a .json file.`);
  }

  return resolvedPath;
}

function resolveDumpPath({ env = process.env, now = () => FIXTURE_GENERATED_AT } = {}) {
  const explicitPath = env[DUMP_PATH_ENV]?.trim();

  if (!explicitPath) {
    return null;
  }

  return assertSafeDumpPath(explicitPath || buildDefaultDumpPath(buildTimestamp(now)));
}

function buildFixtureBuildInput() {
  return {
    locale: "bs-BA",
    generatedFor: {
      organizationId: "org-fixture-1",
      teamId: "team-fixture-1",
      participantId: "participant-fixture-1",
      teamName: "Operativni tim",
      candidateDisplayName: "Kandidat A",
    },
    candidateDeepProfileSignals: [
      {
        key: "ipip.work_style.structure",
        label: "Strukturiranje rada",
        signal:
          "Kandidat rano razjasnjava ocekivanja i preferira pregledan nacin pracenja zadataka.",
        relationNote:
          "Relevantno je za tim koji treba jasnije zatvaranje otvorenih dogovora.",
      },
    ],
    teamDynamicsAggregationSignals: [
      {
        key: "decision_ownership",
        label: "Vlasnistvo odluka",
        signal:
          "Tim pokazuje trenje oko jasnog zatvaranja dogovora i raspodjele vlasnistva nad odlukama.",
      },
    ],
    hrAdminOptionalContext: {
      allowed: true,
      signals: [
        {
          key: "role_expectation",
          label: "Ocekivanje uloge",
          signal:
            "HR zeli provjeriti kako kandidat uvodi jasnocu bez usporavanja tima.",
        },
      ],
    },
    interpretiveLinks: [
      {
        candidateSignalKey: "ipip.work_style.structure",
        targetCollection: "teamDynamicsAggregationSignals",
        targetSignalKey: "decision_ownership",
        label: "Veza kandidat-tim",
        signal:
          "Kandidatov strukturisan pristup moze pomoci timu da jasnije zakljucuje otvorene dogovore.",
        relationNote:
          "Relacijski signal vrijedi provjeriti kroz razgovor o nacinu zatvaranja dogovora.",
      },
    ],
    interpretationLimits: [
      "Ovo nije automatska odluka o zaposljavanju.",
      "Nalaz treba potvrditi kroz strukturisan intervju i onboarding plan.",
    ],
    metadata: {
      generatedAt: FIXTURE_GENERATED_AT,
      requestId: "req-fixture-1",
      inputVersion: "team_fit_input_bundle_v1",
      sourceVersion: "deterministic_fixture_v1",
    },
  };
}

function buildEvidenceIdMap(bundle) {
  return {
    candidate: bundle.candidateDeepProfileSignals.map((entry) => entry.id),
    team: bundle.teamDynamicsAggregationSignals.map((entry) => entry.id),
    context: [
      ...(bundle.teamDynamicsExecutiveOverviewSignals ?? []).map((entry) => entry.id),
      ...(bundle.hrAdminOptionalContextSignals ?? []).map((entry) => entry.id),
    ],
    teamStyle: (bundle.teamStyleCollaborationSignals ?? []).map((entry) => entry.id),
    interpretiveLink: bundle.interpretiveLinks.map((entry) => entry.id),
  };
}

function buildRequestBody({ model, messages, responseFormat, requestDraft }) {
  return {
    model,
    messages,
    response_format: responseFormat,
    contractVersion: requestDraft.contractVersion,
    metadata: requestDraft.metadata,
  };
}

function sanitizeForDump(value) {
  if (typeof value === "string") {
    return value.replace(/sk-[A-Za-z0-9_-]+/g, "sk-[REDACTED]");
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForDump(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (/(authorization|cookie|token|secret|password|api[_-]?key|service[_-]?role)/i.test(key)) {
        return [key, "[REDACTED]"];
      }

      return [key, sanitizeForDump(entry)];
    }),
  );
}

function buildTeamFitProviderRequestCaptureArtifact(
  options = {},
) {
  installTypeScriptRuntime();

  const {
    buildTeamFitReportInputBundle,
    getTeamFitReportInputBundleEvidenceIds,
  } = require(path.join(projectRoot, "lib", "b2b", "team-fit-report-input-bundle.ts"));
  const {
    buildTeamFitReportProviderPromptInput,
    buildTeamFitReportProviderMessages,
    buildTeamFitReportProviderRequestDraft,
  } = require(path.join(projectRoot, "lib", "b2b", "team-fit-report-provider-prompt.ts"));
  const {
    TEAM_FIT_REPORT_PROVIDER_SCHEMA_NAME,
    TEAM_FIT_REPORT_PROVIDER_RESPONSE_FORMAT,
  } = require(path.join(projectRoot, "lib", "b2b", "team-fit-report-provider-schema.ts"));

  const model = isNonEmptyString(options.model)
    ? options.model.trim()
    : isNonEmptyString(process.env[MODEL_ENV])
      ? process.env[MODEL_ENV].trim()
      : DEFAULT_MODEL;

  const bundleResult = buildTeamFitReportInputBundle(buildFixtureBuildInput());

  if (!bundleResult.ok) {
    throw new Error(`Failed to build Team Fit input bundle: ${bundleResult.errors.join(" | ")}`);
  }

  const inputBundle = bundleResult.bundle;
  const evidenceIds = getTeamFitReportInputBundleEvidenceIds(inputBundle);
  const evidenceIdMap = buildEvidenceIdMap(inputBundle);
  const providerPromptInput = buildTeamFitReportProviderPromptInput(inputBundle);
  const messageArtifact = buildTeamFitReportProviderMessages(providerPromptInput);
  const requestDraft = buildTeamFitReportProviderRequestDraft(providerPromptInput, {
    model,
    responseSchemaName: TEAM_FIT_REPORT_PROVIDER_SCHEMA_NAME,
  });
  const responseFormat = TEAM_FIT_REPORT_PROVIDER_RESPONSE_FORMAT;
  const schemaName = responseFormat.json_schema.name;
  const requestBody = buildRequestBody({
    model,
    messages: messageArtifact.messages,
    responseFormat,
    requestDraft,
  });

  return {
    metadata: {
      inspector: "team_fit_provider_request_capture_v1",
      reportType: "team_fit_report_v1",
      contractVersion: "team_fit_report_v1",
      provider: "no_call",
      model,
      openAiCalled: false,
      databaseReads: false,
      databaseWrites: false,
      reportGenerated: false,
      productionFlowChanged: false,
    },
    inputBundle,
    evidenceIds,
    evidenceIdMap,
    providerPromptInput,
    messages: messageArtifact,
    requestDraft,
    responseFormat,
    schemaName,
    requestBody,
  };
}

async function runTeamFitProviderRequestCapture({
  env = process.env,
  stdout = process.stdout,
  writeFile = fs.writeFileSync,
  chmodFile = fs.chmodSync,
} = {}) {
  const artifact = buildTeamFitProviderRequestCaptureArtifact({
    model: env[MODEL_ENV],
  });
  const dumpPath = resolveDumpPath({ env });
  const printableArtifact = sanitizeForDump(artifact);
  const serialized = JSON.stringify(printableArtifact, null, 2);

  if (dumpPath) {
    writeFile(dumpPath, serialized, "utf8");
    chmodFile(dumpPath, 0o600);
  }

  stdout.write(`${serialized}\n`);

  return {
    artifact,
    dumpPath,
  };
}

module.exports = {
  DEFAULT_MODEL,
  DUMP_PATH_ENV,
  FIXTURE_GENERATED_AT,
  MODEL_ENV,
  assertSafeDumpPath,
  buildTeamFitProviderRequestCaptureArtifact,
  installTypeScriptRuntime,
  resolveDumpPath,
  runTeamFitProviderRequestCapture,
  sanitizeForDump,
};

if (require.main === module) {
  runTeamFitProviderRequestCapture().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
