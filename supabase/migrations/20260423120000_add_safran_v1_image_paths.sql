alter table public.questions
  add column if not exists stimulus_image_path text,
  add column if not exists stimulus_secondary_image_path text;

alter table public.answer_options
  add column if not exists image_path text;
