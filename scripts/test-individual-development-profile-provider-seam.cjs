const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const seamPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "individual-development-profile-provider.ts",
);
const seamSource = fs.readFileSync(seamPath, "utf8");
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

assert.match(seamSource, /DEFAULT_INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER/);
assert.match(seamSource, /generateIndividualDevelopmentProfileReport/);
assert.match(seamSource, /generateIndividualDevelopmentProfileWithMock/);
assert.doesNotMatch(seamSource, /OpenAI|openai|external/i);
assert.doesNotMatch(seamSource, /process\.env|TEAM_FIT_REPORT_PROVIDER|OPENAI_API_KEY|AI_REPORT_MODEL/i);
assert.doesNotMatch(seamSource, /\.from\("/);
assert.doesNotMatch(seamSource, /renderer|route|assessment_reports|attempt_reports|team_fit_reports/i);

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
  INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_MOCK,
  DEFAULT_INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER,
  generateIndividualDevelopmentProfileReport,
} = require(seamPath);

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
      },
    },
    interpretationLimits: [
      "Input snapshot sadrži reduced HR-safe deterministic signale, ne raw answers i ne full upstream snapshotove.",
    ],
    sourceMetadata: {
      assessmentAssignmentId: "assignment-1",
      sourceVersions: [],
    },
    ...overrides,
  };
}

async function main() {
  assert.equal(INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_MOCK, "mock");
  assert.equal(DEFAULT_INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER, "mock");

  const validInput = buildInputSnapshot();
  const validResult = await generateIndividualDevelopmentProfileReport(validInput);

  assert.equal(validResult.ok, true, validResult.ok ? undefined : validResult.errors.join(" | "));

  if (!validResult.ok) {
    throw new Error("Expected provider seam to return a valid mock report.");
  }

  assert.equal(validResult.provider, "mock");
  assert.equal(validResult.reportSnapshot.reportType, INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE);
  assert.equal(
    validResult.reportSnapshot.reportVersion,
    INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
  );
  assert.equal(validResult.reportSnapshot.audience, INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE);

  const validated = validateIndividualDevelopmentProfileSnapshot(validResult.reportSnapshot);
  assert.equal(validated.ok, true, validated.ok ? undefined : validated.errors.join(" | "));

  const invalidInput = buildInputSnapshot({
    inputType: "team_fit_report_input_v2_enriched",
  });
  const invalidResult = await generateIndividualDevelopmentProfileReport(invalidInput);

  assert.equal(invalidResult.ok, false);
  if (invalidResult.ok) {
    throw new Error("Expected invalid input to produce controlled failure.");
  }

  assert.equal(invalidResult.provider, "mock");
  assert.equal(invalidResult.reason, "invalid_input");
  assert.equal(Array.isArray(invalidResult.errors), true);
  assert.equal(invalidResult.errors.length > 0, true);

  console.log("test-individual-development-profile-provider-seam: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
