const assert = require("node:assert/strict");

const {
  inspectArtifactRow,
  buildRecoveryReadout,
} = require("./inspect-amra-ipip-hr-artifact.cjs");

function buildReadyRow() {
  return {
    id: "report-ready",
    attempt_id: "attempt-ready",
    test_slug: "ipip-neo-120-v1",
    audience: "hr",
    report_type: "individual",
    source_type: "single_test",
    report_status: "ready",
    prompt_version_id: "prompt-ready",
    input_snapshot: {
      summary: "Spremnost na saradnju",
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
      headline: "Spremnost na saradnju i savjesnost vrijedi provjeriti kroz konkretne radne situacije.",
      executive_summary:
        "Profil ukazuje na strukturiran i saradnički obrazac rada. U intervjuu vrijedi provjeriti kako osoba postavlja granice, reaguje pod pritiskom i usklađuje očekivanja uloge.",
      key_hr_signals: [
        {
          title: "Saradnja i odgovornost",
          evidence: "Profil pokazuje stabilniji obrazac saradnje i organizacije rada.",
          hr_implication: "Provjeriti kako osoba održava standard rada kada prioriteti postanu zahtjevniji.",
        },
        {
          title: "Način komunikacije",
          evidence: "Vrijedi pogledati kako osoba spaja taktičnost i jasnoću.",
          hr_implication: "Tražiti primjer zahtjevnijeg feedback razgovora.",
        },
        {
          title: "Otpornost u radu",
          evidence: "Signal vrijedi povezati sa pritiskom, rokovima i promjenama prioriteta.",
          hr_implication: "U strukturiranom intervjuu tražiti primjer rada u nestabilnijem kontekstu.",
        },
      ],
      verification_focus: [
        {
          area: "Granice",
          why_it_matters: "Pokazuje kako osoba štiti prioritete i standard rada.",
          how_to_check: "Tražiti primjer odbijanja zahtjeva koji je remetio važniji prioritet.",
        },
        {
          area: "Feedback",
          why_it_matters: "Otkriva balans jasnoće i odnosa.",
          how_to_check: "Zatražiti konkretan primjer neugodnog razgovora.",
        },
        {
          area: "Pritisak",
          why_it_matters: "Daje signal o samoregulaciji u promjenjivom kontekstu.",
          how_to_check: "Provjeriti primjer rada sa kratkim rokovima i nejasnim parametrima.",
        },
      ],
      interview_questions: [
        {
          question: "Opišite situaciju kada ste morali zaštititi važniji prioritet iako je tim imao drugačije očekivanje.",
          evaluates: "Postavljanje granica i donošenje odluka.",
          what_good_answer_may_show: "Jasan balans saradnje, prioriteta i odgovornosti.",
        },
        {
          question: "Recite primjer kada ste morali dati direktan feedback u osjetljivoj situaciji.",
          evaluates: "Direktna komunikacija.",
          what_good_answer_may_show: "Sposobnost da ostane konkretna i profesionalna.",
        },
        {
          question: "Kako reagujete kada se prioriteti promijene u zadnji čas?",
          evaluates: "Samoregulacija i prilagođavanje.",
          what_good_answer_may_show: "Sposobnost da zadrži fokus i traži pojašnjenje.",
        },
        {
          question: "Opišite situaciju kada ste morali uskladiti brzinu odluke i kvalitet saradnje.",
          evaluates: "Balans odlučnosti i odnosa.",
          what_good_answer_may_show: "Praktično prosuđivanje u timskom radu.",
        },
        {
          question: "Kada pomažete drugima, kako procjenjujete granicu između podrške i preuzimanja tuđeg posla?",
          evaluates: "Upravljanje granicama saradnje.",
          what_good_answer_may_show: "Zdrav osjećaj prioriteta i odgovornosti.",
        },
      ],
      strengths_and_overuse_risks: [
        {
          trait_or_pattern: "Spremnost na saradnju",
          possible_strengths: [
            "Može podržati predvidivu saradnju.",
            "Može pomoći kvalitetnijem usklađivanju očekivanja.",
            "Može dati signal o konstruktivnijem pristupu odnosima.",
          ],
          possible_overuse_risks: [
            "U nekim situacijama može voditi prekomjernom oslanjanju na saglasnost.",
            "Vrijedi provjeriti kako osoba postavlja granice pod pritiskom.",
            "Bez konteksta uloge može se preširoko tumačiti.",
          ],
          hr_handling_tip:
            "U intervjuu i onboardingu povezati nalaz sa konkretnim granicama uloge i očekivanjima saradnje.",
        },
        {
          trait_or_pattern: "Savjesnost",
          possible_strengths: [
            "Može podržati uredniji način rada.",
            "Može pomoći praćenju dogovorenih standarda.",
            "Može dati signal o većoj operativnoj pouzdanosti.",
          ],
          possible_overuse_risks: [
            "U nekim kontekstima može voditi krutijem pristupu.",
            "Vrijedi provjeriti reakciju na promjenu prioriteta.",
            "Bez konteksta može djelovati šire nego što jeste.",
          ],
          hr_handling_tip: "Provjeriti kako osoba zadržava standard rada kada se kontekst brzo mijenja.",
        },
      ],
      domain_overview: [
        {
          domain_name: "Ekstraverzija",
          score_label_or_band: "moderate",
          concise_meaning: "Daje signal o načinu uključivanja u društveni i radni kontakt.",
          hr_relevance: "Vrijedi povezati sa zahtjevima saradnje, inicijative i ritma komunikacije.",
          check_in_interview: "Tražiti primjer uključivanja u timski rad i zauzimanja stava.",
          top_facets: [],
        },
        {
          domain_name: "Spremnost na saradnju",
          score_label_or_band: "high",
          concise_meaning: "Daje signal o odnosu prema saradnji, taktu i granicama u radu sa drugima.",
          hr_relevance: "Vrijedi povezati sa zahtjevima usklađivanja, feedbacka i donošenja odluka.",
          check_in_interview: "Tražiti primjer neslaganja, zaštite prioriteta i održavanja odnosa.",
          top_facets: [],
        },
        {
          domain_name: "Savjesnost",
          score_label_or_band: "high",
          concise_meaning: "Daje signal o strukturi, odgovornosti i praćenju dogovorenog.",
          hr_relevance: "Vrijedi povezati sa preciznošću, rokovima i kvalitetom izvedbe.",
          check_in_interview: "Tražiti primjer rada pod rokovima i održavanja standarda.",
          top_facets: [],
        },
        {
          domain_name: "Neuroticizam",
          score_label_or_band: "moderate",
          concise_meaning: "Daje signal o regulaciji pritiska i reaktivnosti u radu.",
          hr_relevance: "Vrijedi povezati sa zahtjevima promjene, nesigurnosti i kratkih rokova.",
          check_in_interview: "Tražiti primjer rada kada su nejasnoća i pritisak bili pojačani.",
          top_facets: [],
        },
        {
          domain_name: "Otvorenost prema iskustvu",
          score_label_or_band: "moderate",
          concise_meaning: "Daje signal o pristupu novim idejama, promjeni i načinu razmišljanja.",
          hr_relevance: "Vrijedi povezati sa učenjem, prilagođavanjem i rješavanjem problema.",
          check_in_interview: "Tražiti primjer usvajanja novog pristupa ili načina rada.",
          top_facets: [],
        },
      ],
      onboarding_and_management_guidance: [
        {
          recommendation: "Rano razjasniti prioritete i očekivanja saradnje.",
          why: "To pomaže da se signal brže prevede u konkretno ponašanje.",
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
    attempts: {
      status: "completed",
      completed_at: "2026-06-08T12:00:00.000Z",
    },
  };
}

function buildFailedRow() {
  return {
    id: "report-failed",
    attempt_id: "attempt-failed",
    test_slug: "ipip-neo-120-v1",
    audience: "hr",
    report_type: "individual",
    source_type: "single_test",
    report_status: "failed",
    prompt_version_id: "prompt-failed",
    input_snapshot: null,
    report_snapshot: null,
    attempts: {
      status: "completed",
      completed_at: "2026-06-08T12:00:00.000Z",
    },
  };
}

function main() {
  const readyArtifact = inspectArtifactRow(buildReadyRow());
  assert.equal(readyArtifact.inputSnapshotPresent, true);
  assert.equal(readyArtifact.reportSnapshotPresent, true);
  assert.equal(readyArtifact.validatorSkipped, false);
  assert.equal(readyArtifact.validatorOk, true);
  assert.deepEqual(readyArtifact.missingReasons, []);

  const readyRecovery = buildRecoveryReadout(readyArtifact);
  assert.equal(readyRecovery.recoveryAction, "noop_ready");
  assert.equal(readyRecovery.recoveryNeeded, false);

  const failedArtifact = inspectArtifactRow(buildFailedRow());
  assert.equal(failedArtifact.inputSnapshotPresent, false);
  assert.equal(failedArtifact.reportSnapshotPresent, false);
  assert.equal(failedArtifact.validatorSkipped, true);
  assert.equal(failedArtifact.validatorOk, false);
  assert.deepEqual(failedArtifact.validatorErrors, []);
  assert.deepEqual(failedArtifact.missingReasons, [
    "input_snapshot_missing",
    "report_snapshot_missing",
  ]);

  const failedRecovery = buildRecoveryReadout(failedArtifact);
  assert.equal(failedRecovery.recoveryAction, "retry_failed");
  assert.equal(failedRecovery.recoveryNeeded, true);

  console.log("test-inspect-amra-ipip-hr-artifact: ok");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
