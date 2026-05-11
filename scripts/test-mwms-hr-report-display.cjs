const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const nextLinkStubPath = path.join(__dirname, "test-stub-next-link.cjs");
const nextFontGoogleStubPath = path.join(__dirname, "test-stub-next-font-google.cjs");
const nextFontLocalStubPath = path.join(__dirname, "test-stub-next-font-local.cjs");
const rechartsStubPath = path.join(__dirname, "test-stub-recharts.cjs");
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

  if (request === "next/link") {
    return nextLinkStubPath;
  }

  if (request === "next/font/google") {
    return nextFontGoogleStubPath;
  }

  if (request === "next/font/local") {
    return nextFontLocalStubPath;
  }

  if (request === "recharts") {
    return rechartsStubPath;
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

function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
}

require.extensions[".ts"] = compileTypeScript;
require.extensions[".tsx"] = compileTypeScript;

const { CompletedAssessmentSummary } = require("../components/assessment/completed-assessment-summary.tsx");
const { buildPreparedReportGenerationInput } = require("../lib/assessment/report-provider-helpers.ts");
const { mockReportProvider } = require("../lib/assessment/report-provider-mock.ts");
const { getReportGenerationCapability } = require("../lib/assessment/report-capabilities.ts");
const {
  resolveMwmsHrReportDisplay,
} = require("../lib/assessment/mwms-hr-report-display.ts");

const mwmsResults = {
  attemptId: "attempt-mwms-hr-display",
  scoringMethod: "likert_sum",
  dimensions: [
    { dimension: "amotivation", rawScore: 2.25, scoredQuestionCount: 3 },
    { dimension: "external_social", rawScore: 4, scoredQuestionCount: 3 },
    { dimension: "external_material", rawScore: 5, scoredQuestionCount: 3 },
    { dimension: "introjected", rawScore: 3.75, scoredQuestionCount: 4 },
    { dimension: "identified", rawScore: 4.67, scoredQuestionCount: 3 },
    { dimension: "intrinsic", rawScore: 5.5, scoredQuestionCount: 3 },
  ],
  scoredResponseCount: 19,
  unscoredResponses: [],
};

async function generateReport(audience) {
  const preparedInput = buildPreparedReportGenerationInput({
    attemptId: `attempt-mwms-${audience}-display`,
    testId: "test-mwms",
    testSlug: "mwms_v1",
    audience,
    locale: "bs",
    scoringMethod: "likert_sum",
    promptVersion: "v1",
    testName: "Procjena radne motivacije",
    results: mwmsResults,
  });
  const result = await mockReportProvider.generateReport(preparedInput);

  assert.equal(result.ok, true, result.ok ? undefined : result.reason);

  if (!result.ok) {
    throw new Error(`Expected MWMS ${audience} mock report generation to succeed.`);
  }

  return result.report;
}

async function main() {
  const report = await generateReport("hr");
  const display = resolveMwmsHrReportDisplay(report);

  assert.ok(display);
  assert.equal(display.header.title, "MWMS HR izvještaj");
  assert.equal(display.sections.motivationProfile, "Motivacijski profil po dimenzijama");
  assert.equal(display.sections.notes, "Kako koristiti nalaz");
  assert.equal(display.dimensions.length, 6);
  assert.equal(display.keyMotivationalDrivers.length, 3);
  assert.equal(display.potentialFrictionPoints.length, 3);
  assert.equal(display.workContextHypotheses.length, 3);
  assert.equal(display.managerSupportGuidance.length, 4);
  assert.equal(display.interviewQuestions.length, 5);
  assert.equal(display.onboardingRecommendations.length, 4);
  assert.equal(display.decisionSupportNote.length >= 2, true);

  for (const dimension of display.dimensions) {
    assert.equal(dimension.scoreLabel.endsWith(" / 7"), true);
    assert.equal(dimension.rawScore >= 1 && dimension.rawScore <= 7, true);
    assert.equal(typeof dimension.meaning, "string");
    assert.equal(dimension.meaning.length > 0, true);
  }

  const hrHtml = renderToStaticMarkup(
    React.createElement(CompletedAssessmentSummary, {
      completedAt: "2026-05-08T09:42:07.674Z",
      locale: "bs",
      organizationName: "Test organizacija",
      participantName: "Test kandidat",
      testSlug: "mwms_v1",
      testName: "Procjena radne motivacije",
      results: mwmsResults,
      reportState: {
        status: "ready",
        reportFamily: "mwms",
        reportAudience: "hr",
        reportVersion: "v1",
        reportRenderFormat: "mwms_hr_report_v1",
        report,
      },
    }),
  );

  for (const expectedText of [
    "MWMS HR izvještaj",
    "Namijenjeno HR-u",
    "Motivacijski profil po dimenzijama",
    "Motivacijski drajveri",
    "Tačke moguće frikcije",
    "Hipoteze za radni kontekst",
    "Menadžerske smjernice",
    "Intervju pitanja",
    "Onboarding preporuke",
    "Kako koristiti nalaz",
  ]) {
    assert.equal(hrHtml.includes(expectedText), true, `Expected rendered HTML to include ${expectedText}.`);
  }

  assert.equal(/raw_answers|debug|radar/i.test(hrHtml), false);

  const participantReport = await generateReport("participant");
  assert.equal(resolveMwmsHrReportDisplay(participantReport), null);

  const participantHtml = renderToStaticMarkup(
    React.createElement(CompletedAssessmentSummary, {
      completedAt: "2026-05-08T09:42:07.674Z",
      locale: "bs",
      organizationName: "Test organizacija",
      participantName: "Test kandidat",
      testSlug: "mwms_v1",
      testName: "Procjena radne motivacije",
      results: mwmsResults,
      reportState: {
        status: "ready",
        reportFamily: "mwms",
        reportAudience: "participant",
        reportVersion: "v1",
        reportRenderFormat: "mwms_participant_report_v1",
        report: participantReport,
      },
    }),
  );

  assert.equal(participantHtml.includes("Radna motivacija"), true);
  assert.equal(participantHtml.includes("MWMS HR izvještaj"), false);

  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: "mwms_v1",
      audience: "hr",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: true, status: "active" },
  );

  console.log("MWMS HR report display tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
