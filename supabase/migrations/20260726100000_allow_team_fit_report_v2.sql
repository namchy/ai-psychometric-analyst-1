alter table public.team_fit_reports
  drop constraint if exists team_fit_reports_report_type_check,
  drop constraint if exists team_fit_reports_report_version_check,
  drop constraint if exists team_fit_reports_report_identity_check;

alter table public.team_fit_reports
  add constraint team_fit_reports_report_identity_check
  check (
    (report_type = 'team_fit_report_v1' and report_version = 'v1')
    or
    (report_type = 'team_fit_report_v2' and report_version = 'v2')
  );
