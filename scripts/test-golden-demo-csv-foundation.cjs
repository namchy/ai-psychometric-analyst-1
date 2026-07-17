const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function installTypeScriptHook() {
  require.extensions[".ts"] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filename,
    });
    module._compile(output.outputText, filename);
  };
}

installTypeScriptHook();

const projectRoot = path.resolve(__dirname, "..");
const {
  loadGoldenDemoCsvFoundation,
  loadGoldenDemoRepoContract,
  parseGoldenDemoCsv,
} = require("../lib/golden-demo/csv-loader.ts");
const {
  deriveGoldenDemoEmail,
  inspectGoldenDemoCandidate,
  validateGoldenDemoCsvFoundation,
} = require("../lib/golden-demo/csv-validator.ts");

const foundation = loadGoldenDemoCsvFoundation(projectRoot);
const repoContract = loadGoldenDemoRepoContract(projectRoot);

function cloneDocument(document) {
  return {
    file: document.file,
    headers: [...document.headers],
    rows: document.rows.map((row) => ({
      rowNumber: row.rowNumber,
      columnCount: row.columnCount,
      values: { ...row.values },
    })),
  };
}

function cloneFoundation() {
  return {
    candidates: cloneDocument(foundation.candidates),
    answers: cloneDocument(foundation.answers),
    expectedScores: cloneDocument(foundation.expectedScores),
    expectedAiFindings: cloneDocument(foundation.expectedAiFindings),
  };
}

function candidateRow(mutated, candidateId) {
  const row = mutated.candidates.rows.find(
    (candidate) => candidate.values.candidate_id === candidateId,
  );
  assert.ok(row, `Expected candidate ${candidateId}`);
  return row;
}

function addRow(document, values) {
  document.rows.push({
    rowNumber: document.rows.length + 2,
    columnCount: document.headers.length,
    values: Object.fromEntries(
      document.headers.map((header) => [header, values[header] ?? ""]),
    ),
  });
}

function addColumn(document, column, value) {
  document.headers.push(column);
  for (const row of document.rows) {
    row.columnCount += 1;
    row.values[column] = value;
  }
}

function expectInvalid(label, mutate, expectedCode) {
  const mutated = cloneFoundation();
  mutate(mutated);
  const result = validateGoldenDemoCsvFoundation(mutated, repoContract);
  assert.equal(result.ok, false, `${label} should fail validation`);
  assert.ok(
    result.errors.some((error) => error.code === expectedCode),
    `${label} should report ${expectedCode}; got ${result.errors
      .map((error) => error.code)
      .join(", ")}`,
  );
}

function validAnswer(overrides = {}) {
  return {
    candidate_id: "GD-001",
    test_slug: "ipip-neo-120-v1",
    question_code: "N101",
    response_kind: "single_choice",
    answer_value: "",
    answer_option_code: "N101_opt_1",
    recipe_note: "offline fixture",
    recipe_version: "v1",
    ...overrides,
  };
}

function validScore(overrides = {}) {
  return {
    candidate_id: "GD-001",
    test_slug: "ipip-neo-120-v1",
    score_scope: "persisted_dimension",
    score_key: "ANXIETY",
    expected_value: "12",
    tolerance: "0",
    expected_band: "balanced",
    required: "true",
    expectation_version: "v1",
    ...overrides,
  };
}

function validAiFinding(overrides = {}) {
  return {
    candidate_id: "GD-001",
    report_lane: "ipip_hr",
    finding_key: "ipip_balanced_anxiety",
    expectation_type: "required_signal",
    statement: "Anksioznost je u uravnoteženom rasponu.",
    required: "true",
    expectation_version: "v1",
    ...overrides,
  };
}

const parsedQuotedCsv = parseGoldenDemoCsv(
  'first,second\n"value, with comma","quoted ""value"""\n',
  "quoted-test.csv",
);
assert.equal(parsedQuotedCsv.rows[0].values.first, "value, with comma");
assert.equal(parsedQuotedCsv.rows[0].values.second, 'quoted "value"');

const result = validateGoldenDemoCsvFoundation(foundation, repoContract);
assert.deepEqual(result.errors, []);
assert.equal(result.ok, true);
assert.equal(result.summary.candidateCount, 24);
assert.equal(result.summary.developmentCount, 18);
assert.equal(result.summary.holdoutCount, 6);
assert.deepEqual(result.summary.teamCounts, {
  "GDT-01": 6,
  "GDT-02": 6,
  "GDT-03": 6,
  "GDT-04": 6,
});
assert.equal(result.summary.answerCount, 184);
assert.equal(result.summary.expectedScoreCount, 47);
assert.equal(result.summary.expectedAiFindingCount, 32);

const expectedEmails = {
  "Amel Kovačević": "amel.kovacevic@partnerplus.ba",
  "Anisa Lojo Bajrić": "anisa.lojo.bajric@partnerplus.ba",
  "Ljiljana Ulemek Šapina": "ljiljana.umelek.sapina@partnerplus.ba",
  "Alma Čatović Ademović": "alma.catovic.ademovic@partnerplus.ba",
};
for (const [displayName, email] of Object.entries(expectedEmails)) {
  assert.equal(deriveGoldenDemoEmail(displayName), email);
  const row = foundation.candidates.rows.find(
    (candidate) => candidate.values.display_name === displayName,
  );
  assert.equal(row?.values.email, email);
}

