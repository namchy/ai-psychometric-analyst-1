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

const {
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
  getIpipNeo120DomainLabel,
  getIpipNeo120FacetLabel,
} = require("../lib/assessment/ipip-neo-120-labels.ts");
const {
  validateIpipNeo120HrReportV1,
  coerceIpipNeo120HrReportV1ForDisplay,
  ipipNeo120HrReportV1Schema,
} = require("../lib/assessment/ipip-neo-120-report-v1.ts");
const { mockReportProvider } = require("../lib/assessment/report-provider-mock.ts");
const { resolveReportContract } = require("../lib/assessment/report-providers.ts");

function buildPromptInput() {
  return {
    attempt_id: "attempt-ipip-hr-001",
    test_id: "test-ipip-hr-001",
    test_slug: "ipip-neo-120-v1",
    test_name: "IPIP-NEO-120",
    test_family: "ipip_neo_120",
    audience: "hr",
    locale: "bs",
    scoring_method: "likert_mean",
    prompt_version: "ipip_neo_120_hr_v2",
    scored_response_count: 120,
    scale_hint: {
      min: 1,
      max: 5,
      display_mode: "visual_with_discreet_numeric_support",
    },
    domains: IPIP_NEO_120_DOMAIN_ORDER.map((domainCode, domainIndex) => ({
      domain_code: domainCode,
      label: getIpipNeo120DomainLabel(domainCode),
      score: 4.6 - domainIndex * 0.45,
      score_band:
        domainCode === "AGREEABLENESS" || domainCode === "CONSCIENTIOUSNESS"
          ? "high"
          : domainCode === "NEUROTICISM"
            ? "moderate"
            : "low",
      facets: IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map((facetCode, facetIndex) => ({
        facet_code: facetCode,
        label: getIpipNeo120FacetLabel(facetCode),
        score: 4.4 - facetIndex * 0.2,
        score_band: facetIndex < 2 ? "high" : facetIndex < 4 ? "moderate" : "low",
      })),
    })),
    deterministic_summary: {
      highest_domain: "AGREEABLENESS",
      lowest_domain: "OPENNESS_TO_EXPERIENCE",
      ranked_domains: ["AGREEABLENESS", "CONSCIENTIOUSNESS", "EXTRAVERSION", "NEUROTICISM", "OPENNESS_TO_EXPERIENCE"],
      top_facets: ["COOPERATION", "TRUST", "DUTIFULNESS", "SELF_DISCIPLINE", "CHEERFULNESS"],
    },
  };
}

function buildPreparedInput() {
  return {
    attemptId: "attempt-ipip-hr-001",
    testSlug: "ipip-neo-120-v1",
    promptVersion: "ipip_neo_120_hr_v2",
    promptVersionId: null,
    promptTemplate: null,
    promptInput: buildPromptInput(),
    reportContract: resolveReportContract("ipip-neo-120-v1", "hr"),
  };
}

