\# AGENTS.md



\## Project purpose

This repository is an MVP for a B2B candidate assessment platform.

The product will support structured assessments such as Big Five, DISC-like behavioral tests, and cognitive tests.

The current phase focuses only on the first Big Five MVP slice.



\## Current stack

\- Next.js

\- TypeScript

\- Supabase

\- Local Supabase for development

\- Vercel-ready deployment later



\## Current database reality

The local database already has:

\- tests

\- questions

\- answer\_options

\- attempts

\- responses

\- dimension\_scores



RLS is enabled.

Public read access is intended only for:

\- tests

\- questions

\- answer\_options



Write operations for attempts, responses, and dimension\_scores should be implemented server-side, not directly from the browser.



\## Engineering rules

\- Use App Router.

\- Use TypeScript.

\- Keep implementation simple and MVP-friendly.

\- Do not add dependencies unless clearly necessary.

\- Do not refactor unrelated code.

\- Do not hardcode test questions in React components.

\- Treat Supabase as the source of truth for runtime data.

\- Respect existing RLS rules.

\- Never expose secret keys in client-side code.

\- Prefer server-side data fetching when reasonable.

\- Prefer narrow, reviewable diffs.



\## Product constraints

\- No AI-generated report in the current phase.

\- No hiring recommendation logic.

\- No psychometric over-engineering yet.

\- Focus on one working vertical slice at a time.



\## Task priorities right now

1\. Read active test from Supabase

2\. Render questions and answer options

3\. Add server-side submission flow

4\. Add scoring logic

5\. Add AI reporting later



\## Validation

Before finishing any task:

\- run relevant validation commands

\- report what was changed

\- report assumptions

\- report remaining next step



\## Communication style

\- Be concise

\- State assumptions clearly

\- Keep changes easy to review

