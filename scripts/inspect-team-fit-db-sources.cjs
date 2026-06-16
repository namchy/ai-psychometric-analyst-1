const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_TEAM_FIT_DB_SOURCE_AUDIT";
const TEAM_FIT_REPORT_ID_ENV = "TEAM_FIT_REPORT_ID";
const CANDIDATE_ASSIGNMENT_ID_ENV = "TEAM_FIT_CANDIDATE_ASSESSMENT_ASSIGNMENT_ID";
const TEAM_AGGREGATION_SNAPSHOT_ID_ENV = "TEAM_FIT_TEAM_AGGREGATION_SNAPSHOT_ID";
const TEAM_ID_ENV = "TEAM_FIT_TEAM_ID";
const PARTICIPANT_ID_ENV = "TEAM_FIT_PARTICIPANT_ID";

const TEAM_FIT_REPORT_TYPE = "team_fit_report_v1";
const TEAM_FIT_CANDIDATE_SOURCE_TYPE = "composite_deterministic_input_snapshot";
const TEAM_FIT_TEAM_SOURCE_TYPE = "team_dynamics_aggregation_input_snapshot";

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

function installTypeScriptRuntime() {
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
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeEnvString(value) {
  return isNonEmptyString(value) ? value.trim() : null;
}

function buildBaseArtifact(inputs = {}) {
  return {
    metadata: {
      inspector: "team_fit_db_source_audit_v1",
      reportType: TEAM_FIT_REPORT_TYPE,
      readOnly: true,
      openAiCalled: false,
      databaseWrites: false,
      reportGenerated: false,
      reportPersisted: false,
      productionFlowChanged: false,
    },
    inputs: {
      teamFitReportId: inputs.teamFitReportId ?? null,
      candidateAssessmentAssignmentId: inputs.candidateAssessmentAssignmentId ?? null,
      teamAggregationSnapshotId: inputs.teamAggregationSnapshotId ?? null,
      teamId: inputs.teamId ?? null,
      participantId: inputs.participantId ?? null,
    },
    candidateSource: {
      status: "not_checked",
      sourceKind: TEAM_FIT_CANDIDATE_SOURCE_TYPE,
      assessmentAssignmentId: inputs.candidateAssessmentAssignmentId ?? null,
      usesPersistedCompositeHrReport: false,
      usesAiGeneratedCompositeNarrative: false,
      usesAssignmentDerivedDeterministicCompositeInput: true,
      availableSignals: [],
      missingSignals: [],
      blockers: [],
    },
    teamSource: {
      status: "not_checked",
      sourceKind: TEAM_FIT_TEAM_SOURCE_TYPE,
      aggregationSnapshotId: inputs.teamAggregationSnapshotId ?? null,
      teamId: inputs.teamId ?? null,
      isReady: false,
      isFullCoverage: false,
      partialAggregationAllowed: false,
      availableSignals: [],
      missingSignals: [],
      blockers: [],
    },
    optionalSources: {
      compositeHrReport: {
        status: "optional_reference_only",
        requiredDependency: false,
        primaryCandidateSource: false,
        aiGeneratedNarrativeAllowedAsPrimarySource: false,
      },
      teamDynamicsExecutiveOverview: {
        status: "optional_interpreted_context",
        requiredTeamSource: false,
        primaryTeamSource: false,
      },
      teamStyle: {
        status: "future_optional_source",
        requiredMvpSource: false,
      },
      roleContext: {
        status: "out_of_scope_until_standardized_versioned_source_exists",
        requiredMvpSource: false,
      },
    },
    privacyAndSafetyScan: {
      rawCandidateAnswersIncluded: false,
      rawTeamMemberAnswersIncluded: false,
      individualMemberScoresIncluded: false,
      fullUpstreamSnapshotsIncluded: false,
      candidateFacingTextIncluded: false,
      numericFitScoreIncluded: false,
      hireNoHireIncluded: false,
    },
    sourceMap: {},
    findings: [],
    recommendedNextStep: null,
  };
}

function buildSkippedArtifact(inputs, reason) {
  return {
    ...buildBaseArtifact(inputs),
    skipped: true,
    reason,
    recommendedNextStep:
      `Run with ${CONFIRM_ENV}=true and either ${TEAM_FIT_REPORT_ID_ENV}=... or direct source ids.`,
  };
}

function appendCandidateSourceFindings(artifact) {
  const status = artifact?.candidateSource?.status;
  const blockers = Array.isArray(artifact?.candidateSource?.blockers)
    ? artifact.candidateSource.blockers
    : [];

  if (status === "available" && blockers.length === 0) {
    return artifact;
  }

  if (blockers.length > 0) {
    blockers.forEach((reason) => {
      artifact.findings.push({
        severity: "blocker",
        category: "candidate_source",
        message: "Candidate source could not be resolved.",
        reason,
      });
    });

    return artifact;
  }

  if (status && status !== "not_checked") {
    artifact.findings.push({
      severity: "blocker",
      category: "candidate_source",
      message: "Candidate source is not available for Team Fit input.",
      reason: status,
    });
  }

  return artifact;
}

function summarizeCandidateSignals(snapshot) {
  const signals = [];
  const summary = snapshot?.summarySignals ?? {};

  if (Array.isArray(summary.personalityHighestDomains) && summary.personalityHighestDomains.length > 0) {
    signals.push("personalityHighestDomains");
  }

  if (Array.isArray(summary.personalityLowestDomains) && summary.personalityLowestDomains.length > 0) {
    signals.push("personalityLowestDomains");
  }

  if (isNonEmptyString(summary.cognitiveStrongestDomain)) {
    signals.push("cognitiveStrongestDomain");
  }

  if (isNonEmptyString(summary.cognitiveLowestDomain)) {
    signals.push("cognitiveLowestDomain");
  }

  if (Array.isArray(summary.motivationHighestDrivers) && summary.motivationHighestDrivers.length > 0) {
    signals.push("motivationHighestDrivers");
  }

  if (Array.isArray(summary.motivationLowestDrivers) && summary.motivationLowestDrivers.length > 0) {
    signals.push("motivationLowestDrivers");
  }

  if (Array.isArray(summary.crossInstrumentFlags) && summary.crossInstrumentFlags.length > 0) {
    signals.push("crossInstrumentFlags");
  }

  return signals;
}

function summarizeMissingCandidateSignals(snapshot) {
  const missing = [];
  const summary = snapshot?.summarySignals ?? {};

  if (!Array.isArray(summary.personalityHighestDomains) || summary.personalityHighestDomains.length === 0) {
    missing.push("personalityHighestDomains");
  }

  if (!Array.isArray(summary.personalityLowestDomains) || summary.personalityLowestDomains.length === 0) {
    missing.push("personalityLowestDomains");
  }

  if (!isNonEmptyString(summary.cognitiveStrongestDomain)) {
    missing.push("cognitiveStrongestDomain");
  }

  if (!isNonEmptyString(summary.cognitiveLowestDomain)) {
    missing.push("cognitiveLowestDomain");
  }

  if (!Array.isArray(summary.motivationHighestDrivers) || summary.motivationHighestDrivers.length === 0) {
    missing.push("motivationHighestDrivers");
  }

  if (!Array.isArray(summary.motivationLowestDrivers) || summary.motivationLowestDrivers.length === 0) {
    missing.push("motivationLowestDrivers");
  }

  return missing;
}

function summarizeTeamSignals(verification) {
  const signals = [];

  if ((verification.scoreEntryAggregations ?? []).length > 0) {
    signals.push("scoreEntryAggregations");
  }

  if (verification.hasTdmDomainAggregations) {
    signals.push("tdmDomainAggregations");
  }

  if (verification.hasPsychologicalSafetyAggregation) {
    signals.push("psychologicalSafetyAggregation");
  }

  if (verification.hasSjtAggregation) {
    signals.push("situationalJudgmentAggregation");
  }

  if (verification.hasOutcomePulseAggregation) {
    signals.push("outcomePulseAggregation");
  }

  if (verification.includedMemberCount !== null || verification.readyScoredMemberCount !== null) {
    signals.push("coverageMetadata");
  }

  return signals;
}

function summarizeMissingTeamSignals(verification) {
  const missing = [];

  if (!(verification.scoreEntryAggregations ?? []).length) {
    missing.push("scoreEntryAggregations");
  }

  if (!verification.hasTdmDomainAggregations) {
    missing.push("tdmDomainAggregations");
  }

  if (!verification.hasPsychologicalSafetyAggregation) {
    missing.push("psychologicalSafetyAggregation");
  }

  if (!verification.hasSjtAggregation) {
    missing.push("situationalJudgmentAggregation");
  }

  if (!verification.hasOutcomePulseAggregation) {
    missing.push("outcomePulseAggregation");
  }

  return missing;
}

async function loadTeamFitReportRow(supabase, teamFitReportId) {
  const { data, error } = await supabase
    .from("team_fit_reports")
    .select(
      "id, organization_id, team_id, participant_id, candidate_source_type, candidate_source_id, team_source_type, team_source_id, report_type, report_version, report_status, input_snapshot, report_snapshot, created_at",
    )
    .eq("id", teamFitReportId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Fit report row: ${error.message}`);
  }

  return data ?? null;
}

async function loadAssessmentAssignmentRow(supabase, assessmentAssignmentId) {
  const { data, error } = await supabase
    .from("assessment_assignments")
    .select("id, organization_id, participant_id, locale, status, created_at")
    .eq("id", assessmentAssignmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load candidate assessment assignment: ${error.message}`);
  }

  return data ?? null;
}

