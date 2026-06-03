const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const providerPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "individual-development-profile-mock-provider.ts",
);
const providerSource = fs.readFileSync(providerPath, "utf8");
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
  if (request === "server-only" || request === "@/lib/supabase/admin") {
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

assert.match(providerSource, /generateIndividualDevelopmentProfileWithMock/);
assert.match(providerSource, /validateIndividualDevelopmentProfileSnapshot/);
assert.doesNotMatch(providerSource, /\.from\("/);
assert.doesNotMatch(providerSource, /OpenAI|openai/i);
assert.doesNotMatch(providerSource, /team-fit|team_dynamics/i);
assert.doesNotMatch(providerSource, /renderer|route|assessment_reports|attempt_reports/i);

const {
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
} = require("../lib/assessment/individual-development-profile-input.ts");
const {
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
  validateIndividualDevelopmentProfileSnapshot,
} = require("../lib/assessment/individual-development-profile-contract.ts");
const {
  INDIVIDUAL_DEVELOPMENT_PROFILE_MOCK_GENERATOR_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_MOCK_GENERATOR_VERSION,
  generateIndividualDevelopmentProfileWithMock,
} = require(providerPath);

function collectStrings(value) {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStrings(entry));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((entry) => collectStrings(entry));
  }

  return [];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildInputSnapshot(overrides = {}) {
  return {
    inputType: INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE,
    inputVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
    locale: "bs",
    participant: {
      participantId: "participant-1",
      displayName: "Amina Candidate",
    },
    sourceSignals: {
      personality: {
        sourceStatus: "available",
        summary: "Ličnosni signal je dostupan.",
        relevantSignals: [
          {
            code: "EXTRAVERSION",
            label: "Ekstraverzija",
            signal: "Povišen signal u domeni ekstraverzije vrijedi čitati kao razvojnu hipotezu za saradnju i ritam rada.",
          },
        ],
        sourceMetadata: {
          testSlug: "ipip-neo-120-v1",
        },
      },
      motivation: {
        sourceStatus: "available",
        summary: "Motivacijski signal je dostupan.",
        relevantSignals: [
          {
            code: "intrinsic",
            label: "Intrinzična motivacija",
            signal: "Ovaj signal može pomagati angažmanu kada rad ima smisao i vidljiv napredak.",
          },
        ],
        sourceMetadata: {
          testSlug: "mwms_v1",
        },
      },
      problemSolving: {
        sourceStatus: "available",
        summary: "Problem-solving signal je dostupan.",
        relevantSignals: [
          {
            code: "verbal",
            label: "Verbalno rezonovanje",
            signal: "U ovom setu zadataka signal u domeni verbalnog rezonovanja djeluje stabilno i korisno za dalju provjeru.",
          },
        ],
        sourceMetadata: {
          testSlug: "safran_v1",
        },
      },
      composite: {
        sourceStatus: "available",
        summary: "Reduced deterministic composite sažetak je dostupan.",
        integratedSignals: [
          {
            code: "integrated",
            label: "Integrisani signal",
            signal: "Reduced deterministic composite ukazuje da se jasniji razvojni obrazac vidi kada su očekivanja pregledna i podrška operativna.",
          },
        ],
        sourceMetadata: {
          sourceType: "deterministic_composite_input",
        },
      },
    },
    interpretationLimits: [
      "Input snapshot sadrži reduced HR-safe deterministic signale, ne raw answers i ne full upstream snapshotove.",
    ],
    sourceMetadata: {
      assessmentAssignmentId: "assignment-1",
      sourceVersions: [
        {
          source: "composite",
          mode: "deterministic_composite_summary",
        },
      ],
    },
    ...overrides,
  };
}

function main() {
  const validInput = buildInputSnapshot();
  const validResult = generateIndividualDevelopmentProfileWithMock(validInput);

  assert.equal(validResult.ok, true, validResult.ok ? undefined : validResult.errors.join(" | "));

  if (!validResult.ok) {
    throw new Error("Expected valid mock provider result.");
  }

  const report = validResult.reportSnapshot;
  const validated = validateIndividualDevelopmentProfileSnapshot(report);

  assert.equal(validated.ok, true, validated.ok ? undefined : validated.errors.join(" | "));
  assert.equal(report.reportType, INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE);
  assert.equal(report.reportVersion, INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION);
  assert.equal(report.audience, INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE);
  assert.equal(report.locale, validInput.locale);
  assert.ok(report.developmentSummary);
  assert.ok(report.contributionPattern);
  assert.ok(report.developmentRisks);
  assert.ok(report.communicationAndFeedbackGuidance);
  assert.ok(report.motivationAndEnergyGuidance);
  assert.ok(report.oneOnOneGuidance);
  assert.ok(report.onboardingPlan);
  assert.ok(report.onboardingPlan.first7Days);
  assert.ok(report.onboardingPlan.first30Days);
  assert.ok(report.onboardingPlan.days31To60);
  assert.ok(report.onboardingPlan.days61To90);
  assert.ok(report.onboardingPlan.managerCheckpoints);
  assert.ok(report.onboardingPlan.watchouts);
  assert.ok(report.managerWatchpoints);
  assert.ok(report.interpretationLimits);
  assert.equal(report.metadata.generatorType, INDIVIDUAL_DEVELOPMENT_PROFILE_MOCK_GENERATOR_TYPE);
  assert.equal(
    report.metadata.generatorVersion,
    INDIVIDUAL_DEVELOPMENT_PROFILE_MOCK_GENERATOR_VERSION,
  );
  assert.equal(report.metadata.inputVersion, validInput.inputVersion);

  const mixedInput = buildInputSnapshot({
    sourceSignals: {
      personality: validInput.sourceSignals.personality,
      motivation: {
        sourceStatus: "partial",
        summary: null,
        relevantSignals: [],
        sourceMetadata: {
          reason: "attempt_status_in_progress",
        },
      },
      problemSolving: {
        sourceStatus: "invalid",
        summary: null,
        relevantSignals: [],
        sourceMetadata: {
          reason: "deterministic_results_missing",
        },
      },
      composite: {
        sourceStatus: "unavailable",
        summary: null,
        integratedSignals: [],
        sourceMetadata: {
          reason: "deterministic_components_not_fully_ready",
        },
      },
    },
    interpretationLimits: [
      "Reduced composite deterministic summary nije potpuno dostupan; AI-generated composite narrative se ne koristi kao zamjena primarnog source-a.",
    ],
  });

  const mixedResult = generateIndividualDevelopmentProfileWithMock(mixedInput);

  assert.equal(mixedResult.ok, true, mixedResult.ok ? undefined : mixedResult.errors.join(" | "));

  if (!mixedResult.ok) {
    throw new Error("Expected mixed-status mock provider result.");
  }

  assert.equal(
    mixedResult.reportSnapshot.interpretationLimits.some((entry) =>
      /djelimično dostupan|nije dovoljno pouzdan|nije dostupan/i.test(entry),
    ),
    true,
  );

  const outputText = collectStrings(mixedResult.reportSnapshot).join(" ");
  assert.equal(
    /hire|no-hire|fit score|match score|diagnos|clinical|disorder|top candidate|ranked candidates|team fit|team dynamics|raw answers|raw item|scoring key|full upstream snapshot/i.test(
      outputText,
    ),
    false,
  );
  assert.match(outputText, /7\s*\/\s*30\s*\/\s*60\s*\/\s*90|prvoj sedmici|prvih 30 dana/i);
  assert.equal(/assessment_reports|attempt_reports/i.test(providerSource), false);

  const wrongInput = clone(validInput);
  wrongInput.inputType = "team_fit_report_input_v2_enriched";
  const invalidInputResult = generateIndividualDevelopmentProfileWithMock(wrongInput);

  assert.equal(invalidInputResult.ok, false);
  assert.equal(invalidInputResult.reason, "invalid_input");

  console.log("test-individual-development-profile-mock-provider: ok");
}

main();
