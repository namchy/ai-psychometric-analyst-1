import {
  GOLDEN_DEMO_ORGANIZATION_NAME,
  classifyGoldenDemoFoundation,
  type GoldenDemoFoundationContract,
  type GoldenDemoFoundationMembershipObserved,
  type GoldenDemoFoundationObservedState,
  type GoldenDemoFoundationParticipantObserved,
  type GoldenDemoFoundationTeamObserved,
} from "./golden-demo-foundation-contract";

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type ReadQuery<T> = PromiseLike<QueryResult<T>>;

type ReadQueryBuilder<T> = {
  select(columns: string): ReadQueryBuilder<T> & ReadQuery<T>;
  eq(column: string, value: unknown): ReadQueryBuilder<T> & ReadQuery<T>;
  in(column: string, values: unknown[]): ReadQueryBuilder<T> & ReadQuery<T>;
  is(column: string, value: null): ReadQueryBuilder<T> & ReadQuery<T>;
};

export type GoldenDemoFoundationSupabaseReadClient = {
  from<T = Record<string, unknown>>(table: string): ReadQueryBuilder<T>;
};

export type GoldenDemoFoundationReadRepository = {
  readState(): Promise<GoldenDemoFoundationObservedState>;
};

type RawOrganization = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type RawParticipant = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  participant_type: string;
  status: string;
};

type RawTeam = {
  id: string;
  organization_id: string;
  name: string;
  archived_at: string | null;
};

type RawMembership = {
  id: string;
  team_id: string;
  participant_id: string;
  role: string;
  is_active: boolean;
  left_at: string | null;
};

async function readRows<T>(
  supabase: GoldenDemoFoundationSupabaseReadClient,
  table: string,
  columns: string,
  configure?: (query: ReadQueryBuilder<T>) => ReadQueryBuilder<T> & ReadQuery<T>,
): Promise<T[]> {
  let query = supabase.from<T>(table).select(columns) as ReadQueryBuilder<T> & ReadQuery<T>;
  if (configure) query = configure(query);
  const result = await query;
  if (result.error) throw new Error(`Failed to read ${table}: ${result.error.message}`);
  return result.data ?? [];
}

async function readByForeignKeys<T>(
  supabase: GoldenDemoFoundationSupabaseReadClient,
  table: string,
  columns: string,
  column: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  return readRows<T>(supabase, table, columns, (query) => query.in(column, ids));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function deduplicateById<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

export function createGoldenDemoFoundationSupabaseReadRepository(
  supabase: GoldenDemoFoundationSupabaseReadClient,
): GoldenDemoFoundationReadRepository {
  return {
    async readState(): Promise<GoldenDemoFoundationObservedState> {
      const organizations = await readRows<RawOrganization>(
        supabase,
        "organizations",
        "id, name, slug, status",
        (query) => query.eq("name", GOLDEN_DEMO_ORGANIZATION_NAME),
      );
      const organizationIds = unique(organizations.map((organization) => organization.id));
      const participants = await readByForeignKeys<RawParticipant>(
        supabase,
        "participants",
        "id, organization_id, email, full_name, participant_type, status",
        "organization_id",
        organizationIds,
      );
      const teams = await readByForeignKeys<RawTeam>(
        supabase,
        "teams",
        "id, organization_id, name, archived_at",
        "organization_id",
        organizationIds,
      );
      const teamIds = unique(teams.map((team) => team.id));
      const participantIds = unique(participants.map((participant) => participant.id));
      const membershipsByTeam = await readByForeignKeys<RawMembership>(
        supabase,
        "team_memberships",
        "id, team_id, participant_id, role, is_active, left_at",
        "team_id",
        teamIds,
      );
      const membershipsByParticipant = await readByForeignKeys<RawMembership>(
        supabase,
        "team_memberships",
        "id, team_id, participant_id, role, is_active, left_at",
        "participant_id",
        participantIds,
      );
      const memberships = deduplicateById([...membershipsByTeam, ...membershipsByParticipant]);

      return {
        organizations: organizations.map((organization) => ({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
        })),
        participants: participants.map((participant): GoldenDemoFoundationParticipantObserved => ({
          id: participant.id,
          organizationId: participant.organization_id,
          email: participant.email,
          fullName: participant.full_name,
          participantType: participant.participant_type,
          status: participant.status,
        })),
        teams: teams.map((team): GoldenDemoFoundationTeamObserved => ({
          id: team.id,
          organizationId: team.organization_id,
          name: team.name,
          archivedAt: team.archived_at,
        })),
        memberships: memberships.map((membership): GoldenDemoFoundationMembershipObserved => ({
          id: membership.id,
          teamId: membership.team_id,
          participantId: membership.participant_id,
          role: membership.role,
          isActive: membership.is_active,
          leftAt: membership.left_at,
        })),
      };
    },
  };
}

export async function inspectGoldenDemoFoundation(input: {
  contract: GoldenDemoFoundationContract;
  repository: GoldenDemoFoundationReadRepository;
}) {
  const observed = await input.repository.readState();
  return classifyGoldenDemoFoundation(input.contract, observed);
}
