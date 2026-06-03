const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const FIXTURE = {
  organizationName: "IDP Browser Review",
  organizationSlug: "idp-browser-review",
  hrEmail: "idp-browser-review-hr@example.test",
  hrPassword:
    process.env.IDP_BROWSER_REVIEW_HR_PASSWORD || "IdpBrowserReview123!",
  participantEmail: "idp-browser-review-candidate@example.test",
  participantName: "IDP Browser Review Candidate",
};

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

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

function buildSkipResult(reason, extra = {}) {
  return {
    ok: false,
    skipped: true,
    reason,
    ...extra,
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getAppUrl() {
  return (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}

function buildInputSnapshot(input) {
  return {
    inputType: "individual_development_profile_input_v1",
    inputVersion: "individual_development_profile_input_v1",
    locale: "bs",
    participant: {
      participantId: input.participantId,
      displayName: input.displayName,
    },
    sourceSignals: {
      personality: {
        sourceStatus: "available",
        summary: "Ličnosni signal je dostupan kroz reduced razvojni sažetak.",
        relevantSignals: [
          {
            code: "EXTRAVERSION",
            label: "Ekstraverzija",
            signal:
              "Povišen signal vrijedi čitati kao razvojnu hipotezu za saradnju, komunikaciju i ritam rada.",
          },
        ],
        sourceMetadata: {
          testSlug: "ipip_neo_120",
          fixtureToken: input.fixtureToken,
        },
      },
      motivation: {
        sourceStatus: "available",
        summary: "Motivacijski signal je dostupan kroz reduced HR-safe ulaz.",
        relevantSignals: [
          {
            code: "intrinsic",
            label: "Intrinzična motivacija",
            signal:
              "Signal ukazuje da smislen cilj, napredak i jasna veza sa svrhom mogu pojačati angažman.",
          },
        ],
        sourceMetadata: {
          testSlug: "mwms_v1",
        },
      },
      problemSolving: {
        sourceStatus: "available",
        summary: "Problem-solving signal je dostupan kroz reduced rezultat.",
        relevantSignals: [
          {
            code: "verbal",
            label: "Verbalno rezonovanje",
            signal:
              "Verbalni problem-solving signal djeluje dovoljno stabilno za razvojnu provjeru u onboarding i feedback kontekstu.",
          },
        ],
        sourceMetadata: {
          testSlug: "safran_hr_v1",
        },
      },
      composite: {
        sourceStatus: "available",
        summary: "Reduced kompozitni signal je dostupan bez AI narativa i bez raw odgovora.",
        integratedSignals: [
          {
            code: "integrated",
            label: "Integrisani signal",
            signal:
              "Reduced kompozitni signal sugeriše korist od ranog poravnanja očekivanja i kratkih feedback loopova.",
          },
        ],
        sourceMetadata: {
          builderVersion: "idp-browser-review-fixture",
        },
      },
    },
    interpretationLimits: [
      "Input snapshot sadrži reduced HR-safe deterministic signale, ne raw answers i ne full upstream snapshotove.",
    ],
    sourceMetadata: {
      assessmentAssignmentId: input.assessmentAssignmentId,
      sourceVersions: [
        {
          source: "idp-browser-review-fixture",
          version: "v1",
          fixtureToken: input.fixtureToken,
        },
      ],
    },
  };
}

function buildChecklist(relativeParticipantReportsUrl, relativeReadyReportUrl) {
  return [
    `Otvori HR participant reports URL: ${relativeParticipantReportsUrl}`,
    "Potvrdi da se IDP sekcija prikazuje samo ako artefakt postoji.",
    "Potvrdi da ready IDP card ima CTA/link za otvaranje reporta.",
    `Otvori dedicated IDP report URL: ${relativeReadyReportUrl}`,
    "Potvrdi da se prikazuje 'Individualni razvojni profil' ili odgovarajući HR-facing naslov.",
    "Potvrdi da report izgleda kao HR/development guidance, ne kao candidate report.",
    "Potvrdi da nema input_snapshot.",
    "Potvrdi da nema report_snapshot.",
    "Potvrdi da nema error_message.",
    "Potvrdi da nema raw JSON.",
    "Potvrdi da nema OpenAI/provider tehničkog copy-ja.",
    "Potvrdi da nema numeric fit score-a.",
    "Potvrdi da nema hire/no-hire jezika.",
    "Potvrdi da nema dijagnoza.",
    "Potvrdi da nema candidate-facing 'ti' outputa.",
    "Potvrdi da nema raw answers.",
    "Potvrdi da nema raw item texta.",
    "Potvrdi da nema scoring keys.",
    "Potvrdi da nema full upstream snapshot dumpa.",
    "Potvrdi da view route ne generiše novi report i nema process/generate/retry CTA.",
  ];
}

async function listAuthUsersByEmails(supabase, emails) {
  const targetEmails = new Set(emails.map((email) => email.toLowerCase()));
  const usersByEmail = new Map();
  let page = 1;

  while (targetEmails.size > usersByEmail.size && page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    for (const user of data.users) {
      const email = user.email?.toLowerCase();

      if (email && targetEmails.has(email)) {
        usersByEmail.set(email, user);
      }
    }

    if (data.users.length < 200) {
      break;
    }

    page += 1;
  }

  return usersByEmail;
}

async function ensureAuthUser(supabase, input) {
  const existingUsers = await listAuthUsersByEmails(supabase, [input.email]);
  const existingUser = existingUsers.get(input.email.toLowerCase()) ?? null;

  if (existingUser?.id) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email_confirm: true,
      password: input.password,
      user_metadata: {
        ...(existingUser.user_metadata ?? {}),
        role: "hr_admin",
        smoke_fixture: "individual_development_profile_browser_review",
      },
    });

    if (error || !data?.user?.id) {
      throw new Error(`Failed to update auth user ${input.email}: ${error?.message ?? "unknown error"}`);
    }

    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: "hr_admin",
      smoke_fixture: "individual_development_profile_browser_review",
    },
  });

  if (error || !data?.user?.id) {
    throw new Error(`Failed to create auth user ${input.email}: ${error?.message ?? "unknown error"}`);
  }

  return data.user;
}

