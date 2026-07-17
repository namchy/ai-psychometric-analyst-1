import {
  GOLDEN_DEMO_CANDIDATE_IDS,
  GOLDEN_DEMO_PARTICIPANT_TYPES,
  GOLDEN_DEMO_TEAM_IDS,
  type GoldenDemoCsvFoundation,
} from "./csv-contract";
import { loadGoldenDemoCsvFoundation, loadGoldenDemoRepoContract } from "./csv-loader";
import { validateGoldenDemoCsvFoundation } from "./csv-validator";

export const GOLDEN_DEMO_ORGANIZATION_NAME =
  "Partner Plus d.o.o., Mikrokreditna organizacija" as const;
export const GOLDEN_DEMO_ORGANIZATION_STATUS = "active" as const;
export const GOLDEN_DEMO_FOUNDATION_PARTICIPANT_TYPE = GOLDEN_DEMO_PARTICIPANT_TYPES[0];
export const GOLDEN_DEMO_FOUNDATION_PARTICIPANT_STATUS = "active" as const;
export const GOLDEN_DEMO_FOUNDATION_MEMBERSHIP_ROLE = "member" as const;
export const GOLDEN_DEMO_FOUNDATION_COUNTS = {
  participants: 24,
  teams: 4,
  memberships: 24,
  membersPerTeam: 6,
} as const;

export const GOLDEN_DEMO_TEAM_NAMES = {
  "GDT-01": "Kreditno poslovanje i rad s klijentima",
  "GDT-02": "Obrada kreditnih zahtjeva i kreditna administracija",
  "GDT-03": "Upravljanje kreditnim rizikom i portfoliom",
  "GDT-04": "Naplata i operativna podrška poslovnicama; jedini lifecycle tim",
} as const;

export type GoldenDemoFoundationParticipant = {
  candidateId: string;
  fullName: string;
  email: string;
  jobTitle: string;
  teamCode: keyof typeof GOLDEN_DEMO_TEAM_NAMES;
  participantType: typeof GOLDEN_DEMO_FOUNDATION_PARTICIPANT_TYPE;
  status: typeof GOLDEN_DEMO_FOUNDATION_PARTICIPANT_STATUS;
  organizationName: typeof GOLDEN_DEMO_ORGANIZATION_NAME;
};

export type GoldenDemoFoundationTeam = {
  teamCode: keyof typeof GOLDEN_DEMO_TEAM_NAMES;
  name: string;
  memberCandidateIds: string[];
  organizationName: typeof GOLDEN_DEMO_ORGANIZATION_NAME;
  archivedAt: null;
};

export type GoldenDemoFoundationMembership = {
  teamCode: keyof typeof GOLDEN_DEMO_TEAM_NAMES;
  candidateId: string;
  role: typeof GOLDEN_DEMO_FOUNDATION_MEMBERSHIP_ROLE;
  isActive: true;
  leftAt: null;
};

export type GoldenDemoFoundationContract = {
  organization: {
    name: typeof GOLDEN_DEMO_ORGANIZATION_NAME;
    status: typeof GOLDEN_DEMO_ORGANIZATION_STATUS;
  };
  participants: GoldenDemoFoundationParticipant[];
  teams: GoldenDemoFoundationTeam[];
  memberships: GoldenDemoFoundationMembership[];
  fixtureValidationErrors: string[];
};

export type GoldenDemoFoundationOrganization = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type GoldenDemoFoundationParticipantObserved = {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  participantType: string;
  status: string;
};

export type GoldenDemoFoundationTeamObserved = {
  id: string;
  organizationId: string;
  name: string;
  archivedAt: string | null;
};

export type GoldenDemoFoundationMembershipObserved = {
  id: string;
  teamId: string;
  participantId: string;
  role: string;
  isActive: boolean;
  leftAt: string | null;
};

export type GoldenDemoFoundationObservedState = {
  organizations: GoldenDemoFoundationOrganization[];
  participants: GoldenDemoFoundationParticipantObserved[];
  teams: GoldenDemoFoundationTeamObserved[];
  memberships: GoldenDemoFoundationMembershipObserved[];
};

export type GoldenDemoFoundationFindingCategory =
  | "organization"
  | "participant"
  | "team"
  | "membership"
  | "collision";

export type GoldenDemoFoundationFinding = {
  code: string;
  message: string;
  category: GoldenDemoFoundationFindingCategory;
  entity?: string;
  candidateId?: string;
  teamCode?: string;
  expected?: unknown;
  observed?: unknown;
  blocking: true;
};

