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
  DashboardSectionHeader,
  DashboardSectionShell,
  DashboardStatusBadge,
} from "@/components/dashboard/primitives";
import { requireAuthenticatedUser } from "@/lib/auth/session";
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

function getCardStatusClassName(visualVariant: HrCandidateAssessmentCardVisualVariant): string {
  switch (visualVariant) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "progress":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700";
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

  return (
    <AuthenticatedAppMainContent
      className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"
      topPaddingClassName="pt-0"
    >
      <div className="space-y-8 pb-12">
        <DashboardSectionShell className="shadow-[0_24px_54px_rgba(15,23,42,0.1)] lg:p-7">
          <div className="relative space-y-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
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
                  <DashboardStatusBadge tone="success" emphasized>
                    {model.completedLabel}
                  </DashboardStatusBadge>
                  <DashboardStatusBadge tone={model.readyHrReports > 0 ? "success" : "neutral"}>
                    {model.readyLabel}
                  </DashboardStatusBadge>
                  <DashboardStatusBadge>{model.availabilityLabel}</DashboardStatusBadge>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 xl:justify-end">
                <span className="rounded-full border border-white/70 bg-white/70 px-4 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  {model.organizationName}
                </span>
                <Link
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:border-teal-300 hover:text-teal-700"
                  href="/dashboard"
                >
                  Nazad na dashboard
                </Link>
              </div>
            </div>
          </div>
        </DashboardSectionShell>

        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Kandidat"
            eyebrowClassName="text-teal-800/80"
            title="Sažetak procjene"
            description="Pregled kandidata i trenutne dostupnosti HR izvještaja."
            className="gap-2"
            titleClassName="text-[1.35rem]"
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Ime</p>
              <p className="mt-2 text-[15px] font-semibold text-slate-950">{model.participant.full_name}</p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Email</p>
              <p className="mt-2 break-all text-[15px] font-semibold text-slate-950">{model.participant.email}</p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Završeni testovi</p>
              <p className="mt-2 text-[15px] font-semibold text-slate-950">{model.completedLabel}</p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">HR izvještaji</p>
              <p className="mt-2 text-[15px] font-semibold text-slate-950">{model.readyLabel}</p>
            </div>
          </div>
        </DashboardInfoCardShell>

        <DashboardSectionShell className="lg:p-6">
          <DashboardSectionHeader
            eyebrow="Pojedinačni HR izvještaji"
            eyebrowClassName="text-teal-800/80"
            title="Dostupni testovi i statusi"
            description="Svaka kartica pokazuje stanje odabranog attempta za taj test i dostupnost HR izvještaja."
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
                      <span className="font-semibold text-slate-700">Attempt:</span>{" "}
                      {card.attempt?.id ?? "Nije kreiran"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">Status testa:</span>{" "}
                      {card.attempt?.lifecycle ?? "not_assigned"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">Završen:</span>{" "}
                      {card.attempt?.completed_at ?? "Nije završeno"}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex flex-wrap gap-3">
                    {card.cta.disabled ? (
                      <span className="inline-flex min-h-0 rounded-full border border-slate-200 bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        {card.cta.label}
                      </span>
                    ) : (
                      <Link
                        className="inline-flex min-h-0 rounded-full border border-teal-700 bg-teal-600 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition hover:-translate-y-0.5 hover:bg-teal-700"
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
                          className="inline-flex min-h-0 rounded-full border border-slate-300 bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
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
        </DashboardSectionShell>

        <DashboardSectionShell className="lg:p-6">
          <DashboardSectionHeader
            eyebrow="Kompozitni HR izvještaj"
            eyebrowClassName="text-teal-800/80"
            title={model.compositeCard.title}
            description={model.compositeCard.subtitle}
            className="gap-2"
            titleClassName="text-[1.35rem]"
          />

          <DashboardInfoCardShell className="mt-6 rounded-[1.4rem] border-slate-200/80 p-5">
            {compositeQueueMessage ? (
              <div
                className={`mb-4 rounded-[1.2rem] border px-4 py-3 text-sm ${
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

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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
                <p className="text-sm leading-6 text-slate-600">
                  {model.compositeCard.body}
                </p>
              </div>

              {model.compositeCard.cta.action && !model.compositeCard.cta.disabled ? (
                <form
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
                    className="inline-flex min-h-0 rounded-full border border-teal-700 bg-teal-600 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition hover:-translate-y-0.5 hover:bg-teal-700"
                    type="submit"
                  >
                    {model.compositeCard.cta.label}
                  </button>
                </form>
              ) : model.compositeCard.cta.href && !model.compositeCard.cta.disabled ? (
                <Link
                  className="inline-flex min-h-0 rounded-full border border-teal-700 bg-teal-600 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition hover:-translate-y-0.5 hover:bg-teal-700"
                  href={model.compositeCard.cta.href}
                >
                  {model.compositeCard.cta.label}
                </Link>
              ) : (
                <span className="inline-flex min-h-0 rounded-full border border-slate-200 bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  {model.compositeCard.cta.label}
                </span>
              )}
            </div>
          </DashboardInfoCardShell>
        </DashboardSectionShell>
      </div>
    </AuthenticatedAppMainContent>
  );
}