async function ensureOrganization(supabase) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .eq("slug", FIXTURE.organizationSlug)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load fixture organization: ${error.message}`);
  }

  if (data?.[0]?.id) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("organizations")
      .update({
        name: FIXTURE.organizationName,
        status: "active",
      })
      .eq("id", data[0].id)
      .select("id, name, slug, status")
      .limit(1);

    if (updateError || !updatedRows?.[0]?.id) {
      throw new Error(`Failed to update fixture organization: ${updateError?.message ?? "unknown error"}`);
    }

    return updatedRows[0];
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("organizations")
    .insert({
      name: FIXTURE.organizationName,
      slug: FIXTURE.organizationSlug,
      status: "active",
    })
    .select("id, name, slug, status")
    .limit(1);

  if (insertError || !insertedRows?.[0]?.id) {
    throw new Error(`Failed to create fixture organization: ${insertError?.message ?? "unknown error"}`);
  }

  return insertedRows[0];
}

async function ensureOrganizationMembership(supabase, input) {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("id, organization_id, user_id, role, status")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load fixture organization membership: ${error.message}`);
  }

  if (data?.[0]?.id) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("organization_memberships")
      .update({
        role: "hr_admin",
        status: "active",
      })
      .eq("id", data[0].id)
      .select("id, organization_id, user_id, role, status")
      .limit(1);

    if (updateError || !updatedRows?.[0]?.id) {
      throw new Error(`Failed to update fixture organization membership: ${updateError?.message ?? "unknown error"}`);
    }

    return updatedRows[0];
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("organization_memberships")
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      role: "hr_admin",
      status: "active",
    })
    .select("id, organization_id, user_id, role, status")
    .limit(1);

  if (insertError || !insertedRows?.[0]?.id) {
    throw new Error(`Failed to create fixture organization membership: ${insertError?.message ?? "unknown error"}`);
  }

  return insertedRows[0];
}

async function safeDeleteRows(supabase, table, builder) {
  const { error } = await builder(supabase.from(table).delete());

  if (error) {
    throw new Error(`Failed to delete ${table} fixture rows: ${error.message}`);
  }
}

