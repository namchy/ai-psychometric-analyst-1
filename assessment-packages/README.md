# Assessment Packages

`assessment-packages/` stores DB-seedable test definitions in a reviewable, file-based format.

Each package folder is named by test slug, for example `ipip50-hr-v1/`.

## Expected Files

- `test.json`: core test metadata
- `dimensions.json`: dimension catalog for `public.test_dimensions`
- `items.json`: question catalog plus `question_dimension_mappings` intent and legacy fallback `questions.text`
- `options.json`: answer options plus legacy fallback `answer_options.label`
- `prompts.json`: prompt templates plus legacy fallback `prompt_versions.system_prompt` and `user_prompt_template`
- `locales/<locale>/questions.json`
- `locales/<locale>/options.json`
- `locales/<locale>/prompts.json`

Product assessment jezici su:

- `bs` = Bosanski
- `hr` = Hrvatski
- `sr` = Srpski
- `en` = Engleski

Bosanski (`bs`) je default i fallback locale.

`BHS` nije product locale. Makedonski nije dio trenutnog scope-a.

Ako se u postojećim podacima pojave BCP-47 varijante kao `bs-Latn-BA`, `hr-Latn-HR` ili
`sr-Cyrl-RS`, runtime ih normalizuje na product kodove `bs`, `hr` i `sr`.

## Prompt Bootstrap Packages

In exceptional cases a package may exist primarily to import prompt/runtime setup before the full assessment content is ready.

That pattern is allowed only as a temporary bootstrap step when all of the following are true:

- the package README explicitly says it is prompt/runtime-only
- `dimensions.json`, `items.json`, and `options.json` are intentionally empty
- localized `questions.json` and `options.json` are intentionally empty
- prompt definitions are the real target of the import

When this pattern is used, treat the package as a bootstrap artifact, not as evidence that the assessment content itself is implemented.

## Naming Conventions

- Test slug: lowercase kebab-case, stable across environments, for example `ipip50-hr-v1`
- Dimension code: uppercase snake-like short code, stable within a test, for example `EXTRAVERSION`
- Item code: package-specific short code, usually dimension prefix plus sequence, for example `E01`
- Prompt key: lowercase snake_case by report family, for example `completed_assessment_report`

## File Shapes

### `test.json`

Required fields:

- `slug`
- `name`
- `category`
- `scoring_method`
- `version`
- `status`
- `is_active`
- `intended_use`
- `report_family`
- `description`

### `dimensions.json`

Array of:

- `code`
- `name`
- `description`
- `display_order`
- `is_active`

### `items.json`

Array of:

- `code`
- `text`
- `question_type`
- `question_order`
- `is_required`
- `is_active`
- `mappings`

Each `mappings` entry contains:

- `dimension_code`
- `weight`
- `reverse_scored`

`text` remains required here as the DB fallback when no localization exists for the selected locale.

### `options.json`

Array of:

- `code`
- `label`
- `value`
- `option_order`

The current template assumes a shared option scale for all `single_choice` items in the package.

`label` remains required here as the DB fallback when no localized label exists for the selected locale.

### `prompts.json`

Array of:

- `prompt_key`
- `audience`
- `report_type`
- `source_type`
- `generator_type`
- `version`
- `is_active`
- `system_prompt`
- `user_prompt_template`
- `output_schema_json`
- `notes`

`test_id` is intentionally absent here. Package import should attach prompts to the package test when needed, or leave them global when the package declares them as global in future importer logic.

`system_prompt` and `user_prompt_template` remain required here as DB fallback values.

### `locales/<locale>/questions.json`

Array of:

- `code`
- `text`

The importer resolves each entry by `questions.code` within the package test and upserts into `public.question_localizations`.

### `locales/<locale>/options.json`

Array of:

- `option_order`
- `label`

The importer resolves each entry by shared `option_order` and upserts one localized label per concrete `answer_options` row in the package test.

### `locales/<locale>/prompts.json`

Array of:

- `prompt_key`
- `audience`
- `report_type`
- `source_type`
- `generator_type`
- `version`
- `system_prompt`
- `user_prompt_template`

The importer resolves each entry to the already-upserted `public.prompt_versions` row and then upserts into `public.prompt_version_localizations`.

## Import Expectations

This structure is designed to map to:

- `public.tests`
- `public.test_dimensions`
- `public.questions`
- `public.question_dimension_mappings`
- `public.answer_options`
- `public.prompt_versions`
- `public.question_localizations`
- `public.answer_option_localizations`
- `public.prompt_version_localizations`

## Validation Helper

Use the local validator to confirm a package has all expected files and basic JSON shapes:

```bash
node scripts/validate-assessment-package.mjs assessment-packages/ipip50-hr-v1
```

## Canonical Import Flow

The canonical import path is now:

1. Validate the package JSON shape locally.
2. Call `public.import_assessment_package(jsonb)` once with the full package payload.

`scripts/import-assessment-package.mjs` is the recommended entrypoint for local imports. It loads and validates the package, then sends a single RPC payload so the database handles the full import atomically inside one transaction.

## Local Bootstrap

After a local reset, import a package to restore reproducible content without hand-written SQL:

```bash
node scripts/validate-assessment-package.mjs assessment-packages/ipip50-hr-v1
npx supabase db reset
npm run import:assessment-package -- assessment-packages/ipip50-hr-v1
npm run check:supabase
```

The current placeholder `ipip50-hr-v1` package is bootstrap-safe for local verification only. It does not contain production psychometric content.
