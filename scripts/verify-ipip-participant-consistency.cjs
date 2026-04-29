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

async function main() {
  const {
    buildParticipantIpipProfileOverview,
  } = require("../lib/assessment/ipip-participant-report-display.ts");

  const report = {
    contract_version: "ipip_neo_120_participant_v1",
    test: {
      slug: "ipip-neo-120-v1",
      name: "IPIP-NEO-120",
      locale: "bs",
    },
    meta: {
      report_type: "participant",
      generated_at: new Date().toISOString(),
      scale_hint: {
        min: 1,
        max: 5,
        display_mode: "visual_with_discreet_numeric_support",
      },
    },
    summary: {
      headline: "Test headline",
      overview: "Ekstraverzija i Otvorenost prema iskustvu su ti u srednjem rasponu.",
    },
    dominant_signals: ["a", "b", "c", "d", "e"],
    domains: [
      {
        domain_code: "EXTRAVERSION",
        label: "Ekstraverzija",
        score: 3.2,
        band: "balanced",
        summary: "",
        strengths: ["", ""],
        watchouts: ["", ""],
        development_tip: "",
        subdimensions: [],
      },
      {
        domain_code: "AGREEABLENESS",
        label: "Ugodnost",
        score: 3.6,
        band: "higher",
        summary: "",
        strengths: ["", ""],
        watchouts: ["", ""],
        development_tip: "",
        subdimensions: [],
      },
      {
        domain_code: "CONSCIENTIOUSNESS",
        label: "Savjesnost",
        score: 4.4,
        band: "higher",
        summary: "",
        strengths: ["", ""],
        watchouts: ["", ""],
        development_tip: "",
        subdimensions: [],
      },
      {
        domain_code: "NEUROTICISM",
        label: "Neuroticizam",
        score: 3.0,
        band: "balanced",
        summary: "",
        strengths: ["", ""],
        watchouts: ["", ""],
        development_tip: "",
        subdimensions: [],
      },
      {
        domain_code: "OPENNESS_TO_EXPERIENCE",
        label: "Otvorenost prema iskustvu",
        score: 3.1,
        band: "balanced",
        summary: "",
        strengths: ["", ""],
        watchouts: ["", ""],
        development_tip: "",
        subdimensions: [],
      },
    ],
    strengths: ["a", "b", "c"],
    watchouts: ["a", "b", "c"],
    development_recommendations: ["a", "b", "c"],
    interpretation_note: "",
  };

  const overview = buildParticipantIpipProfileOverview(report);
  const combinedText = [
    ...overview.badges.map((badge) => badge.text),
    ...overview.patterns.map((pattern) => pattern.body),
  ].join(" ");

  const forbiddenPhrases = [
    "Visoka energija",
    "vrlo visoke Ekstraverzije",
    "vrlo visoka Ekstraverzija",
    "visoke Ekstraverzije",
    "visoka Ekstraverzija",
  ];

  for (const phrase of forbiddenPhrases) {
    if (combinedText.includes(phrase)) {
      fail(`Found forbidden contradictory phrase: ${phrase}`);
    }
  }

  if (!combinedText.includes("uravnotežene Ekstraverzije")) {
    fail("Expected canonical balanced Extraversion wording to be present.");
  }

  console.info("IPIP participant consistency verification passed");
}

main().catch((error) => {
  console.error("verify-ipip-participant-consistency failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
