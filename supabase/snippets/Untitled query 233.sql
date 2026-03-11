select
  r.id,
  r.attempt_id,
  r.question_id,
  q.code as question_code,
  q.question_type,
  r.response_kind,
  r.answer_option_id,
  r.text_value,
  r.answered_at
from public.responses r
join public.questions q
  on q.id = r.question_id
where r.attempt_id = '7041cd69-4a8b-4d70-8536-a2f0757a3838'
order by q.question_order;