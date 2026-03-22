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

function parseCliOptions(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--attempt-id") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error("Missing value for --attempt-id.");
      }

      options.attemptId = value;
      index += 1;
      continue;
    }

    if (argument.startsWith("--attempt-id=")) {
      options.attemptId = argument.slice("--attempt-id=".length);
      continue;
    }

    if (argument === "--audience") {
      const value = argv[index + 1];

      if (value !== "participant" && value !== "hr") {
        throw new Error("Audience must be either 'participant' or 'hr'.");
      }

      options.audience = value;
      index += 1;
      continue;
    }

    if (argument.startsWith("--audience=")) {
      const value = argument.slice("--audience=".length);

      if (value !== "participant" && value !== "hr") {
        throw new Error("Audience must be either 'participant' or 'hr'.");
      }

      options.audience = value;
    }
  }

  return options;
}

async function main() {
  const { claimNextReportJob, processClaimedReportJob } = require("../lib/assessment/report-job-worker.ts");
  const options = parseCliOptions(process.argv.slice(2));
  let processedJobCount = 0;

  console.info("Report worker started", {
    attemptId: options.attemptId ?? null,
    audience: options.audience ?? null,
  });

  for (;;) {
    console.info("Report worker claim attempt started", {
      attemptId: options.attemptId ?? null,
      audience: options.audience ?? null,
    });

    const job = await claimNextReportJob(options);

    if (!job) {
      console.info("No queued report job found", {
        attemptId: options.attemptId ?? null,
        audience: options.audience ?? null,
        processedJobCount,
      });
      return;
    }

    console.info("Claimed report job", {
      reportId: job.id,
      attemptId: job.attempt_id,
      audience: job.audience,
      reportType: job.report_type,
      sourceType: job.source_type,
    });

    const result = await processClaimedReportJob(job);
    processedJobCount += 1;

    console.info("Report job finished", {
      ...result,
      processedJobCount,
    });
  }
}

main().catch((error) => {
  console.error("Report worker crashed before terminal completion", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