function buildLegacyReport() {
  const promptInput = buildPromptInput();

  return {
    contract_version: "ipip_neo_120_hr_v1",
    test: {
      code: "ipip_neo_120",
      name: "IPIP-NEO-120",
    },
    meta: {
      language: "bs",
      audience: "hr",
    },
    headline: "Ugodnost i savjesnost daju prepoznatljiv radni obrazac.",
    executive_summary:
      "Raniji snapshot naglašava saradnju, standard i odnos prema obavezama. Vrijedi provjeriti kako se to vidi kada je pritisak veći ili kada treba zaštititi prioritet.",
    workplace_signals: [
      "Saradnički stil je vidljiv kroz odnos prema drugima.",
      "Standard rada i osjećaj obaveze djeluju važni za svakodnevni ritam.",
      "Provjera pod pritiskom ostaje važna.",
      "Timski kontekst može pojačati ili smanjiti izraženost signala.",
      "Razvojni fokus vrijedi vezati za konkretan posao.",
    ],
    domains: promptInput.domains.map((domain) => ({
      code:
        domain.domain_code === "EXTRAVERSION"
          ? "E"
          : domain.domain_code === "AGREEABLENESS"
            ? "A"
            : domain.domain_code === "CONSCIENTIOUSNESS"
              ? "C"
              : domain.domain_code === "NEUROTICISM"
                ? "N"
                : "O",
      label: domain.label,
      score_band: domain.score_band,
      summary: `${domain.label} daje HR signal koji vrijedi povezati sa stvarnim ponašanjem u ulozi.`,
      workplace_strengths: [
        `${domain.label} može podržati rad kada je ovaj obrazac važan za posao.`,
        `Ovaj domen može dati prepoznatljiv način rada i saradnje.`,
      ],
      workplace_watchouts: [
        `Vrijedi provjeriti kako se ${domain.label.toLowerCase()} pokazuje pod pritiskom.`,
        `Signal treba čitati uz konkretan posao i timski kontekst.`,
      ],
      management_notes: [
        `Feedback i onboarding treba vezati za ${domain.label.toLowerCase()}.`,
        `U razgovoru tražiti primjer koji potvrđuje ovaj domen.`,
      ],
      facets: domain.facets.map((facet) => ({
        code: facet.facet_code,
        label: facet.label,
        score_band: facet.score_band,
        summary: `${facet.label} daje dodatni signal za čitanje domena.`,
      })),
    })),
    collaboration_style: "Saradnja vrijedi provjeriti kroz granice, feedback i neslaganje.",
    communication_style: "Komunikaciju treba čitati kroz konkretne situacije tima.",
    leadership_and_influence: "Uticaj vrijedi provjeriti kroz donošenje odluka i preuzimanje odgovornosti.",
    team_watchouts: [
      "Provjeriti balans odnosa i odlučnosti.",
      "Provjeriti ponašanje pod pritiskom.",
      "Ne čitati snapshot bez konteksta uloge.",
    ],
    onboarding_or_management_recommendations: [
      "Rano razjasniti očekivanja i prioritete.",
      "Uvesti kratak ritam feedbacka.",
      "Povezati profil sa konkretnim zadacima.",
    ],
    interpretation_note:
      "Ovaj izvještaj nije dijagnoza, ne potvrđuje zaštićene osobine i treba ga čitati uz druge izvore informacija.",
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildSentence(base, targetLength) {
  let sentence = base.trim();
  if (!/[.!?]$/.test(sentence)) {
    sentence += ".";
  }

  if (sentence.length >= targetLength) {
    return sentence;
  }

  const filler = " dodatni radni kontekst";
  while (sentence.length + filler.length + 1 < targetLength) {
    sentence = `${sentence.slice(0, -1)}${filler}.`;
  }

  return sentence;
}

async function main() {
  const preparedInput = buildPreparedInput();
  const providerResult = await mockReportProvider.generateReport(preparedInput);
  assert.equal(providerResult.ok, true, providerResult.ok ? undefined : providerResult.reason);

  const strictValidation = validateIpipNeo120HrReportV1(providerResult.report, {
    strictContract: true,
    enforceGuardrails: true,
  });
  assert.equal(strictValidation.ok, true, strictValidation.ok ? undefined : strictValidation.errors.map((error) => error.message).join(" | "));

  const report = strictValidation.value;
  assert.equal(report.key_hr_signals.length, 3);
  assert.equal(report.verification_focus.length, 3);
  assert.equal(report.interview_questions.length, 5);
  assert.ok(report.strengths_and_overuse_risks.length >= 2 && report.strengths_and_overuse_risks.length <= 3);
  assert.equal(report.onboarding_and_management_guidance.length, 4);
  assert.equal(report.team_fit_notes.length, 3);
  assert.ok(report.decision_support_note.length >= 2 && report.decision_support_note.length <= 4);
  assert.equal(report.domain_overview.length, 5);
  assert.deepEqual(
    report.domain_overview.map((domain) => domain.domain_name),
    IPIP_NEO_120_DOMAIN_ORDER.map((domainCode) => getIpipNeo120DomainLabel(domainCode)),
  );

  assert.equal(ipipNeo120HrReportV1Schema.additionalProperties, false);
  assert.deepEqual(
    ipipNeo120HrReportV1Schema.properties.key_hr_signals.minItems,
    3,
  );
  assert.deepEqual(
    ipipNeo120HrReportV1Schema.properties.key_hr_signals.maxItems,
    3,
  );
  assert.deepEqual(
    ipipNeo120HrReportV1Schema.properties.interview_questions.maxItems,
    5,
  );
  assert.deepEqual(
    ipipNeo120HrReportV1Schema.properties.onboarding_and_management_guidance.minItems,
    4,
  );
  assert.deepEqual(
    ipipNeo120HrReportV1Schema.properties.team_fit_notes.maxItems,
    3,
  );
  assert.equal(resolveReportContract("ipip-neo-120-v1", "hr").schemaName, "ipip-neo-120-hr-v2");
  assert.equal(resolveReportContract("ipip-neo-120-v1", "hr").promptKey, "ipip_neo_120_hr_v2");
  assert.equal(report.contract_version, "ipip_neo_120_hr_v2");

  const legacyReport = buildLegacyReport();
  const legacyValidation = validateIpipNeo120HrReportV1(legacyReport);
  assert.equal(legacyValidation.ok, true, legacyValidation.ok ? undefined : legacyValidation.errors.map((error) => error.message).join(" | "));
  const legacyDisplayReport = coerceIpipNeo120HrReportV1ForDisplay(legacyReport);
  assert.ok(legacyDisplayReport);
  assert.equal(legacyDisplayReport.interview_questions.length, 5);
  assert.equal(legacyDisplayReport.key_hr_signals.length, 3);
  assert.equal(legacyDisplayReport.domain_overview.length, 5);

  const forbiddenHeadline = clone(report);
  forbiddenHeadline.headline = "Ugodnost trenutno daje najistaknutiji profesionalni signal u profilu.";
  assert.equal(
    validateIpipNeo120HrReportV1(forbiddenHeadline, {
      strictContract: true,
      enforceGuardrails: true,
    }).ok,
    false,
  );

  const forbiddenSummary = clone(report);
  forbiddenSummary.executive_summary =
    "Ovaj profil može pomoći finijem razumijevanju saradnje. U intervjuu vrijedi provjeriti granice i reakciju na pritisak.";
  assert.equal(
    validateIpipNeo120HrReportV1(forbiddenSummary, {
      strictContract: true,
      enforceGuardrails: true,
    }).ok,
    false,
  );

  const fourSentenceExecutiveSummary = clone(report);
  fourSentenceExecutiveSummary.executive_summary = [
    buildSentence(
      "Kandidat djeluje saradljivo i strukturirano kada su očekivanja jasna i kada timski odnosi ostaju predvidivi",
      145,
    ),
    buildSentence(
      "Vrijedi provjeriti kako čuva standard rada kada se prioriteti naglo promijene i kada treba uskladiti više interesnih strana",
      145,
    ),
    buildSentence(
      "U intervjuu tražiti primjer gdje je morao spojiti dosljednost, takt i odgovornost prema roku bez gubitka kvaliteta",
      145,
    ),
    buildSentence(
      "Za onboarding može biti korisno rano razjasniti granice odlučivanja, tempo povratne informacije i način eskalacije neslaganja",
      120,
    ),
  ].join(" ");
  assert.ok(fourSentenceExecutiveSummary.executive_summary.length < 600);
  assert.equal(
    validateIpipNeo120HrReportV1(fourSentenceExecutiveSummary, {
      strictContract: true,
      enforceGuardrails: true,
    }).ok,
    true,
  );

  const tooLongExecutiveSummary = clone(report);
  tooLongExecutiveSummary.executive_summary = "A".repeat(601);
  const tooLongExecutiveSummaryValidation = validateIpipNeo120HrReportV1(tooLongExecutiveSummary, {
    strictContract: true,
    enforceGuardrails: true,
  });
  assert.equal(tooLongExecutiveSummaryValidation.ok, false);
  assert.ok(
    tooLongExecutiveSummaryValidation.errors.some(
      (error) =>
        error.path === "executive_summary" && error.message.includes("at most 600 characters"),
    ),
  );

  const bulletedExecutiveSummary = clone(report);
  bulletedExecutiveSummary.executive_summary =
    "- Kandidat djeluje saradljivo u stabilnom timu. - Vrijedi provjeriti kako reaguje pod pritiskom.";
  const bulletedExecutiveSummaryValidation = validateIpipNeo120HrReportV1(bulletedExecutiveSummary, {
    strictContract: true,
    enforceGuardrails: true,
  });
  assert.equal(bulletedExecutiveSummaryValidation.ok, false);
  assert.ok(
    bulletedExecutiveSummaryValidation.errors.some(
      (error) =>
        error.path === "executive_summary" &&
        error.message.includes("Bullet points or list formatting are not allowed"),
    ),
  );

  const newlineExecutiveSummary = clone(report);
  newlineExecutiveSummary.executive_summary =
    "Kandidat djeluje saradljivo i strukturirano.\nVrijedi provjeriti kako reaguje pod pritiskom i kada mora zaštititi prioritet.";
  const newlineExecutiveSummaryValidation = validateIpipNeo120HrReportV1(newlineExecutiveSummary, {
    strictContract: true,
    enforceGuardrails: true,
  });
  assert.equal(newlineExecutiveSummaryValidation.ok, false);
  assert.ok(
    newlineExecutiveSummaryValidation.errors.some(
      (error) => error.path === "executive_summary" && error.message.includes("Line breaks are not allowed"),
    ),
  );

  const multiSentenceHrRelevance = clone(report);
  multiSentenceHrRelevance.domain_overview[1].hr_relevance =
    "Ovaj signal je koristan za procjenu saradnje, granica i načina davanja podrške kolegama. Vrijedi ga čitati uz zahtjev za taktom, pregovaranjem i održavanjem standarda pod pritiskom. U razgovoru ga poveži sa stvarnim primjerima neslaganja i prioritizacije.";
  assert.ok(multiSentenceHrRelevance.domain_overview[1].hr_relevance.length < 400);
  assert.equal(
    validateIpipNeo120HrReportV1(multiSentenceHrRelevance, {
      strictContract: true,
      enforceGuardrails: true,
    }).ok,
    true,
  );

  const tooLongHrRelevance = clone(report);
  tooLongHrRelevance.domain_overview[1].hr_relevance = "B".repeat(401);
  const tooLongHrRelevanceValidation = validateIpipNeo120HrReportV1(tooLongHrRelevance, {
    strictContract: true,
    enforceGuardrails: true,
  });
  assert.equal(tooLongHrRelevanceValidation.ok, false);
  assert.ok(
    tooLongHrRelevanceValidation.errors.some(
      (error) =>
        error.path === "domain_overview[1].hr_relevance" &&
        error.message.includes("at most 400 characters"),
    ),
  );

  const validInterpretationNote = clone(report);
  validInterpretationNote.interpretation_note =
    "Ovaj izvještaj je razvojni uvid. Koristi ga uz intervju i kontekst uloge. Ne donosi odluku samostalno.";
  assert.equal(
    validateIpipNeo120HrReportV1(validInterpretationNote, {
      strictContract: true,
      enforceGuardrails: true,
    }).ok,
    true,
  );

  const longSingleSentence = clone(report);
  longSingleSentence.interpretation_note =
    [
      "Ovaj izvještaj je razvojni uvid i treba ga koristiti uz intervju, reference, radne primjere i kontekst uloge bez samostalne odluke o kandidatu",
      "Ovaj izvještaj je razvojni uvid i treba ga koristiti uz intervju, reference, radne primjere i kontekst uloge bez samostalne odluke o kandidatu",
      "Ovaj izvještaj je razvojni uvid i treba ga koristiti uz intervju, reference, radne primjere i kontekst uloge bez samostalne odluke o kandidatu",
      "Ovaj izvještaj je razvojni uvid i treba ga koristiti uz intervju, reference, radne primjere i kontekst uloge bez samostalne odluke o kandidatu",
    ].join(" ") + ".";
  assert.equal(
    validateIpipNeo120HrReportV1(longSingleSentence, {
      strictContract: true,
      enforceGuardrails: true,
    }).ok,
    false,
  );

  const tooLongInterpretationNote = clone(report);
  tooLongInterpretationNote.interpretation_note = "C".repeat(451);
  const tooLongInterpretationNoteValidation = validateIpipNeo120HrReportV1(tooLongInterpretationNote, {
    strictContract: true,
    enforceGuardrails: true,
  });
  assert.equal(tooLongInterpretationNoteValidation.ok, false);
  assert.ok(
    tooLongInterpretationNoteValidation.errors.some(
      (error) =>
        error.path === "interpretation_note" &&
        error.message.includes("at most 450 characters"),
    ),
  );

  const fourSentenceNote = clone(report);
  fourSentenceNote.interpretation_note =
    "Ovaj izvještaj je razvojni uvid. Koristi ga uz intervju. Ne donosi odluku samostalno. Provjeri ga s drugim izvorima.";
  assert.equal(
    validateIpipNeo120HrReportV1(fourSentenceNote, {
      strictContract: true,
      enforceGuardrails: true,
    }).ok,
    true,
  );

  const bulletListNote = clone(report);
  bulletListNote.interpretation_note =
    "Ovaj izvještaj je razvojni uvid.\n- Koristi ga uz intervju.\n- Ne donosi odluku samostalno.";
  assert.equal(
    validateIpipNeo120HrReportV1(bulletListNote, {
      strictContract: true,
      enforceGuardrails: true,
    }).ok,
    false,
  );

  const hireLanguage = clone(report);
  hireLanguage.decision_support_note[0] = "Na osnovu ovoga treba zaposliti kandidata.";
  assert.equal(
    validateIpipNeo120HrReportV1(hireLanguage, {
      strictContract: true,
      enforceGuardrails: true,
    }).ok,
    false,
  );

  const wrongQuestionCount = clone(report);
  wrongQuestionCount.interview_questions = wrongQuestionCount.interview_questions.slice(0, 4);
  assert.equal(
    validateIpipNeo120HrReportV1(wrongQuestionCount, {
      strictContract: true,
      enforceGuardrails: true,
    }).ok,
    false,
  );

  const wrongDomainCount = clone(report);
  wrongDomainCount.domain_overview = wrongDomainCount.domain_overview.slice(0, 4);
  assert.equal(
    validateIpipNeo120HrReportV1(wrongDomainCount, {
      strictContract: true,
      enforceGuardrails: true,
    }).ok,
    false,
  );

  const wrongDomainOrder = clone(report);
  [
    wrongDomainOrder.domain_overview[0],
    wrongDomainOrder.domain_overview[1],
  ] = [
    wrongDomainOrder.domain_overview[1],
    wrongDomainOrder.domain_overview[0],
  ];
  const wrongDomainOrderValidation = validateIpipNeo120HrReportV1(wrongDomainOrder, {
    strictContract: true,
    enforceGuardrails: true,
  });
  assert.equal(wrongDomainOrderValidation.ok, false);
  assert.ok(
    wrongDomainOrderValidation.errors.some(
      (error) =>
        error.path === "domain_overview[0].domain_name" &&
        error.message.includes('Expected canonical label "Ekstraverzija"'),
    ),
  );

  const missingDomainField = clone(report);
  delete missingDomainField.domain_overview[0].check_in_interview;
  assert.equal(
    validateIpipNeo120HrReportV1(missingDomainField, {
      strictContract: true,
      enforceGuardrails: true,
    }).ok,
    false,
  );

  console.log("IPIP NEO-120 HR report contract tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
