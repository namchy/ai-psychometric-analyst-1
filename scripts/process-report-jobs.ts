import { claimNextReportJob, processClaimedReportJob } from "../lib/assessment/report-job-worker";

type ReportJobAudience = "participant" | "hr";

type CliOptions = {
  attemptId?: string;
  audience?: ReportJobAudience;
};

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {};

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
      continue;
    }
  }

  return options;
}

async function main(): Promise<void> {
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
