const assert = require("node:assert/strict");

const {
  DEFAULT_FIXTURE_REPORT_IDS,
  buildUsageText,
  buildDryRunSummary,
  buildIpipStructuralChecks,
  buildLanguageDiagnostics,
  analyzeRow,
} = require("./inspect-amra-replay-single-test-hr-report-quality.cjs");

function buildBaseIpipRow() {
  return {
    id: DEFAULT_FIXTURE_REPORT_IDS.ipip,
    attempt_id: "e71d472a-13cb-4cc9-9582-6eaa262affca",
    test_slug: "ipip-neo-120-v1",
    audience: "hr",
    report_type: "individual",
    source_type: "single_test",
    report_status: "ready",
    generator_type: "openai",
    model_name: "gpt-5.5",
    prompt_version_id: "prompt-ipip",
    input_snapshot: {
      score_references: {
        domains: [
          {
            domain_code: "AGREEABLENESS",
            domain_name: "Spremnost na saradnju",
            facets: [
              {
                facet_code: "COOPERATION",
                facet_name: "Sklonost saradnji",
              },
            ],
          },
        ],
      },
    },
    report_snapshot: {
      contract_version: "ipip_neo_120_hr_v2",
      test: {
        code: "ipip_neo_120",
        name: "IPIP-NEO-120",
      },
      meta: {
        language: "bs",
        audience: "hr",
      },
      score_references: {
        test_slug: "ipip-neo-120-v1",
        locale: "bs",
        domains: [
          {
            domain_code: "AGREEABLENESS",
            domain_name: "Spremnost na saradnju",
            score: 4.2,
            score_label_or_band: "high",
            facets: [
              {
                facet_code: "COOPERATION",
                facet_name: "Sklonost saradnji",
                score: 4.4,
                score_label_or_band: "high",
              },
            ],
          },
          {
            domain_code: "EXTRAVERSION",
            domain_name: "Ekstraverzija",
            score: 3.4,
            score_label_or_band: "moderate",
            facets: [],
          },
          {
            domain_code: "CONSCIENTIOUSNESS",
            domain_name: "Savjesnost",
            score: 4.1,
            score_label_or_band: "high",
            facets: [],
          },
          {
            domain_code: "NEUROTICISM",
            domain_name: "Neuroticizam",
            score: 2.2,
            score_label_or_band: "low",
            facets: [],
          },
          {
            domain_code: "OPENNESS_TO_EXPERIENCE",
            domain_name: "Otvorenost prema iskustvu",
            score: 3.1,
            score_label_or_band: "moderate",
            facets: [],
          },
        ],
      },
      headline: "Pouzdan radni ritam uz jasnu temu za provjeru granica",
      executive_summary:
        "Profil pokazuje stabilan obrazac odgovornosti, saradnje i smirenijeg reagovanja pod pritiskom. U intervjuu treba provjeriti kako osoba postavlja granice kada pomoć drugima počne ugrožavati vlastite prioritete.",
      key_hr_signals: [
        {
          title: "Pouzdanost i izvršenje",
          evidence:
            "Rezultati ukazuju na dosljedan odnos prema obavezama, održavanje fokusa i spremnost da se preuzeti zadaci dovrše.",
          hr_implication:
            "Ovaj obrazac je relevantan za uloge u kojima su rokovi, standard rada i samostalno praćenje dogovora važni za timski ritam.",
        },
        {
          title: "Saradnja i postavljanje granica",
          evidence:
            "Spremnost na saradnju se vidi kroz povjerenje i kooperativan odnos prema drugima, uz potrebu da se provjeri kako osoba štiti prioritete u zahtjevnom timu.",
          hr_implication:
            "U radnom kontekstu to može podržati korisničku orijentaciju i timsku dinamiku.",
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
              facet_name: "Sklonost saradnji",
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
          top_facets: [],
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
          first_30_days_application: "Dogovoriti kratke check-in razgovore nakon prvih zahtjevnijih situacija.",
        },
        {
          recommendation: "Provjeriti kako osoba traži pojašnjenje kada zadatak nije potpuno jasan.",
          why: "Time se lakše razlikuje stabilan obrazac od reakcije na kontekst.",
          first_30_days_application: "Uvesti jedan zadatak sa djelimično otvorenim parametrima i kratku refleksiju poslije.",
        },
        {
          recommendation: "Dogovoriti kako će izgledati direktan feedback i eskalacija neslaganja.",
          why: "To pomaže da se ranije vide granice, stil komunikacije i način saradnje.",
          first_30_days_application: "Pregledati prvi zahtjevniji feedback razgovor i način na koji je vođen.",
        },
        {
          recommendation: "Povezati profil sa konkretnim zahtjevima uloge.",
          why: "Time se smanjuje rizik preširoke interpretacije.",
          first_30_days_application: "Na kraju prvog mjeseca provjeriti koje su se hipoteze potvrdile.",
        },
      ],
      team_fit_notes: [
        {
          fit_condition: "Tim koji traži stabilnu saradnju",
          may_work_well_when: "Uloga zavisi od koordinacije i redovnog usklađivanja.",
          watchout: "Vrijedi provjeriti reakciju kada tim traži češće neslaganje i brže odluke.",
        },
        {
          fit_condition: "Okruženje sa jasnim očekivanjima",
          may_work_well_when: "Radni kontekst ima dovoljno strukture i jasnih granica uloge.",
          watchout: "Provjeriti kako funkcioniše kada se očekivanja brzo mijenjaju.",
        },
        {
          fit_condition: "Tim sa kratkim razvojnim check-in razgovorima",
          may_work_well_when: "Postoji prostor da se signal brzo prevede u ponašanje i podršku.",
          watchout: "Ne oslanjati se na snapshot bez provjere kroz stvarne primjere rada.",
        },
      ],
      decision_support_note: [
        "Ne koristiti ovaj profil kao samostalnu odluku o kandidatu.",
        "Koristiti ga za pripremu strukturiranog intervjua.",
      ],
      interpretation_note:
        "Ovaj izvještaj nije dijagnoza niti odluka o zapošljavanju i treba ga čitati uz kontekst uloge i druge izvore informacija.",
    },
  };
}

