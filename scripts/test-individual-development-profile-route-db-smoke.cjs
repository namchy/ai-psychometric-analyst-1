const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ReactDOMServer = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const nextLinkStubPath = path.join(__dirname, "next-link-stub.cjs");
const routePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "individual-development-profile-reports",
  "[assessmentReportId]",
  "page.tsx",
);
const authStubPath = path.join(__dirname, "idp-route-db-auth-stub.cjs");
const organizationsStubPath = path.join(__dirname, "idp-route-db-organizations-stub.cjs");
const nextNavigationStubPath = path.join(__dirname, "idp-route-db-next-navigation-stub.cjs");
const originalResolveFilename = Module._resolveFilename;

const runtimeState = {
  authenticatedUser: { id: "hr-user-db-smoke" },
  activeOrganization: null,
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

function buildSkipResult(reason, extra = {}) {
  return {
    ok: false,
    skipped: true,
    reason,
    ...extra,
  };
}

function isMissingIdpAssessmentReportsSchema(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("assessment_reports_report_type_check") &&
    message.includes("assessment_reports")
  );
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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

  if (request === "@/lib/supabase/admin") {
    return originalResolveFilename.call(
      this,
      resolveWithExtensions(path.join(projectRoot, "lib/supabase/admin")),
      parent,
      isMain,
      options,
    );
  }

  if (request === "next/link") {
    return nextLinkStubPath;
  }

  if (request === "next/navigation") {
    return nextNavigationStubPath;
  }

  if (request === "@/lib/auth/session") {
    return authStubPath;
  }

  if (request === "@/lib/b2b/organizations") {
    return organizationsStubPath;
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

require.extensions[".tsx"] = function compileTsx(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

require.cache[authStubPath] = {
  id: authStubPath,
  filename: authStubPath,
  loaded: true,
  exports: {
    requireAuthenticatedUser: async () => runtimeState.authenticatedUser,
  },
};

require.cache[organizationsStubPath] = {
  id: organizationsStubPath,
  filename: organizationsStubPath,
  loaded: true,
  exports: {
    getActiveOrganizationForUser: async () => runtimeState.activeOrganization,
  },
};

require.cache[nextNavigationStubPath] = {
  id: nextNavigationStubPath,
  filename: nextNavigationStubPath,
  loaded: true,
  exports: {
    notFound() {
      const error = new Error("NEXT_NOT_FOUND");
      error.code = "NEXT_NOT_FOUND";
      throw error;
    },
  },
};

function assertNoHtmlLeak(html, forbiddenEntries, label) {
  for (const entry of forbiddenEntries) {
    assert.equal(
      html.includes(entry),
      false,
      `${label} must not include forbidden entry ${entry}.`,
    );
  }
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
              "Povišen signal u domeni ekstraverzije vrijedi čitati kao razvojnu hipotezu za saradnju i ritam rada.",
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
            signal: "Signal ukazuje da smislen cilj i vidljiv napredak mogu pojačati angažman.",
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
              "U ovom setu zadataka verbalni problem-solving signal djeluje dovoljno stabilno za razvojnu provjeru.",
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
              "Reduced kompozitni signal sugeriše da osoba ima više koristi od ranog poravnanja očekivanja i kratkih feedback loopova.",
          },
        ],
        sourceMetadata: {
          builderVersion: "idp-db-smoke-fixture",
        },
      },
    },
    interpretationLimits: [
      "Input snapshot sadrži reduced HR-safe deterministic signale, ne raw answers i ne full upstream snapshotove.",
    ],
    sourceMetadata: {
      assessmentAssignmentId: input.assessmentAssignmentId,
      sourceVersions: [{ source: "idp-db-smoke", version: "v1", fixtureToken: input.fixtureToken }],
      internalSmokeToken: input.inputSecret,
    },
  };
}

async function safeDeleteByIds(supabase, table, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return;
  }

  const { error } = await supabase.from(table).delete().in("id", ids);

  if (error) {
    console.warn(`Failed to cleanup ${table}: ${error.message}`);
  }
}

