const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
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

function compileTypeScript(module, filename, jsx = false) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
      jsx: jsx ? ts.JsxEmit.ReactJSX : undefined,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
}

require.extensions[".ts"] = function compileTs(module, filename) {
  compileTypeScript(module, filename, false);
};

require.extensions[".tsx"] = function compileTsx(module, filename) {
  compileTypeScript(module, filename, true);
};

const {
  CompositeHrReportView,
  buildCompositeHrReportViewModel,
} = require("../components/dashboard/composite-hr-report-view.tsx");
const {
  generateMockCompositeHrReport,
} = require("../lib/assessment/composite-hr-report-provider-mock.ts");
const {
  resolveReadyCompositeHrAssessmentReport,
} = require("../lib/assessment/assessment-reports.ts");

function buildCompositeInputSnapshotFixture() {
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
  };
}

function buildReadyReport(snapshot) {
  return {
    id: "assessment-report-ready",
    assessment_assignment_id: "assignment-1",
    organization_id: "org-1",
    participant_id: "participant-1",
    report_type: "composite",
    audience: "hr",
    source_type: "assessment",
    report_status: "ready",
    generator_type: "mock",
    contract_version: "composite_hr_v1",
    prompt_version_id: null,
    model_name: null,
    generator_version: "v1",
    input_snapshot: null,
    report_snapshot: snapshot,
    failure_code: null,
    failure_reason: null,
    queued_at: null,
    started_at: "2026-05-12T09:05:00.000Z",
    completed_at: "2026-05-12T09:06:00.000Z",
    generated_at: "2026-05-12T09:06:00.000Z",
    created_at: "2026-05-12T09:00:00.000Z",
    updated_at: "2026-05-12T09:06:00.000Z",
    metadata: {},
  };
}

function main() {
  const snapshot = generateMockCompositeHrReport(buildCompositeInputSnapshotFixture());
  const readyReport = buildReadyReport(snapshot);
  const resolved = resolveReadyCompositeHrAssessmentReport(readyReport);

  assert.equal(resolved.status, "ready");

  const model = buildCompositeHrReportViewModel({
    report: readyReport,
    snapshot,
  });

  assert.equal(model.title, "Kompozitni HR izvještaj");
  assert.equal(model.statusLabel, "Spremno za pregled");
  assert.equal(
    model.description,
    "Ovaj prikaz koristi već generisan izvještaj i ne mijenja rezultate procjena.",
  );
  assert.equal(model.participantReportsHref, "/dashboard/participants/participant-1/reports");
  assert.equal(model.source.assessmentAssignmentId, "assignment-1");
  assert.equal(model.source.assessmentCycleLabel, "Standardna baterija procjena");
  assert.equal(model.source.assessmentCycleIdLabel, "ID: assignme...");
  assert.equal(model.source.assessmentCountLabel, "3 završene procjene");
  assert.deepEqual(model.source.testLabels, [
    "Procjena ličnosti",
    "Kognitivna procjena",
    "Motivacija za rad",
  ]);
  assert.equal(model.source.generationModeLabel, "Testni prikaz");
  assert.equal(model.source.sourceAttemptCount, 3);
  assert.equal(model.summary.headline, snapshot.summary.headline);
  assert.equal(model.summary.profileOverview, snapshot.summary.profileOverview);
  assert.equal(model.integratedSignals.length > 0, true);
  assert.equal(
    model.integratedSignals.flatMap((signal) => signal.evidence).some((item) => item.displayTestLabel === "Ličnost"),
    true,
  );
  assert.equal(
    model.integratedSignals
      .flatMap((signal) => signal.evidence)
      .some((item) => item.displayTestLabel === "Kognitivni rezultat"),
    true,
  );
  assert.equal(
    model.integratedSignals
      .flatMap((signal) => signal.evidence)
      .some((item) => item.displayTestLabel === "Motivacija"),
    true,
  );
  assert.equal(model.interviewGuidance.focusAreas.length > 0, true);
  assert.equal(model.onboardingGuidance.managementTips.length > 0, true);
  assert.equal(model.onboardingGuidance.supportNeeds.length > 0, true);
  assert.equal(model.limitations.length > 0, true);
  assert.equal(
    model.limitations.some((item) => item.includes("source attempts") || item.includes("score vrijednosti")),
    false,
  );

  const html = renderToStaticMarkup(
    React.createElement(CompositeHrReportView, {
      report: readyReport,
      snapshot,
    }),
  );

  assert.equal(html.includes("Procjene uključene u izvještaj"), true);
  assert.equal(html.includes("Procjena ličnosti"), true);
  assert.equal(html.includes("Kognitivna procjena"), true);
  assert.equal(html.includes("Motivacija za rad"), true);
  assert.equal(html.includes("Ličnost:"), true);
  assert.equal(html.includes("Kognitivni rezultat:"), true);
  assert.equal(html.includes("Motivacija:"), true);
  assert.equal(html.includes("3 završene procjene"), true);
  assert.equal(html.includes("Testni prikaz"), true);
  assert.equal(html.includes("mock / v1"), false);
  assert.equal(html.includes("linked attemptova"), false);
  assert.equal(html.includes("snapshot"), false);
  assert.equal(html.includes("renderer"), false);
  assert.equal(html.includes("source attempts"), false);
  assert.equal(html.includes("3 povezana pokušaja"), false);
  assert.equal(html.includes("ipip-neo-120-v1"), false);
  assert.equal(html.includes("safran_v1"), false);
  assert.equal(html.includes("mwms_v1"), false);

  const invalid = resolveReadyCompositeHrAssessmentReport(
    buildReadyReport({
      ...snapshot,
      summary: null,
    }),
  );
  assert.equal(invalid.status, "invalid_snapshot");
  assert.equal(invalid.message.includes("validaciju"), true);

  console.log("Composite HR report renderer tests passed.");
}

main();
