const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

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

const {
  loadGoldenDemoFoundationContract,
} = require("../lib/golden-demo/golden-demo-foundation-contract.ts");
const {
  createGoldenDemoFoundationSupabaseReadRepository,
  inspectGoldenDemoFoundation,
} = require("../lib/golden-demo/golden-demo-foundation-inspector.ts");
const {
  loadEnvFileIfPresent,
  requireEnvironment,
  redactInspectorError,
} = require("../lib/golden-demo/team-dynamics-gdt-01-db-inspector.ts");

const ALLOWED_FLAGS = new Set(["--json", "--verbose"]);

function parseCli(argv = process.argv.slice(2)) {
  for (const argument of argv) {
    if (!ALLOWED_FLAGS.has(argument)) {
      throw new Error(
        `${argument} is not supported; this foundation inspector is SELECT-only and has no write mode.`,
      );
    }
  }
  return {
    json: argv.includes("--json"),
    verbose: argv.includes("--verbose"),
  };
}

function printSummary(result, verbose) {
  process.stdout.write(`Golden Demo foundation state: ${result.state}\n`);
  process.stdout.write(`Create eligible: ${result.createEligible ? "yes" : "no"}\n`);
  process.stdout.write(`No-op eligible: ${result.noOpEligible ? "yes" : "no"}\n`);
  process.stdout.write(`Manual review required: ${result.manualReviewRequired ? "yes" : "no"}\n`);
  process.stdout.write(
    `Participants: ${result.counts.participantsObserved}/${result.counts.participantsExpected}\n`,
  );
  process.stdout.write(`Teams: ${result.counts.teamsObserved}/${result.counts.teamsExpected}\n`);
  process.stdout.write(
    `Memberships: ${result.counts.membershipsObserved}/${result.counts.membershipsExpected}\n`,
  );
  if (verbose || result.blockingFindings.length > 0) {
    process.stdout.write("Blocking findings:\n");
    for (const finding of result.blockingFindings) {
      process.stdout.write(`  - ${finding.code}: ${finding.message}\n`);
    }
  }
  if (verbose || result.diagnosticFindings.length > 0) {
    process.stdout.write("Diagnostic findings:\n");
    for (const finding of result.diagnosticFindings) {
      process.stdout.write(`  - ${finding.code}: ${finding.message}\n`);
    }
  }
  process.stdout.write("Safety: read-only; no writes or RPC.\n");
}

async function runInspector({ argv = process.argv.slice(2), env = process.env, supabase } = {}) {
  const cli = parseCli(argv);
  const client = supabase ?? createSupabaseClient(env);
  const contract = loadGoldenDemoFoundationContract(projectRoot);
  const result = await inspectGoldenDemoFoundation({
    contract,
    repository: createGoldenDemoFoundationSupabaseReadRepository(client),
  });
  if (cli.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else printSummary(result, cli.verbose);
  return result;
}

function createSupabaseClient(env) {
  const { createClient } = require("@supabase/supabase-js");
  const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL", env);
  const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY", env);
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  try {
    parseCli();
    loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));
    const result = await runInspector();
    process.exitCode = result.state === "PARTIAL" || result.state === "CONFLICT" ? 1 : 0;
  } catch (error) {
    process.stderr.write(`${redactInspectorError(error)}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  parseCli,
  printSummary,
  runInspector,
  createSupabaseClient,
};
