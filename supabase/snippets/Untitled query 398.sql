select id, test_id, status, started_at, completed_at
from public.attempts
order by started_at desc
limit 5;