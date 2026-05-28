const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const pagePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "teams",
  "page.tsx",
);
const detailPagePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "teams",
  "[teamId]",
  "page.tsx",
);
const reportPreparationPagePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "teams",
  "[teamId]",
  "reports",
  "new",
  "page.tsx",
);
const componentPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "hr-teams-table.tsx",
);
const reportSelectionComponentPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "team-dynamics-report-member-selection.tsx",
);
const detailComponentPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "hr-team-assessment-detail.tsx",
);
const dashboardPagePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "dashboard",
  "page.tsx",
);

assert.equal(fs.existsSync(pagePath), true, "Expected /dashboard/teams page to exist.");
assert.equal(fs.existsSync(detailPagePath), true, "Expected /dashboard/teams/[teamId] page to exist.");
assert.equal(
  fs.existsSync(reportPreparationPagePath),
  true,
  "Expected /dashboard/teams/[teamId]/reports/new page to exist.",
);
assert.equal(fs.existsSync(componentPath), true, "Expected HR teams table component to exist.");
assert.equal(
  fs.existsSync(reportSelectionComponentPath),
  true,
  "Expected Team Dynamics report member selection component to exist.",
);
assert.equal(
  fs.existsSync(detailComponentPath),
  true,
  "Expected HR team assessment detail component to exist.",
);
assert.equal(fs.existsSync(dashboardPagePath), true, "Expected /dashboard page to exist.");

const pageSource = fs.readFileSync(pagePath, "utf8");
const detailPageSource = fs.readFileSync(detailPagePath, "utf8");
const reportPreparationPageSource = fs.readFileSync(reportPreparationPagePath, "utf8");
const componentSource = fs.readFileSync(componentPath, "utf8");
const reportSelectionComponentSource = fs.readFileSync(reportSelectionComponentPath, "utf8");
const detailComponentSource = fs.readFileSync(detailComponentPath, "utf8");
const dashboardPageSource = fs.readFileSync(dashboardPagePath, "utf8");

const reportSelectionImportPattern =
  /replaceTeamDynamicsReportSelectionInclusionAction|replaceTeamDynamicsReportSelection(?!ReadModel)|aggregation refresh|createAssessmentReport|createAttemptReport|assessment_reports|attempt_reports|loadTeamDynamicsFinalAggregation|persistTeamDynamicsFinalAggregationSnapshot|persistTeamDynamicsMixedScoreForContext|OpenAI|AI provider|Team Fit/;

assert.match(pageSource, /requireAuthenticatedUser\(\)/);
assert.match(pageSource, /getActiveOrganizationForUser\(user\.id\)/);
assert.match(pageSource, /getTeamsForOrganization\(organization\.id\)/);
assert.match(pageSource, /PageNavigation/);
assert.match(pageSource, /title="Upravljanje timovima"/);
assert.match(pageSource, /Pregled timova i procjena timske dinamike unutar organizacije\./);
assert.doesNotMatch(pageSource, /getAttemptsForOrganization/);
assert.doesNotMatch(pageSource, /getHrAttemptReports/);
assert.doesNotMatch(pageSource, /assessment_reports/);
assert.doesNotMatch(pageSource, reportSelectionImportPattern);

assert.match(dashboardPageSource, /id="teams-entry-heading"/);
assert.match(dashboardPageSource, />Timovi<\/span>/);
assert.match(dashboardPageSource, /href="\/dashboard\/teams"|href=\{"\/dashboard\/teams"\}/);
assert.match(dashboardPageSource, /Otvori timove/);
assert.doesNotMatch(dashboardPageSource, /left\s*\/\s*right/i);
assert.doesNotMatch(dashboardPageSource, /report selection/i);
assert.doesNotMatch(dashboardPageSource, /Kreiraj timski izvještaj/);
assert.doesNotMatch(dashboardPageSource, reportSelectionImportPattern);