async function cleanupExistingParticipantFixture(supabase, organizationId) {
  const { data: participantRows, error: participantError } = await supabase
    .from("participants")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("email", FIXTURE.participantEmail);

  if (participantError) {
    throw new Error(`Failed to load existing fixture participant rows: ${participantError.message}`);
  }

  const participantIds = (participantRows ?? []).map((row) => row.id).filter(isNonEmptyString);

  if (participantIds.length === 0) {
    return;
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("assessment_assignments")
    .select("id")
    .eq("organization_id", organizationId)
    .in("participant_id", participantIds);

  if (assignmentError) {
    throw new Error(`Failed to load existing fixture assignments: ${assignmentError.message}`);
  }

  const assignmentIds = (assignmentRows ?? []).map((row) => row.id).filter(isNonEmptyString);

  if (assignmentIds.length > 0) {
    await safeDeleteRows(supabase, "assessment_reports", (query) =>
      query
        .eq("organization_id", organizationId)
        .eq("report_type", "individual_development_profile")
        .in("assessment_assignment_id", assignmentIds),
    );

    await safeDeleteRows(supabase, "assessment_assignments", (query) =>
      query.eq("organization_id", organizationId).in("id", assignmentIds),
    );
  }

  await safeDeleteRows(supabase, "participants", (query) =>
    query.eq("organization_id", organizationId).in("id", participantIds),
  );
}

async function insertParticipant(supabase, organizationId) {
  const { data, error } = await supabase
    .from("participants")
    .insert({
      organization_id: organizationId,
      user_id: null,
      email: FIXTURE.participantEmail,
      full_name: FIXTURE.participantName,
      participant_type: "candidate",
      status: "active",
    })
    .select("id, full_name, email")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create fixture participant: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

async function insertAssignment(supabase, organizationId, participantId, token, label) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("assessment_assignments")
    .insert({
      organization_id: organizationId,
      participant_id: participantId,
      assignment_type: "standard_battery",
      status: "completed",
      locale: "bs",
      created_by_user_id: null,
      completed_at: now,
      metadata: {
        fixtureToken: token,
        lane: "idp_browser_review",
        label,
      },
    })
    .select("id, organization_id, participant_id, status, locale")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create fixture assessment assignment: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

async function insertAssessmentReportRow(supabase, input) {
  const { data, error } = await supabase
    .from("assessment_reports")
    .insert({
      assessment_assignment_id: input.assessmentAssignmentId,
      organization_id: input.organizationId,
      participant_id: input.participantId,
      report_type: "individual_development_profile",
      audience: "hr",
      source_type: "assessment",
      report_status: input.reportStatus,
      generator_type: input.generatorType ?? null,
      contract_version: input.contractVersion ?? null,
      prompt_version_id: null,
      model_name: input.modelName ?? null,
      generator_version: input.generatorVersion ?? null,
      input_snapshot: input.inputSnapshot ?? null,
      report_snapshot: input.reportSnapshot ?? null,
      failure_code: input.failureCode ?? null,
      failure_reason: input.failureReason ?? null,
      queued_at: input.queuedAt ?? null,
      started_at: input.startedAt ?? null,
      completed_at: input.completedAt ?? null,
      generated_at: input.generatedAt ?? null,
      metadata: {
        fixtureToken: input.fixtureToken,
        lane: "idp_browser_review",
        label: input.label,
      },
    })
    .select(
      "id, assessment_assignment_id, organization_id, participant_id, report_status, created_at, updated_at",
    )
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to insert fixture assessment_report row: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

async function createAssessmentReportFixture(supabase, input) {
  const assignment = await insertAssignment(
    supabase,
    input.organizationId,
    input.participantId,
    input.fixtureToken,
    input.label,
  );

  const inputSnapshot = buildInputSnapshot({
    assessmentAssignmentId: assignment.id,
    participantId: input.participantId,
    displayName: input.displayName,
    fixtureToken: input.fixtureToken,
  });

  const reportRow = await insertAssessmentReportRow(supabase, {
    assessmentAssignmentId: assignment.id,
    organizationId: input.organizationId,
    participantId: input.participantId,
    reportStatus: input.reportStatus,
    generatorType: input.generatorType,
    generatorVersion: input.generatorVersion,
    contractVersion: input.contractVersion,
    modelName: input.modelName,
    inputSnapshot,
    reportSnapshot: input.reportSnapshot,
    failureCode: input.failureCode,
    failureReason: input.failureReason,
    queuedAt: input.queuedAt,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    generatedAt: input.generatedAt,
    fixtureToken: input.fixtureToken,
    label: input.label,
  });

  return {
    assignment,
    inputSnapshot,
    reportRow,
  };
}

async function main() {
  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(
      JSON.stringify(
        buildSkipResult("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.", {
          fixtureType: "manual_browser_review",
          skippedTarget: "Individual Development Profile browser review fixture",
        }),
        null,
        2,
      ),
    );
    return;
  }

  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const {
    generateIndividualDevelopmentProfileReport,
  } = require("../lib/assessment/individual-development-profile-provider.ts");
  const {
    validateIndividualDevelopmentProfileSnapshot,
  } = require("../lib/assessment/individual-development-profile-contract.ts");
  const {
    listIndividualDevelopmentProfileReportEntries,
  } = require("../lib/assessment/individual-development-profile-report-list.ts");
  const {
    loadIndividualDevelopmentProfileDisplay,
  } = require("../lib/assessment/individual-development-profile-display.ts");

  const supabase = createSupabaseAdminClient();
  const fixtureToken = crypto.randomUUID().slice(0, 8);
  const queuedAt = new Date().toISOString();
  const startedAt = new Date(Date.now() + 60_000).toISOString();
  const completedAt = new Date(Date.now() + 120_000).toISOString();

  const hrUser = await ensureAuthUser(supabase, {
    email: FIXTURE.hrEmail,
    password: FIXTURE.hrPassword,
  });
  const organization = await ensureOrganization(supabase);
  const membership = await ensureOrganizationMembership(supabase, {
    organizationId: organization.id,
    userId: hrUser.id,
  });

  await cleanupExistingParticipantFixture(supabase, organization.id);
  const participant = await insertParticipant(supabase, organization.id);

  const readySeedInputSnapshot = buildInputSnapshot({
    assessmentAssignmentId: crypto.randomUUID(),
    participantId: participant.id,
    displayName: participant.full_name,
    fixtureToken,
  });
  const readyReportResult = await generateIndividualDevelopmentProfileReport(
    readySeedInputSnapshot,
  );

  assert.equal(readyReportResult.ok, true, "Expected mock provider to produce ready snapshot.");
  const readySnapshotValidation = validateIndividualDevelopmentProfileSnapshot(
    readyReportResult.reportSnapshot,
  );
  assert.equal(readySnapshotValidation.ok, true, readySnapshotValidation.ok ? "" : readySnapshotValidation.errors.join("; "));

  const readyFixture = await createAssessmentReportFixture(supabase, {
    organizationId: organization.id,
    participantId: participant.id,
    displayName: participant.full_name,
    fixtureToken: `${fixtureToken}-ready`,
    label: "ready",
    reportStatus: "ready",
    generatorType: "mock",
    generatorVersion: "individual_development_profile_mock_v1",
    contractVersion: "v1",
    reportSnapshot: readyReportResult.reportSnapshot,
    queuedAt,
    startedAt,
    completedAt,
    generatedAt: completedAt,
  });

  const queuedFixture = await createAssessmentReportFixture(supabase, {
    organizationId: organization.id,
    participantId: participant.id,
    displayName: participant.full_name,
    fixtureToken: `${fixtureToken}-queued`,
    label: "queued",
    reportStatus: "queued",
    reportSnapshot: null,
    queuedAt,
  });

  const processingFixture = await createAssessmentReportFixture(supabase, {
    organizationId: organization.id,
    participantId: participant.id,
    displayName: participant.full_name,
    fixtureToken: `${fixtureToken}-processing`,
    label: "processing",
    reportStatus: "processing",
    reportSnapshot: null,
    queuedAt,
    startedAt,
  });

  const failedFixture = await createAssessmentReportFixture(supabase, {
    organizationId: organization.id,
    participantId: participant.id,
    displayName: participant.full_name,
    fixtureToken: `${fixtureToken}-failed`,
    label: "failed",
    reportStatus: "failed",
    reportSnapshot: null,
    failureCode: "IDP_BROWSER_REVIEW_FAILED",
    failureReason: `IDP_BROWSER_REVIEW_FAILURE_${fixtureToken}`,
    queuedAt,
    startedAt,
    completedAt,
  });

  const invalidFixture = await createAssessmentReportFixture(supabase, {
    organizationId: organization.id,
    participantId: participant.id,
    displayName: participant.full_name,
    fixtureToken: `${fixtureToken}-invalid`,
    label: "invalid",
    reportStatus: "ready",
    generatorType: "mock",
    generatorVersion: "individual_development_profile_mock_v1",
    contractVersion: "v1",
    reportSnapshot: {
      reportType: "invalid_idp_snapshot",
      fixtureToken,
      smoke: "invalid",
    },
    queuedAt,
    startedAt,
    completedAt,
    generatedAt: completedAt,
  });

  const entries = await listIndividualDevelopmentProfileReportEntries({
    organizationId: organization.id,
    participantId: participant.id,
  });

  const entryStatusById = new Map(entries.map((entry) => [entry.id, entry.status]));
  assert.equal(entryStatusById.get(readyFixture.reportRow.id), "ready");
  assert.equal(entryStatusById.get(queuedFixture.reportRow.id), "queued");
  assert.equal(entryStatusById.get(processingFixture.reportRow.id), "processing");
  assert.equal(entryStatusById.get(failedFixture.reportRow.id), "failed");
  assert.equal(entryStatusById.get(invalidFixture.reportRow.id), "invalid");

  const readyDisplay = await loadIndividualDevelopmentProfileDisplay({
    assessmentReportId: readyFixture.reportRow.id,
    organizationId: organization.id,
  });

  assert.equal(readyDisplay.ok, true);
  assert.equal(readyDisplay.status, "ready");
  assert.equal(readyDisplay.reportId, readyFixture.reportRow.id);

  const relativeParticipantReportsUrl = `/dashboard/participants/${participant.id}/reports`;
  const relativeReadyReportUrl = `/dashboard/individual-development-profile-reports/${readyFixture.reportRow.id}`;
  const checklist = buildChecklist(
    relativeParticipantReportsUrl,
    relativeReadyReportUrl,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        skipped: false,
        fixtureType: "manual_browser_review",
        verified: [
          "HR auth user exists and has active hr_admin membership in the fixture organization",
          "participant fixture exists in the same organization",
          "persisted IDP assessment_reports rows exist for ready, queued, processing, failed, and invalid review states",
          "each persisted row uses a distinct assessment_assignment_id to satisfy assessment_reports_artifact_identity_unique",
          "ready report snapshot was created through the existing IDP mock provider path and passed the runtime validator",
          "listIndividualDevelopmentProfileReportEntries(...) returned ready, queued, processing, failed, and invalid states for the fixture participant",
          "loadIndividualDevelopmentProfileDisplay(...) loaded the ready report for the fixture organization",
        ],
        hrLogin: {
          email: FIXTURE.hrEmail,
          password: FIXTURE.hrPassword,
          membershipRole: membership.role,
        },
        fixture: {
          organizationId: organization.id,
          organizationSlug: organization.slug,
          participantId: participant.id,
          participantEmail: participant.email,
          assessmentReportIds: {
            ready: readyFixture.reportRow.id,
            queued: queuedFixture.reportRow.id,
            processing: processingFixture.reportRow.id,
            failed: failedFixture.reportRow.id,
            invalid: invalidFixture.reportRow.id,
          },
          assessmentAssignmentIds: {
            ready: readyFixture.assignment.id,
            queued: queuedFixture.assignment.id,
            processing: processingFixture.assignment.id,
            failed: failedFixture.assignment.id,
            invalid: invalidFixture.assignment.id,
          },
        },
        urls: {
          participantReportsRelative: relativeParticipantReportsUrl,
          participantReportsAbsolute: `${getAppUrl()}${relativeParticipantReportsUrl}`,
          readyReportRelative: relativeReadyReportUrl,
          readyReportAbsolute: `${getAppUrl()}${relativeReadyReportUrl}`,
        },
        manualReviewChecklist: checklist,
        cleanupNote: {
          automaticCleanup: false,
          message:
            "Fixture remains in the current runtime for manual browser review. Re-running this script refreshes the dedicated participant fixture inside the same organization.",
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? `IDP browser review fixture script failed: ${error.message}`
      : `IDP browser review fixture script failed: ${String(error)}`,
  );
  process.exit(1);
});
