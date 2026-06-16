# Supabase Team Fit migration drift audit

## Executive summary

Ovaj dokument je read-only audit za otvoreni P1 drift: remote Supabase migration marker `20260530183640` i lokalnu Team Fit migraciju `supabase/migrations/20260530110000_add_team_fit_reports.sql`.

Poznati nalaz iz `docs/deep-profile-todo.md` kaže da remote marker `20260530183640` vjerovatno predstavlja alias za lokalnu Team Fit migraciju `20260530110000_add_team_fit_reports`. Lokalni repo nema migration fajl sa timestampom `20260530183640`, ali ima canonical Team Fit migration fajl:

`supabase/migrations/20260530110000_add_team_fit_reports.sql`

Ovaj audit ne potvrđuje remote/local parity direktno, jer u ovom tasku nije pokretana nijedna DB-backed komanda. Dokument mapira lokalni intent, poznati drift i read-only SQL koji operator može ručno pokrenuti na remote bazi prije bilo kakve repair/mirror odluke.

## Scope i status

Status ovog dokumenta:

- read-only audit;
- bez promjene baze;
- bez promjene migration fajlova;
- bez runtime code promjena;
- bez Supabase repair, db push, db reset, migration up ili migration down;
- bez OpenAI poziva;
- bez report generation/regeneration;
- bez Composite HR promjena.

## Šta je poznati drift

Poznati drift:

- Remote Supabase migration history sadrži marker `20260530183640`.
- Lokalni repo nema migration fajl sa imenom `supabase/migrations/20260530183640_*.sql`.
- Todo/runbook kontekst navodi da remote marker ima `name = 20260530110000_add_team_fit_reports`.
- Lokalni canonical Team Fit migration fajl postoji kao `supabase/migrations/20260530110000_add_team_fit_reports.sql`.
- Raniji read-only nalaz u todo-u kaže da remote statements odgovaraju Team Fit SQL-u za `public.team_fit_reports`, indekse, updated_at trigger i HR/admin RLS policies.

Zaključak za ovaj audit: drift treba tretirati kao migration-history alias dok se read-only SQL provjerama ne potvrdi stvarni remote schema parity.

## Lokalni migration fajl

Lokalni fajl:

`supabase/migrations/20260530110000_add_team_fit_reports.sql`

Lokalni schema intent:

- kreirati `public.team_fit_reports`;
- povezati report sa organizacijom, timom i kandidatom/participantom;
- čuvati Team Fit lifecycle i persisted input/output snapshot-e;
- ograničiti supported report type/version/status vrijednosti;
- ograničiti candidate/team source type vrijednosti;
- dodati indekse za lookup, queue i organization/team/participant filtere;
- dodati updated_at trigger;
- omogućiti RLS;
- dozvoliti read/insert/update samo aktivnim `org_owner` i `hr_admin` članovima organizacije.

## Remote marker

Remote marker koji treba provjeriti:

`20260530183640`

Očekivana veza prema lokalnoj migraciji:

- remote `version`: `20260530183640`;
- očekivani remote `name`: `20260530110000_add_team_fit_reports`;
- lokalni canonical SQL: `supabase/migrations/20260530110000_add_team_fit_reports.sql`.

Ovaj dokument ne tvrdi da je remote schema identična lokalnoj. To se mora potvrditi read-only SQL provjerama prije bilo kakve intervencije.

## Zašto se ovo ne smije rješavati naslijepo

Direktno rješavanje kroz schema sync ili migration history repair bez plana je rizično zato što:

- remote history sadrži marker koji lokalni repo ne može reproducirati po filename/timestamp pravilu;
- alat za migration sync može pokušati primijeniti ili preskočiti pogrešan set migracija;
- dupliranje iste Team Fit migracije pod novim timestampom može napraviti konflikt nad tabelom, indeksima, triggerom ili policy imenima;
- brisanje ili repair migration history markera bez dokaznog traga može sakriti stvarnu razliku između runtime baze i repoa;
- Team Fit runtime već zavisi od `team_fit_reports`, pa pogrešan repair može pokvariti report lifecycle;
- RLS/policy drift je posebno opasan jer može izgledati kao schema parity dok access behavior nije isti.

## Očekivani runtime footprint iz lokalne migracije

### Tabela `team_fit_reports`

Lokalna migracija kreira `public.team_fit_reports` sa ovim glavnim poljima:

