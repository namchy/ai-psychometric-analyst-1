const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const appContextPath = path.join(projectRoot, "lib", "auth", "app-context.ts");
const dashboardLayoutPath = path.join(projectRoot, "app", "(protected)", "dashboard", "layout.tsx");
const dashboardPagePath = path.join(projectRoot, "app", "(protected)", "dashboard", "page.tsx");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

assert.equal(fs.existsSync(appContextPath), true, "Expected auth app-context helper to exist.");
assert.equal(fs.existsSync(dashboardLayoutPath), true, "Expected /dashboard namespace layout to exist.");
assert.equal(fs.existsSync(dashboardPagePath), true, "Expected /dashboard route to exist.");
assert.equal(fs.existsSync(emptyModulePath), true, "Expected shared empty test module to exist.");

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only" || request === "@/lib/b2b/organizations") {
    return originalResolveFilename.call(this, emptyModulePath, parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;

  module._compile(output, filename);
};

const { resolveDashboardWorkspaceAccess } = require(appContextPath);

function resolveDashboardRequest(input) {
  const access = resolveDashboardWorkspaceAccess({
    hasOrganizationMembership: input.hasOrganizationMembership,
    linkedParticipantId: input.linkedParticipantId,
  });

  if (access.kind === "hr") {
    return {
      action: "allow",
      pathname: input.pathname,
    };
  }

  if (access.kind === "candidate") {
    return {
      action: "redirect",
      redirectPath: access.redirectPath,
    };
  }

  return {
    action: "redirect",
    redirectPath: "/app",
  };
}

assert.deepEqual(
  resolveDashboardWorkspaceAccess({
    hasOrganizationMembership: true,
    linkedParticipantId: null,
  }),
  { kind: "hr", action: "allow" },
  "Expected organization members to keep HR dashboard access.",
);

assert.deepEqual(
  resolveDashboardWorkspaceAccess({
    hasOrganizationMembership: true,
    linkedParticipantId: "participant-1",
  }),
  { kind: "hr", action: "allow" },
  "Expected HR access to win when a user also has a linked participant.",
);

assert.deepEqual(
  resolveDashboardWorkspaceAccess({
    hasOrganizationMembership: false,
    linkedParticipantId: "participant-1",
  }),
  { kind: "candidate", redirectPath: "/app" },
  "Expected participant-only users to be routed to the candidate app.",
);

assert.deepEqual(
  resolveDashboardWorkspaceAccess({
    hasOrganizationMembership: false,
    linkedParticipantId: null,
  }),
  { kind: "none" },
  "Expected users without HR or participant access not to receive the HR dashboard shell.",
);

for (const pathname of [
  "/dashboard",
  "/dashboard/attempts/attempt-1",
]) {
  assert.deepEqual(
    resolveDashboardRequest({
      pathname,
      hasOrganizationMembership: false,
      linkedParticipantId: "participant-1",
    }),
    { action: "redirect", redirectPath: "/app" },
    `Expected participant-only ${pathname} requests to leave the HR dashboard namespace.`,
  );
}

for (const pathname of [
  "/dashboard",
  "/dashboard/attempts/attempt-1",
]) {
  assert.deepEqual(
    resolveDashboardRequest({
      pathname,
      hasOrganizationMembership: true,
      linkedParticipantId: null,
    }),
    { action: "allow", pathname },
    `Expected HR ${pathname} requests to render the requested dashboard route without normalization.`,
  );
}

assert.deepEqual(
  resolveDashboardRequest({
    pathname: "/dashboard/attempts/attempt-1",
    hasOrganizationMembership: true,
    linkedParticipantId: "participant-1",
  }),
  { action: "allow", pathname: "/dashboard/attempts/attempt-1" },
  "Expected mixed HR+participant users to keep direct HR dashboard deep-link access.",
);

const dashboardLayoutSource = fs.readFileSync(dashboardLayoutPath, "utf8");
const dashboardPageSource = fs.readFileSync(dashboardPagePath, "utf8");

assert.match(dashboardLayoutSource, /resolveDashboardWorkspaceAccess\(context\)/);
assert.match(dashboardLayoutSource, /getAppContextForUserId\(user\.id\)/);
assert.match(dashboardLayoutSource, /redirect\(dashboardAccess\.redirectPath\)/);
assert.match(dashboardLayoutSource, /redirect\("\/app"\)/);
assert.doesNotMatch(
  dashboardLayoutSource,
  /redirect\(["']\/dashboard["']\)/,
  "Expected dashboard layout not to normalize allowed HR deep links back to the dashboard home.",
);
assert.doesNotMatch(
  dashboardLayoutSource,
  /redirect\(["']\/login["']\)/,
  "Expected unauthenticated behavior to remain delegated to requireAuthenticatedUser.",
);
assert.doesNotMatch(
  dashboardLayoutSource,
  /notFound\(\)/,
  "Expected users without dashboard access to leave the HR dashboard namespace instead of rendering HR chrome.",
);
assert.doesNotMatch(
  dashboardPageSource,
  /resolveDashboardWorkspaceAccess/,
  "Expected the dashboard namespace layout, not the page body, to own workspace access.",
);

console.log("Dashboard workspace access tests passed.");