function testDryRunAndHelpExposeDefaults() {
  const usage = buildUsageText();
  assert.equal(usage.includes(DEFAULT_FIXTURE_REPORT_IDS.ipip), true);
  assert.equal(usage.includes(DEFAULT_FIXTURE_REPORT_IDS.safran), true);
  assert.equal(usage.includes(DEFAULT_FIXTURE_REPORT_IDS.mwms), true);

  const dryRun = buildDryRunSummary();
  assert.equal(dryRun.readOnly, true);
  assert.equal(dryRun.openAiCalled, false);
  assert.equal(dryRun.databaseWrites, false);
  assert.equal(dryRun.requiresConfirmationEnv, false);
}

function testForbiddenTermScannerAndIpipLabels() {
  const row = buildBaseIpipRow();
  row.report_snapshot.executive_summary =
    "Saradljivost i overuse traže provjeru, a handling signal ostaje vidljiv.";
  row.report_snapshot.score_references.domains[0].facets[0].facet_name = "Saradljivost";

  const diagnostics = buildLanguageDiagnostics("ipip", row);
  assert.equal(diagnostics.englishLeakHits.overuse.length > 0, true);
  assert.equal(diagnostics.englishLeakHits.handling.length > 0, true);
  assert.equal(diagnostics.saradljivostHits.length > 0, true);

  const structuralChecks = buildIpipStructuralChecks(row);
  assert.equal(structuralChecks.expectedAgreeablenessDomainLabel, "Spremnost na saradnju");
  assert.equal(structuralChecks.expectedCooperationFacetLabel, "Sklonost saradnji");
  assert.equal(structuralChecks.activeSaradljivostScoreReferenceHits.length > 0, true);
}

function testGoldenIpipAnalysisPasses() {
  const row = buildBaseIpipRow();
  const analysis = analyzeRow("ipip", row);

  assert.equal(analysis.identity.generator_type, "openai");
  assert.equal(analysis.validator.ok, true);
  assert.equal(analysis.rendererReadiness.displayReady, true);
  assert.equal(analysis.structuralLabelChecks.expectedCooperationFacetLabel, "Sklonost saradnji");
  assert.equal(analysis.languageDiagnostics.englishLeakHits.overuse.length, 0);
  assert.equal(analysis.languageDiagnostics.englishLeakHits.handling.length, 0);
  assert.equal(analysis.languageDiagnostics.saradljivostHits.length, 0);
}

function main() {
  testDryRunAndHelpExposeDefaults();
  testForbiddenTermScannerAndIpipLabels();
  testGoldenIpipAnalysisPasses();
  console.log("test-inspect-amra-replay-single-test-hr-report-quality: ok");
}

main();
