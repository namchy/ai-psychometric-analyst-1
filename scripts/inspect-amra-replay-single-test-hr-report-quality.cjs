const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const DEFAULT_FIXTURE_REPORT_IDS = {
  ipip: "5fcc9019-5ddd-42c7-83bb-d6d663e94f72",
  safran: "30124c4a-e7d9-412b-bad3-596d8e3bf97b",
  mwms: "4013e438-099a-400d-bf8c-b7d34dcb60b3",
};

const DEFAULT_FIXTURE_ATTEMPT_IDS = {
  ipip: "e71d472a-13cb-4cc9-9582-6eaa262affca",
  safran: "54702bc1-7d91-492e-9b50-14aff6706d34",
  mwms: "8aefc4f9-3ca6-48f2-a41e-0f6b75c5e0d1",
};

const FAMILY_CONFIG = {
  ipip: {
    label: "IPIP",
    testSlug: "ipip-neo-120-v1",
    reportRenderFormat: "big_five_hr_v1",
    route: "/dashboard/attempts/[attemptId]",
    renderer:
      "components/assessment/completed-assessment-summary.tsx -> coerceIpipNeo120HrReportV1ForDisplay(...)",
  },
  safran: {
    label: "SAFRAN",
    testSlug: "safran_v1",
    reportRenderFormat: "safran_hr_report_v1",
    route: "/dashboard/attempts/[attemptId]",
    renderer:
      "components/assessment/completed-assessment-summary.tsx -> resolveSafranHrReportDisplay(...)",
  },
  mwms: {
    label: "MWMS",
    testSlug: "mwms_v1",
    reportRenderFormat: "mwms_hr_report_v1",
    route: "/dashboard/attempts/[attemptId]",
    renderer:
      "components/assessment/completed-assessment-summary.tsx -> resolveMwmsHrReportDisplay(...)",
  },
};

const REPORT_ID_ENV_NAMES = {
  ipip: "IPIP_HR_REPORT_ID",
  safran: "SAFRAN_HR_REPORT_ID",
  mwms: "MWMS_HR_REPORT_ID",
};

const FORBIDDEN_TERMS = [
  "Ugodnost",
  "Kooperativnost",
  "Saradnički profil",
  "Saradljivost",
  "overuse",
  "handling",
];

const GENERIC_FILLER_PHRASES = [
  "ovaj izvještaj prikazuje rezultate",
  "ovaj izvještaj prikazuje",
  "generic ai text",
  "akademsko objašnjenje testa",
  "professional hr decision-support artifact",
];

const TOP_CAUTIOUS_PATTERNS = [
  /\bvjerovatno\b/giu,
  /\bvrijedi provjeriti\b/giu,
  /\btreba provjeriti\b/giu,
  /\bmože ukazivati\b/giu,
  /\bmoze ukazivati\b/giu,
];

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

const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
const {
  validateIpipNeo120HrReportV1,
  coerceIpipNeo120HrReportV1ForDisplay,
} = require("../lib/assessment/ipip-neo-120-report-v1.ts");
const {
  validateSafranHrReport,
} = require("../lib/assessment/safran-hr-report-v1.ts");
const {
  validateMwmsHrReportV1,
} = require("../lib/assessment/mwms-hr-report-v1.ts");
const {
  resolveSafranHrReportDisplay,
} = require("../lib/assessment/safran-hr-report-display.ts");
const {
  resolveMwmsHrReportDisplay,
} = require("../lib/assessment/mwms-hr-report-display.ts");
const {
  validateReportLanguageQuality,
  formatReportLanguageQualityIssues,
} = require("../lib/assessment/report-language-quality.ts");
const {
  getIpipNeo120HrDomainLabel,
  getIpipNeo120FacetLabel,
} = require("../lib/assessment/ipip-neo-120-labels.ts");

