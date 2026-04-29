const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;
const SEGMENT_TIMEOUT_MS = 120000;

function fail(message) {
  throw new Error(message);
}

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  const extensions = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"];

  for (const extension of extensions) {
    const withExtension = `${candidatePath}${extension}`;

    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  for (const extension of extensions) {
    const asIndex = path.join(candidatePath, `index${extension}`);

    if (fs.existsSync(asIndex)) {
      return asIndex;
    }
  }

  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return emptyModulePath;
  }

  if (request.startsWith("@/")) {
    const resolvedPath = resolveWithExtensions(path.join(projectRoot, request.slice(2)));
    return originalResolveFilename.call(this, resolvedPath, parent, isMain, options);
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
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function requireEnv() {
  if (process.env.AI_REPORT_PROVIDER !== "openai") {
    fail("AI_REPORT_PROVIDER must be openai.");
  }

  if (process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION !== "v2") {
    fail("IPIP_NEO_120_PARTICIPANT_REPORT_VERSION must be v2.");
  }

  if (!process.env.OPENAI_API_KEY) {
    fail("OPENAI_API_KEY is required.");
  }

  if (!process.env.AI_REPORT_MODEL) {
    fail("AI_REPORT_MODEL is required.");
  }

  return {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.AI_REPORT_MODEL,
  };
}

function buildPromptInput() {
  const {
    IPIP_NEO_120_DOMAIN_ORDER,
    IPIP_NEO_120_FACETS_BY_DOMAIN,
    IPIP_NEO_120_TEST_FAMILY,
    IPIP_NEO_120_TEST_SLUG,
    getIpipNeo120DomainLabel,
    getIpipNeo120FacetLabel,
  } = require("../lib/assessment/ipip-neo-120-labels.ts");

  return {
    attempt_id: "segmented-openai-smoke",
    test_id: "test-ipip-neo-120",
    test_slug: IPIP_NEO_120_TEST_SLUG,
    test_name: "IPIP-NEO-120",
    test_family: IPIP_NEO_120_TEST_FAMILY,
    audience: "participant",
    locale: "bs",
    scoring_method: "average",
    prompt_version: "ipip_neo_120_participant_v2_segmented_smoke",
    scored_response_count: 120,
    scale_hint: {
      min: 1,
      max: 5,
      display_mode: "visual_with_discreet_numeric_support",
    },
    domains: IPIP_NEO_120_DOMAIN_ORDER.map((domainCode, domainIndex) => ({
      domain_code: domainCode,
      label: getIpipNeo120DomainLabel(domainCode),
      score: 4.5 - domainIndex * 0.44,
      band: domainIndex < 2 ? "higher" : domainIndex === 3 ? "lower" : "balanced",
      subdimensions: IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map(
        (facetCode, facetIndex) => ({
          facet_code: facetCode,
          label: getIpipNeo120FacetLabel(facetCode),
          score: 4.75 - domainIndex * 0.31 - facetIndex * 0.07,
          band: facetIndex < 2 ? "higher" : facetIndex > 3 ? "lower" : "balanced",
        }),
      ),
    })),
    deterministic_summary: {
      highest_domain: "EXTRAVERSION",
      lowest_domain: "OPENNESS_TO_EXPERIENCE",
      ranked_domains: [],
      top_subdimensions: [],
    },
  };
}

function buildV2Input() {
  const {
    buildIpipNeo120ParticipantAiInputV2,
    validateIpipNeo120ParticipantAiInputV2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");

  const input = buildIpipNeo120ParticipantAiInputV2(buildPromptInput());
  const validation = validateIpipNeo120ParticipantAiInputV2(input);

  if (!validation.ok) {
    fail(`Segmented smoke input validation failed: ${validation.errors.join(" | ")}`);
  }

  return validation.value;
}

function buildSystemPrompt() {
  return [
    "You generate segmented JSON for an IPIP-NEO-120 participant V2 report.",
    "Return only JSON that matches the supplied JSON schema exactly.",
    "Use only the provided segment input.",
    "Do not change canonical codes, labels, score, band, band_label or participant_display_label.",
    "Follow text budgets, vocabulary rules, consistency rules and guardrails.",
    "Write in Bosnian, latin script, ijekavica.",
    "Do not diagnose or make hiring recommendations.",
  ].join(" ");
}

function buildOverviewUserPrompt(input) {
  return JSON.stringify({
    instructions: [
      "Return only JSON matching the provided segment schema.",
      "Use only the provided segment input.",
      "Generate only overview content: summary, key_patterns, work_style.",
      "Do not change canonical codes, labels, score, band, band_label or participant_display_label.",
      "Follow text budgets, vocabulary rules, consistency rules and guardrails.",
    ],
    input,
  });
}

function buildDomainUserPrompt(input, domainCode) {
  return JSON.stringify({
    instructions: [
      "Return only JSON matching the provided segment schema.",
      "Use only the provided segment input.",
      `Generate only the requested domain segment for ${domainCode}.`,
      "Do not change canonical codes, labels, score, band, band_label or participant_display_label.",
      "Generate exactly 6 subdimensions for that domain only.",
      "Follow text budgets, vocabulary rules, consistency rules and guardrails.",
      "candidate_reflection is NOT a question.",
      "Treat candidate_reflection as a candidate_takeaway sentence.",
      "It must be a short declarative closing sentence.",
      "It must not ask the candidate to reflect, answer, notice, consider, or think about something.",
      "It must not end with '?'.",
      "It must not start with question words such as “Kako”, “Šta”, “Kada”, “Gdje”, “Zašto”, “Na koji način”, “Da li”, “Možeš li”, or “Možete li”.",
      "Do not use coaching-question style.",
      "Do not write self-reflection prompts.",
      "For every domain.candidate_reflection and every subdimension.candidate_reflection, write a sentence that can stand after the phrase: “Takeaway: ...”",
      "If the sentence would sound like a question or coaching prompt, rewrite it as a declarative takeaway.",
      "In NEUROTICISM subdimensions, candidate_reflection must remain non-clinical and declarative. Do not ask reflective questions about stress, anxiety, mood, exposure, impulses or vulnerability. Write a calm takeaway sentence instead.",
      "Good examples: \"Najkorisnije je da ovaj signal posmatraš kao informaciju o tome kada ti treba više strukture i oporavka.\" \"Ovaj obrazac može ti pomoći da ranije prepoznaš situacije u kojima vrijedi usporiti i vratiti ritam.\" \"U praksi je korisno da ovaj signal povežeš sa jasnim granicama, podrškom i vremenom za oporavak.\"",
      "Bad examples: \"Kako možeš bolje koristiti ovaj obrazac?\" \"Šta ti može pomoći u ovakvim situacijama?\" \"Da li prepoznaješ ovaj obrazac kod sebe?\"",
    ],
    input,
  });
}

function buildPracticalUserPrompt(input) {
  return JSON.stringify({
    instructions: [
      "Return only JSON matching the provided segment schema.",
      "Use only the provided segment input.",
      "Generate only strengths, watchouts, development_recommendations and interpretation_note.",
      "Return static_text.interpretation_note exactly.",
      "Do not change canonical codes, labels, score, band, band_label or participant_display_label.",
      "Follow text budgets, vocabulary rules, consistency rules and guardrails.",
    ],
    input,
  });
}

async function requestSegment({ apiKey, model, schemaName, schema, userPrompt, label }) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error(`${label} timed out after ${SEGMENT_TIMEOUT_MS}ms.`)),
    SEGMENT_TIMEOUT_MS,
  );

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema,
          },
        },
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(),
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    const elapsedMs = Date.now() - startedAt;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${label} HTTP ${response.status}: ${errorText}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      throw new Error(`${label} did not return message.content.`);
    }

    return {
      parsed: JSON.parse(content),
      elapsedMs,
      outputSize: Buffer.byteLength(content, "utf8"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function logSegmentMetric(label, elapsedMs, outputSize) {
  console.info(`${label}: success`, { elapsedMs, outputSize });
}

function buildDomainSchemaName(domainCode) {
  const compactCode = String(domainCode)
    .toLowerCase()
    .split("_")
    .map((part) => part.slice(0, 3))
    .join("_");

  return `ipip_neo120_p_v2_seg_domain_${compactCode}`;
}

async function main() {
  const env = requireEnv();
  const v2Input = buildV2Input();
  const {
    IPIP_NEO_120_DOMAIN_ORDER,
  } = require("../lib/assessment/ipip-neo-120-labels.ts");
  const {
    assembleIpipNeo120ParticipantReportV2FromSegments,
    buildIpipNeo120ParticipantDomainSegmentPromptInput,
    buildIpipNeo120ParticipantOverviewSegmentPromptInput,
    buildIpipNeo120ParticipantPracticalSegmentPromptInput,
    formatIpipNeo120ParticipantReportV2SegmentValidationErrors,
    ipipNeo120ParticipantReportV2DomainSegmentOpenAiSchema,
    ipipNeo120ParticipantReportV2OverviewSegmentOpenAiSchema,
    ipipNeo120ParticipantReportV2PracticalSegmentOpenAiSchema,
    validateIpipNeo120ParticipantReportV2DomainSegment,
    validateIpipNeo120ParticipantReportV2OverviewSegment,
    validateIpipNeo120ParticipantReportV2PracticalSegment,
    validateIpipNeo120ParticipantReportV2SegmentsBundle,
  } = require("../lib/assessment/ipip-neo-120-participant-report-v2-segments.ts");
  const {
    IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");
  const {
    formatIpipNeo120ParticipantReportV2ValidationErrors,
    validateIpipNeo120ParticipantReportV2,
  } = require("../lib/assessment/ipip-neo-120-participant-report-v2.ts");

  const totalStartedAt = Date.now();

  const overviewPromptInput = buildIpipNeo120ParticipantOverviewSegmentPromptInput(v2Input);
  const overviewResponse = await requestSegment({
    ...env,
    label: "overview",
    schemaName: "ipip_neo_120_participant_v2_segment_overview",
    schema: ipipNeo120ParticipantReportV2OverviewSegmentOpenAiSchema,
    userPrompt: buildOverviewUserPrompt(overviewPromptInput),
  });
  logSegmentMetric("overview", overviewResponse.elapsedMs, overviewResponse.outputSize);
  const overviewValidation = validateIpipNeo120ParticipantReportV2OverviewSegment(
    overviewResponse.parsed,
  );
  if (!overviewValidation.ok) {
    fail(
      `overview validation failed:\n${formatIpipNeo120ParticipantReportV2SegmentValidationErrors(
        overviewValidation.errors,
      )}`,
    );
  }

  const domainSegments = [];
  const domainMetrics = [];

  for (const domainCode of IPIP_NEO_120_DOMAIN_ORDER) {
    const domainPromptInput = buildIpipNeo120ParticipantDomainSegmentPromptInput(
      v2Input,
      domainCode,
    );
    const domainResponse = await requestSegment({
      ...env,
      label: `domain:${domainCode}`,
      schemaName: buildDomainSchemaName(domainCode),
      schema: ipipNeo120ParticipantReportV2DomainSegmentOpenAiSchema,
      userPrompt: buildDomainUserPrompt(domainPromptInput, domainCode),
    });
    logSegmentMetric(`domain:${domainCode}`, domainResponse.elapsedMs, domainResponse.outputSize);
    domainMetrics.push({
      domainCode,
      elapsedMs: domainResponse.elapsedMs,
      outputSize: domainResponse.outputSize,
    });

    const domainValidation = validateIpipNeo120ParticipantReportV2DomainSegment(
      domainResponse.parsed,
      domainCode,
    );
    if (!domainValidation.ok) {
      fail(
        `domain:${domainCode} validation failed:\n${formatIpipNeo120ParticipantReportV2SegmentValidationErrors(
          domainValidation.errors,
        )}`,
      );
    }

    domainSegments.push(domainValidation.value);
  }

  const practicalPromptInput = buildIpipNeo120ParticipantPracticalSegmentPromptInput(v2Input);
  const practicalResponse = await requestSegment({
    ...env,
    label: "practical",
    schemaName: "ipip_neo_120_participant_v2_segment_practical",
    schema: ipipNeo120ParticipantReportV2PracticalSegmentOpenAiSchema,
    userPrompt: buildPracticalUserPrompt(practicalPromptInput),
  });
  logSegmentMetric("practical", practicalResponse.elapsedMs, practicalResponse.outputSize);
  const practicalValidation = validateIpipNeo120ParticipantReportV2PracticalSegment(
    practicalResponse.parsed,
  );
  if (!practicalValidation.ok) {
    fail(
      `practical validation failed:\n${formatIpipNeo120ParticipantReportV2SegmentValidationErrors(
        practicalValidation.errors,
      )}`,
    );
  }

  const bundle = {
    overview: overviewValidation.value,
    domains: domainSegments,
    practical: practicalValidation.value,
  };
  const bundleValidation = validateIpipNeo120ParticipantReportV2SegmentsBundle(bundle);
  if (!bundleValidation.ok) {
    fail(
      `bundle validation failed:\n${formatIpipNeo120ParticipantReportV2SegmentValidationErrors(
        bundleValidation.errors,
      )}`,
    );
  }

  const assembled = assembleIpipNeo120ParticipantReportV2FromSegments(v2Input, bundleValidation.value);
  if (!assembled.ok) {
    fail(
      `assembler failed:\n${formatIpipNeo120ParticipantReportV2SegmentValidationErrors(
        assembled.errors,
      )}`,
    );
  }

  const reportValidation = validateIpipNeo120ParticipantReportV2(assembled.value);
  if (!reportValidation.ok) {
    fail(
      `final report validation failed:\n${formatIpipNeo120ParticipantReportV2ValidationErrors(
        reportValidation.errors,
      )}`,
    );
  }

  const finalReport = reportValidation.value;
  const totalElapsedMs = Date.now() - totalStartedAt;
  const totalSubdimensions = finalReport.domains.flatMap((domain) => domain.subdimensions).length;
  const finalReportSize = Buffer.byteLength(JSON.stringify(finalReport), "utf8");

  assert(finalReport.contract_version === "ipip_neo_120_participant_v2", "Expected V2 contract_version.");
  assert(finalReport.summary.badges.length === 3, "Expected 3 badges.");
  assert(finalReport.key_patterns.length === 3, "Expected 3 key_patterns.");
  assert(finalReport.domains.length === 5, "Expected 5 domains.");
  assert(totalSubdimensions === 30, "Expected 30 total subdimensions.");
  assert(finalReport.strengths.length === 4, "Expected 4 strengths.");
  assert(finalReport.watchouts.length === 3, "Expected 3 watchouts.");
  assert(finalReport.work_style.paragraphs.length === 2, "Expected 2 work_style paragraphs.");
  assert(
    finalReport.development_recommendations.length === 4,
    "Expected 4 development_recommendations.",
  );
  assert(
    finalReport.interpretation_note.text ===
      IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2.interpretation_note.text,
    "Expected static interpretation note text.",
  );

  console.info("segmented smoke totals", {
    overviewElapsedMs: overviewResponse.elapsedMs,
    domainElapsedMs: domainMetrics,
    practicalElapsedMs: practicalResponse.elapsedMs,
    totalElapsedMs,
    finalReportSize,
  });

  console.info("segmented smoke sample", {
    headline: finalReport.summary.headline,
    badges: finalReport.summary.badges.map((badge) => badge.label),
    keyPatterns: finalReport.key_patterns.map((pattern) => pattern.title),
    domains: finalReport.domains.map(
      (domain) => `${domain.participant_display_label} · ${domain.display_band_label}`,
    ),
    firstSubdimension:
      finalReport.domains[0]?.subdimensions[0]?.participant_display_label ?? null,
    firstStrength: finalReport.strengths[0]?.title ?? null,
    firstWatchout: finalReport.watchouts[0]?.title ?? null,
    firstRecommendation: finalReport.development_recommendations[0]?.title ?? null,
  });

  console.info("IPIP-NEO-120 participant V2 segmented OpenAI smoke verification passed");
}

main().catch((error) => {
  console.error("verify-ipip-neo-120-participant-v2-openai-segmented-smoke failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
