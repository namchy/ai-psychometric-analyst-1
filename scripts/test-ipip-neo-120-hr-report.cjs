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

  console.log("IPIP NEO-120 HR report contract tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
