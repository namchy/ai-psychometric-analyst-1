const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const TARGET_REPORT_ID = "898e895a-bd4b-4a3b-a15c-04ac0da4ee8c";
const TARGET_PARTICIPANT_ID = "9b742094-53dc-4de5-87a5-174c5491e4dd";
const TARGET_ASSESSMENT_ASSIGNMENT_ID = "16943547-ef84-4fc4-a3d2-11801b1f1869";
const TARGET_REPORT_TYPE = "individual_development_profile";
const TARGET_AUDIENCE = "hr";
const TARGET_SOURCE_TYPE = "assessment";
const CONFIRM_ENV = "CONFIRM_AMRA_IDP_REPROCESS";

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

function isExecutionConfirmed(env = process.env) {
  return env[CONFIRM_ENV]?.trim().toLowerCase() === "true";
}

function assertDevelopmentOnly(env = process.env) {
  if (env.NODE_ENV !== "development") {
    throw new Error("Amra IDP reprocess is dev-only and requires NODE_ENV=development.");
  }
}

function assertTargetGuards(target) {
  if (target.reportId !== TARGET_REPORT_ID) {
    throw new Error(`Unexpected assessment_report_id: ${target.reportId ?? "null"}`);
  }

  if (target.participantId !== TARGET_PARTICIPANT_ID) {
    throw new Error(`Unexpected participant_id: ${target.participantId ?? "null"}`);
  }

  if (target.assessmentAssignmentId !== TARGET_ASSESSMENT_ASSIGNMENT_ID) {
    throw new Error(
      `Unexpected assessment_assignment_id: ${target.assessmentAssignmentId ?? "null"}`,
    );
  }

  if (target.reportType !== TARGET_REPORT_TYPE) {
    throw new Error(`Unexpected report_type: ${target.reportType ?? "null"}`);
  }

  if (target.audience !== TARGET_AUDIENCE) {
    throw new Error(`Unexpected audience: ${target.audience ?? "null"}`);
  }

  if (target.sourceType !== TARGET_SOURCE_TYPE) {
    throw new Error(`Unexpected source_type: ${target.sourceType ?? "null"}`);
  }

  if (target.reportStatus === "processing") {
    throw new Error("Target report is already processing and cannot be reprocessed.");
  }

  if (!["ready", "failed", "queued"].includes(target.reportStatus)) {
    throw new Error(
      `Unsupported target report status: ${target.reportStatus ?? "null"}`,
    );
  }

  if (typeof target.organizationId !== "string" || target.organizationId.length === 0) {
    throw new Error("Target organization_id is missing.");
  }
}

async function loadTargetReport() {
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("assessment_reports")
    .select(
      "id, organization_id, participant_id, assessment_assignment_id, report_type, audience, source_type, report_status",
    )
    .eq("id", TARGET_REPORT_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load target IDP assessment_report: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Target IDP assessment_report ${TARGET_REPORT_ID} was not found.`);
  }

  return {
    reportId: data.id,
    organizationId: data.organization_id,
    participantId: data.participant_id,
    assessmentAssignmentId: data.assessment_assignment_id,
    reportType: data.report_type,
    audience: data.audience,
    sourceType: data.source_type,
    reportStatus: data.report_status,
  };
}

async function resetTargetReadyReportToQueued(target) {
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const supabase = createSupabaseAdminClient();
  const queuedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("assessment_reports")
    .update({
      report_status: "queued",
      queued_at: queuedAt,
      started_at: null,
      completed_at: null,
      generated_at: null,
      failure_code: null,
      failure_reason: null,
    })
    .eq("id", TARGET_REPORT_ID)
    .eq("organization_id", target.organizationId)
    .eq("participant_id", TARGET_PARTICIPANT_ID)
    .eq("assessment_assignment_id", TARGET_ASSESSMENT_ASSIGNMENT_ID)
    .eq("report_type", TARGET_REPORT_TYPE)
    .eq("audience", TARGET_AUDIENCE)
    .eq("source_type", TARGET_SOURCE_TYPE)
    .eq("report_status", "ready")
    .select(
      "id, organization_id, participant_id, assessment_assignment_id, report_type, audience, source_type, report_status",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to reset target IDP assessment_report: ${error.message}`);
  }

  if (!data) {
    throw new Error("Target IDP report was not reset because a target guard or ready-state check failed.");
  }

  return {
    reportId: data.id,
    organizationId: data.organization_id,
    participantId: data.participant_id,
    assessmentAssignmentId: data.assessment_assignment_id,
    reportType: data.report_type,
    audience: data.audience,
    sourceType: data.source_type,
    reportStatus: data.report_status,
  };
}