function parseCliValue(argv, name) {
  const prefix = `--${name}=`;
  const direct = argv.find((entry) => entry.startsWith(prefix));

  if (direct) {
    return direct.slice(prefix.length);
  }

  const index = argv.findIndex((entry) => entry === `--${name}`);
  return index >= 0 ? argv[index + 1] ?? null : null;
}

function parseBooleanFlag(argv, name) {
  return argv.includes(`--${name}`);
}

function truncate(value, max = 160) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function countPatternMatches(text, pattern) {
  if (!text) {
    return 0;
  }

  return text.match(pattern)?.length ?? 0;
}

function normalizePath(pathValue) {
  if (!pathValue) {
    return "<root>";
  }

  return pathValue.replace(/^\./, "");
}

function collectStringEntries(value, currentPath = "", output = []) {
  if (typeof value === "string") {
    output.push({
      path: normalizePath(currentPath),
      value,
    });
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectStringEntries(item, `${currentPath}[${index}]`, output);
    });
    return output;
  }

  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      collectStringEntries(nestedValue, nextPath, output);
    }
  }

  return output;
}

function buildTextDigest(entries) {
  return entries.map((entry) => entry.value).join("\n");
}

function countTermOccurrences(entries, term) {
  const pattern = new RegExp(`\\b${escapeForRegex(term)}\\b`, "giu");
  return entries.reduce((total, entry) => total + countPatternMatches(entry.value, pattern), 0);
}

function findTermHits(entries, term) {
  const pattern = new RegExp(`\\b${escapeForRegex(term)}\\b`, "iu");
  return entries
    .filter((entry) => pattern.test(entry.value))
    .map((entry) => `${entry.path}: ${truncate(entry.value, 120)}`);
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findBulletArtifacts(entries, proseOnlyPaths) {
  const artifactPattern = /(?:^|\n)\s*(?:[-*•]\s+|\d+\.\s+)/u;
  return entries
    .filter((entry) => proseOnlyPaths.some((pathPrefix) => entry.path.startsWith(pathPrefix)))
    .filter((entry) => artifactPattern.test(entry.value))
    .map((entry) => entry.path);
}

function findEmptyFieldPaths(report, requiredPaths) {
  return requiredPaths.filter((pathValue) => {
    const resolved = getPathValue(report, pathValue);

    if (resolved === null || resolved === undefined) {
      return true;
    }

    if (typeof resolved === "string") {
      return resolved.trim().length === 0;
    }

    if (Array.isArray(resolved)) {
      return resolved.length === 0;
    }

    return false;
  });
}

function getPathValue(value, pathValue) {
  const parts = pathValue.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current = value;

  for (const part of parts) {
    if (!part) {
      continue;
    }

    if (current === null || current === undefined) {
      return undefined;
    }

    current = current[part];
  }

  return current;
}

function formatList(values, max = 3) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => truncate(typeof value === "string" ? value : null))
    .filter(Boolean)
    .slice(0, max);
}

function buildUsageText() {
  return [
    "Read-only persisted HR snapshot inspector for Amra replay single-test fixtures.",
    "No OpenAI calls. No DB writes. No regeneration. No report mutation.",
    "",
    "Usage:",
    "  node --env-file=.env.local scripts/inspect-amra-replay-single-test-hr-report-quality.cjs",
    "  node scripts/inspect-amra-replay-single-test-hr-report-quality.cjs --dry-run",
    "  IPIP_HR_REPORT_ID=<id> SAFRAN_HR_REPORT_ID=<id> MWMS_HR_REPORT_ID=<id> node --env-file=.env.local scripts/inspect-amra-replay-single-test-hr-report-quality.cjs",
    "",
    "Default fixture report IDs:",
    ...Object.entries(DEFAULT_FIXTURE_REPORT_IDS).map(
      ([family, reportId]) =>
        `  ${family}: report_id=${reportId} attempt_id=${DEFAULT_FIXTURE_ATTEMPT_IDS[family]}`,
    ),
  ].join("\n");
}

