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
  buildPreparedReportGenerationInput,
} = require("../lib/assessment/report-provider-helpers.ts");
const {
  buildSafranHrMandatoryPromptGuardrails,
  buildDefaultUserPrompt,
  buildUserPrompt,
  resolveOpenAiResponseFormatSchemaForInput,
  validateStructuredReport,
} = require("../lib/assessment/report-provider-openai.ts");
const {
  buildMockSafranHrReportV1,
  safranHrReportV1OpenAiSchema,
} = require("../lib/assessment/safran-hr-report-v1.ts");
const {
  buildMockSafranParticipantAiReport,
  safranParticipantAiReportV1OpenAiSchema,
} = require("../lib/assessment/safran-participant-ai-report-v1.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildSafranResults() {
  return {
    attemptId: "attempt-safran-hr-openai-provider",
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
  };
}

function buildPreparedInput(audience) {
  return buildPreparedReportGenerationInput(
    {
      attemptId: `attempt-safran-${audience}-openai-provider`,
      testId: "test-safran",
      testSlug: "safran_v1",
      audience,
      locale: "bs",
      scoringMethod: "correct_answers",
      promptVersion: "v1",
      testName: "SAFRAN",
      results: buildSafranResults(),
    },
    {
      promptVersionId: null,
      promptTemplate: null,
    },
  );
}

function buildPromptTemplateOverride(audience) {
  return {
    id: `prompt-version-${audience}`,
    testId: "test-safran",
    reportType: "individual",
    audience,
    sourceType: "single_test",
    generatorType: "openai",
    promptKey:
      audience === "hr" ? "safran_hr_report_v1" : "safran_participant_ai_report_v1",
    version: "v-db",
    systemPrompt: `DB system prompt for ${audience} {{prompt_version}}`,
    userPromptTemplate:
      audience === "hr"
        ? "DB HR prompt {{prompt_version_id}} {{locale}} {{test_slug}} {{dimension_hint_text}} {{prompt_input_json}}"
        : "DB participant prompt {{prompt_version_id}} {{locale}} {{test_slug}} {{prompt_input_json}}",
    outputSchemaJson: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    updatedBy: null,
  };
}

