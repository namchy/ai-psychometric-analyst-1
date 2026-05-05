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
  buildMockSafranParticipantAiReport,
  buildSafranParticipantAiReportInput,
  validateSafranParticipantAiReport,
  safranParticipantAiReportV1OpenAiSchema,
} = require("../lib/assessment/safran-participant-ai-report-v1.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertOpenAiCompatibleSchemaNode(node, pathLabel) {
  assert.equal(Boolean(node && typeof node === "object"), true, `${pathLabel} must be an object.`);

  if ("const" in node) {
    assert.equal(typeof node.type, "string", `${pathLabel} const nodes must include explicit type.`);
  }

  if (node.type === "object") {
    assert.equal(Boolean(node.properties && typeof node.properties === "object"), true, `${pathLabel} object must define properties.`);
    assert.equal(Array.isArray(node.required), true, `${pathLabel} object must define required.`);
    assert.equal(node.additionalProperties, false, `${pathLabel} object must set additionalProperties=false.`);

    for (const [key, child] of Object.entries(node.properties)) {
      assertOpenAiCompatibleSchemaNode(child, `${pathLabel}.properties.${key}`);
    }
  }

  if (node.type === "array") {
    assertOpenAiCompatibleSchemaNode(node.items, `${pathLabel}.items`);
  }
}

const input = buildSafranParticipantAiReportInput({
  testSlug: "safran_v1",
  locale: "bs",
  results: {
    attemptId: "attempt-safran-contract",
    scoringMethod: "correct_answers",
    dimensions: [
      { dimension: "verbal_score", rawScore: 14, scoredQuestionCount: 18 },
      { dimension: "figural_score", rawScore: 11, scoredQuestionCount: 18 },
      { dimension: "numerical_series_score", rawScore: 7, scoredQuestionCount: 18 },
      { dimension: "cognitive_composite_v1", rawScore: 32, scoredQuestionCount: 54 },
    ],
    scoredResponseCount: 45,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 14,
        figuralScore: 11,
        numericalRawScore: 3.5,
        numericalAdjustedScore: 7,
        numericalScore: 7,
        numericalSeriesScore: 7,
        cognitiveCompositeScore: 32,
        cognitiveCompositeV1: 32,
      },
    },
  },
});

assertOpenAiCompatibleSchemaNode(
  safranParticipantAiReportV1OpenAiSchema,
  "safranParticipantAiReportV1OpenAiSchema",
);

const validReport = buildMockSafranParticipantAiReport(input);
const validResult = validateSafranParticipantAiReport(validReport, { expectedInput: input });
assert.equal(validResult.ok, true, validResult.ok ? undefined : validResult.errors.join(" | "));

const missingSection = clone(validReport);
delete missingSection.nextStep;
assert.equal(
  validateSafranParticipantAiReport(missingSection, { expectedInput: input }).ok,
  false,
);

const wrongDomainOrder = clone(validReport);
[wrongDomainOrder.domains[0], wrongDomainOrder.domains[1]] = [
  wrongDomainOrder.domains[1],
  wrongDomainOrder.domains[0],
];
const wrongOrderResult = validateSafranParticipantAiReport(wrongDomainOrder, {
  expectedInput: input,
});
assert.equal(wrongOrderResult.ok, false);
assert.equal(
  wrongOrderResult.ok ? false : wrongOrderResult.errors.some((error) => error.includes("domains[0].code")),
  true,
);

const extraTopLevel = clone(validReport);
extraTopLevel.extraSection = { title: "nope" };
assert.equal(
  validateSafranParticipantAiReport(extraTopLevel, { expectedInput: input }).ok,
  false,
);

const unsafeChecks = clone(validReport);
unsafeChecks.safetyChecks.containsIqClaim = true;
assert.equal(
  validateSafranParticipantAiReport(unsafeChecks, { expectedInput: input }).ok,
  false,
);

for (const forbiddenText of [
  "V1",
  "Ukupni kognitivni kompozit",
  "Rezultat ne znači",
  "iznadprosječan",
  "ispodprosječan",
  "hire",
  "no-hire",
  "dijagnoza",
  "klinički",
  "slab u matematici",
  "nizak IQ",
  "nije analitičan",
  "nesposoban",
]) {
  const mutated = clone(validReport);
  mutated.summary.interpretation = `Test ${forbiddenText}`;
  const result = validateSafranParticipantAiReport(mutated, { expectedInput: input });
  assert.equal(result.ok, false, `Expected validator to reject forbidden text ${forbiddenText}.`);
}