function buildDryRunSummary() {
  return {
    mode: "dry-run",
    readOnly: true,
    openAiCalled: false,
    databaseReads: false,
    databaseWrites: false,
    regenerationTriggered: false,
    requiresConfirmationEnv: false,
    defaultFixtureReportIds: { ...DEFAULT_FIXTURE_REPORT_IDS },
    defaultFixtureAttemptIds: { ...DEFAULT_FIXTURE_ATTEMPT_IDS },
    envOverrides: { ...REPORT_ID_ENV_NAMES },
  };
}

function resolveRequestedIds(env = process.env) {
  return {
    ipip: env[REPORT_ID_ENV_NAMES.ipip]?.trim() || DEFAULT_FIXTURE_REPORT_IDS.ipip,
    safran: env[REPORT_ID_ENV_NAMES.safran]?.trim() || DEFAULT_FIXTURE_REPORT_IDS.safran,
    mwms: env[REPORT_ID_ENV_NAMES.mwms]?.trim() || DEFAULT_FIXTURE_REPORT_IDS.mwms,
  };
}

async function loadRowsByReportId(reportIdsByFamily) {
  const supabase = createSupabaseAdminClient();
  const requestedIds = Object.values(reportIdsByFamily);
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(
      "id, attempt_id, test_slug, audience, report_type, source_type, report_status, generator_type, model_name, prompt_version_id, input_snapshot, report_snapshot",
    )
    .in("id", requestedIds);

  if (error) {
    throw new Error(`Failed to load attempt_reports: ${error.message}`);
  }

  const rowsById = new Map((data ?? []).map((row) => [row.id, row]));
  const result = {};

  for (const [family, reportId] of Object.entries(reportIdsByFamily)) {
    const row = rowsById.get(reportId);

    if (!row) {
      throw new Error(`Requested ${family} report ${reportId} was not found in attempt_reports.`);
    }

    result[family] = row;
  }

  return result;
}

function validateReportSnapshot(family, reportSnapshot) {
  if (!reportSnapshot) {
    return {
      ok: false,
      validatorName: `${family}_missing_snapshot`,
      errors: ["report_snapshot missing"],
      displayReady: false,
    };
  }

  if (family === "ipip") {
    const validation = validateIpipNeo120HrReportV1(reportSnapshot, {
      strictContract: true,
      enforceGuardrails: true,
    });

    return {
      ok: validation.ok,
      validatorName: "validateIpipNeo120HrReportV1(strictContract,enforceGuardrails)",
      errors: validation.ok ? [] : validation.errors.map((entry) => `${entry.path || "<root>"}: ${entry.message}`),
      displayReady: coerceIpipNeo120HrReportV1ForDisplay(reportSnapshot) !== null,
    };
  }

  if (family === "safran") {
    const validation = validateSafranHrReport(reportSnapshot, {
      enforceProseGuardrails: false,
    });

    return {
      ok: validation.ok,
      validatorName: "validateSafranHrReport(enforceProseGuardrails=false)",
      errors: validation.ok ? [] : validation.errors,
      displayReady: resolveSafranHrReportDisplay(reportSnapshot) !== null,
    };
  }

  const validation = validateMwmsHrReportV1(reportSnapshot, {
    enforceProseGuardrails: false,
  });

  return {
    ok: validation.ok,
    validatorName: "validateMwmsHrReportV1(enforceProseGuardrails=false)",
    errors: validation.ok ? [] : validation.errors,
    displayReady: resolveMwmsHrReportDisplay(reportSnapshot) !== null,
  };
}

