const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const mockHelperPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-fit-report-provider-mock.ts",
);
const bundleHelperPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-fit-report-input-bundle.ts",
);
const contractPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-fit-report-contract.ts",
);
const schemaHelperPath = path.join(
  projectRoot,
  "lib",
  "b2b",
  "team-fit-report-provider-schema.ts",
);
const mockHelperSource = fs.readFileSync(mockHelperPath, "utf8");
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

assert.match(mockHelperSource, /generateTeamFitReportWithMockProvider/);
assert.match(mockHelperSource, /TEAM_FIT_REPORT_MOCK_PROVIDER/);
assert.match(mockHelperSource, /validateTeamFitReportV1ContractSnapshot/);
assert.doesNotMatch(mockHelperSource, /OpenAI|createChatCompletion|fetch\(/i);
assert.doesNotMatch(mockHelperSource, /\.from\(/);
assert.doesNotMatch(mockHelperSource, /supabase|worker|scheduler|renderer|process-assessment-report-jobs/i);

const {
  buildTeamFitReportInputBundle,
} = require(bundleHelperPath);
const {
  TEAM_FIT_REPORT_CONTRACT_VERSION,
  TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE,
  TEAM_FIT_REPORT_CONTRACT_AUDIENCE,
  validateTeamFitReportV1ContractSnapshot,
} = require(contractPath);
const {
  TEAM_FIT_REPORT_PROVIDER_SCHEMA_NAME,
} = require(schemaHelperPath);
const {
  TEAM_FIT_REPORT_MOCK_PROVIDER,
  TEAM_FIT_REPORT_MOCK_PROVIDER_VERSION,
  generateTeamFitReportWithMockProvider,
} = require(mockHelperPath);

const FORBIDDEN_KEYS = [
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
];

const FORBIDDEN_COPY_PATTERNS = [
  /hire\/no-hire/i,
  /pass\/fail/i,
  /kandidat se dobro uklapa/i,
  /fit je umjeren/i,
  /kandidat moze doprinijeti timu na razlicite nacine/i,
];

function buildBundleFixture() {
  return buildTeamFitReportInputBundle({
    locale: "bs-BA",
    generatedFor: {
      organizationId: "org-1",
      teamId: "team-1",
      participantId: "participant-1",
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
      generatedAt: "2026-06-16T12:00:00.000Z",
      requestId: "req-1",
      inputVersion: "team_fit_input_bundle_v1",
      sourceVersion: "deterministic_test_fixture_v1",
    },
  });
}

function main() {
  const bundleResult = buildBundleFixture();
  assert.equal(bundleResult.ok, true);

  const bundle = bundleResult.bundle;
  const mockResult = generateTeamFitReportWithMockProvider(bundle, {
    generatedAt: "2026-06-16T12:34:56.000Z",
  });

  assert.equal(mockResult.ok, true);

  const snapshot = mockResult.snapshot;
  const validationResult = validateTeamFitReportV1ContractSnapshot(snapshot);

  assert.equal(validationResult.ok, true);
  assert.equal(snapshot.contractVersion, TEAM_FIT_REPORT_CONTRACT_VERSION);
  assert.equal(snapshot.reportType, TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE);
  assert.equal(snapshot.audience, TEAM_FIT_REPORT_CONTRACT_AUDIENCE);
  assert.equal(snapshot.sourceType, "candidate_team_relational");
  assert.equal(snapshot.metadata.generatedAt, "2026-06-16T12:34:56.000Z");
  assert.equal(snapshot.metadata.schemaVersion, TEAM_FIT_REPORT_PROVIDER_SCHEMA_NAME);
  assert.equal(snapshot.metadata.provider, TEAM_FIT_REPORT_MOCK_PROVIDER);
  assert.equal(snapshot.metadata.providerVersion, TEAM_FIT_REPORT_MOCK_PROVIDER_VERSION);

  [
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
  ].forEach((key) => {
    assert.equal(Boolean(snapshot[key]), true, `Missing required section: ${key}`);
  });

  const inputEvidenceIds = new Set([
    ...bundle.candidateDeepProfileSignals.map((entry) => entry.id),
    ...bundle.teamDynamicsAggregationSignals.map((entry) => entry.id),
    ...(bundle.teamDynamicsExecutiveOverviewSignals ?? []).map((entry) => entry.id),
    ...(bundle.teamStyleCollaborationSignals ?? []).map((entry) => entry.id),
    ...(bundle.hrAdminOptionalContextSignals ?? []).map((entry) => entry.id),
    ...bundle.interpretiveLinks.map((entry) => entry.id),
  ]);

  const appendixIds = snapshot.evidenceAppendix.entries.map((entry) => entry.id);
  assert.deepEqual(new Set(appendixIds), inputEvidenceIds);

  const sectionEvidenceIds = new Set([
    ...snapshot.summary.evidence.map((entry) => entry.id),
    ...snapshot.fitOverview.evidence.map((entry) => entry.id),
    ...snapshot.likelyTeamContribution.items.flatMap((entry) => entry.evidence.map((item) => item.id)),
    ...snapshot.possibleFrictionPoints.items.flatMap((entry) => entry.evidence.map((item) => item.id)),
    ...snapshot.teamConditionsThatImproveFit.items.flatMap((entry) => entry.evidence.map((item) => item.id)),
    ...snapshot.interviewProbes.items.flatMap((entry) => entry.evidence.map((item) => item.id)),
    ...snapshot.onboardingAndManagerGuidance.items.flatMap((entry) => entry.evidence.map((item) => item.id)),
    ...snapshot.riskAndMitigationMap.items.flatMap((entry) => entry.evidence.map((item) => item.id)),
    ...snapshot.interpretationLimits.evidence.map((entry) => entry.id),
  ]);

  sectionEvidenceIds.forEach((id) => {
    assert.equal(inputEvidenceIds.has(id), true, `Section references unknown evidence id: ${id}`);
  });

  const serialized = JSON.stringify(snapshot);
  FORBIDDEN_KEYS.forEach((key) => {
    assert.equal(serialized.includes(`"${key}"`), false, `Forbidden key leaked into snapshot: ${key}`);
  });
  FORBIDDEN_COPY_PATTERNS.forEach((pattern) => {
    assert.doesNotMatch(serialized, pattern);
  });

  assert.match(serialized, /candidate_deep_profile_signal/);
  assert.match(serialized, /team_dynamics_aggregation_signal/);
  assert.match(serialized, /interpretive_link/);
  assert.match(serialized, /hr_admin_optional_context/);
  assert.match(serialized, /candidate\.deep_profile\.ipip\.work_style\.structure/);
  assert.match(serialized, /team\.dynamics\.decision_ownership/);
  assert.match(serialized, /context\.hr\.role_expectation/);
  assert.match(
    serialized,
    /link\.candidate\.deep_profile\.ipip\.work_style\.structure__team\.dynamics\.decision_ownership/,
  );

  const invalidResult = generateTeamFitReportWithMockProvider(
    {
      ...bundle,
      candidateDeepProfileSignals: [],
    },
    {
      generatedAt: "2026-06-16T12:34:56.000Z",
    },
  );
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.reason, "invalid_input_bundle");

  console.log("test-team-fit-report-provider-mock: ok");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