assert.match(componentSource, /createTeamDynamicsAssessmentAction/);
assert.match(componentSource, /useFormState/);
assert.match(componentSource, /team-dynamics-action-contract/);
assert.match(componentSource, /name="teamId"/);
assert.match(componentSource, /Pokreni procjenu timske dinamike/);
assert.match(componentSource, /href=\{`\/dashboard\/teams\/\$\{team\.teamId\}`\}/);
assert.match(componentSource, /Upravljanje timovima/);
assert.match(componentSource, /Pregled timova i procjena timske dinamike unutar organizacije\./);
assert.match(componentSource, /Otvori tim/);
assert.match(componentSource, /Aktivna procjena/);
assert.doesNotMatch(componentSource, /Kreiraj tim/);
assert.doesNotMatch(componentSource, /Uredi tim/);
assert.doesNotMatch(componentSource, /Dodaj člana/);
assert.doesNotMatch(componentSource, /Ukloni člana/);
assert.doesNotMatch(componentSource, /member score/i);
assert.doesNotMatch(componentSource, /attempt_reports/);
assert.doesNotMatch(componentSource, /assessment_reports/);
assert.doesNotMatch(componentSource, /Pogledaj izvještaj/);
assert.doesNotMatch(componentSource, /report selection/i);
assert.doesNotMatch(componentSource, /left\s*\/\s*right/i);
assert.doesNotMatch(componentSource, reportSelectionImportPattern);

assert.match(detailPageSource, /getTeamAssessmentDetailForOrganization/);
assert.match(detailPageSource, /notFound\(\)/);
assert.match(detailPageSource, /HrTeamAssessmentDetail/);

assert.match(reportPreparationPageSource, /getTeamAssessmentDetailForOrganization/);
assert.match(reportPreparationPageSource, /getTeamDynamicsReportSelectionReadModelForOrganization/);
assert.match(reportPreparationPageSource, /TeamDynamicsReportMemberSelection/);
assert.match(reportPreparationPageSource, /initialSelection=\{selection\}/);
assert.match(
  reportPreparationPageSource,
  /teamAssessmentAssignmentId=\{finalAssignment\?\.assignmentId \?\? null\}/,
);
assert.match(reportPreparationPageSource, /title="Priprema timskog izvještaja"/);
assert.match(
  reportPreparationPageSource,
  /Odaberi članove koji će biti uključeni u konkretni timski izvještaj\./,
);
assert.doesNotMatch(reportPreparationPageSource, /replaceTeamDynamicsReportSelectionInclusionAction/);
assert.doesNotMatch(reportPreparationPageSource, /Svi članovi tima/);
assert.doesNotMatch(reportPreparationPageSource, /Uključeni u izvještaj/);
assert.doesNotMatch(reportPreparationPageSource, /Sačuvaj izbor/);
assert.doesNotMatch(reportPreparationPageSource, /Kreiraj timski izvještaj/);
assert.doesNotMatch(reportPreparationPageSource, /replaceTeamDynamicsReportSelectionInclusionAction/);
assert.doesNotMatch(reportPreparationPageSource, reportSelectionImportPattern);

