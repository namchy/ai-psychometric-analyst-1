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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  buildSafranCandidateInterpretation,
  getSafranInterpretationFallbackText,
} = require("../lib/assessment/safran-interpretation.ts");

function collectCandidateFacingTexts(interpretation) {
  return [
    interpretation.introBs,
    interpretation.overall?.bandLabelBs ?? "",
    interpretation.overall?.textBs ?? "",
    interpretation.relativeProfileBs ?? "",
    ...interpretation.limitationsBs,
    ...interpretation.domains.flatMap((domain) => [
      domain.domainLabelBs,
      domain.bandLabelBs,
      domain.textBs,
    ]),
  ].filter(Boolean);
}

function interpretationFor(scoreKey, score) {
  const interpretation = buildSafranCandidateInterpretation({
    verbal_score: 9,
    figural_score: 9,
    numerical_series_score: 4,
    cognitive_composite_v1: 22,
    [scoreKey]: score,
  });

  if (scoreKey === "cognitive_composite_v1") {
    return interpretation.overall;
  }

  return interpretation.domains.find((domain) => domain.scoreKey === scoreKey) ?? null;
}

assert.equal(interpretationFor("verbal_score", 0)?.bandKey, "lower_raw");
assert.equal(interpretationFor("verbal_score", 6)?.bandKey, "lower_raw");
assert.equal(interpretationFor("verbal_score", 7)?.bandKey, "moderate_raw");
assert.equal(interpretationFor("verbal_score", 12)?.bandKey, "moderate_raw");
assert.equal(interpretationFor("verbal_score", 13)?.bandKey, "higher_raw");
assert.equal(interpretationFor("verbal_score", 18)?.bandKey, "higher_raw");

assert.equal(interpretationFor("figural_score", 0)?.bandKey, "lower_raw");
assert.equal(interpretationFor("figural_score", 6)?.bandKey, "lower_raw");
assert.equal(interpretationFor("figural_score", 7)?.bandKey, "moderate_raw");
assert.equal(interpretationFor("figural_score", 12)?.bandKey, "moderate_raw");
assert.equal(interpretationFor("figural_score", 13)?.bandKey, "higher_raw");
assert.equal(interpretationFor("figural_score", 18)?.bandKey, "higher_raw");

assert.equal(interpretationFor("numerical_series_score", 0)?.bandKey, "lower_raw");
assert.equal(interpretationFor("numerical_series_score", 3)?.bandKey, "lower_raw");
assert.equal(interpretationFor("numerical_series_score", 4)?.bandKey, "moderate_raw");
assert.equal(interpretationFor("numerical_series_score", 6)?.bandKey, "moderate_raw");
assert.equal(interpretationFor("numerical_series_score", 7)?.bandKey, "higher_raw");
assert.equal(interpretationFor("numerical_series_score", 9)?.bandKey, "higher_raw");

assert.equal(interpretationFor("cognitive_composite_v1", 0)?.bandKey, "lower_raw");
assert.equal(interpretationFor("cognitive_composite_v1", 15)?.bandKey, "lower_raw");
assert.equal(interpretationFor("cognitive_composite_v1", 16)?.bandKey, "moderate_raw");
assert.equal(interpretationFor("cognitive_composite_v1", 30)?.bandKey, "moderate_raw");
assert.equal(interpretationFor("cognitive_composite_v1", 31)?.bandKey, "higher_raw");
assert.equal(interpretationFor("cognitive_composite_v1", 45)?.bandKey, "higher_raw");

