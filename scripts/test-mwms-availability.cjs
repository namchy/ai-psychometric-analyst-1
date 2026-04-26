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

const { getCandidateAssessmentAvailability } = require("../lib/assessment/availability.ts");

function listAvailableTestSlugs(tests) {
  return tests
    .filter((test) =>
      getCandidateAssessmentAvailability({
        slug: test.slug,
        name: test.name,
        status: test.status,
        isActive: test.isActive,
        hasOrganizationAccess: test.hasOrganizationAccess,
        activeQuestionCount: test.activeQuestionCount,
      }).canStart,
    )
    .map((test) => test.slug);
}

const mwmsAvailability = getCandidateAssessmentAvailability({
  slug: "mwms_v1",
  name: "Procjena radne motivacije",
  status: "active",
  isActive: true,
  hasOrganizationAccess: false,
  activeQuestionCount: 19,
});

assert.equal(mwmsAvailability.canStart, true);
assert.equal(mwmsAvailability.kind, "core");
assert.equal(mwmsAvailability.requiresOrganizationAccess, false);

const riasecAvailability = getCandidateAssessmentAvailability({
  slug: "riasec",
  name: "RIASEC",
  status: "active",
  isActive: true,
  hasOrganizationAccess: false,
  activeQuestionCount: 48,
});

assert.equal(riasecAvailability.canStart, false);
assert.equal(riasecAvailability.kind, "disabled");

const ipipAvailability = getCandidateAssessmentAvailability({
  slug: "ipip-neo-120-v1",
  name: "IPIP-NEO-120",
  status: "active",
  isActive: true,
  hasOrganizationAccess: false,
  activeQuestionCount: 120,
});

assert.equal(ipipAvailability.canStart, true);

const safranAvailability = getCandidateAssessmentAvailability({
  slug: "safran_v1",
  name: "SAFRAN",
  status: "active",
  isActive: true,
  hasOrganizationAccess: false,
  activeQuestionCount: 45,
});

assert.equal(safranAvailability.canStart, true);

const inactiveMwmsAvailability = getCandidateAssessmentAvailability({
  slug: "mwms_v1",
  name: "Procjena radne motivacije",
  status: "draft",
  isActive: false,
  hasOrganizationAccess: false,
  activeQuestionCount: 19,
});

assert.equal(inactiveMwmsAvailability.canStart, false);
assert.equal(inactiveMwmsAvailability.reason, "inactive_test");

const availableTestSlugs = listAvailableTestSlugs([
  {
    slug: "ipip-neo-120-v1",
    name: "IPIP-NEO-120",
    status: "active",
    isActive: true,
    hasOrganizationAccess: false,
    activeQuestionCount: 120,
  },
  {
    slug: "safran_v1",
    name: "SAFRAN",
    status: "active",
    isActive: true,
    hasOrganizationAccess: false,
    activeQuestionCount: 45,
  },
  {
    slug: "mwms_v1",
    name: "Procjena radne motivacije",
    status: "active",
    isActive: true,
    hasOrganizationAccess: false,
    activeQuestionCount: 19,
  },
  {
    slug: "riasec",
    name: "RIASEC",
    status: "active",
    isActive: true,
    hasOrganizationAccess: false,
    activeQuestionCount: 48,
  },
  {
    slug: "mwms_v1",
    name: "Procjena radne motivacije",
    status: "draft",
    isActive: false,
    hasOrganizationAccess: false,
    activeQuestionCount: 19,
  },
]);

assert.deepEqual(availableTestSlugs, ["ipip-neo-120-v1", "safran_v1", "mwms_v1"]);

console.log("MWMS availability tests passed.");
