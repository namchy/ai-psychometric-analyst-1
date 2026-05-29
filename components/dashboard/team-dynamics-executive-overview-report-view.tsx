import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
  DashboardStatusBadge,
  PageNavigation,
} from "@/components/dashboard/primitives";
import type {
  TeamDynamicsExecutiveOverviewDisplayRecord,
} from "@/lib/b2b/team-dynamics-executive-overview-display";
import type {
  TeamDynamicsExecutiveOverviewSnapshot,
  TeamDynamicsExecutiveOverviewSignal,
} from "@/lib/b2b/team-dynamics-executive-overview-contract";

type TeamDynamicsExecutiveOverviewReportViewProps = {
  report: TeamDynamicsExecutiveOverviewDisplayRecord;
  snapshot: TeamDynamicsExecutiveOverviewSnapshot;
  backHref: string;
};

function formatTimestamp(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("bs-BA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function SignalCard({
  eyebrow,
  signal,
}: {
  eyebrow: string;
  signal: TeamDynamicsExecutiveOverviewSignal;
}) {
  return (
    <DashboardInfoCardShell className="h-full rounded-[1.35rem] border-slate-200/80 p-5 sm:p-6">
      <DashboardSectionHeader
        eyebrow={eyebrow}
        eyebrowClassName="text-[#073b4c]"
        title={signal.title}
        description={signal.summary}
        className="gap-2"
        titleClassName="text-[1.2rem] font-bold tracking-[-0.03em] text-[#073b4c]"
        descriptionClassName="text-sm leading-6 text-slate-600"
      />
    </DashboardInfoCardShell>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
          <span
            aria-hidden="true"
            className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#118ab2]"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function TeamDynamicsExecutiveOverviewReportView({
  report,
  snapshot,
  backHref,
}: TeamDynamicsExecutiveOverviewReportViewProps) {
  const completedAtLabel = formatTimestamp(report.completedAt);

  return (
    <div className="space-y-6 pb-12">
      <PageNavigation
        backHref={backHref}
        backLabel="Nazad na tim"
        contextLabel="Team Dynamics Executive Overview"
        backLinkVariant="subtle"
      />

      <DashboardInfoCardShell className="rounded-[1.6rem] border-slate-200/80 p-6 sm:p-7">
        <div className="space-y-4">
          <DashboardSectionHeader
            eyebrow="TEAM DYNAMICS EXECUTIVE OVERVIEW"
            eyebrowClassName="text-[#073b4c]"
            title={snapshot.teamContext.teamName}
            description={snapshot.executiveSummary.summary}
            className="gap-2"
            titleClassName="text-3xl font-extrabold tracking-[-0.05em] text-[#073b4c] sm:text-4xl"
            descriptionClassName="max-w-3xl text-base text-slate-600"
          />

          <div className="flex flex-wrap gap-2.5">
            <DashboardStatusBadge tone="success" emphasized>
              Spremno za pregled
            </DashboardStatusBadge>
            <DashboardStatusBadge className="border-[#118ab2]/20 bg-[#118ab2]/10 text-[#073b4c]">
              {snapshot.locale.toUpperCase()}
            </DashboardStatusBadge>
          </div>

          <div className="grid gap-3 border-t border-slate-200/80 pt-5 md:grid-cols-3">
            <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Vrsta izvještaja
              </p>
              <p className="mt-1.5 text-sm font-semibold text-[#073b4c]">
                {snapshot.executiveSummary.headline}
              </p>
            </div>
            <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Uključeno članova
              </p>
              <p className="mt-1.5 text-sm font-semibold text-[#073b4c]">
                {snapshot.includedMembersSummary.includedMemberCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Završeno: {snapshot.includedMembersSummary.completedMemberCount}
              </p>
            </div>
            <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Datum završetka
              </p>
              <p className="mt-1.5 text-sm font-semibold text-[#073b4c]">
                {completedAtLabel ?? "Nije dostupno"}
              </p>
            </div>
          </div>
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Sažetak"
          eyebrowClassName="text-[#073b4c]"
          title={snapshot.executiveSummary.headline}
          description={snapshot.includedMembersSummary.note}
          className="gap-2"
          titleClassName="text-[1.45rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          descriptionClassName="text-sm leading-6 text-slate-600"
        />

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <DashboardInfoCardShell className="rounded-[1.25rem] border-[rgba(17,138,178,0.14)] border-t-4 border-t-[#118ab2] bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(17,138,178,0.05))] p-4">
            <DashboardSectionHeader
              eyebrow="Ključni signali"
              eyebrowClassName="text-[#118ab2]"
              title="Šta vrijedi dalje provjeriti"
              className="gap-2"
              titleClassName="text-[1.1rem] font-semibold text-[#073b4c]"
            />
            <div className="mt-4">
              <BulletList items={snapshot.keyTeamSignals.map((signal) => `${signal.title}: ${signal.summary}`)} />
            </div>
          </DashboardInfoCardShell>

          <DashboardInfoCardShell className="rounded-[1.25rem] border-[rgba(7,59,76,0.14)] border-t-4 border-t-[#073b4c] bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(7,59,76,0.04))] p-4">
            <DashboardSectionHeader
              eyebrow="Dimenzije"
              eyebrowClassName="text-[#073b4c]"
              title="Pregled dostupnih timskih dimenzija"
              className="gap-2"
              titleClassName="text-[1.1rem] font-semibold text-[#073b4c]"
            />
            <div className="mt-4 space-y-3">
              {snapshot.dimensionOverview.dimensions.map((dimension) => (
                <div
                  key={dimension.key}
                  className="rounded-[1rem] border border-slate-200/80 bg-white/85 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-[#073b4c]">{dimension.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{dimension.summary}</p>
                </div>
              ))}
            </div>
          </DashboardInfoCardShell>
        </div>
      </DashboardInfoCardShell>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Usklađenost i trenje"
            eyebrowClassName="text-[#073b4c]"
            title="Gdje tim djeluje usklađeno, a gdje treba razgovor"
            className="gap-2"
            titleClassName="text-[1.35rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.15rem] border border-emerald-200/70 bg-emerald-50/60 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Signali usklađenosti
              </p>
              <div className="mt-3">
                <BulletList items={snapshot.alignmentAndFriction.alignmentSignals} />
              </div>
            </div>
            <div className="rounded-[1.15rem] border border-amber-200/80 bg-amber-50/70 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                Signali trenja
              </p>
              <div className="mt-3">
                <BulletList items={snapshot.alignmentAndFriction.frictionSignals} />
              </div>
            </div>
          </div>
        </DashboardInfoCardShell>

        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Razvojni signali"
            eyebrowClassName="text-[#073b4c]"
            title="Odvojeni signali za timski razgovor"
            className="gap-2"
            titleClassName="text-[1.35rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          />
          <div className="mt-5 grid gap-4">
            <SignalCard eyebrow="Psihološka sigurnost" signal={snapshot.psychologicalSafetySignal} />
            <SignalCard eyebrow="Situacijsko prosuđivanje" signal={snapshot.situationalJudgmentSignal} />
            <SignalCard eyebrow="Outcome pulse" signal={snapshot.outcomePulseSignal} />
          </div>
        </DashboardInfoCardShell>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Rizici"
            eyebrowClassName="text-[#ef476f]"
            title="Rizici koje vrijedi pratiti"
            className="gap-2"
            titleClassName="text-[1.35rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          />
          <div className="mt-5">
            <BulletList items={snapshot.risksToWatch} />
          </div>
        </DashboardInfoCardShell>

        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Preporuke"
            eyebrowClassName="text-[#06d6a0]"
            title="Preporuke za lidera"
            className="gap-2"
            titleClassName="text-[1.35rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          />
          <div className="mt-5">
            <BulletList items={snapshot.leadershipRecommendations} />
          </div>
        </DashboardInfoCardShell>
      </div>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Naredni razgovor"
          eyebrowClassName="text-[#073b4c]"
          title={snapshot.suggestedNextConversation.title}
          className="gap-2"
          titleClassName="text-[1.35rem] font-bold tracking-[-0.035em] text-[#073b4c]"
        />
        <div className="mt-5">
          <BulletList items={snapshot.suggestedNextConversation.prompts} />
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Ograničenja"
          eyebrowClassName="text-[#073b4c]"
          title="Kako čitati ovaj izvještaj"
          className="gap-2"
          titleClassName="text-[1.35rem] font-bold tracking-[-0.035em] text-[#073b4c]"
        />
        <div className="mt-5">
          <BulletList items={snapshot.interpretationLimits} />
        </div>
      </DashboardInfoCardShell>
    </div>
  );
}
