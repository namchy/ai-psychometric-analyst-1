const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const projectRoot = path.resolve(__dirname, "..");
const {
  GOLDEN_DEMO_FOUNDATION_COUNTS,
  GOLDEN_DEMO_ORGANIZATION_NAME,
  GOLDEN_DEMO_TEAM_NAMES,
  buildGoldenDemoFoundationContract,
  classifyGoldenDemoFoundation,
} = require("../lib/golden-demo/golden-demo-foundation-contract.ts");
const {
  createGoldenDemoFoundationSupabaseReadRepository,
} = require("../lib/golden-demo/golden-demo-foundation-inspector.ts");
const { parseCli } = require("./inspect-golden-demo-foundation-db.cjs");

const contract = buildGoldenDemoFoundationContract(projectRoot);
assert.deepEqual(contract.fixtureValidationErrors, []);
assert.equal(contract.participants.length, 24);
assert.equal(contract.teams.length, 4);
assert.equal(contract.memberships.length, 24);
assert.equal(GOLDEN_DEMO_TEAM_NAMES["GDT-04"], "Naplata i operativna podrška poslovnicama");
assert.deepEqual(
  contract.teams.map((team) => team.memberCandidateIds.length),
  [6, 6, 6, 6],
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyState() {
  return {
    organizations: [{ id: "org:partner-plus", name: GOLDEN_DEMO_ORGANIZATION_NAME, slug: "partner-plus", status: "active" }],
    participants: [],
    teams: [],
    memberships: [],
  };
}

function completeState() {
  const state = emptyState();
  state.participants = contract.participants.map((participant) => ({
    id: `participant:${participant.candidateId}`,
    organizationId: "org:partner-plus",
    email: participant.email,
    fullName: participant.fullName,
    participantType: participant.participantType,
    status: participant.status,
  }));
  state.teams = contract.teams.map((team) => ({
    id: `team:${team.teamCode}`,
    organizationId: "org:partner-plus",
    name: team.name,
    archivedAt: null,
  }));
  state.memberships = contract.memberships.map((membership, index) => ({
    id: `membership:${membership.candidateId}:${index}`,
    teamId: `team:${membership.teamCode}`,
    participantId: `participant:${membership.candidateId}`,
    role: membership.role,
    isActive: membership.isActive,
    leftAt: membership.leftAt,
  }));
  return state;
}

function expectState(label, state, expected) {
  const result = classifyGoldenDemoFoundation(contract, state);
  assert.equal(result.state, expected, `${label}: ${JSON.stringify(result.blockingFindings, null, 2)}`);
  return result;
}

function expectFinding(label, state, code) {
  const result = expectState(label, state, "CONFLICT");
  assert.ok(result.blockingFindings.some((finding) => finding.code === code), `${label} should include ${code}`);
  return result;
}

function addParticipant(state, participant) {
  state.participants.push({
    id: participant.id ?? `participant:extra:${state.participants.length}`,
    organizationId: participant.organizationId ?? "org:partner-plus",
    email: participant.email,
    fullName: participant.fullName ?? "Extra Person",
    participantType: participant.participantType ?? "employee",
    status: participant.status ?? "active",
  });
}

function addUnrelatedTeamAndMembership(state, candidateId = "GD-001") {
  state.teams.push({ id: "team:unrelated", organizationId: "org:partner-plus", name: "Unrelated Team", archivedAt: null });
  state.memberships.push({
    id: `membership:unrelated:${candidateId}`,
    teamId: "team:unrelated",
    participantId: `participant:${candidateId}`,
    role: "member",
    isActive: true,
    leftAt: null,
  });
}

// Organization scenarios.
const missingOrganization = emptyState();
missingOrganization.organizations = [];
expectState("organization missing", missingOrganization, "PARTIAL");
expectState("exact organization only", emptyState(), "EMPTY");
const duplicateOrganization = emptyState();
duplicateOrganization.organizations.push({ ...duplicateOrganization.organizations[0], id: "org:partner-plus:duplicate" });
expectFinding("duplicate organization", duplicateOrganization, "organization_duplicate");
const inactiveOrganization = emptyState();
inactiveOrganization.organizations[0].status = "inactive";
expectFinding("inactive organization", inactiveOrganization, "organization_status_mismatch");

// Participant scenarios.
const allParticipantsMissing = emptyState();
expectState("all participants missing", allParticipantsMissing, "EMPTY");
const onlyGd001 = emptyState();
onlyGd001.participants.push(completeState().participants[0]);
const onlyGd001Result = expectState("only GD-001 participant", onlyGd001, "PARTIAL");
assert.equal(onlyGd001Result.counts.participantsObserved, 1);
const someParticipants = emptyState();
someParticipants.participants = completeState().participants.slice(0, 4);
expectState("partial participant set", someParticipants, "PARTIAL");
const exactParticipants = completeState();
exactParticipants.teams = [];
exactParticipants.memberships = [];
expectState("all participants exact without teams", exactParticipants, "PARTIAL");
const duplicateEmail = completeState();
duplicateEmail.participants.push({ ...duplicateEmail.participants[0], id: "participant:duplicate-email" });
expectFinding("duplicate canonical email", duplicateEmail, "participant_duplicate_email");
const canonicalLookingParticipantOnlyInOtherOrganization = emptyState();
canonicalLookingParticipantOnlyInOtherOrganization.organizations.push({ id: "org:other", name: "Other Organization", slug: "other", status: "active" });
canonicalLookingParticipantOnlyInOtherOrganization.participants.push({ ...completeState().participants[0], organizationId: "org:other" });
expectState("canonical-looking participant only in other organization", canonicalLookingParticipantOnlyInOtherOrganization, "EMPTY");
const sameEmailCanonicalAndOtherOrganization = completeState();
sameEmailCanonicalAndOtherOrganization.organizations.push({ id: "org:other", name: "Other Organization", slug: "other", status: "active" });
sameEmailCanonicalAndOtherOrganization.participants.push({ ...sameEmailCanonicalAndOtherOrganization.participants[0], id: "participant:other-org-same-email", organizationId: "org:other" });
const sameEmailResult = expectState("same email in canonical and other organization", sameEmailCanonicalAndOtherOrganization, "EXACT_MATCH");
assert.equal(sameEmailResult.blockingFindings.some((finding) => finding.code === "participant_duplicate_email"), false);
const wrongName = completeState();
wrongName.participants[0].fullName = "Wrong Name";
expectFinding("wrong participant full name", wrongName, "participant_name_mismatch");
const wrongParticipantType = completeState();
wrongParticipantType.participants[0].participantType = "candidate";
expectFinding("wrong participant type", wrongParticipantType, "participant_type_mismatch");
const inactiveParticipant = completeState();
inactiveParticipant.participants[0].status = "inactive";
expectFinding("inactive participant", inactiveParticipant, "participant_status_mismatch");
const extraParticipant = completeState();
addParticipant(extraParticipant, { email: "extra.person@partnerplus.ba" });
expectState("extra noncanonical participant", extraParticipant, "EXACT_MATCH");
const similarNameDifferentEmail = completeState();
addParticipant(similarNameDifferentEmail, { email: "amel.kovac@partnerplus.ba", fullName: "Amel Kovačević" });
expectState("similar name with different email", similarNameDifferentEmail, "EXACT_MATCH");

// Team scenarios.
expectState("all teams missing", emptyState(), "EMPTY");
const oneTeam = emptyState();
oneTeam.teams.push(completeState().teams[0]);
expectState("one team exists", oneTeam, "PARTIAL");
expectState("all teams exact with no memberships", (() => {
  const state = emptyState();
  state.teams = completeState().teams;
  return state;
})(), "PARTIAL");
const duplicateTeam = completeState();
duplicateTeam.teams.push({ ...duplicateTeam.teams[0], id: "team:duplicate" });
expectFinding("duplicate canonical team", duplicateTeam, "team_duplicate_name");
const canonicalLookingTeamOnlyInOtherOrganization = emptyState();
canonicalLookingTeamOnlyInOtherOrganization.organizations.push({ id: "org:other", name: "Other Organization", slug: "other", status: "active" });
canonicalLookingTeamOnlyInOtherOrganization.teams.push({ ...completeState().teams[0], organizationId: "org:other" });
expectState("canonical-looking team only in other organization", canonicalLookingTeamOnlyInOtherOrganization, "EMPTY");
const sameTeamNameCanonicalAndOtherOrganization = completeState();
sameTeamNameCanonicalAndOtherOrganization.organizations.push({ id: "org:other", name: "Other Organization", slug: "other", status: "active" });
sameTeamNameCanonicalAndOtherOrganization.teams.push({ ...sameTeamNameCanonicalAndOtherOrganization.teams[0], id: "team:other-org-same-name", organizationId: "org:other" });
const sameTeamNameResult = expectState("same team name in canonical and other organization", sameTeamNameCanonicalAndOtherOrganization, "EXACT_MATCH");
assert.equal(sameTeamNameResult.blockingFindings.some((finding) => finding.code === "team_duplicate_name"), false);
const archivedTeam = completeState();
archivedTeam.teams[0].archivedAt = "2026-07-17T00:00:00.000Z";
expectFinding("archived canonical team", archivedTeam, "team_archived");
const unrelatedTeam = completeState();
unrelatedTeam.teams.push({ id: "team:unrelated", organizationId: "org:partner-plus", name: "Unrelated Team", archivedAt: null });
expectState("unrelated team", unrelatedTeam, "EXACT_MATCH");

// Membership scenarios.
const noMemberships = completeState();
noMemberships.memberships = [];
const noMembershipsResult = expectState("all memberships missing", noMemberships, "PARTIAL");
assert.equal(noMembershipsResult.counts.membershipsObserved, 0);
const gd001MembershipMissing = completeState();
gd001MembershipMissing.memberships = gd001MembershipMissing.memberships.filter((membership) => membership.participantId !== "participant:GD-001");
const gd001MembershipResult = expectState("GD-001 membership missing", gd001MembershipMissing, "PARTIAL");
assert.ok(gd001MembershipResult.blockingFindings.some((finding) => finding.code === "membership_missing" && finding.candidateId === "GD-001"));
expectState("all memberships exact", completeState(), "EXACT_MATCH");
const wrongTeamMembership = completeState();
wrongTeamMembership.memberships[0].teamId = "team:GDT-02";
expectFinding("membership on wrong Golden Demo team", wrongTeamMembership, "participant_wrong_team");
const duplicateMembership = completeState();
duplicateMembership.memberships.push({ ...duplicateMembership.memberships[0], id: "membership:duplicate" });
expectFinding("duplicate active membership", duplicateMembership, "membership_duplicate_active");
const inactiveMembership = completeState();
inactiveMembership.memberships[0].isActive = false;
expectFinding("inactive membership", inactiveMembership, "membership_lifecycle_mismatch");
const leftMembership = completeState();
leftMembership.memberships[0].isActive = false;
leftMembership.memberships[0].leftAt = "2026-07-17T00:00:00.000Z";
expectFinding("membership with left_at", leftMembership, "membership_lifecycle_mismatch");
const unrelatedMembership = completeState();
addUnrelatedTeamAndMembership(unrelatedMembership);
expectState("target participant in unrelated team", unrelatedMembership, "EXACT_MATCH");
const extraUnrelatedMembership = completeState();
addParticipant(extraUnrelatedMembership, { id: "participant:unrelated", email: "unrelated.person@partnerplus.ba" });
extraUnrelatedMembership.memberships.push({ id: "membership:unrelated-person", teamId: "team:unrelated", participantId: "participant:unrelated", role: "member", isActive: true, leftAt: null });
extraUnrelatedMembership.teams.push({ id: "team:unrelated", organizationId: "org:partner-plus", name: "Unrelated Team", archivedAt: null });
expectState("noncanonical participant in unrelated team", extraUnrelatedMembership, "EXACT_MATCH");
const extraCanonicalMembership = completeState();
addParticipant(extraCanonicalMembership, { id: "participant:extra-canonical", email: "extra.canonical@partnerplus.ba" });
extraCanonicalMembership.memberships.push({ id: "membership:extra-canonical", teamId: "team:GDT-01", participantId: "participant:extra-canonical", role: "member", isActive: true, leftAt: null });
expectFinding("extra participant in canonical team", extraCanonicalMembership, "extra_participant_in_canonical_team");

// State, counts and precedence scenarios.
const emptyResult = expectState("completely empty foundation", emptyState(), "EMPTY");
assert.deepEqual(emptyResult.counts, {
  participantsExpected: 24,
  participantsObserved: 0,
  teamsExpected: 4,
  teamsObserved: 0,
  membershipsExpected: 24,
  membershipsObserved: 0,
});
assert.deepEqual({ createEligible: emptyResult.createEligible, noOpEligible: emptyResult.noOpEligible, manualReviewRequired: emptyResult.manualReviewRequired }, { createEligible: true, noOpEligible: false, manualReviewRequired: false });
assert.deepEqual({ createEligible: onlyGd001Result.createEligible, noOpEligible: onlyGd001Result.noOpEligible, manualReviewRequired: onlyGd001Result.manualReviewRequired }, { createEligible: false, noOpEligible: false, manualReviewRequired: true });
const exactResult = expectState("full exact foundation", completeState(), "EXACT_MATCH");
assert.deepEqual({ createEligible: exactResult.createEligible, noOpEligible: exactResult.noOpEligible, manualReviewRequired: exactResult.manualReviewRequired }, { createEligible: false, noOpEligible: true, manualReviewRequired: false });
const exactWithUnrelatedOrganization = completeState();
exactWithUnrelatedOrganization.organizations.push({ id: "org:unrelated", name: "Unrelated Organization", slug: "unrelated", status: "active" });
exactWithUnrelatedOrganization.participants.push({ id: "participant:unrelated-org", organizationId: "org:unrelated", email: "person@unrelated.invalid", fullName: "Unrelated Person", participantType: "employee", status: "active" });
expectState("exact with unrelated organization data", exactWithUnrelatedOrganization, "EXACT_MATCH");
const exactWithCrossOrganizationAmbientCanonicalRows = completeState();
exactWithCrossOrganizationAmbientCanonicalRows.organizations.push({ id: "org:other", name: "Other Organization", slug: "other", status: "active" });
exactWithCrossOrganizationAmbientCanonicalRows.participants.push({ ...exactWithCrossOrganizationAmbientCanonicalRows.participants[0], id: "participant:other-org-canonical-email", organizationId: "org:other" });
exactWithCrossOrganizationAmbientCanonicalRows.teams.push({ ...exactWithCrossOrganizationAmbientCanonicalRows.teams[0], id: "team:other-org-canonical-name", organizationId: "org:other" });
expectState("exact with cross-organization canonical-looking ambient rows", exactWithCrossOrganizationAmbientCanonicalRows, "EXACT_MATCH");
const precedence = completeState();
precedence.participants[0].status = "inactive";
precedence.memberships[0].isActive = false;
assert.equal(classifyGoldenDemoFoundation(contract, precedence).state, "CONFLICT");

function createMockClient(state) {
  const calls = [];
  const filters = [];
  const rows = {
    organizations: state.organizations,
    participants: state.participants.map((participant) => ({
      id: participant.id,
      organization_id: participant.organizationId,
      email: participant.email,
      full_name: participant.fullName,
      participant_type: participant.participantType,
      status: participant.status,
    })),
    teams: state.teams.map((team) => ({
      id: team.id,
      organization_id: team.organizationId,
      name: team.name,
      archived_at: team.archivedAt,
    })),
    team_memberships: state.memberships.map((membership) => ({
      id: membership.id,
      team_id: membership.teamId,
      participant_id: membership.participantId,
      role: membership.role,
      is_active: membership.isActive,
      left_at: membership.leftAt,
    })),
  };
  return {
    calls,
    filters,
    client: {
      from(table) {
        let currentRows = rows[table] ?? [];
        const query = {
          select() {
            calls.push({ table, operation: "select" });
            return query;
          },
          eq(column, value) {
            filters.push({ table, operation: "eq", column, value });
            currentRows = currentRows.filter((row) => row[column] === value);
            return query;
          },
          in(column, values) {
            filters.push({ table, operation: "in", column, values: [...values] });
            currentRows = currentRows.filter((row) => values.includes(row[column]));
            return query;
          },
          is(column, value) {
            filters.push({ table, operation: "is", column, value });
            currentRows = currentRows.filter((row) => row[column] === value);
            return query;
          },
          then(resolve, reject) {
            return Promise.resolve({ data: currentRows, error: null }).then(resolve, reject);
          },
        };
        return query;
      },
    },
  };
}

(async () => {
  const mock = createMockClient(completeState());
  const observed = await createGoldenDemoFoundationSupabaseReadRepository(mock.client).readState();
  const result = classifyGoldenDemoFoundation(contract, observed);
  assert.equal(result.state, "EXACT_MATCH");
  assert.deepEqual(mock.calls.map((call) => call.table), [
    "organizations",
    "participants",
    "teams",
    "team_memberships",
    "team_memberships",
  ]);
  assert.ok(mock.calls.every((call) => call.operation === "select"));
  assert.equal(mock.calls.some((call) => /assessment|attempt|response|score|report/i.test(call.table)), false);
  assert.equal(mock.filters.find((filter) => filter.table === "organizations").value, GOLDEN_DEMO_ORGANIZATION_NAME);
  assert.ok(mock.filters.some((filter) => filter.table === "participants" && filter.column === "organization_id"));
  assert.ok(mock.filters.some((filter) => filter.table === "teams" && filter.column === "organization_id"));
  assert.ok(mock.filters.some((filter) => filter.table === "team_memberships" && filter.column === "team_id"));
  assert.ok(mock.filters.some((filter) => filter.table === "team_memberships" && filter.column === "participant_id"));

  assert.deepEqual(parseCli([]), { json: false, verbose: false });
  assert.deepEqual(parseCli(["--json", "--verbose"]), { json: true, verbose: true });
  for (const flag of ["--apply", "--write", "--repair", "--delete", "--unknown"]) {
    assert.throws(() => parseCli([flag]), /SELECT-only/);
  }

  const sourceFiles = [
    "lib/golden-demo/golden-demo-foundation-inspector.ts",
    "scripts/inspect-golden-demo-foundation-db.cjs",
  ];
  for (const relativePath of sourceFiles) {
    const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
    for (const forbidden of [".insert(", ".update(", ".delete(", ".upsert(", ".rpc("]) {
      assert.equal(source.includes(forbidden), false, `${relativePath} must not contain ${forbidden}`);
    }
  }

  console.log(JSON.stringify({
    stateCases: "PASS",
    counts: {
      participantsExpected: GOLDEN_DEMO_FOUNDATION_COUNTS.participants,
      teamsExpected: GOLDEN_DEMO_FOUNDATION_COUNTS.teams,
      membershipsExpected: GOLDEN_DEMO_FOUNDATION_COUNTS.memberships,
    },
    adapter: "SELECT_ONLY_PASS",
    cli: "PASS",
    precedence: "CONFLICT > PARTIAL > EXACT_MATCH > EMPTY",
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
