const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-fit-report-provider-schema.ts",
);
const contractPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-fit-report-contract.ts",
);
const helperSource = fs.readFileSync(helperPath, "utf8");
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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

assert.match(helperSource, /TEAM_FIT_REPORT_PROVIDER_SCHEMA_NAME/);
assert.match(helperSource, /TEAM_FIT_REPORT_PROVIDER_RESPONSE_FORMAT/);
assert.match(helperSource, /buildTeamFitReportProviderResponseFormat/);
assert.match(helperSource, /getTeamFitReportProviderJsonSchema/);
assert.match(helperSource, /additionalProperties: false/);
assert.doesNotMatch(helperSource, /OpenAI|createChatCompletion|fetch\(/i);
assert.doesNotMatch(helperSource, /\.from\(/);
assert.doesNotMatch(helperSource, /supabase|worker|scheduler|renderer|process-assessment-report-jobs/i);

const {
  TEAM_FIT_RELATIONSHIP_PATTERNS,
  TEAM_FIT_REPORT_CONTRACT_VERSION,
  TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE,
  TEAM_FIT_REPORT_CONTRACT_AUDIENCE,
} = require(contractPath);

const {
  TEAM_FIT_REPORT_PROVIDER_SCHEMA_NAME,
  TEAM_FIT_REPORT_PROVIDER_RESPONSE_FORMAT,
  buildTeamFitReportProviderResponseFormat,
  getTeamFitReportProviderJsonSchema,
} = require(helperPath);

const FORBIDDEN_KEYS = new Set([
  "fitScore",
  "numericScore",
  "fitPercentage",
  "decision",
  "hireDecision",
  "hiringDecision",
  "hireRecommendation",
  "hiringRecommendation",
  "passFail",
  "rank",
  "ranking",
  "candidateRank",
]);

function visitSchema(node, visitor) {
  if (!node || typeof node !== "object") {
    return;
  }

  visitor(node);

  if (node.properties && typeof node.properties === "object") {
    for (const child of Object.values(node.properties)) {
      visitSchema(child, visitor);
    }
  }

  if (node.items) {
    visitSchema(node.items, visitor);
  }

  if (Array.isArray(node.anyOf)) {
    node.anyOf.forEach((child) => visitSchema(child, visitor));
  }
}

function collectPropertyKeys(node, output = new Set()) {
  visitSchema(node, (current) => {
    if (current.properties && typeof current.properties === "object") {
      Object.keys(current.properties).forEach((key) => output.add(key));
    }
  });
  return output;
}

function main() {
  const schema = getTeamFitReportProviderJsonSchema();

  assert.equal(TEAM_FIT_REPORT_PROVIDER_SCHEMA_NAME, "team_fit_report_v1");
  assert.equal(
    TEAM_FIT_REPORT_PROVIDER_RESPONSE_FORMAT.json_schema.name,
    "team_fit_report_v1",
  );
  assert.equal(TEAM_FIT_REPORT_PROVIDER_RESPONSE_FORMAT.type, "json_schema");
  assert.equal(TEAM_FIT_REPORT_PROVIDER_RESPONSE_FORMAT.json_schema.strict, true);
  assert.deepEqual(
    TEAM_FIT_REPORT_PROVIDER_RESPONSE_FORMAT.json_schema.schema,
    schema,
  );

  const customResponseFormat = buildTeamFitReportProviderResponseFormat({
    schemaName: "Team Fit Report V1 Output",
  });
  assert.equal(customResponseFormat.json_schema.name, "team_fit_report_v1_output");

  assert.equal(schema.type, "object");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, TEAM_FIT_REPORT_CONTRACT_VERSION);
  assert.equal(schema.properties.reportType.const, TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE);
  assert.equal(schema.properties.audience.const, TEAM_FIT_REPORT_CONTRACT_AUDIENCE);
  assert.equal(schema.properties.sourceType.const, "candidate_team_relational");

  const requiredRootKeys = [
    "contractVersion",
    "reportType",
    "audience",
    "sourceType",
    "locale",
    "generatedFor",
    "source",
    "summary",
    "fitOverview",
    "likelyTeamContribution",
    "possibleFrictionPoints",
    "teamConditionsThatImproveFit",
    "interviewProbes",
    "onboardingAndManagerGuidance",
    "riskAndMitigationMap",
    "evidenceAppendix",
    "interpretationLimits",
    "metadata",
  ];

  assert.deepEqual(schema.required, requiredRootKeys);
  requiredRootKeys.forEach((key) => {
    assert.equal(Boolean(schema.properties[key]), true);
  });

  assert.deepEqual(
    schema.properties.fitOverview.properties.relationshipPattern.enum,
    [...TEAM_FIT_RELATIONSHIP_PATTERNS],
  );

  assert.equal(
    schema.properties.source.properties.candidateDeepProfileSignals.items.properties.id.type,
    "string",
  );
  assert.equal(
    Boolean(
      schema.properties.evidenceAppendix.properties.entries.items.properties.relationToClaim,
    ),
    true,
  );

  const propertyKeys = collectPropertyKeys(schema);
  FORBIDDEN_KEYS.forEach((key) => {
    assert.equal(propertyKeys.has(key), false, `Forbidden schema property found: ${key}`);
  });

  visitSchema(schema, (current) => {
    if (current.type === "object") {
      assert.equal(
        current.additionalProperties,
        false,
        "Every object node must set additionalProperties: false.",
      );
      assert.equal(
        Array.isArray(current.required),
        true,
        "Every object node must declare required fields.",
      );
      assert.equal(
        current.properties && typeof current.properties === "object",
        true,
        "Every object node must declare properties.",
      );
      assert.deepEqual(
        [...current.required].sort(),
        Object.keys(current.properties).sort(),
        "Every object node must require all declared properties.",
      );
    }
  });

  assert.equal(JSON.stringify(schema).includes("fitScore"), false);
  assert.equal(JSON.stringify(schema).includes("hireDecision"), false);
  assert.equal(JSON.stringify(schema).includes("passFail"), false);
  assert.equal(JSON.stringify(schema).includes("candidateRank"), false);

  console.log("test-team-fit-report-provider-schema: ok");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
