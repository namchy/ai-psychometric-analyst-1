const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "scripts", "inspect-mwms-hr-openai-dry-run.cjs");
const scriptSource = fs.readFileSync(scriptPath, "utf8");

assert.match(scriptSource, /CONFIRM_MWMS_HR_OPENAI_DRY_RUN/);
assert.match(scriptSource, /MWMS_HR_INPUT_CAPTURE_PATH/);
assert.match(scriptSource, /databaseWrites:\s*false/);
assert.match(scriptSource, /reportRegenerated:\s*false/);
assert.match(scriptSource, /productionFlowChanged:\s*false/);
assert.match(scriptSource, /artifactWritten:\s*false/);
assert.match(scriptSource, /mode:\s*0o600/);
assert.doesNotMatch(scriptSource, /createSupabaseAdminClient/);
assert.doesNotMatch(scriptSource, /\.(?:insert|update|upsert|delete)\(/);
assert.doesNotMatch(scriptSource, /processAssessmentReport/);
assert.doesNotMatch(scriptSource, /regenerateReadySingleTestHrReport/);

const {
  CAPTURE_PATH_ENV,
  CONFIRM_ENV,
  evaluateMwmsHrDryRunDiagnostic,
  installTypeScriptRuntime,
  readInputCapture,
  runMwmsHrOpenAiDryRun,
} = require(scriptPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildMwmsResults() {
  return {
    attemptId: "attempt-mwms-hr-inspector-parity",
    scoringMethod: "likert_sum",
    dimensions: [
      { dimension: "amotivation", rawScore: 4, scoredQuestionCount: 3 },
      { dimension: "external_social", rawScore: 4, scoredQuestionCount: 3 },
      { dimension: "external_material", rawScore: 5, scoredQuestionCount: 3 },
      { dimension: "introjected", rawScore: 3.75, scoredQuestionCount: 4 },
      { dimension: "identified", rawScore: 4.67, scoredQuestionCount: 3 },
      { dimension: "intrinsic", rawScore: 5, scoredQuestionCount: 3 },
    ],
    scoredResponseCount: 19,
    unscoredResponses: [],
  };
}

function buildProductionPreparedMwmsHrInput() {
  const {
    buildPreparedReportGenerationInput,
  } = require("../lib/assessment/report-provider-helpers.ts");

  return buildPreparedReportGenerationInput(
    {
      attemptId: "attempt-mwms-hr-inspector-parity",
      testId: "test-mwms",
      testSlug: "mwms_v1",
      audience: "hr",
      locale: "bs",
      scoringMethod: "likert_sum",
      promptVersion: "v1",
      testName: "Procjena radne motivacije",
      results: buildMwmsResults(),
    },
    {
      promptVersionId: null,
      promptTemplate: null,
    },
  );
}

function buildMwmsInputCaptureArtifact({ preparedInput, payload, timestamp = "2026-06-14T11:46:45.140Z" }) {
  return {
    metadata: {
      timestamp,
      reportFamily: "mwms",
      testSlug: "mwms_v1",
      reportType: "individual",
      audience: "hr",
      sourceType: "single_test",
      locale: "bs",
      attemptId: preparedInput.attemptId,
      reportId: "report-mwms-hr-input-capture",
      provider: "openai",
      model: payload.requestBody.model,
      confirmed: true,
      databaseWrites: false,
      openAiCalled: false,
      reportRegenerated: false,
      productionFlowChanged: false,
      diagnosticInputSource:
        "production buildCompletedAssessmentReportRequest + buildPreparedReportGenerationInput",
      reconstructedInputUsed: false,
    },
    inputSummary: {
      attemptId: preparedInput.attemptId,
      reportId: "report-mwms-hr-input-capture",
      testId: "test-mwms",
      testSlug: "mwms_v1",
    },
    promptInput: preparedInput.promptInput,
    reportContract: preparedInput.reportContract,
    preparedOpenAiRequest: {
      schemaName: payload.schemaName,
      schema: payload.schema,
      systemPrompt: payload.systemPrompt,
      userPrompt: payload.userPrompt,
      requestBody: payload.requestBody,
    },
  };
}

function buildValidMwmsHrReport(input) {
  return {
    contractVersion: "mwms_hr_report_v1",
    reportType: "mwms_hr_report_v1",
    testSlug: "mwms_v1",
    audience: "hr",
    sourceType: "single_test",
    locale: input.locale,
    meta: {
      language: input.locale,
      generatedAt: "2026-06-14T11:46:45.140Z",
    },
    motivation_profile_snapshot: {
      scale: {
        min: 1,
        max: 7,
      },
      dimensions: input.dimensions.map(({ code, label, rawScore, band, bandLabel }) => ({
        code,
        label,
        rawScore,
        band,
        bandLabel,
      })),
      derivedProfile: input.derivedProfile,
    },
    key_motivational_drivers: [
      {
        title: "Vrijednost posla kao oslonac angazmana",
        evidence: "Identificirana i intrinzicna motivacija spadaju medju izrazenije signale u profilu.",
        hrImplication: "Korisno je provjeriti koje vrste zadataka kandidat povezuje sa smislom i dugorocnom vrijednoscu.",
      },
      {
        title: "Vanjski ishodi imaju vidljivu prakticnu ulogu",
        evidence: "Materijalni i socijalni izvori motivacije imaju mjerljiv udio u obrascu angazmana.",
        hrImplication: "Jasna pravila, standardi i prepoznatljivi ishodi mogu biti vazni za odrzavanje ritma.",
      },
      {
        title: "Profil trazI citanje kroz konkretan kontekst rada",
        evidence: "Autonomni i kontrolisani izvori nisu potpuno odvojeni nego djeluju kao kombinovan obrazac.",
        hrImplication: "Intervju treba razjasniti uslove pod kojima energija raste, a pod kojima slabi.",
      },
    ],
    potential_friction_points: [
      {
        signal: "Angazman moze oscilirati kada svrha zadataka nije jasna.",
        whyItMayMatter: "Ako osoba ne vidi razlog ili korisnost rada, ulaganje truda moze postati manje stabilno.",
        howToCheck: "Pitati za konkretne situacije u kojima je smisao zadatka bio nejasan i kako je osoba reagovala.",
      },
      {
        signal: "Vanjski kriteriji mogu imati jaci uticaj u periodima neizvjesnosti.",
        whyItMayMatter: "Promjene prioriteta, nagrada ili standarda mogu uticati na to kako osoba rasporedjuje energiju.",
        howToCheck: "Provjeriti kako kandidat odrzava fokus kada se promijene priznanje, ciljevi ili rokovi.",
      },
      {
        signal: "Amotivacijski signal trazi oprezno kontekstualno citanje.",
        whyItMayMatter: "Ovaj signal je korisnije citati kao pitanje uslova rada nego kao trajnu osobinu.",
        howToCheck: "Pitati sta kandidatu najcesce smanjuje osjecaj jasnog razloga za ulaganje truda.",
      },
    ],
    work_context_hypotheses: [
      {
        context: "Uloge sa jasnim razlogom i vidljivim doprinosom",
        hypothesis: "Profil moze biti stabilniji kada osoba vidi zasto je posao vazan i kome koristi.",
        verification: "Provjeriti kroz primjere zadataka koje je kandidat dozivio kao smislen dio sirih ciljeva.",
      },
      {
        context: "Okruzenja sa promjenjivim prioritetima",
        hypothesis: "Motivacijski obrazac moze traziti cesce uskladjivanje ocekivanja i kriterija uspjeha.",
        verification: "Pitati kako kandidat odrzava angazman kada se mijenjaju ciljevi, redoslijed ili mjerila uspjeha.",
      },
      {
        context: "Timovi sa ogranicenim feedbackom",
        hypothesis: "Socijalni i vanjski izvori motivacije mogu traziti predvidiviji ritam povratne informacije.",
        verification: "Provjeriti kakva vrsta feedbacka kandidatu najvise pomaze da ostane usmjeren na prioritetni rad.",
      },
    ],
    manager_support_guidance: [
      {
        focus: "Jasna svrha rada",
        recommendation: "Povezati zadatke sa konkretnim poslovnim ciljem, korisnikom ili vrijednoscu za tim.",
        rationale: "Autonomni izvori motivacije imaju vise oslonca kada je vrijednost rada eksplicitna.",
      },
      {
        focus: "Autonomija unutar okvira",
        recommendation: "Dati jasne kriterije i rokove, ali ostaviti prostor za izbor nacina izvedbe gdje je to moguce.",
        rationale: "Osjecaj izbora moze pomoci da se odrzi interes i odgovornost prema zadatku.",
      },
      {
        focus: "Transparentni standardi i nagrade",
        recommendation: "Jasno komunicirati sta se ocekuje, kako se mjeri uspjeh i sta slijedi kada se prioriteti promijene.",
        rationale: "Kontrolisani izvori motivacije su stabilniji kada su pravila i posljedice predvidivi.",
      },
      {
        focus: "Rani razgovor o energiji i preprekama",
        recommendation: "Tokom onboardinga provjeriti sta osobi daje energiju, a sta joj oduzima smisao ili fokus.",
        rationale: "Amotivacijski signal je korisnije citati kao hipotezu o kontekstu nego kao presudu.",
      },
    ],
    interview_questions: [
      {
        question: "Koji tip zadataka vam najbrze postane smislen i zasto?",
        evaluates: "Vezu izmedju licne vrijednosti rada i odrzivog angazmana.",
        whatToListenFor: "Konkretne primjere svrhe, odgovornosti i ishoda koji osobi daju energiju.",
      },
      {
        question: "Sta vam pomaze da odrzite trud kada zadatak nije posebno zanimljiv?",
        evaluates: "Odnos autonomnih i kontrolisanih izvora motivacije.",
        whatToListenFor: "Strategije kojima osoba povezuje obavezu sa ciljem, standardom ili korisnim ishodom.",
      },
      {
        question: "Kako reagujete kada se promijeni nacin priznanja ili nagradjivanja rada?",
        evaluates: "Ulogu vanjskih i socijalnih motivatora.",
        whatToListenFor: "Realistican opis uticaja sigurnosti, priznanja i jasnih kriterija na radni ritam.",
      },
      {
        question: "Sta vam u novoj ulozi najvise pomaze da uhvatite ritam rada?",
        evaluates: "Onboarding potrebe i uslove za rani angazman.",
        whatToListenFor: "Potrebu za jasnocom, feedbackom, autonomijom ili strukturisanim prioritetima.",
      },
      {
        question: "U kojim situacijama vam najvise opadne osjecaj razloga za ulaganje truda?",
        evaluates: "Moguce izvore motivacijske frikcije.",
        whatToListenFor: "Kontekstualne okidace i obrasce, a ne fiksne zakljucke o osobi.",
      },
    ],
    onboarding_recommendations: [
      {
        phase: "Prvih 30 dana",
        recommendation: "Razjasniti svrhu uloge, prioritete i kratkorocne kriterije uspjeha.",
        why: "Profil moze imati stabilniji oslonac kada su vrijednost rada i ocekivanja vidljivi od pocetka.",
      },
      {
        phase: "Prvih 30 dana",
        recommendation: "Uvesti kraci, redovan feedback o napretku i standardima rada.",
        why: "Socijalni i vanjski signali mogu imati prakticnu ulogu u ranom usmjeravanju angazmana.",
      },
      {
        phase: "60 dana",
        recommendation: "Provjeriti koji zadaci imaju najvise smisla, a koji najbrze trose energiju.",
        why: "Motivacijske frikcije se preciznije citaju kroz konkretan radni kontekst nego kroz opste izjave.",
      },
      {
        phase: "90 dana",
        recommendation: "Uskladiti nivo autonomije, jasnih ciljeva i priznanja sa realnim zahtjevima uloge.",
        why: "Kombinovani profil trazi balans izmedju smisla, strukture i vidljivih ishoda.",
      },
    ],
    decision_support_note: [
      "Ovaj izvjestaj treba citati kao opreznu HR hipotezu, ne kao zakljucak o kandidatu.",
      "Nalaze je korisno povezati sa intervjuom, iskustvom, referencama i zahtjevima konkretne uloge.",
    ],
    interpretation_note:
      "MWMS HR izvjestaj koristi vec izracunate rezultate kao motivacijski profil i treba ga citati kao hipotezu za provjeru kroz radni kontekst.",
    safety_checks: {
      noScoreRecalculation: true,
      noScoreMutation: true,
      noHireNoHireDecision: true,
      noDiagnosticLanguage: true,
      hypothesesOnly: true,
      singleTestOnly: true,
    },
  };
}

async function main() {
  let reads = 0;
  let writes = 0;
  let openAiCalls = 0;
  const noCallResult = await runMwmsHrOpenAiDryRun({
    env: {},
    readFile: () => {
      reads += 1;
      return "{}";
    },
    writeFile: () => {
      writes += 1;
    },
    requestRawReport: async () => {
      openAiCalls += 1;
      return {};
    },
  });

  assert.equal(noCallResult.confirmed, false);
  assert.equal(noCallResult.openAiCalled, false);
  assert.equal(noCallResult.databaseAccessed, false);
  assert.equal(noCallResult.databaseWrites, false);
  assert.equal(noCallResult.artifactWritten, false);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
  assert.equal(openAiCalls, 0);

  await assert.rejects(
    () =>
      runMwmsHrOpenAiDryRun({
        env: {
          NODE_ENV: "development",
          [CONFIRM_ENV]: "true",
          OPENAI_API_KEY: "test-key",
        },
        argv: [],
        requestRawReport: async () => {
          throw new Error("should not call without capture path");
        },
      }),
    new RegExp(CAPTURE_PATH_ENV),
  );

  installTypeScriptRuntime();
  const {
    buildOpenAiStructuredRequestPayload,
  } = require("../lib/assessment/report-provider-openai.ts");
  const {
    mwmsHrReportV1OpenAiSchema,
    validateMwmsHrReportV1,
  } = require("../lib/assessment/mwms-hr-report-v1.ts");
  const {
    resolveAiReportLanguagePolicy,
  } = require("../lib/assessment/ai-report-language-policy.ts");

  const productionPreparedInput = buildProductionPreparedMwmsHrInput();
  const productionPayload = buildOpenAiStructuredRequestPayload(productionPreparedInput, {
    apiKey: "test-key",
    model: "gpt-5.5",
    timeoutMs: 120000,
  });
  const validReport = buildValidMwmsHrReport(productionPreparedInput.promptInput);
  const directValidation = validateMwmsHrReportV1(validReport, {
    expectedInput: productionPreparedInput.promptInput,
  });

  assert.equal(directValidation.ok, true, directValidation.ok ? undefined : directValidation.errors.join(" | "));

  const captureArtifact = buildMwmsInputCaptureArtifact({
    preparedInput: productionPreparedInput,
    payload: productionPayload,
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(captureArtifact.preparedOpenAiRequest.requestBody, "temperature"),
    false,
  );

  const validCapture = readInputCapture("/tmp/single-test-hr-ai-input-mwms-test.json", () =>
    JSON.stringify(captureArtifact),
  );
  assert.equal(validCapture.inputSource, "single_test_hr_ai_input_capture");
  assert.equal(validCapture.capturePath, "/tmp/single-test-hr-ai-input-mwms-test.json");
  assert.equal(validCapture.captureMetadata.reconstructedInputUsed, false);
  assert.match(
    validCapture.captureMetadata.diagnosticInputSource,
    /buildCompletedAssessmentReportRequest.*buildPreparedReportGenerationInput/,
  );
  assert.deepEqual(validCapture.inputSnapshot, productionPreparedInput.promptInput);
  assert.deepEqual(
    validCapture.preparedOpenAiRequest.requestBody,
    captureArtifact.preparedOpenAiRequest.requestBody,
  );
  assert.deepEqual(validCapture.preparedOpenAiRequest.schema, mwmsHrReportV1OpenAiSchema);

  for (const [field, value] of [
    ["reportFamily", "safran"],
    ["testSlug", "safran_v1"],
    ["audience", "participant"],
    ["sourceType", "composite"],
  ]) {
    const invalidCapture = clone(captureArtifact);
    invalidCapture.metadata[field] = value;

    assert.throws(
      () => readInputCapture("/tmp/invalid-mwms-capture.json", () => JSON.stringify(invalidCapture)),
      new RegExp(`metadata\\.${field}`),
    );
  }

  const reconstructedCapture = clone(captureArtifact);
  reconstructedCapture.metadata.reconstructedInputUsed = true;
  assert.throws(
    () => readInputCapture("/tmp/reconstructed-mwms-capture.json", () => JSON.stringify(reconstructedCapture)),
    /MWMS input capture must not use reconstructed input\..*not acceptable audit evidence/i,
  );

  const invalidDiagnosticSourceCapture = clone(captureArtifact);
  invalidDiagnosticSourceCapture.metadata.diagnosticInputSource = "reconstructed fixture";
  assert.throws(
    () => readInputCapture("/tmp/invalid-diagnostic-source-mwms-capture.json", () => JSON.stringify(invalidDiagnosticSourceCapture)),
    /diagnosticInputSource must reference production-equivalent .*not acceptable audit evidence/i,
  );

  const dependencies = {
    resolveAiReportLanguagePolicy,
    validateMwmsHrReportV1,
  };
  const writesList = [];
  const chmodCalls = [];
  const artifact = await runMwmsHrOpenAiDryRun({
    env: {
      NODE_ENV: "development",
      [CONFIRM_ENV]: "true",
      [CAPTURE_PATH_ENV]: "/tmp/single-test-hr-ai-input-mwms-test.json",
      AI_REPORT_PROVIDER: "openai",
      OPENAI_API_KEY: "test-key",
    },
    now: () => "2026-06-14T11:46:45.140Z",
    readFile: (filePath) => {
      assert.equal(filePath, "/tmp/single-test-hr-ai-input-mwms-test.json");
      return JSON.stringify(captureArtifact);
    },
    writeFile: (filePath, data, options) => {
      writesList.push({ filePath, data, options });
    },
    chmodFile: (filePath, mode) => {
      chmodCalls.push({ filePath, mode });
    },
    requestRawReport: async (input, options) => {
      openAiCalls += 1;
      assert.deepEqual(input, productionPreparedInput.promptInput);
      assert.equal(options.model, "gpt-5.5");
      return validReport;
    },
    evaluateDiagnostic: (input, output) =>
      evaluateMwmsHrDryRunDiagnostic(input, output, dependencies),
  });

  assert.equal(openAiCalls, 1);
  assert.equal(artifact.metadata.confirmed, true);
  assert.equal(artifact.metadata.openAiCalled, true);
  assert.equal(artifact.metadata.databaseWrites, false);
  assert.equal(artifact.metadata.reportRegenerated, false);
  assert.equal(artifact.metadata.productionFlowChanged, false);
  assert.equal(artifact.metadata.inputSource, "single_test_hr_ai_input_capture");
  assert.equal(artifact.inputSource, "single_test_hr_ai_input_capture");
  assert.equal(artifact.capturePath, "/tmp/single-test-hr-ai-input-mwms-test.json");
  assert.equal(artifact.inputSummary.testSlug, "mwms_v1");
  assert.equal(artifact.inputSummary.locale, "bs");
  assert.deepEqual(artifact.parseResult, { ok: true, error: null });
  assert.equal(artifact.contractValidationResult.ok, true);
  assert.equal(artifact.bhsLanguagePolicyResult.ok, true);
  assert.equal(artifact.mwmsValidatorResult.ok, true);
  assert.equal(artifact.hardGateWouldPersist, true);
  assert.equal(artifact.validatorOnWouldPersist, true);
  assert.deepEqual(artifact.phraseGateFailures, []);
  assert.deepEqual(artifact.phraseGateWarnings, []);
  assert.deepEqual(artifact.failureReasons, []);
  assert.match(artifact.dumpPath, /^\/tmp\/mwms-hr-openai-dry-run-/);
  assert.equal(writesList.length, 1);
  assert.equal(writesList[0].filePath, artifact.dumpPath);
  assert.equal(writesList[0].options.mode, 0o600);
  assert.match(writesList[0].data, /"rawParsedOutput"/);
  assert.match(writesList[0].data, /"bhsLanguagePolicyResult"/);
  assert.match(writesList[0].data, /"mwmsValidatorResult"/);
  assert.match(writesList[0].data, /"hardGateWouldPersist": true/);
  assert.match(writesList[0].data, /"validatorOnWouldPersist": true/);
  assert.doesNotMatch(writesList[0].data, /test-key/);
  assert.deepEqual(chmodCalls, [
    {
      filePath: artifact.dumpPath,
      mode: 0o600,
    },
  ]);

  const bhsFailureReport = clone(validReport);
  bhsFailureReport.interpretation_note = "Ti ovu sliku mozes citati kao licnu poruku o sebi.";
  const bhsDiagnostic = evaluateMwmsHrDryRunDiagnostic(
    productionPreparedInput.promptInput,
    bhsFailureReport,
    dependencies,
  );

  assert.equal(bhsDiagnostic.bhsLanguagePolicyResult.ok, false);
  assert.equal(bhsDiagnostic.mwmsValidatorResult.ok, true);
  assert.equal(bhsDiagnostic.hardGateWouldPersist, false);
  assert.equal(bhsDiagnostic.validatorOnWouldPersist, false);
  assert.equal(bhsDiagnostic.failureReasons.some((reason) => reason.startsWith("bhs_language:")), true);

  const mutationReport = clone(validReport);
  mutationReport.motivation_profile_snapshot.dimensions[0].rawScore = 4.25;
  const mutationDiagnostic = evaluateMwmsHrDryRunDiagnostic(
    productionPreparedInput.promptInput,
    mutationReport,
    dependencies,
  );

  assert.equal(mutationDiagnostic.mwmsValidatorResult.ok, false);
  assert.equal(mutationDiagnostic.hardGateWouldPersist, false);
  assert.equal(mutationDiagnostic.validatorOnWouldPersist, false);
  assert.equal(
    mutationDiagnostic.mwmsValidatorResult.errors.some((error) => error.category === "source_integrity"),
    true,
  );

  console.log("test-inspect-mwms-hr-openai-dry-run: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
