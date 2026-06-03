alter table public.response_selections
  add column if not exists selection_role text;

drop index if exists idx_response_selections_response_id_selection_role_unique;

alter table public.response_selections
  drop constraint if exists response_selections_selection_role_check;

alter table public.responses
  drop constraint if exists responses_value_shape_check;

alter table public.responses
  drop constraint if exists responses_response_kind_check;

alter table public.responses
  add constraint responses_response_kind_check
    check (response_kind in ('single_choice', 'multiple_choice', 'text', 'best_worst')),
  add constraint responses_value_shape_check
    check (
      (response_kind = 'single_choice' and answer_option_id is not null and text_value is null)
      or (response_kind = 'multiple_choice' and answer_option_id is null and text_value is null)
      or (response_kind = 'text' and answer_option_id is null and text_value is not null)
      or (response_kind = 'best_worst' and answer_option_id is null and text_value is null)
    );

alter table public.response_selections
  add constraint response_selections_selection_role_check
    check (selection_role in ('best', 'worst') or selection_role is null);

create unique index if not exists idx_response_selections_response_id_selection_role_unique
  on public.response_selections (response_id, selection_role)
  where selection_role is not null;
