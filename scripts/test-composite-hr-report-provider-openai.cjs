const assert = require("node:assert/strict");
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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  validateCompositeHrReportSnapshot,
} = require("../lib/assessment/composite-hr-report-contract.ts");
const {
  generateCompositeHrReportSnapshot,
} = require("../lib/assessment/composite-hr-report-provider.ts");
const {
  generateOpenAiCompositeHrReport,
  evaluateCompositeHrReportValidatorBoundary,
} = require("../lib/assessment/composite-hr-report-provider-openai.ts");
const {
  COMPOSITE_HR_BHS_GLOSSARY_PROMPT,
  COMPOSITE_HR_BHS_LANGUAGE_RULES,
  COMPOSITE_HR_BHS_REVIEWER_RULES,
} = require("../lib/assessment/report-language-quality.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildCompositeInputSnapshotFixture(overrides = {}) {
  return {
    contractVersion: "composite_hr_input_v1",
    targetReportContractVersion: "composite_hr_v1",
    sourceType: "assessment",
    reportType: "composite",
    audience: "hr",
    locale: "bs",
    addressingForm: "masculine",
    generatedFor: {
      organizationId: "org-1",
      participantId: "participant-1",
      assessmentAssignmentId: "assignment-1",
    },
    assessmentAssignment: {
      id: "assignment-1",
      assignmentType: "standard_battery",
      status: "active",
      locale: "bs",
      createdAt: "2026-05-12T06:00:00.000Z",
    },
    sourceAttempts: [
      {
        attemptId: "attempt-ipip",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        status: "completed",
        completedAt: "2026-05-12T06:30:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 0,
      },
      {
        attemptId: "attempt-safran",
        testId: "test-safran",
        testSlug: "safran_v1",
        status: "completed",
        completedAt: "2026-05-12T06:45:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 1,
      },
      {
        attemptId: "attempt-mwms",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        status: "completed",
        completedAt: "2026-05-12T07:00:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 2,
      },
    ],
    coverage: {
      requiredCount: 3,
      completedCount: 3,
      requiredTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
      completedTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
      missingTestSlugs: [],
    },
    deterministicInputs: {
      ipip: {
        attemptId: "attempt-ipip",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        scale: { min: 1, max: 5 },
        domains: [
          {
            domainCode: "CONSCIENTIOUSNESS",
            label: "Savjesnost",
            rawScore: 24,
            scoredQuestionCount: 12,
            averageScore: 4,
            band: "higher",
            bandLabel: "Više izraženo",
            displayScore: 4,
            displayBand: "higher",
            displayBandLabel: "Više izraženo",
            facets: [],
          },
          {
            domainCode: "AGREEABLENESS",
            label: "Spremnost na saradnju",
            rawScore: 18,
            scoredQuestionCount: 12,
            averageScore: 3,
            band: "balanced",
            bandLabel: "Uravnoteženo",
            displayScore: 3,
            displayBand: "balanced",
            displayBandLabel: "Uravnoteženo",
            facets: [],
          },
          {
            domainCode: "EXTRAVERSION",
            label: "Ekstraverzija",
            rawScore: 21,
            scoredQuestionCount: 12,
            averageScore: 3.5,
            band: "balanced",
            bandLabel: "Uravnoteženo",
            displayScore: 3.5,
            displayBand: "balanced",
            displayBandLabel: "Uravnoteženo",
            facets: [],
          },
          {
            domainCode: "NEUROTICISM",
            label: "Neuroticizam",
            rawScore: 26,
            scoredQuestionCount: 12,
            averageScore: 2.17,
            band: "lower",
            bandLabel: "Niže izraženo",
            displayScore: 3.83,
            displayBand: "higher",
            displayBandLabel: "Više izraženo",
            facets: [],
          },
          {
            domainCode: "OPENNESS",
            label: "Otvorenost",
            rawScore: 20,
            scoredQuestionCount: 12,
            averageScore: 3.33,
            band: "balanced",
            bandLabel: "Uravnoteženo",
            displayScore: 3.33,
            displayBand: "balanced",
            displayBandLabel: "Uravnoteženo",
            facets: [],
          },
        ],
        summarySignals: {
          rankedDomains: ["CONSCIENTIOUSNESS", "AGREEABLENESS", "EXTRAVERSION"],
          highestDomains: ["CONSCIENTIOUSNESS"],
          lowestDomains: ["NEUROTICISM"],
          balancedDomains: [],
          topFacets: [],
          lowestFacets: [],
        },
      },
      safran: {
        attemptId: "attempt-safran",
        testId: "test-safran",
        testSlug: "safran_v1",
        overall: { rawScore: 36, maxScore: 54, band: "moderate_raw", interpretation: "moderate" },
        verbal: { rawScore: 14, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        figural: { rawScore: 10, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        numeric: { rawScore: 12, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        summarySignals: {
          strongestDomain: "verbal",
          lowestDomain: "figural",
        },
      },
      mwms: {
        attemptId: "attempt-mwms",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        scale: { min: 1, max: 7 },
        dimensions: [],
        motivationStructure: {
          autonomousMotivationScore: 6,
          controlledMotivationScore: 3.5,
          amotivationScore: 1.8,
        },
        summarySignals: {
          dominantDrivers: ["intrinsic", "identified"],
          lowerDrivers: ["amotivation", "external_social"],
          cautionFlags: {
            elevatedAmotivation: false,
            highControlledRelativeToAutonomous: false,
            mixedProfile: false,
          },
        },
      },
    },
    summarySignals: {
      personalityHighestDomains: ["CONSCIENTIOUSNESS"],
      personalityLowestDomains: ["NEUROTICISM"],
      cognitiveStrongestDomain: "verbal",
      cognitiveLowestDomain: "figural",
      motivationHighestDrivers: ["intrinsic", "identified"],
      motivationLowestDrivers: ["amotivation", "external_social"],
      crossInstrumentFlags: [],
    },
    guardrails: {
      usesOnlyLinkedAssignmentAttempts: true,
      usesHistoricalAttemptFallback: false,
      usesSingleTestAiReportsAsPrimaryInput: false,
      aiMayNotChangeScores: true,
    },
    metadata: {
      builtAt: "2026-05-12T09:00:00.000Z",
      builderVersion: "v1",
    },
    ...overrides,
  };
}

function buildOpenAiSnapshotFixture(inputSnapshot, overrides = {}) {
  return {
    contractVersion: "composite_hr_v1",
    reportType: "composite",
    audience: "hr",
    sourceType: "assessment",
    locale: inputSnapshot.locale,
    generatedFor: {
      organizationId: inputSnapshot.generatedFor.organizationId,
      participantId: inputSnapshot.generatedFor.participantId,
      assessmentAssignmentId: inputSnapshot.generatedFor.assessmentAssignmentId,
    },
    source: {
      inputContractVersion: inputSnapshot.contractVersion,
      sourceAttemptIds: inputSnapshot.sourceAttempts.map((attempt) => attempt.attemptId),
      testSlugs: [...inputSnapshot.coverage.completedTestSlugs],
    },
    summary: {
      headline: "Pouzdan stil rada uz dobar analiticki kapacitet",
      profileOverview:
        "Najvazniji radni signal je pouzdan stil rada uz dobar analiticki kapacitet. U intervjuu provjerite kako osoba postavlja prioritete kada se zahtjevi promijene. Koristite ovaj nalaz za jasnije definisanje uloge i prvih onboarding ocekivanja.",
      keyStrengths: [
        "Jasna tragljivost izvora kroz linked assessment attempts.",
        "Signal omogucava strukturisanu pripremu intervjua.",
      ],
      watchouts: [
        "U intervjuu provjerite konkretan primjer rada pod promjenom prioriteta.",
        "Tražite primjer situacije u kojoj je osoba uskladila kvalitet rada sa zahtjevima pozicije.",
      ],
    },
    integratedSignals: [
      {
        id: "signal-personality",
        title: "Ponasajni fokus za razgovor",
        body: "U radu ovo upucuje na potrebu za jasnim prioritetima. Provjerite kako osoba strukturise rad kada se prioriteti promijene.",
        evidence: [
          {
            testSlug: "ipip-neo-120-v1",
            label: "Najizrazeniji domen licnosti",
            value: "CONSCIENTIOUSNESS",
          },
        ],
      },
      {
        id: "signal-cognitive",
        title: "Kognitivni fokus za zadatke",
        body: "Signal je najkorisniji za zadatke koji traze provjeru tacnosti. Tražite konkretan primjer nacina razmisljanja pod vremenskim ogranicenjem.",
        evidence: [
          {
            testSlug: "safran_v1",
            label: "Ukupni kognitivni rezultat",
            value: "36",
          },
        ],
      },
    ],
    interviewGuidance: {
      focusAreas: [
        {
          title: "Organizacija rada pod promjenama",
          rationale: "Ovo pomaže HR-u da provjeri kako osoba reaguje kada se ritam rada promijeni.",
          questions: [
            "Kako organizujete rad kada se prioriteti promijene u kratkom roku?",
            "Kako provjeravate da je rjesenje i dalje kvalitetno kada imate vise paralelnih zahtjeva?",
          ],
        },
      ],
    },
    onboardingGuidance: {
      managementTips: [
        "Rano uskladiti kriterije kvaliteta i ritam kratkih provjera napretka.",
        "Koristiti konkretne radne primjere za prva uskladjivanja nacina rada.",
      ],
      supportNeeds: [
        "Vrijedi provjeriti koja kolicina strukture i povratne informacije najvise pomaze u prvim sedmicama.",
        "Za analiticke zadatke korisno je rano vidjeti kako osoba verbalizuje logiku i provjeru tacnosti.",
      ],
    },
    limitations: [
      "Ovaj izvjestaj je HR pomoc za interpretaciju deterministic inputa, ne automatska odluka.",
      "Nalaze treba citati zajedno sa iskustvom, intervjuom i zahtjevima konkretne uloge.",
    ],
    metadata: {
      provider: "openai",
      providerVersion: "v1",
      generatedAt: "2026-05-12T10:15:00.000Z",
    },
    ...overrides,
  };
}

function buildReviewerResponseFixture(overrides = {}) {
  return {
    approved: true,
    issues: [],
    summary: "Output passes language and HR safety review.",
    ...overrides,
  };
}

function buildFetchResponse(...payloads) {
  const queue = payloads.length > 0 ? [...payloads] : [{}];

  return async function fetchImpl() {
    const payload = queue.length > 1 ? queue.shift() : queue[0];

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify(payload),
              },
            },
          ],
        };
      },
      async text() {
        return JSON.stringify(payload);
      },
    };
  };
}

