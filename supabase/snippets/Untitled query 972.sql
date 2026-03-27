select
  id,
  test_id,
  user_id,
  participant_id,
  organization_id,
  status,
  created_at,
  updated_at
from public.attempts
where participant_id = '522a6d61-79c1-4ed0-a8d9-3d962537c8b7'::uuid
   or user_id = 'df1779f4-63f0-44ff-8bdd-e576aca17e26'::uuid
order by created_at desc;