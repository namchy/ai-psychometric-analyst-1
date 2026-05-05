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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  buildSafranParticipantReportDisplay,
} = require("../lib/assessment/safran-participant-report-display.ts");

function flattenDisplayTexts(display) {
  return [
    display.header.eyebrow,
    display.header.title,
    display.header.subtitle,
    ...display.sections.flatMap((section) => {
      switch (section.id) {
        case "summary":
          return [
            section.title,
            section.body,
            section.overall.label,
            section.overall.helper,
            section.overall.summary,
          ];
        case "domains":
          return [
            section.title,
            ...section.rows.flatMap((row) => [row.label, row.helper, row.summary]),
          ];
        case "signals":
          return [section.title, section.body, ...section.items];
        case "reading_guide":
        case "next_step":
          return [section.title, ...section.items];
        default:
          return [];
      }
    }),
  ].filter(Boolean);
}

const display = buildSafranParticipantReportDisplay({
  testName: "SAFRAN",
  scores: {
    verbal_score: 15,
    figural_score: 8,
    numerical_series_score: 6,
    cognitive_composite_v1: 29,
  },
});

assert.deepEqual(
  display.sections.map((section) => section.id),
  ["summary", "domains", "signals", "reading_guide", "next_step"],
);

const forbiddenPhrases = [
  "V1",
  "Ukupni kognitivni kompozit",
  "Rezultat ne znači",
  "IQ",
  "percentil",
  "iznadprosječan",
  "ispodprosječan",
  "hire",
  "no-hire",
];

for (const text of flattenDisplayTexts(display)) {
  for (const forbiddenPhrase of forbiddenPhrases) {
    assert.equal(
      text.toLowerCase().includes(forbiddenPhrase.toLowerCase()),
      false,
      `Display text unexpectedly contains "${forbiddenPhrase}": ${text}`,
    );
  }
}

const practiceMentions = display.sections.flatMap((section) => {
  if (section.id === "reading_guide") {
    return [];
  }

  return flattenDisplayTexts({ header: { eyebrow: "", title: "", subtitle: "" }, sections: [section] });
}).filter((text) => /practice/i.test(text));

assert.deepEqual(practiceMentions, []);
assert.equal(
  display.sections[3].items.some((item) => /practice/i.test(item)),
  true,
);

console.log("SAFRAN participant report display tests passed.");