async function resetTargetFailedReportToQueued(target) {
  const {
    resetIndividualDevelopmentProfileAssessmentReportToQueued,
  } = require("../lib/assessment/individual-development-profile-lifecycle.ts");
  const result = await resetIndividualDevelopmentProfileAssessmentReportToQueued({
    assessmentReportId: TARGET_REPORT_ID,
    organizationId: target.organizationId,
    participantId: TARGET_PARTICIPANT_ID,
  });

  if (!result.ok) {
    throw new Error(
      `Failed target retry reset was rejected (${result.reason}): ${result.details}`,
    );
  }

  if (result.action !== "reset_to_queued" || !result.report) {
    throw new Error(`Failed target was not reset to queued: ${result.action}`);
  }

  return {
    reportId: result.report.id,
    organizationId: result.report.organization_id,
    participantId: result.report.participant_id,
    assessmentAssignmentId: result.report.assessment_assignment_id,
    reportType: result.report.report_type,
    audience: result.report.audience,
    sourceType: result.report.source_type,
    reportStatus: result.report.report_status,
  };
}

async function loadFinalStatus() {
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("assessment_reports")
    .select("id, report_status, failure_code, failure_reason, generator_type, model_name")
    .eq("id", TARGET_REPORT_ID)
    .eq("participant_id", TARGET_PARTICIPANT_ID)
    .eq("assessment_assignment_id", TARGET_ASSESSMENT_ASSIGNMENT_ID)
    .eq("report_type", TARGET_REPORT_TYPE)
    .eq("audience", TARGET_AUDIENCE)
    .eq("source_type", TARGET_SOURCE_TYPE)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Failed to inspect final IDP assessment_report: ${error?.message ?? "Target row missing."}`,
    );
  }

  return {
    reportId: data.id,
    reportStatus: data.report_status,
    failureCode: data.failure_code,
    failureReason: data.failure_reason,
    generatorType: data.generator_type,
    modelName: data.model_name,
  };
}

async function runControlledReprocess(options = {}) {
  const env = options.env ?? process.env;
  const deps = {
    loadTargetReport: options.loadTargetReport ?? loadTargetReport,
    resetTargetReadyReportToQueued:
      options.resetTargetReadyReportToQueued ?? resetTargetReadyReportToQueued,
    resetTargetFailedReportToQueued:
      options.resetTargetFailedReportToQueued ?? resetTargetFailedReportToQueued,
    processReport:
      options.processReport ??
      (async (...args) => {
        const {
          processIndividualDevelopmentProfileAssessmentReport,
        } = require("../lib/assessment/individual-development-profile-processor.ts");
        return await processIndividualDevelopmentProfileAssessmentReport(...args);
      }),
    loadFinalStatus: options.loadFinalStatus ?? loadFinalStatus,
  };

  assertDevelopmentOnly(env);
  const target = await deps.loadTargetReport();
  assertTargetGuards(target);

  const result = {
    target,
    execution: null,
  };

  if (!isExecutionConfirmed(env)) {
    return result;
  }

  let queueAction;
  let queued;

  if (target.reportStatus === "ready") {
    queueAction = "reset_ready_to_queued";
    queued = await deps.resetTargetReadyReportToQueued(target);
  } else if (target.reportStatus === "failed") {
    queueAction = "retry_failed_to_queued";
    queued = await deps.resetTargetFailedReportToQueued(target);
  } else {
    queueAction = "already_queued";
    queued = target;
  }

  if (
    queued.reportId !== TARGET_REPORT_ID ||
    queued.reportStatus !== "queued" ||
    queued.participantId !== TARGET_PARTICIPANT_ID ||
    queued.assessmentAssignmentId !== TARGET_ASSESSMENT_ASSIGNMENT_ID
  ) {
    throw new Error(`Unexpected target reset result: ${JSON.stringify(queued)}`);
  }

  const processorResult = await deps.processReport({
    assessmentReportId: TARGET_REPORT_ID,
    organizationId: target.organizationId,
    participantId: TARGET_PARTICIPANT_ID,
  });
  const finalStatus = await deps.loadFinalStatus();

  if (processorResult.ok && finalStatus.reportStatus !== "ready") {
    throw new Error(`Processor returned ready but final report status is ${finalStatus.reportStatus}.`);
  }

  if (!processorResult.ok && finalStatus.reportStatus === "ready") {
    throw new Error("Processor failed but the target report unexpectedly became ready.");
  }

  result.execution = {
    queueAction,
    queued,
    processorResult,
    finalStatus,
    failure_code: finalStatus.failureCode ?? null,
    failure_reason: finalStatus.failureReason ?? null,
  };

  return result;
}

async function main() {
  const result = await runControlledReprocess();
  console.log(JSON.stringify(result, null, 2));

  if (result.execution && !result.execution.processorResult.ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  TARGET_REPORT_ID,
  TARGET_PARTICIPANT_ID,
  TARGET_ASSESSMENT_ASSIGNMENT_ID,
  TARGET_REPORT_TYPE,
  TARGET_AUDIENCE,
  TARGET_SOURCE_TYPE,
  CONFIRM_ENV,
  isExecutionConfirmed,
  assertDevelopmentOnly,
  assertTargetGuards,
  runControlledReprocess,
};