const allowedReadingGuide = clone(validReport);
allowedReadingGuide.readingGuide.bullets = [
  "Ovi rezultati ne predstavljaju mjeru opšte inteligencije i opisuju samo učinak u SAFRAN zadacima.",
  "Ovaj rezultat nije percentil i ne predstavlja poređenje s lokalnom referentnom grupom.",
  "Practice pitanja služe samo za upoznavanje s formatom zadataka i ne ulaze u scoring.",
  "SAFRAN rezultat ne treba koristiti kao samostalnu odluku o kandidatu.",
  "Najkorisnije ga je čitati zajedno s ostalim dijelovima Deep Profile procjene.",
];
const allowedResult = validateSafranParticipantAiReport(allowedReadingGuide, {
  expectedInput: input,
});
assert.equal(allowedResult.ok, true, allowedResult.ok ? undefined : allowedResult.errors.join(" | "));

const allowedEquivalentReadingGuide = clone(validReport);
allowedEquivalentReadingGuide.readingGuide.bullets = [
  "Ovi rezultati ne predstavljaju mjeru opšte inteligencije i opisuju samo učinak u SAFRAN zadacima.",
  "Ovaj rezultat nije percentil i ne predstavlja poređenje s lokalnom normativnom grupom.",
  "Probna pitanja služe samo za upoznavanje s formatom zadataka i ne ulaze u rezultat.",
  "SAFRAN rezultat ne treba koristiti kao jedinu osnovu za odluku o kandidatu.",
  "Najkorisnije ga je čitati zajedno s ostalim dijelovima Deep Profile procjene.",
];
const allowedEquivalentResult = validateSafranParticipantAiReport(allowedEquivalentReadingGuide, {
  expectedInput: input,
});
assert.equal(
  allowedEquivalentResult.ok,
  true,
  allowedEquivalentResult.ok ? undefined : allowedEquivalentResult.errors.join(" | "),
);

const missingLocalReference = clone(validReport);
missingLocalReference.readingGuide.bullets = [
  "Ovi rezultati ne predstavljaju mjeru opšte inteligencije i opisuju samo učinak u SAFRAN zadacima.",
  "Ovaj rezultat nije percentil.",
  "Practice pitanja služe samo za upoznavanje s formatom zadataka i ne ulaze u scoring.",
  "SAFRAN rezultat ne treba koristiti kao samostalnu odluku o kandidatu.",
  "Najkorisnije ga je čitati zajedno s ostalim dijelovima Deep Profile procjene.",
];
const missingLocalReferenceResult = validateSafranParticipantAiReport(missingLocalReference, {
  expectedInput: input,
});
assert.equal(missingLocalReferenceResult.ok, false);
assert.equal(
  missingLocalReferenceResult.ok
    ? false
    : missingLocalReferenceResult.errors.includes(
        "readingGuide.bullets: Missing local norms boundary.",
      ),
  true,
);

const missingStandaloneDecision = clone(validReport);
missingStandaloneDecision.readingGuide.bullets = [
  "Ovi rezultati ne predstavljaju mjeru opšte inteligencije i opisuju samo učinak u SAFRAN zadacima.",
  "Ovaj rezultat nije percentil i ne predstavlja poređenje s lokalnom referentnom grupom.",
  "Practice pitanja služe samo za upoznavanje s formatom zadataka i ne ulaze u scoring.",
  "Najkorisnije ga je čitati zajedno s ostalim dijelovima Deep Profile procjene.",
  "Rezultat treba čitati oprezno i u kontekstu drugih podataka iz procjene.",
];
const missingStandaloneDecisionResult = validateSafranParticipantAiReport(
  missingStandaloneDecision,
  {
    expectedInput: input,
  },
);
assert.equal(missingStandaloneDecisionResult.ok, false);
assert.equal(
  missingStandaloneDecisionResult.ok
    ? false
    : missingStandaloneDecisionResult.errors.includes(
        "readingGuide.bullets: Missing standalone decision boundary.",
      ),
  true,
);

