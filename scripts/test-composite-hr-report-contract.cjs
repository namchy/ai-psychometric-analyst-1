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

const {
  COMPOSITE_HR_REPORT_CONTRACT_VERSION,
  validateCompositeHrReportSnapshot,
} = require("../lib/assessment/composite-hr-report-contract.ts");
const {
  generateMockCompositeHrReport,
} = require("../lib/assessment/composite-hr-report-provider-mock.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildCompositeInputSnapshotFixture(overrides = {}) {
  return {
    contractVersion: "composite_hr_input_v1",
    targetReportContractVersion: "composite_hr_v1",
    sourceType: "assessment",
    reportType: "composite",
    audience: "hr",
    locale: "bs",
    generatedFor: {
      organizationId: "org-1",
      participantId: "participant-1",
      assessmentAssignmentId: "assignment-1",
    },
    assessmentAssignment: {
      id: "assignment-1",
      assignmentType: "standard_battery",
      status: "active",
      locale: "bs",
      createdAt: "2026-05-12T06:00:00.000Z",
    },
    sourceAttempts: [
      {
        attemptId: "attempt-ipip",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        status: "completed",
        completedAt: "2026-05-12T06:30:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 0,
      },
      {
        attemptId: "attempt-safran",
        testId: "test-safran",
        testSlug: "safran_v1",
        status: "completed",
        completedAt: "2026-05-12T06:45:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 1,
      },
      {
        attemptId: "attempt-mwms",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        status: "completed",
        completedAt: "2026-05-12T07:00:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 2,
      },
    ],
    coverage: {
      requiredCount: 3,
      completedCount: 3,
      requiredTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
      completedTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
      missingTestSlugs: [],
    },
    deterministicInputs: {
      ipip: {
        attemptId: "attempt-ipip",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        scale: { min: 1, max: 5 },
        domains: [],
        summarySignals: {
          rankedDomains: ["CONSCIENTIOUSNESS", "AGREEABLENESS", "EXTRAVERSION"],
          highestDomains: ["CONSCIENTIOUSNESS"],
          lowestDomains: ["NEUROTICISM"],
          balancedDomains: [],
          topFacets: [],
          lowestFacets: [],
        },
      },
      safran: {
        attemptId: "attempt-safran",
        testId: "test-safran",
        testSlug: "safran_v1",
        overall: { rawScore: 36, maxScore: 54, band: "moderate_raw", interpretation: "moderate" },
        verbal: { rawScore: 14, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        figural: { rawScore: 10, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        numeric: { rawScore: 12, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        summarySignals: {
          strongestDomain: "verbal",
          lowestDomain: "figural",
        },
      },
      mwms: {
        attemptId: "attempt-mwms",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        scale: { min: 1, max: 7 },
        dimensions: [],
        motivationStructure: {
          autonomousMotivationScore: 6,
          controlledMotivationScore: 3.5,
          amotivationScore: 1.8,
        },
        summarySignals: {
          dominantDrivers: ["intrinsic", "identified"],
          lowerDrivers: ["amotivation", "external_social"],
          cautionFlags: {
            elevatedAmotivation: false,
            highControlledRelativeToAutonomous: false,
            mixedProfile: false,
          },
        },
      },
    },
    summarySignals: {
      personalityHighestDomains: ["CONSCIENTIOUSNESS"],
      personalityLowestDomains: ["NEUROTICISM"],
      cognitiveStrongestDomain: "verbal",
      cognitiveLowestDomain: "figural",
      motivationHighestDrivers: ["intrinsic", "identified"],
      motivationLowestDrivers: ["amotivation", "external_social"],
      crossInstrumentFlags: [],
    },
    guardrails: {
      usesOnlyLinkedAssignmentAttempts: true,
      usesHistoricalAttemptFallback: false,
      usesSingleTestAiReportsAsPrimaryInput: false,
      aiMayNotChangeScores: true,
    },
    metadata: {
      builtAt: "2026-05-12T09:00:00.000Z",
      builderVersion: "v1",
    },
    ...overrides,
  };
}

function collectText(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectText(item, output);
    }

    return output;
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      collectText(nestedValue, output);
    }
  }

  return output;
}

function expectInvalid(snapshot, pattern) {
  const validation = validateCompositeHrReportSnapshot(snapshot);
  assert.equal(validation.ok, false);
  assert.equal(validation.errors.some((error) => pattern.test(error)), true);
}

