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

const { loadGoldenDemoFoundationContract } = require("../lib/golden-demo/golden-demo-foundation-contract.ts");
const {
  createGoldenDemoFoundationSupabaseReadRepository,
} = require("../lib/golden-demo/golden-demo-foundation-inspector.ts");
const {
  buildGoldenDemoFoundationWritePlan,
  executeGoldenDemoFoundationApply,
  GOLDEN_DEMO_FOUNDATION_CONFIRMATION,
  GOLDEN_DEMO_FOUNDATION_RPC,
} = require("../lib/golden-demo/golden-demo-foundation-writer.ts");
const {
  classifyGoldenDemoFoundation,
} = require("../lib/golden-demo/golden-demo-foundation-contract.ts");
const {
  loadEnvFileIfPresent,
  requireEnvironment,
  redactInspectorError,
} = require("../lib/golden-demo/team-dynamics-gdt-01-db-inspector.ts");

const ALLOWED_FLAGS = new Set(["--json", "--verbose", "--apply", "--confirm"]);

function parseCli(argv = process.argv.slice(2)) {
  let json = false;
  let verbose = false;
  let apply = false;
  let confirmation = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!ALLOWED_FLAGS.has(argument)) {
      throw new Error(
        `${argument} is not supported; use only --json, --verbose, --apply and --confirm ${GOLDEN_DEMO_FOUNDATION_CONFIRMATION}.`,
      );
    }
    if (argument === "--json") json = true;
    if (argument === "--verbose") verbose = true;
    if (argument === "--apply") apply = true;
    if (argument === "--confirm") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`--confirm requires ${GOLDEN_DEMO_FOUNDATION_CONFIRMATION}.`);
      }
      confirmation = value;
      index += 1;
    }
  }

  if (confirmation !== null && confirmation !== GOLDEN_DEMO_FOUNDATION_CONFIRMATION) {
    throw new Error(`Invalid confirmation; expected ${GOLDEN_DEMO_FOUNDATION_CONFIRMATION}.`);
  }
  if (apply && confirmation !== GOLDEN_DEMO_FOUNDATION_CONFIRMATION) {
    throw new Error(
      `--apply requires --confirm ${GOLDEN_DEMO_FOUNDATION_CONFIRMATION}; no write was attempted.`,
    );
  }
  if (!apply && confirmation !== null) {
    throw new Error("--confirm is valid only together with --apply; no write was attempted.");
  }

  return { json, verbose, apply, confirmation };
}

function printSummary(result, plan, verbose, applied) {
  process.stdout.write(`Golden Demo foundation state: ${result.state}\n`);
  process.stdout.write(`RPC allowed by plan: ${plan.rpcAllowed ? "yes" : "no"}\n`);
  process.stdout.write(`Participants to create: ${plan.counts.participantsToCreate}\n`);
  process.stdout.write(`Teams to create: ${plan.counts.teamsToCreate}\n`);
  process.stdout.write(`Memberships to create: ${plan.counts.membershipsToCreate}\n`);
  process.stdout.write(`Postcondition: ${plan.postcondition}\n`);
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
  process.stdout.write(
    applied
      ? "Safety: RPC apply was explicitly confirmed; scope is foundation-only and post-write inspection is required.\n"
      : "Safety: read-only preflight; no writes or RPC.\n",
  );
}

async function runWriter({ argv = process.argv.slice(2), env = process.env, supabase } = {}) {
  const cli = parseCli(argv);
  const client = supabase ?? createSupabaseClient(env);
  const contract = loadGoldenDemoFoundationContract(projectRoot);
  const repository = createGoldenDemoFoundationSupabaseReadRepository(client);
  const observed = await repository.readState();
  const result = classifyGoldenDemoFoundation(contract, observed);
  const plan = buildGoldenDemoFoundationWritePlan({ contract, observed, inspection: result });

  if (!cli.apply) {
    if (cli.json) process.stdout.write(`${JSON.stringify({ result, plan }, null, 2)}\n`);
    else printSummary(result, plan, cli.verbose, false);
    return { result, plan, applied: false };
  }

  const execution = await executeGoldenDemoFoundationApply({
    plan,
    rpcClient: client,
    inspectAfterWrite: async () => {
      const postObserved = await repository.readState();
      return classifyGoldenDemoFoundation(contract, postObserved);
    },
  });
  const postResult = execution.postWriteInspection ?? result;
  if (cli.json) process.stdout.write(`${JSON.stringify({ result, plan, execution, postResult }, null, 2)}\n`);
  else printSummary(postResult, plan, cli.verbose, execution.rpcCalled);
  return { result, plan, execution, postResult, applied: execution.rpcCalled };
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
    const output = await runWriter({ argv: process.argv.slice(2) });
    const state = output.postResult?.state ?? output.result.state;
    process.exitCode = state === "PARTIAL" || state === "CONFLICT" ? 1 : 0;
  } catch (error) {
    process.stderr.write(`${redactInspectorError(error)}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  ALLOWED_FLAGS,
  createSupabaseClient,
  main,
  parseCli,
  printSummary,
  runWriter,
  GOLDEN_DEMO_FOUNDATION_RPC,
};