function buildCapturingFetchResponse(...payloads) {
  const calls = [];
  const queue = payloads.length > 0 ? [...payloads] : [{}];

  return {
    calls,
    fetchImpl: async function fetchImpl(_url, requestInit) {
      calls.push(requestInit);
      const payload = queue.length > 1 ? queue.shift() : queue[0];

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify(payload),
                },
              },
            ],
          };
        },
        async text() {
          return JSON.stringify(payload);
        },
      };
    },
  };
}

function collectStrings(value) {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStrings(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => collectStrings(item));
  }

  return [];
}

async function testProviderSelectorDefaultUsesMock() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const result = await generateCompositeHrReportSnapshot(inputSnapshot, {
    config: {
      provider: "mock",
      model: null,
      openAiApiKey: null,
      openAiTimeoutMs: 120000,
    },
  });

  assert.equal(result.generatorType, "mock");
  assert.equal(result.modelName, null);
  const validation = validateCompositeHrReportSnapshot(result.snapshot);
  assert.equal(validation.ok, true);
}

async function testOpenAiPathReturnsValidSnapshot() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const reportSnapshot = buildOpenAiSnapshotFixture(inputSnapshot);
  const result = await generateCompositeHrReportSnapshot(inputSnapshot, {
    config: {
      provider: "openai",
      model: "gpt-5.5",
      openAiApiKey: "test-key",
      openAiTimeoutMs: 120000,
    },
    generateOpenAiReport: async (snapshot, options) =>
      generateOpenAiCompositeHrReport(snapshot, {
        ...options,
        fetchImpl: buildFetchResponse(reportSnapshot, buildReviewerResponseFixture()),
        now: () => "2026-05-12T10:15:00.000Z",
      }),
  });

  assert.equal(result.generatorType, "openai");
  assert.equal(result.modelName, "gpt-5.5");
  assert.equal(result.snapshot.metadata.provider, "openai");
  assert.deepEqual(
    result.snapshot.source.sourceAttemptIds,
    inputSnapshot.sourceAttempts.map((attempt) => attempt.attemptId),
  );
  assert.equal(validateCompositeHrReportSnapshot(result.snapshot).ok, true);
}