function buildIpipStructuralChecks(row) {
  const inputEntries = collectStringEntries(row.input_snapshot);
  const reportEntries = collectStringEntries(row.report_snapshot);
  const scoreReferenceEntries = reportEntries.filter((entry) => entry.path.startsWith("score_references"));
  const expectedDomainLabel = getIpipNeo120HrDomainLabel("AGREEABLENESS");
  const expectedFacetLabel = getIpipNeo120FacetLabel("COOPERATION");

  return {
    expectedAgreeablenessDomainLabel: expectedDomainLabel,
    expectedCooperationFacetLabel: expectedFacetLabel,
    inputContainsExpectedDomainLabel: countTermOccurrences(inputEntries, expectedDomainLabel) > 0,
    reportContainsExpectedDomainLabel: countTermOccurrences(reportEntries, expectedDomainLabel) > 0,
    inputContainsExpectedFacetLabel: countTermOccurrences(inputEntries, expectedFacetLabel) > 0,
    reportContainsExpectedFacetLabel: countTermOccurrences(reportEntries, expectedFacetLabel) > 0,
    activeSaradljivostScoreReferenceHits: findTermHits(scoreReferenceEntries, "Saradljivost"),
    forbiddenTermCounts: {
      Ugodnost:
        countTermOccurrences(inputEntries, "Ugodnost") + countTermOccurrences(reportEntries, "Ugodnost"),
      Kooperativnost:
        countTermOccurrences(inputEntries, "Kooperativnost") +
        countTermOccurrences(reportEntries, "Kooperativnost"),
      "Saradnički profil":
        countTermOccurrences(inputEntries, "Saradnički profil") +
        countTermOccurrences(reportEntries, "Saradnički profil"),
      Saradljivost:
        countTermOccurrences(inputEntries, "Saradljivost") +
        countTermOccurrences(reportEntries, "Saradljivost"),
    },
  };
}

function buildLanguageDiagnostics(family, row) {
  const reportEntries = collectStringEntries(row.report_snapshot);
  const reportText = buildTextDigest(reportEntries);
  const topEntries = family === "ipip"
    ? reportEntries.filter((entry) =>
        [
          "headline",
          "executive_summary",
          "key_hr_signals[0].title",
          "key_hr_signals[0].evidence",
          "key_hr_signals[0].hr_implication",
          "executiveSummary.title",
          "executiveSummary.summary",
          "key_motivational_drivers[0].title",
          "key_motivational_drivers[0].evidence",
          "key_motivational_drivers[0].hrImplication",
        ].some((prefix) => entry.path.startsWith(prefix)),
      )
    : reportEntries.slice(0, 8);
  const topText = topEntries.map((entry) => entry.value).join("\n");
  const topCautiousRepeatCount = TOP_CAUTIOUS_PATTERNS.reduce(
    (total, pattern) => total + countPatternMatches(topText, pattern),
    0,
  );
  const forbiddenTermHits = Object.fromEntries(
    FORBIDDEN_TERMS.map((term) => [term, findTermHits(reportEntries, term)]),
  );

  const proseOnlyPathsByFamily = {
    ipip: [
      "headline",
      "executive_summary",
      "key_hr_signals",
      "verification_focus",
      "strengths_and_overuse_risks",
      "onboarding_and_management_guidance",
      "team_fit_notes",
      "interpretation_note",
    ],
    safran: [
      "executiveSummary",
      "cognitiveSignals",
      "pointsOfCaution",
      "interviewQuestions",
      "interpretationLimits",
    ],
    mwms: [
      "key_motivational_drivers",
      "potential_friction_points",
      "work_context_hypotheses",
      "manager_support_guidance",
      "interview_questions",
      "onboarding_recommendations",
      "decision_support_note",
      "interpretation_note",
    ],
  };

  const baseResult = {
    vjerovatnoCount: countTermMatchesInText(reportText, "vjerovatno"),
    repeatedCautiousWordingNearTop: topCautiousRepeatCount >= 3,
    repeatedCautiousWordingNearTopCount: topCautiousRepeatCount,
    englishLeakHits: {
      overuse: forbiddenTermHits.overuse,
      handling: forbiddenTermHits.handling,
    },
    saradljivostHits: forbiddenTermHits.Saradljivost,
    bulletArtifactPaths: findBulletArtifacts(reportEntries, proseOnlyPathsByFamily[family] ?? []),
    genericFillerHits: GENERIC_FILLER_PHRASES.filter((phrase) =>
      reportText.toLowerCase().includes(phrase.toLowerCase()),
    ),
    qualityReviewer: null,
  };

  if (family === "ipip") {
    const quality = validateReportLanguageQuality({
      snapshot: row.report_snapshot,
      locale: "bs",
      audience: "hr",
      reportType: "single_test",
      context: "ipip_hr_report",
    });

    return {
      ...baseResult,
      qualityReviewer: {
        ok: quality.ok,
        issues: quality.issues.map((issue) =>
          issue.path
            ? `${issue.path}:${issue.code}:${issue.phrase}`
            : `${issue.code}:${issue.phrase}`,
        ),
        formatted: quality.ok ? null : formatReportLanguageQualityIssues(quality.issues),
      },
    };
  }

  return baseResult;
}

