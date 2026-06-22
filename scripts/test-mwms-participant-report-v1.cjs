const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
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
  formatParticipantReportSafetyFinding,
  validateParticipantReportSafety,
} = require("../lib/assessment/participant-report-safety.ts");
const {
  validateMwmsParticipantReportV1,
} = require("../lib/assessment/mwms-participant-report-v1.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildValidReport() {
  return {
    schema_version: "mwms_participant_report_v1",
    test_slug: "mwms_v1",
    audience: "participant",
    title: "Radna motivacija",
    summary: {
      headline:
        "Autonomni i kontrolisani izvori motivacije zajedno oblikuju radni angažman.",
      paragraph:
        "Profil pokazuje da energija za rad dolazi iz kombinacije ličnog smisla, očekivanja i jasnog konteksta zadatka.",
    },
    motivation_pattern: {
      autonomous:
        "Autonomni izvori su vidljivi kroz zadatke koje osoba povezuje sa vrijednošću, interesom i osjećajem odgovornosti.",
      controlled:
        "Kontrolisani izvori se mogu pojaviti kada su očekivanja, priznanje ili posljedice posebno naglašeni u radu.",
      amotivation:
        "Amotivacija se čita kao signal za provjeru uslova u kojima osoba gubi jasnoću, energiju ili osjećaj svrhe.",
    },
    key_observations: [
      "Vrijedi istražiti koji zadaci najviše povezuju trud sa ličnim smislom i korisnim ishodom.",
      "Motivacijski obrazac treba povezati sa konkretnom ulogom, tempom rada i vrstom feedbacka.",
    ],
    possible_tensions: [
      "Napetost se može javiti kada vanjska očekivanja postanu jača od osjećaja autonomije i svrhe.",
      "Niži osjećaj smisla može smanjiti stabilnost angažmana ako zadaci dugo ostaju nejasni.",
    ],
    reflection_questions: [
      "Koji zadaci ti najčešće daju osjećaj smisla, interesa ili lične vrijednosti?",
      "U kojim situacijama pritisak očekivanja počinje smanjivati energiju za rad?",
    ],
    development_suggestions: [
      "Poveži jedan važan zadatak sa konkretnim ishodom koji osobi ima smisla i može se pratiti kroz sedmicu.",
      "Dogovori način feedbacka koji povećava jasnoću, autonomiju i osjećaj odgovornosti u radu.",
    ],
    interpretation_note:
      "Ovaj izvještaj nije samostalna osnova za odluku o zapošljavanju i treba ga čitati uz razgovor, ulogu i druge rezultate procjene.",
  };
}

function expectInvalid(report, expectedPattern) {
  const result = validateMwmsParticipantReportV1(report);

  assert.equal(result.ok, false, "Expected MWMS participant report to fail validation.");
  assert.match(result.errors.join(" | "), expectedPattern);
}

const validReport = buildValidReport();
const validResult = validateMwmsParticipantReportV1(validReport);
assert.equal(validResult.ok, true, validResult.ok ? undefined : validResult.errors.join(" | "));

const whitespaceHeadline = clone(validReport);
whitespaceHeadline.summary.headline = "   ";
expectInvalid(whitespaceHeadline, /summary\.headline/);

for (const placeholder of ["N/A", "TBD", "Lorem ipsum", "test"]) {
  const report = clone(validReport);
  report.motivation_pattern.autonomous = placeholder;
  expectInvalid(report, /motivation_pattern\.autonomous/);
}

const genericSummary = clone(validReport);
genericSummary.summary.paragraph = "Ovaj izvještaj prikazuje rezultate.";
expectInvalid(genericSummary, /summary\.paragraph.*generic MWMS filler/i);
const genericDataOnlyResult = validateMwmsParticipantReportV1(genericSummary, {
  enforceProseGuardrails: false,
});
assert.equal(
  genericDataOnlyResult.ok,
  true,
  genericDataOnlyResult.ok ? undefined : genericDataOnlyResult.errors.join(" | "),
);

