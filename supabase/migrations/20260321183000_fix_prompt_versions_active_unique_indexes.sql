drop index if exists public.prompt_versions_one_active_idx;

create unique index if not exists prompt_versions_one_active_test_specific_idx
  on public.prompt_versions (
    test_id,
    report_type,
    audience,
    source_type,
    generator_type,
    prompt_key
  )
  where is_active = true
    and test_id is not null;

create unique index if not exists prompt_versions_one_active_global_idx
  on public.prompt_versions (
    report_type,
    audience,
    source_type,
    generator_type,
    prompt_key
  )
  where is_active = true
    and test_id is null;
