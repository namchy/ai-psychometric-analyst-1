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
const { generateTeamFitReportWithOpenAI } = require("../lib/b2b/team-fit-report-openai-provider.ts");
const {
  validateTeamFitReportSnapshot,
  TEAM_FIT_REPORT_TYPE,
} = require("../lib/b2b/team-fit-report-contract.ts");
const {
  TEAM_FIT_REPORT_INPUT_TYPE,
  TEAM_FIT_REPORT_INPUT_VERSION,
} = require("../lib/b2b/team-fit-report-input.ts");

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

async function buildProviderFailureDetails(row) {
  if (!row?.input_snapshot) {
    return {
      directProviderCheck: {
        skipped: true,
        reason: "input_snapshot_missing_after_processor_failure",
      },
    };
  }

  const directResult = await generateTeamFitReportWithOpenAI(row.input_snapshot, {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.AI_REPORT_MODEL,
    now: () => "2026-06-02T10:15:00.000Z",
  });

  if (directResult.ok) {
    return {
      directProviderCheck: {
        skipped: false,
        ok: true,
        provider: directResult.provider,
        providerVersion: directResult.providerVersion,
      },
    };
  }

  return {
    directProviderCheck: {
      skipped: false,
      ok: false,
      code: directResult.code,
      reason: directResult.reason,
      validationErrors: directResult.validationErrors ?? null,
    },
  };
}

async function main() {
  if (!isNonEmptyString(process.env.OPENAI_API_KEY)) {
    console.log(
      JSON.stringify(
        buildSkipResult("Missing OPENAI_API_KEY. Team Fit OpenAI DB smoke was skipped.", {
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
        buildSkipResult("Missing AI_REPORT_MODEL. Team Fit OpenAI DB smoke was skipped.", {
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
  const createdIds = {
    organizationId: null,
    teamId: null,
    participantId: null,
    reportIds: [],
  };

  try {
    const { data: organizationRows, error: organizationError } = await supabase
      .from("organizations")
      .insert({
        name: `Team Fit OpenAI Smoke ${token}`,
        slug: `team-fit-openai-db-smoke-${token}`,
        status: "active",
      })
      .select("id, name")
      .limit(1);

    if (organizationError || !organizationRows?.[0]?.id) {
      throw new Error(
        `Failed to create Team Fit OpenAI smoke organization: ${organizationError?.message ?? "unknown error"}`,
      );
    }

    createdIds.organizationId = organizationRows[0].id;

    const { data: teamRows, error: teamError } = await supabase
      .from("teams")
      .insert({
        organization_id: createdIds.organizationId,
        name: `Team Fit OpenAI Smoke Team ${token}`,
        description: "Cleanup-safe Team Fit OpenAI DB smoke fixture",
        created_by_user_id: null,
      })
      .select("id, name")
      .limit(1);

    if (teamError || !teamRows?.[0]?.id) {
      throw new Error(
        `Failed to create Team Fit OpenAI smoke team: ${teamError?.message ?? "unknown error"}`,
      );
    }

    createdIds.teamId = teamRows[0].id;

    const { data: participantRows, error: participantError } = await supabase
      .from("participants")
      .insert({
        organization_id: createdIds.organizationId,
        user_id: null,
        email: `team-fit-openai-smoke-${token}@example.test`,
        full_name: `Team Fit OpenAI Candidate ${token}`,
        participant_type: "candidate",
        status: "active",
      })
      .select("id, full_name")
      .limit(1);

    if (participantError || !participantRows?.[0]?.id) {
      throw new Error(
        `Failed to create Team Fit OpenAI smoke participant: ${participantError?.message ?? "unknown error"}`,
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
        candidateSourceId: crypto.randomUUID(),
        teamSourceType: "team_dynamics_aggregation_input_snapshot",
        teamSourceId: crypto.randomUUID(),
        optionalContext: { locale: "bs" },
        createdBy: null,
      },
      {
        supabase,
        now: () => "2026-06-02T10:00:00.000Z",
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
        now: () => "2026-06-02T10:15:00.000Z",
        providerMode: "openai",
        teamFitOpenAiOptions: {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.AI_REPORT_MODEL,
          now: () => "2026-06-02T10:15:00.000Z",
        },
      },
    );

    if (!processed.ok) {
      const failedRow = await loadReportRow(supabase, queued.reportId);
      const providerFailureDetails = await buildProviderFailureDetails(failedRow);
      throw new Error(
        `Team Fit OpenAI processor did not reach ready: ${processed.reason} | ${processed.message}${processed.marker ? ` | ${processed.marker}` : ""} | ${JSON.stringify({
          persistedStatus: failedRow?.report_status ?? null,
          persistedErrorMessage: failedRow?.error_message ?? null,
          ...providerFailureDetails,
        })}`,
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
    assert.equal(readyRow?.input_snapshot?.reportType, TEAM_FIT_REPORT_TYPE);
    assert.equal(readyRow?.input_snapshot?.candidateContext?.participantId, createdIds.participantId);
    assert.equal(readyRow?.input_snapshot?.teamContext?.teamId, createdIds.teamId);
    assert.equal(readyRow?.input_snapshot?.sourceReferences?.teamFitReportId, queued.reportId);

    const validation = validateTeamFitReportSnapshot(readyRow?.report_snapshot ?? null);
    assert.equal(validation.ok, true, validation.ok ? "" : validation.errors.join("; "));
    if (!validation.ok) {
      throw new Error(validation.errors.join("; "));
    }

    assert.equal(validation.snapshot.metadata?.provider, "openai");
    assert.equal(typeof validation.snapshot.metadata?.providerVersion, "string");

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
    assert.equal(readyDisplay?.reportSnapshot?.reportType, TEAM_FIT_REPORT_TYPE);

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
            "canonical Team Fit input_snapshot was persisted on the team_fit_reports row",
            "persisted report_snapshot passed validateTeamFitReportSnapshot(...)",
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
          },
          openAi: {
            model: process.env.AI_REPORT_MODEL,
            provider: validation.snapshot.metadata?.provider ?? null,
            providerVersion: validation.snapshot.metadata?.providerVersion ?? null,
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
    try {
      await deleteByIds(supabase, "team_fit_reports", createdIds.reportIds);
      await deleteByIds(
        supabase,
        "teams",
        createdIds.teamId ? [createdIds.teamId] : [],
      );
      await deleteByIds(
        supabase,
        "participants",
        createdIds.participantId ? [createdIds.participantId] : [],
      );
      await deleteOrganization(supabase, createdIds.organizationId);
    } catch (cleanupError) {
      console.warn(
        cleanupError instanceof Error
          ? `Team Fit OpenAI DB smoke cleanup warning: ${cleanupError.message}`
          : `Team Fit OpenAI DB smoke cleanup warning: ${String(cleanupError)}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? `test-team-fit-openai-db-smoke: failed: ${error.stack ?? error.message}`
      : `test-team-fit-openai-db-smoke: failed: ${String(error)}`,
  );
  process.exitCode = 1;
});
