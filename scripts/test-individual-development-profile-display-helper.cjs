const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "individual-development-profile-display.ts",
);
const contractPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "individual-development-profile-contract.ts",
);
const helperSource = fs.readFileSync(helperPath, "utf8");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

assert.match(helperSource, /export async function loadIndividualDevelopmentProfileDisplay/);
assert.match(helperSource, /validateIndividualDevelopmentProfileSnapshot/);
assert.match(helperSource, /loadLatestIndividualDevelopmentProfileAssessmentReportRow/);
assert.match(helperSource, /loadIndividualDevelopmentProfileAssessmentReportRowById/);
assert.match(helperSource, /Izvještaj je pripremljen za obradu/);
assert.match(helperSource, /Izvještaj je trenutno u obradi/);
assert.match(helperSource, /Izvještaj trenutno nije dostupan za pregled/);
assert.doesNotMatch(helperSource, /buildIndividualDevelopmentProfileInputSnapshot/);
assert.doesNotMatch(helperSource, /processIndividualDevelopmentProfileAssessmentReport/);
assert.doesNotMatch(helperSource, /generateIndividualDevelopmentProfileReport/);
assert.doesNotMatch(helperSource, /generateIndividualDevelopmentProfileWithMock/);
assert.doesNotMatch(helperSource, /OpenAI|openai|external/i);
assert.doesNotMatch(helperSource, /renderer|route|action|worker|scheduler/i);
assert.doesNotMatch(helperSource, /team-fit|team_dynamics/i);
assert.doesNotMatch(helperSource, /\.update\(/);
assert.doesNotMatch(helperSource, /\.insert\(/);
assert.doesNotMatch(helperSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("team_assessment_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("team_fit_reports"\)/);

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
  if (request === "server-only" || request === "@/lib/supabase/admin") {
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

const {
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
  validateIndividualDevelopmentProfileSnapshot,
} = require(contractPath);
const { loadIndividualDevelopmentProfileDisplay } = require(helperPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildReportSnapshot(overrides = {}) {
  return {
    reportType: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
    reportVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
    locale: "bs",
    audience: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
    developmentSummary: {
      headline: "Sažetak razvoja je spreman za HR pregled.",
      overallPattern:
        "Signal sugeriše da je korisno postaviti jasna očekivanja i ritam povratne informacije.",
      strongestContributionSignals: ["Jasan saradnički signal u strukturisanom radu."],
      mainSupportNeed: "Najviše koristi od jasnog prioritiziranja i konteksta.",
      usageNote: "Nalaz čitati kao razvojnu hipotezu, ne kao finalnu procjenu učinka.",
    },
    contributionPattern: {
      bestConditions: ["Pregledan scope i jasni koraci."],
      collaborationConditions: ["Redovan dogovor o prioritetima."],
      supportPreferences: ["Kratki i konkretni feedback loopovi."],
      roleShapingImplications: ["Ulogu uvoditi kroz jasne odgovornosti."],
    },
    developmentRisks: [
      {
        possibleBlocker: "Nejasni prioriteti mogu usporiti razvoj.",
        whyItMatters: "Bez jasnog fokusa signal je teže pretvoriti u stabilan napredak.",
        whatToCheck: "Provjeriti kako osoba traži kontekst i prioritete.",
        howToSupport: "Dogovoriti ritam poravnanja očekivanja.",
      },
    ],
    communicationAndFeedbackGuidance: {
      whatHelps: ["Kratak kontekst prije feedbacka."],
      whatToAvoid: ["Previše opštih komentara bez primjera."],
      howToPhraseFeedback: ["Povezati feedback sa konkretnim ponašanjem."],
      whatToClarify: ["Koji ishod je prioritetan u narednom periodu."],
    },
    motivationAndEnergyGuidance: {
      likelySourcesOfEnergy: ["Vidljiv napredak i smislen cilj."],
      likelySourcesOfDrain: ["Dug period bez povratne informacije."],
      supportSignals: ["Provjeriti gdje osoba vidi najviše smisla."],
      whatToValidate: ["Šta joj pomaže da zadrži ritam i fokus."],
    },
    oneOnOneGuidance: [
      {
        question: "Koji tip zadataka ti najlakše drži energiju stabilnom?",
        whatToListenFor: "Da li osoba jasno prepoznaje uslove u kojima najbolje funkcioniše.",
        signalBeingChecked: "Samouvid o izvorima angažmana i ritmu rada.",
        possibleFollowUp: "Koju podršku bi željela u prvih mjesec dana?",
      },
    ],
    onboardingAndDevelopmentPlan: {
      first30Days: ["Definisati očekivanja i ritam check-in sastanaka."],
      days31To60: ["Provjeriti kako se signal prevodi u svakodnevni rad."],
      days61To90: ["Ažurirati razvojne prioritete prema opaženim obrascima."],
    },
    managerWatchpoints: [
      {
        watchpoint: "Pad energije kada je prioritet mutan.",
        whyItMatters: "Može usporiti uhodavanje u ulozi.",
        earlySignal: "Više traženja potvrde oko redoslijeda zadataka.",
        suggestedManagerResponse: "Pojačati kratke alignment razgovore.",
      },
    ],
    interpretationLimits: [
      "Izvještaj je HR-facing razvojni artefakt i ne zamjenjuje direktno opažanje rada.",
    ],
    metadata: {
      generatedAt: "2026-06-02T12:00:00.000Z",
      generatorType: "mock",
      generatorVersion: "individual_development_profile_mock_v1",
      inputVersion: "individual_development_profile_input_v1",
    },
    ...overrides,
  };
}

function buildRow(overrides = {}) {
  return {
    id: "assessment-report-1",
    assessment_assignment_id: "assignment-1",
    organization_id: "org-1",
    participant_id: "participant-1",
    report_type: "individual_development_profile",
    audience: "hr",
    source_type: "assessment",
    report_status: "queued",
    generator_type: null,
    contract_version: null,
    prompt_version_id: null,
    model_name: null,
    generator_version: null,
    input_snapshot: null,
    report_snapshot: null,
    failure_code: null,
    failure_reason: null,
    queued_at: "2026-06-02T12:00:00.000Z",
    started_at: null,
    completed_at: null,
    generated_at: null,
    created_at: "2026-06-02T12:00:00.000Z",
    updated_at: "2026-06-02T12:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

function createSupabaseStub(initialState = {}) {
  const state = {
    assessment_reports: [...(initialState.assessment_reports ?? [])],
    attempt_reports: [...(initialState.attempt_reports ?? [])],
    team_assessment_reports: [...(initialState.team_assessment_reports ?? [])],
    team_fit_reports: [...(initialState.team_fit_reports ?? [])],
  };

  function applyFilters(rows, filters) {
    return rows.filter((row) =>
      filters.every((filter) => {
        if (filter.type === "eq") {
          return row[filter.column] === filter.value;
        }

        return true;
      }),
    );
  }

  function applyOrders(rows, orders) {
    return [...rows].sort((left, right) => {
      for (const order of orders) {
        const leftValue = left[order.column];
        const rightValue = right[order.column];

        if (leftValue === rightValue) {
          continue;
        }

        const comparison = String(leftValue).localeCompare(String(rightValue));
        return order.ascending ? comparison : -comparison;
      }

      return 0;
    });
  }

  return {
    state,
    from(table) {
      const query = {
        filters: [],
        orders: [],
        limitCount: null,
      };

      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          query.filters.push({ type: "eq", column, value });
          return builder;
        },
        order(column, options = {}) {
          query.orders.push({ column, ascending: options.ascending !== false });
          return builder;
        },
        limit(value) {
          query.limitCount = value;
          return builder;
        },
        async maybeSingle() {
          const rows = applyFilters(state[table] ?? [], query.filters);
          const ordered = applyOrders(rows, query.orders);
          const limited =
            typeof query.limitCount === "number" ? ordered.slice(0, query.limitCount) : ordered;
          return { data: clone(limited[0] ?? null), error: null };
        },
        then(resolve, reject) {
          try {
            const rows = applyFilters(state[table] ?? [], query.filters);
            const ordered = applyOrders(rows, query.orders);
            const limited =
              typeof query.limitCount === "number" ? ordered.slice(0, query.limitCount) : ordered;
            return Promise.resolve({ data: clone(limited), error: null }).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        },
      };

      return {
        select() {
          return builder.select();
        },
      };
    },
  };
}

async function main() {
  const missingResult = await loadIndividualDevelopmentProfileDisplay(
    {
      organizationId: "org-1",
      assessmentAssignmentId: "assignment-1",
    },
    {
      supabase: createSupabaseStub(),
    },
  );
  assert.equal(missingResult.ok, true);
  if (missingResult.ok) {
    assert.equal(missingResult.status, "missing");
    assert.equal(missingResult.reportSnapshot, null);
  }

  const queuedResult = await loadIndividualDevelopmentProfileDisplay(
    {
      organizationId: "org-1",
      assessmentAssignmentId: "assignment-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [buildRow({ report_status: "queued", report_snapshot: buildReportSnapshot() })],
      }),
    },
  );
  assert.equal(queuedResult.ok, true);
  if (queuedResult.ok) {
    assert.equal(queuedResult.status, "queued");
    assert.equal(queuedResult.reportSnapshot, null);
    assert.equal("validationErrors" in queuedResult, false);
  }

  const processingResult = await loadIndividualDevelopmentProfileDisplay(
    {
      organizationId: "org-1",
      assessmentReportId: "assessment-report-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [buildRow({ report_status: "processing", started_at: "2026-06-02T12:05:00.000Z" })],
      }),
    },
  );
  assert.equal(processingResult.ok, true);
  if (processingResult.ok) {
    assert.equal(processingResult.status, "processing");
    assert.equal(processingResult.reportSnapshot, null);
  }

  const failedResult = await loadIndividualDevelopmentProfileDisplay(
    {
      organizationId: "org-1",
      assessmentReportId: "assessment-report-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [
          buildRow({
            report_status: "failed",
            failure_reason: "Internal debug message that should not leak.",
          }),
        ],
      }),
    },
  );
  assert.equal(failedResult.ok, true);
  if (failedResult.ok) {
    assert.equal(failedResult.status, "failed");
    assert.equal(failedResult.reportSnapshot, null);
    assert.equal(JSON.stringify(failedResult).includes("Internal debug message"), false);
  }

  const readySnapshot = buildReportSnapshot();
  const readyResult = await loadIndividualDevelopmentProfileDisplay(
    {
      organizationId: "org-1",
      assessmentReportId: "assessment-report-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [
          buildRow({
            report_status: "ready",
            report_snapshot: readySnapshot,
            generator_type: "mock",
            generator_version: "individual_development_profile_mock_v1",
            model_name: "mock-model",
            completed_at: "2026-06-02T12:10:00.000Z",
            generated_at: "2026-06-02T12:10:00.000Z",
          }),
        ],
      }),
    },
  );
  assert.equal(readyResult.ok, true);
  if (readyResult.ok) {
    assert.equal(readyResult.status, "ready");
    assert.deepEqual(readyResult.reportSnapshot, readySnapshot);
    assert.equal(validateIndividualDevelopmentProfileSnapshot(readyResult.reportSnapshot).ok, true);
    assert.equal(readyResult.metadata.generatorType, "mock");
  }

  const invalidResult = await loadIndividualDevelopmentProfileDisplay(
    {
      organizationId: "org-1",
      assessmentReportId: "assessment-report-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [
          buildRow({
            report_status: "ready",
            report_snapshot: {
              reportType: "individual_development_profile_v1",
              reportVersion: "v1",
              locale: "bs",
              audience: "hr",
            },
          }),
        ],
      }),
    },
  );
  assert.equal(invalidResult.ok, true);
  if (invalidResult.ok) {
    assert.equal(invalidResult.status, "invalid");
    assert.equal(invalidResult.reportSnapshot, null);
    assert.ok(Array.isArray(invalidResult.validationErrors));
    assert.equal(JSON.stringify(invalidResult).includes("developmentSummary"), true);
  }

  const wrongOrganizationResult = await loadIndividualDevelopmentProfileDisplay(
    {
      organizationId: "org-2",
      assessmentAssignmentId: "assignment-1",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [buildRow()],
      }),
    },
  );
  assert.equal(wrongOrganizationResult.ok, true);
  if (wrongOrganizationResult.ok) {
    assert.equal(wrongOrganizationResult.status, "missing");
  }

  const wrongParticipantResult = await loadIndividualDevelopmentProfileDisplay(
    {
      organizationId: "org-1",
      assessmentAssignmentId: "assignment-1",
      participantId: "participant-2",
    },
    {
      supabase: createSupabaseStub({
        assessment_reports: [buildRow()],
      }),
    },
  );
  assert.equal(wrongParticipantResult.ok, true);
  if (wrongParticipantResult.ok) {
    assert.equal(wrongParticipantResult.status, "missing");
  }

  for (const row of [
    buildRow({ report_type: "composite" }),
    buildRow({ audience: "candidate" }),
    buildRow({ source_type: "attempt" }),
  ]) {
    const result = await loadIndividualDevelopmentProfileDisplay(
      {
        organizationId: "org-1",
        assessmentAssignmentId: "assignment-1",
      },
      {
        supabase: createSupabaseStub({
          assessment_reports: [row],
        }),
      },
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.status, "missing");
    }
  }

  const invalidPayloadResult = await loadIndividualDevelopmentProfileDisplay(
    {
      organizationId: "",
      assessmentAssignmentId: "assignment-1",
    },
    {
      supabase: createSupabaseStub(),
    },
  );
  assert.deepEqual(invalidPayloadResult, {
    ok: false,
    reason: "invalid_payload",
    details: "organizationId is required.",
  });

  console.log("test-individual-development-profile-display-helper: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
