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
  validateReportLanguageQuality,
  assertReportLanguageQuality,
} = require("../lib/assessment/report-language-quality.ts");

function validateCompositeHrText(text, locale = "bs") {
  return validateReportLanguageQuality({
    text,
    locale,
    audience: "hr",
    reportType: "composite",
    context: "composite_hr_report",
  });
}

function expectIssue(text, expected) {
  const result = validateCompositeHrText(text);
  assert.equal(result.ok, false);
  assert.equal(
    result.issues.some(
      (issue) =>
        issue.code === expected.code &&
        issue.phrase === expected.phrase &&
        (expected.suggestion ? issue.suggestion === expected.suggestion : true),
    ),
    true,
  );
}

function testValidTextPasses() {
  const result = validateCompositeHrText(
    [
      "HR pregled opisuje spremnost na saradnju kao stabilan signal za timski rad.",
      "U kontekstu pritiska rokova vrijedi provjeriti kako osoba cuva kvalitet isporuke.",
      "Nalaz sluzi kao hipoteza za intervju i onboarding, ne kao presuda.",
    ].join(" "),
  );

  assert.deepEqual(result, { ok: true, issues: [] });
}

function testForbiddenCompositeHrPhrasesFail() {
  expectIssue("U tekstu stoji rokovi visoki kao glavni rizik.", {
    code: "FORBIDDEN_PHRASE",
    phrase: "rokovi visoki",
    suggestion: "pritisak rokova",
  });
  expectIssue("Ugodnost se ovdje navodi kao domen.", {
    code: "GLOSSARY_VIOLATION",
    phrase: "ugodnost",
    suggestion: "Spremnost na saradnju",
  });
  expectIssue("Saradljivost je glavni signal u timu.", {
    code: "GLOSSARY_VIOLATION",
    phrase: "saradljivost",
    suggestion: "Spremnost na saradnju",
  });
}

