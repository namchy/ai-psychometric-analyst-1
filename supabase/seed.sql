insert into public.tests (id, slug, name, category, description, status, is_active)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'big5-mini',
    'Big Five Mini',
    'personality',
    'Kratka Big Five procjena za MVP',
    'active',
    true
  );

insert into public.questions (id, test_id, code, text, dimension, question_order, reverse_scored, is_active)
values
  (
    '21111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'E1',
    'Volim biti okružen ljudima.',
    'extraversion',
    1,
    false,
    true
  ),
  (
    '22222222-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'E2',
    'Obično sam povučen i tih.',
    'extraversion',
    2,
    true,
    true
  ),
  (
    '23333333-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'C1',
    'Obraćam pažnju na detalje.',
    'conscientiousness',
    3,
    false,
    true
  ),
  (
    '24444444-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'C2',
    'Često ostavljam stvari nedovršene.',
    'conscientiousness',
    4,
    true,
    true
  );

insert into public.answer_options (question_id, code, label, value, option_order)
values
  ('21111111-1111-1111-1111-111111111111', '1', 'Uopće se ne slažem', 1, 1),
  ('21111111-1111-1111-1111-111111111111', '2', 'Ne slažem se', 2, 2),
  ('21111111-1111-1111-1111-111111111111', '3', 'Neutralno', 3, 3),
  ('21111111-1111-1111-1111-111111111111', '4', 'Slažem se', 4, 4),
  ('21111111-1111-1111-1111-111111111111', '5', 'U potpunosti se slažem', 5, 5),

  ('22222222-1111-1111-1111-111111111111', '1', 'Uopće se ne slažem', 1, 1),
  ('22222222-1111-1111-1111-111111111111', '2', 'Ne slažem se', 2, 2),
  ('22222222-1111-1111-1111-111111111111', '3', 'Neutralno', 3, 3),
  ('22222222-1111-1111-1111-111111111111', '4', 'Slažem se', 4, 4),
  ('22222222-1111-1111-1111-111111111111', '5', 'U potpunosti se slažem', 5, 5),

  ('23333333-1111-1111-1111-111111111111', '1', 'Uopće se ne slažem', 1, 1),
  ('23333333-1111-1111-1111-111111111111', '2', 'Ne slažem se', 2, 2),
  ('23333333-1111-1111-1111-111111111111', '3', 'Neutralno', 3, 3),
  ('23333333-1111-1111-1111-111111111111', '4', 'Slažem se', 4, 4),
  ('23333333-1111-1111-1111-111111111111', '5', 'U potpunosti se slažem', 5, 5),

  ('24444444-1111-1111-1111-111111111111', '1', 'Uopće se ne slažem', 1, 1),
  ('24444444-1111-1111-1111-111111111111', '2', 'Ne slažem se', 2, 2),
  ('24444444-1111-1111-1111-111111111111', '3', 'Neutralno', 3, 3),
  ('24444444-1111-1111-1111-111111111111', '4', 'Slažem se', 4, 4),
  ('24444444-1111-1111-1111-111111111111', '5', 'U potpunosti se slažem', 5, 5);