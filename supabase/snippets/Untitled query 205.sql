select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'tests'
  and indexname = 'tests_one_active_test_idx';