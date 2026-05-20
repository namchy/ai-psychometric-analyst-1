const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageDir = path.join(__dirname, "..", "assessment-packages", "team_dynamics_v1_strong");
const localizedBsDir = path.join(packageDir, "locales", "bs");

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(packageDir, fileName), "utf8"));
}

assert.equal(fs.existsSync(packageDir), true);

const test = readJson("test.json");
const dimensions = readJson("dimensions.json");
const items = readJson("items.json");
const options = readJson("options.json");
const prompts = readJson("prompts.json");
const localizedQuestions = JSON.parse(
  fs.readFileSync(path.join(localizedBsDir, "questions.json"), "utf8"),
);
const localizedOptions = JSON.parse(
  fs.readFileSync(path.join(localizedBsDir, "options.json"), "utf8"),
);
const localizedPrompts = JSON.parse(
  fs.readFileSync(path.join(localizedBsDir, "prompts.json"), "utf8"),
);

assert.equal(test.slug, "team_dynamics_v1_strong");
assert.equal(test.intended_use, "team_assessment");
assert.equal(test.report_family, "team_dynamics");
assert.equal(test.status, "draft");
assert.equal(test.is_active, false);
assert.equal(test.default_locale, "bs");
assert.deepEqual(test.supported_locales, ["bs"]);
assert.equal(test.metadata.placeholder_content_only, true);
assert.equal(test.metadata.legal_status, "licensed_content_not_in_repo");
assert.equal(dimensions.length, 4);
assert.equal(items.length, 36);
assert.equal(test.metadata.item_count, 36);
assert.deepEqual(
  test.metadata.instruments.map((instrument) => instrument.code),
  ["PCS", "JEHN_ICS_8", "TPS_7", "LEWIS_TMS"],
);
assert.deepEqual(
  dimensions.map((dimension) => dimension.code),
  ["PCS", "JEHN_ICS_8", "TPS_7", "LEWIS_TMS"],
);
assert.ok(dimensions.every((dimension) => dimension.metadata?.placeholder_only === true));
assert.ok(
  dimensions.every((dimension) => dimension.description.startsWith("[LICENSED_DIMENSION_PLACEHOLDER_")),
);

assert.equal(options.length, 5);
assert.deepEqual(options.map((option) => option.value), [1, 2, 3, 4, 5]);
assert.equal(test.metadata.response_scale.min, 1);
assert.equal(test.metadata.response_scale.max, 5);
assert.deepEqual(Object.keys(test.metadata.response_scale.anchors), ["1", "2", "3", "4", "5"]);
assert.deepEqual(prompts, []);
assert.equal(localizedQuestions.length, 36);
assert.equal(localizedOptions.length, 5);
assert.deepEqual(localizedPrompts, []);

const expectedCounts = new Map([
  ["PCS", 6],
  ["JEHN_ICS_8", 8],
  ["TPS_7", 7],
  ["LEWIS_TMS", 15],
]);
const observedCounts = new Map();
const placeholderPattern = /^\[LICENSED_ITEM_PLACEHOLDER_(PCS|JEHN_ICS_8|TPS_7|LEWIS_TMS)_\d{2}\]$/;
const obviousRealTextPattern = /\b(team|conflict|safety|memory|knowledge|cohesion|trust|agree|disagree)\b/i;

for (const item of items) {
  assert.match(item.text, placeholderPattern);
  assert.equal(typeof item.metadata, "object");
  assert.equal(typeof item.metadata.reverse_coded, "boolean");
  assert.equal(item.metadata.scale_min, 1);
  assert.equal(item.metadata.scale_max, 5);
  assert.equal(item.metadata.placeholder_only, true);
  assert.equal(item.metadata.licensed_text_in_repo, false);
  assert.ok(item.metadata.scale_anchors);
  assert.equal(item.mappings.length, 1);
  const mapping = item.mappings[0];
  assert.equal(mapping.weight, 1);
  assert.equal(mapping.reverse_scored, item.metadata.reverse_coded);
  assert.ok(expectedCounts.has(mapping.dimension_code));
  assert.equal(item.metadata.instrument_code, mapping.dimension_code);
  assert.equal(obviousRealTextPattern.test(item.text), false);
  observedCounts.set(mapping.dimension_code, (observedCounts.get(mapping.dimension_code) ?? 0) + 1);
}

for (const [code, count] of expectedCounts) {
  assert.equal(observedCounts.get(code), count);
}

assert.deepEqual(
  localizedQuestions.map((entry) => entry.code),
  items.map((item) => item.code),
);
assert.deepEqual(
  localizedOptions.map((entry) => entry.option_order),
  options.map((option) => option.option_order),
);
assert.ok(
  localizedQuestions.every((entry) => placeholderPattern.test(entry.text)),
);

console.log("Team Dynamics placeholder package tests passed.");
