# AGENTS.md

## Project purpose

Deep Profile is a B2B people-intelligence and decision-support platform for structured individual and team assessments, evidence-based HR reports, development guidance, team dynamics, and candidate-versus-team analysis.

The repository is well beyond the original single-assessment MVP. Do not assume that the current scope is Big Five only, that AI reporting is deferred, or that the early MVP architecture is still authoritative.

Deep Profile supports professional judgement. It must not present an assessment as a diagnosis, a numeric measure of human value, or an automatic hire/no-hire decision.

## Sources of truth

Keep these authorities separate:

1. **Current explicit user instruction** defines the immediate task, scope, and newly made product decisions.
2. **`docs/deep-profile-todo.md`** is the canonical stabilized backlog, current priority register, and decision log.
3. **Code, migrations, tests, persisted artifacts, and reviewed read-only runtime inspection** define implemented reality.
4. **Relevant preflight, contract, design, and architecture documents** define constraints for their workstream.

Rules:

- For todo, backlog, priorities, handover, status, or continuation work, read `docs/deep-profile-todo.md` first.
- A new explicit user decision may supersede the current todo. Record the accepted decision in the todo during closeout when it changes stabilized scope, order, or architecture.
- Do not let old chat memory, historical todo entries, superseded prompts, or abandoned architecture override the current instruction and canonical documents.
- Never report planned, hidden, uncommitted, unverified, queued, or partially executed work as completed.
- Do not infer runtime truth only from documentation. Inspect the relevant code, migration, test, or read-only runtime evidence.
- Historical notes remain evidence, not current instructions, when a newer canonical status explicitly supersedes them.

## Before changing code

For every non-trivial task:

1. Confirm repository, branch, `HEAD`, and working-tree state.
2. Read the relevant section of `docs/deep-profile-todo.md`.
3. Trace the real path end to end before editing: entrypoint, callers, shared helpers, contracts, persistence, renderer, and tests as applicable.
4. Read the workstream-specific documents and skills.
5. Identify the smallest controlled slice that produces a verifiable result.

Additional requirements:

- For UI tasks, read `docs/deep-profile-ui-system.md` before implementation.
- For report UI, report layout, report copy, evidence display, or BHS report-language tasks, use the repo skill `deep-profile-report-design-taste`.
- Do not ask the user for information that is already available in the repository, connected source, current conversation, or canonical documentation.

## Engineering approach

- Use Next.js App Router and TypeScript.
- Treat Supabase as the runtime source of truth for persisted application data.
- Prefer a small root-cause fix over repeated symptom patches.
- Reuse an existing helper, contract, pattern, native platform feature, standard library, or installed dependency before adding another implementation.
- Do not add a dependency unless the current task proves it is necessary.
- Do not add speculative abstractions, parallel frameworks, scaffolding for hypothetical future work, or configuration for values that are not variable.
- Do not refactor unrelated code.
- Prefer narrow, reviewable diffs and the fewest files that correctly solve the problem.
- Minimal code must not mean weaker validation, security, provenance, migration safety, accessibility, or test coverage.
- Fix shared behavior at the shared boundary after inspecting all callers.
- Do not edit generated code, vendored code, or `node_modules`.
- Do not hardcode assessment questions, scoring rules, prompt content, or report data inside React components when a canonical runtime or contract source exists.

## Architecture and versioning

- Current canonical prompts, contracts, schemas, identities, and report versions are authoritative.
- Never return to an old prompt or abandoned architecture as a fallback unless the user explicitly reactivates it.
- Preserve existing supported V1 or legacy paths while adding V2 paths unless the task explicitly authorizes migration or removal.
- Keep report type and report version paired through the canonical identity contract.
- Do not silently reuse one report version's lifecycle, schema, renderer, or persistence assumptions for another version.
- Separate prompt, schema, provider, lifecycle, persistence, renderer, and migration changes unless a demonstrated end-to-end requirement makes the combined change necessary.
- A broad architectural change requires a demonstrated blocker, security issue, incorrect result, or clear product decision. Do not open architecture work merely because it is cleaner in theory.

## Database, security, and runtime writes

- Respect existing RLS policies and server-side trust boundaries.
- Keep service-role and secret credentials out of client-side code and user-visible output.
- Browser code must not directly perform privileged writes that belong on a server, worker, RPC, or controlled operator path.
- Treat destructive writes, security or ACL changes, production scoring, remote migrations, report replacement, and hard-to-reverse operations as gated work requiring explicit authorization in the current task.
- Separate read-only inspection, write planning, apply, and post-write verification.
- A read-only task must remain read-only. Do not perform a database write, migration apply, queue mutation, report regeneration, or OpenAI call unless the task explicitly permits it.
- Migrations and controlled writers must be replay-safe, idempotent where appropriate, narrowly scoped, and explicit about preconditions and postconditions.
- Preserve provenance, lineage, source identity, report identity, checksums, evidence references, and audit-relevant metadata.
- Fail closed on mixed identity, ambiguous lineage, contract mismatch, unexpected partial state, or unsafe target resolution.
- Do not overwrite a ready report or accepted snapshot through an ad hoc path. Use an explicitly approved versioned regeneration or replacement flow.
- After any authorized write, run a read-only verification and report exact observed state.

