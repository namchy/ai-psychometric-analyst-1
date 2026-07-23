const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const contractPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-v2-contract.ts");
const schemaPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-v2-schema.ts");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) return candidatePath;
  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;
    if (fs.existsSync(withExtension)) return withExtension;
  }
  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") return emptyModulePath;
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

const {
  TEAM_FIT_REPORT_V2_TYPE,
  TEAM_FIT_REPORT_V2_VERSION,
  TEAM_FIT_REPORT_V2_AUDIENCE,
  TEAM_FIT_REPORT_V2_SOURCE_TYPE,
  TEAM_FIT_REPORT_V2_ASSESSMENT_CATEGORIES,
  TEAM_FIT_REPORT_V2_ACTION_OWNERS,
  validateTeamFitReportV2,
} = require(contractPath);
const { getTeamFitReportV2JsonSchema } = require(schemaPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function repeat(count, factory) {
  return Array.from({ length: count }, (_, index) => factory(index));
}

function evidenceRefs(text = "Evidence", count = 2) {
  return Array.from({ length: count }, (_, index) => {
    const source = index === 0 || index % 2 === 0 ? "candidate" : "team";

    return {
      source,
      key: `${text}-${source}-${index + 1}`,
    };
  });
}

function buildPayload(options = {}) {
  const text = options.text ?? "Konkretan nalaz";
  const evidenceRefCount = options.evidenceRefCount ?? 2;
  const counts = {
    mainReasons: 2,
    keySignals: 3,
    likelyContributions: 2,
    successConditions: 2,
    frictionRisks: 2,
    interviewPlan: 3,
    adaptForThisTeam: 1,
    teamPreparations: 1,
    first30Days: 2,
    successSignals: 2,
    earlyFrictionSignals: 2,
    managerGuidance: 3,
    interpretationLimits: 1,
    interviewPositiveSignals: 1,
    interviewConcernSignals: 1,
    ...(options.counts ?? {}),
  };
  const ownedAction = () => ({
    action: text,
    owner: "shared",
    timing: text,
    expectedResult: text,
  });

  return {
    reportType: TEAM_FIT_REPORT_V2_TYPE,
    reportVersion: TEAM_FIT_REPORT_V2_VERSION,
    locale: text === "x" ? "x" : "bs-BA",
    generatedAt: text,
    inputSnapshotVersion: text,
    teamFitReportVersion: TEAM_FIT_REPORT_V2_VERSION,
    audience: TEAM_FIT_REPORT_V2_AUDIENCE,
    sourceType: TEAM_FIT_REPORT_V2_SOURCE_TYPE,
    teamContext: {
      organizationId: text,
      teamId: text,
      teamName: text,
      teamAssessmentAssignmentId: null,
      teamDynamicsAggregationSnapshotId: text,
      teamDynamicsReportId: text,
    },
    candidateContext: {
      organizationId: text,
      participantId: text,
      assessmentAssignmentId: null,
      compositeInputSnapshotId: text,
      compositeReportId: text,
      displayName: text,
    },
    source: {
      candidateCompositeInputVersion: text,
      candidateSourceReportIds: [text],
      candidateSourceTestSlugs: [text],
      teamInputVersion: text,
      teamSourceReportIds: [text],
      teamSourceSnapshotIds: [text],
      optionalContextKeys: [],
    },
    executiveAssessment: {
      category: "good_fit_with_conditions",
      headline: text,
      conclusion: text,
      decisionGuidance: text,
      mainReasons: repeat(counts.mainReasons, () => ({
        title: text,
        explanation: text,
        practicalConsequence: text,
        evidenceRefs: evidenceRefs(text, evidenceRefCount),
      })),
    },
    keySignals: repeat(counts.keySignals, () => ({
      title: text,
      explanation: text,
      practicalMeaning: text,
      evidenceRefs: evidenceRefs(text, evidenceRefCount),
    })),
    likelyContributions: repeat(counts.likelyContributions, () => ({
      title: text,
      explanation: text,
      conditions: text,
      evidenceRefs: evidenceRefs(text, evidenceRefCount),
    })),
    successConditions: repeat(counts.successConditions, () => ({
      title: text,
      condition: text,
      whyItMatters: text,
      owner: "hiring_manager",
      timing: text,
    })),
    frictionRisks: repeat(counts.frictionRisks, () => ({
      title: text,
      trigger: text,
      likelyPattern: text,
      teamImpact: text,
      mitigation: text,
      owner: "team_lead",
      timing: text,
      evidenceRefs: evidenceRefs(text, evidenceRefCount),
    })),
    interviewPlan: repeat(counts.interviewPlan, () => ({
      question: text,
      purpose: text,
      whatToListenFor: text,
      positiveSignals: repeat(counts.interviewPositiveSignals, () => text),
      concernSignals: repeat(counts.interviewConcernSignals, () => text),
      evidenceRefs: evidenceRefs(text, evidenceRefCount),
    })),
    teamIntegrationPlan: {
      summary: text,
      retainFromBaselineOnboarding: [text],
      adaptForThisTeam: repeat(counts.adaptForThisTeam, ownedAction),
      teamPreparations: repeat(counts.teamPreparations, () => ({
        action: text,
        owner: "team",
        timing: text,
      })),
      first30Days: repeat(counts.first30Days, ownedAction),
      successSignals: repeat(counts.successSignals, () => text),
      earlyFrictionSignals: repeat(counts.earlyFrictionSignals, () => text),
    },
    managerGuidance: repeat(counts.managerGuidance, () => ({
      action: text,
      rationale: text,
      timing: text,
      watchFor: text,
    })),
    interpretationLimits: repeat(counts.interpretationLimits, () => text),
    metadata: {
      provider: null,
      providerVersion: null,
      generatedAt: text,
    },
  };
}

function expectIssue(payload, path, code) {
  const result = validateTeamFitReportV2(payload);
  assert.equal(result.ok, false, `Expected ${path} (${code}) to fail.`);
  assert.equal(
    result.issues.some((issue) => issue.path === path && issue.code === code),
    true,
    `Missing ${code} issue at ${path}: ${JSON.stringify(result.issues)}`,
  );
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}

function assertEvidenceRefCount(payload, expectedCount) {
  const evidenceBearingSections = [
    ...payload.executiveAssessment.mainReasons,
    ...payload.keySignals,
    ...payload.likelyContributions,
    ...payload.frictionRisks,
    ...payload.interviewPlan,
  ];

  evidenceBearingSections.forEach((section) => {
    assert.equal(section.evidenceRefs.length, expectedCount);
    assert.equal(new Set(section.evidenceRefs.map((reference) => reference.key)).size, expectedCount);
  });
}

function testValidCases() {
  const representative = buildPayload();
  const originalJson = JSON.stringify(representative);
  const representativeResult = validateTeamFitReportV2(representative);
  assert.equal(representativeResult.ok, true);
  assert.equal(representativeResult.value, representative);
  assert.equal(JSON.stringify(representative), originalJson);

  assert.equal(validateTeamFitReportV2(buildPayload()).ok, true);

  const maximum = buildPayload({
    evidenceRefCount: 6,
    counts: {
      mainReasons: 4,
      keySignals: 6,
      likelyContributions: 4,
      successConditions: 4,
      frictionRisks: 4,
      interviewPlan: 5,
      adaptForThisTeam: 5,
      teamPreparations: 5,
      first30Days: 6,
      successSignals: 5,
      earlyFrictionSignals: 5,
      managerGuidance: 5,
      interpretationLimits: 4,
      interviewPositiveSignals: 4,
      interviewConcernSignals: 4,
    },
  });
  assertEvidenceRefCount(maximum, 6);
  const maximumResult = validateTeamFitReportV2(maximum);
  assert.equal(maximumResult.ok, true);
  assert.equal(maximumResult.complete, true);
  assert.deepEqual(maximumResult.issues, []);
  assert.equal(maximumResult.value, maximum);

  const minimalGenericText = buildPayload({ text: "x" });
  assert.equal(validateTeamFitReportV2(minimalGenericText).ok, true);

  const frozenPayload = buildPayload();
  const frozenOriginal = clone(frozenPayload);
  deepFreeze(frozenPayload);
  const frozenResult = validateTeamFitReportV2(frozenPayload);
  assert.equal(frozenResult.ok, true);
  assert.equal(frozenResult.complete, true);
  assert.deepEqual(frozenResult.issues, []);
  assert.equal(frozenResult.value, frozenPayload);
  assert.deepEqual(frozenPayload, frozenOriginal);
}

function testInvalidCases() {
  const missingSection = buildPayload();
  delete missingSection.keySignals;
  expectIssue(missingSection, "keySignals", "missing_field");

  const missingNested = buildPayload();
  delete missingNested.executiveAssessment.mainReasons[0].explanation;
  expectIssue(missingNested, "executiveAssessment.mainReasons[0].explanation", "missing_field");

  const emptyString = buildPayload();
  emptyString.executiveAssessment.headline = "";
  expectIssue(emptyString, "executiveAssessment.headline", "empty_string");

  const whitespaceString = buildPayload();
  whitespaceString.executiveAssessment.headline = "   ";
  expectIssue(whitespaceString, "executiveAssessment.headline", "empty_string");

  const emptyArray = buildPayload();
  emptyArray.managerGuidance = [];
  expectIssue(emptyArray, "managerGuidance", "array_too_short");

  const belowMinimum = buildPayload();
  belowMinimum.keySignals = belowMinimum.keySignals.slice(0, 2);
  expectIssue(belowMinimum, "keySignals", "array_too_short");

  const evidenceBelowMinimum = buildPayload({ evidenceRefCount: 1 });
  expectIssue(
    evidenceBelowMinimum,
    "executiveAssessment.mainReasons[0].evidenceRefs",
    "array_too_short",
  );

  const evidenceAboveMaximum = buildPayload({ evidenceRefCount: 7 });
  expectIssue(
    evidenceAboveMaximum,
    "keySignals[0].evidenceRefs",
    "array_too_long",
  );

  const aboveMaximum = buildPayload();
  aboveMaximum.frictionRisks = repeat(5, () => clone(aboveMaximum.frictionRisks[0]));
  expectIssue(aboveMaximum, "frictionRisks", "array_too_long");

  const unknownTopLevel = buildPayload();
  unknownTopLevel.fitScore = 99;
  expectIssue(unknownTopLevel, "fitScore", "unknown_field");

  const unknownNested = buildPayload();
  unknownNested.managerGuidance[0].summary = "x";
  expectIssue(unknownNested, "managerGuidance[0].summary", "unknown_field");

  const wrongEnum = buildPayload();
  wrongEnum.executiveAssessment.category = "excellent_fit";
  expectIssue(wrongEnum, "executiveAssessment.category", "invalid_enum");

  const missingCandidateEvidence = buildPayload();
  missingCandidateEvidence.keySignals[0].evidenceRefs = [
    { source: "team", key: "team-1" },
    { source: "team", key: "team-2" },
  ];
  expectIssue(missingCandidateEvidence, "keySignals[0].evidenceRefs", "missing_candidate_evidence");

  const missingTeamEvidence = buildPayload();
  missingTeamEvidence.interviewPlan[0].evidenceRefs = [
    { source: "candidate", key: "candidate-1" },
    { source: "candidate", key: "candidate-2" },
  ];
  expectIssue(missingTeamEvidence, "interviewPlan[0].evidenceRefs", "missing_team_evidence");

  const unknownEvidenceField = buildPayload();
  unknownEvidenceField.frictionRisks[0].evidenceRefs[0].label = "x";
  expectIssue(unknownEvidenceField, "frictionRisks[0].evidenceRefs[0].label", "unknown_field");

  const incompleteIntegrationItem = buildPayload();
  delete incompleteIntegrationItem.teamIntegrationPlan.first30Days[0].expectedResult;
  expectIssue(
    incompleteIntegrationItem,
    "teamIntegrationPlan.first30Days[0].expectedResult",
    "missing_field",
  );

  const v1Type = buildPayload();
  v1Type.reportType = "team_fit_report_v1";
  expectIssue(v1Type, "reportType", "invalid_enum");

  const wrongVersion = buildPayload();
  wrongVersion.reportVersion = "v1";
  expectIssue(wrongVersion, "reportVersion", "invalid_enum");

  const wrongContractVersion = buildPayload();
  wrongContractVersion.teamFitReportVersion = "v1";
  expectIssue(wrongContractVersion, "teamFitReportVersion", "invalid_enum");

  expectIssue([], "<root>", "invalid_type");

  const undefinedNested = buildPayload();
  undefinedNested.teamIntegrationPlan.adaptForThisTeam[0].timing = undefined;
  expectIssue(undefinedNested, "teamIntegrationPlan.adaptForThisTeam[0].timing", "invalid_format");

  const multipleIssues = buildPayload();
  multipleIssues.executiveAssessment.headline = "";
  multipleIssues.managerGuidance = [];
  const multipleResult = validateTeamFitReportV2(multipleIssues);
  assert.equal(multipleResult.ok, false);
  assert.equal(multipleResult.issues.some((issue) => issue.path === "executiveAssessment.headline"), true);
  assert.equal(multipleResult.issues.some((issue) => issue.path === "managerGuidance"), true);
}

function visitSchema(node, path, visitor) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  visitor(node, path);
  if (node.properties) {
    Object.entries(node.properties).forEach(([key, child]) => {
      visitSchema(child, path ? `${path}.${key}` : key, visitor);
    });
  }
  if (node.items) visitSchema(node.items, `${path}[]`, visitor);
  if (Array.isArray(node.anyOf)) {
    node.anyOf.forEach((child, index) => visitSchema(child, `${path}.anyOf[${index}]`, visitor));
  }
}

