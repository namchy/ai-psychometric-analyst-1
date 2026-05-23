const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const helperModule = await import(
    pathToFileURL(path.join(__dirname, "..", "lib", "assessment", "team-dynamics-runtime.mjs"))
      .href
  );

  assert.equal(typeof helperModule.getTeamDynamicsExecutionShellSpec, "function");

  const payload = await helperModule.getTeamDynamicsExecutionShellSpec();

  assert.ok(payload);
  assert.equal(payload.assessmentKey, "team_dynamics_assessment_v1");
  assert.equal(payload.shellMode, "read_only_execution_spec");
  assert.equal(payload.metadata.totalUnits, 48);
  assert.equal(payload.metadata.likertUnitCount, 42);
  assert.equal(payload.metadata.sjtScenarioCount, 6);
  assert.equal(payload.metadata.sjtOptionCount, 24);
  assert.equal(payload.metadata.supportsMixedFormat, true);
  assert.equal(payload.metadata.supportsLikert, true);
  assert.equal(payload.metadata.supportsSjtBestWorst, true);
  assert.equal(payload.metadata.persistenceEnabled, false);
  assert.equal(payload.metadata.scoringEnabled, false);
  assert.equal(payload.metadata.reportEnabled, false);
  assert.deepEqual(payload.metadata.blockKeys, [
    "tdm-31-V1",
    "psychological_safety",
    "situational_judgment",
    "outcome_pulse",
  ]);

  assert.equal(payload.units[0].unitType, "likert_item");
  assert.equal(payload.units[0].itemId, "TDM31_01");
  assert.equal(payload.units[0].responseScaleKey, "likert_1_4_agreement");
  assert.equal(payload.units[0].options.length, 4);
  assert.deepEqual(
    payload.optionCatalogs.likert_1_4_agreement.map((option) => option.value),
    [1, 2, 3, 4],
  );

  const sjtUnits = payload.units.filter((unit) => unit.unitType === "sjt_best_worst_scenario");
  assert.equal(sjtUnits.length, 6);

  for (const unit of sjtUnits) {
    assert.equal(unit.responseFormat, "best_worst");
    assert.equal(unit.options.length, 4);
    assert.deepEqual(
      unit.options.map((option) => option.label),
      ["A", "B", "C", "D"],
    );
    assert.deepEqual(
      [...new Set(unit.options.map((option) => option.optionLevel))].sort(),
      ["Acceptable", "Best", "Harmful", "Weak"],
    );
  }

  const outcomeUnits = payload.units.filter((unit) => unit.blockKey === "outcome_pulse");
  assert.equal(outcomeUnits.length, 4);
  assert.ok(outcomeUnits.every((unit) => unit.unitType === "likert_item"));

  assert.equal("responses" in payload, false);
  assert.equal("userResponses" in payload, false);
  assert.equal("responseState" in payload, false);
  assert.equal("scores" in payload, false);
  assert.equal("scoreResults" in payload, false);
  assert.equal("writePath" in payload, false);
  assert.equal("importPath" in payload, false);
  assert.equal("attemptId" in payload, false);

  console.log("✓ team_dynamics_assessment_v1 read-only execution shell is valid");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