const gd001 = inspectGoldenDemoCandidate(foundation, "GD-001");
assert.ok(gd001);
assert.equal(gd001.candidate.email, "amel.kovacevic@partnerplus.ba");
assert.equal(gd001.candidate.dataStatus, "answers_ready");
assert.deepEqual(gd001.answerCountByTest, {
  "ipip-neo-120-v1": 120,
  mwms_v1: 19,
  safran_v1: 45,
});
assert.deepEqual(gd001.expectedScoreCountByTest, {
  "ipip-neo-120-v1": 35,
  mwms_v1: 8,
  safran_v1: 4,
});
assert.ok(
  Object.values(gd001.expectedAiFindingCountByReportLane).every(
    (count) => count === 4,
  ),
);
assert.equal(inspectGoldenDemoCandidate(foundation, "GD-999"), null);

expectInvalid(
  "duplicate candidate ID",
  (mutated) => {
    candidateRow(mutated, "GD-024").values.candidate_id = "GD-001";
  },
  "duplicate_candidate_id",
);
expectInvalid(
  "missing GD-024",
  (mutated) => {
    mutated.candidates.rows = mutated.candidates.rows.filter(
      (row) => row.values.candidate_id !== "GD-024",
    );
  },
  "missing_candidate_id",
);
expectInvalid(
  "wrong cohort segment",
  (mutated) => {
    candidateRow(mutated, "GD-001").values.cohort_segment = "holdout";
  },
  "candidate_segment_mismatch",
);
expectInvalid(
  "seven candidates in a team",
  (mutated) => {
    candidateRow(mutated, "GD-006").values.team_id = "GDT-01";
  },
  "invalid_team_count",
);
expectInvalid(
  "email with diacritic",
  (mutated) => {
    candidateRow(mutated, "GD-002").values.email =
      "nataša.rapaic@partnerplus.ba";
  },
  "email_derivation_mismatch",
);
expectInvalid(
  "email missing surname token",
  (mutated) => {
    candidateRow(mutated, "GD-005").values.email =
      "anisa.bajric@partnerplus.ba";
  },
  "email_derivation_mismatch",
);
expectInvalid(
  "wrong email domain",
  (mutated) => {
    candidateRow(mutated, "GD-001").values.email = "amel.kovacevic@test.invalid";
  },
  "invalid_email_domain",
);
expectInvalid(
  "duplicate email",
  (mutated) => {
    candidateRow(mutated, "GD-002").values.email =
      candidateRow(mutated, "GD-001").values.email;
  },
  "duplicate_email",
);
expectInvalid(
  "nationality column",
  (mutated) => addColumn(mutated.candidates, "nationality", ""),
  "forbidden_sensitive_column",
);
expectInvalid(
  "UUID column",
  (mutated) => addColumn(mutated.candidates, "participant_uuid", ""),
  "forbidden_database_id_column",
);
expectInvalid(
  "unknown test slug",
  (mutated) =>
    addRow(mutated.answers, validAnswer({ test_slug: "unknown-test" })),
  "unknown_test_slug",
);
expectInvalid(
  "unknown question code",
  (mutated) =>
    addRow(mutated.answers, validAnswer({ question_code: "UNKNOWN" })),
  "unknown_question_code",
);
expectInvalid(
  "option code from another question",
  (mutated) =>
    addRow(
      mutated.answers,
      validAnswer({ answer_option_code: "N102_opt_1" }),
    ),
  "answer_option_not_in_question",
);
expectInvalid(
  "single choice without option code",
  (mutated) =>
    addRow(mutated.answers, validAnswer({ answer_option_code: "" })),
  "missing_answer_option_code",
);
expectInvalid(
  "text without answer value",
  (mutated) =>
    addRow(
      mutated.answers,
      validAnswer({
        test_slug: "safran_v1",
        question_code: "NZ01_01",
        response_kind: "text",
        answer_value: "",
        answer_option_code: "",
      }),
    ),
  "missing_answer_value",
);
expectInvalid(
  "negative tolerance",
  (mutated) => addRow(mutated.expectedScores, validScore({ tolerance: "-0.01" })),
  "invalid_tolerance",
);
expectInvalid(
  "unknown score key",
  (mutated) => addRow(mutated.expectedScores, validScore({ score_key: "UNKNOWN" })),
  "unknown_score_key",
);
expectInvalid(
  "unknown report lane",
  (mutated) =>
    addRow(mutated.expectedAiFindings, validAiFinding({ report_lane: "unknown" })),
  "unknown_report_lane",
);
expectInvalid(
  "empty AI statement",
  (mutated) =>
    addRow(mutated.expectedAiFindings, validAiFinding({ statement: "" })),
  "empty_ai_statement",
);

process.stdout.write(
  "Golden Demo CSV foundation tests passed (populated canonical path and 19 negative mutations).\n",
);