## Assessment and scoring integrity

- Deterministic scoring remains deterministic. Do not replace scoring with AI interpretation.
- Preserve canonical assessment identities, question codes, option codes, dimensions, bands, reverse scoring, completion rules, and source-test lineage.
- Validate exact counts and exact identity when the contract requires them; do not weaken an exact-match invariant into a loose existence check.
- Keep candidate, participant, organization, team, assessment, attempt, score, aggregation, and report identities unambiguous.
- Team-level output must not expose individual member results or names unless the report contract and product decision explicitly allow it.

## AI report doctrine

- The large AI provider authors report interpretation within the prompt, evidence, and schema contract.
- The production application enforces structural, source, data, evidence, lineage, privacy, and contract integrity.
- The application must not silently become a prose-quality judge through brittle heuristics.
- The renderer presents the accepted interpretation faithfully. It may improve layout and display labels, but it must not rewrite the semantic meaning of AI findings.
- Reports should provide the most useful and honest assessment supported by the data: direct without brutality, evaluative without passing judgement, and cautious without becoming paralyzed.
- Distinguish evidence, interpretation, assessment, recommendation, and limitation.
- Do not produce numeric or percentage fit scores, candidate rankings, diagnoses, unsupported certainty, or automatic hire/no-hire conclusions.
- Evidence-backed qualitative conclusions are allowed where the relevant report contract permits them.
- Respect ownership boundaries among single-test reports, Composite Profile, IDP, Team Dynamics, and Team Fit. Do not duplicate another report's canonical responsibility.
- Do not reopen an accepted prompt, schema, or report-content task without a new concrete defect, evidence gap, product decision, or failed acceptance criterion.

## UI and report presentation

- Follow `docs/deep-profile-ui-system.md` for reusable UI patterns, semantic colors, layout, report surfaces, navigation, and accessibility expectations.
- If the UI system already covers an element, reuse it instead of inventing another pattern.
- If the system does not cover a necessary pattern, report the deviation explicitly rather than quietly creating a parallel design language.
- Preserve semantic headings, logical reading order, adequate contrast, keyboard usability, responsive behavior, and readable text width.
- Do not rely on color alone to communicate status or risk.
- Report UI changes must not alter scoring meaning, evidence mapping, report schema, provenance, or AI-authored semantics unless the task explicitly includes those changes.

## Testing and validation

Before declaring a task complete:

- Run the smallest relevant focused tests that can fail for the changed behavior.
- Add or update targeted regression tests for non-trivial logic, contracts, trust boundaries, identity checks, and corrected defects.
- Run `npm run typecheck` for TypeScript changes unless the task is strictly documentation-only.
- Run `git diff --check`.
- Run build, browser, database, migration, or OpenAI validation only when relevant and authorized.
- For UI or report acceptance, inspect the real browser path when the definition of done requires rendered behavior.
- Do not delete, skip, loosen, or rewrite a test merely to obtain a pass.
- Do not claim a command passed unless it was actually run and completed successfully.
- When a test failure appears pre-existing, prove that distinction against the untouched baseline or documented prior state.
- Keep validation proportional to risk: narrow for documentation or isolated display changes, strict for persistence, scoring, security, contracts, migrations, and production paths.

## Documentation and closeout

- Update `docs/deep-profile-todo.md` only with confirmed facts, accepted decisions, verified results, real blockers, and the actual next step.
- Do not mark a task completed before implementation and required verification are complete.
- Preserve useful historical evidence, but clearly mark superseded status so it cannot be mistaken for a current instruction.
- Do not create a second canonical backlog or move canonical status into GitHub Issues, Projects, chat memory, or ad hoc documents unless the user explicitly changes the workflow.

At task completion, report:

- what changed and why;
- what was deliberately not changed;
- files affected;
- tests and validation commands run, with results;
- whether any database write, migration, queue mutation, report regeneration, or OpenAI call occurred;
- current git status and commit SHA if a commit was requested and created;
- remaining blocker or the single highest-value next step.

Do not commit or push unless the task explicitly requests it. When a commit is requested, include only the scoped files after validation.

## Communication

- Communicate with the user in Bosnian, Latin script, ijekavian standard, unless the user explicitly requests another language.
- Be concise, precise, and operational.
- Separate confirmed facts from assumptions and recommendations.
- Surface blockers early.
- Do not bury the requested result under a long process narrative.
