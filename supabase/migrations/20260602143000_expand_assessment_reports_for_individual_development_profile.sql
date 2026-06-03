alter table public.assessment_reports
  drop constraint if exists assessment_reports_report_type_check;

alter table public.assessment_reports
  add constraint assessment_reports_report_type_check
  check (report_type in ('composite', 'individual_development_profile'));
