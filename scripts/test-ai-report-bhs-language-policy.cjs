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
  canonicalizeGlobalBhsUserFacingOutput,
  validateGlobalBhsUserFacingOutput,
  buildGlobalBhsUserFacingPromptPolicyBlock,
} = require("../lib/assessment/ai-report-bhs-language-policy.ts");
const {
  resolveAiReportLanguagePolicy,
} = require("../lib/assessment/ai-report-language-policy.ts");

function main() {
  const promptPolicy = buildGlobalBhsUserFacingPromptPolicyBlock({
    audience: "hr",
    includeAuthorityOrder: true,
  });

  assert.equal(promptPolicy.includes("Global BHS user-facing language policy"), true);
  assert.equal(promptPolicy.includes("Bosnian language, ijekavica, Latin script"), true);
  assert.equal(promptPolicy.includes('Do not address the candidate with second-person singular forms such as "ti" in HR reports.'), true);
  assert.equal(promptPolicy.includes('"snapshot", "high", "low", "moderate", "overuse", "handling", "score", "band", "raw score", "schema", "JSON", "validator" and "prompt"'), true);
  assert.equal(promptPolicy.includes('"high" -> "visoko izraženo" or "u višem rasponu"'), true);
  assert.equal(promptPolicy.includes('Inside narrative sentences use lowercase forms: "savjesnost"'), true);

  const bsPolicy = resolveAiReportLanguagePolicy("bs");
  const hrPolicy = resolveAiReportLanguagePolicy("hr");
  const srPolicy = resolveAiReportLanguagePolicy("sr");
  const enPolicy = resolveAiReportLanguagePolicy("en");
  const unknownPolicy = resolveAiReportLanguagePolicy("unknown");
  const nullPolicy = resolveAiReportLanguagePolicy(null);

  assert.ok(bsPolicy);
  assert.equal(bsPolicy.key, "bhs_bs_user_facing");
  assert.equal(bsPolicy.locale, "bs");
  assert.equal(hrPolicy, null);
  assert.equal(srPolicy, null);
  assert.equal(enPolicy, null);
  assert.equal(unknownPolicy, null);
  assert.equal(nullPolicy, null);

  const aiLikeOutput = {
    headline: "Ovaj snapshot traži dodatnu provjeru.",
    executive_summary:
      "Profil pokazuje high signal i low rezervu. U ovom izvještaju visoka Savjesnost i umjerena Neuroticizam traže pažljivo čitanje.",
    key_hr_signals: [
      {
        title: "Overuse i handling",
        evidence: "moderate signal iz ovog snapshot nalaza.",
        hr_implication: "Ti treba da provjeriš kako se to vidi u radu.",
      },
    ],
    domain_overview: [
      {
        domain_name: "Savjesnost",
        score_label_or_band: "high",
        concise_meaning: "Ovo je high signal.",
      },
    ],
  };

  const canonicalized = canonicalizeGlobalBhsUserFacingOutput(aiLikeOutput);
  assert.equal(canonicalized.headline.includes("snapshot"), false);
  assert.equal(canonicalized.headline.includes("izvještaj"), true);
  assert.equal(canonicalized.executive_summary.includes("high"), false);
  assert.equal(canonicalized.executive_summary.includes("low"), false);
  assert.equal(canonicalized.executive_summary.includes("visoka savjesnost"), true);
  assert.equal(canonicalized.executive_summary.includes("umjerena neuroticizam"), true);
  assert.match(canonicalized.key_hr_signals[0].title, /prekomjerno oslanjanje/i);
  assert.match(canonicalized.key_hr_signals[0].title, /postupanje/i);
  assert.equal(canonicalized.domain_overview[0].score_label_or_band, "high");

  const blockedOutput = {
    headline: "Score band i raw score ostaju u schema JSON validator prompt tekstu.",
    executive_summary: "Ti treba da čitaš ovaj prompt kao finalnu odluku.",
  };
  const blockedErrors = validateGlobalBhsUserFacingOutput(blockedOutput, { audience: "hr" });
  assert.equal(blockedErrors.length >= 1, true);
  assert.equal(
    blockedErrors.some((error) => error.message.includes('"score"')),
    true,
  );
  assert.equal(
    blockedErrors.some((error) => error.message.includes('"band"')),
    true,
  );
  assert.equal(
    blockedErrors.some((error) => error.message.includes('"raw score"')),
    true,
  );
  assert.equal(
    blockedErrors.some((error) => error.message.includes('"schema"')),
    true,
  );
  assert.equal(
    blockedErrors.some((error) => error.message.includes('"JSON"')),
    true,
  );
  assert.equal(
    blockedErrors.some((error) => error.message.includes('"validator"')),
    true,
  );
  assert.equal(
    blockedErrors.some((error) => error.message.includes('"prompt"')),
    true,
  );
  assert.equal(
    blockedErrors.some((error) => error.message.includes('second-person singular')),
    true,
  );

  console.log("test-ai-report-bhs-language-policy: ok");
}

main();
