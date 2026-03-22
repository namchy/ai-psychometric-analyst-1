select
  attempt_id,
  audience,
  report_status,
  jsonb_pretty(report_snapshot) as report_snapshot_pretty
from public.attempt_reports
where attempt_id = '9ecdc825-c723-490d-9320-0924cdca59f1'
order by audience;