const missingInterpretation = buildSafranCandidateInterpretation({
  verbal_score: null,
  figural_score: undefined,
});
assert.equal(missingInterpretation.overall, null);
assert.deepEqual(missingInterpretation.domains, []);
assert.equal(missingInterpretation.limitationsBs.length, 3);
assert.deepEqual(missingInterpretation.limitationsBs, [
  "Rezultati su broj tačnih odgovora u ovoj procjeni, ne IQ skor, percentile ili rang.",
  "SAFRAN ne mjeri iskustvo, motivaciju, kreativnost, komunikacijski stil ili timski doprinos.",
  "Rezultate je najbolje čitati zajedno s intervjuom, radnim zadatkom, iskustvom i drugim testovima.",
]);
assert.equal(
  getSafranInterpretationFallbackText({ scoreKey: "cognitive_composite_v1", reason: "missing" }),
  "Ukupno tumačenje trenutno nije dostupno jer nedostaje dio rezultata.",
);
assert.equal(
  getSafranInterpretationFallbackText({ scoreKey: "verbal_score", reason: "invalid_range" }),
  "Rezultat za ovaj dio nije u očekivanom rasponu, pa tumačenje nije prikazano.",
);

const forbiddenWords = ["nizak", "visok", "prosječan", "iznadprosječan", "ispodprosječan", "IQ"];
const interpretation = buildSafranCandidateInterpretation({
  verbal_score: 18,
  figural_score: 18,
  numerical_series_score: 9,
  cognitive_composite_v1: 45,
});
const candidateFacingTexts = collectCandidateFacingTexts(interpretation);
const bandLabels = [
  interpretation.overall?.bandLabelBs ?? "",
  ...interpretation.domains.map((domain) => domain.bandLabelBs),
];

for (const text of candidateFacingTexts) {
  assert.equal(text.includes("V1"), false, `Candidate-facing text unexpectedly contains "V1": ${text}`);
  assert.equal(
    text.includes("SAFRAN V1"),
    false,
    `Candidate-facing text unexpectedly contains "SAFRAN V1": ${text}`,
  );
  assert.equal(
    text.toLowerCase().includes("kognitivni kompozit"),
    false,
    `Candidate-facing text unexpectedly contains "kognitivni kompozit": ${text}`,
  );
}

for (const domain of interpretation.domains) {
  assert.equal(
    domain.textBs.includes("Rezultat ne znači"),
    false,
    `Domain text unexpectedly contains "Rezultat ne znači": ${domain.textBs}`,
  );
  assert.equal(
    domain.textBs.includes("Rezultat ne opisuje"),
    false,
    `Domain text unexpectedly contains "Rezultat ne opisuje": ${domain.textBs}`,
  );
}

const iqTexts = candidateFacingTexts.filter((text) => text.includes("IQ"));
assert.deepEqual(iqTexts, [
  "Ovo je opis tvog učinka na SAFRAN zadacima. Rezultati su sirovi skorovi, odnosno broj tačnih odgovora u ovoj procjeni. Ne predstavljaju IQ, percentile niti rang u odnosu na populaciju.",
  "Rezultati su broj tačnih odgovora u ovoj procjeni, ne IQ skor, percentile ili rang.",
]);

assert.deepEqual(bandLabels, [
  "veći ukupni broj tačnih odgovora",
  "veći broj tačnih odgovora",
  "veći broj tačnih odgovora",
  "veći broj tačnih odgovora",
]);

for (const label of bandLabels) {
  for (const forbiddenWord of forbiddenWords.filter((word) => word !== "IQ")) {
    assert.equal(
      label.toLowerCase().includes(forbiddenWord.toLowerCase()),
      false,
      `Band label "${label}" unexpectedly contains "${forbiddenWord}"`,
    );
  }
}

const lowCompositeInterpretation = buildSafranCandidateInterpretation({
  verbal_score: 6,
  figural_score: 5,
  numerical_series_score: 2,
  cognitive_composite_v1: 13,
});
assert.equal(lowCompositeInterpretation.relativeProfileBs, null);

const relativeProfileInterpretation = buildSafranCandidateInterpretation({
  verbal_score: 15,
  figural_score: 8,
  numerical_series_score: 3,
  cognitive_composite_v1: 26,
});
assert.equal(
  relativeProfileInterpretation.relativeProfileBs,
  "U okviru ovog testa, najviše tačnih odgovora ostvario si u dijelu: Verbalni dio. To može biti korisno kao orijentir za razumijevanje tvog profila u ovoj procjeni, ali ne predstavlja širu procjenu sposobnosti izvan testa.",
);

console.log("SAFRAN interpretation tests passed.");
