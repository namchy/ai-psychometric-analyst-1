import { getAppContextForUserId } from "@/lib/auth/app-context";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  type CandidateAttemptSummary,
  getCandidateAttemptLookupForUser,
} from "@/lib/candidate/attempts";
import {
  CandidateDashboardView,
  type CandidateAssessmentCard,
} from "@/components/dashboard/candidate-dashboard";

export const dynamic = "force-dynamic";

function isOpenCandidateAttempt(attempt: CandidateAttemptSummary): boolean {
  return attempt.lifecycle === "in_progress" || attempt.lifecycle === "not_started";
}

function getAttemptAction(attempt: CandidateAttemptSummary): {
  href: string;
  label: string;
} {
  if (attempt.lifecycle === "in_progress") {
    return {
      href: `/app/attempts/${attempt.id}/run`,
      label: "Nastavi test",
    };
  }

  if (attempt.lifecycle === "completed") {
    return {
      href: `/app/attempts/${attempt.id}/report`,
      label: "Pogledaj izvještaj",
    };
  }

  return {
    href: `/app/attempts/${attempt.id}`,
    label: "Započni test",
  };
}

function buildAssessmentCards(
  primaryAction: {
    href: string;
    label: string;
  } | null,
): CandidateAssessmentCard[] {
  return [
    {
      title: "IPIP-50 Hrvatski v1",
      status: "Dostupan",
      icon: "psychology",
      iconBgClassName: "assessment-card__icon-tile--primary",
      iconColorClassName: "assessment-card__icon-color--teal",
      description:
        "Inventar od 50 tvrdnji temeljen na modelu 'Velikih pet' faktora ličnosti. Mjeri ekstraverziju, ugodnost, savjesnost, emocionalnu stabilnost i intelekt.",
      duration: "10-15 min",
      secondaryIcon: "task_alt",
      secondaryMeta: "50 Pitanja",
      href: primaryAction?.href,
      ctaLabel: primaryAction?.label ?? "Trenutno nedostupno",
      disabled: !primaryAction,
    },
    {
      title: "O*NET Interest Profiler",
      status: "Nije započet",
      icon: "work_history",
      iconBgClassName: "assessment-card__icon-tile--tertiary",
      iconColorClassName: "assessment-card__icon-color--coral-muted",
      description:
        "Alat za istraživanje interesa koji pomaže u odlučivanju o tome koje vrste karijera biste željeli istražiti na temelju vaših preferencija aktivnosti.",
      duration: "15-20 min",
      secondaryIcon: "trending_up",
      secondaryMeta: "Analitički",
      ctaLabel: "Trenutno nedostupno",
      disabled: true,
    },
    {
      title: "IPIP-NEO Professional",
      status: "Dostupan",
      icon: "insights",
      iconBgClassName: "assessment-card__icon-tile--cyan",
      iconColorClassName: "assessment-card__icon-color--cyan",
      description:
        "Detaljna procjena ličnosti koja pruža precizne rezultate na razini 30 specifičnih faceta ličnosti za profesionalni razvoj.",
      duration: "30-40 min",
      secondaryIcon: "biotech",
      secondaryMeta: "Napredni",
      ctaLabel: "Trenutno nedostupno",
      disabled: true,
    },
    {
      title: "DISC Profiling Tool",
      status: "Dostupan",
      icon: "groups",
      iconBgClassName: "assessment-card__icon-tile--secondary",
      iconColorClassName: "assessment-card__icon-color--aqua",
      description:
        "Analiza ponašanja u radnom okruženju fokusirana na četiri ključne dimenzije: Dominacija, Utjecaj, Stabilnost i Savjesnost.",
      duration: "15 min",
      secondaryIcon: "account_balance",
      secondaryMeta: "Strateški",
      ctaLabel: "Trenutno nedostupno",
      disabled: true,
    },
    {
      title: "Enneagram Professional Type",
      status: "Nije započet",
      icon: "grid_view",
      iconBgClassName: "assessment-card__icon-tile--coral",
      iconColorClassName: "assessment-card__icon-color--coral",
      description:
        "Model ljudske psihe koji se prvenstveno razumije i podučava kao tipologija devet međusobno povezanih tipova ličnosti. Idealno za timsku dinamiku i leadership.",
      duration: "25 min",
      secondaryIcon: "hub",
      secondaryMeta: "Tipologija",
      ctaLabel: "Trenutno nedostupno",
      disabled: true,
    },
  ];
}

export default async function CandidateAppEntryPage() {
  const user = await requireAuthenticatedUser();
  const [context, candidateLookup] = await Promise.all([
    getAppContextForUserId(user.id),
    getCandidateAttemptLookupForUser(user.id),
  ]);
  const linkedParticipant = context.linkedParticipant;
  const primaryAttempt = candidateLookup.primaryAttempt;
  const openAttempts = candidateLookup.attempts.filter(isOpenCandidateAttempt);

  let primaryAction:
    | {
        href: string;
        label: string;
      }
    | null = null;

  if (openAttempts.length <= 1 && primaryAttempt) {
    primaryAction = getAttemptAction(primaryAttempt);
  }

  const desktopPrimaryAction =
    primaryAction ?? (primaryAttempt ? getAttemptAction(primaryAttempt) : null);
  const desktopUserName = linkedParticipant?.full_name?.trim();
  const desktopUserEmail = linkedParticipant?.email ?? user.email ?? user.id;

  return (
    <CandidateDashboardView
      assessments={buildAssessmentCards(desktopPrimaryAction)}
      hasLinkedParticipant={Boolean(linkedParticipant)}
      showHrLink={context.recommendedAppArea === "hr"}
      userEmail={desktopUserEmail}
      userName={desktopUserName}
    />
  );
}
