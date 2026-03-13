alter table public.attempt_reports
add column report_status text not null default 'ready',
add column failure_code text,
add column failure_reason text;

alter table public.attempt_reports
alter column report_snapshot drop not null;

alter table public.attempt_reports
add constraint attempt_reports_report_status_check
check (report_status in ('ready', 'unavailable'));

alter table public.attempt_reports
add constraint attempt_reports_snapshot_consistency_check
check (
  (report_status = 'ready' and report_snapshot is not null and failure_code is null and failure_reason is null)
  or (report_status = 'unavailable' and report_snapshot is null)
);
