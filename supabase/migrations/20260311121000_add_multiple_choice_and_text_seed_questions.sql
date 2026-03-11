insert into public.questions (
  id,
  test_id,
  code,
  text,
  dimension,
  question_type,
  question_order,
  reverse_scored,
  is_active
)
select
  '25555555-1111-1111-1111-111111111111',
  t.id,
  'A1',
  'Koje aktivnosti ti prijaju u timu?',
  'agreeableness',
  'multiple_choice',
  5,
  false,
  true
from public.tests t
where t.id = '11111111-1111-1111-1111-111111111111'
  and not exists (
    select 1
    from public.questions q
    where q.id = '25555555-1111-1111-1111-111111111111'
  );

insert into public.questions (
  id,
  test_id,
  code,
  text,
  dimension,
  question_type,
  question_order,
  reverse_scored,
  is_active
)
select
  '26666666-1111-1111-1111-111111111111',
  t.id,
  'O1',
  'U nekoliko rečenica opiši kako pristupaš novim idejama.',
  'openness',
  'text',
  6,
  false,
  true
from public.tests t
where t.id = '11111111-1111-1111-1111-111111111111'
  and not exists (
    select 1
    from public.questions q
    where q.id = '26666666-1111-1111-1111-111111111111'
  );

insert into public.answer_options (question_id, code, label, value, option_order)
select
  '25555555-1111-1111-1111-111111111111',
  seeded_option.code,
  seeded_option.label,
  seeded_option.value,
  seeded_option.option_order
from (
  values
    ('collaboration', 'Zajedničko planiranje', null::integer, 1),
    ('support', 'Pomaganje kolegama', null::integer, 2),
    ('facilitation', 'Moderiranje diskusije', null::integer, 3),
    ('delivery', 'Završavanje dogovorenih zadataka', null::integer, 4)
) as seeded_option(code, label, value, option_order)
where exists (
  select 1
  from public.questions q
  where q.id = '25555555-1111-1111-1111-111111111111'
)
  and not exists (
    select 1
    from public.answer_options ao
    where ao.question_id = '25555555-1111-1111-1111-111111111111'
      and ao.option_order = seeded_option.option_order
  );