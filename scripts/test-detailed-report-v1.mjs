import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { loadAssessmentPackage } from "./validate-assessment-package.mjs";

const ROOT_DIR = path.resolve(new URL("..", import.meta.url).pathname);
const PACKAGE_DIR = path.join(ROOT_DIR, "assessment-packages/ipip50-hr-v1");
const SCHEMA_PATH = path.join(
  ROOT_DIR,
  "lib/assessment/schemas/detailed-report-v1.json",
);
const OPENAI_SCHEMA_PATH = path.join(
  ROOT_DIR,
  "lib/assessment/schemas/detailed-report-v1-openai.json",
);
const DIMENSION_ORDER = [
  "EXTRAVERSION",
  "AGREEABLENESS",
  "CONSCIENTIOUSNESS",
  "EMOTIONAL_STABILITY",
  "INTELLECT",
];

function fail(message) {
  throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function schemaContainsKey(value, key) {
  if (Array.isArray(value)) {
    return value.some((item) => schemaContainsKey(item, key));
  }

  if (!isObject(value)) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(value, key)) {
    return true;
  }

  return Object.values(value).some((item) => schemaContainsKey(item, key));
}

function validateDetailedReport(report) {
  if (!isObject(report)) {
    return { ok: false, reason: "Report must be an object." };
  }

  const expectedKeys = [
    "report_title",
    "report_subtitle",
    "summary",
    "strengths",
    "blind_spots",
    "development_recommendations",
    "dimension_insights",
    "disclaimer",
  ];
  const extraKeys = Object.keys(report).filter((key) => !expectedKeys.includes(key));

  if (extraKeys.length > 0) {
    return { ok: false, reason: `Unexpected top-level keys: ${extraKeys.join(", ")}.` };
  }

  for (const key of ["report_title", "report_subtitle", "disclaimer"]) {
    if (!isNonEmptyString(report[key])) {
      return { ok: false, reason: `${key} must be a non-empty string.` };
    }
  }

  if (!isObject(report.summary)) {
    return { ok: false, reason: "summary must be an object." };
  }

  if (!isNonEmptyString(report.summary.headline) || !isNonEmptyString(report.summary.overview)) {
    return { ok: false, reason: "summary.headline and summary.overview must be non-empty strings." };
  }

  const validateTitleDescriptionArray = (value, key) => {
    if (!Array.isArray(value) || value.length !== 3) {
      return `${key} must contain exactly 3 items.`;
    }

    for (const item of value) {
      if (!isObject(item) || !isNonEmptyString(item.title) || !isNonEmptyString(item.description)) {
        return `${key} items must contain non-empty title and description strings.`;
      }
    }

    return null;
  };

  const strengthsError = validateTitleDescriptionArray(report.strengths, "strengths");
  if (strengthsError) {
    return { ok: false, reason: strengthsError };
  }

  const blindSpotsError = validateTitleDescriptionArray(report.blind_spots, "blind_spots");
  if (blindSpotsError) {
    return { ok: false, reason: blindSpotsError };
  }

  if (
    !Array.isArray(report.development_recommendations) ||
    report.development_recommendations.length !== 3
  ) {
    return {
      ok: false,
      reason: "development_recommendations must contain exactly 3 items.",
    };
  }

  for (const item of report.development_recommendations) {
    if (
      !isObject(item) ||
      !isNonEmptyString(item.title) ||
      !isNonEmptyString(item.description) ||
      !isNonEmptyString(item.action)
    ) {
      return {
        ok: false,
        reason:
          "development_recommendations items must contain non-empty title, description, and action strings.",
      };
    }
  }

  if (!Array.isArray(report.dimension_insights) || report.dimension_insights.length !== 5) {
    return { ok: false, reason: "dimension_insights must contain exactly 5 items." };
  }

  const seenDimensionCodes = new Set();

  for (const [index, item] of report.dimension_insights.entries()) {
    if (!isObject(item)) {
      return { ok: false, reason: `dimension_insights[${index}] must be an object.` };
    }

    if (!DIMENSION_ORDER.includes(item.dimension_code)) {
      return {
        ok: false,
        reason: `dimension_insights[${index}].dimension_code must be one of ${DIMENSION_ORDER.join(", ")}.`,
      };
    }

    if (seenDimensionCodes.has(item.dimension_code)) {
      return {
        ok: false,
        reason: `dimension_insights[${index}].dimension_code must not duplicate ${item.dimension_code}.`,
      };
    }

    seenDimensionCodes.add(item.dimension_code);

    if (item.dimension_code !== DIMENSION_ORDER[index]) {
      return {
        ok: false,
        reason: `dimension_insights[${index}].dimension_code must be ${DIMENSION_ORDER[index]}.`,
      };
    }

    if (!["low", "moderate", "high"].includes(item.score_band)) {
      return {
        ok: false,
        reason: `dimension_insights[${index}].score_band must be low, moderate, or high.`,
      };
    }

    for (const key of [
      "dimension_label",
      "summary",
      "work_style",
      "risks",
      "development_focus",
    ]) {
      if (!isNonEmptyString(item[key])) {
        return {
          ok: false,
          reason: `dimension_insights[${index}].${key} must be a non-empty string.`,
        };
      }
    }
  }

  for (const expectedCode of DIMENSION_ORDER) {
    if (!seenDimensionCodes.has(expectedCode)) {
      return {
        ok: false,
        reason: `dimension_insights must include ${expectedCode}.`,
      };
    }
  }

  return { ok: true };
}

