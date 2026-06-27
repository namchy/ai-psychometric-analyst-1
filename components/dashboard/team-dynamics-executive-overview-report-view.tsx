import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
  DpStatusBadge,
  PageNavigation,
} from "@/components/dashboard/primitives";
import type {
  TeamDynamicsExecutiveOverviewReportDisplayRecord,
} from "@/lib/b2b/team-dynamics-executive-overview-display";
import type {
  TeamDynamicsExecutiveOverviewSnapshot,
  TeamDynamicsExecutiveOverviewSignal,
} from "@/lib/b2b/team-dynamics-executive-overview-contract";

type TeamDynamicsExecutiveOverviewReportViewProps = {
  report: TeamDynamicsExecutiveOverviewReportDisplayRecord;
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

function PrioritySignalCard({
  index,
  signal,
}: {
  index: number;
  signal: TeamDynamicsExecutiveOverviewSignal;
}) {
  return (
    <DashboardInfoCardShell className="h-full rounded-[1.3rem] border-[rgba(17,138,178,0.16)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(17,138,178,0.06))] p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#118ab2]/20 bg-[#118ab2]/10 text-sm font-bold text-[#118ab2]">
          {index}
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#118ab2]">
            Prioritetni signal
          </p>
          <h3 className="text-[1.08rem] font-bold tracking-[-0.03em] text-[#073b4c]">
            {signal.title}
          </h3>
          <p className="text-sm leading-6 text-slate-600">{signal.summary}</p>
        </div>
      </div>
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
            title={snapshot.executiveSummary.headline}
            description={snapshot.executiveSummary.summary}
            className="gap-2"
            titleClassName="max-w-4xl text-[2rem] font-extrabold tracking-[-0.06em] text-[#073b4c] sm:text-[2.7rem]"
            descriptionClassName="max-w-3xl text-base leading-7 text-slate-600"
          />

          <div className="flex flex-wrap gap-2.5">
            <DpStatusBadge tone="success" emphasized>
              Spremno za pregled
            </DpStatusBadge>
            <DpStatusBadge className="border-[#118ab2]/20 bg-[#118ab2]/10 text-[#073b4c]" tone="info">
              {snapshot.locale.toUpperCase()}
            </DpStatusBadge>
          </div>

          <div className="rounded-[1.15rem] border border-[#118ab2]/15 bg-[linear-gradient(135deg,rgba(17,138,178,0.05),rgba(255,255,255,0.96))] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#118ab2]">
              Tim u fokusu
            </p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#073b4c]">
              {snapshot.teamContext.teamName}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Ovaj pregled sažima glavne timske obrasce, prioritetne signale za razgovor i
              naredni operativni korak za lidera ili HR.
            </p>
          </div>

          <div className="grid gap-3 border-t border-slate-200/80 pt-5 md:grid-cols-3">
            <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Fokus izvještaja
              </p>
              <p className="mt-1.5 text-sm font-semibold text-[#073b4c]">
                Timski executive pregled
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
          eyebrow="Ključni signali"
          eyebrowClassName="text-[#073b4c]"
          title="Šta ovaj tim signalizira na prvom čitanju"
          description={`${snapshot.includedMembersSummary.note} Fokus je na signalima koje vrijedi prvo otvoriti u HR ili liderskom razgovoru.`}
          className="gap-2"
          titleClassName="text-[1.45rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          descriptionClassName="text-sm leading-6 text-slate-600"
        />

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {snapshot.keyTeamSignals.map((signal, index) => (
            <PrioritySignalCard key={signal.title} index={index + 1} signal={signal} />
          ))}
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Rizici i trenje"
          eyebrowClassName="text-[#ef476f]"
          title="Gdje tim trenutno traži najviše pažnje"
          description="Prvo pogledaj gdje postoje signali trenja i koje rizike vrijedi pratiti prije sljedećeg timskog razgovora."
          className="gap-2"
          titleClassName="text-[1.35rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          descriptionClassName="text-sm leading-6 text-slate-600"
        />
        <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.15rem] border border-slate-200/80 bg-white/85 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Usklađenost i trenje
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.15rem] border border-emerald-200/70 bg-emerald-50/60 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Gdje tim djeluje usklađeno
                </p>
                <div className="mt-3">
                  <BulletList items={snapshot.alignmentAndFriction.alignmentSignals} />
                </div>
              </div>
              <div className="rounded-[1.15rem] border border-amber-200/80 bg-amber-50/70 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Gdje vrijedi otvoriti razgovor
                </p>
                <div className="mt-3">
                  <BulletList items={snapshot.alignmentAndFriction.frictionSignals} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.15rem] border border-[#ef476f]/20 bg-[linear-gradient(135deg,rgba(239,71,111,0.07),rgba(255,255,255,0.98))] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ef476f]">
              Rizici koje vrijedi pratiti
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Ovo su signali koji najviše zaslužuju praćenje prije naredne liderske ili HR
              intervencije.
            </p>
            <div className="mt-4">
              <BulletList items={snapshot.risksToWatch} />
            </div>
          </div>
        </div>
      </DashboardInfoCardShell>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Preporuke za akciju"
            eyebrowClassName="text-[#06d6a0]"
            title="Šta lider ili HR radi sljedeće"
            description="Preporuke čitaj kao praktičan odgovor na gore izdvojene rizike i signale trenja."
            className="gap-2"
            titleClassName="text-[1.35rem] font-bold tracking-[-0.035em] text-[#073b4c]"
            descriptionClassName="text-sm leading-6 text-slate-600"
          />
          <div className="mt-5">
            <BulletList items={snapshot.leadershipRecommendations} />
          </div>
        </DashboardInfoCardShell>

        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Naredni razgovor"
            eyebrowClassName="text-[#118ab2]"
            title={snapshot.suggestedNextConversation.title}
            description="Koristi ovaj blok kao najkonkretniji naredni korak nakon čitanja izvještaja."
            className="gap-2"
            titleClassName="text-[1.35rem] font-bold tracking-[-0.035em] text-[#073b4c]"
            descriptionClassName="text-sm leading-6 text-slate-600"
          />
          <div className="mt-5 rounded-[1.2rem] border border-[#118ab2]/20 bg-[linear-gradient(135deg,rgba(17,138,178,0.06),rgba(255,255,255,0.98))] p-4 sm:p-5">
            <BulletList items={snapshot.suggestedNextConversation.prompts} />
          </div>
        </DashboardInfoCardShell>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Podržavajuća dijagnostika"
            eyebrowClassName="text-slate-500"
            title="Pregled timskih dimenzija"
            description="Ovaj dio pomaže da executive signal i prioritetni razgovori dobiju širi kontekst."
            className="gap-2"
            titleClassName="text-[1.35rem] font-bold tracking-[-0.035em] text-[#073b4c]"
            descriptionClassName="text-sm leading-6 text-slate-600"
          />
          <div className="mt-5 space-y-3">
            {snapshot.dimensionOverview.dimensions.map((dimension) => (
              <div
                key={dimension.key}
                className="rounded-[1rem] border border-slate-200/80 bg-slate-50/70 px-4 py-3"
              >
                <p className="text-sm font-semibold text-[#073b4c]">{dimension.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{dimension.summary}</p>
              </div>
            ))}
          </div>
        </DashboardInfoCardShell>

        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Dodatni signali"
            eyebrowClassName="text-slate-500"
            title="Signali koji vrijede koristiti kao dodatni kontekst"
            description="Ovo su supporting signali za dublji razgovor, ne glavni zaključak prvog čitanja."
            className="gap-2"
            titleClassName="text-[1.35rem] font-bold tracking-[-0.035em] text-[#073b4c]"
            descriptionClassName="text-sm leading-6 text-slate-600"
          />
          <div className="mt-5 grid gap-4">
            <SignalCard eyebrow="Psihološka sigurnost" signal={snapshot.psychologicalSafetySignal} />
            <SignalCard eyebrow="Situacijsko prosuđivanje" signal={snapshot.situationalJudgmentSignal} />
            <SignalCard eyebrow="Outcome pulse" signal={snapshot.outcomePulseSignal} />
          </div>
        </DashboardInfoCardShell>
      </div>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Ograničenja"
          eyebrowClassName="text-slate-500"
          title="Kako čitati ovaj izvještaj"
          description="Ove napomene čuvaju opreznu interpretaciju i ne mijenjaju prioritet glavnih timskih signala iznad."
          className="gap-2"
          titleClassName="text-[1.35rem] font-bold tracking-[-0.035em] text-[#073b4c]"
          descriptionClassName="text-sm leading-6 text-slate-600"
        />
        <div className="mt-5">
          <BulletList items={snapshot.interpretationLimits} />
        </div>
      </DashboardInfoCardShell>
    </div>
  );
}