async function testCompositeGenerationAndReviewerHaveSeparateUsageEvents() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const reportSnapshot = buildOpenAiSnapshotFixture(inputSnapshot);
  const starts = [];
  const completions = [];
  let nextEventId = 1;
  const usageRecorder = {
    async start(input) {
      starts.push(input);
      return { eventId: `event-${nextEventId++}`, startedAt: input.startedAt };
    },
    async succeed(eventId, input) {
      completions.push({ eventId, input });
    },
    async fail() {
      throw new Error("unexpected composite usage failure");
    },
  };

  await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.6-sol",
    usageRecorder,
    usageContext: {
      organizationId: "org-1",
      participantId: "participant-1",
      assessmentAssignmentId: "assignment-1",
      assessmentReportId: "assessment-report-1",
      reportType: "composite",
      callPurpose: "composite_hr_generation",
    },
    fetchImpl: buildFetchResponse(reportSnapshot, buildReviewerResponseFixture()),
  });

  assert.equal(starts.length, 2);
  assert.deepEqual(
    starts.map((entry) => entry.context.callPurpose),
    ["composite_hr_generation", "composite_hr_diagnostic_review"],
  );
  assert.equal(completions.length, 2);
  assert.notEqual(completions[0].eventId, completions[1].eventId);
}

async function testOpenAiInvalidOutputFailsValidation() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const invalidSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    contractVersion: "broken_contract",
  });

  await assert.rejects(
    () =>
      generateOpenAiCompositeHrReport(inputSnapshot, {
        apiKey: "test-key",
        model: "gpt-5.5",
        fetchImpl: buildFetchResponse(invalidSnapshot, buildReviewerResponseFixture()),
        now: () => "2026-05-12T10:15:00.000Z",
      }),
    /failed validation|contractVersion/i,
  );
}

async function testOpenAiMissingRequiredTextFailsValidation() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const invalidSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    summary: {
      headline: "",
      profileOverview: "U intervjuu provjerite konkretan primjer rada.",
      keyStrengths: ["Jasna tragljivost izvora."],
      watchouts: ["Tražite primjer rada pod pritiskom rokova."],
    },
  });

  await assert.rejects(
    () =>
      generateOpenAiCompositeHrReport(inputSnapshot, {
        apiKey: "test-key",
        model: "gpt-5.5",
        fetchImpl: buildFetchResponse(invalidSnapshot, buildReviewerResponseFixture()),
        now: () => "2026-05-12T10:15:00.000Z",
      }),
    /failed validation|summary\.headline/i,
  );
}

async function testWrongReportMetadataFailsValidation() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();

  for (const invalidSnapshot of [
    buildOpenAiSnapshotFixture(inputSnapshot, { reportType: "single_test" }),
    buildOpenAiSnapshotFixture(inputSnapshot, { audience: "participant" }),
    buildOpenAiSnapshotFixture(inputSnapshot, { sourceType: "single_test" }),
    buildOpenAiSnapshotFixture(inputSnapshot, { locale: "en" }),
  ]) {
    await assert.rejects(
      () =>
        generateOpenAiCompositeHrReport(inputSnapshot, {
          apiKey: "test-key",
          model: "gpt-5.5",
          fetchImpl: buildFetchResponse(invalidSnapshot, buildReviewerResponseFixture()),
          now: () => "2026-05-12T10:15:00.000Z",
        }),
      /failed validation|locale does not match|reportType|audience|sourceType/i,
    );
  }
}

async function testSourceImmutabilityFailsOnMutatedSource() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const invalidSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    source: {
      inputContractVersion: inputSnapshot.contractVersion,
      sourceAttemptIds: ["attempt-other"],
      testSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
    },
  });

  await assert.rejects(
    () =>
      generateOpenAiCompositeHrReport(inputSnapshot, {
        apiKey: "test-key",
        model: "gpt-5.5",
        fetchImpl: buildFetchResponse(invalidSnapshot, buildReviewerResponseFixture()),
        now: () => "2026-05-12T10:15:00.000Z",
      }),
    /sourceAttemptIds do not match/i,
  );
}

async function testForbiddenWordingIsDiagnosticOnly() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const invalidSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    summary: {
      headline: "Integrisani HR pregled",
      profileOverview:
        "Ovaj tekst govori da treba zaposliti osobu odmah, sto je zabranjeno.",
      keyStrengths: ["Jasna tragljivost izvora."],
      watchouts: ["U intervjuu provjerite konkretne primjere rada."],
    },
  });

  const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(invalidSnapshot),
    now: () => "2026-05-12T10:15:00.000Z",
  });
  const diagnostic = evaluateCompositeHrReportValidatorBoundary(inputSnapshot, invalidSnapshot, {
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(validateCompositeHrReportSnapshot(result).ok, true);
  assert.equal(diagnostic.hardGateWouldPersist, true);
  assert.equal(diagnostic.languageQualityResult.ok, false);
  assert.equal(diagnostic.languageQualityHardIssues.length + diagnostic.languageQualityWarnings.length > 0, true);
}

async function testRokoviVisokiIsDiagnosticWarningOnly() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const styleIssueSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    summary: {
      headline: "Integrisani HR pregled",
      profileOverview: "Glavni rizik zvuci kao rokovi visoki u svim situacijama.",
      keyStrengths: ["Jasna tragljivost izvora."],
      watchouts: ["U intervjuu provjerite konkretne primjere rada."],
    },
  });

  const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(styleIssueSnapshot, buildReviewerResponseFixture()),
    now: () => "2026-05-12T10:15:00.000Z",
  });
  const diagnostic = evaluateCompositeHrReportValidatorBoundary(inputSnapshot, styleIssueSnapshot, {
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(validateCompositeHrReportSnapshot(result).ok, true);
  assert.equal(diagnostic.hardGateWouldPersist, true);
  assert.equal(diagnostic.languageQualityHardIssues.length, 0);
  assert.equal(
    diagnostic.languageQualityWarnings.some((issue) => issue.phrase === "rokovi visoki"),
    true,
  );
}

async function testAgreeablenessGlossaryViolationsAreDiagnosticWarningsOnly() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();

  for (const forbiddenPhrase of ["Ugodnost", "Saradljivost"]) {
    const terminologyIssueSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
      summary: {
        headline: "Integrisani HR pregled",
        profileOverview: `${forbiddenPhrase} se navodi kao glavni domen za timski rad.`,
        keyStrengths: ["Jasna tragljivost izvora."],
        watchouts: ["U intervjuu provjerite konkretne primjere rada."],
      },
    });

    const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
      apiKey: "test-key",
      model: "gpt-5.5",
      fetchImpl: buildFetchResponse(terminologyIssueSnapshot, buildReviewerResponseFixture()),
      now: () => "2026-05-12T10:15:00.000Z",
    });
    const diagnostic = evaluateCompositeHrReportValidatorBoundary(inputSnapshot, terminologyIssueSnapshot, {
      now: () => "2026-05-12T10:15:00.000Z",
    });

    assert.equal(validateCompositeHrReportSnapshot(result).ok, true);
    assert.equal(diagnostic.hardGateWouldPersist, true);
    assert.equal(diagnostic.languageQualityHardIssues.length, 0);
    assert.equal(
      diagnostic.languageQualityWarnings.some((issue) => new RegExp(forbiddenPhrase, "i").test(issue.phrase)),
      true,
    );
  }
}

