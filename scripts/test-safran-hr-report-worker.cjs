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

const workerSource = fs.readFileSync(
  path.join(projectRoot, "lib/assessment/report-job-worker.ts"),
  "utf8",
);

assert.match(
  workerSource,
  /isSafranTestSlug\(job\.test_slug\) && job\.audience === "hr"[\s\S]*?isSafranHrReportInput\(preparedInput\.promptInput\)[\s\S]*?expectedInput:\s*preparedInput\.promptInput[\s\S]*?enforceProseGuardrails:\s*false/,
);

const {
  buildPreparedReportGenerationInput,
} = require("../lib/assessment/report-provider-helpers.ts");
const {
  buildMockSafranHrReportV1,
  validateSafranHrReport,
} = require("../lib/assessment/safran-hr-report-v1.ts");

const preparedInput = buildPreparedReportGenerationInput(
  {
    attemptId: "attempt-safran-hr-worker",
    testId: "test-safran",
    testSlug: "safran_v1",
    audience: "hr",
    locale: "bs",
    scoringMethod: "correct_answers",
    promptVersion: "v1",
    testName: "SAFRAN",
    results: {
      attemptId: "attempt-safran-hr-worker",
      scoringMethod: "correct_answers",
      dimensions: [
        { dimension: "verbal_score", rawScore: 12, scoredQuestionCount: 18 },
        { dimension: "figural_score", rawScore: 9, scoredQuestionCount: 18 },
        { dimension: "numerical_series_score", rawScore: 5, scoredQuestionCount: 18 },
        { dimension: "cognitive_composite_v1", rawScore: 26, scoredQuestionCount: 54 },
      ],
      scoredResponseCount: 45,
      unscoredResponses: [],
      derived: {
        safranV1: {
          verbalScore: 12,
          figuralScore: 9,
          numericalRawScore: 2.5,
          numericalAdjustedScore: 5,
          numericalScore: 5,
          numericalSeriesScore: 5,
          cognitiveCompositeScore: 26,
          cognitiveCompositeV1: 26,
        },
      },
    },
  },
  {
    promptVersionId: null,
    promptTemplate: null,
  },
);

const report = buildMockSafranHrReportV1(preparedInput.promptInput);

function simulateWorkerFinalValidation(candidateReport) {
  const validation = validateSafranHrReport(candidateReport, {
    expectedInput: preparedInput.promptInput,
    enforceProseGuardrails: false,
  });

  return validation.ok
    ? { status: "ready", snapshot: validation.value }
    : { status: "failed", errors: validation.errors };
}

const proseFailure = structuredClone(report);
proseFailure.executiveSummary.summary =
  "IQ i percentil su diagnostic-only prose nalazi bez propisane hipoteza formulacije.";

assert.equal(
  validateSafranHrReport(proseFailure, {
    expectedInput: preparedInput.promptInput,
  }).ok,
  false,
);
assert.equal(
  validateSafranHrReport(proseFailure, {
    expectedInput: preparedInput.promptInput,
    enforceProseGuardrails: false,
  }).ok,
  true,
);
assert.deepEqual(simulateWorkerFinalValidation(proseFailure), {
  status: "ready",
  snapshot: proseFailure,
});

const referenceFailure = structuredClone(report);
referenceFailure.scoreReferences.numeric.rawScore += 1;
assert.equal(
  validateSafranHrReport(referenceFailure, {
    expectedInput: preparedInput.promptInput,
    enforceProseGuardrails: false,
  }).ok,
  false,
);
assert.equal(simulateWorkerFinalValidation(referenceFailure).status, "failed");

const localeFailure = structuredClone(report);
localeFailure.generatedLanguage = "en";
assert.equal(
  validateSafranHrReport(localeFailure, {
    expectedInput: preparedInput.promptInput,
    enforceProseGuardrails: false,
  }).ok,
  false,
);
assert.equal(simulateWorkerFinalValidation(localeFailure).status, "failed");

console.log("SAFRAN HR report worker tests passed.");