function schemaAt(schema, pathExpression) {
  return pathExpression.split(".").reduce((node, segment) => {
    if (segment.endsWith("[]")) {
      return node.properties[segment.slice(0, -2)].items;
    }
    return node.properties[segment];
  }, schema);
}

function assertLimits(schema, pathExpression, minItems, maxItems) {
  const node = schemaAt(schema, pathExpression);
  assert.equal(node.minItems, minItems, `${pathExpression}.minItems`);
  assert.equal(node.maxItems, maxItems, `${pathExpression}.maxItems`);
}

function testSchemaParity() {
  const schema = getTeamFitReportV2JsonSchema();
  assert.equal(schema.type, "object");
  assert.equal(schema.properties.reportType.const, TEAM_FIT_REPORT_V2_TYPE);
  assert.equal(schema.properties.reportVersion.const, TEAM_FIT_REPORT_V2_VERSION);
  assert.equal(schema.properties.teamFitReportVersion.const, TEAM_FIT_REPORT_V2_VERSION);
  assert.equal(schema.properties.audience.const, TEAM_FIT_REPORT_V2_AUDIENCE);
  assert.equal(schema.properties.sourceType.const, TEAM_FIT_REPORT_V2_SOURCE_TYPE);
  assert.notEqual(TEAM_FIT_REPORT_V2_TYPE, "team_fit_report_v1");

  visitSchema(schema, "", (node, nodePath) => {
    if (node.type === "object") {
      assert.equal(node.additionalProperties, false, `${nodePath || "<root>"} must be strict.`);
      assert.deepEqual(
        [...node.required].sort(),
        Object.keys(node.properties).sort(),
        `${nodePath || "<root>"} required keys must match properties.`,
      );
    }
  });

  const expectedTopLevel = [
    "reportType", "reportVersion", "locale", "generatedAt", "inputSnapshotVersion",
    "teamFitReportVersion", "audience", "sourceType", "teamContext", "candidateContext",
    "source", "executiveAssessment", "keySignals", "likelyContributions", "successConditions",
    "frictionRisks", "interviewPlan", "teamIntegrationPlan", "managerGuidance",
    "interpretationLimits", "metadata",
  ];
  assert.deepEqual([...schema.required].sort(), expectedTopLevel.sort());

  assertLimits(schema, "executiveAssessment.mainReasons", 2, 4);
  assertLimits(schema, "executiveAssessment.mainReasons[].evidenceRefs", 2, 6);
  assertLimits(schema, "keySignals", 3, 6);
  assertLimits(schema, "likelyContributions", 2, 4);
  assertLimits(schema, "successConditions", 2, 4);
  assertLimits(schema, "frictionRisks", 2, 4);
  assertLimits(schema, "interviewPlan", 3, 5);
  assertLimits(schema, "interviewPlan[].positiveSignals", 1, 4);
  assertLimits(schema, "interviewPlan[].concernSignals", 1, 4);
  assertLimits(schema, "teamIntegrationPlan.adaptForThisTeam", 1, 5);
  assertLimits(schema, "teamIntegrationPlan.teamPreparations", 1, 5);
  assertLimits(schema, "teamIntegrationPlan.first30Days", 2, 6);
  assertLimits(schema, "teamIntegrationPlan.successSignals", 2, 5);
  assertLimits(schema, "teamIntegrationPlan.earlyFrictionSignals", 2, 5);
  assertLimits(schema, "managerGuidance", 3, 5);
  assertLimits(schema, "interpretationLimits", 1, 4);

  assert.deepEqual(
    schema.properties.executiveAssessment.properties.category.enum,
    [...TEAM_FIT_REPORT_V2_ASSESSMENT_CATEGORIES],
  );

  const ownerEnums = [];
  visitSchema(schema, "", (node, nodePath) => {
    if (nodePath.endsWith(".owner")) ownerEnums.push(node.enum);
  });
  assert.equal(ownerEnums.length, 5);
  ownerEnums.forEach((values) => {
    assert.deepEqual(values, [...TEAM_FIT_REPORT_V2_ACTION_OWNERS]);
  });

  assert.deepEqual(
    schemaAt(schema, "executiveAssessment.mainReasons[]").required,
    ["title", "explanation", "practicalConsequence", "evidenceRefs"],
  );
  assert.deepEqual(
    schemaAt(schema, "teamIntegrationPlan.first30Days[]").required,
    ["action", "owner", "timing", "expectedResult"],
  );
}

function main() {
  testValidCases();
  testInvalidCases();
  testSchemaParity();
  console.log("test-team-fit-report-v2-contract: ok");
}

main();