const duplicateObservations = clone(validReport);
duplicateObservations.key_observations = [
  "Motivacijski obrazac treba povezati sa konkretnom ulogom i vrstom feedbacka.",
  "Motivacijski obrazac treba povezati sa konkretnom ulogom i vrstom feedbacka.",
];
expectInvalid(duplicateObservations, /key_observations\[1\].*Duplicate narrative text/i);

const duplicateSummaryAndNote = clone(validReport);
duplicateSummaryAndNote.interpretation_note = duplicateSummaryAndNote.summary.paragraph;
expectInvalid(duplicateSummaryAndNote, /interpretation_note.*summary\.paragraph/i);

const duplicateSuggestions = clone(validReport);
duplicateSuggestions.development_suggestions = [
  "Dogovori način feedbacka koji povećava jasnoću, autonomiju i osjećaj odgovornosti u radu.",
  "Dogovori način feedbacka koji povećava jasnoću, autonomiju i osjećaj odgovornosti u radu.",
];
expectInvalid(duplicateSuggestions, /development_suggestions\[1\].*Duplicate narrative text/i);

const unsafeClaim = clone(validReport);
unsafeClaim.summary.paragraph =
  "Ovaj rezultat sigurno pokazuje da osoba uvijek ostaje motivisana bez obzira na kontekst.";
expectInvalid(unsafeClaim, /unsafe or overclaiming/i);

const degradingClaim = clone(validReport);
degradingClaim.summary.paragraph =
  "Ovaj rezultat pokazuje da si bezvrijedna i nepopravljivo nesposobna osoba.";
const degradingDataOnlyResult = validateMwmsParticipantReportV1(degradingClaim, {
  enforceProseGuardrails: false,
});
assert.equal(degradingDataOnlyResult.ok, false);
assert.match(degradingDataOnlyResult.errors.join(" | "), /harmful|degrading/i);
const degradingQaDataOnlyResult = validateMwmsParticipantReportV1(degradingClaim, {
  enforceProseGuardrails: false,
  enforceSafetyGuardrails: false,
});
assert.equal(
  degradingQaDataOnlyResult.ok,
  true,
  degradingQaDataOnlyResult.ok
    ? undefined
    : degradingQaDataOnlyResult.errors.join(" | "),
);

const diagnosisQaDataOnlyReport = clone(validReport);
diagnosisQaDataOnlyReport.interpretation_note =
  "Ovaj rezultat predstavlja kliničku dijagnozu.";
const diagnosisQaDataOnlyResult = validateMwmsParticipantReportV1(
  diagnosisQaDataOnlyReport,
  {
    enforceProseGuardrails: false,
    enforceSafetyGuardrails: false,
  },
);
assert.equal(
  diagnosisQaDataOnlyResult.ok,
  true,
  diagnosisQaDataOnlyResult.ok
    ? undefined
    : diagnosisQaDataOnlyResult.errors.join(" | "),
);

const malformedQaDataOnlyReport = clone(degradingClaim);
delete malformedQaDataOnlyReport.summary;
const malformedQaDataOnlyResult = validateMwmsParticipantReportV1(
  malformedQaDataOnlyReport,
  {
    enforceProseGuardrails: false,
    enforceSafetyGuardrails: false,
  },
);
assert.equal(malformedQaDataOnlyResult.ok, false);
assert.match(malformedQaDataOnlyResult.errors.join(" | "), /summary: Expected object/i);

const statementReflection = clone(validReport);
statementReflection.reflection_questions = [
  "Osoba treba razmisliti o tome šta joj daje smisao u radu.",
];
expectInvalid(statementReflection, /reflection_questions\[0\].*question-shaped/i);

