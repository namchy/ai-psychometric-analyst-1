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
} = require("../lib/assessment/composite-hr-report-provider-openai.ts");

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
        domains: [],
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
      headline: "Integrisani HR pregled",
      profileOverview:
        "Profil kombinira ponasajne, motivacijske i kognitivne signale kao hipoteze za intervju i onboarding provjeru.",
      keyStrengths: [
        "Jasna tragljivost izvora kroz linked assessment attempts.",
        "Signal omogucava strukturisanu pripremu intervjua.",
      ],
      watchouts: [
        "Nalaze treba provjeriti kroz konkretne primjere rada i kontekst uloge.",
        "Signal ne treba citati odvojeno od iskustva i zahtjeva pozicije.",
      ],
    },
    integratedSignals: [
      {
        id: "signal-personality",
        title: "Ponasajni fokus za razgovor",
        body: "Najkorisnije je provjeriti kako osoba strukturise rad i nosi se sa promjenom prioriteta.",
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
        body: "Signal vrijedi provjeriti kroz kratke primjere nacina razmisljanja i provjere tacnosti.",
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

function buildFetchResponse(payload) {
  return async function fetchImpl() {
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
        fetchImpl: buildFetchResponse(reportSnapshot),
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
        fetchImpl: buildFetchResponse(invalidSnapshot),
        now: () => "2026-05-12T10:15:00.000Z",
      }),
    /failed validation|contractVersion/i,
  );
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
        fetchImpl: buildFetchResponse(invalidSnapshot),
        now: () => "2026-05-12T10:15:00.000Z",
      }),
    /sourceAttemptIds do not match/i,
  );
}

async function testForbiddenWordingRejected() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const invalidSnapshot = buildOpenAiSnapshotFixture(inputSnapshot, {
    summary: {
      headline: "Integrisani HR pregled",
      profileOverview:
        "Ovaj tekst govori da treba zaposliti osobu odmah, sto je zabranjeno.",
      keyStrengths: ["Jasna tragljivost izvora."],
      watchouts: ["Potrebna je provjera kroz primjere rada."],
    },
  });

  await assert.rejects(
    () =>
      generateOpenAiCompositeHrReport(inputSnapshot, {
        apiKey: "test-key",
        model: "gpt-5.5",
        fetchImpl: buildFetchResponse(invalidSnapshot),
        now: () => "2026-05-12T10:15:00.000Z",
      }),
    /forbidden phrasing/i,
  );
}

async function testValidOutputHasNoForbiddenWords() {
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const snapshot = await generateOpenAiCompositeHrReport(inputSnapshot, {
    apiKey: "test-key",
    model: "gpt-5.5",
    fetchImpl: buildFetchResponse(buildOpenAiSnapshotFixture(inputSnapshot)),
    now: () => "2026-05-12T10:15:00.000Z",
  });

  const allText = collectStrings(snapshot).join(" ");
  assert.equal(/zaposliti|ne zaposliti|fit score|idealni kandidat/i.test(allText), false);
}

async function main() {
  await testProviderSelectorDefaultUsesMock();
  await testOpenAiPathReturnsValidSnapshot();
  await testOpenAiInvalidOutputFailsValidation();
  await testSourceImmutabilityFailsOnMutatedSource();
  await testForbiddenWordingRejected();
  await testValidOutputHasNoForbiddenWords();

  console.log("Composite HR OpenAI provider tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