function countTermMatchesInText(text, term) {
  return countPatternMatches(text, new RegExp(`\\b${escapeForRegex(term)}\\b`, "giu"));
}

function buildContentShapeDigest(family, reportSnapshot) {
  if (!reportSnapshot || typeof reportSnapshot !== "object") {
    return {
      headlineFields: [],
      summaryFields: [],
      keyInsightHeadings: [],
      recommendationFields: [],
      riskFields: [],
      emptyRequiredLookingFields: ["report_snapshot"],
    };
  }

  if (family === "ipip") {
    return {
      headlineFields: formatList([reportSnapshot.headline]),
      summaryFields: formatList([reportSnapshot.executive_summary], 2),
      keyInsightHeadings: formatList((reportSnapshot.key_hr_signals ?? []).map((item) => item.title), 5),
      recommendationFields: formatList(
        (reportSnapshot.onboarding_and_management_guidance ?? []).map((item) => item.recommendation),
        4,
      ),
      riskFields: formatList(
        [
          ...(reportSnapshot.verification_focus ?? []).map((item) => item.area),
          ...(reportSnapshot.team_fit_notes ?? []).map((item) => item.watchout),
          reportSnapshot.interpretation_note,
        ],
        6,
      ),
      emptyRequiredLookingFields: findEmptyFieldPaths(reportSnapshot, [
        "headline",
        "executive_summary",
        "key_hr_signals[0].title",
        "verification_focus[0].area",
        "interview_questions[0].question",
        "decision_support_note[0]",
        "interpretation_note",
      ]),
    };
  }

  if (family === "safran") {
    return {
      headlineFields: formatList([reportSnapshot.executiveSummary?.title]),
      summaryFields: formatList([reportSnapshot.executiveSummary?.summary], 2),
      keyInsightHeadings: formatList(
        [
          "overall",
          "verbal",
          "figural",
          "numeric",
          ...(reportSnapshot.pointsOfCaution ?? []).map((item) => item.signal),
        ],
        6,
      ),
      recommendationFields: formatList(
        [
          ...(reportSnapshot.onboardingGuidance?.first30Days ?? []),
          ...(reportSnapshot.onboardingGuidance?.days60 ?? []),
          ...(reportSnapshot.onboardingGuidance?.days90 ?? []),
        ],
        5,
      ),
      riskFields: formatList(
        [
          ...(reportSnapshot.pointsOfCaution ?? []).map((item) => item.signal),
          ...(reportSnapshot.interpretationLimits ?? []),
        ],
        6,
      ),
      emptyRequiredLookingFields: findEmptyFieldPaths(reportSnapshot, [
        "executiveSummary.title",
        "executiveSummary.summary",
        "cognitiveSignals.overall",
        "pointsOfCaution[0].signal",
        "interviewQuestions[0].question",
        "interpretationLimits[0]",
      ]),
    };
  }

  return {
    headlineFields: formatList([
      reportSnapshot.key_motivational_drivers?.[0]?.title,
      reportSnapshot.key_motivational_drivers?.[1]?.title,
      reportSnapshot.key_motivational_drivers?.[2]?.title,
    ]),
    summaryFields: formatList([reportSnapshot.interpretation_note], 2),
    keyInsightHeadings: formatList(
      [
        ...(reportSnapshot.key_motivational_drivers ?? []).map((item) => item.title),
        ...(reportSnapshot.potential_friction_points ?? []).map((item) => item.signal),
      ],
      6,
    ),
    recommendationFields: formatList(
      [
        ...(reportSnapshot.manager_support_guidance ?? []).map((item) => item.focus),
        ...(reportSnapshot.onboarding_recommendations ?? []).map((item) => item.recommendation),
      ],
      6,
    ),
    riskFields: formatList(
      [
        ...(reportSnapshot.potential_friction_points ?? []).map((item) => item.signal),
        reportSnapshot.interpretation_note,
      ],
      5,
    ),
    emptyRequiredLookingFields: findEmptyFieldPaths(reportSnapshot, [
      "key_motivational_drivers[0].title",
      "potential_friction_points[0].signal",
      "work_context_hypotheses[0].context",
      "manager_support_guidance[0].focus",
      "interview_questions[0].question",
      "onboarding_recommendations[0].recommendation",
      "decision_support_note[0]",
      "interpretation_note",
    ]),
  };
}

