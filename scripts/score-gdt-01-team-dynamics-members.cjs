const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) return candidatePath;
  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;
    if (fs.existsSync(withExtension)) return withExtension;
  }
  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") return emptyModulePath;
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

const {
  parseGdt01MemberScoringCli,
  runGdt01MemberScoringOperator,
} = require("../lib/golden-demo/team-dynamics-gdt-01-scoring-operator.ts");
const {
  loadEnvFileIfPresent,
  redactInspectorError,
} = require("../lib/golden-demo/team-dynamics-gdt-01-db-inspector.ts");

function createSupabaseClient(env) {
  const { createClient } = require("@supabase/supabase-js");
  if (!env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  // Parse before env loading or client construction so invalid CLI input cannot touch DB.
  const cli = parseGdt01MemberScoringCli(process.argv.slice(2));
  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));
  const result = await runGdt01MemberScoringOperator({
    projectRoot,
    supabase: createSupabaseClient(process.env),
    cli,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.state === "UNSCORED_EXACT" || result.state === "SCORED_EXACT" ? 0 : 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${redactInspectorError(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  createSupabaseClient,
  parseGdt01MemberScoringCli,
  runGdt01MemberScoringOperator,
};
