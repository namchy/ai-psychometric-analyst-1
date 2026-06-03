const assert = require("node:assert/strict");
const path = require("node:path");

const {
  prepareIndividualDevelopmentProfileManualProcessFixture,
  cleanupIndividualDevelopmentProfileManualProcessFixture,
} = require("./prepare-individual-development-profile-manual-process-fixture.cjs");

function assertNoForbiddenTokens(value, label) {
  const serialized = JSON.stringify(value);
  const forbiddenTokens = [
    "rawAnswers",
    "rawResponses",
    "input_snapshot",
    "report_snapshot",
    "error_message",
    "fullSnapshot",
    "rawItemText",
    "candidateFacing",
    "candidateFacingOutput",
    "fitScore",
    "hireRecommendation",
    "noHireRecommendation",
  ];

  for (const token of forbiddenTokens) {
    assert.equal(
      serialized.includes(`"${token}"`) || serialized.includes(token),
      false,
      `${label} must not contain forbidden token ${token}.`,
    );
  }
}

async function main() {
  const fixtureResult = await prepareIndividualDevelopmentProfileManualProcessFixture({
    stable: false,
    ensureHrLogin: false,
  });

  if (!fixtureResult.ok && fixtureResult.skipped) {
    console.log(JSON.stringify(fixtureResult, null, 2));
    return;
  }

  const cleanupContext = fixtureResult.cleanupContext;

  try {
    const {
      processIndividualDevelopmentProfileAssessmentReport,
    } = require(path.join(
      __dirname,
      "..",
      "lib",
      "assessment",
      "individual-development-profile-processor.ts",
    ));
    const {
      loadIndividualDevelopmentProfileDisplay,
    } = require(path.join(
      __dirname,
      "..",
      "lib",
      "assessment",
      "individual-development-profile-display.ts",
    ));
    const {
      listIndividualDevelopmentProfileReportEntries,
    } = require(path.join(
      __dirname,
      "..",
      "lib",
      "assessment",
      "individual-development-profile-report-list.ts",
    ));
    const { createSupabaseAdminClient } = require(path.join(
      __dirname,
      "..",
      "lib",
      "supabase",
      "admin.ts",
    ));

    const supabase = createSupabaseAdminClient();

    const processed = await processIndividualDevelopmentProfileAssessmentReport({
      assessmentReportId: fixtureResult.fixture.queuedAssessmentReportId,
      organizationId: fixtureResult.fixture.organizationId,
      participantId: fixtureResult.fixture.participantId,
    });

    assert.deepEqual(processed, {
      ok: true,
      reportId: fixtureResult.fixture.queuedAssessmentReportId,
      status: "ready",
    });

    const { data: persistedRow, error: persistedError } = await supabase
      .from("assessment_reports")
      .select(
        "id, report_status, generator_type, input_snapshot, report_snapshot, failure_code, failure_reason",
      )
      .eq("id", fixtureResult.fixture.queuedAssessmentReportId)
      .maybeSingle();

    if (persistedError || !persistedRow) {
      throw new Error(
        `Failed to reload persisted manual-process report: ${persistedError?.message ?? "unknown error"}`,
      );
    }

    assert.equal(persistedRow.report_status, "ready");
    assert.equal(persistedRow.generator_type, "mock");
    assert.equal(persistedRow.failure_code, null);
    assert.equal(persistedRow.failure_reason, null);
    assert.equal(persistedRow.input_snapshot.inputType, "individual_development_profile_input_v1");
    assertNoForbiddenTokens(persistedRow.input_snapshot, "Persisted IDP input snapshot");

    const display = await loadIndividualDevelopmentProfileDisplay({
      assessmentReportId: fixtureResult.fixture.queuedAssessmentReportId,
      organizationId: fixtureResult.fixture.organizationId,
    });

    assert.equal(display.ok, true);
    assert.equal(display.status, "ready");
    assert.equal(display.reportId, fixtureResult.fixture.queuedAssessmentReportId);
    assertNoForbiddenTokens(display, "IDP display model");

    const entries = await listIndividualDevelopmentProfileReportEntries({
      organizationId: fixtureResult.fixture.organizationId,
      participantId: fixtureResult.fixture.participantId,
    });

    const readyEntry =
      entries.find((entry) => entry.id === fixtureResult.fixture.queuedAssessmentReportId) ?? null;
    assert(readyEntry, "Processed IDP entry must remain visible in participant reports list.");
    assert.equal(readyEntry.status, "ready");
    assertNoForbiddenTokens(entries, "IDP participant report list entries");

    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: false,
          smoke: "individual_development_profile_manual_process_db",
          verified: [
            "real upstream standard-battery linked attempts were prepared for the queued IDP report",
            "buildIndividualDevelopmentProfileInputSnapshot(...) succeeded before processing",
            "processIndividualDevelopmentProfileAssessmentReport(...) transitioned queued -> ready",
            "persisted assessment_reports row now contains reduced input snapshot and ready report snapshot",
            "loadIndividualDevelopmentProfileDisplay(...) returns ready after processing",
            "listIndividualDevelopmentProfileReportEntries(...) shows the processed artifact as ready",
            "display/list layers do not leak raw payload or raw error tokens",
          ],
          fixture: {
            organizationId: fixtureResult.fixture.organizationId,
            participantId: fixtureResult.fixture.participantId,
            assessmentAssignmentId: fixtureResult.fixture.assessmentAssignmentId,
            assessmentReportId: fixtureResult.fixture.queuedAssessmentReportId,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanupIndividualDevelopmentProfileManualProcessFixture(cleanupContext);
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? `IDP manual process DB smoke failed: ${error.message}`
      : `IDP manual process DB smoke failed: ${String(error)}`,
  );
  process.exit(1);
});
