const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
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
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
} = require("../lib/assessment/ipip-neo-120-labels.ts");
const {
  buildPreparedReportGenerationInput,
} = require("../lib/assessment/report-provider-helpers.ts");
const {
  buildOpenAiStructuredRequestPayload,
} = require("../lib/assessment/report-provider-openai.ts");
const {
  buildAiReportDebugDumpRecord,
  maybeWriteAiReportDebugDump,
} = require("../lib/assessment/ai-report-debug-dump.ts");

function buildRequest() {
  const dimensions = [];

  for (const [domainIndex, domainCode] of IPIP_NEO_120_DOMAIN_ORDER.entries()) {
    for (const [facetIndex, facetCode] of IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].entries()) {
      dimensions.push({
        dimension: facetCode,
        rawScore: 4.7 - domainIndex * 0.35 - facetIndex * 0.08,
        scoredQuestionCount: 4,
      });
    }
  }

  return {
    attemptId: "attempt-ipip-hr-prompt-request-authority",
    testId: "test-ipip-hr-prompt-request-authority",
    testSlug: "ipip-neo-120-v1",
    audience: "hr",
    locale: "bs",
    scoringMethod: "likert_mean",
    promptVersion: "ipip_neo_120_hr_v2",
    testName: "IPIP-NEO-120",
    results: {
      attemptId: "attempt-ipip-hr-prompt-request-authority",
      scoringMethod: "likert_mean",
      dimensions,
      scoredResponseCount: 120,
      unscoredResponses: [],
    },
  };
}

function buildPromptTemplate() {
  return {
    id: "prompt-version-ipip-hr-request-authority",
    testId: "test-ipip-hr-prompt-request-authority",
    reportType: "individual",
    audience: "hr",
    sourceType: "single_test",
    generatorType: "openai",
    promptKey: "ipip_neo_120_hr_v2",
    version: "v1_ipip_hr_focused_20260606",
    systemPrompt:
      "DB system prompt with Ugodnost, Saradljivost i handling inside system context.",
    userPromptTemplate:
      "Koristi tačno 5 domain_overview stavki u ovom redoslijedu: Ekstraverzija, Ugodnost, Savjesnost, Neuroticizam, Otvorenost prema iskustvu. Snage i mogući overuse rizici treba da budu jasno opisani. HR handling tip mora ostati praktičan. {{prompt_input_json}}",
    outputSchemaJson: null,
    notes: null,
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:00:00.000Z",
    updatedBy: null,
  };
}

