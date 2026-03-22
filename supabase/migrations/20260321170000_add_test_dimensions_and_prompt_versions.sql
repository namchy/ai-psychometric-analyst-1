create table if not exists public.test_dimensions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  display_order integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (test_id, code)
);

create table if not exists public.question_dimension_mappings (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  dimension_id uuid not null references public.test_dimensions(id) on delete cascade,
  weight numeric(8,4) not null default 1,
  reverse_scored boolean not null default false,
  created_at timestamptz not null default now(),
  unique (question_id, dimension_id)
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references public.tests(id) on delete cascade,
  report_type text not null,
  audience text not null check (audience in ('participant', 'hr')),
  source_type text not null,
  generator_type text not null check (generator_type in ('mock', 'openai')),
  prompt_key text not null,
  version text not null,
  system_prompt text not null,
  user_prompt_template text not null,
  output_schema_json jsonb,
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_test_dimensions_test_id
  on public.test_dimensions (test_id);

create index if not exists idx_test_dimensions_test_lookup
  on public.test_dimensions (test_id, is_active, display_order, code);

create index if not exists idx_question_dimension_mappings_question_id
  on public.question_dimension_mappings (question_id);

create index if not exists idx_question_dimension_mappings_dimension_id
  on public.question_dimension_mappings (dimension_id);

create index if not exists idx_prompt_versions_test_id
  on public.prompt_versions (test_id);

create index if not exists idx_prompt_versions_lookup
  on public.prompt_versions (
    test_id,
    report_type,
    audience,
    source_type,
    generator_type,
    prompt_key,
    is_active
  );

create unique index if not exists prompt_versions_one_active_idx
  on public.prompt_versions (
    test_id,
    report_type,
    audience,
    source_type,
    generator_type,
    prompt_key
  )
  where is_active = true;

create or replace function public.set_prompt_versions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_prompt_versions_updated_at on public.prompt_versions;

create trigger set_prompt_versions_updated_at
before update on public.prompt_versions
for each row
execute function public.set_prompt_versions_updated_at();

alter table public.test_dimensions enable row level security;
alter table public.question_dimension_mappings enable row level security;
alter table public.prompt_versions enable row level security;

create or replace function public.get_active_prompt_version(
  p_test_id uuid,
  p_report_type text,
  p_audience text,
  p_source_type text,
  p_generator_type text,
  p_prompt_key text
)
returns table (
  id uuid,
  test_id uuid,
  report_type text,
  audience text,
  source_type text,
  generator_type text,
  prompt_key text,
  version text,
  system_prompt text,
  user_prompt_template text,
  output_schema_json jsonb,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  updated_by uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    prompt.id,
    prompt.test_id,
    prompt.report_type,
    prompt.audience,
    prompt.source_type,
    prompt.generator_type,
    prompt.prompt_key,
    prompt.version,
    prompt.system_prompt,
    prompt.user_prompt_template,
    prompt.output_schema_json,
    prompt.notes,
    prompt.created_at,
    prompt.updated_at,
    prompt.updated_by
  from public.prompt_versions prompt
  where prompt.report_type = p_report_type
    and prompt.audience = p_audience
    and prompt.source_type = p_source_type
    and prompt.generator_type = p_generator_type
    and prompt.prompt_key = p_prompt_key
    and prompt.is_active = true
    and (prompt.test_id = p_test_id or prompt.test_id is null)
  order by
    case
      when prompt.test_id = p_test_id then 0
      when prompt.test_id is null then 1
      else 2
    end,
    prompt.updated_at desc,
    prompt.created_at desc,
    prompt.id desc
  limit 1;
$$;

revoke all on function public.get_active_prompt_version(uuid, text, text, text, text, text) from public;
grant execute on function public.get_active_prompt_version(uuid, text, text, text, text, text) to service_role;

insert into public.test_dimensions (
  test_id,
  code,
  name,
  description,
  display_order,
  is_active
)
select distinct
  question.test_id,
  question.dimension,
  question.dimension,
  null,
  min(question.question_order) over (partition by question.test_id, question.dimension),
  true
from public.questions question
where question.dimension is not null
on conflict (test_id, code) do nothing;

insert into public.question_dimension_mappings (
  question_id,
  dimension_id,
  weight,
  reverse_scored
)
select
  question.id,
  dimension.id,
  coalesce(question.weight, 1)::numeric(8,4),
  coalesce(question.reverse_scored, false)
from public.questions question
join public.test_dimensions dimension
  on dimension.test_id = question.test_id
 and dimension.code = question.dimension
where question.dimension is not null
on conflict (question_id, dimension_id) do nothing;

insert into public.prompt_versions (
  test_id,
  report_type,
  audience,
  source_type,
  generator_type,
  prompt_key,
  version,
  system_prompt,
  user_prompt_template,
  output_schema_json,
  is_active,
  notes
)
select
  null,
  seed.report_type,
  seed.audience,
  seed.source_type,
  seed.generator_type,
  seed.prompt_key,
  seed.version,
  seed.system_prompt,
  seed.user_prompt_template,
  seed.output_schema_json,
  true,
  seed.notes
from (
  values
    (
      'individual'::text,
      'participant'::text,
      'single_test'::text,
      'openai'::text,
      'completed_assessment_report'::text,
      'v1'::text,
      'Generišeš strukturirane Big Five assessment izvještaje. Verzija prompta: v1. Cjelokupan narativni sadržaj mora biti isključivo na bosanskom jeziku, ijekavica, latinica. Ne miješaj engleski sa bosanskim u naslovima, opisima, preporukama ni disclaimeru. Koristi isključivo dostavljeni deterministički scoring kontekst. Ne zaključuj niti računaj skorove iz sirovih odgovora. Ne mijenjaj dostavljene dimension keys niti score vrijednosti; vrati ih tačno kako su zadani. Opisuj tendencije i vjerovatne obrasce ponašanja, ne fiksne osobine niti sigurnost. Ne navodi dijagnoze, kliničke tvrdnje, zaključke o zaštićenim kategorijama ni savjete o tretmanu. Ne daj preporuke za zaposliti/ne zaposliti niti selekcijske odluke. Ton mora biti profesionalan, jasan, prirodan i upotrebljiv za HR/B2B izvještaj. Vrati isključivo JSON koji odgovara dostavljenoj shemi.'::text,
      '{"instructions":{"report_goal":"Napiši sažet, strukturiran assessment izvještaj zasnovan isključivo na dostavljenim determinističkim skorovima.","guardrails":["Sav tekst mora biti na bosanskom jeziku, ijekavica, latinica.","Skorovi su već izračunati i jedini su kvantitativni izvor istine.","Ne spekuliraj iz sirovih odgovora niti iz nedostajućih podataka.","Ne prenaglašavaj sigurnost zaključaka.","Koristi razvojni jezik i izbjegavaj dijagnostičke ili hiring zaključke.","Ako koristiš stručni termin, formuliraj ga prirodno za poslovni i HR kontekst na bosanskom jeziku."],"dimension_hint_text":"{{dimension_hint_text}}"},"input":{{prompt_input_json}}}'::text,
      null::jsonb,
      'Default global prompt for participant single-test individual OpenAI reports.'::text
    ),
    (
      'individual'::text,
      'hr'::text,
      'single_test'::text,
      'openai'::text,
      'completed_assessment_report'::text,
      'v1'::text,
      'Generišeš strukturirane Big Five assessment izvještaje. Verzija prompta: v1. Cjelokupan narativni sadržaj mora biti isključivo na bosanskom jeziku, ijekavica, latinica. Ne miješaj engleski sa bosanskim u naslovima, opisima, preporukama ni disclaimeru. Koristi isključivo dostavljeni deterministički scoring kontekst. Ne zaključuj niti računaj skorove iz sirovih odgovora. Ne mijenjaj dostavljene dimension keys niti score vrijednosti; vrati ih tačno kako su zadani. Opisuj tendencije i vjerovatne obrasce ponašanja, ne fiksne osobine niti sigurnost. Ne navodi dijagnoze, kliničke tvrdnje, zaključke o zaštićenim kategorijama ni savjete o tretmanu. Ne daj preporuke za zaposliti/ne zaposliti niti selekcijske odluke. Ton mora biti profesionalan, jasan, prirodan i upotrebljiv za HR/B2B izvještaj. Vrati isključivo JSON koji odgovara dostavljenoj shemi.'::text,
      '{"instructions":{"report_goal":"Napiši sažet, strukturiran assessment izvještaj zasnovan isključivo na dostavljenim determinističkim skorovima.","guardrails":["Sav tekst mora biti na bosanskom jeziku, ijekavica, latinica.","Skorovi su već izračunati i jedini su kvantitativni izvor istine.","Ne spekuliraj iz sirovih odgovora niti iz nedostajućih podataka.","Ne prenaglašavaj sigurnost zaključaka.","Koristi razvojni jezik i izbjegavaj dijagnostičke ili hiring zaključke.","Ako koristiš stručni termin, formuliraj ga prirodno za poslovni i HR kontekst na bosanskom jeziku."],"dimension_hint_text":"{{dimension_hint_text}}"},"input":{{prompt_input_json}}}'::text,
      null::jsonb,
      'Default global prompt for HR single-test individual OpenAI reports.'::text
    )
) as seed(report_type, audience, source_type, generator_type, prompt_key, version, system_prompt, user_prompt_template, output_schema_json, notes)
where not exists (
  select 1
  from public.prompt_versions existing
  where existing.test_id is null
    and existing.report_type = seed.report_type
    and existing.audience = seed.audience
    and existing.source_type = seed.source_type
    and existing.generator_type = seed.generator_type
    and existing.prompt_key = seed.prompt_key
    and existing.version = seed.version
);