function testValidMockProviderOutputPassesValidator() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const reportSnapshot = generateMockCompositeHrReport(inputSnapshot);
  const validation = validateCompositeHrReportSnapshot(reportSnapshot);

  assert.equal(validation.ok, true);
  assert.equal(reportSnapshot.contractVersion, COMPOSITE_HR_REPORT_CONTRACT_VERSION);
  assert.deepEqual(
    reportSnapshot.source.sourceAttemptIds,
    inputSnapshot.sourceAttempts.map((attempt) => attempt.attemptId),
  );
}

function testWrongContractVersionFails() {
  const reportSnapshot = generateMockCompositeHrReport(buildCompositeInputSnapshotFixture());
  const invalidSnapshot = {
    ...clone(reportSnapshot),
    contractVersion: "broken_contract",
  };

  expectInvalid(invalidSnapshot, /contractVersion/);
}

function testWrongAudienceFails() {
  const reportSnapshot = generateMockCompositeHrReport(buildCompositeInputSnapshotFixture());
  const invalidSnapshot = {
    ...clone(reportSnapshot),
    audience: "participant",
  };

  expectInvalid(invalidSnapshot, /audience/);
}

function testMissingGeneratedForFails() {
  const reportSnapshot = generateMockCompositeHrReport(buildCompositeInputSnapshotFixture());
  const invalidSnapshot = clone(reportSnapshot);
  delete invalidSnapshot.generatedFor;

  expectInvalid(invalidSnapshot, /generatedFor/);
}

function testEmptySourceAttemptIdsFails() {
  const reportSnapshot = generateMockCompositeHrReport(buildCompositeInputSnapshotFixture());
  const invalidSnapshot = {
    ...clone(reportSnapshot),
    source: {
      ...clone(reportSnapshot.source),
      sourceAttemptIds: [],
    },
  };

  expectInvalid(invalidSnapshot, /source\.sourceAttemptIds/);
}

function testMissingSummaryFails() {
  const reportSnapshot = generateMockCompositeHrReport(buildCompositeInputSnapshotFixture());
  const invalidSnapshot = clone(reportSnapshot);
  delete invalidSnapshot.summary;

  expectInvalid(invalidSnapshot, /summary/);
}

function testNoForbiddenSourceMutation() {
  const inputSnapshot = buildCompositeInputSnapshotFixture({
    sourceAttempts: [
      {
        attemptId: "attempt-a",
        testId: "test-a",
        testSlug: "ipip-neo-120-v1",
        status: "completed",
        completedAt: "2026-05-12T06:30:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 0,
      },
      {
        attemptId: "attempt-b",
        testId: "test-b",
        testSlug: "safran_v1",
        status: "completed",
        completedAt: "2026-05-12T06:45:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 1,
      },
    ],
    coverage: {
      requiredCount: 2,
      completedCount: 2,
      requiredTestSlugs: ["ipip-neo-120-v1", "safran_v1"],
      completedTestSlugs: ["ipip-neo-120-v1", "safran_v1"],
      missingTestSlugs: [],
    },
  });
  const reportSnapshot = generateMockCompositeHrReport(inputSnapshot);

  assert.deepEqual(reportSnapshot.source.sourceAttemptIds, ["attempt-a", "attempt-b"]);
}

function testNoForbiddenTextInMockReport() {
  const reportSnapshot = generateMockCompositeHrReport(buildCompositeInputSnapshotFixture());
  const text = collectText(reportSnapshot).join("\n").toLowerCase();

  for (const forbiddenPhrase of ["zaposliti", "ne zaposliti", "fit score", "idealni kandidat"]) {
    assert.equal(
      text.includes(forbiddenPhrase),
      false,
      `Mock report must not contain forbidden phrase: ${forbiddenPhrase}`,
    );
  }
}

function main() {
  testValidMockProviderOutputPassesValidator();
  testWrongContractVersionFails();
  testWrongAudienceFails();
  testMissingGeneratedForFails();
  testEmptySourceAttemptIdsFails();
  testMissingSummaryFails();
  testNoForbiddenSourceMutation();
  testNoForbiddenTextInMockReport();

  console.log("Composite HR report contract tests passed.");
}

main();
