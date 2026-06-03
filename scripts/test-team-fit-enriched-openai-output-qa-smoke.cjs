const assert = require("node:assert/strict");
const crypto = require("node:crypto");
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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
const { queueTeamFitReportShell } = require("../lib/b2b/team-fit-report-lifecycle.ts");
const { processTeamFitReport } = require("../lib/b2b/team-fit-report-processor.ts");
const { loadTeamFitReportDisplayRecord } = require("../lib/b2b/team-fit-report-display.ts");
const { listTeamFitReportEntries } = require("../lib/b2b/team-fit-report-list.ts");
const { validateTeamFitReportSnapshot } = require("../lib/b2b/team-fit-report-contract.ts");
const { reviewTeamFitReportQuality } = require("../lib/b2b/team-fit-report-quality-review.ts");
const {
  TEAM_FIT_REPORT_INPUT_TYPE,
  TEAM_FIT_REPORT_INPUT_VERSION,
} = require("../lib/b2b/team-fit-report-input.ts");
const compositeInputModule = require("../lib/assessment/composite-input.ts");
const teamAggregationReadModule = require("../lib/assessment/team-dynamics-final-aggregation-read.ts");

const CANDIDATE_MARKER_LABEL = "Structured collaboration marker";
const TEAM_MARKER_LABEL = "Coordination friction marker";
const FORBIDDEN_KEYS = [
  "rawAnswers",
  "rawResponses",
  "individualAnswers",
  "memberScores",
  "individualScores",
  "fullSnapshot",
  "rawItemText",
  "fitScore",
  "score0To100",
  "hireRecommendation",
];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function buildSkipResult(reason, extra = {}) {
  return {
    ok: false,
    skipped: true,
    reason,
    ...extra,
  };
}

function collectStringLeaves(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectStringLeaves(entry, output));
    return output;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => collectStringLeaves(entry, output));
  }

  return output;
}

function assertForbiddenKeysAbsent(value, label) {
  const serialized = JSON.stringify(value);

  FORBIDDEN_KEYS.forEach((key) => {
    assert.equal(
      serialized.includes(`"${key}"`),
      false,
      `${label} must not contain forbidden key ${key}.`,
    );
  });
}

function containsKeywordGroup(haystack, keywords) {
  const normalized = haystack.toLowerCase();
  return keywords.every((keyword) => normalized.includes(keyword.toLowerCase()));
}

function containsAnyKeywordGroup(haystack, keywordGroups) {
  return keywordGroups.some((keywords) => containsKeywordGroup(haystack, keywords));
}

function buildCompositeSnapshotFixture(assessmentAssignmentId) {
  return {
    contractVersion: "composite_hr_input_v1",
    generatedFor: {
      assessmentAssignmentId,
    },
    sourceAttempts: [
      { requiredForTeamFit: true, status: "completed", testSlug: "ipip_neo_120" },
      { requiredForTeamFit: true, status: "completed", testSlug: "mwms_v1" },
      { requiredForTeamFit: true, status: "completed", testSlug: "safran_hr_v1" },
    ],
    coverage: {
      missingTestSlugs: [],
    },
    deterministicInputs: {
      ipip: {
        domains: [
          {
            domainCode: "structured_collaboration_marker",
            label: CANDIDATE_MARKER_LABEL,
            displayBandLabel: "Higher",
          },
          {
            domainCode: "conscientiousness",
            label: "Conscientiousness",
            displayBandLabel: "Higher",
          },
          {
            domainCode: "uncertainty_tolerance_marker",
            label: "Uncertainty tolerance marker",
            displayBandLabel: "Moderate",
          },
        ],
      },
      mwms: {
        dimensions: [
          { code: "identified", label: "Identified motivation" },
          { code: "intrinsic", label: "Intrinsic motivation" },
          { code: "amotivation", label: "Amotivation" },
        ],
        summarySignals: {
          cautionFlags: {
            elevatedAmotivation: false,
            highControlledRelativeToAutonomous: false,
            mixedProfile: false,
          },
        },
      },
    },
    summarySignals: {
      personalityHighestDomains: ["structured_collaboration_marker", "conscientiousness"],
      personalityLowestDomains: ["uncertainty_tolerance_marker"],
      cognitiveStrongestDomain: "verbal",
      cognitiveLowestDomain: "numeric",
      motivationHighestDrivers: ["identified", "intrinsic"],
      motivationLowestDrivers: ["amotivation"],
      crossInstrumentFlags: ["structured_collaboration_marker"],
    },
    metadata: {
      builderVersion: "v1",
    },
  };
}

