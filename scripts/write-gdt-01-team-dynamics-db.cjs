const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
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

const { loadGdt01DbContract, classifyGdt01DbState } = require("../lib/golden-demo/team-dynamics-gdt-01-db-contract.ts");
const {
  createGdt01SupabaseReadRepository,
  loadEnvFileIfPresent,
  requireEnvironment,
  redactInspectorError,
} = require("../lib/golden-demo/team-dynamics-gdt-01-db-inspector.ts");
const {
  buildGdt01WriterPlan,
  executeGdt01WriterApply,
  GDT_01_TEAM_DYNAMICS_WRITER_CONFIRMATION,
} = require("../lib/golden-demo/team-dynamics-gdt-01-writer.ts");

const ALLOWED_FLAGS = new Set(["--json", "--verbose", "--apply", "--confirm"]);

function parseCli(argv = process.argv.slice(2)) {
  const parsed = { apply: false, json: false, verbose: false, confirmation: null };
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!ALLOWED_FLAGS.has(argument)) {
      throw new Error(`${argument} is not supported.`);
    }
    if (seen.has(argument)) {
      throw new Error(`${argument} may be supplied only once.`);
    }
    seen.add(argument);

    if (argument === "--apply") parsed.apply = true;
    if (argument === "--json") parsed.json = true;
    if (argument === "--verbose") parsed.verbose = true;
    if (argument === "--confirm") {
      const confirmation = argv[index + 1];
      if (!confirmation || confirmation.startsWith("--")) {
        throw new Error("--confirm requires a non-empty confirmation value.");
      }
      parsed.confirmation = confirmation;
      index += 1;
    }
  }

  if (parsed.apply && parsed.confirmation !== GDT_01_TEAM_DYNAMICS_WRITER_CONFIRMATION) {
    throw new Error(`--apply requires --confirm ${GDT_01_TEAM_DYNAMICS_WRITER_CONFIRMATION}; no RPC was attempted.`);
  }
  if (!parsed.apply && parsed.confirmation !== null) {
    throw new Error("--confirm is valid only with --apply; no RPC was attempted.");
  }
  return parsed;
}

function printSummary(result, plan, cli, execution, output = process.stdout) {
  output.write(
    `GDT-01 state: ${result.state}\nOrganization/team/test: ${plan.payload.organization_name} / ${plan.payload.team_id} / ${plan.payload.package_slug}\nMembers: ${plan.payload.members.map((member) => member.candidate_id).join(", ")}\nExpected rows: 1 assignment, 6 wrappers, 6 attempts, 288 responses, 72 physical selections, 324 logical selections\nRuntime contract checksum: ${plan.payload.runtime_contract_checksum}\nRPC allowed: ${plan.rpcAllowed ? "yes" : "no"}\nNo-op eligible: ${plan.noOpEligible ? "yes" : "no"}\nApply requested: ${cli.apply ? "yes" : "no"}\nWould call RPC: ${cli.apply && plan.rpcAllowed ? "yes" : "no"}\n`,
  );
  if (cli.verbose || result.blockingFindings.length) {
    for (const finding of result.blockingFindings) output.write(`  - ${finding.code}: ${finding.message}\n`);
  }
  if (!execution?.rpcCalled) output.write("Safety: read-only preflight; no RPC or write.\n");
}

function createSupabaseClient(env) {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    requireEnvironment("NEXT_PUBLIC_SUPABASE_URL", env),
    requireEnvironment("SUPABASE_SERVICE_ROLE_KEY", env),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function runWriter({
  argv = process.argv.slice(2),
  env = process.env,
  supabase,
  clientFactory = createSupabaseClient,
  contractLoader = () => loadGdt01DbContract(projectRoot),
  inspectState,
  classifier = classifyGdt01DbState,
  output = process.stdout,
} = {}) {
  // Parsing and confirmation validation happen before client construction.
  const cli = parseCli(argv);
  const client = supabase ?? clientFactory(env);
  const contract = contractLoader();
  const observed = inspectState
    ? await inspectState(client, contract)
    : await createGdt01SupabaseReadRepository(client, contract).readState();
  const result = classifier(contract, observed);
  const plan = buildGdt01WriterPlan({ contract, observed, inspection: result });
  const execution = await executeGdt01WriterApply({
    explicitApply: cli.apply,
    contract,
    inspection: result,
    rpcClient: client,
  });

  if (cli.json) {
    output.write(`${JSON.stringify({ result, plan, applyRequested: cli.apply, wouldCallRpc: cli.apply && plan.rpcAllowed, execution }, null, 2)}\n`);
  } else {
    printSummary(result, plan, cli, execution, output);
  }
  return { result, plan, execution, cli };
}

function exitCodeForWriterResult(output) {
  return output.result.state === "PARTIAL" || output.result.state === "CONFLICT" ? 1 : 0;
}

async function main() {
  try {
    // Parse first so invalid input never reads config or constructs a client.
    parseCli();
    loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));
    const output = await runWriter({ argv: process.argv.slice(2) });
    process.exitCode = exitCodeForWriterResult(output);
  } catch (error) {
    process.stderr.write(`${redactInspectorError(error)}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  parseCli,
  printSummary,
  runWriter,
  createSupabaseClient,
  exitCodeForWriterResult,
  ALLOWED_FLAGS,
};
