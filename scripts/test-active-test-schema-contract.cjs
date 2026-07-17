const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const oldMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260312133500_harden_active_test_contract.sql",
);
const newMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260717121000_resolve_multi_active_test_contract.sql",
);
const initialSchemaPath = path.join(
  projectRoot,
  "supabase/migrations/20260309122751_init_assessment_schema.sql",
);
const rpcMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260717120000_create_golden_demo_gd001_fixture_rpc.sql",
);

assert.equal(fs.existsSync(newMigrationPath), true, "Forward multi-active migration is missing.");

const oldMigration = fs.readFileSync(oldMigrationPath, "utf8");
const newMigration = fs.readFileSync(newMigrationPath, "utf8");
const initialSchema = fs.readFileSync(initialSchemaPath, "utf8");
const rpcMigration = fs.readFileSync(rpcMigrationPath, "utf8");

assert.equal(
  crypto.createHash("sha256").update(oldMigration).digest("hex"),
  "467dffa20132f1684a974d763b13907dcf210ee60ce9ff91004f01529cba2bbb",
  "Historical active-test migration must remain unchanged.",
);
assert.match(
  initialSchema,
  /slug\s+text\s+not\s+null\s+unique/i,
  "tests.slug must remain the globally unique test/version identity.",
);
assert.match(
  oldMigration,
  /tests_status_is_active_check[\s\S]*is_active\s*=\s*true\s+and\s+status\s*=\s*'active'[\s\S]*is_active\s*=\s*false\s+and\s+status\s+in\s*\(\s*'draft'\s*,\s*'archived'\s*\)/i,
  "status/is_active consistency must remain in migration history.",
);
assert.match(
  newMigration,
  /drop\s+index\s+if\s+exists\s+public\.tests_one_active_test_idx\s*;/i,
  "Forward migration must remove the global active singleton index.",
);
assert.doesNotMatch(
  newMigration,
  /create\s+(?:unique\s+)?index/i,
  "No replacement active uniqueness index is justified without a repo-defined family key.",
);
assert.doesNotMatch(
  newMigration,
  /\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\.tests\b/i,
  "Schema-contract migration must not mutate test data.",
);
assert.doesNotMatch(
  newMigration,
  /drop\s+constraint[\s\S]*tests_status_is_active_check/i,
  "Forward migration must preserve status/is_active consistency.",
);

for (const slug of ["ipip-neo-120-v1", "safran_v1", "mwms_v1"]) {
  assert.match(rpcMigration, new RegExp(slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.match(
  rpcMigration,
  /test\.status\s*=\s*'active'[\s\S]*test\.is_active\s*=\s*true/i,
  "GD-001 RPC must continue requiring production-active tests.",
);

function listSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(entryPath);
    return /\.(?:ts|tsx|js|jsx|cjs|mjs)$/.test(entry.name) ? [entryPath] : [];
  });
}

const unscopedActiveSingletons = [];
for (const sourceFile of [
  ...listSourceFiles(path.join(projectRoot, "app")),
  ...listSourceFiles(path.join(projectRoot, "lib")),
  ...listSourceFiles(path.join(projectRoot, "scripts")),
]) {
  const source = fs.readFileSync(sourceFile, "utf8");
  const testQueryPattern = /\.from\(\s*(["'])tests\1\s*\)([\s\S]*?);/g;
  for (const match of source.matchAll(testQueryPattern)) {
    const query = match[0];
    const filtersActiveTest =
      /\.eq\(\s*(["'])is_active\1\s*,\s*true\s*\)/.test(query) ||
      /\.eq\(\s*(["'])status\1\s*,\s*(["'])active\2\s*\)/.test(query);
    const selectsOne = /\.(?:single|maybeSingle)\(\s*\)/.test(query) || /\.limit\(\s*1\s*\)/.test(query);
    const hasStableIdentityScope =
      /\.eq\(\s*(["'])(?:id|slug)\1\s*,/.test(query) ||
      /\.in\(\s*(["'])(?:id|slug)\1\s*,/.test(query);
    if (filtersActiveTest && selectsOne && !hasStableIdentityScope) {
      unscopedActiveSingletons.push(path.relative(projectRoot, sourceFile));
    }
  }
}
assert.deepEqual(
  [...new Set(unscopedActiveSingletons)],
  [],
  "Production code must not select one globally active test without a stable identity scope.",
);

const testHelperSource = fs.readFileSync(path.join(projectRoot, "lib/assessment/tests.ts"), "utf8");
assert.match(testHelperSource, /getActiveTest\(testSlug:\s*string\)/);
assert.match(testHelperSource, /\.eq\("slug", testSlug\)/);
assert.doesNotMatch(
  testHelperSource.slice(
    testHelperSource.indexOf("export async function getActiveTest"),
    testHelperSource.indexOf("export async function getQuestionsForTest"),
  ),
  /\.limit\(1\)/,
);

process.stdout.write(
  "Active-test schema contract tests passed (forward migration, retained lifecycle invariant, RPC compatibility, and scoped production reads).\n",
);