- `id uuid primary key default gen_random_uuid()`;
- `organization_id uuid not null references public.organizations(id) on delete cascade`;
- `team_id uuid not null references public.teams(id) on delete cascade`;
- `participant_id uuid not null references public.participants(id) on delete cascade`;
- `candidate_source_type text not null`;
- `candidate_source_id uuid null`;
- `team_source_type text not null`;
- `team_source_id uuid null`;
- `optional_context jsonb not null default '{}'::jsonb`;
- `report_type text not null`;
- `report_version text not null`;
- `report_status text not null`;
- `input_snapshot jsonb null`;
- `report_snapshot jsonb null`;
- `error_message text null`;
- `queued_at`, `started_at`, `completed_at`, `failed_at`;
- `created_by uuid null references auth.users(id) on delete set null`;
- `created_at`, `updated_at`.

### Status i check vrijednosti

Lokalna migracija očekuje:

- `report_type = 'team_fit_report_v1'`;
- `report_version = 'v1'`;
- `report_status in ('queued', 'processing', 'ready', 'failed')`;
- `candidate_source_type in ('composite_deterministic_input_snapshot')`;
- `team_source_type in ('team_dynamics_aggregation_input_snapshot')`;
- `jsonb_typeof(optional_context) = 'object'`.

### Indeksi

Lokalna migracija očekuje indekse:

- `team_fit_reports_organization_idx`;
- `team_fit_reports_team_idx`;
- `team_fit_reports_participant_idx`;
- `team_fit_reports_organization_team_idx`;
- `team_fit_reports_organization_participant_idx`;
- `team_fit_reports_queue_idx`, parcijalni indeks za `report_status = 'queued'`;
- `team_fit_reports_relational_lookup_idx`.

### Trigger

Lokalna migracija očekuje:

- funkciju `public.set_team_fit_reports_updated_at()`;
- trigger `set_team_fit_reports_updated_at` prije update-a na `public.team_fit_reports`.

### RLS i policies

Lokalna migracija omogućava RLS na `public.team_fit_reports`.

Očekivane policies:

- `team_fit_reports_read_hr_admin` za `select`;
- `team_fit_reports_insert_hr_admin` za `insert`;
- `team_fit_reports_update_hr_admin` za `update`.

Sve tri policy definicije koriste `public.organization_memberships` i dozvoljavaju pristup samo korisnicima koji su aktivni članovi organizacije sa rolom `org_owner` ili `hr_admin`.

### Odnos prema drugim tabelama

Lokalna migracija uvodi direktne reference na:

- `public.organizations(id)`;
- `public.teams(id)`;
- `public.participants(id)`;
- `auth.users(id)` kroz `created_by`.

Migracija ne uvodi direktni foreign key prema `assessment_assignments`, `assessment_reports` ili `team_assessment_reports`. Veze prema kandidat/team source artefaktima su modelirane kroz `candidate_source_type/candidate_source_id` i `team_source_type/team_source_id`.

## Read-only SQL za ručnu provjeru

Svi upiti u ovoj sekciji su read-only i koriste samo `select`.

### Migration history marker

```sql
select *
from supabase_migrations.schema_migrations
where version in ('20260530183640', '20260530110000')
order by version;
```

```sql
select version, name
from supabase_migrations.schema_migrations
where version = '20260530183640';
```

### Postojanje tabele

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'team_fit_reports';
```

### Kolone u `team_fit_reports`

```sql
select
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'team_fit_reports'
order by ordinal_position;
```

### Constrainti i checkovi

```sql
select
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid) as constraint_definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'team_fit_reports'
order by con.conname;
```

### Indeksi

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'team_fit_reports'
order by indexname;
```

### RLS status

```sql
select
  nsp.nspname as schema_name,
  rel.relname as table_name,
  rel.relrowsecurity as rls_enabled,
  rel.relforcerowsecurity as rls_forced
from pg_class rel
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'team_fit_reports';
```

### Policies

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'team_fit_reports'
order by policyname;
```

### Trigger i trigger funkcija

```sql
select
  trigger_schema,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'team_fit_reports'
order by trigger_name, event_manipulation;
```

```sql
select
  nsp.nspname as schema_name,
  prc.proname as function_name,
  pg_get_functiondef(prc.oid) as function_definition
from pg_proc prc
join pg_namespace nsp on nsp.oid = prc.pronamespace
where nsp.nspname = 'public'
  and prc.proname = 'set_team_fit_reports_updated_at';
```

### Zavisnosti prema drugim tabelama

```sql
select
  con.conname as constraint_name,
  src_nsp.nspname as source_schema,
  src.relname as source_table,
  tgt_nsp.nspname as target_schema,
  tgt.relname as target_table,
  pg_get_constraintdef(con.oid) as constraint_definition