export type GoldenDemoFoundationInspectionResult = {
  state: "EMPTY" | "PARTIAL" | "EXACT_MATCH" | "CONFLICT";
  createEligible: boolean;
  noOpEligible: boolean;
  manualReviewRequired: boolean;
  counts: {
    participantsExpected: number;
    participantsObserved: number;
    teamsExpected: number;
    teamsObserved: number;
    membershipsExpected: number;
    membershipsObserved: number;
  };
  blockingFindings: GoldenDemoFoundationFinding[];
  diagnosticFindings: Array<{ code: string; message: string; entity?: string }>;
  safety: {
    readOnly: true;
    databaseWrites: false;
    rpcCalls: false;
    assessmentTablesRead: false;
  };
};

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function finding(
  code: string,
  message: string,
  category: GoldenDemoFoundationFindingCategory,
  options: Omit<GoldenDemoFoundationFinding, "code" | "message" | "category" | "blocking"> = {},
): GoldenDemoFoundationFinding {
  return { code, message, category, blocking: true, ...options };
}

function candidateRows(foundation: GoldenDemoCsvFoundation) {
  return new Map(
    foundation.candidates.rows.map((row) => [row.values.candidate_id ?? "", row.values]),
  );
}

function buildFixtureValidationErrors(projectRoot: string, foundation: GoldenDemoCsvFoundation): string[] {
  const result = validateGoldenDemoCsvFoundation(
    foundation,
    loadGoldenDemoRepoContract(projectRoot),
  );
  return result.errors.map((error) => `${error.code}: ${error.message}`);
}

export function buildGoldenDemoFoundationContract(
  projectRoot = process.cwd(),
  foundation: GoldenDemoCsvFoundation = loadGoldenDemoCsvFoundation(projectRoot),
): GoldenDemoFoundationContract {
  const rows = candidateRows(foundation);
  const participants = GOLDEN_DEMO_CANDIDATE_IDS.map((candidateId) => {
    const row = rows.get(candidateId) ?? {};
    return {
      candidateId,
      fullName: row.display_name ?? "",
      email: row.email ?? "",
      jobTitle: row.job_title ?? "",
      teamCode: row.team_id as keyof typeof GOLDEN_DEMO_TEAM_NAMES,
      participantType: GOLDEN_DEMO_FOUNDATION_PARTICIPANT_TYPE,
      status: GOLDEN_DEMO_FOUNDATION_PARTICIPANT_STATUS,
      organizationName: GOLDEN_DEMO_ORGANIZATION_NAME,
    };
  });
  const teams = GOLDEN_DEMO_TEAM_IDS.map((teamCode) => ({
    teamCode,
    name: GOLDEN_DEMO_TEAM_NAMES[teamCode],
    memberCandidateIds: participants
      .filter((participant) => participant.teamCode === teamCode)
      .map((participant) => participant.candidateId),
    organizationName: GOLDEN_DEMO_ORGANIZATION_NAME,
    archivedAt: null,
  }));
  const memberships = participants.map((participant) => ({
    teamCode: participant.teamCode,
    candidateId: participant.candidateId,
    role: GOLDEN_DEMO_FOUNDATION_MEMBERSHIP_ROLE,
    isActive: true as const,
    leftAt: null,
  }));

  return {
    organization: {
      name: GOLDEN_DEMO_ORGANIZATION_NAME,
      status: GOLDEN_DEMO_ORGANIZATION_STATUS,
    },
    participants,
    teams,
    memberships,
    fixtureValidationErrors: buildFixtureValidationErrors(projectRoot, foundation),
  };
}

export function loadGoldenDemoFoundationContract(
  projectRoot = process.cwd(),
): GoldenDemoFoundationContract {
  return buildGoldenDemoFoundationContract(projectRoot);
}

function eligibility(
  state: GoldenDemoFoundationInspectionResult["state"],
): Pick<GoldenDemoFoundationInspectionResult, "createEligible" | "noOpEligible" | "manualReviewRequired"> {
  if (state === "EMPTY") return { createEligible: true, noOpEligible: false, manualReviewRequired: false };
  if (state === "EXACT_MATCH") return { createEligible: false, noOpEligible: true, manualReviewRequired: false };
  return { createEligible: false, noOpEligible: false, manualReviewRequired: true };
}

