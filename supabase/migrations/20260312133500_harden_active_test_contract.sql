with preferred_active_test as (
  select id
  from public.tests
  order by
    case when slug = 'ipip50-hr-v1' then 0 else 1 end,
    created_at asc,
    id asc
  limit 1
)
update public.tests t
set
  is_active = (t.id = preferred_active_test.id),
  status = case
    when t.id = preferred_active_test.id then 'active'
    when t.status = 'archived' then 'archived'
    else 'draft'
  end,
  updated_at = now()
from preferred_active_test;

alter table public.tests
  alter column is_active set default false;

alter table public.tests
  drop constraint if exists tests_status_check;

alter table public.tests
  add constraint tests_status_check
  check (status in ('draft', 'active', 'archived'));

alter table public.tests
  drop constraint if exists tests_status_is_active_check;

alter table public.tests
  add constraint tests_status_is_active_check
  check (
    (is_active = true and status = 'active')
    or (is_active = false and status in ('draft', 'archived'))
  );

create unique index if not exists tests_one_active_test_idx
  on public.tests (is_active)
  where is_active = true;