function buildTeamAggregationFixture(teamAssessmentAssignmentId, aggregationSnapshotId) {
  return {
    status: "ready",
    teamAssessmentAssignmentId,
    testSlug: "team_dynamics_assessment_v1",
    aggregationVersion: "team_dynamics_final_aggregation_v1",
    aggregationSnapshotId,
    aggregationSnapshot: null,
    scoreEntryAggregations: [
      {
        scoreKey: "tdm-31-V1_overall",
        label: "Overall team collaboration",
        blockKey: "tdm",
        scoreModel: "simple_linear_v1",
        entryType: "block_overall",
        memberCount: 5,
        meanScore0To100: null,
        minScore0To100: null,
        maxScore0To100: null,
        standardDeviationScore0To100: 12,
      },
      {
        scoreKey: "tdm_domain_coordination_friction_marker",
        label: TEAM_MARKER_LABEL,
        blockKey: "tdm",
        scoreModel: "simple_linear_v1",
        entryType: "domain",
        memberCount: 5,
        meanScore0To100: null,
        minScore0To100: null,
        maxScore0To100: null,
        standardDeviationScore0To100: 18,
      },
      {
        scoreKey: "psychological_safety_overall",
        label: "Psychological safety",
        blockKey: "psychological_safety",
        scoreModel: "simple_linear_v1",
        entryType: "construct",
        memberCount: 5,
        meanScore0To100: null,
        minScore0To100: null,
        maxScore0To100: null,
        standardDeviationScore0To100: 9,
      },
      {
        scoreKey: "situational_judgment_overall",
        label: "Situational judgment",
        blockKey: "sjt",
        scoreModel: "expert_key_partial_credit_v1",
        entryType: "situational_judgment",
        memberCount: 5,
        meanScore0To100: null,
        minScore0To100: null,
        maxScore0To100: null,
        standardDeviationScore0To100: 11,
      },
      {
        scoreKey: "outcome_pulse_overall",
        label: "Outcome pulse",
        blockKey: "outcome_pulse",
        scoreModel: "simple_linear_v1",
        entryType: "outcome_signal",
        memberCount: 5,
        meanScore0To100: null,
        minScore0To100: null,
        maxScore0To100: null,
        standardDeviationScore0To100: 13,
      },
    ],
    hasUnifiedOverallTeamScore: false,
    hasTdmBlockAggregation: true,
    hasTdmDomainAggregations: true,
    hasPsychologicalSafetyAggregation: true,
    hasSjtAggregation: true,
    hasOutcomePulseAggregation: true,
    includedMemberCount: 5,
    completedMemberCount: 5,
    readyScoredMemberCount: 5,
    incompleteMemberCount: 0,
    missingScoreCount: 0,
    invalidScoreCount: 0,
    createdAt: "2026-06-02T09:40:00.000Z",
    updatedAt: "2026-06-02T09:41:00.000Z",
    calculatedAt: "2026-06-02T09:41:00.000Z",
    reason: null,
  };
}

async function deleteByIds(supabase, table, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return;
  }

  const { error } = await supabase.from(table).delete().in("id", ids);

  if (error) {
    throw new Error(`Failed to cleanup ${table}: ${error.message}`);
  }
}

async function deleteOrganization(supabase, organizationId) {
  if (!isNonEmptyString(organizationId)) {
    return;
  }

  const { error } = await supabase.from("organizations").delete().eq("id", organizationId);

  if (error) {
    throw new Error(`Failed to cleanup organization ${organizationId}: ${error.message}`);
  }
}

async function countAssessmentReportsForOrganization(supabase, organizationId) {
  const { count, error } = await supabase
    .from("assessment_reports")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(`Failed to count assessment_reports: ${error.message}`);
  }

  return count ?? 0;
}

async function countTeamAssessmentReportsForOrganization(supabase, organizationId) {
  const { count, error } = await supabase
    .from("team_assessment_reports")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(`Failed to count team_assessment_reports: ${error.message}`);
  }

  return count ?? 0;
}

