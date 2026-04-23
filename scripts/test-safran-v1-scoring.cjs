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
  buildSafranV1CompositeScores,
  normalizeSafranNumericAnswer,
  scoreSafranNumericAnswer,
  scoreSafranSingleChoiceAnswer,
} = require("../lib/assessment/scoring.ts");

assert.equal(normalizeSafranNumericAnswer("4,5"), "4.5");
assert.equal(scoreSafranNumericAnswer("4,5", "4.5"), 1);
assert.equal(scoreSafranSingleChoiceAnswer(true), 1);
assert.equal(scoreSafranSingleChoiceAnswer(false), 0);
assert.deepEqual(
  buildSafranV1CompositeScores({
    VW: 2,
    VA: 3,
    FA: 4,
    FM: 5,
    NZ: 6,
  }),
  {
    verbalScore: 5,
    figuralScore: 9,
    numericalSeriesScore: 6,
    cognitiveCompositeV1: 20,
  },
);

console.log("SAFRAN V1 scoring tests passed.");
