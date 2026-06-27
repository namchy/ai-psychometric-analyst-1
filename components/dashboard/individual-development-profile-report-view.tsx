import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
  DpStatusBadge,
} from "@/components/dashboard/primitives";
import type { IndividualDevelopmentProfileSnapshot } from "@/lib/assessment/individual-development-profile-contract";

type IndividualDevelopmentProfileReportViewMetadata = {
  generatorType?: string | null;
  generatorVersion?: string | null;
  modelName?: string | null;
};

export type IndividualDevelopmentProfileReadyDisplayModel = {
  status?: "ready";
  participantDisplayName?: string | null;
  generatedAt?: string | null;
  completedAt?: string | null;
  safeStatusMessage?: string | null;
  metadata?: IndividualDevelopmentProfileReportViewMetadata | null;
  reportSnapshot: IndividualDevelopmentProfileSnapshot;
};

type IndividualDevelopmentProfileReportViewProps =
  | {
      snapshot: IndividualDevelopmentProfileSnapshot;
      participantDisplayName?: string | null;
      generatedAt?: string | null;
      completedAt?: string | null;
      safeStatusMessage?: string | null;
      metadata?: IndividualDevelopmentProfileReportViewMetadata | null;
    }
  | {
      record: IndividualDevelopmentProfileReadyDisplayModel;
    };

type NormalizedRendererInput = {
  snapshot: IndividualDevelopmentProfileSnapshot;
  participantDisplayName: string | null;
  generatedAt: string | null;
  completedAt: string | null;
  safeStatusMessage: string | null;
};

function isRecordProp(
  props: IndividualDevelopmentProfileReportViewProps,
): props is { record: IndividualDevelopmentProfileReadyDisplayModel } {
  return "record" in props;
}

function normalizeRendererInput(
  props: IndividualDevelopmentProfileReportViewProps,
): NormalizedRendererInput {
  if (isRecordProp(props)) {
    return {
      snapshot: props.record.reportSnapshot,
      participantDisplayName: props.record.participantDisplayName ?? null,
      generatedAt: props.record.generatedAt ?? null,
      completedAt: props.record.completedAt ?? null,
      safeStatusMessage: props.record.safeStatusMessage ?? null,
    };
  }

  return {
    snapshot: props.snapshot,
    participantDisplayName: props.participantDisplayName ?? null,
    generatedAt: props.generatedAt ?? null,
    completedAt: props.completedAt ?? null,
    safeStatusMessage: props.safeStatusMessage ?? null,
  };
}

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