async function loadAttemptIdsForParticipant(supabase, participantId) {
  const { data, error } = await supabase
    .from("attempts")
    .select("id")
    .eq("participant_id", participantId);

  if (error) {
    throw new Error(`Failed to load attempts for participant: ${error.message}`);
  }

  return (data ?? []).map((row) => row.id);
}

async function countAttemptReportsForAttempts(supabase, attemptIds) {
  if (attemptIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("attempt_reports")
    .select("id", { count: "exact", head: true })
    .in("attempt_id", attemptIds);

  if (error) {
    throw new Error(`Failed to count attempt_reports: ${error.message}`);
  }

  return count ?? 0;
}

async function loadReportRow(supabase, reportId) {
  const { data, error } = await supabase
    .from("team_fit_reports")
    .select(
      "id, report_status, input_snapshot, report_snapshot, error_message, queued_at, started_at, completed_at",
    )
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Fit report row ${reportId}: ${error.message}`);
  }

  return data ?? null;
}

async function main() {
  if (!isNonEmptyString(process.env.OPENAI_API_KEY)) {
    console.log(
      JSON.stringify(
        buildSkipResult("Missing OPENAI_API_KEY. Enriched Team Fit OpenAI QA smoke was skipped.", {
          missingEnv: ["OPENAI_API_KEY"],
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (!isNonEmptyString(process.env.AI_REPORT_MODEL)) {
    console.log(
      JSON.stringify(
        buildSkipResult("Missing AI_REPORT_MODEL. Enriched Team Fit OpenAI QA smoke was skipped.", {
          missingEnv: ["AI_REPORT_MODEL"],
        }),
        null,
        2,
      ),
    );
    return;
  }

  const supabase = createSupabaseAdminClient();
  const token = crypto.randomUUID().slice(0, 8);
  const candidateSourceId = crypto.randomUUID();
  const teamSourceId = crypto.randomUUID();
  const createdIds = {
    organizationId: null,
    teamId: null,
    participantId: null,
    reportIds: [],
  };

  const originalBuildCompositeHrInputSnapshot =
    compositeInputModule.buildCompositeHrInputSnapshot;
  const originalLoadTeamDynamicsFinalAggregationVerification =
    teamAggregationReadModule.loadTeamDynamicsFinalAggregationVerification;

  compositeInputModule.buildCompositeHrInputSnapshot = async (input) => {
    if (input?.assessmentAssignmentId === candidateSourceId) {
      return buildCompositeSnapshotFixture(candidateSourceId);
    }

    return originalBuildCompositeHrInputSnapshot(input);
  };

  teamAggregationReadModule.loadTeamDynamicsFinalAggregationVerification = async (input, deps) => {
    if (input?.teamAssessmentAssignmentId === teamSourceId) {
      return buildTeamAggregationFixture(teamSourceId, `aggregation-${teamSourceId}`);
    }

    return originalLoadTeamDynamicsFinalAggregationVerification(input, deps);
  };

  try {
    const { data: organizationRows, error: organizationError } = await supabase
      .from("organizations")
      .insert({
        name: `Team Fit Enriched QA Smoke ${token}`,
        slug: `team-fit-enriched-openai-qa-smoke-${token}`,
        status: "active",
      })
      .select("id, name")
      .limit(1);

    if (organizationError || !organizationRows?.[0]?.id) {
      throw new Error(
        `Failed to create Team Fit enriched QA smoke organization: ${organizationError?.message ?? "unknown error"}`,
      );
    }

    createdIds.organizationId = organizationRows[0].id;

    const { data: teamRows, error: teamError } = await supabase
      .from("teams")
      .insert({
        organization_id: createdIds.organizationId,
        name: `Team Fit Enriched QA Team ${token}`,
        description: "Cleanup-safe Team Fit enriched OpenAI QA smoke fixture",
        created_by_user_id: null,
      })
      .select("id, name")
      .limit(1);

    if (teamError || !teamRows?.[0]?.id) {
      throw new Error(
        `Failed to create Team Fit enriched QA smoke team: ${teamError?.message ?? "unknown error"}`,
      );
    }

    createdIds.teamId = teamRows[0].id;

    const { data: participantRows, error: participantError } = await supabase
      .from("participants")
      .insert({
        organization_id: createdIds.organizationId,
        user_id: null,
        email: `team-fit-enriched-openai-smoke-${token}@example.test`,
        full_name: `Team Fit Enriched QA Candidate ${token}`,
        participant_type: "candidate",
        status: "active",
      })
      .select("id, full_name")
      .limit(1);

    if (participantError || !participantRows?.[0]?.id) {
      throw new Error(
        `Failed to create Team Fit enriched QA smoke participant: ${participantError?.message ?? "unknown error"}`,
      );
    }

    createdIds.participantId = participantRows[0].id;

    const beforeCounts = {
      attemptReports: await countAttemptReportsForAttempts(
        supabase,
        await loadAttemptIdsForParticipant(supabase, createdIds.participantId),
      ),
      assessmentReports: await countAssessmentReportsForOrganization(
        supabase,
        createdIds.organizationId,
      ),
      teamAssessmentReports: await countTeamAssessmentReportsForOrganization(
        supabase,
        createdIds.organizationId,
      ),
    };

    const queued = await queueTeamFitReportShell(
      {
        organizationId: createdIds.organizationId,
        teamId: createdIds.teamId,
        participantId: createdIds.participantId,
        candidateSourceType: "composite_deterministic_input_snapshot",
        candidateSourceId,
        teamSourceType: "team_dynamics_aggregation_input_snapshot",
        teamSourceId,
        optionalContext: { locale: "bs" },
        createdBy: null,
      },
      {
        supabase,
        now: () => "2026-06-02T11:00:00.000Z",
      },
    );

    if (!queued.ok) {
      throw new Error(queued.message);
    }

    createdIds.reportIds.push(queued.reportId);

    const processed = await processTeamFitReport(
      {
        teamFitReportId: queued.reportId,
        organizationId: createdIds.organizationId,
      },
      {
        supabase,
        now: () => "2026-06-02T11:15:00.000Z",
        providerMode: "openai",
        teamFitOpenAiOptions: {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.AI_REPORT_MODEL,
          now: () => "2026-06-02T11:15:00.000Z",
        },
      },
    );

    if (!processed.ok) {
      throw new Error(
        `Enriched Team Fit OpenAI QA smoke did not reach ready: ${processed.reason} | ${processed.message}${processed.marker ? ` | ${processed.marker}` : ""}`,
      );
    }

    assert.deepEqual(processed, {
      ok: true,
      reportId: queued.reportId,
      status: "ready",
    });

    const readyRow = await loadReportRow(supabase, queued.reportId);
    assert.equal(readyRow?.report_status, "ready");
    assert.equal(readyRow?.error_message, null);
    assert.equal(typeof readyRow?.queued_at, "string");
    assert.equal(typeof readyRow?.started_at, "string");
    assert.equal(typeof readyRow?.completed_at, "string");

    assert.equal(readyRow?.input_snapshot?.inputType, TEAM_FIT_REPORT_INPUT_TYPE);
    assert.equal(readyRow?.input_snapshot?.inputVersion, TEAM_FIT_REPORT_INPUT_VERSION);
    assert.notEqual(
      readyRow?.input_snapshot?.candidateSignals?.sourceStatus,
      "placeholder_pending_composite_input",
    );
    assert.notEqual(
      readyRow?.input_snapshot?.teamSignals?.sourceStatus,
      "placeholder_pending_team_aggregation_input",
    );
    assert.equal(readyRow?.input_snapshot?.candidateSignals?.sourceStatus, "available");
    assert.equal(readyRow?.input_snapshot?.teamSignals?.sourceStatus, "available");
    assert.ok(readyRow?.input_snapshot?.candidateSignals?.summary);
    assert.ok(readyRow?.input_snapshot?.teamSignals?.summary);
    assert.deepEqual(
      readyRow?.input_snapshot?.relationshipReasoningGuardrails?.allowedPatterns,
      ["alignment_signal", "complementarity_signal", "mixed_signal", "needs_validation"],
    );
    assertForbiddenKeysAbsent(readyRow?.input_snapshot ?? null, "enriched input snapshot");

    const validation = validateTeamFitReportSnapshot(readyRow?.report_snapshot ?? null);
    assert.equal(validation.ok, true, validation.ok ? "" : validation.errors.join("; "));
    if (!validation.ok) {
      throw new Error(validation.errors.join("; "));
    }

    assert.equal(validation.snapshot.metadata?.provider, "openai");
    assert.equal(typeof validation.snapshot.metadata?.providerVersion, "string");
    assertForbiddenKeysAbsent(validation.snapshot, "Team Fit OpenAI output snapshot");

    const reviewResult = reviewTeamFitReportQuality(validation.snapshot);
    const blockingFindings = reviewResult.findings.filter(
      (finding) => finding.severity === "blocking",
    );
    assert.equal(
      reviewResult.reviewStatus === "failed",
      false,
      `Quality reviewer returned failed status: ${reviewResult.summary}`,
    );
    assert.equal(
      blockingFindings.length,
      0,
      `Quality reviewer returned blocking findings: ${blockingFindings.map((finding) => `${finding.code}:${finding.path ?? "n/a"}`).join(", ")}`,
    );

    const outputText = collectStringLeaves(validation.snapshot).join("\n").toLowerCase();
    assert.equal(
      containsAnyKeywordGroup(outputText, [
        ["structured", "collaboration"],
        ["identified", "motivation"],
        ["conscientiousness"],
      ]),
      true,
      "Ready report should reflect at least one enriched candidate-side marker.",
    );
    const teamSignalUsed = containsAnyKeywordGroup(outputText, [
      ["coordination"],
      ["koordinacij"],
      ["trenj"],
      ["psychological", "safety"],
      ["situational", "judgment"],
      ["outcome", "pulse"],
    ]);
    assert.equal(
      teamSignalUsed,
      true,
      `Ready report should reflect at least one enriched team-side marker. Output text: ${outputText.slice(0, 2000)}`,
    );
    assert.equal(
      ["alignment_signal", "complementarity_signal", "mixed_signal", "needs_validation"].includes(
        validation.snapshot.fitOverview.relationshipPattern,
      ),
      true,
    );
    assert.equal(/\bscore\b|\brang\b|\bodluka\b/i.test(validation.snapshot.fitOverview.summary), false);
    assert.equal(/\bscore\b|\brang\b|\bodluka\b/i.test(validation.snapshot.fitOverview.headline), false);

    const readyDisplay = await loadTeamFitReportDisplayRecord(
      {
        organizationId: createdIds.organizationId,
        teamId: createdIds.teamId,
        participantId: createdIds.participantId,
        teamFitReportId: queued.reportId,
      },
      { supabase },
    );

    assert.equal(readyDisplay?.status, "ready");
    assert.equal(readyDisplay?.teamId, createdIds.teamId);
    assert.equal(readyDisplay?.participantId, createdIds.participantId);
    assert.equal(readyDisplay?.reportSnapshot?.reportType, "team_fit_report_v1");

    const listEntries = await listTeamFitReportEntries(
      {
        organizationId: createdIds.organizationId,
        participantId: createdIds.participantId,
      },
      { supabase },
    );

    assert.equal(listEntries.length, 1);
    assert.equal(listEntries[0].status, "ready");
    assert.equal(
      listEntries[0].href,
      `/dashboard/teams/${createdIds.teamId}/participants/${createdIds.participantId}/team-fit-reports/${queued.reportId}`,
    );

    const wrongOrganizationDisplay = await loadTeamFitReportDisplayRecord(
      {
        organizationId: crypto.randomUUID(),
        teamId: createdIds.teamId,
        participantId: createdIds.participantId,
        teamFitReportId: queued.reportId,
      },
      { supabase },
    );
    const wrongTeamDisplay = await loadTeamFitReportDisplayRecord(
      {
        organizationId: createdIds.organizationId,
        teamId: crypto.randomUUID(),
        participantId: createdIds.participantId,
        teamFitReportId: queued.reportId,
      },
      { supabase },
    );
    const wrongParticipantDisplay = await loadTeamFitReportDisplayRecord(
      {
        organizationId: createdIds.organizationId,
        teamId: createdIds.teamId,
        participantId: crypto.randomUUID(),
        teamFitReportId: queued.reportId,
      },
      { supabase },
    );

    assert.equal(wrongOrganizationDisplay, null);
    assert.equal(wrongTeamDisplay, null);
    assert.equal(wrongParticipantDisplay, null);

    const wrongOrganizationList = await listTeamFitReportEntries(
      {
        organizationId: crypto.randomUUID(),
        participantId: createdIds.participantId,
      },
      { supabase },
    );
    const wrongTeamList = await listTeamFitReportEntries(
      {
        organizationId: createdIds.organizationId,
        participantId: createdIds.participantId,
        teamId: crypto.randomUUID(),
      },
      { supabase },
    );
    const wrongParticipantList = await listTeamFitReportEntries(
      {
        organizationId: createdIds.organizationId,
        participantId: crypto.randomUUID(),
      },
      { supabase },
    );

    assert.deepEqual(wrongOrganizationList, []);
    assert.deepEqual(wrongTeamList, []);
    assert.deepEqual(wrongParticipantList, []);

    const attemptIds = await loadAttemptIdsForParticipant(supabase, createdIds.participantId);
    const afterCounts = {
      attemptReports: await countAttemptReportsForAttempts(supabase, attemptIds),
      assessmentReports: await countAssessmentReportsForOrganization(
        supabase,
        createdIds.organizationId,
      ),
      teamAssessmentReports: await countTeamAssessmentReportsForOrganization(
        supabase,
        createdIds.organizationId,
      ),
    };

    assert.equal(attemptIds.length, 0);
    assert.deepEqual(afterCounts, beforeCounts);

    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: false,
          verified: [
            "queued -> processing -> ready completed through processTeamFitReport(...) with providerMode=openai",
            "enriched Team Fit input_snapshot v2 was persisted on the team_fit_reports row",
            "candidateSignals and teamSignals resolved away from placeholder statuses",
            "relationshipReasoningGuardrails persisted allowed patterns",
            "persisted report_snapshot passed validateTeamFitReportSnapshot(...)",
            "persisted report_snapshot passed Team Fit quality reviewer without blocking findings",
            "OpenAI output reflected enriched candidate-side and team-side marker signals",
            "ready report loaded through Team Fit display helper",
            "Team Fit list helper returned the ready persisted entry",
            "wrong organization, team, and participant boundaries returned null or empty results",
            "attempt_reports count stayed unchanged",
            "assessment_reports count stayed unchanged",
            "team_assessment_reports count stayed unchanged",
          ],
          fixture: {
            organizationId: createdIds.organizationId,
            teamId: createdIds.teamId,
            participantId: createdIds.participantId,
            teamFitReportId: queued.reportId,
            candidateSourceId,
            teamSourceId,
            candidateMarker: CANDIDATE_MARKER_LABEL,
            teamMarker: TEAM_MARKER_LABEL,
          },
          qaReview: {
            reviewStatus: reviewResult.reviewStatus,
            warningFindings: reviewResult.findings.filter(
              (finding) => finding.severity === "warning",
            ),
          },
          counts: {
            before: beforeCounts,
            after: afterCounts,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    compositeInputModule.buildCompositeHrInputSnapshot =
      originalBuildCompositeHrInputSnapshot;
    teamAggregationReadModule.loadTeamDynamicsFinalAggregationVerification =
      originalLoadTeamDynamicsFinalAggregationVerification;

    try {
      await deleteByIds(supabase, "team_fit_reports", createdIds.reportIds);
      await deleteByIds(supabase, "teams", createdIds.teamId ? [createdIds.teamId] : []);
      await deleteByIds(
        supabase,
        "participants",
        createdIds.participantId ? [createdIds.participantId] : [],
      );
      await deleteOrganization(supabase, createdIds.organizationId);
    } catch (cleanupError) {
      console.warn(
        cleanupError instanceof Error
          ? `Team Fit enriched OpenAI QA smoke cleanup warning: ${cleanupError.message}`
          : `Team Fit enriched OpenAI QA smoke cleanup warning: ${String(cleanupError)}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? `test-team-fit-enriched-openai-output-qa-smoke: failed: ${error.stack ?? error.message}`
      : `test-team-fit-enriched-openai-output-qa-smoke: failed: ${String(error)}`,
  );
  process.exitCode = 1;
});