assert.match(reportSelectionComponentSource, /replaceTeamDynamicsReportSelectionInclusionAction/);
assert.match(reportSelectionComponentSource, /includedTeamAssessmentParticipantIds/);
assert.match(reportSelectionComponentSource, /result\.selection/);
assert.match(reportSelectionComponentSource, /setSavedState\(nextState\)/);
assert.match(reportSelectionComponentSource, /setDraftState\(nextState\)/);
assert.match(reportSelectionComponentSource, /Svi članovi tima/);
assert.match(reportSelectionComponentSource, /Uključeni u izvještaj/);
assert.match(
  reportSelectionComponentSource,
  /Članovi koji pripadaju ovom Team Dynamics assignmentu\. Premještanjem u desni panel uključuješ ih samo u ovaj konkretni timski izvještaj\./,
);
assert.match(
  reportSelectionComponentSource,
  /Ovi članovi će biti korišteni za pripremu timskog izvještaja\. Član koji nije ovdje ostaje u timu, ali nije uključen u ovaj izvještaj\./,
);
assert.match(reportSelectionComponentSource, /Sačuvaj izbor/);
assert.match(reportSelectionComponentSource, /selectedCount/);
assert.match(reportSelectionComponentSource, /teamSizeStatus/);
assert.match(reportSelectionComponentSource, /disabledReasons/);
assert.match(reportSelectionComponentSource, /Minimalno potrebno: 4/);
assert.match(reportSelectionComponentSource, /Preporučeno: 4–10/);
assert.match(reportSelectionComponentSource, /Dozvoljeno uz upozorenje: 11–15/);
assert.match(reportSelectionComponentSource, /Blokirano u MVP-u: 16\+/);
assert.match(reportSelectionComponentSource, /Uključi najmanje 4 člana\./);
assert.match(
  reportSelectionComponentSource,
  /Članovi koji nisu uključeni u ovaj izbor ostaju u timu\. Ovaj izbor važi samo za konkretni timski izvještaj\./,
);
assert.match(
  reportSelectionComponentSource,
  /return "Potrebna je dodatna provjera prije kreiranja izvještaja\.";/,
);
assert.doesNotMatch(reportSelectionComponentSource, /return reason;/);
assert.match(reportSelectionComponentSource, /Kreiraj timski izvještaj/);
assert.match(
  reportSelectionComponentSource,
  /Generisanje timskog izvještaja bit će dostupno u sljedećem koraku\./,
);
assert.doesNotMatch(reportSelectionComponentSource, /drag-and-drop/i);
assert.doesNotMatch(reportSelectionComponentSource, /createAssessmentReport/);
assert.doesNotMatch(reportSelectionComponentSource, /attempt_reports/);
assert.doesNotMatch(reportSelectionComponentSource, /assessment_reports/);
assert.doesNotMatch(reportSelectionComponentSource, /loadTeamDynamicsFinalAggregation/);
assert.doesNotMatch(reportSelectionComponentSource, /persistTeamDynamicsFinalAggregationSnapshot/);
assert.doesNotMatch(reportSelectionComponentSource, /persistTeamDynamicsMixedScoreForContext/);
assert.doesNotMatch(reportSelectionComponentSource, /OpenAI|AI provider|Team Fit/);

assert.match(detailComponentSource, /Nazad na timove/);
assert.match(detailComponentSource, /Ovaj admin pregled prikazuje samo status procjene na nivou tima/);
assert.match(detailComponentSource, /Pripremi timski izvještaj/);
assert.match(detailComponentSource, /\/dashboard\/teams\/\$\{detail\.teamId\}\/reports\/new/);
assert.match(detailComponentSource, /Članovi u procjeni/);
assert.match(detailComponentSource, /Završen/);
assert.match(detailComponentSource, /border-emerald-200 bg-emerald-50 text-emerald-700/);
assert.match(detailComponentSource, /getParticipantStatusToneClassName/);
assert.doesNotMatch(detailComponentSource, /Pogledaj izvještaj/);
assert.doesNotMatch(detailComponentSource, /individualn(?:e|ih) rezultat/i);
assert.doesNotMatch(detailComponentSource, /attemptId/);
assert.doesNotMatch(detailComponentSource, /raw response/i);
assert.doesNotMatch(detailComponentSource, /score/i);
assert.doesNotMatch(detailComponentSource, /OpenAI|AI provider|generator_type|report_snapshot/);
assert.doesNotMatch(detailComponentSource, /Svi članovi tima/);
assert.doesNotMatch(detailComponentSource, /Uključeni u izvještaj/);
assert.doesNotMatch(detailComponentSource, /left\s*\/\s*right/i);
assert.doesNotMatch(detailComponentSource, /Sačuvaj izbor/);
assert.doesNotMatch(detailComponentSource, /replaceTeamDynamicsReportSelectionInclusionAction/);
assert.doesNotMatch(detailComponentSource, reportSelectionImportPattern);

console.log("Team Dynamics teams UI skeleton tests passed.");