function buildRendererReadiness(family, row, validationResult) {
  const familyConfig = FAMILY_CONFIG[family];

  return {
    route: `${familyConfig.route.replace("[attemptId]", row.attempt_id)}`,
    reportRenderFormat: familyConfig.reportRenderFormat,
    renderer: familyConfig.renderer,
    expectedForTestSlug: row.test_slug === familyConfig.testSlug,
    displayReady: validationResult.displayReady,
    snapshotShapeOkForRenderer: validationResult.ok && validationResult.displayReady,
  };
}

function analyzeRow(family, row) {
  const validationResult = validateReportSnapshot(family, row.report_snapshot);
  const result = {
    family,
    identity: {
      report_id: row.id,
      attempt_id: row.attempt_id,
      test_slug: row.test_slug,
      report_status: row.report_status,
      generator_type: row.generator_type ?? null,
      model_name: row.model_name ?? null,
      input_snapshot_present: Boolean(row.input_snapshot),
      report_snapshot_present: Boolean(row.report_snapshot),
    },
    validator: {
      ok: validationResult.ok,
      validator: validationResult.validatorName,
      errors: validationResult.errors.slice(0, 8),
    },
    structuralLabelChecks:
      family === "ipip"
        ? buildIpipStructuralChecks(row)
        : {
            skipped: true,
            reason: `${family} does not use IPIP Agreeableness/Cooperation label checks.`,
          },
    languageDiagnostics: buildLanguageDiagnostics(family, row),
    contentShapeDigest: buildContentShapeDigest(family, row.report_snapshot),
    rendererReadiness: buildRendererReadiness(family, row, validationResult),
  };

  return result;
}

