const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;

    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return emptyModulePath;
  }

  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      resolveWithExtensions(path.join(projectRoot, request.slice(2))),
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  validateIpipNeo120HrReportV1,
} = require("../lib/assessment/ipip-neo-120-report-v1.ts");
const {
  assertReportLanguageQuality,
  validateReportLanguageQuality,
  formatReportLanguageQualityIssues,
} = require("../lib/assessment/report-language-quality.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildGoldenIpipHrReport() {
  return {
    contract_version: "ipip_neo_120_hr_v2",
    test: {
      code: "ipip_neo_120",
      name: "IPIP-NEO-120",
    },
    meta: {
      language: "bs",
      audience: "hr",
    },
    headline: "Pouzdan radni ritam uz jasnu temu za provjeru granica",
    executive_summary:
      "Profil pokazuje stabilan obrazac odgovornosti, saradnje i smirenijeg reagovanja pod pritiskom. U intervjuu treba provjeriti kako osoba postavlja granice kada pomoć drugima počne ugrožavati vlastite prioritete.",
    key_hr_signals: [
      {
        title: "Pouzdanost i izvršenje",
        evidence:
          "Rezultati ukazuju na dosljedan odnos prema obavezama, održavanje fokusa i spremnost da se preuzeti zadaci dovrše i kada nisu odmah motivirajući.",
        hr_implication:
          "Ovaj obrazac je relevantan za uloge u kojima su rokovi, standard rada i samostalno praćenje dogovora važni za timski ritam.",
      },
      {
        title: "Saradnja i postavljanje granica",
        evidence:
          "Spremnost na saradnju se vidi kroz povjerenje i kooperativan odnos prema drugima, uz potrebu da se provjeri kako osoba štiti prioritete u zahtjevnom timu.",
        hr_implication:
          "U radnom kontekstu to može podržati korisničku orijentaciju i timsku dinamiku, posebno kada su očekivanja i granice odgovornosti jasno postavljeni.",
      },
      {
        title: "Emocionalni ton pod pritiskom",
        evidence:
          "Profil pokazuje smireniji način reagovanja kada se pojave pritisak, neizvjesnost ili promjena plana.",
        hr_implication:
          "Ovaj signal je koristan za provjeru ponašanja u situacijama sa rokovima, konfliktnim prioritetima i potrebom za traženjem podrške.",
      },
    ],
    verification_focus: [
      {
        area: "Granice u saradnji",
        why_it_matters:
          "Saradnička orijentacija je korisna kada ne preuzima prostor od vlastitih prioriteta.",
        how_to_check:
          "Tražiti primjer kada je osoba morala pomoći timu, ali istovremeno zaštititi rok ili kvalitet vlastitog zadatka.",
      },
      {
        area: "Rad pod pritiskom rokova",
        why_it_matters:
          "Stabilan radni ritam treba potvrditi u situacijama sa promjenom prioriteta.",
        how_to_check:
          "Pitati kako osoba prati obaveze kada se pojavi više hitnih zahtjeva u istom danu.",
      },
      {
        area: "Prihvatanje promjene",
        why_it_matters:
          "Otvorenost prema novim pristupima treba povezati sa stvarnim zahtjevima uloge.",
        how_to_check:
          "Tražiti konkretan primjer učenja novog procesa ili prilagodbe drugačijem načinu rada.",
      },
    ],
    interview_questions: [
      {
        question: "Opišite situaciju u kojoj ste morali završiti zadatak koji nije bio posebno motivirajući.",
        evaluates: "Pouzdanost, samodisciplinu i odnos prema dogovorenim obavezama.",
        what_good_answer_may_show: "Jasan način planiranja, praćenja rokova i završavanja obaveza.",
      },
      {
        question: "Kada ste posljednji put morali postaviti granicu u saradnji sa kolegom ili korisnikom?",
        evaluates: "Način saradnje, granice i komunikaciju u odnosu.",
        what_good_answer_may_show: "Taktično objašnjenje prioriteta uz očuvanje odnosa.",
      },
      {
        question: "Kako reagujete kada se prioriteti promijene pred kraj roka?",
        evaluates: "Reakciju na pritisak i donošenje odluka u promjeni.",
        what_good_answer_may_show: "Smireno preuređivanje plana i pravovremeno traženje podrške.",
      },
      {
        question: "Dajte primjer kada ste morali naučiti novi način rada.",
        evaluates: "Prihvatanje promjene i praktično učenje.",
        what_good_answer_may_show: "Spremnost da se novi pristup poveže sa stvarnim zadatkom.",
      },
      {
        question: "Kako održavate kvalitet kada istovremeno imate više zahtjeva od tima?",
        evaluates: "Prioritizaciju, standard rada i komunikaciju očekivanja.",
        what_good_answer_may_show: "Razlikovanje hitnog i važnog, uz jasno komuniciranje rizika.",
      },
    ],
    strengths_and_overuse_risks: [
      {
        trait_or_pattern: "Odgovoran odnos prema obavezama",
        possible_strengths: [
          "Pouzdano praćenje dogovora",
          "Stabilan odnos prema rokovima",
          "Dobra samostalnost u izvršenju",
        ],
        possible_overuse_risks: [
          "Preuzimanje previše zadataka bez rane eskalacije",
          "Teže odustajanje od dogovora koji više nisu prioritet",
          "Pritisak da se standard održi i kada resursi nisu dovoljni",
        ],
        hr_handling_tip:
          "U onboarding fazi rano razjasniti prioritete, kriterije kvaliteta i trenutak kada treba eskalirati opterećenje.",
      },
      {
        trait_or_pattern: "Saradnička orijentacija",
        possible_strengths: [
          "Lakše usklađivanje sa kolegama",
          "Pažljiv odnos prema korisnicima",
          "Spremnost da se podrži timski cilj",
        ],
        possible_overuse_risks: [
          "Odlaganje vlastitih prioriteta zbog tuđih zahtjeva",
          "Izbjegavanje direktnog neslaganja",
          "Kasno postavljanje granica u zahtjevnim odnosima",
        ],
        hr_handling_tip:
          "U intervjuu provjeriti kako osoba kaže ne, kako obrazlaže prioritete i kako reaguje na pritisak za dodatnu pomoć.",
      },
    ],
    domain_overview: [
      {
        domain_name: "Ekstraverzija",
        score_label_or_band: "moderate",
        concise_meaning: "Komunikacijska energija djeluje uravnoteženo i zavisi od zahtjeva situacije.",
        hr_relevance:
          "Ovaj obrazac može podržati rad u timu bez stalne potrebe za dominantnim nastupom.",
        check_in_interview:
          "Provjeriti kako osoba ulazi u nove odnose i kada preuzima vidljiviju komunikacijsku ulogu.",
        top_facets: [],
      },
      {
        domain_name: "Spremnost na saradnju",
        score_label_or_band: "high",
        concise_meaning: "U odnosima se očekuje kooperativan, taktičan i podržavajući radni stil.",
        hr_relevance:
          "Relevantno je za korisničku orijentaciju, timsku dinamiku i rješavanje neslaganja bez nepotrebnog zaoštravanja.",
        check_in_interview:
          "Provjeriti kako osoba postavlja granice kada saradnja počne ugrožavati vlastite prioritete.",
        top_facets: [
          {
            facet_name: "Povjerenje",
            score_label_or_band: "high",
            relevance: "Može olakšati početnu saradnju i otvoren razgovor sa kolegama.",
          },
        ],
      },
      {
        domain_name: "Savjesnost",
        score_label_or_band: "high",
        concise_meaning: "Radni stil naginje odgovornosti, strukturi i završavanju preuzetih obaveza.",
        hr_relevance:
          "Ovaj signal je važan za uloge sa jasnim rokovima, standardima kvaliteta i samostalnim praćenjem zadataka.",
        check_in_interview:
          "Tražiti primjer kada je osoba morala održati kvalitet uprkos promjeni prioriteta.",
        top_facets: [
          {
            facet_name: "Samodisciplina",
            score_label_or_band: "high",
            relevance: "Podržava kontinuitet rada i završavanje zadataka kroz manje motivirajuće faze.",
          },
        ],
      },
      {
        domain_name: "Neuroticizam",
        score_label_or_band: "low",
        concise_meaning: "Reakcije na pritisak djeluju smirenije i manje impulsivno.",
        hr_relevance:
          "Korisno je za okruženja u kojima su rokovi, promjene i povremena neizvjesnost dio posla.",
        check_in_interview:
          "Provjeriti kako osoba traži podršku kada pritisak traje duže od očekivanog.",
        top_facets: [],
      },
      {
        domain_name: "Otvorenost prema iskustvu",
        score_label_or_band: "moderate",
        concise_meaning: "Odnos prema novim idejama djeluje praktičan i vezan za jasnu korist u radu.",
        hr_relevance:
          "Ovaj obrazac podržava učenje kada je promjena povezana sa konkretnim zadatkom.",
        check_in_interview:
          "Pitati za primjer kada je osoba prihvatila drugačiji proces rada i šta joj je pomoglo.",
        top_facets: [],
      },
    ],
    onboarding_and_management_guidance: [
      {
        recommendation: "Rano razjasniti prioritete i kriterije kvaliteta.",
        why: "Profil pokazuje odgovoran odnos prema obavezama i potrebu za jasnim redoslijedom očekivanja.",
        first_30_days_application:
          "Dogovoriti sedmični pregled prioriteta, rizika za rokove i trenutaka kada treba tražiti podršku.",
      },
      {
        recommendation: "Uvesti jasan okvir za postavljanje granica u saradnji.",
        why: "Saradnička orijentacija može biti snaga kada osoba zna šta ne treba preuzeti.",
        first_30_days_application:
          "Menadžer treba dati primjere kada je prihvatljivo odbiti zahtjev ili predložiti drugi rok.",
      },
      {
        recommendation: "Koristiti konkretne zadatke za provjeru prilagodbe promjeni.",
        why: "Odnos prema promjeni najbolje se vidi kada postoji stvaran proces, alat ili način rada.",
        first_30_days_application:
          "Dodijeliti manji zadatak sa novim pravilom rada i kratkim osvrtom nakon završetka.",
      },
      {
        recommendation: "Održati redovan ritam povratne informacije.",
        why: "Stabilan radni ritam se dodatno učvršćuje kada su očekivanja i korekcije pravovremene.",
        first_30_days_application:
          "Uvesti kratke provjere napretka i dogovoriti kako se eskalira zastoj ili preopterećenje.",
      },
    ],
    team_fit_notes: [
      {
        fit_condition: "Tim sa jasnim prioritetima i dogovorenim granicama odgovornosti.",
        may_work_well_when:
          "Očekivanja su konkretna, rokovi vidljivi, a saradnja ne zavisi od stalnog ad hoc preuzimanja.",
        watchout: "Paziti da podrška drugima ne postane zamjena za vlastite ključne zadatke.",
      },
      {
        fit_condition: "Okruženje sa korisničkom orijentacijom i redovnim kontaktom sa kolegama.",
        may_work_well_when:
          "Postoji prostor za taktičnu komunikaciju, smirivanje odnosa i pouzdano praćenje dogovora.",
        watchout: "Provjeriti kako osoba reaguje kada treba iznijeti neslaganje ili odbiti zahtjev.",
      },
      {
        fit_condition: "Uloge sa povremenim pritiskom i potrebom za smirenim preusmjeravanjem plana.",
        may_work_well_when:
          "Tim jasno komunicira promjene, prioritete i kriterije za donošenje odluka.",
        watchout: "Dugotrajan pritisak treba pratiti kroz podršku i jasne tačke eskalacije.",
      },
    ],
    decision_support_note: [
      "Izvještaj je dodatni HR izvor za intervju, reference i provjeru zahtjeva uloge.",
      "Ne treba ga koristiti samostalno za odluku, rangiranje ili zaključak o kandidatu.",
    ],
    interpretation_note:
      "Ovaj izvještaj nije dijagnoza i nije odluka. Koristiti ga uz intervju, iskustvo, reference i kontekst uloge.",
  };
}

