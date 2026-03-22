select
  audience,
  generator_type,
  model_name,
  report_status,
  started_at,
  completed_at,
  (report_snapshot is not null) as snapshot_present,
  failure_code,
  failure_reason
from public.attempt_reports
where attempt_id = '74d379a7-bb63-4cbf-b6fd-81f1376859cc'
order by audience asc;