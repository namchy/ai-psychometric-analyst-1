import {
  validateMwmsHrReportV1,
  type MwmsHrBand,
  type MwmsHrDerivedProfile,
  type MwmsHrDimensionSnapshot,
  type MwmsHrFrictionPoint,
  type MwmsHrInterviewQuestion,
  type MwmsHrManagerGuidance,
  type MwmsHrOnboardingRecommendation,
  type MwmsHrReportV1,
  type MwmsHrSignal,
  type MwmsHrWorkContextHypothesis,
} from "@/lib/assessment/mwms-hr-report-v1";
import type { MwmsDimensionCode } from "@/lib/assessment/mwms-scoring";
import { formatMwmsScoreLabel, getMwmsScoreWidth } from "@/lib/assessment/result-display";

export type MwmsHrReportDisplayDimension = {
  code: MwmsDimensionCode;
  label: string;
  scoreLabel: string;
  rawScore: number;
  band: MwmsHrBand;
  bandLabel: string;
  width: number;
  meaning: string;
};

export type MwmsHrReportDisplay = {
  header: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  sections: {
    motivationProfile: string;
    keyMotivationalDrivers: string;
    potentialFrictionPoints: string;
    workContextHypotheses: string;
    managerSupportGuidance: string;
    interviewQuestions: string;
    onboardingRecommendations: string;
    notes: string;
  };
  scaleLabel: string;
  dimensions: [
    MwmsHrReportDisplayDimension,
    MwmsHrReportDisplayDimension,
    MwmsHrReportDisplayDimension,
    MwmsHrReportDisplayDimension,
    MwmsHrReportDisplayDimension,
    MwmsHrReportDisplayDimension,
  ];
  derivedProfile: MwmsHrDerivedProfile;
  keyMotivationalDrivers: [MwmsHrSignal, MwmsHrSignal, MwmsHrSignal];
  potentialFrictionPoints: [MwmsHrFrictionPoint, MwmsHrFrictionPoint, MwmsHrFrictionPoint];
  workContextHypotheses: [
    MwmsHrWorkContextHypothesis,
    MwmsHrWorkContextHypothesis,
    MwmsHrWorkContextHypothesis,
  ];
  managerSupportGuidance: [
    MwmsHrManagerGuidance,
    MwmsHrManagerGuidance,
    MwmsHrManagerGuidance,
    MwmsHrManagerGuidance,
  ];
  interviewQuestions: [
    MwmsHrInterviewQuestion,
    MwmsHrInterviewQuestion,
    MwmsHrInterviewQuestion,
    MwmsHrInterviewQuestion,
    MwmsHrInterviewQuestion,
  ];
  onboardingRecommendations: [
    MwmsHrOnboardingRecommendation,
    MwmsHrOnboardingRecommendation,
    MwmsHrOnboardingRecommendation,
    MwmsHrOnboardingRecommendation,
  ];
  decisionSupportNote: [string, string, ...string[]];
  interpretationNote: string;
};

const MWMS_HR_DIMENSION_MEANINGS: Record<MwmsDimensionCode, string> = {
  amotivation: "Signal jasnoce, energije i povezanosti sa razlogom za ulaganje truda.",
  external_social: "Priznanje, ocekivanja drugih i socijalni kontekst kao izvor motivacije.",
  external_material: "Nagrada, sigurnost i prakticni vanjski ishodi kao izvor motivacije.",
  introjected: "Unutrasnji pritisak, obaveza ili dokazivanje kao izvor ulaganja truda.",
  identified: "Prepoznavanje vrijednosti i vaznosti posla.",
  intrinsic: "Interes, zadovoljstvo i unutrasnji angazman u samom radu.",
};

function normalizeNonEmptyString(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapDimensionForDisplay(
  dimension: MwmsHrDimensionSnapshot,
): MwmsHrReportDisplayDimension {
  return {
    code: dimension.code,
    label: normalizeNonEmptyString(dimension.label),
    scoreLabel: formatMwmsScoreLabel(dimension.rawScore),
    rawScore: dimension.rawScore,
    band: dimension.band,
    bandLabel: normalizeNonEmptyString(dimension.bandLabel),
    width: getMwmsScoreWidth(dimension.rawScore),
    meaning: MWMS_HR_DIMENSION_MEANINGS[dimension.code],
  };
}

export function buildMwmsHrReportDisplay(report: MwmsHrReportV1): MwmsHrReportDisplay {
  return {
    header: {
      eyebrow: "HR report",
      title: "MWMS HR izvještaj",
      subtitle:
        "Motivacijski profil za HR interpretaciju, razgovor, onboarding i menadžersku podršku.",
    },
    sections: {
      motivationProfile: "Motivacijski profil po dimenzijama",
      keyMotivationalDrivers: "Motivacijski drajveri",
      potentialFrictionPoints: "Tačke moguće frikcije",
      workContextHypotheses: "Hipoteze za radni kontekst",
      managerSupportGuidance: "Menadžerske smjernice",
      interviewQuestions: "Intervju pitanja",
      onboardingRecommendations: "Onboarding preporuke",
      notes: "Kako koristiti nalaz",
    },
    scaleLabel: "Skala 1–7",
    dimensions: report.motivation_profile_snapshot.dimensions.map(mapDimensionForDisplay) as [
      MwmsHrReportDisplayDimension,
      MwmsHrReportDisplayDimension,
      MwmsHrReportDisplayDimension,
      MwmsHrReportDisplayDimension,
      MwmsHrReportDisplayDimension,
      MwmsHrReportDisplayDimension,
    ],
    derivedProfile: report.motivation_profile_snapshot.derivedProfile,
    keyMotivationalDrivers: report.key_motivational_drivers,
    potentialFrictionPoints: report.potential_friction_points,
    workContextHypotheses: report.work_context_hypotheses,
    managerSupportGuidance: report.manager_support_guidance,
    interviewQuestions: report.interview_questions,
    onboardingRecommendations: report.onboarding_recommendations,
    decisionSupportNote: report.decision_support_note,
    interpretationNote: normalizeNonEmptyString(report.interpretation_note),
  };
}

export function resolveMwmsHrReportDisplay(report: unknown): MwmsHrReportDisplay | null {
  const validation = validateMwmsHrReportV1(report);

  if (!validation.ok) {
    return null;
  }

  return buildMwmsHrReportDisplay(validation.value);
}
