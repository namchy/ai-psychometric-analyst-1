const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

const candidateReportsPageSource = fs.readFileSync(
  path.join(projectRoot, "app/(protected)/dashboard/participants/[participantId]/reports/page.tsx"),
  "utf8",
);
const dashboardPrimitivesSource = fs.readFileSync(
  path.join(projectRoot, "components/dashboard/primitives.tsx"),
  "utf8",
);
const teamFitReportListSource = fs.readFileSync(
  path.join(projectRoot, "components/dashboard/team-fit-report-list.tsx"),
  "utf8",
);
const hrCandidateAssessmentSource = fs.readFileSync(
  path.join(projectRoot, "lib/dashboard/hr-candidate-assessment.ts"),
  "utf8",
);
const individualDevelopmentProfileReportListSource = fs.readFileSync(
  path.join(
    projectRoot,
    "components/dashboard/individual-development-profile-report-list.tsx",
  ),
  "utf8",
);

assert.equal(
  candidateReportsPageSource.includes('data-ui="participant-reports-page"'),
  true,
  "Expected participant reports page to expose a stable page owner target.",
);
assert.equal(
  candidateReportsPageSource.includes('data-ui="candidate-report-hero"'),
  true,
  "Expected participant reports page to expose a stable candidate hero target.",
);
for (const reportFamily of ["individual", "composite", "idp", "team-fit"]) {
  assert.equal(
    candidateReportsPageSource.includes(`data-report-family="${reportFamily}"`),
    true,
    `Expected participant reports page to expose the ${reportFamily} report group target.`,
  );
}
assert.equal(
  candidateReportsPageSource.includes('data-ui="report-group"'),
  true,
  "Expected participant reports page sections to expose stable report group targets.",
);
assert.equal(
  candidateReportsPageSource.includes('data-ui="report-card"'),
  true,
  "Expected participant reports page cards to expose stable report card targets.",
);
for (const reportType of ["ipip", "safran", "mwms"]) {
  assert.equal(
    candidateReportsPageSource.includes(`return "${reportType}";`),
    true,
    `Expected participant reports page to map its existing slug to the ${reportType} report type target.`,
  );
}
assert.equal(
  candidateReportsPageSource.includes('data-report-type="composite"'),
  true,
  "Expected composite card to expose the composite report type target.",
);
assert.equal(
  candidateReportsPageSource.includes("data-report-status={card.state}"),
  true,
  "Expected individual report cards to expose their existing canonical state.",
);
assert.equal(
  candidateReportsPageSource.includes("data-report-status={model.compositeCard.state}"),
  true,
  "Expected composite report card to expose its existing canonical state.",
);
assert.equal(
  candidateReportsPageSource.includes('data-ui="report-state-message"'),
  true,
  "Expected participant report card status copy to expose a stable state message target.",
);
assert.equal(
  teamFitReportListSource.includes('data-ui="report-card"'),
  true,
  "Expected Team Fit cards to expose stable report card targets.",
);
assert.equal(
  teamFitReportListSource.includes('data-report-type="team-fit"'),
  true,
  "Expected Team Fit cards to expose the Team Fit report type target.",
);
assert.equal(
  teamFitReportListSource.includes("data-report-status={entry.status}"),
  true,
  "Expected Team Fit cards to expose their existing canonical status.",
);
assert.equal(
  teamFitReportListSource.includes('data-ui="report-state-message"'),
  true,
  "Expected Team Fit status copy to expose a stable state message target.",
);
assert.equal(
  individualDevelopmentProfileReportListSource.includes('data-ui="report-card"'),
  true,
  "Expected IDP cards to expose stable report card targets.",
);
assert.equal(
  individualDevelopmentProfileReportListSource.includes('data-report-type="idp"'),
  true,
  "Expected IDP cards to expose the IDP report type target.",
);
assert.equal(
  individualDevelopmentProfileReportListSource.includes(
    "data-report-status={entry.status}",
  ),
  true,
  "Expected IDP cards to expose their existing canonical status.",
);
assert.equal(
  individualDevelopmentProfileReportListSource.includes(
    'data-ui="report-state-message"',
  ),
  true,
  "Expected IDP status copy to expose a stable state message target.",
);
assert.equal(
  [
    candidateReportsPageSource,
    teamFitReportListSource,
    individualDevelopmentProfileReportListSource,
  ].some((source) => source.includes("data-card-variant")),
  false,
  "Expected semantic targeting foundation not to introduce data-card-variant.",
);

