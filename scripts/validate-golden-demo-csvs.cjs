const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function installTypeScriptHook() {
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
}

function loaderFailure(error) {
  return {
    ok: false,
    errors: [
      {
        code: "loader_error",
        file: "fixtures/golden-demo/partner-plus/v1",
        message: error instanceof Error ? error.message : String(error),
      },
    ],
    warnings: [],
    summary: {
      candidateCount: 0,
      developmentCount: 0,
      holdoutCount: 0,
      teamCounts: {},
      answerCount: 0,
      expectedScoreCount: 0,
      expectedAiFindingCount: 0,
    },
  };
}

function main() {
  installTypeScriptHook();
  const projectRoot = path.resolve(__dirname, "..");
  const { loadGoldenDemoCsvFoundation, loadGoldenDemoRepoContract } = require(
    "../lib/golden-demo/csv-loader.ts",
  );
  const { validateGoldenDemoCsvFoundation } = require(
    "../lib/golden-demo/csv-validator.ts",
  );

  try {
    const foundation = loadGoldenDemoCsvFoundation(projectRoot);
    const repoContract = loadGoldenDemoRepoContract(projectRoot);
    const result = validateGoldenDemoCsvFoundation(foundation, repoContract);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify(loaderFailure(error), null, 2)}\n`);
    process.exitCode = 1;
  }
}

main();
