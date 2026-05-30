# Supabase Runtime DB Runbook

Ovaj runbook pokriva operativni postupak kada DB-backed smoke padne zato što runtime Supabase koji koristi `.env.local` ne vidi novu `public` tabelu ili baca schema cache grešku.

## Šta znači "runtime koji koristi `.env.local`"

U ovom repou runtime za app i DB-backed smoke skripte određuju isti env varovi:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Repo kod to koristi kroz:

- `lib/supabase/env.ts`
- `lib/supabase/server.ts`
- `lib/supabase/admin.ts`

Praktično: source of truth za runtime projekat je `NEXT_PUBLIC_SUPABASE_URL` iz `.env.local`, ne lokalni `supabase/.temp/project-ref`.

Sanity check bez ispisa tajni:

```bash
node --env-file=.env.local -e 'const u=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL); console.log(JSON.stringify({projectRef:u.host.split(".")[0],host:u.host,hasPublishableKey:Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),hasServiceRoleKey:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)},null,2))'
```

Za ovaj incident runtime `.env.local` cilja projekat `njczzzxmjwzjbtzwwsda`.

## Kako prepoznati schema cache / missing table problem

Tipični simptomi:

- DB-backed smoke pada na `PGRST205`
- error poruka spominje `schema cache`
- runtime client ne vidi novu `public` tabelu iako migracija postoji u repou

Ovo je runtime DB/migration problem, ne automatski feature-code bug.

## Standardni proces

1. Potvrdi isti runtime.
   Smoke mora ići protiv istog runtime-a koji koristi `.env.local`, ne protiv paralelnog Supabase okruženja i ne protiv slučajno linkovanog CLI projekta.

2. Provjeri da migracija već postoji u repou.
   Prvo traži postojeću migraciju; ne pravi novu samo zato što tabela nedostaje u runtime bazi.

```bash
rg -n "team_fit_reports|assessment_reports|team_assessment_reports" supabase/migrations
ls supabase/migrations/*team_fit*
```

3. Provjeri da li tabela postoji u runtime bazi.
   Koristi read-only SQL nad istim runtime projektom koji koristi `.env.local`, npr. kroz Supabase SQL Editor, Management API read-only path ili `psql` ako već imaš pristup istom runtime DB-u.

```sql
select exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'team_fit_reports'
) as team_fit_exists;
```

4. Provjeri da li je migration history marker upisan na runtime bazi.
   Ako imaš SQL pristup istom runtime DB-u, potvrdi da canonical history sadrži version iz imena migracije.

```sql
select exists (
  select 1
  from supabase_migrations.schema_migrations
  where version = '20260530110000'
) as migration_exists;
```

5. Provjeri da li runtime Supabase client vidi tabelu.
   Ovo je bitno jer sama tabela u Postgresu nije dovoljna ako runtime REST/schema cache još ne vidi objekt.

```bash
node --env-file=.env.local -e 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); (async()=>{const {error}=await s.from("team_fit_reports").select("id",{head:true,count:"exact"}).limit(1); console.log(JSON.stringify({runtimeClientSeesTable:!error,errorCode:error?.code??null,errorMessage:error?.message??null},null,2));})().catch((e)=>{console.error(e.message); process.exit(1);});'
```

6. Ako migracija postoji u repou, ali nije primijenjena na runtime bazu, dozvoljeno je primijeniti postojeću migraciju na isti runtime.
   Dozvoljeno je samo kada je problem operational drift: runtime `.env.local` nema već postojeću repo migraciju.

7. Ako migraciju primijeniš van standardnog CLI toka, upiši canonical migration history marker za isti version.
   Ovo je obavezno da runtime project ne ostane u driftu između stvarne sheme i migration history. Ne izmišljati novu verziju i ne praviti ad hoc pseudo-migraciju; upisuje se marker za postojeći timestamp/version iz repo fajla.

8. Nakon DB operacije, ponovi provjere.
   Potvrdi:
   `team_fit_exists = true`, `migration_exists = true`, runtime client vidi tabelu, a relevantni smoke prolazi na istom `.env.local` runtime-u.

## Kada je dozvoljeno primijeniti postojeću migraciju

Dozvoljeno je kada su sva ova stanja istinita:

- odgovarajuća migracija već postoji u `supabase/migrations/`
- smoke cilja isti runtime kao `.env.local`
- problem je missing table / schema cache / migration drift
- nema potrebe za novim schema dizajnom

Praktični deployment path u ovom repou nije jedan:

- Supabase CLI postoji u repou, ali nije dovoljan source of truth ako je linkovan na pogrešan projekat ili ako postoji history drift
- raniji incidenti su rješavani kroz Supabase SQL Editor i kroz Management API path
- `psql` je prihvatljiv samo ako ide na isti runtime projekat koji koristi `.env.local`

## Kada NIJE dozvoljeno praviti novu migraciju

Ne pravi novu migraciju kada:

- tabela već ima postojeću repo migraciju, ali nije primijenjena na runtime
- smoke puca zato što je CLI linkovan na drugi projekat
- problem je samo schema cache visibility
- treba samo upisati missing history marker za već postojeću migraciju
- neko pokušava preusmjeriti smoke na drugo okruženje umjesto da popravi isti `.env.local` runtime

## Supabase CLI guardrail

`supabase/.temp/project-ref` je lokalni CLI artefakt i može driftati od stvarnog runtime-a. U ovom auditu `.env.local` pokazuje `njczzzxmjwzjbtzwwsda`, dok lokalni `supabase/.temp/project-ref` pokazuje drugi ref.

Zato:

- ne tretirati `supabase/.temp/project-ref` kao source of truth za smoke
- ne pokretati `supabase db push` naslijepo kada postoji migration history drift
- `supabase migration list` može biti nepouzdan ili failati ako CLI nije usklađen sa runtime projektom ili nema potreban DB pristup

## Kako izbjeći commitovanje `supabase/.temp/*`

`supabase/.temp/*` su lokalni CLI metadata artefakti, nisu implementation diff.

Prije commita:

```bash
git status --porcelain
git status --porcelain -- supabase/.temp
```

Ako vidiš `.temp` promjene, ne uključuj ih u commit. Očisti ih lokalno:

```bash
git restore --staged supabase/.temp/*
git restore supabase/.temp/*
```

Ako repo lokalno i dalje generiše `.temp` churn, tretiraj to kao operativni šum, ne kao feature promjenu.

## Kako očistiti lokalni git status nakon DB operacije

Minimalni post-DB cleanup:

1. `git status --porcelain`
2. potvrdi da nema `supabase/.temp/*` u diffu
3. potvrdi da docs-only promjene ostaju jedini reviewable diff

## Koje komande pokrenuti nakon primjene migracije

Minimalni set:

```bash
node --env-file=.env.local -e 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); (async()=>{const {error}=await s.from("team_fit_reports").select("id",{head:true,count:"exact"}).limit(1); console.log(JSON.stringify({runtimeClientSeesTable:!error,errorCode:error?.code??null,errorMessage:error?.message??null},null,2));})().catch((e)=>{console.error(e.message); process.exit(1);});'
npm run test:team-fit-report-db-smoke
```

Po potrebi dodaj read-only SQL provjeru za:

- `team_fit_exists`
- `migration_exists`

## Recent example: Team Fit incident

Problem:

- runtime Supabase client nije vidio `public.team_fit_reports`
- DB-backed smoke je zato padao na missing table / schema cache problem

Repo migracija:

- `supabase/migrations/20260530110000_add_team_fit_reports.sql`

Runtime project ref:

- `njczzzxmjwzjbtzwwsda`

Rješenje:

- primijenjena je postojeća migracija na isti runtime koji koristi `.env.local`
- upisan je canonical migration history marker za version `20260530110000`
- nije rađena nova migracija
- smoke nije preusmjeren na drugo okruženje

Verifikacija:

- `team_fit_exists = true`
- `migration_exists = true`
- runtime client vidi `team_fit_reports`
- `npm run test:team-fit-report-db-smoke` prolazi

Operativna napomena:

- cilj je popraviti isti runtime koji koristi app i smoke, ne tražiti "lakši" paralelni projekat
- ako repo migracija već postoji, prvo se primjenjuje ta migracija; nova migracija nije korektan odgovor na missing apply stanje
