import {
  classifyGoldenDemoFoundation,
  type GoldenDemoFoundationContract,
  type GoldenDemoFoundationInspectionResult,
  type GoldenDemoFoundationObservedState,
} from "./golden-demo-foundation-contract";

export const GOLDEN_DEMO_FOUNDATION_RPC = "create_golden_demo_foundation_v1" as const;
export const GOLDEN_DEMO_FOUNDATION_CONFIRMATION = "GOLDEN_DEMO_FOUNDATION" as const;

const SAFE_MISSING_FINDINGS = new Set([
  "participant_missing",
  "team_missing",
  "membership_missing",
]);

type FoundationWriteState = GoldenDemoFoundationInspectionResult["state"];

export type GoldenDemoFoundationWritePlan = {
  stateBefore: FoundationWriteState;
  rpcAllowed: boolean;
  reasonCode:
    | "EMPTY_MISSING_ONLY"
    | "PARTIAL_MISSING_ONLY"
    | "EXACT_MATCH_NOOP"
    | "WRITE_BLOCKED";
  reason: string;
  participantsToCreate: GoldenDemoFoundationContract["participants"];
  teamsToCreate: GoldenDemoFoundationContract["teams"];
  membershipsToCreate: GoldenDemoFoundationContract["memberships"];
  counts: {
    participantsToCreate: number;
    teamsToCreate: number;
    membershipsToCreate: number;
  };
  postcondition: "EXACT_MATCH";
};

export type GoldenDemoFoundationRpcClient = {
  rpc(
    functionName: typeof GOLDEN_DEMO_FOUNDATION_RPC,
    args: Record<string, never>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function emptyPlan(
  stateBefore: FoundationWriteState,
  reasonCode: GoldenDemoFoundationWritePlan["reasonCode"],
  reason: string,
): GoldenDemoFoundationWritePlan {
  return {
    stateBefore,
    rpcAllowed: false,
    reasonCode,
    reason,
    participantsToCreate: [],
    teamsToCreate: [],
    membershipsToCreate: [],
    counts: {
      participantsToCreate: 0,
      teamsToCreate: 0,
      membershipsToCreate: 0,
    },
    postcondition: "EXACT_MATCH",
  };
}

export function buildGoldenDemoFoundationWritePlan(input: {
  contract: GoldenDemoFoundationContract;
  observed: GoldenDemoFoundationObservedState;
  inspection?: GoldenDemoFoundationInspectionResult;
}): GoldenDemoFoundationWritePlan {
  const inspection =
    input.inspection ?? classifyGoldenDemoFoundation(input.contract, input.observed);

  if (inspection.state === "EXACT_MATCH") {
    return emptyPlan(
      inspection.state,
      "EXACT_MATCH_NOOP",
      "Canonical Golden Demo foundation already matches; no RPC is allowed.",
    );
  }

  if (inspection.state !== "EMPTY" && inspection.state !== "PARTIAL") {
    const conflictCodes = inspection.blockingFindings.map((finding) => finding.code);
    return emptyPlan(
      inspection.state,
      "WRITE_BLOCKED",
      `Foundation write is blocked because the observed state is not EMPTY or missing-only PARTIAL${
        conflictCodes.length > 0 ? `: ${conflictCodes.join(", ")}` : "."
      }`,
    );
  }

  const disallowedFindings = inspection.blockingFindings.filter(
    (finding) => !SAFE_MISSING_FINDINGS.has(finding.code),
  );
  if (disallowedFindings.length > 0) {
    return emptyPlan(
      inspection.state,
      "WRITE_BLOCKED",
      `Foundation write is blocked by: ${disallowedFindings
        .map((finding) => finding.code)
        .join(", ")}.`,
    );
  }

  const canonicalOrganizations = input.observed.organizations.filter(
    (organization) => normalized(organization.name) === normalized(input.contract.organization.name),
  );
  if (canonicalOrganizations.length !== 1) {
    return emptyPlan(
      inspection.state,
      "WRITE_BLOCKED",
      "Foundation write requires exactly one resolved canonical organization.",
    );
  }

  const organizationIds = new Set(canonicalOrganizations.map((organization) => organization.id));
  const canonicalParticipants = input.observed.participants.filter((participant) =>
    organizationIds.has(participant.organizationId),
  );
  const canonicalTeams = input.observed.teams.filter((team) => organizationIds.has(team.organizationId));

  const participantsToCreate = input.contract.participants.filter(
    (expected) =>
      !canonicalParticipants.some(
        (observed) => normalized(observed.email) === normalized(expected.email),
      ),
  );
  const teamsToCreate = input.contract.teams.filter(
    (expected) =>
      !canonicalTeams.some((observed) => normalized(observed.name) === normalized(expected.name)),
  );

  const participantByEmail = new Map(
    canonicalParticipants.map((participant) => [normalized(participant.email), participant]),
  );
  const teamByName = new Map(
    canonicalTeams.map((team) => [normalized(team.name), team]),
  );
  const existingMembershipKeys = new Set(
    input.observed.memberships.map(
      (membership) => `${membership.participantId}:${membership.teamId}`,
    ),
  );
  const membershipsToCreate = input.contract.memberships.filter((expected) => {
    const participant = participantByEmail.get(
      normalized(
        input.contract.participants.find(
          (candidate) => candidate.candidateId === expected.candidateId,
        )?.email ?? "",
      ),
    );
    const team = teamByName.get(
      normalized(
        input.contract.teams.find((candidate) => candidate.teamCode === expected.teamCode)?.name ?? "",
      ),
    );
    return !participant || !team || !existingMembershipKeys.has(`${participant.id}:${team.id}`);
  });

  const reasonCode =
    inspection.state === "EMPTY" ? "EMPTY_MISSING_ONLY" : "PARTIAL_MISSING_ONLY";
  return {
    stateBefore: inspection.state,
    rpcAllowed: true,
    reasonCode,
    reason:
      inspection.state === "EMPTY"
        ? "Canonical organization exists and the foundation graph is empty; create the complete canonical graph atomically."
        : "Observed foundation contains only canonical missing findings; create only the missing canonical graph atomically.",
    participantsToCreate,
    teamsToCreate,
    membershipsToCreate,
    counts: {
      participantsToCreate: participantsToCreate.length,
      teamsToCreate: teamsToCreate.length,
      membershipsToCreate: membershipsToCreate.length,
    },
    postcondition: "EXACT_MATCH",
  };
}

export async function executeGoldenDemoFoundationApply(input: {
  plan: GoldenDemoFoundationWritePlan;
  rpcClient: GoldenDemoFoundationRpcClient;
  inspectAfterWrite: () => Promise<GoldenDemoFoundationInspectionResult>;
}) {
  if (!input.plan.rpcAllowed) {
    return {
      rpcCalled: false,
      postconditionState: input.plan.stateBefore,
      plan: input.plan,
    } as const;
  }

  const rpcResult = await input.rpcClient.rpc(GOLDEN_DEMO_FOUNDATION_RPC, {});
  if (rpcResult.error) {
    throw new Error(`Golden Demo foundation RPC failed atomically: ${rpcResult.error.message}`);
  }

  const postWriteInspection = await input.inspectAfterWrite();
  if (postWriteInspection.state !== "EXACT_MATCH") {
    throw new Error(
      `Golden Demo foundation RPC did not satisfy EXACT_MATCH postcondition; received ${postWriteInspection.state}.`,
    );
  }

  return {
    rpcCalled: true,
    postconditionState: postWriteInspection.state,
    postWriteInspection,
    rpcResult: rpcResult.data,
    plan: input.plan,
  } as const;
}
