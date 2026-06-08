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
  getIpipNeo120FacetLabel,
  getIpipNeo120HrDomainLabel,
} = require("../lib/assessment/ipip-neo-120-labels.ts");
const {
  validateIpipNeo120HrReportV1,
} = require("../lib/assessment/ipip-neo-120-report-v1.ts");
const { mockReportProvider } = require("../lib/assessment/report-provider-mock.ts");
const { resolveReportContract } = require("../lib/assessment/report-providers.ts");

function buildPromptInput() {
  return {
    attempt_id: "attempt-ipip-hr-terminology-guardrails",
    test_id: "test-ipip-hr-terminology-guardrails",
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
      label: getIpipNeo120HrDomainLabel(domainCode),
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function main() {
  const providerResult = await mockReportProvider.generateReport({
    attemptId: "attempt-ipip-hr-terminology-guardrails",
    testSlug: "ipip-neo-120-v1",
    promptVersion: "ipip_neo_120_hr_v2",
    promptVersionId: null,
    promptTemplate: null,
    promptInput: buildPromptInput(),
    reportContract: resolveReportContract("ipip-neo-120-v1", "hr"),
  });

  assert.equal(providerResult.ok, true, providerResult.ok ? undefined : providerResult.reason);

  const cleanValidation = validateIpipNeo120HrReportV1(providerResult.report, {
    strictContract: true,
    enforceGuardrails: true,
  });
  assert.equal(cleanValidation.ok, true, cleanValidation.ok ? undefined : cleanValidation.errors.map((error) => error.message).join(" | "));

  const cleanReport = cleanValidation.value;
  assert.equal(JSON.stringify(cleanReport.domain_overview).includes("Spremnost na saradnju"), true);
  assert.equal(
    cleanReport.strengths_and_overuse_risks.some((item) =>
      item.possible_overuse_risks.some((risk) => risk.includes("prekomjern")),
    ),
    true,
  );

  const dirtyCases = [
    { path: ["headline"], value: "Saradljivost i savjesnost daju prepoznatljiv radni obrazac." },
    { path: ["headline"], value: "saradljivost i savjesnost daju prepoznatljiv radni obrazac." },
    { path: ["headline"], value: "Kooperativnost i savjesnost daju prepoznatljiv radni obrazac." },
    { path: ["headline"], value: "kooperativnost i savjesnost daju prepoznatljiv radni obrazac." },
    { path: ["headline"], value: "Saradnički profil traži dodatnu provjeru u radu." },
    { path: ["headline"], value: "saradnički profil traži dodatnu provjeru u radu." },
    { path: ["headline"], value: "Snage i mogući overuse rizici traže provjeru." },
    { path: ["headline"], value: "Snage i mogući Overuse rizici traže provjeru." },
    { path: ["headline"], value: "Handling signal traži provjeru u radu." },
    { path: ["headline"], value: "handling signal traži provjeru u radu." },
  ];

  for (const dirtyCase of dirtyCases) {
    const report = clone(cleanReport);
    let target = report;

    for (let index = 0; index < dirtyCase.path.length - 1; index += 1) {
      target = target[dirtyCase.path[index]];
    }

    target[dirtyCase.path[dirtyCase.path.length - 1]] = dirtyCase.value;

    const validation = validateIpipNeo120HrReportV1(report, {
      strictContract: true,
      enforceGuardrails: true,
    });
    assert.equal(validation.ok, false, `Expected forbidden value to fail: ${dirtyCase.value}`);
  }

  console.log("test-ipip-hr-terminology-guardrails: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
