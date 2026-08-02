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

function installTypeScriptRuntime() {
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

  require.extensions[".ts"] = function compileTypeScript(module, filename) {
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
      fileName: filename,
    });
    module._compile(output.outputText, filename);
  };
}

installTypeScriptRuntime();

const {
  GOLDEN_DEMO_CANDIDATE_IDS,
  getGoldenDemoCandidateContract,
} = require("../lib/golden-demo/db-fixture-writer.ts");
const {
  buildGoldenDemoReportPackagePlan,
  classifyGoldenDemoReportPackage,
  executeGoldenDemoReportPackageApply,
} = require("../lib/golden-demo/individual-report-package-operator.ts");
const {
  loadGoldenDemoCsvFoundation,
  loadGoldenDemoRepoContract,
} = require("../lib/golden-demo/csv-loader.ts");
const { validateGoldenDemoCsvFoundation } = require("../lib/golden-demo/csv-validator.ts");

const DESTRUCTIVE_FLAGS = new Set([
  "--delete",
  "--cleanup",
  "--reset",
  "--retry",
  "--force",
  "--overwrite",
  "--regenerate",
  "--parallel",
]);

function parseCli(argv = []) {
  let candidateId = null;
  let mode = null;
  let verbose = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (DESTRUCTIVE_FLAGS.has(argument)) {
      throw new Error(`${argument} is forbidden; use a separate operator task.`);
    }
    if (argument === "--verbose") {
      verbose = true;
      continue;
    }
    if (argument === "--dry-run" || argument === "--apply") {
      const nextMode = argument === "--apply" ? "apply" : "dry-run";
      if (mode && mode !== nextMode) {
        throw new Error("--dry-run and --apply cannot be combined.");
      }
      mode = nextMode;
      continue;
    }
    if (argument === "--candidate" || argument.startsWith("--candidate=")) {
      const value = argument === "--candidate" ? argv[index + 1] : argument.slice("--candidate=".length);
      if (argument === "--candidate") index += 1;
      if (!value || value.startsWith("--")) {
        throw new Error("--candidate requires an explicit canonical candidate ID.");
      }
      if (candidateId && candidateId !== value) {
        throw new Error("--candidate may be provided only once.");
      }
      candidateId = value;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!candidateId) throw new Error("An explicit --candidate is required.");
  if (!GOLDEN_DEMO_CANDIDATE_IDS.includes(candidateId)) {
    throw new Error(`Only ${GOLDEN_DEMO_CANDIDATE_IDS.join(", ")} are supported by the canonical Golden Demo candidate contract.`);
  }

  return { mode: mode ?? "dry-run", candidateId, verbose };
}

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const name = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Missing required environment variable: ${name}`);
  return value.trim();
}

function validationSummary(result) {
  if (result && result.ok === true) return { ok: true, errors: [] };
  const errors = result && Array.isArray(result.errors) ? result.errors : ["Validator rejected the report snapshot."];
  return { ok: false, errors: errors.map((error) => typeof error === "string" ? error : String(error.message ?? error)) };
}

function validateReadySnapshot(row) {
  if (row.reportStatus !== "ready") return null;
  try {
    if (row.testSlug === "ipip-neo-120-v1") {
      const { validateIpipNeo120HrReportV1 } = require("../lib/assessment/ipip-neo-120-report-v1.ts");
      return validationSummary(validateIpipNeo120HrReportV1(row.reportSnapshot, {
        strictContract: true,
        enforceGuardrails: false,
        ...(row.inputSnapshot ? { expectedInput: row.inputSnapshot } : {}),
      }));
    }
    if (row.testSlug === "safran_v1") {
      const { validateSafranHrReport } = require("../lib/assessment/safran-hr-report-v1.ts");
      return validationSummary(validateSafranHrReport(row.reportSnapshot, {
        ...(row.inputSnapshot ? { expectedInput: row.inputSnapshot } : {}),
        enforceProseGuardrails: false,
      }));
    }
    if (row.testSlug === "mwms_v1") {
      const { validateMwmsHrReportV1 } = require("../lib/assessment/mwms-hr-report-v1.ts");
      return validationSummary(validateMwmsHrReportV1(row.reportSnapshot, {
        ...(row.inputSnapshot ? { expectedInput: row.inputSnapshot } : {}),
        enforceProseGuardrails: false,
      }));
    }
    if (row.reportType === "composite") {
      const { validateCompositeHrReportSnapshot } = require("../lib/assessment/composite-hr-report-contract.ts");
      return validationSummary(validateCompositeHrReportSnapshot(row.reportSnapshot));
    }
    const { validateIndividualDevelopmentProfileSnapshot } = require("../lib/assessment/individual-development-profile-contract.ts");
    return validationSummary(validateIndividualDevelopmentProfileSnapshot(row.reportSnapshot));
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

function mapAttemptReportRow(row) {
  const mapped = {
    id: row.id,
    attemptId: row.attempt_id,
    testSlug: row.test_slug,
    reportType: row.report_type,
    audience: row.audience,
    sourceType: row.source_type,
    reportStatus: row.report_status,
    reportSnapshot: row.report_snapshot,
    inputSnapshot: row.input_snapshot,
  };
  return { ...mapped, snapshotValidation: validateReadySnapshot(mapped) };
}

function mapAssessmentReportRow(row) {
  const mapped = {
    id: row.id,
    assessmentAssignmentId: row.assessment_assignment_id,
    organizationId: row.organization_id,
    participantId: row.participant_id,
    reportType: row.report_type,
    audience: row.audience,
    sourceType: row.source_type,
    reportStatus: row.report_status,
    reportSnapshot: row.report_snapshot,
    inputSnapshot: row.input_snapshot,
  };
  return { ...mapped, snapshotValidation: row.report_type === "composite" || row.report_type === "individual_development_profile" ? validateReadySnapshot(mapped) : null };
}

async function buildDefaultInspection(context, inspectionDependencies = {}) {
  const loadScoringInspection = inspectionDependencies.loadScoringInspection ?? require("./score-gd-001.cjs").loadScoringInspection;
  const scoringInspection = await loadScoringInspection({
    supabase: context.supabase,
    repository: context.repository,
    foundation: context.foundation,
  });
  const snapshot = scoringInspection.snapshot;
  const attemptIds = snapshot.attemptIds;
  const concreteAttemptIds = Object.values(attemptIds).filter(Boolean);
  const attemptQuery = context.supabase
    .from("attempt_reports")
    .select("id, attempt_id, test_slug, report_type, audience, source_type, report_status, input_snapshot, report_snapshot")
    .in("attempt_id", concreteAttemptIds);
  const assessmentQuery = context.supabase
    .from("assessment_reports")
    .select("id, assessment_assignment_id, organization_id, participant_id, report_type, audience, source_type, report_status, input_snapshot, report_snapshot")
    .eq("assessment_assignment_id", snapshot.assignmentId);
  const [{ data: attemptRows, error: attemptError }, { data: assessmentRows, error: assessmentError }] = await Promise.all([attemptQuery, assessmentQuery]);
  if (attemptError) throw new Error(`Failed to load candidate-scoped attempt reports: ${attemptError.message}`);
  if (assessmentError) throw new Error(`Failed to load candidate-scoped assessment reports: ${assessmentError.message}`);

  const mappedAttemptReports = (attemptRows ?? []).map(mapAttemptReportRow);
  const mappedAssessmentReports = (assessmentRows ?? []).map(mapAssessmentReportRow);
  return {
    candidateId: context.candidate.candidateId,
    organizationId: scoringInspection.resolved.snapshot.organizationId ?? null,
    participantId: snapshot.participantId ?? null,
    assignmentId: snapshot.assignmentId ?? null,
    attemptIds,
    source: {
      fixtureCompatibilityExact: Boolean(snapshot.structuralFixtureExact),
      participantId: snapshot.participantId ?? null,
      assignmentId: snapshot.assignmentId ?? null,
      attemptIds,
      attempts: snapshot.attempts,
      responseCounts: snapshot.responseCounts,
      rawValueCounts: snapshot.rawValueCounts,
      scoredValueCounts: snapshot.scoredValueCounts,
      dimensionScoreCount: snapshot.dimensionScores.length,
      expectedScoreVerification: scoringInspection.verification,
      reportCounts: {
        attemptReports: mappedAttemptReports.length,
        assessmentReports: mappedAssessmentReports.length,
      },
    },
    attemptReports: mappedAttemptReports,
    assessmentReports: mappedAssessmentReports,
    participantReportCount: mappedAttemptReports.filter((row) => row.audience === "participant").length + mappedAssessmentReports.filter((row) => row.audience === "participant").length,
  };
}

function loadCandidateContext(candidateId) {
  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));
  const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const foundation = loadGoldenDemoCsvFoundation(projectRoot);
  const repoContract = loadGoldenDemoRepoContract(projectRoot);
  const validation = validateGoldenDemoCsvFoundation(foundation, repoContract);
  if (!validation.ok) throw new Error(`Golden Demo CSV validation failed with ${validation.errors.length} error(s).`);
  const candidate = getGoldenDemoCandidateContract(foundation, candidateId);
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { createReadOnlyRepository } = require("./write-gd-001-db-fixture.cjs");
  return { foundation, candidate, supabase, repository: createReadOnlyRepository({ supabase, foundation, candidate }) };
}

function buildDefaultApplyDependencies(context, inspect) {
  const { recoverHrAttemptReport } = require("../lib/assessment/reports.ts");
  const { claimNextReportJob, processClaimedReportJob } = require("../lib/assessment/report-job-worker.ts");
  const { createQueuedCompositeAssessmentReport } = require("../lib/assessment/assessment-reports.ts");
  const { claimNextAssessmentReportJob, processClaimedAssessmentReportJob } = require("../lib/assessment/assessment-report-worker.ts");
  const { queueIndividualDevelopmentProfileAssessmentReport } = require("../lib/assessment/individual-development-profile-lifecycle.ts");
  const { processIndividualDevelopmentProfileAssessmentReport } = require("../lib/assessment/individual-development-profile-processor.ts");
  return {
    inspect,
    recoverHrAttemptReport,
    claimNextReportJob,
    processClaimedReportJob,
    createQueuedCompositeAssessmentReport,
    claimNextAssessmentReportJob: (options) => claimNextAssessmentReportJob(options),
    processClaimedAssessmentReportJob,
    queueIndividualDevelopmentProfileAssessmentReport: (input) => queueIndividualDevelopmentProfileAssessmentReport(input),
    processIndividualDevelopmentProfileAssessmentReport: (input) => processIndividualDevelopmentProfileAssessmentReport(input),
    context,
  };
}

async function run(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseCli(argv);
  const context = dependencies.loadCandidateContext
    ? await dependencies.loadCandidateContext(options.candidateId)
    : loadCandidateContext(options.candidateId);
  const inspect = dependencies.inspect ?? (() => buildDefaultInspection(context));
  const initialInspection = await inspect();
  const plan = buildGoldenDemoReportPackagePlan(initialInspection);

  if (options.mode === "dry-run") {
    const output = {
      mode: "dry-run",
      candidateId: plan.candidateId,
      organizationId: initialInspection.organizationId,
      participantId: plan.participantId,
      assignmentId: plan.assignmentId,
      attemptIds: plan.attemptIds,
      sourceState: plan.sourceState,
      packageState: plan.packageState,
      artifactStates: plan.artifactStates,
      orderedActions: plan.orderedActions,
      plannedOpenAiCalls: plan.plannedOpenAiCalls,
      blockers: plan.blockers,
      writesPerformed: false,
    };
    if (options.verbose) output.sourceBlockers = plan.sourceBlockers;
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return output;
  }

  const applyDependencies = dependencies.applyDependencies ?? buildDefaultApplyDependencies(context, inspect);
  const applyResult = await executeGoldenDemoReportPackageApply(initialInspection, applyDependencies);
  const output = {
    ...applyResult,
    participantId: initialInspection.participantId,
    assignmentId: initialInspection.assignmentId,
    attemptIds: initialInspection.attemptIds,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return output;
}

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(`Golden Demo individual report package error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = { parseCli, installTypeScriptRuntime, run, buildDefaultInspection };
