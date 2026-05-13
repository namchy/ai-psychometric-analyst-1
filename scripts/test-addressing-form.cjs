const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
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

const {
  isAddressingForm,
  normalizeAddressingForm,
  resolveAddressingForm,
} = require("../lib/auth/addressing-form.ts");

const participantActionsPath = path.join(projectRoot, "app/actions/participants.ts");
const migrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260513100000_add_addressing_form_preference.sql",
);
const participantActionsContents = fs.readFileSync(participantActionsPath, "utf8");
const migrationContents = fs.readFileSync(migrationPath, "utf8");

assert.equal(isAddressingForm("masculine"), true);
assert.equal(isAddressingForm("feminine"), true);
assert.equal(isAddressingForm("male"), false);
assert.equal(isAddressingForm("female"), false);
assert.equal(isAddressingForm("gender"), false);

assert.equal(normalizeAddressingForm("masculine"), "masculine");
assert.equal(normalizeAddressingForm("feminine"), "feminine");
assert.equal(normalizeAddressingForm(undefined), null);

assert.equal(resolveAddressingForm(undefined), "masculine");
assert.equal(resolveAddressingForm("invalid"), "masculine");

assert.match(participantActionsContents, /normalizeAddressingForm\(rawAddressingForm\)/);
assert.match(participantActionsContents, /Odaberi jedan od ponuđenih oblika obraćanja\./);
assert.doesNotMatch(participantActionsContents, /["'`](male|female|gender)["'`]/i);

assert.match(migrationContents, /alter table public\.participants/i);
assert.match(migrationContents, /add column if not exists addressing_form text/i);
assert.match(migrationContents, /participants_addressing_form_check/i);
assert.match(migrationContents, /alter table public\.attempts/i);
assert.match(migrationContents, /add column if not exists addressing_form_snapshot text/i);
assert.match(migrationContents, /attempts_addressing_form_snapshot_check/i);
assert.match(migrationContents, /'masculine', 'feminine'/i);

console.log("Addressing form tests passed.");