async function safeDeleteById(supabase, table, id) {
  if (!isNonEmptyString(id)) {
    return;
  }

  const { error } = await supabase.from(table).delete().eq("id", id);

  if (error) {
    console.warn(`Failed to cleanup ${table}: ${error.message}`);
  }
}

async function insertOrganization(supabase, token, label) {
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: `IDP Route Smoke ${label} ${token}`,
      slug: `idp-route-smoke-${label}-${token}`.toLowerCase(),
      status: "active",
    })
    .select("id, name, slug")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create organization fixture: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

async function insertParticipant(supabase, organizationId, token) {
  const { data, error } = await supabase
    .from("participants")
    .insert({
      organization_id: organizationId,
      user_id: null,
      email: `idp-route-smoke-${token}@example.test`,
      full_name: `IDP Smoke Candidate ${token}`,
      participant_type: "candidate",
      status: "active",
    })
    .select("id, full_name, email")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create participant fixture: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

async function insertAssignment(supabase, organizationId, participantId, token) {
  const completedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("assessment_assignments")
    .insert({
      organization_id: organizationId,
      participant_id: participantId,
      assignment_type: "standard_battery",
      status: "completed",
      locale: "bs",
      created_by_user_id: null,
      completed_at: completedAt,
      metadata: {
        fixtureToken: token,
        lane: "idp_route_db_smoke",
      },
    })
    .select("id, organization_id, participant_id, status, locale")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create assessment assignment fixture: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

async function createAssessmentReportFixture(supabase, input) {
  const assignment = await insertAssignment(
    supabase,
    input.organizationId,
    input.participantId,
    input.assignmentToken,
  );
  input.createdIds.assignmentIds.push(assignment.id);

  const inputSnapshot = buildInputSnapshot({
    assessmentAssignmentId: assignment.id,
    participantId: input.participantId,
    displayName: input.displayName,
    fixtureToken: input.fixtureToken,
    inputSecret: input.inputSecret,
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
  });
  input.createdIds.reportIds.push(reportRow.id);

  return {
    assignment,
    inputSnapshot,
    reportRow,
  };
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
        lane: "idp_route_db_smoke",
      },
    })
    .select(
      "id, assessment_assignment_id, organization_id, participant_id, report_type, audience, source_type, report_status, input_snapshot, report_snapshot, failure_reason, generator_type, generator_version, contract_version",
    )
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to insert assessment_reports fixture row: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

async function renderRoutePage(routeModule, assessmentReportId, activeOrganization) {
  runtimeState.activeOrganization = activeOrganization;
  const element = await routeModule.default({
    params: {
      assessmentReportId,
    },
  });

  return ReactDOMServer.renderToStaticMarkup(element);
}