async function loadCompositeReportRows(supabase, assessmentAssignmentId) {
  const { data, error } = await supabase
    .from("assessment_reports")
    .select("id, report_type, audience, source_type, report_status, generator_type")
    .eq("assessment_assignment_id", assessmentAssignmentId)
    .eq("report_type", "composite");

  if (error) {
    throw new Error(`Failed to inspect optional Composite HR report rows: ${error.message}`);
  }

  return data ?? [];
}

async function loadAggregationSnapshotRow(supabase, aggregationSnapshotId) {
  const { data, error } = await supabase
    .from("team_assessment_aggregation_snapshots")
    .select("id, team_assessment_assignment_id, team_id, aggregation_version, aggregation_status, participant_count, completed_participant_count, included_score_count, excluded_score_count, created_at, calculated_at")
    .eq("id", aggregationSnapshotId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Dynamics aggregation snapshot row: ${error.message}`);
  }

  return data ?? null;
}

async function resolveTeamSource(input) {
  if (!isNonEmptyString(input.teamSourceId)) {
    return {
      aggregationSnapshotId: null,
      teamAssessmentAssignmentId: null,
      aggregationVersion: undefined,
      snapshotRow: null,
    };
  }

  const snapshotRow = await loadAggregationSnapshotRow(input.supabase, input.teamSourceId);

  if (snapshotRow) {
    return {
      aggregationSnapshotId: snapshotRow.id,
      teamAssessmentAssignmentId: snapshotRow.team_assessment_assignment_id,
      aggregationVersion: snapshotRow.aggregation_version,
      snapshotRow,
    };
  }

  return {
    aggregationSnapshotId: null,
    teamAssessmentAssignmentId: input.teamSourceId,
    aggregationVersion: undefined,
    snapshotRow: null,
  };
}

function buildInputsFromEnv(env) {
  return {
    teamFitReportId: normalizeEnvString(env[TEAM_FIT_REPORT_ID_ENV]),
    candidateAssessmentAssignmentId: normalizeEnvString(env[CANDIDATE_ASSIGNMENT_ID_ENV]),
    teamAggregationSnapshotId: normalizeEnvString(env[TEAM_AGGREGATION_SNAPSHOT_ID_ENV]),
    teamId: normalizeEnvString(env[TEAM_ID_ENV]),
    participantId: normalizeEnvString(env[PARTICIPANT_ID_ENV]),
  };
}

async function buildTeamFitDbSourceAuditArtifact(options = {}) {
  const env = options.env ?? process.env;
  const inputs = buildInputsFromEnv(env);

  if (env[CONFIRM_ENV] !== "true") {
    return buildSkippedArtifact(inputs, `${CONFIRM_ENV}=true is required for DB reads.`);
  }

  if (!inputs.teamFitReportId && !inputs.candidateAssessmentAssignmentId && !inputs.teamAggregationSnapshotId) {
    return buildSkippedArtifact(
      inputs,
      `Provide ${TEAM_FIT_REPORT_ID_ENV} or direct candidate/team source ids.`,
    );
  }

  installTypeScriptRuntime();

  const { createSupabaseAdminClient } = require(path.join(projectRoot, "lib", "supabase", "admin.ts"));
  const { buildCompositeHrInputSnapshot } = require(path.join(projectRoot, "lib", "assessment", "composite-input.ts"));
  const { loadTeamDynamicsFinalAggregationVerification } = require(path.join(projectRoot, "lib", "assessment", "team-dynamics-final-aggregation-read.ts"));

  const supabase = options.supabase ?? createSupabaseAdminClient();
  const artifact = buildBaseArtifact(inputs);
  let reportRow = null;

  if (inputs.teamFitReportId) {
    reportRow = await loadTeamFitReportRow(supabase, inputs.teamFitReportId);

    if (!reportRow) {
      artifact.findings.push({
        severity: "blocker",
        category: "team_fit_report",
        message: "Team Fit report row was not found.",
      });
      artifact.recommendedNextStep = "Verify TEAM_FIT_REPORT_ID or use direct source ids.";
      return artifact;
    }

    artifact.sourceMap.teamFitReport = {
      id: reportRow.id,
      reportType: reportRow.report_type,
      reportVersion: reportRow.report_version,
      reportStatus: reportRow.report_status,
      organizationId: reportRow.organization_id,
      teamId: reportRow.team_id,
      participantId: reportRow.participant_id,
      candidateSourceType: reportRow.candidate_source_type,
      candidateSourceId: reportRow.candidate_source_id,
      teamSourceType: reportRow.team_source_type,
      teamSourceId: reportRow.team_source_id,
      inputSnapshotPresent: reportRow.input_snapshot !== null,
      reportSnapshotPresent: reportRow.report_snapshot !== null,
    };

    artifact.inputs.candidateAssessmentAssignmentId = reportRow.candidate_source_id;
    artifact.inputs.teamId = reportRow.team_id;
    artifact.inputs.participantId = reportRow.participant_id;
    artifact.candidateSource.assessmentAssignmentId = reportRow.candidate_source_id;
    artifact.teamSource.teamId = reportRow.team_id;

    if (reportRow.report_type !== TEAM_FIT_REPORT_TYPE) {
      artifact.findings.push({
        severity: "blocker",
        category: "contract",
        message: `Unexpected report_type ${reportRow.report_type}.`,
      });
    }

    if (reportRow.candidate_source_type !== TEAM_FIT_CANDIDATE_SOURCE_TYPE) {
      artifact.findings.push({
        severity: "blocker",
        category: "candidate_source",
        message: `Unexpected candidate_source_type ${reportRow.candidate_source_type}.`,
      });
    }

    if (reportRow.team_source_type !== TEAM_FIT_TEAM_SOURCE_TYPE) {
      artifact.findings.push({
        severity: "blocker",
        category: "team_source",
        message: `Unexpected team_source_type ${reportRow.team_source_type}.`,
      });
    }
  }

  const candidateAssessmentAssignmentId =
    reportRow?.candidate_source_id ?? inputs.candidateAssessmentAssignmentId;
  const candidateAssignment = candidateAssessmentAssignmentId
    ? await loadAssessmentAssignmentRow(supabase, candidateAssessmentAssignmentId)
    : null;

  if (!candidateAssessmentAssignmentId) {
    artifact.candidateSource.status = "missing_source_id";
    artifact.candidateSource.blockers.push("candidate_assessment_assignment_id_missing");
  } else if (!candidateAssignment) {
    artifact.candidateSource.status = "not_found";
    artifact.candidateSource.blockers.push("candidate_assessment_assignment_not_found");
  } else {
    const compositeReportRows = await loadCompositeReportRows(
      supabase,
      candidateAssessmentAssignmentId,
    );

    artifact.sourceMap.candidate = {
      assessmentAssignmentId: candidateAssignment.id,
      organizationId: candidateAssignment.organization_id,
      participantId: candidateAssignment.participant_id,
      assignmentStatus: candidateAssignment.status,
      locale: candidateAssignment.locale ?? "bs",
      optionalCompositeReportRowsObserved: compositeReportRows.length,
    };

    artifact.optionalSources.compositeHrReport = {
      status: compositeReportRows.length > 0 ? "observed_optional_reference" : "not_observed_optional_reference",
      requiredDependency: false,
      primaryCandidateSource: false,
      aiGeneratedNarrativeAllowedAsPrimarySource: false,
      observedRows: compositeReportRows.map((row) => ({
        id: row.id,
        reportStatus: row.report_status,
        generatorType: row.generator_type,
      })),
    };

    try {
      const compositeSnapshot = await buildCompositeHrInputSnapshot({
        assessmentAssignmentId: candidateAssignment.id,
        organizationId: candidateAssignment.organization_id,
        participantId: candidateAssignment.participant_id,
        locale: candidateAssignment.locale ?? "bs",
      });

      artifact.candidateSource.status = "available";
      artifact.candidateSource.availableSignals = summarizeCandidateSignals(compositeSnapshot);
      artifact.candidateSource.missingSignals = summarizeMissingCandidateSignals(compositeSnapshot);
      artifact.candidateSource.usesPersistedCompositeHrReport = false;
      artifact.candidateSource.usesAiGeneratedCompositeNarrative = false;
      artifact.candidateSource.usesAssignmentDerivedDeterministicCompositeInput = true;
      artifact.sourceMap.candidate.compositeInput = {
        contractVersion: compositeSnapshot.contractVersion,
        builderVersion: compositeSnapshot.metadata?.builderVersion ?? null,
        coverage: {
          requiredCount: compositeSnapshot.coverage?.requiredCount ?? null,
          completedCount: compositeSnapshot.coverage?.completedCount ?? null,
          missingTestSlugs: compositeSnapshot.coverage?.missingTestSlugs ?? [],
        },
        sourceAttemptCount: Array.isArray(compositeSnapshot.sourceAttempts)
          ? compositeSnapshot.sourceAttempts.length
          : null,
      };

      if ((compositeSnapshot.coverage?.missingTestSlugs ?? []).length > 0) {
        artifact.findings.push({
          severity: "warning",
          category: "candidate_source",
          message: "Candidate deterministic composite input is available with missing source tests.",
          missingTestSlugs: compositeSnapshot.coverage.missingTestSlugs,
        });
      }
    } catch (error) {
      artifact.candidateSource.status = "blocked";
      artifact.candidateSource.blockers.push("candidate_composite_input_unavailable");
      artifact.findings.push({
        severity: "blocker",
        category: "candidate_source",
        message: error instanceof Error ? error.message : "Candidate composite input could not be built.",
      });
    }
  }

  const teamSourceId =
    reportRow?.team_source_id ?? inputs.teamAggregationSnapshotId ?? null;
  const resolvedTeamSource = await resolveTeamSource({
    supabase,
    teamSourceId,
  });

  artifact.inputs.teamAggregationSnapshotId =
    resolvedTeamSource.aggregationSnapshotId ?? inputs.teamAggregationSnapshotId;
  artifact.teamSource.aggregationSnapshotId = resolvedTeamSource.aggregationSnapshotId;
  artifact.teamSource.teamId = resolvedTeamSource.snapshotRow?.team_id ?? artifact.teamSource.teamId;

  if (!teamSourceId) {
    artifact.teamSource.status = "missing_source_id";
    artifact.teamSource.blockers.push("team_aggregation_source_id_missing");
  } else if (!resolvedTeamSource.teamAssessmentAssignmentId) {
    artifact.teamSource.status = "not_found";
    artifact.teamSource.blockers.push("team_aggregation_snapshot_or_assignment_not_found");
  } else {
    const verification = await loadTeamDynamicsFinalAggregationVerification({
      teamAssessmentAssignmentId: resolvedTeamSource.teamAssessmentAssignmentId,
      aggregationVersion: resolvedTeamSource.aggregationVersion,
    });

    const isFullCoverage =
      verification.status === "ready" &&
      verification.incompleteMemberCount === 0 &&
      verification.missingScoreCount === 0 &&
      verification.invalidScoreCount === 0;

    artifact.inputs.teamAggregationSnapshotId =
      verification.aggregationSnapshotId ?? artifact.inputs.teamAggregationSnapshotId;
    artifact.teamSource.status = verification.status;
    artifact.teamSource.isReady = verification.status === "ready";
    artifact.teamSource.isFullCoverage = isFullCoverage;
    artifact.teamSource.aggregationSnapshotId =
      verification.aggregationSnapshotId ?? artifact.teamSource.aggregationSnapshotId;
    artifact.teamSource.availableSignals = summarizeTeamSignals(verification);
    artifact.teamSource.missingSignals = summarizeMissingTeamSignals(verification);
    artifact.teamSource.teamId =
      resolvedTeamSource.snapshotRow?.team_id ?? artifact.teamSource.teamId;
    artifact.sourceMap.team = {
      sourceIdUsed: teamSourceId,
      sourceIdResolvedAs: resolvedTeamSource.aggregationSnapshotId
        ? "team_assessment_aggregation_snapshots.id"
        : "team_assessment_assignment_id",
      aggregationSnapshotId: verification.aggregationSnapshotId,
      teamAssessmentAssignmentId: verification.teamAssessmentAssignmentId,
      aggregationVersion: verification.aggregationVersion,
      status: verification.status,
      includedMemberCount: verification.includedMemberCount,
      completedMemberCount: verification.completedMemberCount,
      readyScoredMemberCount: verification.readyScoredMemberCount,
      incompleteMemberCount: verification.incompleteMemberCount,
      missingScoreCount: verification.missingScoreCount,
      invalidScoreCount: verification.invalidScoreCount,
      reason: verification.reason,
    };

    if (verification.status !== "ready") {
      artifact.teamSource.blockers.push("team_aggregation_not_ready");
      artifact.findings.push({
        severity: "blocker",
        category: "team_source",
        message: `Team aggregation verification status is ${verification.status}.`,
        reason: verification.reason,
      });
    }

    if (!isFullCoverage) {
      artifact.teamSource.blockers.push("team_aggregation_not_full_coverage");
      artifact.findings.push({
        severity: "blocker",
        category: "team_source",
        message: "Team Fit MVP requires full coverage Team Dynamics aggregation.",
        incompleteMemberCount: verification.incompleteMemberCount,
        missingScoreCount: verification.missingScoreCount,
        invalidScoreCount: verification.invalidScoreCount,
      });
    }
  }

  appendCandidateSourceFindings(artifact);

  if (artifact.candidateSource.status === "available" && artifact.teamSource.isReady && artifact.teamSource.isFullCoverage) {
    artifact.findings.push({
      severity: "info",
      category: "source_integrity",
      message: "Candidate and team primary sources are available for a future real Team Fit input builder/provider path.",
    });
    artifact.recommendedNextStep =
      "Use these sources only in a separate explicit provider/input-builder slice; keep this audit read-only.";
  } else {
    artifact.recommendedNextStep =
      "Resolve source blockers before any real Team Fit provider/input-builder run.";
  }

  return artifact;
}

async function runTeamFitDbSourceAudit({
  env = process.env,
  stdout = process.stdout,
} = {}) {
  const artifact = await buildTeamFitDbSourceAuditArtifact({ env });
  stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}

module.exports = {
  CANDIDATE_ASSIGNMENT_ID_ENV,
  CONFIRM_ENV,
  PARTICIPANT_ID_ENV,
  TEAM_AGGREGATION_SNAPSHOT_ID_ENV,
  TEAM_FIT_REPORT_ID_ENV,
  TEAM_ID_ENV,
  appendCandidateSourceFindings,
  buildBaseArtifact,
  buildSkippedArtifact,
  buildTeamFitDbSourceAuditArtifact,
  installTypeScriptRuntime,
  runTeamFitDbSourceAudit,
};

if (require.main === module) {
  runTeamFitDbSourceAudit().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
