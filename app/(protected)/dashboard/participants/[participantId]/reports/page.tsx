import Link from "next/link";
import { notFound } from "next/navigation";
import {
  generateCompositeHrReportAction,
  recoverHrCandidateAttemptReport,
  retryCompositeHrReportAction,
} from "@/app/actions/assessment";
import {
  AuthenticatedAppMainContent,
} from "@/components/app/authenticated-app-chrome";
import {
  DashboardInfoCardShell,
  PageNavigation,
  getDashboardCtaClassName,
  DashboardSectionHeader,
  DashboardSectionShell,
  DashboardStatusBadge,
} from "@/components/dashboard/primitives";
import { TeamFitReportList } from "@/components/dashboard/team-fit-report-list";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { listTeamFitReportEntries } from "@/lib/b2b/team-fit-report-list";
import {
  getActiveOrganizationForUser,
  getHrAttemptReportsForAttemptIds,
  getParticipantForOrganization,
  getAttemptsForParticipantInOrganization,
} from "@/lib/b2b/organizations";
import {
  buildCompositeReadinessForAssignment,
  loadLatestActiveStandardAssessmentAssignment,
  loadLatestCompositeHrAssessmentReport,
} from "@/lib/assessment/assessment-reports";
import {
  buildHrCandidateAssessmentDetailModel,
  type HrCandidateAssessmentCardVisualVariant,
} from "@/lib/dashboard/hr-candidate-assessment";
import {
  formatHrDateTime,
  formatHrLifecycleStatus,
  formatHrShortId,
} from "@/lib/dashboard/hr-ui-format";

type CandidateReportsPageProps = {
  params: {
    participantId: string;
  };
  searchParams?: {
    reportRecovery?: string;
    target?: string;
    success?: string;
    error?: string;
  };
};

const EMERALD_STATUS_BADGE_CLASS_NAME =
  "border-[rgba(6,214,160,0.22)] bg-[rgba(6,214,160,0.14)] text-[#073b4c]";
const ORGANIZATION_BADGE_CLASS_NAME =
  "border-[rgba(7,59,76,0.08)] bg-[rgba(255,255,255,0.72)] text-[#073b4c]";