function formatDigestResult(review) {
  const lines = [];

  lines.push("READ_ONLY=true | OPENAI_CALLED=false | DB_WRITES=false | REGENERATED=false");

  for (const family of ["ipip", "safran", "mwms"]) {
    const item = review[family];
    const familyLabel = FAMILY_CONFIG[family].label;
    lines.push("");
    lines.push(`[${familyLabel}]`);
    lines.push(
      `identity: report_id=${item.identity.report_id} attempt_id=${item.identity.attempt_id} test_slug=${item.identity.test_slug} status=${item.identity.report_status} generator=${item.identity.generator_type ?? "null"} model=${item.identity.model_name ?? "null"} input_snapshot=${item.identity.input_snapshot_present} report_snapshot=${item.identity.report_snapshot_present}`,
    );
    lines.push(
      `validator: ok=${item.validator.ok} display_ready=${item.rendererReadiness.displayReady} render_format=${item.rendererReadiness.reportRenderFormat}`,
    );

    if (family === "ipip") {
      const checks = item.structuralLabelChecks;
      lines.push(
        `labels: AGREEABLENESS="${checks.expectedAgreeablenessDomainLabel}" input=${checks.inputContainsExpectedDomainLabel} report=${checks.reportContainsExpectedDomainLabel} | COOPERATION="${checks.expectedCooperationFacetLabel}" input=${checks.inputContainsExpectedFacetLabel} report=${checks.reportContainsExpectedFacetLabel}`,
      );
      lines.push(
        `forbidden_labels: Saradljivost_score_refs=${checks.activeSaradljivostScoreReferenceHits.length} Ugodnost=${checks.forbiddenTermCounts.Ugodnost} Kooperativnost=${checks.forbiddenTermCounts.Kooperativnost} Saradnicki_profil=${checks.forbiddenTermCounts["Saradnički profil"]} Saradljivost_total=${checks.forbiddenTermCounts.Saradljivost}`,
      );
    }

    lines.push(
      `language: vjerovatno=${item.languageDiagnostics.vjerovatnoCount} top_cautious_repeat=${item.languageDiagnostics.repeatedCautiousWordingNearTop}(${item.languageDiagnostics.repeatedCautiousWordingNearTopCount}) overuse=${item.languageDiagnostics.englishLeakHits.overuse.length} handling=${item.languageDiagnostics.englishLeakHits.handling.length} Saradljivost=${item.languageDiagnostics.saradljivostHits.length} bullet_artifacts=${item.languageDiagnostics.bulletArtifactPaths.length} filler=${item.languageDiagnostics.genericFillerHits.length}`,
    );
    lines.push(
      `shape: headlines=${joinInline(item.contentShapeDigest.headlineFields)} summary=${joinInline(item.contentShapeDigest.summaryFields)} key_headings=${joinInline(item.contentShapeDigest.keyInsightHeadings)} recommendations=${joinInline(item.contentShapeDigest.recommendationFields)} risks=${joinInline(item.contentShapeDigest.riskFields)} empty=${joinInline(item.contentShapeDigest.emptyRequiredLookingFields)}`,
    );
    lines.push(
      `renderer: route=${item.rendererReadiness.route} helper=${item.rendererReadiness.renderer} shape_ok=${item.rendererReadiness.snapshotShapeOkForRenderer}`,
    );

    if (!item.validator.ok && item.validator.errors.length > 0) {
      lines.push(`validator_errors: ${item.validator.errors.join(" | ")}`);
    }

    if (item.languageDiagnostics.qualityReviewer && !item.languageDiagnostics.qualityReviewer.ok) {
      lines.push(`ipip_quality_issues: ${item.languageDiagnostics.qualityReviewer.formatted}`);
    }
  }

  return lines.join("\n");
}

function joinInline(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "-";
  }

  return values.join(" || ");
}

async function inspectPersistedReports() {
  const reportIdsByFamily = resolveRequestedIds();
  const rowsByFamily = await loadRowsByReportId(reportIdsByFamily);

  return {
    ipip: analyzeRow("ipip", rowsByFamily.ipip),
    safran: analyzeRow("safran", rowsByFamily.safran),
    mwms: analyzeRow("mwms", rowsByFamily.mwms),
  };
}

async function main() {
  const argv = process.argv.slice(2);

  if (parseBooleanFlag(argv, "help")) {
    console.log(buildUsageText());
    return;
  }

  if (parseBooleanFlag(argv, "dry-run") || parseCliValue(argv, "mode") === "dry-run") {
    console.log(JSON.stringify(buildDryRunSummary(), null, 2));
    return;
  }

  const review = await inspectPersistedReports();
  console.log(formatDigestResult(review));
}

module.exports = {
  DEFAULT_FIXTURE_REPORT_IDS,
  DEFAULT_FIXTURE_ATTEMPT_IDS,
  REPORT_ID_ENV_NAMES,
  buildUsageText,
  buildDryRunSummary,
  resolveRequestedIds,
  collectStringEntries,
  findTermHits,
  buildIpipStructuralChecks,
  buildLanguageDiagnostics,
  buildContentShapeDigest,
  buildRendererReadiness,
  analyzeRow,
  formatDigestResult,
  inspectPersistedReports,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
