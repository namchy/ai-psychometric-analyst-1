# Individual Development Profile — Product / Report Contract Spec v0.1

## 0. Status

**Status:** Product/report contract spec draft  
**Canonical report key:** `individual_development_profile_v1`  
**Audience:** HR / manager / development context  
**Primary question:** Kako raditi s ovom osobom?

This document defines the product meaning, input boundaries, output structure, usage model, and guardrails for the Individual Development Profile report.

This is a product/spec document only. It does not introduce implementation, database migrations, provider changes, renderer changes, worker changes, or report orchestration changes.

---

## 1. Purpose

The Individual Development Profile is a development-oriented HR report that explains how a person can be supported, managed, onboarded, coached, and developed based on their individual assessment battery.

It answers:

> How should HR, a manager, or a mentor work with this person so their potential is used well and predictable development risks are managed early?

It does not answer:

> Should we hire this person?

It must not be used as a standalone selection, rejection, promotion, compensation, or disciplinary decision tool.

The report should translate individual assessment signals into practical guidance for:

- onboarding
- feedback
- communication
- motivation
- role shaping
- 1:1 conversations
- development planning
- early risk prevention

---

## 2. Product position in Deep Profile

The Individual Development Profile is a separate report layer in the Deep Profile product architecture.

| Layer | Artifact | Main question | Level |
| --- | --- | --- | --- |
| Individual profile | Composite Profile | Kakva je osoba? | Individual |
| Individual development profile | Individual Development Profile | Kako raditi s ovom osobom? | Individual / development |
| Team dynamics | Team Dynamics Report | Kakav je tim? | Team |
| Candidate-team relationship | Team Fit Report | Kako se ova osoba uklapa u konkretan tim? | Candidate ↔ team |

### 2.1 Difference from Composite Profile

The Composite Profile summarizes the person’s overall individual pattern.

The Individual Development Profile translates that pattern into practical development guidance.

Composite Profile should answer:

- what the person’s profile looks like
- which broad signals are visible
- how personality, motivation, and cognitive/problem-solving signals combine

Individual Development Profile should answer:

- how to communicate with this person
- how to give feedback
- what kind of onboarding support may help
- what may motivate or drain the person
- what a manager should watch during the first 30/60/90 days
- what HR should validate in development conversations

### 2.2 Difference from Team Fit

Team Fit is relational: candidate ↔ specific team.

Individual Development Profile is individual: person ↔ development context.

The Individual Development Profile must not infer fit with a specific team unless a Team Fit report explicitly provides that relational context.

### 2.3 Difference from Team Dynamics

Team Dynamics describes a team-level pattern.

Individual Development Profile must not describe the team, diagnose team culture, or infer team-level dynamics.

---

## 3. Intended audience

### 3.1 MVP audience

MVP audience is HR / manager / development owner.

This report is primarily an HR-facing working document.

It may be used in:

- onboarding planning
- manager preparation
- coaching conversation preparation
- development planning
- internal mobility discussion
- role support discussion
- mentoring setup

### 3.2 Candidate-facing boundary

A candidate-facing version may be created later, but it is out of scope for v0.1.

Reason: candidate-facing development feedback requires different copy, a more reflective tone, fewer HR-operational recommendations, and stricter phrasing around risks.

For v0.1, this report should be treated as HR-facing only.

---

## 4. Input sources

The report uses only individual-level assessment sources.

MVP input sources:

- IPIP / personality signals
- SAFRAN / cognitive problem-solving signals
- MWMS / motivation signals
- existing deterministic composite input or equivalent individual battery summary

Future optional input sources:

- Team Style & Collaboration, if implemented later as a valid individual module
- role context, if a controlled role-context model is introduced later
- manager-provided context, if explicit, structured, and separated from psychometric signals

### 4.1 Required input principle

The report should be generated from reduced, HR-safe deterministic input signals.

It should not use raw answers as default input.

It should not use full upstream snapshots as direct narrative input.

It should not rely on AI-generated Composite Profile narrative as the primary source if deterministic source signals are available.

---

## 5. Output contract

Canonical report key:

```text
individual_development_profile_v1
```

Suggested top-level report snapshot shape:

```json
{
  "reportType": "individual_development_profile_v1",
  "reportVersion": "v1",
  "locale": "bs",
  "audience": "hr",
  "developmentSummary": {},
  "contributionPattern": {},
  "developmentRisks": [],
  "communicationAndFeedbackGuidance": {},
  "motivationAndEnergyGuidance": {},
  "oneOnOneGuidance": [],
  "onboardingPlan": {},
  "managerWatchpoints": [],
  "interpretationLimits": [],
  "metadata": {}
}
```

---

## 6. Required report sections

