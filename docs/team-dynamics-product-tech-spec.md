# Team Dynamics Product/Tech Spec v0.1

## Status

- Status: Spec spreman (v0.1)
- Namjena: canonical dokument za Team Dynamics product/tech scope prije implementacije
- Scope ovog dokumenta: produktne i tehničke odluke za prvi MVP slice, bez implementacije koda

## Kontekst i cilj

Team Dynamics uvodi timski modul koji mjeri dinamiku tima kroz agregirani pristup. Cilj nije evaluacija pojedinca unutar tima, nego opis tima kao sistema i operativni uvid za HR/lidera.

## Zaključane user-facing odluke

- Naziv modula: `Timovi`
- Naziv assessmenta: `Procjena timske dinamike`
- Naziv reporta: `Timska dinamika`
- Arhitekturni tip reporta: agregirani report
- Predloženi slug: `team_dynamics_v1_strong`

## Zaključani sadržaj baterije

Team Dynamics Battery v1 strong ima 4 skale:

- PCS (Perceived Cohesion Scale)
- Jehn ICS-8 (Intragroup Conflict Scale)
- TPS-7 (Team Psychological Safety)
- Lewis TMS (Transactive Memory System)

Target item count: 36.

## Granice interpretacije i prikaza

- Nema overall team score-a.
- Report ostaje profil po domenima/signals, ne jedinstveni total.
- Individualni rezultati članova tima se ne prikazuju HR-u/lideru.
- AI dobija samo agregirane determinističke podatke.
- AI ne dobija individualne odgovore članova.

## Pragovi za dostupnost reporta

- 0-2 validna odgovora: `blocked` (report nedostupan)
- 3-4 validna odgovora: `indicative` (interni state, nije full user-facing)
- 5+ validnih odgovora: full user-facing report

## v0.1 role model

- Lider se tretira kao team member u v0.1.
- Role se čuva u membership sloju.
- Nema leader-vs-team delta izlaza u v0.1.

## Mock package i scoring odluka

- Prvi mock package koristi unified 1-5 response skalu.
- Scoring engine mora ostati metadata-aware za per-item/per-scale skale.
- DB category note (MVP): package category koristi `behavioral` kao DB-compatible storage fallback jer trenutni `public.tests.category` constraint podržava samo personality/behavioral/cognitive. Ovo ne mijenja canonical semantiku: Team Dynamics ostaje team assessment identifikovan slug-om `team_dynamics_v1_strong`, `intended_use: "team_assessment"` i `report_family: "team_dynamics"`.

## Licenca i sadržaj itema

- Stvarni licencirani itemi ne ulaze u produkcijski repo dok pravni i jezički tok nisu zaključani.
- U scaffold/mock fazi dozvoljeni su samo placeholder itemi.

## Prvi implementation task (nakon ovog spec sync-a)

Task: `Create Team Dynamics data model scaffold and placeholder package support`

Task mora ostati uzak:

- team-specific data model scaffold
- placeholder package support
- minimalni schema/package testovi

Task eksplicitno ne uključuje:

- stvarne licencirane iteme
- finalni scoring/agregaciju
- AI providera
- renderere
- relacijski kandidat-tim fit report
- DUTCH implementaciju

## Preporučeni redoslijed

1. Završiti dokumentacioni sync ovog speca u repou.
2. Otvoriti i realizovati prvi uski implementation task iznad.
