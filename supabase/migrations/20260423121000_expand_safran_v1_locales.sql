alter table public.question_localizations
  drop constraint if exists question_localizations_locale_check,
  add constraint question_localizations_locale_check
    check (locale in ('bs', 'hr', 'en', 'sr'));

alter table public.answer_option_localizations
  drop constraint if exists answer_option_localizations_locale_check,
  add constraint answer_option_localizations_locale_check
    check (locale in ('bs', 'hr', 'en', 'sr'));