### 6.1 Development summary

Purpose: short executive development summary.

Should include:

- overall working/development pattern
- strongest practical contribution signals
- main support need or watchpoint
- short note on how the report should be used

Must be written as a working hypothesis, not a final judgment.

It must not sound like:

- a diagnosis
- a final identity label
- a performance prediction
- a hiring recommendation

### 6.2 How this person may contribute best

Purpose: identify working conditions and contribution patterns where the person is more likely to do well.

Should include:

- task conditions where the person may contribute well
- collaboration conditions that may support performance
- type of clarity, autonomy, structure, feedback, or challenge that may help
- practical role-shaping implications

Allowed phrasing:

- “may contribute best when...”
- “is likely to benefit from...”
- “HR/manager should test whether...”
- “this signal suggests a possible preference for...”

Forbidden phrasing:

- “will perform best when...”
- “can only work when...”
- “must be placed in...”
- “is not suitable for...”

### 6.3 What may block development

Purpose: identify possible development blockers and risks that HR/manager should monitor.

Should include:

- ambiguity risks
- feedback risks
- motivation risks
- overload risks
- collaboration risks
- communication risks
- role-fit risks without making role-fit decisions

Must be framed as hypotheses to validate.

Good pattern:

```text
Possible blocker:
Why it matters:
What to check:
How to support:
```

Must not include:

- pathology language
- blame
- fixed labels
- “red flag” language unless carefully controlled and non-diagnostic
- “bad fit” conclusions

### 6.4 Communication and feedback guidance

Purpose: provide practical manager/HR guidance for communication.

Should include:

- how to give feedback
- what kind of clarity helps
- what to avoid in communication
- how to structure expectations
- how to discuss difficult topics

Suggested structure:

```text
What helps:
What to avoid:
How to phrase feedback:
What to clarify:
```

This section should be practical and specific, not generic.

### 6.5 Motivation and energy guidance

Purpose: translate MWMS/motivation signals into development support.

Should include:

- likely sources of energy
- likely sources of drain
- how to connect work to motivation
- what kind of recognition or autonomy may matter
- what HR/manager should validate in conversation

Must not reduce motivation to one simplistic label.

Must not imply that motivation is fixed.

### 6.6 1:1 conversation guidance

Purpose: give HR/manager concrete questions for development conversations.

Each guidance item should include:

```text
Question:
What to listen for:
Signal being checked:
Possible follow-up:
```

Questions should be usable in:

- onboarding conversation
- probation period check-in
- development conversation
- manager 1:1

Questions must not be manipulative, leading, or framed as psychological interrogation.

### 6.7 Onboarding plan

Purpose: provide a practical 7 / 30 / 60 / 90 day development support frame.

Product decision:

- onboarding plan is part of the Individual Development Profile
- the base onboarding plan does not depend on Team Fit
- Team Fit may later enrich the plan with team-context guidance, but it is not a gatekeeper
- MVP should not introduce a separate onboarding report lane

Suggested structure:

```json
{
  "summary": "string",
  "first7Days": {
    "focus": "string",
    "managerActions": ["string"],
    "feedbackGuidance": ["string"],
    "riskSignals": ["string"]
  },
  "first30Days": {
    "focus": "string",
    "managerActions": ["string"],
    "feedbackGuidance": ["string"],
    "riskSignals": ["string"]
  },
  "days31To60": {
    "focus": "string",
    "managerActions": ["string"],
    "feedbackGuidance": ["string"],
    "riskSignals": ["string"]
  },
  "days61To90": {
    "focus": "string",
    "managerActions": ["string"],
    "feedbackGuidance": ["string"],
    "riskSignals": ["string"]
  },
  "managerCheckpoints": ["string"],
  "watchouts": ["string"]
}
```

#### First 7 days

- clarify success conditions
- explain support rhythm
- surface early uncertainty fast
- set the tone for feedback and escalation

#### First 30 days

- identify support needs
- observe early working pattern
- validate communication and motivation hypotheses
- reinforce a useful feedback rhythm

#### Days 31–60

- expand responsibility
- test autonomy/structure balance
- observe collaboration pattern
- review what kind of support remains useful

#### Days 61–90

- consolidate role ownership
- discuss development priorities
- review watchpoints
- adjust support model

The plan should be tailored to the input signals, not generic onboarding boilerplate.
It must remain HR/manager-facing, not candidate-facing.

### 6.8 Manager watchpoints

Purpose: identify early signals that a manager should monitor.

Each watchpoint should include:

```text
Watchpoint:
Why it matters:
Early signal:
Suggested manager response:
```

Watchpoints should be framed as support signals, not warnings against the person.

Forbidden:

