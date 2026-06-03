# Team Dynamics Assessment v1 Content Spec

This package stores the locked Deep Profile content/spec for `team_dynamics_assessment_v1`.

It is the canonical final-user instrument content layer for:

- `tdm-31-V1`
- `psychological_safety`
- `situational_judgment`
- `outcome_pulse`

Important technical note:

- The current generic assessment package importer assumes one shared `options.json` catalog for the whole package.
- `team_dynamics_assessment_v1` uses mixed response formats: shared Likert blocks plus per-scenario SJT options.
- To avoid seeding incorrect answer options into the database, this package keeps the canonical mixed-format content in `content-spec.json` and item metadata.
- Root `options.json` and localized options catalogs are intentionally empty until the package/import/runtime layer supports mixed per-block option catalogs.

Treat this package as content-spec ready, not as a claim that mixed-format runtime execution, scoring or report rendering is already implemented.