async function testAgreeablenessLabelReplacementRejectedButNarrativeSaradnjaAllowed() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();

  const invalidSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    integratedSignals: [
      {
        id: "signal-collaboration",
        title: "Timski signal",
        body: "U timskoj saradnji vrijedi provjeriti kako osoba gradi povjerenje i ritam rada.",
        evidence: [
          {
            testSlug: "ipip-neo-120-v1",
            label: "Saradnja",
            value: "izrazen signal",
          },
        ],
      },
    ],
  });

  const correctedAliasResult = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(invalidSnapshot, buildReviewerResponseFixture()),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(correctedAliasResult.integratedSignals[0].evidence[0].label, "Spremnost na saradnju");
  assert.equal(correctedAliasResult.integratedSignals[0].evidence[0].value, "3.00 (Uravnoteženo)");

  const validSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    integratedSignals: [
      {
        id: "signal-collaboration",
        title: "Timski signal",
        body: "U timskoj saradnji vrijedi provjeriti kako osoba gradi povjerenje i ritam rada.",
        evidence: [
          {
            testSlug: "ipip-neo-120-v1",
            label: "Spremnost na saradnju",
            value: "izrazen signal",
          },
        ],
      },
    ],
  });

  const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(validSnapshot, buildReviewerResponseFixture()),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(result.integratedSignals[0].body.includes("saradnji"), true);
  assert.equal(result.integratedSignals[0].evidence[0].label, "Spremnost na saradnju");
}

async function testAgreeablenessLegacyUgodnostEvidenceIsSourceLockedToCanonicalLabel() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const legacySnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    integratedSignals: [
      {
        id: "signal-collaboration",
        title: "Timski signal",
        body: "U timskoj saradnji vrijedi provjeriti kako osoba gradi povjerenje i ritam rada.",
        evidence: [
          {
            testSlug: "ipip-neo-120-v1",
            label: "Ugodnost",
            value: "3.00 (Uravnoteženo)",
          },
        ],
      },
    ],
  });

  const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(legacySnapshot, buildReviewerResponseFixture()),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(result.integratedSignals[0].evidence[0].label, "Spremnost na saradnju");
  assert.equal(result.integratedSignals[0].evidence[0].value, "3.00 (Uravnoteženo)");
}

async function testForbiddenHiringTermsAreDiagnosticOnly() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();

  for (const forbiddenText of [
    "Ovo je fit score za ulogu.",
    "Ovo je idealni kandidat za tim.",
    "Treba ga zaposliti odmah.",
    "Ne zaposliti bez dodatnog razgovora.",
  ]) {
    const invalidSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
      summary: {
        headline: "Integrisani HR pregled",
        profileOverview: forbiddenText,
        keyStrengths: ["Jasna tragljivost izvora."],
        watchouts: ["U intervjuu provjerite konkretne primjere rada."],
      },
    });

    const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
      apiKey: "test-key",
      model: "gpt-5.5",
      fetchImpl: buildFetchResponse(invalidSnapshot),
      now: () => "2026-05-12T10:15:00.000Z",
    });
    const diagnostic = evaluateCompositeHrReportValidatorBoundary(inputSnapshot, invalidSnapshot, {
      now: () => "2026-05-12T10:15:00.000Z",
    });

    assert.equal(validateCompositeHrReportSnapshot(result).ok, true);
    assert.equal(diagnostic.hardGateWouldPersist, true);
    assert.equal(diagnostic.languageQualityResult.ok, false);
    assert.equal(
      diagnostic.languageQualityHardIssues.length + diagnostic.languageQualityWarnings.length > 0,
      true,
    );
  }
}

async function testHardSafetyBreachesAreDiagnosticOnly() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();

  for (const forbiddenText of [
    "Ovaj profil ukazuje na ADHD dijagnozu i treba ga tretirati kao medicinski nalaz.",
    "Raw answers pokazuju da je na pitanje 12 odabran odgovor 5.",
    "Ovaj debug snapshot iz OpenAI provider requesta treba prikazati HR-u.",
    "Raw provider metadata iz structured output procesa treba prikazati HR-u.",
    "Likert odgovor za pitanje 12 bio je opcija 5.",
  ]) {
    const invalidSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
      summary: {
        headline: "Integrisani HR pregled",
        profileOverview: forbiddenText,
        keyStrengths: ["Jasna tragljivost izvora."],
        watchouts: ["U intervjuu provjerite konkretne primjere rada."],
      },
    });

    const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
      apiKey: "test-key",
      model: "gpt-5.5",
      fetchImpl: buildFetchResponse(invalidSnapshot, buildReviewerResponseFixture()),
      now: () => "2026-05-12T10:15:00.000Z",
    });
    const diagnostic = evaluateCompositeHrReportValidatorBoundary(inputSnapshot, invalidSnapshot, {
      now: () => "2026-05-12T10:15:00.000Z",
    });

    assert.equal(validateCompositeHrReportSnapshot(result).ok, true);
    assert.equal(diagnostic.hardGateWouldPersist, true);
    assert.equal(diagnostic.hardSafetyResult.ok, false);
    assert.equal(diagnostic.hardSafetyResult.issues.length > 0, true);
    assert.equal(
      diagnostic.hardSafetyResult.issues.some((issue) => forbiddenText.toLowerCase().includes(issue.phrase.toLowerCase())),
      true,
    );
  }
}

async function testBenignTechnicalWordsDoNotHardFail() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const benignSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    summary: {
      headline: "Integrisani HR pregled",
      profileOverview:
        "Ako HR interno poredi ovaj izvještaj sa drugim snapshot prikazom ili renderer pregledom, sadržaj ostaje isti. U intervjuu provjerite konkretan primjer rada.",
      keyStrengths: [
        "Provider kontekst ili OpenAI naziv ne mijenjaju interpretaciju kada nisu dio internog request loga.",
      ],
      watchouts: [
        "Likert format procjene može pomoći u objašnjenju skale, ali bez prikaza pojedinačnih stavki.",
      ],
    },
  });

  const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(benignSnapshot, buildReviewerResponseFixture()),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(validateCompositeHrReportSnapshot(result).ok, true);
}

