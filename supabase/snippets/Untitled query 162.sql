select
  rs.response_id,
  rs.question_id,
  q.code as question_code,
  ao.id as answer_option_id,
  ao.code as option_code,
  ao.label as option_label,
  rs.created_at
from public.response_selections rs
join public.questions q
  on q.id = rs.question_id
join public.answer_options ao
  on ao.id = rs.answer_option_id
where rs.response_id in (
  select r.id
  from public.responses r
  where r.attempt_id = '7041cd69-4a8b-4d70-8536-a2f0757a3838'
)
order by q.question_order, ao.option_order;