async function main() {
  loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(
      JSON.stringify(
        buildSkipResult("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.", {
          tested: "script wiring only",
          skipped_target: "Individual Development Profile route DB smoke",
        }),
        null,
        2,
      ),
    );
    return;
  }

  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const {
    loadIndividualDevelopmentProfileDisplay,
  } = require("../lib/assessment/individual-development-profile-display.ts");
  const {
    validateIndividualDevelopmentProfileSnapshot,
  } = require("../lib/assessment/individual-development-profile-contract.ts");
  const {
    generateIndividualDevelopmentProfileReport,
  } = require("../lib/assessment/individual-development-profile-provider.ts");
  const routeModule = require(routePath);

  const supabase = createSupabaseAdminClient();
  const token = crypto.randomUUID().slice(0, 8);
  const queuedAt = new Date().toISOString();
  const startedAt = new Date(Date.now() + 60_000).toISOString();
  const completedAt = new Date(Date.now() + 120_000).toISOString();
  const createdIds = {
    organizationIds: [],
    participantIds: [],
    assignmentIds: [],
    reportIds: [],
  };

  const secrets = {
    input: `IDP_INPUT_SECRET_${token}`,
    failure: `IDP_FAILURE_SECRET_${token}`,
    invalid: `IDP_INVALID_SECRET_${token}`,
  };

  try {
    const primaryOrganization = await insertOrganization(supabase, token, "primary");
    createdIds.organizationIds.push(primaryOrganization.id);

    const wrongOrganization = await insertOrganization(supabase, token, "wrong");
    createdIds.organizationIds.push(wrongOrganization.id);

    const participant = await insertParticipant(supabase, primaryOrganization.id, token);
    createdIds.participantIds.push(participant.id);

    const readySeedInputSnapshot = buildInputSnapshot({
      assessmentAssignmentId: crypto.randomUUID(),
      participantId: participant.id,
      displayName: participant.full_name,
      fixtureToken: token,
      inputSecret: secrets.input,
    });
    const readyReportResult = await generateIndividualDevelopmentProfileReport(
      readySeedInputSnapshot,
    );

    assert.equal(readyReportResult.ok, true, "Expected mock provider to produce ready snapshot.");
    const readySnapshotValidation = validateIndividualDevelopmentProfileSnapshot(
      readyReportResult.reportSnapshot,
    );
    assert.equal(readySnapshotValidation.ok, true, "Expected ready snapshot to validate.");

    const readyFixture = await createAssessmentReportFixture(supabase, {
      createdIds,
      organizationId: primaryOrganization.id,
      participantId: participant.id,
      displayName: participant.full_name,
      assignmentToken: `${token}-ready`,
      fixtureToken: token,
      inputSecret: secrets.input,
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
    const readyRow = readyFixture.reportRow;

    const queuedFixture = await createAssessmentReportFixture(supabase, {
      createdIds,
      organizationId: primaryOrganization.id,
      participantId: participant.id,
      displayName: participant.full_name,
      assignmentToken: `${token}-queued-assignment`,
      fixtureToken: `${token}-queued`,
      inputSecret: secrets.input,
      reportStatus: "queued",
      reportSnapshot: null,
      queuedAt,
    });
    const queuedRow = queuedFixture.reportRow;

    const processingFixture = await createAssessmentReportFixture(supabase, {
      createdIds,
      organizationId: primaryOrganization.id,
      participantId: participant.id,
      displayName: participant.full_name,
      assignmentToken: `${token}-processing-assignment`,
      fixtureToken: `${token}-processing`,
      inputSecret: secrets.input,
      reportStatus: "processing",
      reportSnapshot: null,
      queuedAt,
      startedAt,
    });
    const processingRow = processingFixture.reportRow;

    const failedFixture = await createAssessmentReportFixture(supabase, {
      createdIds,
      organizationId: primaryOrganization.id,
      participantId: participant.id,
      displayName: participant.full_name,
      assignmentToken: `${token}-failed-assignment`,
      fixtureToken: `${token}-failed`,
      inputSecret: secrets.input,
      reportStatus: "failed",
      reportSnapshot: null,
      failureCode: "IDP_PROVIDER_FAILED",
      failureReason: `Internal smoke failure secret ${secrets.failure}`,
      queuedAt,
      startedAt,
      completedAt,
    });
    const failedRow = failedFixture.reportRow;

    const invalidFixture = await createAssessmentReportFixture(supabase, {
      createdIds,
      organizationId: primaryOrganization.id,
      participantId: participant.id,
      displayName: participant.full_name,
      assignmentToken: `${token}-invalid-assignment`,
      fixtureToken: `${token}-invalid`,
      inputSecret: secrets.invalid,
      reportStatus: "ready",
      generatorType: "mock",
      generatorVersion: "individual_development_profile_mock_v1",
      contractVersion: "v1",
      reportSnapshot: {
        fixtureToken: token,
        reportType: "invalid_idp_snapshot",
        internalSmokeSecret: secrets.invalid,
      },
      queuedAt,
      startedAt,
      completedAt,
      generatedAt: completedAt,
    });
    const invalidRow = invalidFixture.reportRow;

    const { data: persistedReadyRow, error: readyLoadError } = await supabase
      .from("assessment_reports")
      .select(
        "id, report_type, audience, source_type, report_status, input_snapshot, report_snapshot",
      )
      .eq("id", readyRow.id)
      .maybeSingle();

    if (readyLoadError || !persistedReadyRow) {
      throw new Error(
        `Failed to reload persisted ready IDP row: ${readyLoadError?.message ?? "unknown error"}`,
      );
    }

    assert.equal(persistedReadyRow.report_type, "individual_development_profile");
    assert.equal(persistedReadyRow.audience, "hr");
    assert.equal(persistedReadyRow.source_type, "assessment");
    assert.equal(persistedReadyRow.report_status, "ready");
    assert.equal(persistedReadyRow.input_snapshot.inputType, "individual_development_profile_input_v1");
    assert.equal(
      JSON.stringify(persistedReadyRow.input_snapshot).includes('"rawAnswers"'),
      false,
      "Reduced input snapshot must not contain rawAnswers.",
    );
    assert.equal(
      JSON.stringify(persistedReadyRow.input_snapshot).includes('"report_snapshot"'),
      false,
      "Reduced input snapshot must not embed report_snapshot.",
    );

    const displayReady = await loadIndividualDevelopmentProfileDisplay({
      assessmentReportId: readyRow.id,
      organizationId: primaryOrganization.id,
    });

    assert.equal(displayReady.ok, true);
    assert.equal(displayReady.status, "ready");
    assert.equal(displayReady.reportId, readyRow.id);
    assert.equal(displayReady.hasInputSnapshot, true);
    assert.equal(displayReady.hasReportSnapshot, true);
    assert.equal(displayReady.safeStatusMessage, "Izvještaj je spreman za pregled.");

    const displayWrongOrganization = await loadIndividualDevelopmentProfileDisplay({
      assessmentReportId: readyRow.id,
      organizationId: wrongOrganization.id,
    });

    assert.equal(displayWrongOrganization.ok, true);
    assert.equal(displayWrongOrganization.status, "missing");
    assert.equal(displayWrongOrganization.reportId, null);
    assert.equal(displayWrongOrganization.reportSnapshot, null);

    const displayMissing = await loadIndividualDevelopmentProfileDisplay({
      assessmentReportId: crypto.randomUUID(),
      organizationId: primaryOrganization.id,
    });

    assert.equal(displayMissing.ok, true);
    assert.equal(displayMissing.status, "missing");
    assert.equal(displayMissing.reportId, null);

    const displayQueued = await loadIndividualDevelopmentProfileDisplay({
      assessmentReportId: queuedRow.id,
      organizationId: primaryOrganization.id,
    });
    assert.equal(displayQueued.ok, true);
    assert.equal(displayQueued.status, "queued");
    assert.equal(displayQueued.reportSnapshot, null);
    assert.equal(displayQueued.safeStatusMessage, "Izvještaj je pripremljen za obradu.");

    const displayProcessing = await loadIndividualDevelopmentProfileDisplay({
      assessmentReportId: processingRow.id,
      organizationId: primaryOrganization.id,
    });
    assert.equal(displayProcessing.ok, true);
    assert.equal(displayProcessing.status, "processing");
    assert.equal(displayProcessing.reportSnapshot, null);
    assert.equal(displayProcessing.safeStatusMessage, "Izvještaj je trenutno u obradi.");

    const displayFailed = await loadIndividualDevelopmentProfileDisplay({
      assessmentReportId: failedRow.id,
      organizationId: primaryOrganization.id,
    });
    assert.equal(displayFailed.ok, true);
    assert.equal(displayFailed.status, "failed");
    assert.equal(displayFailed.reportSnapshot, null);
    assert.equal(displayFailed.safeStatusMessage, "Izvještaj trenutno nije dostupan za pregled.");
    assert.equal("validationErrors" in displayFailed, false);

    const displayInvalid = await loadIndividualDevelopmentProfileDisplay({
      assessmentReportId: invalidRow.id,
      organizationId: primaryOrganization.id,
    });
    assert.equal(displayInvalid.ok, true);
    assert.equal(displayInvalid.status, "invalid");
    assert.equal(displayInvalid.reportSnapshot, null);
    assert.ok(Array.isArray(displayInvalid.validationErrors));
    assert.ok(displayInvalid.validationErrors.length > 0);
    assert.equal(displayInvalid.safeStatusMessage, "Izvještaj trenutno nije dostupan za pregled.");

    const readyHtml = await renderRoutePage(routeModule, readyRow.id, {
      id: primaryOrganization.id,
      name: primaryOrganization.name,
    });
    assert.match(readyHtml, /Individualni razvojni profil/);
    assert.match(readyHtml, /Razvojni sažetak/);
    assert.match(readyHtml, /Kako osoba može najbolje doprinijeti/);
    assert.match(readyHtml, /Šta može blokirati razvoj/);
    assert.match(readyHtml, /Komunikacija i feedback/);
    assert.match(readyHtml, /Motivacija i energija/);
    assert.match(readyHtml, /1:1 razgovori/);
    assert.match(readyHtml, /Onboarding i razvojni plan/);
    assert.match(readyHtml, /Na šta menadžer treba obratiti pažnju/);
    assertNoHtmlLeak(
      readyHtml,
      [
        secrets.input,
        "input_snapshot",
        "report_snapshot",
        "error_message",
        "OpenAI",
        "openai",
        "fit score",
        "hire/no-hire",
        "candidate-facing",
      ],
      "Ready IDP route HTML",
    );

    const wrongOrganizationHtml = await renderRoutePage(routeModule, readyRow.id, {
      id: wrongOrganization.id,
      name: wrongOrganization.name,
    });
    assert.match(wrongOrganizationHtml, /Izvještaj nije dostupan/);
    assert.match(
      wrongOrganizationHtml,
      /Traženi Individualni razvojni profil nije dostupan u aktivnoj organizaciji/,
    );
    assertNoHtmlLeak(
      wrongOrganizationHtml,
      [participant.id, readyRow.id, secrets.input, "report_snapshot", "error_message"],
      "Cross-org IDP route HTML",
    );

    const missingHtml = await renderRoutePage(routeModule, crypto.randomUUID(), {
      id: primaryOrganization.id,
      name: primaryOrganization.name,
    });
    assert.match(missingHtml, /Izvještaj nije dostupan/);
    assert.match(
      missingHtml,
      /Traženi Individualni razvojni profil nije dostupan u aktivnoj organizaciji/,
    );

    const failedHtml = await renderRoutePage(routeModule, failedRow.id, {
      id: primaryOrganization.id,
      name: primaryOrganization.name,
    });
    assert.match(failedHtml, /Izvještaj trenutno nije dostupan/);
    assertNoHtmlLeak(
      failedHtml,
      [secrets.failure, "error_message", "report_snapshot", "OpenAI", "openai"],
      "Failed IDP route HTML",
    );

    const invalidHtml = await renderRoutePage(routeModule, invalidRow.id, {
      id: primaryOrganization.id,
      name: primaryOrganization.name,
    });
    assert.match(invalidHtml, /Izvještaj trenutno nije dostupan/);
    assertNoHtmlLeak(
      invalidHtml,
      [secrets.invalid, "error_message", "report_snapshot", "input_snapshot"],
      "Invalid IDP route HTML",
    );
    console.log("test-individual-development-profile-route-db-smoke: ok");
  } catch (error) {
    if (isMissingIdpAssessmentReportsSchema(error)) {
      console.log(
        JSON.stringify(
          buildSkipResult(
            "Current .env.local Supabase runtime has not applied the assessment_reports IDP report_type expansion yet.",
            {
              tested: "fixture creation, display helper wiring, route render wiring",
              skipped_target: "persisted IDP assessment_reports DB smoke",
              schema_blocker: "assessment_reports_report_type_check",
            },
          ),
          null,
          2,
        ),
      );
      return;
    }

    throw error;
  } finally {
    await safeDeleteByIds(supabase, "assessment_reports", createdIds.reportIds);
    await safeDeleteByIds(supabase, "assessment_assignments", createdIds.assignmentIds);
    await safeDeleteByIds(supabase, "participants", createdIds.participantIds);

    for (const organizationId of createdIds.organizationIds) {
      await safeDeleteById(supabase, "organizations", organizationId);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