function buildValidDetailedReportSample() {
  return {
    report_title: "Tvoj detaljni izvještaj procjene",
    report_subtitle: "Razvojni pregled obrasca rezultata za ipip50-hr-v1.",
    summary: {
      headline: "Savjesnost i ekstraverzija se najviše ističu u ovom obrascu rezultata.",
      overview:
        "Izvještaj koristi determinističke skorove po svih pet dimenzija i opisuje vjerovatne obrasce rada, komunikacije i razvoja bez apsolutnih zaključaka.",
    },
    strengths: [
      {
        title: "1. Savjesnost",
        description: "Rezultat sugerira pouzdanost, osjećaj za strukturu i stabilniji ritam izvršenja.",
      },
      {
        title: "2. Ekstraverzija",
        description: "Rezultat sugerira vidljiv angažman i lakše uključivanje u timsku dinamiku.",
      },
      {
        title: "3. Kooperativnost",
        description: "Rezultat sugerira spremnost na saradnju i očuvanje odnosa kada je to korisno poslu.",
      },
    ],
    blind_spots: [
      {
        title: "1. Emocionalna stabilnost",
        description: "Pod većim pritiskom vrijedi ranije prepoznati što povećava unutrašnje opterećenje.",
      },
      {
        title: "2. Intelekt / imaginacija",
        description: "Vrijedi paziti da praktični fokus ne zatvori prerano prostor za dodatnu ideju.",
      },
      {
        title: "3. Ekstraverzija",
        description: "Visoka socijalna energija nekad može smanjiti prostor za tuđi ritam i tiše signale.",
      },
    ],
    development_recommendations: [
      {
        title: "1. Fokus na emocionalnu stabilnost",
        description: "Prepoznaj rane znakove opterećenja i uvedi kratku rutinu oporavka u sedmični ritam rada.",
        action: "Prati jednu konkretnu naviku oporavka kroz naredne dvije sedmice.",
      },
      {
        title: "2. Fokus na intelekt / imaginaciju",
        description: "Namjerno odvoji kratko vrijeme za istraživanje alternative prije zaključka.",
        action: "Uvedi jedno dodatno pitanje prije donošenja konačne odluke na složenijim zadacima.",
      },
      {
        title: "3. Fokus na balans ritma saradnje",
        description: "Uskladi inicijativu s provjerom prostora koji drugima treba za uključivanje.",
        action: "U važnim sastancima ostavi svjesnu pauzu za provjeru tuđeg stava prije zaključka.",
      },
    ],
    dimension_insights: DIMENSION_ORDER.map((dimensionCode, index) => ({
      dimension_code: dimensionCode,
      dimension_label: [
        "Ekstraverzija",
        "Kooperativnost",
        "Savjesnost",
        "Emocionalna stabilnost",
        "Intelekt / imaginacija",
      ][index],
      score_band: ["high", "moderate", "high", "moderate", "low"][index],
      summary: `Sažetak za ${dimensionCode}.`,
      work_style: `Radni stil za ${dimensionCode}.`,
      risks: `Rizici za ${dimensionCode}.`,
      development_focus: `Razvojni fokus za ${dimensionCode}.`,
    })),
    disclaimer:
      "Ovaj izvještaj je razvojni, ne-klinički pregled zasnovan na determinističkim skorovima procjene. Ne daje dijagnozu niti preporuku za zapošljavanje.",
  };
}