from pg_constraint con
join pg_class src on src.oid = con.conrelid
join pg_namespace src_nsp on src_nsp.oid = src.relnamespace
join pg_class tgt on tgt.oid = con.confrelid
join pg_namespace tgt_nsp on tgt_nsp.oid = tgt.relnamespace
where con.contype = 'f'
  and src_nsp.nspname = 'public'
  and src.relname = 'team_fit_reports'
order by con.conname;
```

### Brza provjera očekivanih policy dependency tabela

```sql
select table_schema, table_name
from information_schema.tables
where (table_schema = 'public' and table_name in ('organizations', 'teams', 'participants', 'organization_memberships'))
   or (table_schema = 'auth' and table_name = 'users')
order by table_schema, table_name;
```

## Moguće repair strategije — ne izvršavati u ovom tasku

Ovo su konceptualne opcije. Nijedna se ne izvršava u ovom read-only audit tasku.

### Opcija 1: mirror lokalne migracije pod remote timestampom

Razmotriti samo ako read-only provjere potvrde da remote marker `20260530183640` ima isti schema intent kao lokalni `20260530110000_add_team_fit_reports.sql`.

Ideja:

- dodati lokalni mirror/alias migration fajl koji odgovara remote timestampu;
- izbjeći ponovno mijenjanje runtime sheme ako je remote već u parity stanju;
- jasno dokumentovati da je fajl migration-history mirror, ne novi product schema change.

Rizik: ako mirror fajl sadrži executable SQL koji se ponovo primijeni na drugom okruženju, može napraviti duplikat ili neočekivan drift. Ova opcija traži pažljiv dizajn.

### Opcija 2: Supabase migration history repair

Razmotriti samo nakon backup-a, read-only parity provjere i eksplicitnog operator approval-a.

Ideja:

- uskladiti migration history tako da lokalni repo i remote marker više ne blokiraju budući schema workflow;
- ne mijenjati runtime schema ako je schema već ispravna.

Rizik: pogrešan repair može sakriti stvarnu razliku ili otežati buduće migracije.

### Opcija 3: ne dirati ništa ako ne blokira trenutni flow

Ako runtime schema već odgovara lokalnom intentu i drift ne blokira planirani rad, moguće je ostaviti marker kao poznati infrastructure dug.

Ovo je najkonzervativnije dok nema potrebe za DB-heavy taskom, ali ostavlja rizik za budući migration workflow.

### Opcija 4: zaseban operator-approved repair task

Preporučeni put za stvarni fix:

- otvoriti zaseban task;
- prvo uraditi backup i read-only parity provjeru;
- dokumentovati izabranu strategiju;
- dobiti eksplicitno odobrenje za bilo kakav Supabase repair ili schema workflow;
- nakon intervencije ažurirati runbook i todo.

## Rizici i backup napomene

Prije bilo kakvog budućeg repair/mirror zahvata:

- napraviti backup remote baze ili barem schema dump koji je odobren za taj environment;
- sačuvati rezultat read-only SQL provjera;
- potvrditi da `team_fit_reports` tabela, constrainti, indeksi, trigger i policies odgovaraju očekivanom lokalnom intentu;
- potvrditi da Team Fit runtime flow i dalje vidi postojeće `team_fit_reports` artefakte;
- ne raditi repair u istom tasku u kojem se uvode nove migracije;
- pripremiti rollback plan za migration history i schema state;
- posebno provjeriti RLS/policy behavior jer schema shape parity nije dovoljna za sigurnost pristupa.

## Non-goals

Ovaj audit ne radi:

- promjenu Supabase migration historyja;
- promjenu lokalnih migration fajlova;
- promjenu remote ili lokalne baze;
- schema sync;
- repair;
- Team Fit runtime promjene;
- report provider, renderer, validator, lifecycle helper ili UI promjene;
- report generation ili regeneration;
- OpenAI pozive;
- Composite HR promjene.

## Zaključak

Lokalni canonical Team Fit migration fajl je `supabase/migrations/20260530110000_add_team_fit_reports.sql`. Poznati remote marker je `20260530183640`, ranije identificiran kao vjerovatni alias za isti Team Fit schema intent.

Siguran sljedeći korak nije automatski repair. Siguran sljedeći korak je ručna read-only remote provjera kroz SQL iz ovog dokumenta, zatim zasebna odluka o mirror/repair strategiji ako migration drift i dalje blokira planirani workflow.
