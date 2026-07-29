const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const promptPackagePath = "assessment-packages/ipip-neo-120-v1/prompts.json";
const bsPromptPackagePath = "assessment-packages/ipip-neo-120-v1/locales/bs/prompts.json";
const schemaPath = "lib/assessment/schemas/ipip-neo-120-hr-v1.json";
const promptKey = "ipip_neo_120_hr_v2";
const newVersion = "v2_ipip_hr_natural_bosnian_section_roles_20260729";
const expectedRequiredSchemaKeys = [
  "contract_version",
  "test",
  "meta",
  "score_references",
  "headline",
  "executive_summary",
  "key_hr_signals",
  "verification_focus",
  "interview_questions",
  "strengths_and_overuse_risks",
  "domain_overview",
  "onboarding_and_management_guidance",
  "team_fit_notes",
  "decision_support_note",
  "interpretation_note",
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

function findPrompt(prompts, expectedKey, expectedVersion) {
  return prompts.find(
    (prompt) => prompt.prompt_key === expectedKey && prompt.version === expectedVersion,
  );
}

function collectSchemaPropertyNames(value, names = new Set()) {
  if (!value || typeof value !== "object") return names;

  if (value.properties && typeof value.properties === "object") {
    for (const key of Object.keys(value.properties)) names.add(key);
  }

  for (const child of Object.values(value)) {
    collectSchemaPropertyNames(child, names);
  }

  return names;
}

function referencedJsonKeys(promptText) {
  return [...promptText.matchAll(/`([A-Za-z][A-Za-z0-9_]*)`/g)].map((match) => match[1]);
}

function assertPromptIncludes(promptText, anchor, label = anchor) {
  assert.ok(promptText.includes(anchor), `Expected prompt contract anchor: ${label}`);
}

const prompts = readJson(promptPackagePath);
const bsPrompts = readJson(bsPromptPackagePath);
const newPrompt = findPrompt(prompts, promptKey, newVersion);
const newBsPrompt = findPrompt(bsPrompts, promptKey, newVersion);

assert.ok(newPrompt, "new IPIP HR prompt version must be registered");
assert.ok(newBsPrompt, "new IPIP HR BS localization must be registered");
assert.equal(newPrompt.is_active, false, "source-only prompt version must not activate itself");
assert.equal(newBsPrompt.is_active, false);
assert.equal(newPrompt.output_schema_json, null, "prompt version must reuse the existing schema contract");
assert.equal(newBsPrompt.system_prompt, newPrompt.system_prompt);
assert.equal(newBsPrompt.user_prompt_template, newPrompt.user_prompt_template);

const schema = readJson(schemaPath);
assert.equal(schema.$id, "ipip-neo-120-hr-v2");
assert.deepEqual(schema.required, expectedRequiredSchemaKeys);

const promptText = `${newPrompt.system_prompt}\n${newPrompt.user_prompt_template}`;
const referencedKeys = referencedJsonKeys(promptText);
const schemaPropertyNames = collectSchemaPropertyNames(schema);

for (const key of expectedRequiredSchemaKeys) {
  assert.ok(referencedKeys.includes(key), `${key} must be referenced in the combined prompt contract`);
}

for (const key of referencedKeys) {
  assert.ok(schemaPropertyNames.has(key), `prompt references unknown schema key: ${key}`);
}

for (const [anchor, label] of [
  ["prirodnim bosanskim jezikom", "natural Bosnian language"],
  ["latinicu i ijekavicu", "Latin script and ijekavian standard"],
  ["prirodne bosanske formulacije", "natural business phrasing"],
  ["profesionalnom ali razgovjetnom HR stilu", "professional, clear HR style"],
  ["Nazive JSON polja, canonical kodove i strukturne vrijednosti", "structural JSON boundary"],
  ["narativne string vrijednosti", "Bosnian narrative string values"],
  ["Izvještaj je detaljan radni dokument", "detailed report"],
  ["Ne uvodi globalni limit dužine", "no global length limit"],
  ["izvještaj nije dijagnoza", "non-diagnostic safety boundary"],
  ["zapošljavanje ili odbijanje kandidata", "no standalone hiring decision"],
  ["zaštićenim karakteristikama", "protected-characteristics safety boundary"],
]) {
  assertPromptIncludes(promptText, anchor, label);
}

for (const [key, roleAnchor] of [
  ["key_hr_signals", "ključne HR signale"],
  ["key_hr_signals", "uporište u rezultatima"],
  ["verification_focus", "hipotezu i način provjere"],
  ["interview_questions", "konkretan primjer prethodnog ponašanja"],
  ["strengths_and_overuse_risks", "mogući rizik pretjeranog oslanjanja"],
  ["strengths_and_overuse_risks", "moguću korist"],
  ["key_hr_signals", "Ista tema ili dokaz mogu se koristiti u više sekcija"],
  ["key_hr_signals", "Ne ponavljaj isti zaključak doslovno ili skoro doslovno"],
]) {
  assert.ok(referencedKeys.includes(key), `${key} must remain part of the prompt contract`);
  assertPromptIncludes(promptText, roleAnchor, `${key}: ${roleAnchor}`);
}

console.log("test-ipip-hr-prompt-version-contract: ok");