assert.equal(
  candidateReportsPageSource.includes("DpPageHeader"),
  true,
  "Expected HR participant detail page to use the shared DP page header wrapper.",
);
assert.equal(
  candidateReportsPageSource.includes('className="-mt-10 pb-12"'),
  true,
  "Expected HR participant detail page to use the localized negative top margin that tightens header spacing.",
);
assert.equal(
  candidateReportsPageSource.includes('backLabel="Nazad na HR dashboard"'),
  true,
  "Expected HR participant detail page to use the simple HR dashboard back label.",
);
assert.equal(
  candidateReportsPageSource.includes('backHref="/dashboard"'),
  true,
  "Expected HR participant detail page to point the shared header back action to the HR dashboard.",
);
assert.equal(
  candidateReportsPageSource.includes('backLabel="Dashboard"'),
  false,
  "Expected HR participant detail page to remove the breadcrumb Dashboard label.",
);
assert.equal(
  candidateReportsPageSource.includes('breadcrumbMiddleLabel={model.participant.full_name}'),
  false,
  "Expected HR participant detail page to remove the participant breadcrumb segment.",
);
assert.equal(
  candidateReportsPageSource.includes('breadcrumbCurrentLabel="HR procjena"'),
  false,
  "Expected HR participant detail page to remove the breadcrumb current segment.",
);
assert.equal(
  candidateReportsPageSource.includes('contextLabel="HR procjena kandidata"'),
  false,
  "Expected HR participant detail page to remove the redundant right-hand context label.",
);
assert.equal(
  candidateReportsPageSource.includes("Sažetak procjene"),
  false,
  "Expected HR participant detail page to remove the redundant summary block below the hero.",
);
assert.equal(
  candidateReportsPageSource.includes('from "@/lib/dashboard/hr-ui-format"'),
  true,
  "Expected HR participant detail page to use the shared HR metadata formatting helper.",
);
assert.equal(
  candidateReportsPageSource.includes("Attempt:"),
  false,
  "Expected HR participant detail page to remove the raw Attempt label.",
);
assert.equal(
  candidateReportsPageSource.includes("Status testa:"),
  false,
  "Expected HR participant detail page to remove the raw test status label.",
);
assert.equal(
  candidateReportsPageSource.includes('label="Status procjene"'),
  true,
  "Expected HR participant detail page to label the lifecycle as assessment status.",
);
assert.equal(
  candidateReportsPageSource.includes('label="Završeno"'),
  true,
  "Expected HR participant detail page to label completion metadata with the localized past-tense label.",
);
assert.equal(
  candidateReportsPageSource.includes('label="ID procjene"'),
  false,
  "Expected participant reports page to remove the technical assessment id label from report cards.",
);
assert.equal(
  candidateReportsPageSource.includes("Interni skraćeni identifikator"),
  false,
  "Expected participant reports page to remove the technical shortened-id helper copy from report cards.",
);
assert.equal(
  candidateReportsPageSource.includes("formatHrShortId(card.attempt?.id)"),
  false,
  "Expected participant reports page to stop rendering the shortened attempt id on report cards.",
);
assert.equal(
  candidateReportsPageSource.includes("formatHrLifecycleStatus(card.attempt?.lifecycle)"),
  true,
  "Expected HR participant detail page to map raw lifecycle values to HR-facing labels.",
);
assert.equal(
  hrCandidateAssessmentSource.includes('label: "Otvori HR izvještaj"'),
  false,
  "Expected ready individual report CTA copy to stop repeating the HR context.",
);
assert.equal(
  hrCandidateAssessmentSource.includes('label: "Otvori izvještaj"'),
  true,
  "Expected ready individual report CTA copy to use the shorter open-report label.",
);
assert.equal(
  hrCandidateAssessmentSource.includes('body: "HR izvještaj je spreman za pregled."'),
  false,
  "Expected ready individual report body copy to stop repeating the ready-state message.",
);
assert.equal(
  hrCandidateAssessmentSource.includes("body: readyBody"),
  true,
  "Expected ready individual report body copy to come from the existing test description.",
);
assert.equal(
  candidateReportsPageSource.includes('card.state !== "ready" || card.body !== card.subtitle'),
  true,
  "Expected ready individual cards to skip the state-message strip when it would duplicate the subtitle.",
);
for (const readyBody of [
  "Radni obrasci i ponašanje",
  "Kognitivni signali",
  "Motivacijski profil",
]) {
  assert.equal(
    hrCandidateAssessmentSource.includes(`subtitle: "${readyBody}"`),
    true,
    `Expected the ${readyBody} test description to remain available for ready individual cards.`,
  );
}
assert.equal(
  hrCandidateAssessmentSource.includes('statusLabel: "Dostupno"'),
  true,
  "Expected the available status label to remain unchanged for ready individual cards.",
);
assert.equal(
  hrCandidateAssessmentSource.includes(
    'body: "HR izvještaj je poslan na generisanje i čeka obradu."',
  ),
  true,
  "Expected queued individual cards to keep their explanatory body copy.",
);
assert.equal(
  hrCandidateAssessmentSource.includes('body: "HR izvještaj se trenutno priprema."'),
  true,
  "Expected processing individual cards to keep their explanatory body copy.",
);
assert.equal(
  hrCandidateAssessmentSource.includes(
    'body: "Rezultati su sačuvani, ali HR izvještaj nije uspješno generisan."',
  ),
  true,
  "Expected failed individual cards to keep their explanatory body copy.",
);
assert.equal(
  individualDevelopmentProfileReportListSource.includes(
    "Interni skraćeni identifikator ciklusa",
  ),
  false,
  "Expected IDP cards to remove the technical cycle-id helper copy.",
);
assert.equal(
  individualDevelopmentProfileReportListSource.includes(
    "formatHrShortId(entry.assessmentAssignmentId)",
  ),
  false,
  "Expected IDP cards to stop rendering the shortened assessment-assignment id.",
);
assert.equal(
  candidateReportsPageSource.includes("formatHrDateTime(card.attempt?.completed_at)"),
  true,
  "Expected HR participant detail page to map ISO completion timestamps to a human-readable format.",
);
assert.equal(
  candidateReportsPageSource.includes("completed_at ??"),
  false,
  "Expected HR participant detail page to stop rendering raw completion timestamps directly.",
);
assert.equal(
  candidateReportsPageSource.includes('?? "not_assigned"'),
  false,
  "Expected HR participant detail page to stop rendering raw fallback lifecycle codes.",
);
assert.equal(
  candidateReportsPageSource.includes('title="Pojedinačni HR izvještaji"'),
  true,
  "Expected HR participant detail page to use the updated single-report section title.",
);
assert.equal(
  candidateReportsPageSource.includes(
    'description="Pregled statusa i izvještaja za svaku završenu procjenu kandidata."',
  ),
  true,
  "Expected HR participant detail page to use the updated single-report section description.",
);
assert.equal(
  candidateReportsPageSource.includes("Pojedinačne procjene nisu dodijeljene"),
  true,
  "Expected participant reports page to include the compact empty state heading for missing individual assessments.",
);
assert.equal(
  /Kada kandidat završi IPIP, SAFRAN ili MWMS, ovdje će se prikazati\s+pojedinačni HR izvještaji\./.test(
    candidateReportsPageSource,
  ),
  true,
  "Expected participant reports page to include the compact empty state body for missing individual assessments.",
);
assert.equal(
  candidateReportsPageSource.includes("{hasTeamFitReports ? teamFitSection : null}"),
  true,
  "Expected Team Fit section to move above the individual reports section when Team Fit artefacts exist.",
);
assert.equal(
  candidateReportsPageSource.includes("{!hasTeamFitReports ? teamFitSection : null}"),
  true,
  "Expected Team Fit section to keep a stable fallback position when no Team Fit artefacts exist.",
);
assert.equal(
  candidateReportsPageSource.includes("Dostupni testovi i statusi"),
  false,
  "Expected outdated single-report section title to be removed.",
);
assert.equal(
  candidateReportsPageSource.includes("nalaz"),
  false,
  "Expected updated participant report page copy to avoid the word 'nalaz'.",
);
assert.equal(
  candidateReportsPageSource.includes('"HR izvještaji nisu generisani"'),
  true,
  "Expected participant reports page to map the top pending-results status to the explicit non-generated HR report copy.",
);
assert.equal(
  candidateReportsPageSource.includes('"Čeka rezultate"'),
  true,
  "Expected participant reports page to preserve a local display mapping from the legacy model status copy.",
);
assert.equal(
  candidateReportsPageSource.includes('card.cta.disabled && card.cta.label !== "Nije dostupno"'),
  true,
  "Expected participant reports page to suppress disabled button-like rendering for the 'Nije dostupno' single-report CTA label.",
);
assert.equal(
  candidateReportsPageSource.includes("max-w-[920px]"),
  true,
  "Expected composite inner card to use a fixed max width on desktop.",
);
assert.equal(
  candidateReportsPageSource.includes("min-[900px]:grid-cols-[minmax(0,1fr)_auto]"),
  true,
  "Expected composite inner card to switch to a two-column desktop layout.",
);
assert.equal(
  candidateReportsPageSource.includes("min-[900px]:whitespace-nowrap"),
  true,
  "Expected composite CTA to remain nowrap on desktop.",
);
assert.equal(
  candidateReportsPageSource.includes("tone=\"success\""),
  true,
  "Expected participant reports page to route positive statuses through the shared success badge tone.",
);
assert.equal(
  candidateReportsPageSource.includes('<DpStatusBadge tone="neutral">{model.organizationName}</DpStatusBadge>'),
  true,
  "Expected organization chip to use the shared neutral status badge treatment.",
);
assert.equal(
  candidateReportsPageSource.includes('eyebrowClassName="text-[#118ab2]"'),
  true,
  "Expected single-report section eyebrow to use the ocean blue accent.",
);
assert.equal(
  candidateReportsPageSource.includes('eyebrowClassName="text-[#073b4c]"'),
  true,
  "Expected composite section eyebrow to use the dark teal accent.",
);
assert.equal(
  candidateReportsPageSource.includes(
    "shadow-[inset_0_3px_0_rgba(17,138,178,0.22),0_28px_60px_rgba(15,23,42,0.12)]",
  ),
  true,
  "Expected the single-report section shell to use an ocean-blue accent shadow.",
);
assert.equal(
  candidateReportsPageSource.includes(
    "shadow-[inset_0_3px_0_rgba(7,59,76,0.24),0_28px_60px_rgba(15,23,42,0.12)]",
  ),
  true,
  "Expected the composite section shell to use a dark-teal accent shadow.",
);
assert.equal(
  candidateReportsPageSource.includes("border-l-4 border-l-[#073b4c]"),
  true,
  "Expected the composite inner card to use a dark-teal left accent strip.",
);
assert.equal(
  candidateReportsPageSource.includes("bg-[rgba(255,255,255,0.82)]"),
  true,
  "Expected the composite inner card to use the specified translucent white background.",
);
assert.equal(
  dashboardPrimitivesSource.includes("bg-[#079985]"),
  true,
  "Expected shared dashboard primary CTA to use the updated default teal.",
);
assert.equal(
  dashboardPrimitivesSource.includes("hover:bg-[#073b4c]"),
  true,
  "Expected shared dashboard primary CTA to darken to dark teal on hover.",
);
assert.equal(
  dashboardPrimitivesSource.includes("text-white"),
  true,
  "Expected shared dashboard primary CTA to keep white default text.",
);
assert.equal(
  dashboardPrimitivesSource.includes("hover:text-white"),
  true,
  "Expected shared dashboard primary CTA to keep white text on hover.",
);
assert.equal(
  dashboardPrimitivesSource.includes("focus-visible:text-white"),
  true,
  "Expected shared dashboard primary CTA to keep white text on focus-visible.",
);
assert.equal(
  dashboardPrimitivesSource.includes("active:text-white"),
  true,
  "Expected shared dashboard primary CTA to keep white text when active.",
);
assert.equal(
  dashboardPrimitivesSource.includes("focus-visible:ring-[rgba(17,138,178,0.32)]"),
  true,
  "Expected shared dashboard primary CTA to use the specified focus ring color.",
);
assert.equal(
  candidateReportsPageSource.includes('title="Kompozitni HR izvještaj"'),
  false,
  "Composite section title should continue to come from model content, not be hardcoded in the page header.",
);
assert.equal(
  candidateReportsPageSource.includes("{model.organizationName}"),
  true,
  "Expected organization context to remain in hero metadata, not in page navigation.",
);
assert.equal(
  dashboardPrimitivesSource.includes("export function getDashboardCtaClassName"),
  true,
  "Expected dashboard primitives to expose a shared CTA helper.",
);
assert.equal(
  dashboardPrimitivesSource.includes("hover:text-white"),
  true,
  "Expected shared dashboard CTA helper to keep white text on darker hover states.",
);
assert.equal(
  candidateReportsPageSource.includes("<DpButton"),
  true,
  "Expected HR participant detail page to route CTAs through the shared DP button primitive.",
);
assert.equal(
  /<DpButton[^>]*disabled[^>]*>\s*\{card\.cta\.label\}\s*<\/DpButton>/.test(
    candidateReportsPageSource,
  ),
  true,
  "Expected HR participant detail page to use the shared disabled DP button treatment.",
);

console.log("HR participant reports renderer hygiene tests passed.");
