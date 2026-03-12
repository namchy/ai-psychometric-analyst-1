alter table public.attempt_reports
drop constraint if exists attempt_reports_generator_type_check;

alter table public.attempt_reports
add constraint attempt_reports_generator_type_check
check (generator_type in ('mock', 'openai'));
