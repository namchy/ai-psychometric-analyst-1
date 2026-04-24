update public.questions
set stimulus_secondary_image_path = null
from public.tests
where public.questions.test_id = public.tests.id
  and public.tests.slug = 'safran_v1'
  and public.questions.code in ('FA02', 'FA03', 'FA04', 'FA05', 'FA06', 'FA07', 'FA08', 'FA09')
  and public.questions.stimulus_secondary_image_path is not null;
