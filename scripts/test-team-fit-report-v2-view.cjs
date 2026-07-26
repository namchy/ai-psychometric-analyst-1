const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const viewPath = path.join(root, "components", "dashboard", "team-fit-report-v2-view.tsx");
const emptyPath = path.join(__dirname, "empty-module.cjs");
const source = fs.readFileSync(viewPath, "utf8");

for (const field of ["executiveAssessment", "mainReasons", "keySignals", "likelyContributions", "successConditions", "frictionRisks", "interviewPlan", "teamIntegrationPlan", "adaptForThisTeam", "teamPreparations", "first30Days", "managerGuidance", "interpretationLimits"]) assert.match(source, new RegExp(field));
assert.match(source, /record\.candidate\.displayName/);
assert.match(source, /record\.team\.name/);
assert.match(source, /Integracija kandidata u ovaj tim/);
assert.match(source, /provenanceLabel/);
assert.doesNotMatch(source, /reference\.key|sourceTestSlug|organizationId\}|participantId\}|teamId\}/);
assert.doesNotMatch(source, /fit score|ranking|rangiranje|zaposliti|ne zaposliti|idealni kandidat|konačna odluka/i);
assert.doesNotMatch(source, /fitOverview|candidateSignals|complementaritySignals|onboardingGuidance|watchouts/);
assert.doesNotMatch(source, /function sanitize|function rewrite|\.trim\(\)|\.replace\(/);
assert.match(source, /team-fit-report-ui-primitives/);
assert.match(source, /components\/dashboard\/primitives/);

function Wrapper({ children, eyebrow, label, title, description, value, summary, helper }) {
  return React.createElement("section", null, eyebrow, label, title, description, value, summary, helper, children);
}
const exportsBag = {
  DpStatusBadge: Wrapper, CalloutBlock: Wrapper, DetailBlock: Wrapper, InsightCard: Wrapper,
  ReportHero: Wrapper, ReportMetaCard: Wrapper, ReportMetaGrid: Wrapper,
  ReportSection: Wrapper, ReportShell: Wrapper,
  formatHrDateTime: (value) => value,
};
require.cache[emptyPath] = { id: emptyPath, filename: emptyPath, loaded: true, exports: exportsBag };
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) return emptyPath;
  return originalResolve.call(this, request, parent, isMain, options);
};
require.extensions[".tsx"] = function (module, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};
require.extensions[".ts"] = require.extensions[".tsx"];

