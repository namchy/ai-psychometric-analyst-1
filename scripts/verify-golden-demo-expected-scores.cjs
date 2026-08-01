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

function printUsage(message) {
  if (message) {
    process.stderr.write(`${message}\n`);
  }
  process.stderr.write(
    "Usage: node scripts/verify-golden-demo-expected-scores.cjs --candidate GD-002 --assessment ipip-neo-120-v1\n",
  );
  process.exitCode = 2;
}

function parseArguments(argv) {
  let candidateId = null;
  const assessments = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--candidate") {
      candidateId = argv[++index] ?? null;
    } else if (argument === "--assessment") {
      const assessment = argv[++index];
      if (assessment) assessments.push(assessment);
    } else if (argument === "--help" || argument === "-h") {
      printUsage();
      return null;
    } else {
      printUsage(`Unknown argument: ${argument}`);
      return null;
    }
  }

  if (!candidateId || assessments.length === 0) {
    printUsage("--candidate and at least one --assessment are required.");
    return null;
  }

  return { candidateId, assessments };
}

const parsed = parseArguments(process.argv.slice(2));
if (!parsed) {
  process.exitCode ??= 2;
} else {
  const projectRoot = path.resolve(__dirname, "..");
  const { loadGoldenDemoCsvFoundation } = require("../lib/golden-demo/csv-loader.ts");
  const { verifyGoldenDemoExpectedScores } = require(
    "../lib/golden-demo/offline-score-verifier.ts",
  );

  try {
    const foundation = loadGoldenDemoCsvFoundation(projectRoot);
    const result = verifyGoldenDemoExpectedScores({
      foundation,
      projectRoot,
      candidateId: parsed.candidateId,
      assessments: parsed.assessments,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    process.stderr.write(
      `Golden Demo expected-score verification failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    process.exitCode = 1;
  }
}