async function testMutatedKnownEvidenceValueIsSourceLocked() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const mutatedSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    integratedSignals: [
      {
        id: "signal-collaboration",
        title: "Timski signal",
        body: "U timskoj saradnji vrijedi provjeriti kako osoba gradi povjerenje i ritam rada.",
        evidence: [
          {
            testSlug: "ipip-neo-120-v1",
            label: "Spremnost na saradnju",
            value: "9.99 (Izmisljeno)",
          },
        ],
      },
    ],
  });

  const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(mutatedSnapshot, buildReviewerResponseFixture()),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(result.integratedSignals[0].evidence[0].label, "Spremnost na saradnju");
  assert.equal(result.integratedSignals[0].evidence[0].value, "3.00 (Uravnoteženo)");
}

async function testNarrativeDomainCasingViolationIsDiagnosticWarningOnly() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const casingIssueSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    summary: {
      headline: "Integrisani HR pregled",
      profileOverview:
        "Ovdje je važna kombinacija više izražene Savjesnosti i Spremnosti na saradnju u svakodnevnom radu.",
      keyStrengths: ["Jasna tragljivost izvora."],
      watchouts: ["U intervjuu direktno provjerite konkretne primjere rada."],
    },
  });

  const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(casingIssueSnapshot, buildReviewerResponseFixture()),
    now: () => "2026-05-12T10:15:00.000Z",
  });
  const diagnostic = evaluateCompositeHrReportValidatorBoundary(inputSnapshot, casingIssueSnapshot, {
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(validateCompositeHrReportSnapshot(result).ok, true);
  assert.equal(diagnostic.hardGateWouldPersist, true);
  assert.equal(diagnostic.languageQualityHardIssues.length, 0);
  assert.equal(
    diagnostic.languageQualityWarnings.some((issue) => issue.code === "NARRATIVE_CASING_VIOLATION"),
    true,
  );
}

async function testNarrativeDomainCasingPositiveAndEvidenceLabelAllowed() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const validSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    summary: {
      headline: "Integrisani HR pregled",
      profileOverview:
        "Ovdje je važna kombinacija više izražene savjesnosti i spremnosti na saradnju u svakodnevnom radu.",
      keyStrengths: ["Savjesnost se moze navesti na pocetku recenice bez title-casing problema."],
      watchouts: ["U intervjuu direktno provjerite konkretne primjere saradnje pod pritiskom rokova."],
    },
    integratedSignals: [
      {
        id: "signal-collaboration",
        title: "Savjesnost i Spremnost na saradnju",
        body: "U radu se ova kombinacija vidi kroz savjesnost i spremnost na saradnju.",
        evidence: [
          {
            testSlug: "ipip-neo-120-v1",
            label: "Spremnost na saradnju",
            value: "3.00 (Uravnoteženo)",
          },
        ],
      },
    ],
  });

  const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(validSnapshot, buildReviewerResponseFixture()),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(validateCompositeHrReportSnapshot(result).ok, true);
  assert.equal(result.integratedSignals[0].evidence[0].label, "Spremnost na saradnju");
}

async function testReviewerApprovedPathPasses() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const snapshot = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(
      buildOpenAiSnapshotFixture(inputSnapshot),
      buildReviewerResponseFixture(),
    ),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(validateCompositeHrReportSnapshot(snapshot).ok, true);
}

async function testReviewerStyleRejectionDoesNotFailProvider() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();

  const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(
      buildOpenAiSnapshotFixture(inputSnapshot),
      buildReviewerResponseFixture({
        approved: false,
        issues: [
          {
            code: "UNNATURAL_BHS_LANGUAGE",
            severity: "blocking",
            message: "Contains awkward phrase that should not pass.",
          },
        ],
        summary: "Output should not be accepted.",
      }),
    ),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(validateCompositeHrReportSnapshot(result).ok, true);
}

async function testNeuroticismEvidenceMismatchIsSourceLocked() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const invalidSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    integratedSignals: [
      {
        id: "signal-neuroticism",
        title: "Regulacija pod pritiskom",
        body: "Vrijedi provjeriti kako osoba reaguje kada se pojavi vise paralelnih zahtjeva.",
        evidence: [
          {
            testSlug: "ipip-neo-120-v1",
            label: "Neuroticizam",
            value: "3.83 (Više izraženo)",
          },
        ],
      },
    ],
  });

  const snapshot = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(invalidSnapshot, buildReviewerResponseFixture()),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(snapshot.integratedSignals[0].evidence[0].label, "Neuroticizam");
  assert.equal(snapshot.integratedSignals[0].evidence[0].value, "2.17 (Niže izraženo)");
}

async function testValidNeuroticismEvidencePassesUnchanged() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const validSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    integratedSignals: [
      {
        id: "signal-neuroticism",
        title: "Regulacija pod pritiskom",
        body: "Vrijedi provjeriti kako osoba reaguje kada se pojavi vise paralelnih zahtjeva.",
        evidence: [
          {
            testSlug: "ipip-neo-120-v1",
            label: "Neuroticizam",
            value: "2.17 (Niže izraženo)",
          },
        ],
      },
    ],
  });

  const snapshot = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(validSnapshot, buildReviewerResponseFixture()),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(snapshot.integratedSignals[0].evidence[0].value, "2.17 (Niže izraženo)");
}

async function testReviewerTechnicalLanguageRejectionIsDiagnosticOnly() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();

  const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(
      buildOpenAiSnapshotFixture(inputSnapshot, {
        summary: {
          headline: "Integrisani HR pregled",
          profileOverview:
            "Profil ostaje citljiv, ali jedan dio teksta spominje linked attempts i source attempts. U intervjuu provjerite konkretan primjer rada.",
          keyStrengths: ["Jasna tragljivost izvora."],
          watchouts: ["Tražite primjer rada pod promjenom prioriteta."],
        },
      }),
      buildReviewerResponseFixture({
        approved: false,
        issues: [
          {
            code: "TECHNICAL_USER_FACING_LANGUAGE",
            severity: "blocking",
            message: "User-facing copy mentions linked attempts.",
          },
        ],
        summary: "Output should not be accepted.",
      }),
    ),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(validateCompositeHrReportSnapshot(result).ok, true);
}

