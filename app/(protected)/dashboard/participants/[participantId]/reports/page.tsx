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
  DashboardSectionHeader,
  DashboardSectionShell,
  DpButton,
  DpEmptyState,
  DpInlineMessage,
  DpMetaGrid,
  DpMetaItem,
  DpPageHeader,
  DpStatusBadge,
} from "@/components/dashboard/primitives";
import { IndividualDevelopmentProfileReportList } from "@/components/dashboard/individual-development-profile-report-list";
import { TeamFitReportList } from "@/components/dashboard/team-fit-report-list";
import { listIndividualDevelopmentProfileReportEntries } from "@/lib/assessment/individual-development-profile-report-list";
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
  type HrCandidateAssessmentTestSlug,
} from "@/lib/dashboard/hr-candidate-assessment";
import {
  formatHrDateTime,
  formatHrLifecycleStatus,
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

function getCardStatusTone(
  visualVariant: HrCandidateAssessmentCardVisualVariant,
): "success" | "warning" | "danger" | "neutral" {
  switch (visualVariant) {
    case "success":
      return "success";
    case "progress":
      return "warning";
    case "error":
      return "danger";
    case "info":
    default:
      return "neutral";
  }
}

function getIndividualReportType(
  slug: HrCandidateAssessmentTestSlug,
): "ipip" | "safran" | "mwms" {
  switch (slug) {
    case "ipip-neo-120-v1":
      return "ipip";
    case "safran_v1":
      return "safran";
    case "mwms_v1":
      return "mwms";
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
  const individualDevelopmentProfileReports =
    await listIndividualDevelopmentProfileReportEntries({
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
  const hasIndividualDevelopmentProfileReports =
    individualDevelopmentProfileReports.length > 0;
  const availabilityStatusLabel =
    model.availabilityLabel === "Čeka rezultate"
      ? "HR izvještaji nisu generisani"
      : model.availabilityLabel;

  const individualReportsSection = (
    <DashboardSectionShell
      className="shadow-[inset_0_3px_0_rgba(17,138,178,0.22),0_28px_60px_rgba(15,23,42,0.12)] lg:p-6"
      data-report-family="individual"
      data-ui="report-group"
    >
      <DashboardSectionHeader
        eyebrow="Pojedinačni HR izvještaji"
        eyebrowClassName="text-[#118ab2]"
        title="Pojedinačni HR izvještaji"
        description="Pregled statusa i izvještaja za svaku završenu procjenu kandidata."
        className="gap-2"
        titleClassName="text-[1.35rem]"
      />

      {recoveryMessage ? (
        <DpInlineMessage className="mt-4" tone={recoveryMessage.tone}>
          {recoveryMessage.body}
        </DpInlineMessage>
      ) : null}

      {model.allIndividualReportsNotAssigned ? (
        <DpEmptyState
          className="mt-6 max-w-[920px]"
          title="Pojedinačne procjene nisu dodijeljene"
          body="Kada kandidat završi IPIP, SAFRAN ili MWMS, ovdje će se prikazati pojedinačni HR izvještaji."
        />
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {model.cards.map((card) => (
            <article
              key={card.slug}
              className="flex h-full flex-col rounded-[1.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,251,253,0.96))] p-5 shadow-[0_14px_27px_rgba(15,23,42,0.06)] sm:p-6"
              data-report-status={card.state}
              data-report-type={getIndividualReportType(card.slug)}
              data-ui="report-card"
            >
              <div className="flex-1 space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-[1.05rem] font-semibold leading-6 tracking-[-0.02em] text-[#073b4c]">
                      {card.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-5 text-slate-600">{card.subtitle}</p>
                  </div>
                  <DpStatusBadge
                    className="shrink-0 self-start"
                    tone={getCardStatusTone(card.visualVariant)}
                  >
                    {card.statusLabel}
                  </DpStatusBadge>
                </div>

                {card.state !== "ready" || card.body !== card.subtitle ? (
                  <p
                    className="rounded-[1rem] border border-[rgba(17,138,178,0.12)] bg-[rgba(17,138,178,0.045)] px-4 py-3.5 text-sm leading-6 text-slate-700"
                    data-ui="report-state-message"
                  >
                    {card.body}
                  </p>
                ) : null}

                <DpMetaGrid className="border-t border-slate-200/80 pt-4" columns={2}>
                  <DpMetaItem
                    className="border-0 bg-transparent px-0 py-0 shadow-none"
                    label="Status procjene"
                    value={formatHrLifecycleStatus(card.attempt?.lifecycle)}
                  />
                  <DpMetaItem
                    className="border-0 bg-transparent px-0 py-0 shadow-none"
                    label="Završeno"
                    value={formatHrDateTime(card.attempt?.completed_at)}
                  />
                </DpMetaGrid>
              </div>

              <div className="mt-auto pt-5">
                <div className="flex flex-wrap gap-3">
                  {card.cta.disabled && card.cta.label !== "Nije dostupno" ? (
                    <DpButton disabled size="sm">
                      {card.cta.label}
                    </DpButton>
                  ) : !card.cta.disabled ? (
                    <DpButton href={card.cta.href} size="sm" variant="primary">
                      {card.cta.label}
                    </DpButton>
                  ) : null}

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
                      <DpButton size="sm" type="submit" variant="secondary">
                        {card.action.label}
                      </DpButton>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardSectionShell>
  );

  const teamFitSection = (
    <DashboardSectionShell
      className="shadow-[inset_0_3px_0_rgba(7,59,76,0.18),0_28px_60px_rgba(15,23,42,0.12)] lg:p-6"
      data-report-family="team-fit"
      data-ui="report-group"
    >
      <TeamFitReportList entries={teamFitReports} />
    </DashboardSectionShell>
  );

  const individualDevelopmentProfileSection = (
    <DashboardSectionShell
      className="shadow-[inset_0_3px_0_rgba(17,138,178,0.18),0_28px_60px_rgba(15,23,42,0.12)] lg:p-6"
      data-report-family="idp"
      data-ui="report-group"
    >
      <IndividualDevelopmentProfileReportList entries={individualDevelopmentProfileReports} />
    </DashboardSectionShell>
  );

  const compositeSection = (
    <DashboardSectionShell
      className="shadow-[inset_0_3px_0_rgba(7,59,76,0.24),0_28px_60px_rgba(15,23,42,0.12)] lg:p-6"
      data-report-family="composite"
      data-ui="report-group"
    >
      <DashboardSectionHeader
        eyebrow="Kompozitni HR izvještaj"
        eyebrowClassName="text-[#073b4c]"
        title={model.compositeCard.title}
        description={model.compositeCard.subtitle}
        className="gap-2"
        titleClassName="text-[1.35rem]"
      />

      <article
        className="mt-6 max-w-[920px] rounded-[1.5rem] border border-[rgba(7,59,76,0.08)] border-l-4 border-l-[#073b4c] bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_14px_27px_rgba(15,23,42,0.06)] min-[900px]:mr-auto min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_auto] min-[900px]:items-center min-[900px]:gap-x-8 min-[900px]:p-6"
        data-report-status={model.compositeCard.state}
        data-report-type="composite"
        data-ui="report-card"
      >
        {compositeQueueMessage ? (
          <DpInlineMessage
            className="mb-4 min-[900px]:col-span-2"
            tone={compositeQueueMessage.tone}
          >
            {compositeQueueMessage.body}
          </DpInlineMessage>
        ) : null}

        <div className="flex flex-col gap-[18px] min-[900px]:contents">
          <div className="space-y-3">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <h3 className="text-[1.05rem] font-semibold leading-6 tracking-[-0.02em] text-[#073b4c]">
                {model.compositeCard.title}
              </h3>
              <DpStatusBadge
                className="shrink-0"
                tone={getCardStatusTone(model.compositeCard.visualVariant)}
              >
                {model.compositeCard.statusLabel}
              </DpStatusBadge>
            </div>
            <p
              className="max-w-[560px] rounded-[1rem] border border-[rgba(7,59,76,0.1)] bg-[rgba(7,59,76,0.035)] px-4 py-3.5 text-sm leading-6 text-slate-700"
              data-ui="report-state-message"
            >
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
              <DpButton
                className="justify-center min-[900px]:w-auto min-[900px]:whitespace-nowrap"
                fullWidth
                type="submit"
                variant="primary"
              >
                {model.compositeCard.cta.label}
              </DpButton>
            </form>
          ) : model.compositeCard.cta.href && !model.compositeCard.cta.disabled ? (
            <DpButton
              className="mt-[18px] justify-center min-[900px]:mt-0 min-[900px]:w-auto min-[900px]:whitespace-nowrap"
              fullWidth
              href={model.compositeCard.cta.href}
              variant="primary"
            >
              {model.compositeCard.cta.label}
            </DpButton>
          ) : (
            <DpButton
              className="mt-[18px] justify-center min-[900px]:mt-0 min-[900px]:w-auto min-[900px]:whitespace-nowrap"
              disabled
              fullWidth
            >
              {model.compositeCard.cta.label}
            </DpButton>
          )}
        </div>
      </article>
    </DashboardSectionShell>
  );

  return (
    <AuthenticatedAppMainContent
      className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"
      data-ui="participant-reports-page"
      topPaddingClassName="pt-0"
    >
      <div className="-mt-10 pb-12">
        <div data-ui="candidate-report-hero">
          <DpPageHeader
            backHref="/dashboard"
            backLabel="Nazad na HR dashboard"
            eyebrow="HR procjena kandidata"
            title={model.participant.full_name}
            description={model.participant.email}
            badges={
              <>
                <DpStatusBadge emphasized tone="success">
                  {model.completedLabel}
                </DpStatusBadge>
                <DpStatusBadge tone={model.readyHrReports > 0 ? "success" : "neutral"}>
                  {model.readyLabel}
                </DpStatusBadge>
                <DpStatusBadge tone={model.completedTests > 0 ? "info" : "warning"}>
                  {availabilityStatusLabel}
                </DpStatusBadge>
                <DpStatusBadge tone="neutral">{model.organizationName}</DpStatusBadge>
              </>
            }
            meta={
              <DpMetaGrid columns={3}>
                <DpMetaItem label="Kandidat" value={model.participant.full_name} />
                <DpMetaItem label="Email" value={model.participant.email} />
                <DpMetaItem label="HR workspace" value="Pregled izvještaja i narednih akcija" />
              </DpMetaGrid>
            }
          />
        </div>

        <div className="mt-8 space-y-8">
          {hasTeamFitReports ? teamFitSection : null}
          {individualReportsSection}
          {hasIndividualDevelopmentProfileReports
            ? individualDevelopmentProfileSection
            : null}
          {compositeSection}
          {!hasTeamFitReports ? teamFitSection : null}
        </div>
      </div>
    </AuthenticatedAppMainContent>
  );
}