- “do not hire”
- “poor performer”
- “not suitable”
- “high-risk employee”
- “difficult personality”

### 6.9 Interpretation limits

Required section.

Must include:

- report is not a diagnosis
- report is not a hiring decision
- report is not a performance prediction
- report should be interpreted with interviews, work context, and other evidence
- report reflects available assessment signals, not the whole person
- report should not be used to label or limit the person
- source limitations should be visible when some inputs are missing or partial

---

## 7. Writing rules

### 7.1 Tone

Report tone should be:

- HR-operational
- development-oriented
- cautious
- specific
- practical
- non-judgmental

Report tone should not be:

- clinical
- motivational fluff
- deterministic
- punitive
- overly soft
- generic
- “personality fortune-telling”

### 7.2 Language

MVP locale is Bosnian.

Schema keys should remain language-neutral, preferably English.

Human-facing content should be in the report locale.

For Bosnian output:

- use professional, natural BHS phrasing
- avoid awkward literal translations
- avoid overusing English HR jargon
- avoid candidate-facing “ti” if report is HR-facing
- avoid gendered assumptions where not necessary

---

## 8. Hard guardrails

The report must not include:

- hire/no-hire recommendation
- numeric fit score
- ranking of candidates
- diagnosis
- mental health inference
- protected/sensitive attribute inference
- performance prediction as a fact
- claim that the report objectively predicts success
- claim that the person is good/bad
- “bad fit” conclusion
- team-level diagnosis
- Team Fit conclusion
- raw answers by default
- raw item text by default
- hidden scoring key by default
- individual comparison against named team members
- disciplinary recommendation
- compensation recommendation
- promotion/rejection decision

---

## 9. HR usage model

Recommended HR usage:

1. Prepare onboarding support.
2. Prepare manager guidance.
3. Shape early feedback rhythm.
4. Design first 30/60/90-day development focus.
5. Prepare structured development conversation.
6. Identify hypotheses to validate during interview, onboarding, or probation.
7. Combine with interview notes, role requirements, and observed behavior.

Not recommended:

1. Making standalone hiring decisions.
2. Ranking candidates.
3. Rejecting candidates based on development watchpoints.
4. Labeling the person.
5. Sharing raw interpretations without context.
6. Treating the report as a diagnosis or prediction.

---

## 10. Candidate-facing boundary

Candidate-facing version is out of scope for v0.1.

If added later, it should be a separate report or separate renderer/copy layer.

Candidate-facing version should:

- use reflective language
- avoid HR-operational risk phrasing
- avoid manager-only advice
- focus on self-awareness and growth
- avoid selection implications
- use direct but respectful “ti” form if consistent with product language

Candidate-facing version should not simply expose the HR report.

---

## 11. Relationship to future Team Style & Collaboration module

If `team_style_collaboration_v1` is implemented later, it may become an additional source signal for the Individual Development Profile.

It should not be treated as a current dependency.

Current v0.1 should work from existing individual assessment battery signals:

- IPIP
- SAFRAN
- MWMS
- deterministic composite input or equivalent reduced individual summary

---

## 12. Relationship to Team Fit

The Individual Development Profile may later provide reduced candidate-side development signals to Team Fit, but it is not required for Team Fit MVP.

Team Fit should remain a separate relational report.

Individual Development Profile should not include candidate-team fit conclusions unless explicitly generated through Team Fit.

---

## 13. Out of scope for v0.1

Out of scope:

- implementation code
- DB schema/migration
- renderer
- OpenAI provider
- prompt implementation
- worker/scheduler/cron
- report generation actions
- report recovery actions
- candidate-facing report
- Team Fit changes
- Team Dynamics changes
- Team Style & Collaboration implementation
- new assessment items
- new Likert/SJT design
- norming
- validation study
- role-context engine
- GitHub Issues/Projects sync

---

## 14. Future implementation slices

Potential future slices, in order:

1. Product/spec approval and todo sync.
2. Input snapshot builder spec.
3. Report JSON contract and runtime validator.
4. Mock provider.
5. HR-only renderer shell.
6. Read-only route/display helper.
7. OpenAI provider behind explicit provider seam.
8. DB-backed lifecycle smoke.
9. HR browser review.
10. Copy/renderer polish.
11. Candidate-facing version, only if explicitly approved later.

---

## 15. Acceptance criteria for this spec

This spec is acceptable when it clearly defines:

- report purpose
- product position
- audience
- input sources
- output sections
- HR usage model
- candidate-facing boundary
- writing rules
- guardrails
- relationship to Composite Profile, Team Fit, Team Dynamics, and future Team Style & Collaboration
- out-of-scope boundaries
- future implementation slices

No code should be implemented as part of this spec task.