function getCardStatusClassName(visualVariant: HrCandidateAssessmentCardVisualVariant): string {
  switch (visualVariant) {
    case "success":
      return EMERALD_STATUS_BADGE_CLASS_NAME;
    case "progress":
      return "border-[rgba(255,209,102,0.32)] bg-[rgba(255,209,102,0.16)] text-[#073b4c]";
    case "error":
      return "border-[rgba(239,71,111,0.24)] bg-[rgba(239,71,111,0.14)] text-[#073b4c]";
    case "info":
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export const dynamic = "force-dynamic";

function getReportRecoveryMessage(searchParams?: CandidateReportsPageProps["searchParams"]): {
  tone: "success" | "neutral" | "error";
  body: string;
} | null {
  const action = searchParams?.reportRecovery;
  const target = searchParams?.target?.toUpperCase() || "HR izvještaj";

  switch (action) {
    case "generate":
      return {
        tone: "success",
        body: `${target} je dodat u red za generisanje.`,
      };
    case "retry_failed":
      return {
        tone: "success",
        body: `${target} je ponovo dodat u red za generisanje.`,
      };
    case "noop_ready":
      return {
        tone: "neutral",
        body: `${target} je već dostupan.`,
      };
    case "noop_active_job":
      return {
        tone: "neutral",
        body: `${target} se već generiše.`,
      };
    case "noop_inactive_capability":
      return {
        tone: "neutral",
        body: `${target} još nije podržan za ovu procjenu.`,
      };
    case "noop_incomplete_attempt":
      return {
        tone: "neutral",
        body: `${target} se može pokrenuti tek nakon završetka procjene.`,
      };
    case "noop_existing_unavailable":
      return {
        tone: "neutral",
        body: `${target} trenutno nije dostupan za ponovni pokušaj.`,
      };
    case "error":
      return {
        tone: "error",
        body: "Pokretanje HR izvještaja nije uspjelo. Pokušajte ponovo.",
      };
    default:
      return null;
  }
}

function getCompositeQueueMessage(searchParams?: CandidateReportsPageProps["searchParams"]): {
  tone: "success" | "neutral" | "error";
  body: string;
} | null {
  switch (searchParams?.success) {
    case "composite-queued":
      return {
        tone: "success",
        body: "Kompozitni HR izvještaj je dodat u red za generisanje.",
      };
    case "composite-already-queued":
      return {
        tone: "neutral",
        body: "Kompozitni HR izvještaj je već u redu za generisanje ili se već priprema.",
      };
    case "composite-already-ready":
      return {
        tone: "neutral",
        body: "Kompozitni HR izvještaj je već spreman.",
      };
    case "composite-retry-required":
      return {
        tone: "neutral",
        body: "Kompozitni HR izvještaj je pao pri zadnjem generisanju. Koristite ponovno generisanje.",
      };
    default:
      break;
  }

  switch (searchParams?.error) {
    case "composite-not-ready":
      return {
        tone: "error",
        body: "Kompozitni HR izvještaj se može staviti u red tek kada su svi potrebni testovi završeni u istom ciklusu.",
      };
    case "composite-create-failed":
      return {
        tone: "error",
        body: "Dodavanje kompozitnog HR izvještaja u red nije uspjelo. Pokušajte ponovo.",
      };
    case "composite-retry-failed":
      return {
        tone: "error",
        body: "Ponovno dodavanje kompozitnog HR izvještaja u red nije uspjelo. Pokušajte ponovo.",
      };
    default:
      return null;
  }
}

export default async function CandidateReportsPage({
  params,
  searchParams,
}: CandidateReportsPageProps) {
  const user = await requireAuthenticatedUser();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    notFound();
  }

  const participant = await getParticipantForOrganization(organization.id, params.participantId);

  if (!participant) {
    notFound();
  }

  const attempts = await getAttemptsForParticipantInOrganization(
    organization.id,
    participant.id,
  );
  const teamFitReports = await listTeamFitReportEntries({
    organizationId: organization.id,
    participantId: participant.id,
  });
  const hrReports = await getHrAttemptReportsForAttemptIds(attempts.map((attempt) => attempt.id));
  const activeCompositeAssignment = await loadLatestActiveStandardAssessmentAssignment({
    organizationId: organization.id,
    participantId: participant.id,
  });
  const [compositeReadiness, compositeReport] = activeCompositeAssignment
    ? await Promise.all([
        buildCompositeReadinessForAssignment({
          assessmentAssignmentId: activeCompositeAssignment.id,
        }),
        loadLatestCompositeHrAssessmentReport({
          assessmentAssignmentId: activeCompositeAssignment.id,
        }),
      ])
    : [null, null];
  const model = buildHrCandidateAssessmentDetailModel({
    participant,
    attempts,
    hrReports,
    organizationName: organization.name,
    activeCompositeAssignment,
    compositeReadiness,
    compositeReport,
  });
  const recoveryMessage = getReportRecoveryMessage(searchParams);
  const compositeQueueMessage = getCompositeQueueMessage(searchParams);
  const hasTeamFitReports = teamFitReports.length > 0;

  const individualReportsSection = (
    <DashboardSectionShell className="shadow-[inset_0_3px_0_rgba(17,138,178,0.22),0_28px_60px_rgba(15,23,42,0.12)] lg:p-6">
      <DashboardSectionHeader
        eyebrow="Pojedinačni HR izvještaji"
        eyebrowClassName="text-[#118ab2]"
        title="Pojedinačni HR izvještaji"
        description="Pregled statusa i izvještaja za svaku završenu procjenu kandidata."
        className="gap-2"
        titleClassName="text-[1.35rem]"
      />

      {recoveryMessage ? (
        <div
          className={`mt-4 rounded-[1.2rem] border px-4 py-3 text-sm ${
            recoveryMessage.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : recoveryMessage.tone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {recoveryMessage.body}
        </div>
      ) : null}

      {model.allIndividualReportsNotAssigned ? (
        <DashboardInfoCardShell className="mt-6 max-w-[920px] rounded-[1.4rem] border-slate-200/80 p-5">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
              Pojedinačne procjene nisu dodijeljene
            </h3>
            <p className="text-sm leading-6 text-slate-600">
              Kada kandidat završi IPIP, SAFRAN ili MWMS, ovdje će se prikazati
              pojedinačni HR izvještaji.
            </p>
          </div>
        </DashboardInfoCardShell>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {model.cards.map((card) => (
            <DashboardInfoCardShell
              key={card.slug}
              className="flex h-full flex-col rounded-[1.4rem] border-slate-200/80 p-5"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                      {card.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">{card.subtitle}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getCardStatusClassName(card.visualVariant)}`}
                  >
                    {card.statusLabel}
                  </span>
                </div>

                <p className="min-h-[3rem] text-sm leading-6 text-slate-600">{card.body}</p>

                <div className="space-y-1.5 text-xs leading-5 text-slate-500">
                  <p>
                    <span className="font-semibold text-slate-700">ID procjene:</span>{" "}
                    {formatHrShortId(card.attempt?.id)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Status procjene:</span>{" "}
                    {formatHrLifecycleStatus(card.attempt?.lifecycle)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Završeno:</span>{" "}
                    {formatHrDateTime(card.attempt?.completed_at)}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex flex-wrap gap-3">
                  {card.cta.disabled ? (
                    <span className={getDashboardCtaClassName({ variant: "disabled" })}>
                      {card.cta.label}
                    </span>
                  ) : (
                    <Link
                      className={getDashboardCtaClassName({ variant: "primary" })}
                      href={card.cta.href}
                    >
                      {card.cta.label}
                    </Link>
                  )}

                  {card.action.enabled && card.attempt ? (
                    <form action={recoverHrCandidateAttemptReport}>
                      <input name="participantId" type="hidden" value={participant.id} />
                      <input name="attemptId" type="hidden" value={card.attempt.id} />
                      <input name="testSlug" type="hidden" value={card.slug} />
                      <input
                        name="returnPath"
                        type="hidden"
                        value={`/dashboard/participants/${participant.id}/reports`}
                      />
                      <button
                        className={getDashboardCtaClassName({ variant: "secondary" })}
                        type="submit"
                      >
                        {card.action.label}
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </DashboardInfoCardShell>
          ))}
        </div>
      )}
    </DashboardSectionShell>
  );

  const teamFitSection = (
    <DashboardSectionShell className="shadow-[inset_0_3px_0_rgba(7,59,76,0.18),0_28px_60px_rgba(15,23,42,0.12)] lg:p-6">
      <TeamFitReportList entries={teamFitReports} />
    </DashboardSectionShell>
  );

  const compositeSection = (
    <DashboardSectionShell className="shadow-[inset_0_3px_0_rgba(7,59,76,0.24),0_28px_60px_rgba(15,23,42,0.12)] lg:p-6">
      <DashboardSectionHeader
        eyebrow="Kompozitni HR izvještaj"
        eyebrowClassName="text-[#073b4c]"
        title={model.compositeCard.title}
        description={model.compositeCard.subtitle}
        className="gap-2"
        titleClassName="text-[1.35rem]"
      />

      <DashboardInfoCardShell className="mt-6 max-w-[920px] rounded-[24px] border border-[rgba(7,59,76,0.08)] border-l-4 border-l-[#073b4c] bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_14px_27px_rgba(15,23,42,0.06)] min-[900px]:mr-auto min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_auto] min-[900px]:items-center min-[900px]:gap-x-8 min-[900px]:p-6">
        {compositeQueueMessage ? (
          <div
            className={`mb-4 rounded-[1.2rem] border px-4 py-3 text-sm min-[900px]:col-span-2 ${
              compositeQueueMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : compositeQueueMessage.tone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {compositeQueueMessage.body}
          </div>
        ) : null}

        <div className="flex flex-col gap-[18px] min-[900px]:contents">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                {model.compositeCard.title}
              </h3>
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getCardStatusClassName(model.compositeCard.visualVariant)}`}
              >
                {model.compositeCard.statusLabel}
              </span>
            </div>
            <p className="mt-2 max-w-[520px] text-sm leading-6 text-slate-600">
              {model.compositeCard.body}
            </p>
          </div>

          {model.compositeCard.cta.action && !model.compositeCard.cta.disabled ? (
            <form
              className="mt-[18px] w-full min-[900px]:mt-0 min-[900px]:w-auto"
              action={
                model.compositeCard.cta.action === "generate_composite"
                  ? generateCompositeHrReportAction
                  : retryCompositeHrReportAction
              }
            >
              <input name="participantId" type="hidden" value={participant.id} />
              <input
                name="assessmentAssignmentId"
                type="hidden"
                value={model.compositeCard.assignment?.id ?? ""}
              />
              <input
                name="assessmentReportId"
                type="hidden"
                value={model.compositeCard.report?.id ?? ""}
              />
              <input
                name="returnPath"
                type="hidden"
                value={`/dashboard/participants/${participant.id}/reports`}
              />
              <button
                className={`${getDashboardCtaClassName({ variant: "primary", fullWidth: true })} justify-center min-[900px]:w-auto min-[900px]:whitespace-nowrap`}
                type="submit"
              >
                {model.compositeCard.cta.label}
              </button>
            </form>
          ) : model.compositeCard.cta.href && !model.compositeCard.cta.disabled ? (
            <Link
              className={`${getDashboardCtaClassName({ variant: "primary", fullWidth: true })} mt-[18px] justify-center min-[900px]:mt-0 min-[900px]:w-auto min-[900px]:whitespace-nowrap`}
              href={model.compositeCard.cta.href}
            >
              {model.compositeCard.cta.label}
            </Link>
          ) : (
            <span className={`${getDashboardCtaClassName({ variant: "disabled", fullWidth: true })} mt-[18px] justify-center min-[900px]:mt-0 min-[900px]:w-auto min-[900px]:whitespace-nowrap`}>
              {model.compositeCard.cta.label}
            </span>
          )}
        </div>
      </DashboardInfoCardShell>
    </DashboardSectionShell>
  );

  return (
    <AuthenticatedAppMainContent
      className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"
      topPaddingClassName="pt-0"
    >
      <div className="-mt-10 pb-12">
        <div className="space-y-1.5">
          <PageNavigation
            backHref="/dashboard"
            backLabel="Nazad na HR dashboard"
            backLinkVariant="subtle"
          />

          <DashboardSectionShell className="shadow-[0_24px_54px_rgba(15,23,42,0.1)] lg:p-7">
          <div className="relative space-y-6">
            <div className="flex flex-col gap-5">
              <div className="space-y-4">
                <DashboardSectionHeader
                  eyebrow="HR PROCJENA KANDIDATA"
                  eyebrowClassName="text-teal-800/90"
                  title={model.participant.full_name}
                  titleClassName="text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl"
                  description={model.participant.email}
                  descriptionClassName="text-base text-slate-600"
                />

                <div className="flex flex-wrap gap-2.5">
                  <DashboardStatusBadge className={EMERALD_STATUS_BADGE_CLASS_NAME} emphasized>
                    {model.completedLabel}
                  </DashboardStatusBadge>
                  <DashboardStatusBadge
                    className={
                      model.readyHrReports > 0
                        ? EMERALD_STATUS_BADGE_CLASS_NAME
                        : undefined
                    }
                    tone={model.readyHrReports > 0 ? "success" : "neutral"}
                  >
                    {model.readyLabel}
                  </DashboardStatusBadge>
                  <DashboardStatusBadge className={EMERALD_STATUS_BADGE_CLASS_NAME}>
                    {model.availabilityLabel}
                  </DashboardStatusBadge>
                  <DashboardStatusBadge className={ORGANIZATION_BADGE_CLASS_NAME}>
                    {model.organizationName}
                  </DashboardStatusBadge>
                </div>
              </div>
            </div>
          </div>
          </DashboardSectionShell>
        </div>

        <div className="mt-8 space-y-8">
          {hasTeamFitReports ? teamFitSection : null}
          {individualReportsSection}
          {compositeSection}
          {!hasTeamFitReports ? teamFitSection : null}
        </div>
      </div>
    </AuthenticatedAppMainContent>
  );
}
