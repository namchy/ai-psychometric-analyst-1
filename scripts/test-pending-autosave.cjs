const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
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

function createLocalStorageMock() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

global.window = {
  localStorage: createLocalStorageMock(),
};
global.localStorage = global.window.localStorage;

const {
  buildPendingAutosaveKey,
  clearPendingSelections,
  readPendingSelections,
  removeFlushedSelections,
  upsertPendingSelection,
} = require("../lib/assessment/pending-autosave.ts");

const attemptId = "attempt-123";
const storageKey = buildPendingAutosaveKey(attemptId);

assert.equal(storageKey, "assessment-pending:attempt-123");
assert.deepEqual(readPendingSelections(attemptId), {});

global.window.localStorage.setItem(storageKey, "{not-json");
assert.deepEqual(readPendingSelections(attemptId), {});

upsertPendingSelection(attemptId, "q1", "opt-1");
assert.deepEqual(readPendingSelections(attemptId), { q1: "opt-1" });

upsertPendingSelection(attemptId, "q2", "opt-2");
assert.deepEqual(readPendingSelections(attemptId), {
  q1: "opt-1",
  q2: "opt-2",
});

upsertPendingSelection(attemptId, "q1", "opt-3");
removeFlushedSelections(attemptId, { q1: "opt-1" });
assert.deepEqual(readPendingSelections(attemptId), {
  q1: "opt-3",
  q2: "opt-2",
});

removeFlushedSelections(attemptId, { q1: "opt-3" });
assert.deepEqual(readPendingSelections(attemptId), { q2: "opt-2" });

removeFlushedSelections(attemptId, { q2: "opt-2" });
assert.deepEqual(readPendingSelections(attemptId), {});
assert.equal(global.window.localStorage.getItem(storageKey), null);

upsertPendingSelection(attemptId, "q3", ["opt-a", "opt-b"]);
assert.deepEqual(readPendingSelections(attemptId), { q3: ["opt-a", "opt-b"] });

clearPendingSelections(attemptId);
assert.deepEqual(readPendingSelections(attemptId), {});

console.log("test-pending-autosave: ok");
