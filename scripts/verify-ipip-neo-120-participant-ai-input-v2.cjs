const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

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

function assertSameArray(actual, expected, label) {
  if (actual.length !== expected.length) {
    fail(`${label}: expected ${expected.length} items, got ${actual.length}`);
  }

  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) {
      fail(`${label}: expected ${expected[index]} at index ${index}, got ${actual[index]}`);
    }
  }
}

function assertRequiredString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label}: expected non-empty string`);
  }
}

async function main() {
  const {
    IPIP_NEO_120_DOMAIN_ORDER,
    IPIP_NEO_120_FACETS_BY_DOMAIN,
  } = require("../lib/assessment/ipip-neo-120-labels.ts");
  const {
    IPIP_NEO_120_BAND_MEANINGS_V2,
    IPIP_NEO_120_DOMAIN_DEFINITIONS_V2,
    IPIP_NEO_120_FACET_DEFINITIONS_V2,
    IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2,
    IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2,
    IPIP_NEO_120_PARTICIPANT_VOCABULARY_RULES_V2,
  } = require("../lib/assessment/ipip-neo-120-participant-ai-input-v2.ts");

  const domainCodes = Object.keys(IPIP_NEO_120_DOMAIN_DEFINITIONS_V2);
  assertSameArray(domainCodes, IPIP_NEO_120_DOMAIN_ORDER, "Domain definitions");

  for (const domainCode of IPIP_NEO_120_DOMAIN_ORDER) {
    const definition = IPIP_NEO_120_DOMAIN_DEFINITIONS_V2[domainCode];

    if (!definition) {
      fail(`Missing domain definition: ${domainCode}`);
    }

    assertRequiredString(definition.label, `${domainCode}.label`);
    assertRequiredString(
      definition.participant_display_label,
      `${domainCode}.participant_display_label`,
    );
    assertRequiredString(definition.display_direction, `${domainCode}.display_direction`);
    assertRequiredString(definition.definition, `${domainCode}.definition`);
    assertRequiredString(definition.display_rule, `${domainCode}.display_rule`);

    if (domainCode === "NEUROTICISM") {
      if (definition.display_direction !== "inverted_for_participant_domain_display") {
        fail("NEUROTICISM domain must use inverted_for_participant_domain_display");
      }
    } else if (definition.display_direction !== "direct") {
      fail(`${domainCode} domain must use direct display direction`);
    }
  }

  const facetDefinitions = Object.values(IPIP_NEO_120_FACET_DEFINITIONS_V2);

  if (facetDefinitions.length !== 30) {
    fail(`Expected 30 facet definitions, got ${facetDefinitions.length}`);
  }

  for (const domainCode of IPIP_NEO_120_DOMAIN_ORDER) {
    const expectedFacets = IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode];
    const actualFacets = facetDefinitions
      .filter((definition) => definition.domain_code === domainCode)
      .map((definition) => definition.code);

    assertSameArray(actualFacets, expectedFacets, `${domainCode} facet definitions`);

    if (actualFacets.length !== 6) {
      fail(`${domainCode}: expected exactly 6 facet definitions`);
    }

    for (const facetCode of expectedFacets) {
      const definition = IPIP_NEO_120_FACET_DEFINITIONS_V2[facetCode];

      if (!definition) {
        fail(`Missing facet definition: ${facetCode}`);
      }

      if (definition.domain_code !== domainCode) {
        fail(`${facetCode}: expected domain_code ${domainCode}, got ${definition.domain_code}`);
      }

      assertRequiredString(definition.domain_code, `${facetCode}.domain_code`);
      assertRequiredString(definition.label, `${facetCode}.label`);
      assertRequiredString(
        definition.participant_display_label,
        `${facetCode}.participant_display_label`,
      );
      assertRequiredString(definition.display_direction, `${facetCode}.display_direction`);
      assertRequiredString(definition.definition, `${facetCode}.definition`);

      if (domainCode === "NEUROTICISM") {
        if (definition.display_direction !== "direct_but_non_clinical") {
          fail(`${facetCode}: Neuroticism facets must use direct_but_non_clinical`);
        }
      } else if (definition.display_direction !== "direct") {
        fail(`${facetCode}: non-Neuroticism facets must use direct`);
      }
    }
  }

  for (const band of ["lower", "balanced", "higher"]) {
    const meaning = IPIP_NEO_120_BAND_MEANINGS_V2[band];

    if (!meaning) {
      fail(`Missing band meaning: ${band}`);
    }

    assertRequiredString(meaning.label, `${band}.label`);
    assertRequiredString(meaning.meaning, `${band}.meaning`);

    if (!Array.isArray(meaning.allowed_language) || meaning.allowed_language.length === 0) {
      fail(`${band}.allowed_language must be a non-empty array`);
    }

    if (!Array.isArray(meaning.forbidden_language) || meaning.forbidden_language.length === 0) {
      fail(`${band}.forbidden_language must be a non-empty array`);
    }
  }

  for (const budgetKey of [
    "summary.headline",
    "summary.overview",
    "key_patterns[].description",
    "domains[].summary",
    "subdimensions[].summary",
    "interpretation_note.text",
  ]) {
    if (!IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2[budgetKey]) {
      fail(`Missing text budget key: ${budgetKey}`);
    }
  }

  assertRequiredString(
    IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2.interpretation_note?.title,
    "static_text.interpretation_note.title",
  );
  assertRequiredString(
    IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2.interpretation_note?.text,
    "static_text.interpretation_note.text",
  );

  for (const term of [
    "uvijek",
    "nikad",
    "dijagnoza",
    "IQ",
    "preporučuje se zapošljavanje",
  ]) {
    if (!IPIP_NEO_120_PARTICIPANT_VOCABULARY_RULES_V2.global_forbidden_terms.includes(term)) {
      fail(`Missing global forbidden term: ${term}`);
    }
  }

  console.info("IPIP-NEO-120 participant AI input V2 verification passed");
}

main().catch((error) => {
  console.error("verify-ipip-neo-120-participant-ai-input-v2 failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
