alter table public.participants
  add column if not exists addressing_form text;

alter table public.participants
  drop constraint if exists participants_addressing_form_check,
  add constraint participants_addressing_form_check
    check (addressing_form is null or addressing_form in ('masculine', 'feminine'));

alter table public.attempts
  add column if not exists addressing_form_snapshot text;

alter table public.attempts
  drop constraint if exists attempts_addressing_form_snapshot_check,
  add constraint attempts_addressing_form_snapshot_check
    check (
      addressing_form_snapshot is null
      or addressing_form_snapshot in ('masculine', 'feminine')
    );
