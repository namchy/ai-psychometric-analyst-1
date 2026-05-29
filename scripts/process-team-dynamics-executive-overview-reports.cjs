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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  processQueuedTeamDynamicsExecutiveOverviewReports,
} = require("../lib/b2b/team-dynamics-report-worker.ts");

function parseBooleanFlag(value) {
  if (typeof value !== "string") {
    return false;
  }

  return /^(1|true|yes)$/i.test(value.trim());
}

function parseLimitValue(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readCliOptions(argv) {
  const options = {
    dryRun: false,
    limit: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (argument.startsWith("--limit=")) {
      options.limit = parseLimitValue(argument.slice("--limit=".length));
      continue;
    }

    if (argument === "--limit") {
      options.limit = parseLimitValue(argv[index + 1]);
      index += 1;
    }
  }

  return options;
}

async function main() {
  const cliOptions = readCliOptions(process.argv.slice(2));
  const envDryRun = parseBooleanFlag(process.env.TEAM_DYNAMICS_REPORT_WORKER_DRY_RUN ?? "");
  const envLimit = parseLimitValue(process.env.TEAM_DYNAMICS_REPORT_WORKER_LIMIT);
  const dryRun = cliOptions.dryRun || envDryRun;
  const limit = cliOptions.limit ?? envLimit;

  console.info("Team Dynamics Executive Overview worker started", {
    dryRun,
    requestedLimit: limit ?? null,
  });

  const result = await processQueuedTeamDynamicsExecutiveOverviewReports({
    dryRun,
    limit,
  });

  if (result.dryRun) {
    console.info("Team Dynamics Executive Overview worker dry-run summary", {
      requestedLimit: result.requestedLimit,
      appliedLimit: result.appliedLimit,
      eligibleCount: result.eligibleCount,
      wouldProcessCount: result.wouldProcessCount,
      eligibleReports: result.eligibleReports.map((report) => ({
        id: report.id,
        organizationId: report.organizationId,
        teamId: report.teamId,
        queuedAt: report.queuedAt,
      })),
    });
    return;
  }

  console.info("Team Dynamics Executive Overview worker finished", {
    requestedLimit: result.requestedLimit,
    appliedLimit: result.appliedLimit,
    eligibleCount: result.eligibleCount,
    processedCount: result.processedCount,
    summary: result.summary,
    results: result.results,
  });
}

main().catch((error) => {
  console.error("Team Dynamics Executive Overview worker crashed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