async function main() {
  const schemaJson = await readJson(SCHEMA_PATH);
  const openAiSchemaJson = await readJson(OPENAI_SCHEMA_PATH);
  assert.equal(schemaJson.title, "Detailed Report v1");
  assert.equal(schemaJson.properties.dimension_insights.maxItems, 5);
  assert.equal(openAiSchemaJson.title, "Detailed Report v1 OpenAI");
  assert.equal(openAiSchemaJson.properties.dimension_insights.maxItems, 5);
  assert.equal(schemaContainsKey(openAiSchemaJson, "allOf"), false);
  assert.deepEqual(openAiSchemaJson.required, schemaJson.required);
  assert.deepEqual(
    Object.keys(openAiSchemaJson.properties).sort(),
    Object.keys(schemaJson.properties).sort(),
  );
  assert.deepEqual(
    openAiSchemaJson.properties.dimension_insights.items.properties.dimension_code.enum,
    DIMENSION_ORDER,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      openAiSchemaJson.properties.dimension_insights,
      "prefixItems",
    ),
    false,
  );
  assert.equal(typeof openAiSchemaJson.properties.dimension_insights.items, "object");

  const assessmentPackage = await loadAssessmentPackage(PACKAGE_DIR);
  assert.equal(assessmentPackage.prompts.length, 2);

  for (const prompt of assessmentPackage.prompts) {
    assert.deepEqual(
      prompt.output_schema_json,
      schemaJson,
      `Prompt ${prompt.audience} must embed the canonical output schema.`,
    );
    assert.ok(
      !String(prompt.system_prompt).includes("Placeholder"),
      `Prompt ${prompt.audience} must not use a placeholder system prompt.`,
    );
    assert.ok(
      !String(prompt.user_prompt_template).includes("Placeholder"),
      `Prompt ${prompt.audience} must not use a placeholder user prompt.`,
    );
  }

  const validSample = buildValidDetailedReportSample();
  const validResult = validateDetailedReport(validSample);
  assert.equal(validResult.ok, true, validResult.reason ?? "Valid report sample should pass.");

  const missingFieldSample = structuredClone(validSample);
  delete missingFieldSample.summary;
  const missingFieldResult = validateDetailedReport(missingFieldSample);
  assert.equal(missingFieldResult.ok, false);

  const wrongOrderSample = structuredClone(validSample);
  [
    wrongOrderSample.dimension_insights[0],
    wrongOrderSample.dimension_insights[1],
  ] = [
    wrongOrderSample.dimension_insights[1],
    wrongOrderSample.dimension_insights[0],
  ];
  const wrongOrderResult = validateDetailedReport(wrongOrderSample);
  assert.equal(wrongOrderResult.ok, false);

  const wrongCodeSample = structuredClone(validSample);
  wrongCodeSample.dimension_insights[4].dimension_code = "OPENNESS";
  const wrongCodeResult = validateDetailedReport(wrongCodeSample);
  assert.equal(wrongCodeResult.ok, false);

  const duplicateCodeSample = structuredClone(validSample);
  duplicateCodeSample.dimension_insights[4].dimension_code = "EXTRAVERSION";
  const duplicateCodeResult = validateDetailedReport(duplicateCodeSample);
  assert.equal(duplicateCodeResult.ok, false);

  const mockCompatibleSample = buildValidDetailedReportSample();
  mockCompatibleSample.report_title = "HR pregled radnog i saradničkog stila";
  mockCompatibleSample.report_subtitle =
    "Sažetak vjerovatnih obrazaca rada, saradnje i razvoja.";
  mockCompatibleSample.summary.headline =
    "Savjesnost se izdvaja kao najjači signal za radni stil i saradnju.";
  mockCompatibleSample.summary.overview =
    "Profil ukazuje na izraženiji oslonac na Savjesnost, dok oblast Intelekt / imaginacija traži nešto svjesniju podršku kroz način rada, komunikaciju i razvojni feedback.";
  mockCompatibleSample.disclaimer =
    "Ovaj izvještaj je profesionalni razvojni pregled vjerovatnih obrazaca rada i saradnje. Ne predstavlja dijagnozu, ne potvrđuje zaštićene osobine i ne daje hiring odluku ili konačnu istinu o osobi.";
  const mockCompatibleResult = validateDetailedReport(mockCompatibleSample);
  assert.equal(
    mockCompatibleResult.ok,
    true,
    mockCompatibleResult.reason ?? "Mock-compatible report sample should pass.",
  );
  assert.equal(mockCompatibleSample.report_subtitle.includes("ipip50-hr-v1"), false);
  assert.equal(mockCompatibleSample.summary.overview.includes("determinističke skorove"), false);
  assert.equal(mockCompatibleSample.report_title.includes("Detaljni izvještaj procjene"), false);

  console.log(
    JSON.stringify(
      {
        schemaPath: SCHEMA_PATH,
        packageDir: PACKAGE_DIR,
        checks: [
          "schema_parseable",
          "openai_schema_parseable",
          "openai_schema_has_no_allOf",
          "openai_schema_matches_top_level_shape",
          "openai_schema_dimension_insights_uses_object_items",
          "openai_schema_dimension_insights_has_no_prefix_items",
          "openai_schema_dimension_items_limit_dimension_codes",
          "package_validation_passes",
          "prompt_schema_embedded",
          "valid_sample_passes",
          "missing_field_fails",
          "wrong_dimension_order_fails",
          "wrong_dimension_code_fails",
          "duplicate_dimension_code_fails",
          "mock_compatible_sample_passes",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
