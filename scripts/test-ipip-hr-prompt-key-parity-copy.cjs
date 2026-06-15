const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "scripts/copy-ipip-hr-prompt-key-parity.cjs");
const scriptSource = fs.readFileSync(scriptPath, "utf8");

assert.match(scriptSource, /CONFIRM_IPIP_HR_PROMPT_KEY_PARITY_COPY/);
assert.match(scriptSource, /Dry run only/);
assert.doesNotMatch(scriptSource, /REPORT_PROMPT_KEY|loadPromptVersionForJob|buildUserPrompt|validateStructuredReport/);

const {
  SOURCE_PROMPT_KEY,
  TARGET_PROMPT_KEY,
  TARGET_TEST_SLUG,
  TARGET_VERSION,
  buildPromptParityPlan,
  buildTargetPromptInsert,
  compareLocalizationParity,
} = require("./copy-ipip-hr-prompt-key-parity.cjs");

assert.equal(SOURCE_PROMPT_KEY, "completed_assessment_report");
assert.equal(TARGET_PROMPT_KEY, "ipip_neo_120_hr_v2");
assert.equal(TARGET_TEST_SLUG, "ipip-neo-120-v1");
assert.equal(TARGET_VERSION, "v1_ipip_hr_focused_20260606");

function buildSourcePrompt(overrides = {}) {
  return {
    id: "source-prompt-id",
    test_id: "test-ipip-neo-120",
    report_type: "individual",
    audience: "hr",
    source_type: "single_test",
    generator_type: "openai",
    prompt_key: SOURCE_PROMPT_KEY,
    version: TARGET_VERSION,
    system_prompt: "Source system prompt",
    user_prompt_template: "Source user prompt {{prompt_input_json}}",
    output_schema_json: { $id: "ipip-neo-120-hr-v2", type: "object" },
    is_active: true,
    notes: "source notes",
    updated_by: "user-id",
    ...overrides,
  };
}

const sourcePrompt = buildSourcePrompt();
const sourceLocalizations = [
  {
    locale: "bs",
    system_prompt: "Lokalizovani system prompt",
    user_prompt_template: "Lokalizovani user prompt",
  },
];

const insertPlan = buildPromptParityPlan({
  sourcePrompt,
  targetPrompts: [],
  sourceLocalizations,
  targetLocalizations: [],
});
assert.equal(insertPlan.action, "insert");
assert.deepEqual(insertPlan.insertPrompt, {
  test_id: sourcePrompt.test_id,
  report_type: sourcePrompt.report_type,
  audience: sourcePrompt.audience,
  source_type: sourcePrompt.source_type,
  generator_type: sourcePrompt.generator_type,
  prompt_key: TARGET_PROMPT_KEY,
  version: sourcePrompt.version,
  system_prompt: sourcePrompt.system_prompt,
  user_prompt_template: sourcePrompt.user_prompt_template,
  output_schema_json: sourcePrompt.output_schema_json,
  is_active: true,
  notes: sourcePrompt.notes,
  updated_by: sourcePrompt.updated_by,
});
assert.deepEqual(insertPlan.insertLocalizations, sourceLocalizations);

const targetPrompt = {
  id: "target-prompt-id",
  ...buildTargetPromptInsert(sourcePrompt),
};
const noopPlan = buildPromptParityPlan({
  sourcePrompt,
  targetPrompts: [targetPrompt],
  sourceLocalizations,
  targetLocalizations: sourceLocalizations,
});
assert.equal(noopPlan.action, "noop");
assert.equal(noopPlan.targetPromptId, "target-prompt-id");

assert.throws(
  () =>
    buildPromptParityPlan({
      sourcePrompt,
      targetPrompts: [{ ...targetPrompt, user_prompt_template: "Different content" }],
      sourceLocalizations,
      targetLocalizations: sourceLocalizations,
    }),
  /not identical.*user_prompt_template/,
);

assert.throws(
  () =>
    buildPromptParityPlan({
      sourcePrompt,
      targetPrompts: [{ ...targetPrompt, is_active: false }],
      sourceLocalizations,
      targetLocalizations: sourceLocalizations,
    }),
  /not identical.*is_active/,
);

assert.throws(
  () =>
    buildPromptParityPlan({
      sourcePrompt,
      targetPrompts: [targetPrompt],
      sourceLocalizations,
      targetLocalizations: [],
    }),
  /localizations.*do not match/,
);

assert.throws(
  () =>
    buildPromptParityPlan({
      sourcePrompt: buildSourcePrompt({ prompt_key: TARGET_PROMPT_KEY }),
      targetPrompts: [],
    }),
  /source.prompt_key mismatch/,
);

assert.throws(
  () =>
    buildPromptParityPlan({
      sourcePrompt: buildSourcePrompt({ test_id: null }),
      targetPrompts: [],
    }),
  /test-specific/,
);

assert.equal(
  compareLocalizationParity(
    [
      { locale: "hr", system_prompt: "s2", user_prompt_template: "u2" },
      { locale: "bs", system_prompt: "s1", user_prompt_template: "u1" },
    ],
    [
      { locale: "bs", system_prompt: "s1", user_prompt_template: "u1" },
      { locale: "hr", system_prompt: "s2", user_prompt_template: "u2" },
    ],
  ),
  true,
);

console.log("test-ipip-hr-prompt-key-parity-copy: ok");
