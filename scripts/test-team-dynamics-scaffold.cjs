const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260519120000_add_team_dynamics_scaffold.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");

for (const tableName of [
  "public.teams",
  "public.team_memberships",
  "public.team_assessment_assignments",
  "public.team_assessment_participants",
]) {
  assert.match(sql, new RegExp(`create table if not exists ${tableName.replace('.', '\\.')}`, "i"));
}

assert.match(sql, /organization_id uuid not null references public\.organizations\(id\) on delete cascade/i);
assert.match(sql, /participant_id uuid not null references public\.participants\(id\) on delete cascade/i);
assert.match(sql, /attempt_id uuid null references public\.attempts\(id\) on delete set null/i);
assert.match(sql, /check \(role in \('member', 'lead', 'observer'\)\)/i);
assert.match(sql, /check \(status in \('draft', 'active', 'closed', 'ready_for_report', 'reported', 'cancelled'\)\)/i);
assert.match(sql, /check \(status in \('invited', 'started', 'completed', 'expired'\)\)/i);
assert.match(sql, /foreign key \(team_membership_id, participant_id\)\s+references public\.team_memberships\(id, participant_id\)/i);
assert.match(sql, /unique index if not exists team_memberships_one_active_participant_per_team_idx/i);
assert.match(sql, /where is_active = true and left_at is null/i);
assert.match(sql, /unique index if not exists team_assessment_participants_assignment_membership_idx/i);
assert.match(sql, /unique index if not exists team_assessment_participants_assignment_participant_idx/i);

for (const triggerName of [
  "set_teams_updated_at",
  "set_team_memberships_updated_at",
  "set_team_assessment_assignments_updated_at",
  "set_team_assessment_participants_updated_at",
]) {
  assert.match(sql, new RegExp(`create trigger ${triggerName}`, "i"));
}

for (const policyName of [
  "teams_read_member",
  "team_memberships_read_member",
  "team_assessment_assignments_read_member",
  "team_assessment_participants_read_member",
]) {
  assert.match(sql, new RegExp(`create policy \"${policyName}\"`, "i"));
}

console.log("Team Dynamics scaffold migration contract tests passed.");
