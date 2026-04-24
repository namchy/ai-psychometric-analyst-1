const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { createClient } = require("@supabase/supabase-js");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(projectRoot, "public");
const seedPath = path.join(projectRoot, "safran_v1_seed.json");
const affectedCodes = ["FA02", "FA03", "FA04", "FA05", "FA06", "FA07", "FA08", "FA09"];
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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const { SAFRAN_PRACTICE_EXAMPLES } = require("../lib/assessment/safran-practice.ts");

function readSeed() {
  return JSON.parse(fs.readFileSync(seedPath, "utf8"));
}

function resolvePublicPath(assetPath) {
  return path.join(publicRoot, assetPath.replace(/^\//, ""));
}

function ensureAssetExists(assetPath, label) {
  assert.equal(
    fs.existsSync(resolvePublicPath(assetPath)),
    true,
    `${label} asset is missing: ${assetPath}`,
  );
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(task, retries = 5) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        throw error;
      }

      await wait(250 * attempt);
    }
  }

  throw lastError;
}

async function main() {
  const seed = readSeed();
  const scoredItems = seed.items.filter(
    (item) => item.is_scored === true && item.subtest_code === "FA" && affectedCodes.includes(item.item_id),
  );

  const seedSecondaryRows = scoredItems.filter((item) => item.stimulus_secondary_image_path !== null);

  assert.deepEqual(
    seedSecondaryRows.map((item) => item.item_id),
    [],
    "Scored SAFRAN FA items still reference stimulus_secondary_image_path in seed.",
  );

  for (const item of scoredItems) {
    assert.equal(typeof item.stimulus_image_path, "string", `Missing primary stimulus for ${item.item_id}.`);
    ensureAssetExists(item.stimulus_image_path, `Primary stimulus for ${item.item_id}`);

    for (const option of item.options) {
      assert.equal(typeof option.image_path, "string", `Missing answer option image for ${item.item_id}/${option.option_id}.`);
      ensureAssetExists(option.image_path, `Answer option for ${item.item_id}/${option.option_id}`);
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data } = await withRetry(async () => {
    const result = await supabase
      .from("questions")
      .select("code, stimulus_image_path, stimulus_secondary_image_path, tests!inner(slug)")
      .eq("tests.slug", "safran_v1")
      .in("code", affectedCodes)
      .order("code");

    if (result.error) {
      throw result.error;
    }

    return result;
  });

  const dbRows = data ?? [];
  const dbSecondaryRows = dbRows.filter((row) => row.stimulus_secondary_image_path !== null);

  assert.deepEqual(
    dbSecondaryRows.map((row) => row.code),
    [],
    "Scored SAFRAN FA items still reference stimulus_secondary_image_path in DB.",
  );

  for (const row of dbRows) {
    assert.equal(typeof row.stimulus_image_path, "string", `DB row ${row.code} is missing primary stimulus.`);
    ensureAssetExists(row.stimulus_image_path, `DB primary stimulus for ${row.code}`);
  }

  const practiceSecondaryRows = SAFRAN_PRACTICE_EXAMPLES.filter(
    (example) => example.stimulusSecondaryImagePath !== null,
  );

  assert.deepEqual(
    practiceSecondaryRows.map((example) => example.index),
    [],
    "SAFRAN practice examples still reference stimulusSecondaryImagePath.",
  );

  for (const example of SAFRAN_PRACTICE_EXAMPLES) {
    ensureAssetExists(
      example.stimulusImagePath,
      `Practice primary stimulus for PRACTICE_${String(example.index).padStart(2, "0")}`,
    );

    for (const optionImagePath of example.optionImagePaths) {
      ensureAssetExists(
        optionImagePath,
        `Practice answer option for PRACTICE_${String(example.index).padStart(2, "0")}`,
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        checkedCodes: affectedCodes,
        seedSecondaryReferences: seedSecondaryRows.length,
        dbSecondaryReferences: dbSecondaryRows.length,
        primaryStimuliChecked: dbRows.length,
        answerOptionImagesChecked: scoredItems.reduce((count, item) => count + item.options.length, 0),
        practiceSecondaryReferences: practiceSecondaryRows.length,
        practicePrimaryStimuliChecked: SAFRAN_PRACTICE_EXAMPLES.length,
        practiceAnswerOptionImagesChecked: SAFRAN_PRACTICE_EXAMPLES.reduce(
          (count, example) => count + example.optionImagePaths.length,
          0,
        ),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