export function classifyGoldenDemoFoundation(
  contract: GoldenDemoFoundationContract,
  observed: GoldenDemoFoundationObservedState,
): GoldenDemoFoundationInspectionResult {
  const conflicts: GoldenDemoFoundationFinding[] = [];
  const partials: GoldenDemoFoundationFinding[] = [];
  const diagnostics: Array<{ code: string; message: string; entity?: string }> = [];
  const organizationMatches = observed.organizations.filter(
    (organization) => normalized(organization.name) === normalized(contract.organization.name),
  );
  const organizationIds = new Set(organizationMatches.map((organization) => organization.id));

  if (contract.fixtureValidationErrors.length > 0) {
    for (const error of contract.fixtureValidationErrors) {
      conflicts.push(finding("canonical_foundation_contract_invalid", error, "collision", { entity: "contract" }));
    }
  }
  if (organizationMatches.length === 0) {
    partials.push(finding("organization_missing", "Canonical Golden Demo organization was not found.", "organization", {
      entity: "organizations",
      expected: contract.organization.name,
    }));
  }
  if (organizationMatches.length > 1) {
    conflicts.push(finding("organization_duplicate", "Multiple organizations match the canonical Golden Demo name.", "collision", {
      entity: "organizations",
      expected: 1,
      observed: organizationMatches.length,
    }));
  }
  for (const organization of organizationMatches) {
    if (organization.status !== contract.organization.status) {
      conflicts.push(finding("organization_status_mismatch", "Canonical organization has an unexpected status.", "organization", {
        entity: "organizations",
        expected: contract.organization.status,
        observed: organization.status,
      }));
    }
  }

  const canonicalParticipants = observed.participants.filter((participant) => organizationIds.has(participant.organizationId));
  const targetParticipants = new Map<string, GoldenDemoFoundationParticipantObserved>();
  for (const expected of contract.participants) {
    const emailMatches = canonicalParticipants.filter(
      (participant) => normalized(participant.email) === normalized(expected.email),
    );
    if (emailMatches.length > 1) {
      conflicts.push(finding("participant_duplicate_email", `Canonical email is not unique for ${expected.candidateId}.`, "collision", {
        entity: "participants",
        candidateId: expected.candidateId,
        expected: 1,
        observed: emailMatches.length,
      }));
    }
    if (emailMatches.length === 0) {
      partials.push(finding("participant_missing", `Participant ${expected.candidateId} was not found by canonical email.`, "participant", {
        entity: "participants",
        candidateId: expected.candidateId,
        expected: expected.email,
      }));
      continue;
    }
    const participant = emailMatches[0];
    targetParticipants.set(expected.candidateId, participant);
    if (normalized(participant.fullName) !== normalized(expected.fullName)) {
      conflicts.push(finding("participant_name_mismatch", `Participant ${expected.candidateId} has a different canonical full name.`, "participant", {
        entity: "participants",
        candidateId: expected.candidateId,
        expected: expected.fullName,
        observed: participant.fullName,
      }));
    }
    if (participant.participantType !== expected.participantType) {
      conflicts.push(finding("participant_type_mismatch", `Participant ${expected.candidateId} has an unexpected participant type.`, "participant", {
        entity: "participants",
        candidateId: expected.candidateId,
        expected: expected.participantType,
        observed: participant.participantType,
      }));
    }
    if (participant.status !== expected.status) {
      conflicts.push(finding("participant_status_mismatch", `Participant ${expected.candidateId} is not active.`, "participant", {
        entity: "participants",
        candidateId: expected.candidateId,
        expected: expected.status,
        observed: participant.status,
      }));
    }
  }

  const canonicalTeams = observed.teams.filter((team) => organizationIds.has(team.organizationId));
  const targetTeams = new Map<string, GoldenDemoFoundationTeamObserved>();
  for (const expected of contract.teams) {
    const nameMatches = canonicalTeams.filter(
      (team) => normalized(team.name) === normalized(expected.name),
    );
    if (nameMatches.length > 1) {
      conflicts.push(finding("team_duplicate_name", `Canonical team name is not unique for ${expected.teamCode}.`, "collision", {
        entity: "teams",
        teamCode: expected.teamCode,
        expected: 1,
        observed: nameMatches.length,
      }));
    }
    if (nameMatches.length === 0) {
      partials.push(finding("team_missing", `Canonical team ${expected.teamCode} was not found.`, "team", {
        entity: "teams",
        teamCode: expected.teamCode,
        expected: expected.name,
      }));
      continue;
    }
    const team = nameMatches[0];
    targetTeams.set(expected.teamCode, team);
    if (team.archivedAt !== null) {
      conflicts.push(finding("team_archived", `Canonical team ${expected.teamCode} is archived.`, "team", {
        entity: "teams",
        teamCode: expected.teamCode,
        expected: null,
        observed: team.archivedAt,
      }));
    }
  }

  const targetParticipantIds = new Set([...targetParticipants.values()].map((participant) => participant.id));
  const targetTeamIds = new Set([...targetTeams.values()].map((team) => team.id));
  let canonicalMembershipCount = 0;
  for (const expected of contract.memberships) {
    const participant = targetParticipants.get(expected.candidateId);
    const team = targetTeams.get(expected.teamCode);
    if (!participant || !team) continue;
    const participantMemberships = observed.memberships.filter((membership) => membership.participantId === participant.id);
    const goldenDemoMemberships = participantMemberships.filter((membership) => targetTeamIds.has(membership.teamId));
    const expectedMemberships = participantMemberships.filter((membership) => membership.teamId === team.id);
    if (expectedMemberships.length === 0) {
      if (goldenDemoMemberships.length > 0) {
        conflicts.push(finding("participant_wrong_team", `${expected.candidateId} is assigned to a different Golden Demo team.`, "membership", {
          entity: "team_memberships",
          candidateId: expected.candidateId,
          teamCode: expected.teamCode,
          expected: team.id,
          observed: goldenDemoMemberships.map((membership) => membership.teamId),
        }));
      } else {
        partials.push(finding("membership_missing", `Canonical membership is missing for ${expected.candidateId}.`, "membership", {
          entity: "team_memberships",
          candidateId: expected.candidateId,
          teamCode: expected.teamCode,
        }));
      }
      continue;
    }
    canonicalMembershipCount += expectedMemberships.length;
    if (goldenDemoMemberships.length > 1) {
      conflicts.push(finding("membership_duplicate_active", `Multiple Golden Demo memberships exist for ${expected.candidateId}.`, "membership", {
        entity: "team_memberships",
        candidateId: expected.candidateId,
        expected: 1,
        observed: goldenDemoMemberships.length,
      }));
    }
    for (const membership of expectedMemberships) {
      if (membership.role !== expected.role) {
        conflicts.push(finding("membership_role_mismatch", `Membership role differs for ${expected.candidateId}.`, "membership", {
          entity: "team_memberships",
          candidateId: expected.candidateId,
          teamCode: expected.teamCode,
          expected: expected.role,
          observed: membership.role,
        }));
      }
      if (!membership.isActive || membership.leftAt !== expected.leftAt) {
        conflicts.push(finding("membership_lifecycle_mismatch", `Membership lifecycle differs for ${expected.candidateId}.`, "membership", {
          entity: "team_memberships",
          candidateId: expected.candidateId,
          teamCode: expected.teamCode,
          expected: { isActive: expected.isActive, leftAt: expected.leftAt },
          observed: { isActive: membership.isActive, leftAt: membership.leftAt },
        }));
      }
    }
  }

  for (const membership of observed.memberships) {
    if (!targetTeamIds.has(membership.teamId)) continue;
    if (!targetParticipantIds.has(membership.participantId)) {
      conflicts.push(finding("extra_participant_in_canonical_team", "A noncanonical participant occupies a Golden Demo team membership.", "collision", {
        entity: "team_memberships",
        observed: membership,
      }));
    }
  }

  const participantsObserved = targetParticipants.size;
  const teamsObserved = targetTeams.size;
  const hasCanonicalGraph = participantsObserved > 0 || teamsObserved > 0 || canonicalMembershipCount > 0;
  if (!hasCanonicalGraph && conflicts.length === 0 && organizationMatches.length === 1) {
    partials.length = 0;
  }

  const state: GoldenDemoFoundationInspectionResult["state"] = conflicts.length > 0
    ? "CONFLICT"
    : partials.length > 0
      ? "PARTIAL"
      : participantsObserved === contract.participants.length &&
          teamsObserved === contract.teams.length &&
          canonicalMembershipCount === contract.memberships.length
        ? "EXACT_MATCH"
        : "EMPTY";
  const flags = eligibility(state);
  return {
    state,
    ...flags,
    counts: {
      participantsExpected: contract.participants.length,
      participantsObserved,
      teamsExpected: contract.teams.length,
      teamsObserved,
      membershipsExpected: contract.memberships.length,
      membershipsObserved: canonicalMembershipCount,
    },
    blockingFindings: [...conflicts, ...partials],
    diagnosticFindings: diagnostics,
    safety: {
      readOnly: true,
      databaseWrites: false,
      rpcCalls: false,
      assessmentTablesRead: false,
    },
  };
}
