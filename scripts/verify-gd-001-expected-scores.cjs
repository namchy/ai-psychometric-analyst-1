const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const projectRoot = path.resolve(__dirname, "..");
const { loadGoldenDemoCsvFoundation } = require("../lib/golden-demo/csv-loader.ts");
const { verifyGd001ExpectedScores } = require(
  "../lib/golden-demo/offline-score-verifier.ts",
);

try {
  const foundation = loadGoldenDemoCsvFoundation(projectRoot);
  const result = verifyGd001ExpectedScores({ foundation, projectRoot });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  process.stderr.write(
    `GD-001 offline score verification failed: ${
      error instanceof Error ? error.message : String(error)
    }\n`,
  );
  process.exitCode = 1;
}