async function testReviewerHrSafetyRejectionIsDiagnosticOnly() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();

  const result = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(
      buildOpenAiSnapshotFixture(inputSnapshot),
      buildReviewerResponseFixture({
        approved: false,
        issues: [
          {
            code: "HIRING_DECISION_LANGUAGE",
            severity: "blocking",
            message: "Review detected prescriptive hiring decision framing.",
          },
        ],
        summary: "Output should not be accepted.",
      }),
    ),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(validateCompositeHrReportSnapshot(result).ok, true);
}

async function testReviewerDoesNotFailBecauseOfSourceSnapshotLegacyLabels() {
  const inputSnapshot = buildCompositeInputSnapshotFixture({
    deterministicInputs: {
      ipip: {
        attemptId: "attempt-ipip",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        scale: { min: 1, max: 5 },
        domains: [
          {
            label: "Ugodnost",
            facets: [{ label: "Saradljivost" }],
          },
        ],
        summarySignals: {
          rankedDomains: ["CONSCIENTIOUSNESS", "AGREEABLENESS", "EXTRAVERSION"],
          highestDomains: ["CONSCIENTIOUSNESS"],
          lowestDomains: ["NEUROTICISM"],
          balancedDomains: [],
          topFacets: [],
          lowestFacets: [],
        },
      },
      safran: {
        attemptId: "attempt-safran",
        testId: "test-safran",
        testSlug: "safran_v1",
        overall: { rawScore: 36, maxScore: 54, band: "moderate_raw", interpretation: "moderate" },
        verbal: { rawScore: 14, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        figural: { rawScore: 10, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        numeric: { rawScore: 12, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        summarySignals: {
          strongestDomain: "verbal",
          lowestDomain: "figural",
        },
      },
      mwms: {
        attemptId: "attempt-mwms",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        scale: { min: 1, max: 7 },
        dimensions: [],
        motivationStructure: {
          autonomousMotivationScore: 6,
          controlledMotivationScore: 3.5,
          amotivationScore: 1.8,
        },
        summarySignals: {
          dominantDrivers: ["intrinsic", "identified"],
          lowerDrivers: ["amotivation", "external_social"],
          cautionFlags: {
            elevatedAmotivation: false,
            highControlledRelativeToAutonomous: false,
            mixedProfile: false,
          },
        },
      },
    },
  });

  const snapshot = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(
      buildOpenAiSnapshotFixture(inputSnapshot, {
        integratedSignals: [
          {
            id: "signal-collaboration",
            title: "Timski signal",
            body: "U timskoj saradnji vrijedi provjeriti kako osoba gradi povjerenje i ritam rada.",
            evidence: [
              {
                testSlug: "ipip-neo-120-v1",
                label: "Spremnost na saradnju",
                value: "izrazen signal",
              },
            ],
          },
        ],
      }),
      buildReviewerResponseFixture(),
    ),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(validateCompositeHrReportSnapshot(snapshot).ok, true);
}

async function testAsciiPerformancePressurePasses() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const snapshot = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(
      buildOpenAiSnapshotFixture(inputSnapshot, {
        summary: {
          headline: "Integrisani HR pregled",
          profileOverview:
            "Profil ostaje stabilan, ali vrijedi provjeriti kako osoba reaguje na pritisak ucinka u zahtjevnim sedmicama.",
          keyStrengths: ["Jasna tragljivost izvora."],
          watchouts: ["U intervjuu provjerite konkretne primjere rada."],
        },
      }),
      buildReviewerResponseFixture(),
    ),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(validateCompositeHrReportSnapshot(snapshot).ok, true);
}

async function testValidOutputHasNoForbiddenWords() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const snapshot = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(
      buildOpenAiSnapshotFixture(inputSnapshot),
      buildReviewerResponseFixture(),
    ),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  const allText = collectStrings(snapshot).join(" ");
  assert.equal(
    /zaposliti|ne zaposliti|fit score|idealni kandidat|rokovi visoki|ugodnost|saradljivost/i.test(
      allText,
    ),
    false,
  );
}

async function testPromptGuidanceEnforcesCompositeHrCopyRules() {
  const inputSnapshot = buildCompositeInputSnapshotFixture({
    addressingForm: "feminine",
  });
  const capture = buildCapturingFetchResponse(
    buildOpenAiSnapshotFixture(inputSnapshot),
    buildReviewerResponseFixture(),
  );

  await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: capture.fetchImpl,
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(capture.calls.length, 2);
  const generationRequestBody = JSON.parse(capture.calls[0].body);
  const generationMessages = generationRequestBody.messages ?? [];
  const systemPrompt =
    generationMessages.find((message) => message.role === "system")?.content ?? "";
  const userPrompt =
    generationMessages.find((message) => message.role === "user")?.content ?? "";
  const combinedPrompt = `${systemPrompt}\n${userPrompt}`;
  const reviewerRequestBody = JSON.parse(capture.calls[1].body);
  const reviewerMessages = reviewerRequestBody.messages ?? [];
  const reviewerSystemPrompt =
    reviewerMessages.find((message) => message.role === "system")?.content ?? "";
  const reviewerUserPrompt =
    reviewerMessages.find((message) => message.role === "user")?.content ?? "";
  const combinedReviewerPrompt = `${reviewerSystemPrompt}\n${reviewerUserPrompt}`;

  assert.equal(
    Object.prototype.hasOwnProperty.call(generationRequestBody, "temperature"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(reviewerRequestBody, "temperature"),
    false,
  );
  assert.equal(/addressingForm/i.test(combinedPrompt), true);
  assert.equal(/Use it only for grammatical form|only for grammatical agreement/i.test(combinedPrompt), true);
  assert.equal(/must never change scoring|Do not change, reinterpret or normalize score values/i.test(combinedPrompt), true);
  assert.equal(/lockedEvidenceCatalog|copy testSlug, label and value exactly/i.test(combinedPrompt), true);
  assert.equal(/Never freehand or estimate numeric evidence values|Never type a new score string for an IPIP domain/i.test(combinedPrompt), true);
  for (const rule of COMPOSITE_HR_BHS_LANGUAGE_RULES) {
    assert.equal(combinedPrompt.includes(rule), true);
  }
  for (const rule of COMPOSITE_HR_BHS_GLOSSARY_PROMPT) {
    assert.equal(combinedPrompt.includes(rule), true);
  }
  assert.equal(
    /premium B2B tone|stručan, konkretan, savjetodavan, HR-operativan, metodološki siguran/i.test(combinedPrompt),
    true,
  );
  assert.equal(/advisory decision-support text|confident HR-advisory tone/i.test(combinedPrompt), true);
  assert.equal(
    /most important work signal.*verify first.*confirm or disconfirm.*performance may be strongest.*friction may emerge.*priorities, expectations, support and onboarding/is.test(
      combinedPrompt,
    ),
    true,
  );
  assert.equal(/Prefer clear HR hypotheses over sterile hedging/i.test(combinedPrompt), true);
  assert.equal(
    /spremna|konstruktivna|orijentisana|sklona|stabilna|pouzdana/i.test(combinedPrompt),
    true,
  );
  assert.equal(
    /spreman|konstruktivan|orijentisan|sklon|stabilan|pouzdan/i.test(combinedPrompt),
    true,
  );
  assert.equal(/Avoid overly long sentences|keep sentences readable/i.test(combinedPrompt), true);
  assert.equal(/shorter, more scannable HR copy|scan-friendly rhythm/i.test(combinedPrompt), true);
  assert.equal(/concrete HR action verbs|dogovorite, postavite, provjerite/i.test(combinedPrompt), true);
  assert.equal(/kombinacija X, Y i Z/i.test(combinedPrompt), true);
  assert.equal(
    /BHS narrative sentences.*domain and motivation dimension names in lowercase.*mid-sentence/is.test(
      combinedPrompt,
    ),
    true,
  );
  assert.equal(/Do not use English-style title casing/i.test(combinedPrompt), true);
  assert.equal(
    /Display\/evidence labels may remain capitalized.*do not lowercase evidence labels or chip labels/is.test(
      combinedPrompt,
    ),
    true,
  );
  assert.equal(
    /Savjesnosti.*Spremnosti na saradnju.*Neuroticizma.*Ekstraverzije.*Otvorenosti.*Intrinzične motivacije.*Identifikovane motivacije/is.test(
      combinedPrompt,
    ),
    true,
  );
  assert.equal(
    /Najvažniji radni signal je|U intervjuu prvo provjerite|Ovaj nalaz je najkorisnije koristiti za/i.test(
      combinedPrompt,
    ),
    true,
  );
  assert.equal(/summary\.headline.*90 characters|90 znakova|90/i.test(combinedPrompt), true);
  assert.equal(/summary\.profileOverview.*at most 3 clear sentences/i.test(combinedPrompt), true);
  assert.equal(/Do not put more than two main ideas/i.test(combinedPrompt), true);
  assert.equal(
    /U intervjuu provjerite|Direktno razjasnite|Tražite primjer|Slušajte da li/i.test(
      combinedPrompt,
    ),
    true,
  );
  assert.equal(
    /Do not start summary\.watchouts.*Područje za dodatnu provjeru je.*Vrijedi provjeriti.*Može biti korisno razmotriti/is.test(combinedPrompt),
    true,
  );
  assert.equal(
    /IPIP as the behavioural\/personality signal.*SAFRAN as the cognitive signal.*MWMS as the motivational signal/is.test(
      combinedPrompt,
    ),
    true,
  );
  assert.equal(/Do not merely list each test separately; explain the combination/i.test(combinedPrompt), true);
  assert.equal(
    /Each key strength should be translated into a plausible work behaviour/i.test(combinedPrompt),
    true,
  );
  assert.equal(
    /Each watchout should be translated into a concrete interview action, verification question or management checkpoint/i.test(
      combinedPrompt,
    ),
    true,
  );
  assert.equal(
    /Each integratedSignals item should make the body useful for HR.*what the signal means in work.*what HR should verify next/is.test(
      combinedPrompt,
    ),
    true,
  );
  assert.equal(/Tražite konkretan primjer|Provjerite kako|Slušajte da li kandidat opisuje/i.test(combinedPrompt), true);
  assert.equal(/Do not use one long integratedSignals\.body sentence/i.test(combinedPrompt), true);
  assert.equal(
    /interviewGuidance questions should be direct, ready to ask.*what HR should listen for/is.test(
      combinedPrompt,
    ),
    true,
  );
  assert.equal(/onboardingGuidance should be concise and operational.*dogovorite prioritete.*postavite ritam provjera.*definisite kriterije kvaliteta/is.test(combinedPrompt), true);
  assert.equal(/limitations.*explicit, calm and short/i.test(combinedPrompt), true);
  assert.equal(/Do not repeat the phrase korisno je provjeriti/i.test(combinedPrompt), true);
  assert.equal(
    /Spremnost na saradnju|Ugodnost|Saradljivost|rokovi visoki|fit score|hire\/no-hire/i.test(
      combinedPrompt,
    ),
    true,
  );
  for (const rule of COMPOSITE_HR_BHS_REVIEWER_RULES) {
    assert.equal(combinedReviewerPrompt.includes(rule), true);
  }
  assert.equal(/Spremnost na saradnju/i.test(combinedReviewerPrompt), true);
  assert.equal(/Ugodnost/i.test(combinedReviewerPrompt), true);
  assert.equal(/Saradljivost/i.test(combinedReviewerPrompt), true);
  assert.equal(/Saradnja/i.test(combinedReviewerPrompt), true);
  assert.equal(/rokovi visoki/i.test(combinedReviewerPrompt), true);
  assert.equal(/fit score/i.test(combinedReviewerPrompt), true);
  assert.equal(/hire\/no-hire|hire-no-hire|hire\/no hire/i.test(combinedReviewerPrompt), true);
  assert.equal(/ordinary narrative uses of the word 'saradnja'|obicnu rijec 'saradnja'/i.test(combinedReviewerPrompt), true);
  assert.equal(/lockedEvidenceCatalog|changes a locked deterministic value/i.test(combinedReviewerPrompt), true);
}

async function testCompositeOpenAiTemperatureBehaviorForNonGpt55Model() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const capture = buildCapturingFetchResponse(
    buildOpenAiSnapshotFixture(inputSnapshot),
    buildReviewerResponseFixture(),
  );

  await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-4.1",
    fetchImpl: capture.fetchImpl,
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(capture.calls.length, 2);
  const generationRequestBody = JSON.parse(capture.calls[0].body);
  const reviewerRequestBody = JSON.parse(capture.calls[1].body);

  assert.equal(generationRequestBody.model, "gpt-4.1");
  assert.equal(reviewerRequestBody.model, "gpt-4.1");
  assert.equal(generationRequestBody.temperature, 0.2);
  assert.equal(reviewerRequestBody.temperature, 0.2);
}

async function testCompositeOpenAiReasoningEffortForGpt56Model() {
  const previous = process.env.AI_REPORT_REASONING_EFFORT;
  process.env.AI_REPORT_REASONING_EFFORT = "medium";

  try {
    const inputSnapshot = buildCompositeInputSnapshotFixture();
    const capture = buildCapturingFetchResponse(
      buildOpenAiSnapshotFixture(inputSnapshot),
      buildReviewerResponseFixture(),
    );

    await generateOpenAiCompositeHrReport(inputSnapshot, {
      apiKey: "test-key",
      model: "gpt-5.6-sol",
      fetchImpl: capture.fetchImpl,
      now: () => "2026-05-12T10:15:00.000Z",
    });

    assert.equal(capture.calls.length, 2);

    for (const call of capture.calls) {
      const requestBody = JSON.parse(call.body);
      assert.equal(requestBody.reasoning_effort, "medium");
      assert.equal(
        Object.prototype.hasOwnProperty.call(requestBody, "temperature"),
        false,
      );
    }
  } finally {
    if (previous === undefined) {
      delete process.env.AI_REPORT_REASONING_EFFORT;
    } else {
      process.env.AI_REPORT_REASONING_EFFORT = previous;
    }
  }
}

async function testFeminineMismatchIsDiagnosticOnly() {
  const inputSnapshot = buildCompositeInputSnapshotFixture({
    addressingForm: "feminine",
  });
  const invalidSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    summary: {
      headline: "Integrisani HR pregled",
      profileOverview:
        "Spreman na saradnju i vjerovatno konstruktivan u timskim odnosima. Ostatak nalaza ostaje isti.",
      keyStrengths: ["Jasna tragljivost izvora."],
      watchouts: ["U intervjuu provjerite konkretne primjere rada."],
    },
  });

  const snapshot = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(invalidSnapshot, buildReviewerResponseFixture()),
    now: () => "2026-05-12T10:15:00.000Z",
  });
  const diagnostic = evaluateCompositeHrReportValidatorBoundary(inputSnapshot, invalidSnapshot, {
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(validateCompositeHrReportSnapshot(snapshot).ok, true);
  assert.equal(diagnostic.hardGateWouldPersist, true);
  assert.equal(diagnostic.addressingFormResult.ok, false);
  assert.match(diagnostic.addressingFormResult.error, /feminine addressing mismatch/i);
}

async function testDataOnlyBlockingEvidenceMismatchStillFailsProduction() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const invalidSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    source: {
      inputContractVersion: inputSnapshot.contractVersion,
      sourceAttemptIds: ["attempt-other"],
      testSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
    },
  });

  await assert.rejects(
    () =>
      generateOpenAiCompositeHrReport(inputSnapshot, {
        apiKey: "test-key",
        model: "gpt-5.5",
        fetchImpl: buildFetchResponse(invalidSnapshot, buildReviewerResponseFixture()),
        now: () => "2026-05-12T10:15:00.000Z",
      }),
    /sourceAttemptIds do not match/i,
  );
}