function testAgreeablenessLabelStrictness() {
  const result = validateReportLanguageQuality({
    snapshot: {
      integratedSignals: [
        {
          evidence: [
            {
              label: "Saradnja",
            },
          ],
        },
      ],
    },
    locale: "bs",
    audience: "hr",
    reportType: "composite",
    context: "composite_hr_report",
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.issues.some(
      (issue) =>
        issue.code === "GLOSSARY_VIOLATION" &&
        issue.phrase === "Saradnja" &&
        issue.suggestion === "Spremnost na saradnju",
    ),
    true,
  );

  const validResult = validateReportLanguageQuality({
    snapshot: {
      integratedSignals: [
        {
          evidence: [
            {
              label: "Spremnost na saradnju",
            },
          ],
        },
      ],
    },
    locale: "bs",
    audience: "hr",
    reportType: "composite",
    context: "composite_hr_report",
  });

  assert.deepEqual(validResult, { ok: true, issues: [] });
}

function testNarrativeDomainCasingViolationFails() {
  const result = validateCompositeHrText(
    "Ovdje je važna kombinacija više izražene Savjesnosti i Spremnosti na saradnju u svakodnevnom radu.",
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.issues.some(
      (issue) =>
        issue.code === "NARRATIVE_CASING_VIOLATION" &&
        issue.phrase === "Savjesnosti" &&
        issue.suggestion === "savjesnosti",
    ),
    true,
  );
  assert.equal(
    result.issues.some(
      (issue) =>
        issue.code === "NARRATIVE_CASING_VIOLATION" &&
        issue.phrase === "Spremnosti na saradnju" &&
        issue.suggestion === "spremnosti na saradnju",
    ),
    true,
  );
}

function testNarrativeDomainCasingPositivePasses() {
  const result = validateCompositeHrText(
    "Ovdje je važna kombinacija više izražene savjesnosti i spremnosti na saradnju u svakodnevnom radu.",
  );

  assert.deepEqual(result, { ok: true, issues: [] });
}

function testCompositeHrNarrativeCasingIgnoresHeadingsAndEvidenceLabels() {
  const result = validateReportLanguageQuality({
    snapshot: {
      summary: {
        headline: "Spremnost na saradnju",
        profileOverview:
          "Ovdje je važna kombinacija više izražene savjesnosti i spremnosti na saradnju u svakodnevnom radu.",
        keyStrengths: ["Savjesnost se vidi kao naslovna tema samo ako pocinje recenicu."],
        watchouts: ["U intervjuu direktno provjerite kako osoba balansira tempo i saradnju."],
      },
      integratedSignals: [
        {
          title: "Savjesnost i Spremnost na saradnju",
          body: "U radu se ova kombinacija vidi kroz savjesnost i spremnost na saradnju.",
          evidence: [
            {
              label: "Spremnost na saradnju",
              value: "3.00 (Uravnoteženo)",
            },
            {
              label: "Savjesnost",
              value: "4.00 (Više izraženo)",
            },
          ],
        },
      ],
    },
    locale: "bs",
    audience: "hr",
    reportType: "composite",
    context: "composite_hr_report",
  });

  assert.deepEqual(result, { ok: true, issues: [] });
}

function testNarrativeSaradnjaAllowed() {
  const result = validateCompositeHrText(
    "U timskoj saradnji i saradnji sa kolegama vrijedi provjeriti kako osoba gradi povjerenje.",
  );

  assert.deepEqual(result, { ok: true, issues: [] });
}

function testAsciiPerformancePressureAllowed() {
  const asciiResult = validateCompositeHrText(
    "Vrijedi provjeriti kako osoba reaguje na pritisak ucinka u zahtjevnim sedmicama.",
  );
  const diacriticsResult = validateCompositeHrText(
    "Vrijedi provjeriti kako osoba reaguje na pritisak učinka u zahtjevnim sedmicama.",
  );

  assert.deepEqual(asciiResult, { ok: true, issues: [] });
  assert.deepEqual(diacriticsResult, { ok: true, issues: [] });
}

function testForbiddenHiringTermsFail() {
  expectIssue("Ovo izgleda kao fit score za ulogu.", {
    code: "FORBIDDEN_TERM",
    phrase: "fit score",
  });
  expectIssue("Ovo je idealni kandidat za tim.", {
    code: "FORBIDDEN_HIRING_DECISION",
    phrase: "idealni kandidat",
  });
  expectIssue("Treba ga zaposliti odmah.", {
    code: "FORBIDDEN_HIRING_DECISION",
    phrase: "zaposliti",
  });
  expectIssue("Ne zaposliti ovu osobu bez daljeg razgovora.", {
    code: "FORBIDDEN_HIRING_DECISION",
    phrase: "ne zaposliti",
  });
}

function testStructuredSnapshotPathAndAssertWrapper() {
  const snapshot = {
    summary: {
      headline: "HR pregled",
      profileOverview:
        "Spremnost na saradnju ostaje stabilan signal. U intervjuu provjerite konkretan primjer timskog dogovora.",
      keyStrengths: ["Jasna struktura rada."],
      watchouts: ["Tražite primjer reakcije na pritisak rokova."],
    },
  };

  const result = validateReportLanguageQuality({
    snapshot,
    locale: "bs",
    audience: "hr",
    reportType: "composite",
    context: "composite_hr_report",
  });

  assert.deepEqual(result, { ok: true, issues: [] });

  assert.throws(
    () =>
      assertReportLanguageQuality({
        text: "Ovo je structured output debug poruka sa fit score odlukom.",
        locale: "bs",
        audience: "hr",
        reportType: "composite",
        context: "composite_hr_report",
      }),
    /FORBIDDEN_DEBUG_LANGUAGE|FORBIDDEN_TERM/i,
  );
}

function testCompositeHrQaIgnoresInternalLegacySourceLabels() {
  const result = validateReportLanguageQuality({
    snapshot: {
      summary: {
        headline: "HR pregled",
        profileOverview:
          "Spremnost na saradnju ostaje stabilan signal. U intervjuu provjerite konkretan primjer timskog dogovora.",
        keyStrengths: ["Jasna struktura rada."],
        watchouts: ["Tražite primjer reakcije na pritisak rokova."],
      },
      integratedSignals: [
        {
          evidence: [
            {
              label: "Spremnost na saradnju",
              value: "3.00 (Uravnoteženo)",
            },
          ],
        },
      ],
      sourceSnapshot: {
        deterministicInputs: {
          ipip: {
            domains: [
              {
                label: "Ugodnost",
              },
            ],
          },
        },
      },
    },
    locale: "bs",
    audience: "hr",
    reportType: "composite",
    context: "composite_hr_report",
  });

  assert.deepEqual(result, { ok: true, issues: [] });
}

function testCompositeHrSummaryWritingQualityGuardrails() {
  const passiveResult = validateReportLanguageQuality({
    snapshot: {
      summary: {
        headline: "Pouzdan radni profil",
        profileOverview:
          "Najvazniji radni signal je stabilan tempo rada. U intervjuu provjerite kako osoba postavlja prioritete.",
        keyStrengths: ["Jasna struktura rada."],
        watchouts: ["Područje za dodatnu provjeru je reakcija na promjene prioriteta."],
      },
    },
    locale: "bs",
    audience: "hr",
    reportType: "composite",
    context: "composite_hr_report",
  });

  assert.equal(passiveResult.ok, false);
  assert.equal(
    passiveResult.issues.some(
      (issue) =>
        issue.code === "FORBIDDEN_PHRASE" &&
        issue.phrase === "Područje za dodatnu provjeru je",
    ),
    true,
  );

  const longHeadlineResult = validateReportLanguageQuality({
    snapshot: {
      summary: {
        headline:
          "Pouzdan radni profil sa slozenim motivacijskim, kognitivnim i interpersonalnim signalima za viseslojnu HR interpretaciju",
        profileOverview:
          "Najvazniji radni signal je stabilan tempo rada. U intervjuu provjerite kako osoba postavlja prioritete.",
        keyStrengths: ["Jasna struktura rada."],
        watchouts: ["Tražite primjer reakcije na promjene prioriteta."],
      },
    },
    locale: "bs",
    audience: "hr",
    reportType: "composite",
    context: "composite_hr_report",
  });

  assert.equal(longHeadlineResult.ok, false);
  assert.equal(
    longHeadlineResult.issues.some(
      (issue) =>
        issue.code === "SUMMARY_WRITING_QUALITY" &&
        issue.phrase === "summary.headline too long",
    ),
    true,
  );

  const missingActionResult = validateReportLanguageQuality({
    snapshot: {
      summary: {
        headline: "Pouzdan radni profil",
        profileOverview: "Najvazniji radni signal je stabilan tempo rada.",
        keyStrengths: ["Jasna struktura rada."],
        watchouts: ["Nalaz treba povezati sa zahtjevima uloge."],
      },
    },
    locale: "bs",
    audience: "hr",
    reportType: "composite",
    context: "composite_hr_report",
  });

  assert.equal(missingActionResult.ok, false);
  assert.equal(
    missingActionResult.issues.some(
      (issue) =>
        issue.code === "SUMMARY_WRITING_QUALITY" &&
        issue.phrase === "summary missing HR action",
    ),
    true,
  );
}

function main() {
  testValidTextPasses();
  testForbiddenCompositeHrPhrasesFail();
  testAgreeablenessLabelStrictness();
  testNarrativeDomainCasingViolationFails();
  testNarrativeDomainCasingPositivePasses();
  testCompositeHrNarrativeCasingIgnoresHeadingsAndEvidenceLabels();
  testNarrativeSaradnjaAllowed();
  testAsciiPerformancePressureAllowed();
  testForbiddenHiringTermsFail();
  testStructuredSnapshotPathAndAssertWrapper();
  testCompositeHrQaIgnoresInternalLegacySourceLabels();
  testCompositeHrSummaryWritingQualityGuardrails();

  console.log("Report language quality tests passed.");
}

main();