const missingPracticeBoundary = clone(validReport);
missingPracticeBoundary.readingGuide.bullets = [
  "Ovi rezultati ne predstavljaju mjeru opšte inteligencije i opisuju samo učinak u SAFRAN zadacima.",
  "Ovaj rezultat nije percentil i ne predstavlja poređenje s lokalnom referentnom grupom.",
  "SAFRAN rezultat ne treba koristiti kao samostalnu odluku o kandidatu.",
  "Najkorisnije ga je čitati zajedno s ostalim dijelovima Deep Profile procjene.",
  "Rezultat vrijedi posmatrati kroz verbalne, figuralne i numeričke zadatke zajedno.",
];
const missingPracticeBoundaryResult = validateSafranParticipantAiReport(
  missingPracticeBoundary,
  {
    expectedInput: input,
  },
);
assert.equal(missingPracticeBoundaryResult.ok, false);
assert.equal(
  missingPracticeBoundaryResult.ok
    ? false
    : missingPracticeBoundaryResult.errors.includes(
        "readingGuide.bullets: Missing practice boundary.",
      ),
  true,
);

const copiedDeterministicMeaning = clone(validReport);
copiedDeterministicMeaning.domains[0].interpretation =
  input.scores.domains[0].deterministicMeaning;
const copiedDeterministicMeaningResult = validateSafranParticipantAiReport(
  copiedDeterministicMeaning,
  {
    expectedInput: input,
  },
);
assert.equal(copiedDeterministicMeaningResult.ok, false);
assert.equal(
  copiedDeterministicMeaningResult.ok
    ? false
    : copiedDeterministicMeaningResult.errors.includes(
        "domains[0].interpretation: Must not copy or closely paraphrase deterministicMeaning.",
      ),
  true,
);

const genericSummary = clone(validReport);
genericSummary.summary.interpretation =
  "Tvoj ukupni rezultat pokazuje umjeren ukupni broj tačnih odgovora u ovom testu.";
genericSummary.cognitiveSignals.primarySignal =
  "Ovdje je važno gledati rezultate po oblastima.";
genericSummary.cognitiveSignals.cautionSignal =
  "Jedna oblast ne treba da se čita odvojeno od drugih.";
genericSummary.cognitiveSignals.balanceNote =
  "Tri dijela testa vrijedi posmatrati zajedno.";
const genericSummaryResult = validateSafranParticipantAiReport(genericSummary, {
  expectedInput: input,
});
assert.equal(genericSummaryResult.ok, false);
assert.equal(
  genericSummaryResult.ok
    ? false
    : genericSummaryResult.errors.includes(
        "summary/cognitiveSignals: Must describe a pattern, relation or contrast across SAFRAN domains.",
      ),
  true,
);

const contrastInput = buildSafranParticipantAiReportInput({
  testSlug: "safran_v1",
  locale: "bs",
  results: {
    attemptId: "attempt-safran-contract-contrast",
    scoringMethod: "correct_answers",
    dimensions: [
      { dimension: "verbal_score", rawScore: 18, scoredQuestionCount: 18 },
      { dimension: "figural_score", rawScore: 18, scoredQuestionCount: 18 },
      { dimension: "numerical_series_score", rawScore: 0, scoredQuestionCount: 18 },
      { dimension: "cognitive_composite_v1", rawScore: 36, scoredQuestionCount: 54 },
    ],
    scoredResponseCount: 54,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 18,
        figuralScore: 18,
        numericalRawScore: 0,
        numericalAdjustedScore: 0,
        numericalScore: 0,
        numericalSeriesScore: 0,
        cognitiveCompositeScore: 36,
        cognitiveCompositeV1: 36,
      },
    },
  },
});
const contrastMock = buildMockSafranParticipantAiReport(contrastInput);
const contrastNarrative = [
  contrastMock.summary.interpretation,
  contrastMock.cognitiveSignals.primarySignal,
  contrastMock.cognitiveSignals.cautionSignal,
  contrastMock.domains[2].interpretation,
].join(" ");
assert.match(contrastNarrative, /verbalno-figuraln/i);
assert.match(contrastNarrative, /numeri[čc]ki dio/i);
assert.match(contrastNarrative, /kontrast|odnos|razlika|u odnosu na/i);

console.log("SAFRAN participant AI report contract tests passed.");