function main() {
  const hrInput = buildPreparedInput("hr");
  const participantInput = buildPreparedInput("participant");
  const hrPromptInputBefore = clone(hrInput.promptInput);

  const hrSchema = resolveOpenAiResponseFormatSchemaForInput(hrInput);
  const participantSchema = resolveOpenAiResponseFormatSchemaForInput(participantInput);

  assert.deepEqual(hrSchema, safranHrReportV1OpenAiSchema);
  assert.deepEqual(participantSchema, safranParticipantAiReportV1OpenAiSchema);
  assert.notDeepEqual(hrSchema, participantSchema);

  const hrPrompt = JSON.parse(buildDefaultUserPrompt(hrInput));
  assert.equal(hrPrompt.input.test.audience, "hr");
  assert.equal(hrPrompt.input.test.sourceType, "single_test");
  assert.equal(hrPrompt.input.test.slug, "safran_v1");
  assert.equal(hrPrompt.input.scores.overall.rawScore, 26);
  assert.equal(hrPrompt.input.scores.verbal.rawScore, 12);
  assert.match(hrPrompt.instructions.output_contract, /safran_hr_report_v1/);
  assert.match(hrPrompt.instructions.decision_support_rule, /decision-support/i);
  assert.match(hrPrompt.instructions.source_rule, /Do not calculate scores/i);
  assert.match(
    hrPrompt.instructions.interpretation_rule,
    /moze ukazivati|korisno je provjeriti|u ovom setu zadataka/i,
  );
  assert.ok(Array.isArray(hrPrompt.instructions.field_level_rules));
  assert.match(
    hrPrompt.instructions.field_level_rules.join(" "),
    /cautious HR hypothesis|Ovaj rezultat može ukazivati|hipotezu za provjeru/i,
  );
  assert.match(
    hrPrompt.instructions.field_level_rules.join(" "),
    /experience|interview|role context|iskustvom, intervjuom i kontekstom uloge/i,
  );
  assert.match(
    hrPrompt.instructions.structure_rules.join(" "),
    /interpretationLimits.*experience.*interview.*role context|čitati zajedno sa iskustvom, intervjuom i kontekstom uloge/i,
  );
  assert.equal(
    hrPrompt.instructions.hard_guardrails.some((item) => /participant/i.test(item)),
    false,
  );

  const hrInputWithPromptTemplate = {
    ...hrInput,
    promptTemplate: buildPromptTemplateOverride("hr"),
    promptVersionId: "prompt-version-hr",
  };
  const participantInputWithPromptTemplate = {
    ...participantInput,
    promptTemplate: buildPromptTemplateOverride("participant"),
    promptVersionId: "prompt-version-participant",
  };
  const hrFinalPrompt = buildUserPrompt(hrInputWithPromptTemplate);
  const participantFinalPrompt = buildUserPrompt(participantInputWithPromptTemplate);
  const mandatoryGuardrails = buildSafranHrMandatoryPromptGuardrails();

  assert.match(hrFinalPrompt, /DB HR prompt/);
  assert.match(hrFinalPrompt, /prompt-version-hr/);
  assert.match(hrFinalPrompt, /executiveSummary\.summary/);
  assert.match(hrFinalPrompt, /interpretationLimits/);
  assert.match(
    hrFinalPrompt,
    /cautious HR hypothesis|Ovaj rezultat može ukazivati|hipotezu za provjeru|opreznu HR hipotezu/i,
  );
  assert.match(
    hrFinalPrompt,
    /experience|interview|role context|iskustvom, intervjuom i kontekstom uloge/i,
  );
  assert.match(hrFinalPrompt, /SAFRAN HR mandatory guardrails/);
  assert.match(mandatoryGuardrails, /executiveSummary\.summary/);
  assert.match(mandatoryGuardrails, /opreznu HR hipotezu/i);
  assert.match(
    mandatoryGuardrails,
    /Ovaj rezultat treba čitati kao opreznu HR hipotezu|Ovaj sažetak treba koristiti kao hipotezu za provjeru|Ovi signali mogu pomoći HR-u da formira hipoteze koje treba provjeriti/i,
  );
  assert.match(
    mandatoryGuardrails,
    /ovaj signal treba provjeriti|čitati zajedno sa iskustvom, intervjuom i kontekstom uloge/i,
  );
  assert.match(mandatoryGuardrails, /Forbidden phrases are validation blockers/i);
  assert.match(
    mandatoryGuardrails,
    /do not repeat the same opening phrase across all four items|do not repeat the same opening phrase across overall, verbal, figural and numeric/i,
  );
  assert.match(
    mandatoryGuardrails,
    /do not use "To može ukazivati" more than once|do not use "To može ukazivati" as the default start/i,
  );
  assert.match(
    mandatoryGuardrails,
    /score anchor such as 18\/18, 0\/18 or 36\/54|must include three content elements: a score anchor/i,
  );
  assert.match(
    mandatoryGuardrails,
    /pointsOfCaution must be concrete HR hypotheses for checking|not generic methodological notes/i,
  );
  assert.match(
    mandatoryGuardrails,
    /interviewQuestions must be short, natural to say aloud, open-ended|no more than two sentences/i,
  );
  assert.match(
    mandatoryGuardrails,
    /Never output forbidden literal phrases anywhere in the JSON, including negated, quoted or cautionary statements/i,
  );
  assert.match(mandatoryGuardrails, /u okviru ovog seta zadataka/i);
  assert.match(mandatoryGuardrails, /ne koristiti za rangiranje osobe u odnosu na druge/i);
  assert.match(mandatoryGuardrails, /ne čitati kao poređenje sa širom populacijom/i);
  assert.doesNotMatch(participantFinalPrompt, /SAFRAN HR mandatory guardrails/);
  assert.doesNotMatch(participantFinalPrompt, /cautious HR hypothesis|role context/);

  const participantPrompt = JSON.parse(buildDefaultUserPrompt(participantInput));
  assert.equal(participantPrompt.input.test.audience, "participant");
  assert.match(participantPrompt.instructions.output_contract, /safran_participant_ai_report_v1/);
  assert.doesNotMatch(participantPrompt.instructions.output_contract, /safran_hr_report_v1/);

  const validHrReport = buildMockSafranHrReportV1(hrInput.promptInput);
  validHrReport.interpretationLimits = [
    "SAFRAN rezultat treba čitati samo u okviru ovog seta zadataka i čitati zajedno sa iskustvom, intervjuom i kontekstom uloge.",
    "Izvještaj nije odluka o zapošljavanju i ne treba ga koristiti za rangiranje osobe u odnosu na druge.",
    "Nalaz ne treba čitati kao poređenje sa širom populacijom; čitajte kao signal iz ove procjene.",
    "Kognitivni signal je hipoteza za provjeru, ne konačan zaključak.",
  ];
  const validatedHrReport = validateStructuredReport(validHrReport, hrInput);
  assert.equal(validatedHrReport.reportType, "safran_hr_report_v1");
  assert.equal(validatedHrReport.audience, "hr");
  assert.equal(validatedHrReport.sourceType, "single_test");
  assert.equal(validatedHrReport.testSlug, "safran_v1");
  assert.deepEqual(hrInput.promptInput, hrPromptInputBefore);
  assert.equal(
    hrPrompt.instructions.field_level_rules.some((item) =>
      /do not repeat the same opening phrase|To može ukazivati/i.test(item),
    ),
    true,
  );
  assert.equal(
    hrPrompt.instructions.field_level_rules.some((item) =>
      /opreznu HR hipotezu|hipotezu za provjeru|ovaj signal treba provjeriti/i.test(item),
    ),
    true,
  );
  assert.equal(
    hrPrompt.instructions.field_level_rules.some((item) =>
      /score anchor|brief interpretation of the signal|HR implication or check/i.test(item),
    ),
    true,
  );
  assert.equal(
    hrPrompt.instructions.field_level_rules.some((item) =>
      /pointsOfCaution must be concrete HR hypotheses|methodological/i.test(item),
    ),
    true,
  );
  assert.equal(
    hrPrompt.instructions.field_level_rules.some((item) =>
      /interviewQuestions must be short|two sentences|spoken interview/i.test(item),
    ),
    true,
  );

  const allHrText = [
    validatedHrReport.executiveSummary.title,
    validatedHrReport.executiveSummary.summary,
    ...Object.values(validatedHrReport.cognitiveSignals),
    ...validatedHrReport.pointsOfCaution.flatMap((item) => [
      item.signal,
      item.whyItMatters,
      item.howToCheck,
    ]),
    ...validatedHrReport.interviewQuestions.flatMap((item) => [
      item.category,
      item.question,
      item.whatToListenFor,
    ]),
    ...validatedHrReport.onboardingGuidance.first30Days,
    ...validatedHrReport.onboardingGuidance.days60,
    ...validatedHrReport.onboardingGuidance.days90,
    ...validatedHrReport.interpretationLimits,
  ].join(" ");
  assert.equal(
    /iq|kvocijent inteligencije|inteligentan|neinteligentan|nadaren|iznadprosječan|ispodprosječan|percentile|percentil|norma|normativno|preporučuje se zapošljavanje|ne preporučuje se zapošljavanje|hiring score|idealni kandidat|loš fit|red flag|rizičan kandidat/i.test(
      allHrText,
    ),
    false,
  );
  const cognitiveSignalText = Object.values(validatedHrReport.cognitiveSignals).join(" ");
  const repeatedDefaultPhraseMatches = cognitiveSignalText.match(/To može ukazivati/gi) ?? [];
  assert.equal(repeatedDefaultPhraseMatches.length, 0);
  assert.match(validatedHrReport.cognitiveSignals.overall, /\d+\/\d+/);
  assert.match(validatedHrReport.cognitiveSignals.verbal, /\d+\/\d+/);
  assert.match(validatedHrReport.cognitiveSignals.figural, /\d+\/\d+/);
  assert.match(validatedHrReport.cognitiveSignals.numeric, /\d+\/\d+/);
  assert.doesNotMatch(
    validatedHrReport.pointsOfCaution.map((item) => item.signal).join(" "),
    /Rizik od pogrešne interpretacije ukupnog rezultata|Pogrešno tumačenje rezultata|Ograničenja testa/i,
  );
  assert.equal(
    validatedHrReport.interviewQuestions.every((item) => {
      const sentenceCount = item.question
        .split(/[.!?]+/)
        .map((part) => part.trim())
        .filter(Boolean).length;
      return sentenceCount <= 2;
    }),
    true,
  );

  const invalidHrReport = clone(validHrReport);
  invalidHrReport.executiveSummary.summary =
    "IQ i percentil ukazuju da je ovo idealni kandidat i preporučuje se zapošljavanje.";
  assert.throws(
    () => validateStructuredReport(invalidHrReport, hrInput),
    /SAFRAN HR report validation/i,
  );

  const invalidHrSummaryWithoutHypothesis = clone(validHrReport);
  invalidHrSummaryWithoutHypothesis.executiveSummary.summary =
    "Profil pokazuje jače verbalne i figuralne signale, uz slabiji numerički signal. To je pregled trenutnog obrasca rezultata po oblastima.";
  assert.throws(
    () => validateStructuredReport(invalidHrSummaryWithoutHypothesis, hrInput),
    /executiveSummary\.summary: Must frame the interpretation as a cautious HR hypothesis/i,
  );

  const invalidHrNormativeReport = clone(validHrReport);
  invalidHrNormativeReport.interpretationLimits[1] =
    "SAFRAN rezultat nije mjera opće sposobnosti kroz normativno poređenje i ne treba ga tumačiti kao rangiranje osobe u odnosu na druge.";
  assert.throws(
    () => validateStructuredReport(invalidHrNormativeReport, hrInput),
    /SAFRAN HR report validation/i,
  );

  const participantReport = buildMockSafranParticipantAiReport(participantInput.promptInput);
  const validatedParticipantReport = validateStructuredReport(participantReport, participantInput);
  assert.equal(validatedParticipantReport.reportType, "safran_participant_ai_report_v1");
  assert.equal(validatedParticipantReport.audience, "participant");

  assert.throws(
    () => validateStructuredReport(validHrReport, participantInput),
    /SAFRAN participant report validation/i,
  );
  assert.throws(
    () => validateStructuredReport(participantReport, hrInput),
    /SAFRAN HR report validation/i,
  );

  console.log("SAFRAN HR report OpenAI provider tests passed.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
