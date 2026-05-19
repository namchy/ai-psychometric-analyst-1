const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageDir = path.join(__dirname, "..", "assessment-packages", "team_dynamics_v1_strong");

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(packageDir, fileName), "utf8"));
}

const test = readJson("test.json");
const dimensions = readJson("dimensions.json");
const items = readJson("items.json");
const options = readJson("options.json");

assert.equal(test.slug, "team_dynamics_v1_strong");
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

assert.equal(options.length, 5);
assert.deepEqual(options.map((option) => option.value), [1, 2, 3, 4, 5]);
assert.equal(test.metadata.response_scale.min, 1);
assert.equal(test.metadata.response_scale.max, 5);
assert.deepEqual(Object.keys(test.metadata.response_scale.anchors), ["1", "2", "3", "4", "5"]);

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

console.log("Team Dynamics placeholder package tests passed.");