async function main() {
  const originalFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  };

  try {
    const request = buildRequest();
    const preparedInput = buildPreparedReportGenerationInput(request, {
      promptVersionId: "prompt-version-ipip-hr-request-authority",
      promptTemplate: buildPromptTemplate(),
    });
    const payload = buildOpenAiStructuredRequestPayload(preparedInput, {
      apiKey: "sk-test-secret-value",
      model: "gpt-4.1",
      timeoutMs: 120000,
    });

    const agreeablenessDomain = preparedInput.promptInput.domains.find(
      (domain) => domain.domain_code === "AGREEABLENESS",
    );

    assert.equal(agreeablenessDomain?.label, "Spremnost na saradnju");
    assert.equal(payload.requestBody.model, "gpt-4.1");
    assert.equal(payload.requestBody.response_format.type, "json_schema");
    assert.equal(
      payload.requestBody.response_format.json_schema.schema.required.includes("score_references"),
      true,
    );
    assert.equal(
      payload.requestBody.response_format.json_schema.schema.properties.score_references.additionalProperties,
      false,
    );
    assert.equal(
      payload.requestBody.response_format.json_schema.schema.properties.score_references.properties.domains.items.properties.facets.items.additionalProperties,
      false,
    );
    assert.equal(typeof payload.systemPrompt, "string");
    assert.equal(typeof payload.userPrompt, "string");
    assert.equal(payload.requestBody.messages[0].content, payload.systemPrompt);
    assert.equal(payload.requestBody.messages[1].content, payload.userPrompt);
    assert.ok(payload.authorityMetadata);
    assert.equal(payload.authorityMetadata.reportFamily, "single_test_hr");
    assert.equal(payload.authorityMetadata.reportKind, "ipip_hr");
    assert.equal(payload.authorityMetadata.promptSource, "db_prompt_version");
    assert.equal(payload.authorityMetadata.promptVersionId, "prompt-version-ipip-hr-request-authority");
    assert.equal(payload.authorityMetadata.promptVersion, "v1_ipip_hr_focused_20260606");
    assert.equal(payload.authorityMetadata.promptKey, "ipip_neo_120_hr_v2");
    assert.equal(payload.authorityMetadata.reportContractKey, "ipip_neo_120_hr_v2");
    assert.equal(payload.authorityMetadata.reportSchemaName, "ipip-neo-120-hr-v2");
    assert.deepEqual(payload.authorityMetadata.authorityLayers, [
      "global_bhs_language_policy",
      "global_hr_report_policy",
      "single_test_hr_family_policy",
      "test_specific_terminology_policy",
      "runtime_input_facts",
    ]);
    assert.equal(payload.authorityMetadata.terminologyAuthority?.key, "ipip_hr_canonical_terminology");
    assert.equal(payload.authorityMetadata.terminologyAuthority?.canonicalAgreeablenessLabel, "Spremnost na saradnju");
    assert.equal(
      payload.authorityMetadata.terminologyAuthority?.canonicalAgreeablenessNarrativeLabel,
      "spremnost na saradnju",
    );

    const payloadText = JSON.stringify({
      systemPrompt: payload.systemPrompt,
      userPrompt: payload.userPrompt,
      requestBody: payload.requestBody,
      authorityMetadata: payload.authorityMetadata,
    });
    const promptText = `${payload.systemPrompt}\n${payload.userPrompt}`;

    assert.equal(payloadText.includes("Spremnost na saradnju"), true);
    assert.equal(promptText.includes("Global BHS user-facing language policy:"), true);
    assert.equal(promptText.includes("Authority composition order for this request:"), true);
    assert.equal(promptText.includes("Write in Bosnian language, ijekavica, Latin script."), true);
    assert.equal(promptText.includes("Write for HR stakeholders in an advisory, calm and workplace-oriented tone."), true);
    assert.equal(promptText.includes('Do not address the candidate with second-person singular forms such as "ti" in HR reports.'), true);
    assert.equal(promptText.includes('Do not leak internal schema, JSON, validator, prompt or similar implementation language into user-facing narrative.'), true);
    assert.equal(promptText.includes('Forbidden user-facing terms include "snapshot", "high", "low", "moderate", "overuse", "handling", "score", "band", "raw score", "schema", "JSON", "validator" and "prompt".'), true);
    assert.equal(promptText.includes('"high" -> "visoko izraženo" or "u višem rasponu"'), true);
    assert.equal(promptText.includes('Inside narrative sentences use lowercase forms: "savjesnost", "neuroticizam", "ekstraverzija", "otvorenost prema iskustvu", "spremnost na saradnju".'), true);
    assert.equal(promptText.includes('use only the label/title/domain form "Spremnost na saradnju"'), true);
    assert.equal(promptText.includes('use only the sentence form "spremnost na saradnju"'), true);
    assert.equal(promptText.includes('Do not use "Ugodnost"'), true);
    assert.equal(promptText.includes('"Saradljivost"'), true);
    assert.equal(promptText.includes('"Kooperativnost"'), true);
    assert.equal(promptText.includes('"Saradnički profil"'), true);
    assert.equal(promptText.includes('"overuse"'), true);
    assert.equal(promptText.includes('"handling"'), true);
    assert.equal(JSON.stringify(preparedInput.promptInput).includes("Ugodnost"), false);
    assert.equal(JSON.stringify(preparedInput.promptInput).includes("Saradljivost"), true);
    assert.equal(JSON.stringify(preparedInput.promptInput).includes("Kooperativnost"), false);
    assert.equal(JSON.stringify(preparedInput.promptInput).includes("overuse"), false);
    assert.equal(JSON.stringify(preparedInput.promptInput).includes("handling"), false);
    assert.equal(/prekomjern\w* oslanjanj\w*/i.test(promptText), true);
    assert.equal(promptText.includes("upravljanje"), true);
    assert.equal(promptText.includes("postupanje"), true);
    assert.equal(promptText.includes("nošenje sa"), true);
    assert.equal(
      payload.userPrompt.includes(
        "Use exactly 5 domain_overview items in this order: Ekstraverzija, Spremnost na saradnju, Savjesnost, Neuroticizam, Otvorenost prema iskustvu.",
      ) || payload.userPrompt.includes(
        "Koristi tačno 5 domain_overview stavki u ovom redoslijedu: Ekstraverzija, Spremnost na saradnju, Savjesnost, Neuroticizam, Otvorenost prema iskustvu.",
      ),
      true,
    );
    assert.equal(
      payload.userPrompt.includes("Snage i mogući rizici prekomjernog oslanjanja"),
      true,
    );
    assert.equal(
      payload.userPrompt.includes("HR smjernica za postupanje"),
      true,
    );
    assert.equal(promptText.includes("IPIP-NEO-120 HR content quality rules:"), true);
    assert.equal(promptText.includes("IPIP-NEO-120 HR structured score reference rules:"), true);
    assert.equal(
      promptText.includes(
        "score_references must copy input.test_slug, input.locale and input.domains exactly without recalculation, translation, reordering or rewriting.",
      ),
      true,
    );
    assert.equal(
      promptText.includes(
        "For every facet, copy facet_code, label as facet_name, score and score_band as score_label_or_band.",
      ),
      true,
    );
    assert.equal(
      promptText.includes("Write HR interpretation, not score-summary prose."),
      true,
    );
    assert.equal(
      promptText.includes("Domains, score bands and facets are evidence; they must not be the main sentence of the insight."),
      true,
    );
    assert.equal(
      promptText.includes("Do not open executive_summary, key_hr_signals[].evidence, key_hr_signals[].hr_implication or domain_overview[].concise_meaning with domain + band patterns"),
      true,
    );
    assert.equal(promptText.includes("Savjesnost je u višem rasponu"), true);
    assert.equal(promptText.includes("Spremnost na saradnju je u višem rasponu"), true);
    assert.equal(promptText.includes("Neuroticizam je u nižem rasponu"), true);
    assert.equal(
      promptText.includes("key_hr_signals must be behavioral HR themes, not Big Five domain restatements."),
      true,
    );
    assert.equal(promptText.includes("pouzdanost i izvršenje"), true);
    assert.equal(promptText.includes("saradnja i postavljanje granica"), true);
    assert.equal(promptText.includes("emocionalni ton pod pritiskom"), true);
    assert.equal(
      promptText.includes("Facets are supporting evidence, not a list."),
      true,
    );
    assert.equal(promptText.includes("uz visoke facete"), true);
    assert.equal(
      promptText.includes("Use an authoritative but careful HR tone."),
      true,
    );
    assert.equal(promptText.includes("Profil pokazuje"), true);
    assert.equal(promptText.includes("Rezultati ukazuju na"), true);
    assert.equal(promptText.includes("U intervjuu treba provjeriti"), true);
    assert.equal(promptText.includes("Avoid stacked caution markers"), true);
    assert.equal(promptText.includes("upućuje na osobu koja vjerovatno"), true);
    assert.equal(promptText.includes("može ukazivati da vjerovatno"), true);
    assert.equal(promptText.includes("rezultati sugerišu mogućnost da"), true);
    assert.equal(
      promptText.includes("Use at most one caution marker per claim when needed."),
      true,
    );
    assert.equal(
      promptText.includes("Do not repeat generic modality across items."),
      true,
    );
    assert.equal(promptText.includes("Može podržati"), true);
    assert.equal(promptText.includes("Može ukazivati"), true);
    assert.equal(promptText.includes("postavljanje granica"), true);
    assert.equal(promptText.includes("reakcija na pritisak"), true);
    assert.equal(
      promptText.includes("Keep structural/internal fields intact: do not change schema keys, enum values, domain_name, facet_name or score_label_or_band."),
      true,
    );

    const dumpRecord = buildAiReportDebugDumpRecord(
      preparedInput,
      {
        provider: "openai",
        model: payload.requestBody.model,
        systemPrompt: payload.systemPrompt,
        renderedUserPrompt: payload.userPrompt,
        requestBody: payload.requestBody,
      },
      {
        now: new Date("2026-06-08T12:34:56.000Z"),
        redactValues: ["sk-test-secret-value"],
      },
    );
    const dumpText = JSON.stringify(dumpRecord);
    const dumpPromptText = `${dumpRecord.system_prompt}\n${dumpRecord.rendered_user_prompt}`;

    assert.equal(dumpText.includes("Spremnost na saradnju"), true);
    assert.equal(dumpPromptText.includes('Do not use "Ugodnost"'), true);
    assert.equal(dumpPromptText.includes('"Saradljivost"'), true);
    assert.equal(dumpPromptText.includes('"Kooperativnost"'), true);
    assert.equal(dumpPromptText.includes('"overuse"'), true);
    assert.equal(dumpPromptText.includes('"handling"'), true);
    assert.equal(dumpPromptText.includes("IPIP-NEO-120 HR content quality rules:"), true);
    assert.equal(dumpPromptText.includes("Write HR interpretation, not score-summary prose."), true);
    assert.equal(dumpPromptText.includes("key_hr_signals must be behavioral HR themes, not Big Five domain restatements."), true);
    assert.equal(dumpPromptText.includes("Avoid stacked caution markers"), true);
    assert.equal(/prekomjern\w* oslanjanj\w*/i.test(dumpPromptText), true);
    assert.equal(dumpRecord.model, "gpt-4.1");
    assert.equal(dumpRecord.prompt_key, "ipip_neo_120_hr_v2");
    assert.equal(dumpRecord.report_contract_key, "ipip_neo_120_hr_v2");
    assert.equal(dumpRecord.report_schema_name, "ipip-neo-120-hr-v2");
    assert.equal(dumpRecord.response_format.type, "json_schema");
    assert.equal(typeof dumpRecord.system_prompt, "string");
    assert.equal(typeof dumpRecord.rendered_user_prompt, "string");
    assert.equal(dumpRecord.authority_metadata.reportFamily, "single_test_hr");
    assert.equal(dumpRecord.authority_metadata.reportKind, "ipip_hr");
    assert.equal(dumpRecord.authority_metadata.promptSource, "db_prompt_version");
    assert.equal(dumpRecord.authority_metadata.promptKey, "ipip_neo_120_hr_v2");
    assert.equal(dumpRecord.authority_metadata.reportContractKey, "ipip_neo_120_hr_v2");
    assert.deepEqual(dumpRecord.authority_metadata.authorityLayers, [
      "global_bhs_language_policy",
      "global_hr_report_policy",
      "single_test_hr_family_policy",
      "test_specific_terminology_policy",
      "runtime_input_facts",
    ]);
    assert.equal(dumpRecord.authority_metadata.terminologyAuthority.key, "ipip_hr_canonical_terminology");
    assert.equal(fetchCalled, false);

    delete process.env.AI_REPORT_DEBUG_DUMP_PROMPTS;
    let writeCalled = false;
    const dumpWriteResult = await maybeWriteAiReportDebugDump(
      preparedInput,
      {
        provider: "openai",
        model: payload.requestBody.model,
        systemPrompt: payload.systemPrompt,
        renderedUserPrompt: payload.userPrompt,
        requestBody: payload.requestBody,
      },
      {
        tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), "ipip-hr-prompt-request-authority-")),
        now: new Date("2026-06-08T12:34:56.000Z"),
        randomSuffix: "abc123",
        redactValues: ["sk-test-secret-value"],
        writeFile: async () => {
          writeCalled = true;
        },
      },
    );

    assert.equal(dumpWriteResult, null);
    assert.equal(writeCalled, false);
    console.log("test-ipip-hr-prompt-request-authority: ok");
  } finally {
    global.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