function review(report) {
  return validateReportLanguageQuality({
    snapshot: report,
    locale: "bs",
    audience: "hr",
    reportType: "single_test",
    context: "ipip_hr_report",
  });
}

function expectIssue(report, expectedCode, label) {
  const result = review(report);
  assert.equal(result.ok, false, `${label} should fail quality review.`);
  assert.equal(
    result.issues.some((issue) => issue.code === expectedCode),
    true,
    `${label} should include ${expectedCode}. Issues: ${formatReportLanguageQualityIssues(result.issues)}`,
  );
}

function main() {
  const golden = buildGoldenIpipHrReport();
  const strictValidation = validateIpipNeo120HrReportV1(golden, {
    strictContract: true,
    enforceGuardrails: true,
  });
  assert.equal(
    strictValidation.ok,
    true,
    strictValidation.ok ? undefined : strictValidation.errors.map((error) => error.message).join(" | "),
  );

  const goldenReview = review(golden);
  assert.equal(
    goldenReview.ok,
    true,
    `Golden report should pass quality review: ${formatReportLanguageQualityIssues(goldenReview.issues)}`,
  );
  assert.doesNotThrow(() =>
    assertReportLanguageQuality({
      snapshot: golden,
      locale: "bs",
      audience: "hr",
      reportType: "single_test",
      context: "ipip_hr_report",
    }),
  );

  const forbiddenTerminology = clone(golden);
  forbiddenTerminology.headline = "Ugodnost i overuse rizik u saradnji";
  expectIssue(forbiddenTerminology, "GLOSSARY_VIOLATION", "forbidden terminology");

  const secondPersonTone = clone(golden);
  secondPersonTone.executive_summary =
    "Profil pokazuje stabilan radni ritam. Ti treba da obratiš pažnju na prioritete i granice u saradnji.";
  expectIssue(secondPersonTone, "FORBIDDEN_HR_SECOND_PERSON", "candidate-facing tone");

  const scoreSummary = clone(golden);
  scoreSummary.key_hr_signals[0].evidence =
    "Savjesnost je u višem rasponu, uz izraženu odgovornost prema obavezama i samodisciplinu.";
  expectIssue(scoreSummary, "SCORE_SUMMARY_PROSE", "score-summary prose");

  const domainRestatement = clone(golden);
  domainRestatement.key_hr_signals[1].title = "Savjesnost";
  expectIssue(domainRestatement, "MISSING_HR_BEHAVIORAL_THEME", "domain-restatement key signal");

  const mechanicalFacetList = clone(golden);
  mechanicalFacetList.key_hr_signals[1].evidence =
    "U profilu se vidi saradnja uz visoke facete Povjerenje, Iskrenost, Altruizam i Skromnost.";
  expectIssue(mechanicalFacetList, "MECHANICAL_FACET_LIST", "mechanical facet list");

  const cyrillicText = clone(golden);
  cyrillicText.headline = "Поуздан радни ритам уз јасну провјеру";
  expectIssue(cyrillicText, "FORBIDDEN_SCRIPT", "non-latin script");

  const ekavianText = clone(golden);
  ekavianText.interpretation_note =
    "Ovaj izveštaj treba koristiti uz intervju, iskustvo, reference i kontekst uloge.";
  expectIssue(ekavianText, "FORBIDDEN_PHRASE", "non-ijekavian wording");

  console.log("test-ipip-hr-quality-reviewer: ok");
}

main();