const validDistinctArrays = clone(validReport);
validDistinctArrays.key_observations = [
  "Autonomni izvori se lakše vide kada osoba poveže zadatak sa jasnim razlogom za trud.",
  "Kontrolisani izvori se lakše vide kada su očekivanja i posljedice posebno prisutni.",
  "Amotivacijski signal treba čitati kroz konkretne primjere energije, jasnoće i konteksta.",
];
validDistinctArrays.possible_tensions = [
  "Previše vanjskog pritiska može smanjiti osjećaj izbora ako svrha zadatka nije jasna.",
  "Dugi period bez feedbacka može otežati održavanje energije i osjećaja napretka.",
];
validDistinctArrays.development_suggestions = [
  "Izaberi jedan zadatak i napiši zbog čega je važan za korisnika, tim ili lični razvoj.",
  "Postavi kratak ritam provjere koji povezuje napredak, odgovornost i osjećaj autonomije.",
];
validDistinctArrays.reflection_questions = [
  "Šta ti najviše pomaže da zadatak doživiš kao smislen i vrijedan truda?",
  "Kako prepoznaješ trenutak kada očekivanja počnu djelovati kao pritisak?",
];
const distinctArraysResult = validateMwmsParticipantReportV1(validDistinctArrays);
assert.equal(
  distinctArraysResult.ok,
  true,
  distinctArraysResult.ok ? undefined : distinctArraysResult.errors.join(" | "),
);

const motivationVocabularyReport = clone(validReport);
motivationVocabularyReport.summary.paragraph =
  "Motivacijski obrazac pokazuje kako se motivacija i introjektirana motivacija mogu mijenjati kroz kontekst zadatka.";
motivationVocabularyReport.motivation_pattern.amotivation =
  "Amotivacija i epizode amotivacije ovdje se čitaju kao signal za provjeru jasnoće, svrhe i uslova rada.";
motivationVocabularyReport.interpretation_note =
  "Ovaj izvještaj opisuje motivacijski obrazac i amotivaciju u radnom kontekstu, bez konačnih zaključaka o osobi.";
const motivationVocabularyResult = validateMwmsParticipantReportV1(motivationVocabularyReport, {
  enforceProseGuardrails: false,
});
assert.equal(
  motivationVocabularyResult.ok,
  true,
  motivationVocabularyResult.ok ? undefined : motivationVocabularyResult.errors.join(" | "),
);

const diagnosisSafetyReport = clone(validReport);
diagnosisSafetyReport.interpretation_note =
  "Ovaj rezultat pokazuje kliničku anksioznost i predstavlja medicinsku dijagnozu.";
const diagnosisSafetyResult = validateMwmsParticipantReportV1(diagnosisSafetyReport, {
  enforceProseGuardrails: false,
});
assert.equal(diagnosisSafetyResult.ok, false);
assert.match(diagnosisSafetyResult.errors.join(" | "), /interpretation_note/i);
assert.match(diagnosisSafetyResult.errors.join(" | "), /diagnosis, clinical claim, or medical claim/i);
assert.match(
  diagnosisSafetyResult.errors.join(" | "),
  /rule=(diagnosis_term|clinical_term|medical_term)/i,
);

const directSafetyFindings = validateParticipantReportSafety({
  interpretation_note:
    "Ovaj rezultat pokazuje kliničku anksioznost i predstavlja medicinsku dijagnozu.",
});
assert.equal(directSafetyFindings.length >= 1, true);
assert.equal(directSafetyFindings[0].path, "interpretation_note");
assert.equal(typeof directSafetyFindings[0].ruleId, "string");
assert.equal(typeof directSafetyFindings[0].matchedTerm, "string");
assert.match(formatParticipantReportSafetyFinding(directSafetyFindings[0]), /rule=/i);
assert.match(formatParticipantReportSafetyFinding(directSafetyFindings[0]), /match=/i);

const safeMotivationFindings = validateParticipantReportSafety({
  interpretation_note:
    "Ovaj motivacijski obrazac uključuje amotivaciju, amotivacije i introjektiranu motivaciju kao radne konstrukte.",
});
assert.deepEqual(safeMotivationFindings, []);

console.log("MWMS participant report V1 validator tests passed.");
