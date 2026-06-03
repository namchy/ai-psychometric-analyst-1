---
name: deep-profile-report-design-taste
description: Use this skill when modifying Deep Profile report UI, HR report renderers, participant report renderers, composite report layout, report copy, report cards, evidence displays, or BHS report language. Apply it before making visual or copy changes to reports.
---

# Deep Profile Report Design Taste

## Kada koristiti ovaj skill
- Composite HR report renderer
- Participant report renderer
- HR single-test report renderer
- Report layout/readability tasks
- Evidence/chip display
- Report summary sections
- BHS report copy
- Dashboard report detail pages
- Svaki task u kojem korisnik kaže da report izgleda ružno, nečitljivo, konfuzno, preširoko, generički ili tehnički

## Osnovni princip
Report nije članak i nije debug dump.
HR korisnik mora moći brzo skenirati:
- glavni signal
- tačku opreza
- šta provjeriti u intervjuu
- kako koristiti nalaz u radu
- iz kojih procjena dolaze dokazi

## Zabranjeni obrasci layouta
- Ne renderovati duge paragrafe preko pune širine kartice.
- Ne praviti “wide text blanket”.
- Ne dodavati pillove, badgeve ili mini-kartice koje ne nose novu informaciju.
- Ne koristiti šarene dekorativne pillove u reportima.
- Ne praviti tehnički metadata blok kao glavni korisnički sadržaj.
- Ne prikazivati “Način generisanja: AI interpretacija” u glavnom tijelu reporta.
- Ne koristiti evidence chipove kao jedan dugi neorganizovani red.
- Ne ostavljati sadržaj zalijepljen za lijevu stranu bez grid balansa.
- Ne koristiti premali font za ključne dokaze.
- Ne uvoditi nove vizuelne elemente bez jasne informacijske funkcije.

## Preferirani layout obrasci
- Dugi summary razlomiti u strukturirane blokove:
  - Glavni signal
  - Tačka opreza
  - Kako koristiti nalaz
- Integrisani signal renderovati kao insight karticu:
  - naslov signala
  - dvije susjedne kartice na desktopu:
    - Šta ovo znači u radu
    - Šta HR treba provjeriti
  - evidence blok ispod:
    - Dokazi iz procjena
    - grupisano po izvoru: Ličnost, Kognitivni rezultat, Motivacija
- Na mobile sve slagati vertikalno.
- Kartice treba da imaju dovoljno paddinga, neutralnu pozadinu, suptilan border i miran shadow ako već postoji u sistemu.
- Tekst mora imati dobar line-height i ograničenu čitljivu širinu.
- Široka kartica je dozvoljena; širok paragraf nije.
- Evidence treba izgledati kao provjerljiv trag, ne kao fusnota ili debug output.

## BHS product jezik
Ne koristiti:
- saradljiv
- ponašajni
- procjenski
- procjenskog
- AI interpretacija u glavnom report tijelu
- Način generisanja kao glavni metadata box
- zaposliti / ne zaposliti kao odluku reporta
- idealni kandidat
- fit score
- konačna odluka

Preferirati:
- spreman na saradnju
- saradnička orijentacija
- kooperativan
- otvoren za saradnju
- sklon saradnji
- obrasci ponašanja
- radni stil
- način funkcionisanja
- procjena
- izvještaj
- HR pregled
- tačke opreza
- teme za intervju
- menadžerske smjernice

## Pravila za HR korisnost
Svaki važan uvid treba odgovoriti barem na jedno od ovih pitanja:
- Šta ovo znači u radu?
- Šta HR treba provjeriti?
- Kako se ovo može vidjeti u timu?
- Koji su dokazi iz procjena?
- Šta menadžer treba znati u onboarding fazi?

Ako element ne odgovara ni na jedno pitanje, vjerovatno je dekoracija i treba ga ukloniti.

## Pravila za evidence
- Grupisati evidence po izvoru/testu.
- Koristiti korisničke nazive:
  - Ličnost
  - Kognitivni rezultat
  - Motivacija
- Ne prikazivati sirove tehničke nazive ako postoji bolji display label.
- Ako se prikazuje score, mora biti jasno i kratko.
- Evidence ne smije preuzeti glavnu vizuelnu pažnju od interpretacije.

## Pravila za metadata sekcije
Metadata sekcija treba biti kratka.
Dozvoljeno:
- Ciklus procjene
- Obuhvat
- Datum izvještaja

Izbjegavati:
- Način generisanja
- tehnički provider/model detalje
- objašnjenja koja ne pomažu HR korisniku
- dekorativne mini-kartice koje samo ponavljaju kategorije

## Prije izmjene report UI-a
Codex mora:
1. Identifikovati korisnički problem:
   - čitljivost
   - hijerarhija
   - jezik
   - evidence
   - metadata
   - spacing
2. Predložiti konkretan layout pattern.
3. Implementirati minimalno.
4. Dodati ili ažurirati testove koji hvataju:
   - zabranjene riječi
   - ključne labele
   - uklonjene tehničke fraze
   - prisustvo nove strukture

## Nakon izmjene
Codex mora u summaryju navesti:
- šta je promijenjeno u layoutu
- šta je uklonjeno
- kako je poboljšana čitljivost
- koje zabranjene riječi/fraze se više ne prikazuju
- koji testovi su pokrenuti
- šta nije dirano