function BulletList({
  items,
  emptyText,
}: {
  items: string[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <EmptyStateText>{emptyText}</EmptyStateText>;
  }

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

function EmptyStateText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-6 text-slate-500">{children}</p>;
}

function MetaCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string | null;
}) {
  return (
    <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/75 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-[#073b4c]">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

function InfoPanel({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: React.ReactNode;
  tone?: "neutral" | "info" | "warning";
}) {
  const toneClassName =
    tone === "info"
      ? "border-[#118ab2]/15 bg-[#118ab2]/[0.06]"
      : tone === "warning"
        ? "border-[#ffd166]/45 bg-[#fff5d6]"
        : "border-slate-200/80 bg-white/80";

  return (
    <div className={`rounded-[1rem] border px-4 py-3 ${toneClassName}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-sm leading-6 text-slate-700">{children}</div>
    </div>
  );
}

function RiskCard({
  item,
}: {
  item: IndividualDevelopmentProfileSnapshot["developmentRisks"][number];
}) {
  return (
    <DashboardInfoCardShell className="h-full rounded-[1.3rem] border-[rgba(239,71,111,0.16)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,71,111,0.05))] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ef476f]">
        Razvojni rizik
      </p>
      <div className="mt-4 space-y-3">
        <InfoPanel label="Mogući blokator">{item.possibleBlocker}</InfoPanel>
        <InfoPanel label="Zašto je važno" tone="warning">
          {item.whyItMatters}
        </InfoPanel>
        <InfoPanel label="Šta provjeriti" tone="info">
          {item.whatToCheck}
        </InfoPanel>
        <InfoPanel label="Kako podržati">{item.howToSupport}</InfoPanel>
      </div>
    </DashboardInfoCardShell>
  );
}

function OneOnOneCard({
  item,
}: {
  item: IndividualDevelopmentProfileSnapshot["oneOnOneGuidance"][number];
}) {
  return (
    <DashboardInfoCardShell className="h-full rounded-[1.3rem] border-slate-200/80 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#118ab2]">
        1:1 razgovor
      </p>
      <div className="mt-4 space-y-3">
        <InfoPanel label="Pitanje" tone="info">
          {item.question}
        </InfoPanel>
        <InfoPanel label="Šta slušati" tone="warning">
          {item.whatToListenFor}
        </InfoPanel>
        <InfoPanel label="Signal koji se provjerava">{item.signalBeingChecked}</InfoPanel>
        <InfoPanel label="Moguće potpitanje">{item.possibleFollowUp}</InfoPanel>
      </div>
    </DashboardInfoCardShell>
  );
}

function ManagerWatchpointCard({
  item,
}: {
  item: IndividualDevelopmentProfileSnapshot["managerWatchpoints"][number];
}) {
  return (
    <DashboardInfoCardShell className="h-full rounded-[1.3rem] border-slate-200/80 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#073b4c]">
        Tačka pažnje
      </p>
      <div className="mt-4 space-y-3">
        <InfoPanel label="Na šta menadžer treba obratiti pažnju">{item.watchpoint}</InfoPanel>
        <InfoPanel label="Zašto je važno" tone="warning">
          {item.whyItMatters}
        </InfoPanel>
        <InfoPanel label="Rani signal" tone="info">
          {item.earlySignal}
        </InfoPanel>
        <InfoPanel label="Preporučena reakcija menadžera">
          {item.suggestedManagerResponse}
        </InfoPanel>
      </div>
    </DashboardInfoCardShell>
  );
}

function OnboardingStageCard({
  label,
  marker,
  item,
  tone = "neutral",
}: {
  label: string;
  marker: string;
  item: IndividualDevelopmentProfileSnapshot["onboardingPlan"]["first7Days"];
  tone?: "neutral" | "info" | "warning";
}) {
  const markerClassName =
    tone === "warning"
      ? "border-[#ffd166]/55 bg-[#fff5d6] text-[#7a5b00]"
      : tone === "info"
        ? "border-[#118ab2]/20 bg-[#118ab2]/[0.07] text-[#073b4c]"
        : "border-[#073b4c]/15 bg-[#073b4c]/[0.04] text-[#073b4c]";

  return (
    <div className="h-full rounded-[1.15rem] border border-slate-200/80 bg-white/85 p-4 shadow-[0_10px_22px_rgba(15,23,42,0.035)]">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.95rem] border text-sm font-bold ${markerClassName}`}
        >
          {marker}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Faza onboarding plana
          </p>
          <h3 className="mt-1 text-base font-semibold leading-5 text-[#073b4c]">{label}</h3>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <InfoPanel label="Fokus faze" tone={tone}>
          {item.focus}
        </InfoPanel>
        <div className="grid gap-3 lg:grid-cols-2">
          <InfoPanel label="Menadžerske akcije">
            <BulletList
              items={item.managerActions}
              emptyText="U ovom izvještaju nema dodatnih stavki za ovu fazu."
            />
          </InfoPanel>
          <InfoPanel label="Feedback smjernice" tone="info">
            <BulletList
              items={item.feedbackGuidance}
              emptyText="U ovom izvještaju nema dodatnih feedback smjernica za ovu fazu."
            />
          </InfoPanel>
        </div>
        <InfoPanel label="Rani signali za pažnju" tone="warning">
          <BulletList
            items={item.riskSignals}
            emptyText="U ovom izvještaju nema dodatnih watchout signala za ovu fazu."
          />
        </InfoPanel>
      </div>
    </div>
  );
}

function OnboardingSecondaryPanel({
  label,
  items,
  emptyText,
  tone = "neutral",
}: {
  label: string;
  items: string[];
  emptyText: string;
  tone?: "neutral" | "warning";
}) {
  const toneClassName =
    tone === "warning"
      ? "border-[#ffd166]/35 bg-[#fff9e8]"
      : "border-slate-200/80 bg-slate-50/80";

  return (
    <div className={`rounded-[1rem] border px-4 py-4 ${toneClassName}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <div className="mt-3">
        <BulletList items={items} emptyText={emptyText} />
      </div>
    </div>
  );
}

export function IndividualDevelopmentProfileReportView(
  props: IndividualDevelopmentProfileReportViewProps,
) {
  const { snapshot, participantDisplayName, generatedAt, completedAt } =
    normalizeRendererInput(props);

  const generatedAtLabel = formatTimestamp(generatedAt);
  const completedAtLabel = formatTimestamp(completedAt);

  return (
    <div className="space-y-6 pb-12">
      <DashboardInfoCardShell className="rounded-[1.6rem] border-slate-200/80 p-6 sm:p-7">
        <div className="space-y-5">
          <DashboardSectionHeader
            eyebrow="Razvojni HR izvještaj"
            eyebrowClassName="text-[#073b4c]"
            title="Individualni razvojni profil"
            description="HR/development izvještaj za onboarding, feedback, 1:1 i razvojni rad."
            className="gap-2"
            titleClassName="max-w-3xl text-[1.95rem] font-extrabold tracking-[-0.05em] text-[#073b4c] sm:text-[2.35rem]"
            descriptionClassName="max-w-3xl text-base leading-7 text-slate-600"
          />

          <div className="flex flex-wrap gap-2.5">
            <DpStatusBadge tone="success" emphasized>
              Spremno za pregled
            </DpStatusBadge>
            <DpStatusBadge className="border-[#118ab2]/20 bg-[#118ab2]/10 text-[#073b4c]" tone="info">
              Razvojni pregled
            </DpStatusBadge>
          </div>

          <div className="rounded-[1.15rem] border border-[#118ab2]/14 bg-[#118ab2]/[0.05] px-4 py-3 text-sm leading-6 text-slate-700">
            <p className="font-semibold text-[#073b4c]">Kako koristiti ovaj izvještaj</p>
            <p className="mt-1.5">
              Ovaj razvojni HR izvještaj služi za onboarding, feedback, 1:1 razgovore i razvojni
              plan. Ne koristi se kao odluka o zapošljavanju i ne predstavlja kliničku procjenu.
            </p>
          </div>

          <div className="grid gap-3 border-t border-slate-200/80 pt-5 md:grid-cols-2 xl:grid-cols-4">
            <MetaCard
              label="Osoba"
              value={participantDisplayName ?? "Nije navedeno"}
              helper="HR razvojni kontekst"
            />
            <MetaCard
              label="Korištenje"
              value="Onboarding, feedback i razvoj"
              helper="Namijenjeno strukturiranom HR i menadžerskom pregledu."
            />
            <MetaCard label="Generisano" value={generatedAtLabel ?? "Nije dostupno"} />
            <MetaCard label="Zadnja priprema" value={completedAtLabel ?? "Nije dostupno"} />
          </div>
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Razvojni sažetak"
          eyebrowClassName="text-[#118ab2]"
          title={snapshot.developmentSummary.headline}
          className="gap-2"
          titleClassName="max-w-4xl text-[1.45rem] font-bold tracking-[-0.04em] text-[#073b4c] sm:text-[1.65rem]"
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <InfoPanel label="Glavni signal">{snapshot.developmentSummary.overallPattern}</InfoPanel>
          </div>
          <div className="space-y-4">
            <InfoPanel label="Najjači doprinosi" tone="info">
              <BulletList
                items={snapshot.developmentSummary.strongestContributionSignals}
                emptyText="U ovom izvještaju nema izdvojenih razvojnih signala za ovu sekciju."
              />
            </InfoPanel>
            <InfoPanel label="Glavna potreba za podrškom" tone="warning">
              {snapshot.developmentSummary.mainSupportNeed}
            </InfoPanel>
          </div>
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Doprinos"
          eyebrowClassName="text-[#073b4c]"
          title="Kako osoba može najbolje doprinijeti"
          description="Sekcija prikazuje postojeće elemente doprinosa i podrške iz izvještaja."
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <InfoPanel label="U kojim uslovima se signal najlakše vidi">
            <BulletList
              items={snapshot.contributionPattern.bestConditions}
              emptyText="U ovom izvještaju nema dodatnih stavki za ovu sekciju."
            />
          </InfoPanel>
          <InfoPanel label="Kako postaviti saradnju" tone="info">
            <BulletList
              items={snapshot.contributionPattern.collaborationConditions}
              emptyText="U ovom izvještaju nema dodatnih stavki za ovu sekciju."
            />
          </InfoPanel>
          <InfoPanel label="Koja podrška najviše pomaže">
            <BulletList
              items={snapshot.contributionPattern.supportPreferences}
              emptyText="U ovom izvještaju nema dodatnih stavki za ovu sekciju."
            />
          </InfoPanel>
          <InfoPanel label="Kako oblikovati razvojnu ulogu" tone="warning">
            <BulletList
              items={snapshot.contributionPattern.roleShapingImplications}
              emptyText="U ovom izvještaju nema dodatnih stavki za ovu sekciju."
            />
          </InfoPanel>
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Tačke opreza"
          eyebrowClassName="text-[#ef476f]"
          title="Šta može blokirati razvoj"
          description="Sekcija organizuje postojeće tačke opreza i podrške iz izvještaja."
        />
        {snapshot.developmentRisks.length > 0 ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {snapshot.developmentRisks.map((item) => (
              <RiskCard
                key={`${item.possibleBlocker}-${item.whatToCheck}`}
                item={item}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[1rem] border border-slate-200/80 bg-white/80 px-4 py-4">
            <EmptyStateText>U ovom izvještaju nema dodatnih razvojnih blokatora za ovu sekciju.</EmptyStateText>
          </div>
        )}
      </DashboardInfoCardShell>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Saradnja"
            eyebrowClassName="text-[#118ab2]"
            title="Komunikacija i feedback"
            description="Sekcija prikazuje postojeće smjernice za komunikaciju i feedback iz izvještaja."
          />
          <div className="mt-5 space-y-4">
            <InfoPanel label="Šta pomaže">
              <BulletList
                items={snapshot.communicationAndFeedbackGuidance.whatHelps}
                emptyText="U ovom izvještaju nema dodatnih smjernica za ovu sekciju."
              />
            </InfoPanel>
            <InfoPanel label="Šta izbjegavati" tone="warning">
              <BulletList
                items={snapshot.communicationAndFeedbackGuidance.whatToAvoid}
                emptyText="U ovom izvještaju nema dodatnih smjernica za ovu sekciju."
              />
            </InfoPanel>
            <InfoPanel label="Kako oblikovati feedback" tone="info">
              <BulletList
                items={snapshot.communicationAndFeedbackGuidance.howToPhraseFeedback}
                emptyText="U ovom izvještaju nema dodatnih smjernica za ovu sekciju."
              />
            </InfoPanel>
            <InfoPanel label="Šta je korisno razjasniti">
              <BulletList
                items={snapshot.communicationAndFeedbackGuidance.whatToClarify}
                emptyText="U ovom izvještaju nema dodatnih smjernica za ovu sekciju."
              />
            </InfoPanel>
          </div>
        </DashboardInfoCardShell>

        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
          <DashboardSectionHeader
            eyebrow="Angažman"
            eyebrowClassName="text-[#073b4c]"
            title="Motivacija i energija"
            description="Sekcija prikazuje postojeće elemente motivacije, energije i validacije iz izvještaja."
          />
          <div className="mt-5 space-y-4">
            <InfoPanel label="Šta najčešće vraća energiju">
              <BulletList
                items={snapshot.motivationAndEnergyGuidance.likelySourcesOfEnergy}
                emptyText="U ovom izvještaju nema dodatnih smjernica za ovu sekciju."
              />
            </InfoPanel>
            <InfoPanel label="Šta može trošiti energiju" tone="warning">
              <BulletList
                items={snapshot.motivationAndEnergyGuidance.likelySourcesOfDrain}
                emptyText="U ovom izvještaju nema dodatnih smjernica za ovu sekciju."
              />
            </InfoPanel>
            <InfoPanel label="Kako podržati angažman" tone="info">
              <BulletList
                items={snapshot.motivationAndEnergyGuidance.supportSignals}
                emptyText="U ovom izvještaju nema dodatnih smjernica za ovu sekciju."
              />
            </InfoPanel>
            <InfoPanel label="Šta HR treba provjeriti">
              <BulletList
                items={snapshot.motivationAndEnergyGuidance.whatToValidate}
                emptyText="U ovom izvještaju nema dodatnih smjernica za ovu sekciju."
              />
            </InfoPanel>
          </div>
        </DashboardInfoCardShell>
      </div>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Razgovor"
          eyebrowClassName="text-[#118ab2]"
          title="1:1 razgovori"
          description="Pitanja i signali ispod služe kao razvojni okvir za HR i menadžerske razgovore."
        />
        {snapshot.oneOnOneGuidance.length > 0 ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {snapshot.oneOnOneGuidance.map((item) => (
              <OneOnOneCard key={`${item.question}-${item.signalBeingChecked}`} item={item} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[1rem] border border-slate-200/80 bg-white/80 px-4 py-4">
            <EmptyStateText>U ovom izvještaju nema dodatnih pitanja za ovu sekciju.</EmptyStateText>
          </div>
        )}
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Plan rada"
          eyebrowClassName="text-[#073b4c]"
          title="Onboarding i razvojni plan"
          description="Sekcija organizuje postojeći onboarding plan iz izvještaja po vremenskim fazama."
        />
        <div className="mt-5 space-y-5">
          <div className="rounded-[1.15rem] border border-[#073b4c]/12 bg-[#073b4c]/[0.035] px-4 py-4 sm:px-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Sažetak plana
            </p>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
              {snapshot.onboardingPlan.summary}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#073b4c]">
                  7 / 30 / 60 / 90
                </p>
                <h3 className="mt-1 text-lg font-semibold leading-6 text-[#073b4c]">
                  Plan po fazama
                </h3>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-600">
                Faze ispod prikazuju strukturisani onboarding plan bez dodatnog tumačenja.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <OnboardingStageCard
                label="Prvih 7 dana"
                marker="7"
                item={snapshot.onboardingPlan.first7Days}
              />
              <OnboardingStageCard
                label="Prvih 30 dana"
                marker="30"
                item={snapshot.onboardingPlan.first30Days}
                tone="info"
              />
              <OnboardingStageCard
                label="31 do 60 dana"
                marker="60"
                item={snapshot.onboardingPlan.days31To60}
                tone="info"
              />
              <OnboardingStageCard
                label="61 do 90 dana"
                marker="90"
                item={snapshot.onboardingPlan.days61To90}
                tone="warning"
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-200/80 pt-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Sekundarne provjere
              </p>
              <h3 className="mt-1 text-base font-semibold leading-6 text-[#073b4c]">
                Kontrolne tačke i rani signali
              </h3>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <OnboardingSecondaryPanel
                label="Menadžerske kontrolne tačke"
                items={snapshot.onboardingPlan.managerCheckpoints}
                emptyText="U ovom izvještaju nema dodatnih kontrolnih tačaka za onboarding plan."
              />
              <OnboardingSecondaryPanel
                label="Rani signali za prilagodbu"
                items={snapshot.onboardingPlan.watchouts}
                emptyText="U ovom izvještaju nema dodatnih ranih signala za prilagodbu onboarding plana."
                tone="warning"
              />
            </div>
          </div>
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Menadžerske smjernice"
          eyebrowClassName="text-[#073b4c]"
          title="Na šta menadžer treba obratiti pažnju"
          description="Sekcija prikazuje postojeće menadžerske tačke pažnje iz izvještaja."
        />
        {snapshot.managerWatchpoints.length > 0 ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {snapshot.managerWatchpoints.map((item) => (
              <ManagerWatchpointCard
                key={`${item.watchpoint}-${item.earlySignal}`}
                item={item}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[1rem] border border-slate-200/80 bg-white/80 px-4 py-4">
            <EmptyStateText>U ovom izvještaju nema dodatnih menadžerskih tačaka pažnje za ovu sekciju.</EmptyStateText>
          </div>
        )}
      </DashboardInfoCardShell>

    </div>
  );
}