const { TeamFitReportV2View } = require(viewPath);
const refs = [{ source: "candidate", key: "candidate:secret-slug:dimension" }, { source: "team", key: "team:tdm_domain_secret" }];
const action = { action: "Pripremiti jasan ritam dogovora.", owner: "shared", timing: "Prva sedmica", expectedResult: "Jasna koordinacija." };
const snapshot = {
  reportType: "team_fit_report_v2", reportVersion: "v2", locale: "bs-BA", generatedAt: "2026-07-26T10:00:00.000Z",
  inputSnapshotVersion: "team_fit_input_v1", teamFitReportVersion: "v2", audience: "hr_internal", sourceType: "candidate_team_relational",
  candidateContext: { organizationId: "org-uuid-secret", participantId: "participant-uuid-secret", assessmentAssignmentId: null, compositeInputSnapshotId: null, compositeReportId: null, displayName: "Amel Kovačević" },
  teamContext: { organizationId: "org-uuid-secret", teamId: "team-uuid-secret", teamName: "Kreditno poslovanje", teamAssessmentAssignmentId: null, teamDynamicsAggregationSnapshotId: null, teamDynamicsReportId: null },
  source: { candidateCompositeInputVersion: "v1", candidateSourceReportIds: [], candidateSourceTestSlugs: [], teamInputVersion: "v1", teamSourceReportIds: [], teamSourceSnapshotIds: [], optionalContextKeys: [] },
  executiveAssessment: { category: "good_fit_with_conditions", headline: "Jasan relacijski zaključak", conclusion: "Kandidat može doprinijeti timu uz jasne uslove koordinacije.", decisionGuidance: "Provjeriti relacijske hipoteze u intervjuu.", mainReasons: [{ title: "Razlog", explanation: "Objašnjenje", practicalConsequence: "Praktična posljedica", evidenceRefs: refs }] },
  keySignals: [{ title: "Signal", explanation: "Objašnjenje signala", practicalMeaning: "Praktično značenje", evidenceRefs: refs }],
  likelyContributions: [{ title: "Doprinos", explanation: "Konkretan doprinos", conditions: "Uz jasnu koordinaciju", evidenceRefs: refs }],
  successConditions: [{ title: "Uslov", condition: "Jasna očekivanja", whyItMatters: "Smanjuje nesporazume", owner: "hiring_manager", timing: "Prva sedmica" }],
  frictionRisks: [{ title: "Rizik", trigger: "Nejasan prioritet", likelyPattern: "Usporena odluka", teamImpact: "Kašnjenje koordinacije", mitigation: "Dogovoriti vlasnika odluke", owner: "team_lead", timing: "Od početka", evidenceRefs: refs }],
  interviewPlan: [{ question: "Kako biste razjasnili suprotne prioritete ovog tima?", purpose: "Provjera koordinacije", whatToListenFor: "Konkretan primjer", positiveSignals: ["Jasan dogovor"], concernSignals: ["Izbjegavanje odgovornosti"], evidenceRefs: refs }],
  teamIntegrationPlan: { summary: "Integracija je prilagođena ovom timu.", adaptForThisTeam: [action], teamPreparations: [{ action: "Dogovoriti kontakt osobu.", owner: "team", timing: "Prije početka" }], first30Days: [action], successSignals: ["Brzo razjašnjava prioritete"], earlyFrictionSignals: ["Nerazjašnjena očekivanja"] },
  managerGuidance: [{ action: "Postaviti jasan mandat.", rationale: "Olakšava koordinaciju.", timing: "Prvi dan", watchFor: "Zastoj u odluci" }],
  interpretationLimits: ["Zaključci služe kao hipoteze za provjeru."],
  metadata: { provider: "openai", providerVersion: "team_fit_report_v2_openai_provider_v1", generatedAt: "2026-07-26T10:00:00.000Z" },
};
snapshot.executiveAssessment.mainReasons.push({ ...snapshot.executiveAssessment.mainReasons[0] });
snapshot.keySignals.push({ ...snapshot.keySignals[0] }, { ...snapshot.keySignals[0] });
snapshot.likelyContributions.push({ ...snapshot.likelyContributions[0] });
snapshot.successConditions.push({ ...snapshot.successConditions[0] });
snapshot.frictionRisks.push({ ...snapshot.frictionRisks[0] });
snapshot.interviewPlan.push({ ...snapshot.interviewPlan[0] }, { ...snapshot.interviewPlan[0] });
snapshot.managerGuidance.push({ ...snapshot.managerGuidance[0] }, { ...snapshot.managerGuidance[0] });
snapshot.teamIntegrationPlan.first30Days.push({ ...snapshot.teamIntegrationPlan.first30Days[0] });
snapshot.teamIntegrationPlan.successSignals.push("Dosljedno usklađuje prioritete");
snapshot.teamIntegrationPlan.earlyFrictionSignals.push("Kasno razjašnjava odgovornost");
const contractPath = path.join(root, "lib", "b2b", "team-fit-report-v2-contract.ts");
const { validateTeamFitReportV2 } = require(contractPath);
const contractValidation = validateTeamFitReportV2(snapshot);
assert.equal(contractValidation.ok, true, JSON.stringify(contractValidation));
const record = { id: "report-uuid-secret", organizationId: "org-uuid-secret", teamId: "team-uuid-secret", participantId: "participant-uuid-secret", reportType: "team_fit_report_v2", reportVersion: "v2", legacyReadOnly: false, status: "ready", team: { id: "team-uuid-secret", name: "Kreditno poslovanje" }, candidate: { participantId: "participant-uuid-secret", displayName: "Amel Kovačević" }, createdAt: snapshot.generatedAt, queuedAt: null, startedAt: null, completedAt: snapshot.generatedAt, failedAt: null, hasInputSnapshot: true, hasReportSnapshot: true, safeStatusMessage: "Spremno", reportSnapshot: snapshot };
const html = ReactDOMServer.renderToStaticMarkup(React.createElement(TeamFitReportV2View, { record }));
for (const text of ["Amel Kovačević", "Kreditno poslovanje", "Jasan relacijski zaključak", "Glavni razlozi i ključni signali", "Mogući doprinosi i uslovi uspjeha", "Tačke trenja i provjera", "Teme za intervju", "Integracija kandidata u ovaj tim", "Menadžerske smjernice", "Granice tumačenja", "Signali kandidata i tima"]) assert.match(html, new RegExp(text));
for (const secret of ["report-uuid-secret", "org-uuid-secret", "team-uuid-secret", "participant-uuid-secret", "candidate:secret-slug:dimension", "team:tdm_domain_secret"]) assert.doesNotMatch(html, new RegExp(secret));
console.log("test-team-fit-report-v2-view: ok");