async function testFeminineNarrativePassesAndNeutralEvidenceDoesNotTripGuardrail() {
  const inputSnapshot = buildCompositeInputSnapshotFixture({
    addressingForm: "feminine",
  });

  const validSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    summary: {
      headline: "Integrisani HR pregled",
      profileOverview:
        "Spremna na saradnju i vjerovatno konstruktivna u timskim odnosima. U intervjuu provjerite kako uskladjuje ritam rada sa drugima.",
      keyStrengths: ["Jasna tragljivost izvora."],
      watchouts: ["Tražite primjer saradnje pod promjenom prioriteta."],
    },
    integratedSignals: [
      {
        id: "signal-neutral",
        title: "Kontekst saradnje",
        body: "U timskoj saradnji vrijedi provjeriti kako osoba uskladjuje ritam rada sa drugima.",
        evidence: [
          {
            testSlug: "ipip-neo-120-v1",
            label: "Spremnost na saradnju",
            value: "izrazen signal",
          },
        ],
      },
    ],
  });

  const snapshot = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(validSnapshot, buildReviewerResponseFixture()),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  assert.equal(validateCompositeHrReportSnapshot(snapshot).ok, true);
}

async function main() {
  await testProviderSelectorDefaultUsesMock();
  await testOpenAiPathReturnsValidSnapshot();
  await testCompositeGenerationAndReviewerHaveSeparateUsageEvents();
  await testOpenAiInvalidOutputFailsValidation();
  await testOpenAiMissingRequiredTextFailsValidation();
  await testWrongReportMetadataFailsValidation();
  await testSourceImmutabilityFailsOnMutatedSource();
  await testForbiddenWordingIsDiagnosticOnly();
  await testRokoviVisokiIsDiagnosticWarningOnly();
  await testAgreeablenessGlossaryViolationsAreDiagnosticWarningsOnly();
  await testAgreeablenessLabelReplacementRejectedButNarrativeSaradnjaAllowed();
  await testAgreeablenessLegacyUgodnostEvidenceIsSourceLockedToCanonicalLabel();
  await testForbiddenHiringTermsAreDiagnosticOnly();
  await testHardSafetyBreachesAreDiagnosticOnly();
  await testBenignTechnicalWordsDoNotHardFail();
  await testMutatedKnownEvidenceValueIsSourceLocked();
  await testNarrativeDomainCasingViolationIsDiagnosticWarningOnly();
  await testNarrativeDomainCasingPositiveAndEvidenceLabelAllowed();
  await testReviewerApprovedPathPasses();
  await testReviewerStyleRejectionDoesNotFailProvider();
  await testNeuroticismEvidenceMismatchIsSourceLocked();
  await testValidNeuroticismEvidencePassesUnchanged();
  await testReviewerTechnicalLanguageRejectionIsDiagnosticOnly();
  await testReviewerHrSafetyRejectionIsDiagnosticOnly();
  await testReviewerDoesNotFailBecauseOfSourceSnapshotLegacyLabels();
  await testAsciiPerformancePressurePasses();
  await testValidOutputHasNoForbiddenWords();
  await testPromptGuidanceEnforcesCompositeHrCopyRules();
  await testCompositeOpenAiTemperatureBehaviorForNonGpt55Model();
  await testCompositeOpenAiReasoningEffortForGpt56Model();
  await testFeminineMismatchIsDiagnosticOnly();
  await testDataOnlyBlockingEvidenceMismatchStillFailsProduction();
  await testFeminineNarrativePassesAndNeutralEvidenceDoesNotTripGuardrail();

  console.log("Composite HR OpenAI provider tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
