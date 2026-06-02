import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
  DashboardStatusBadge,
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
        Šta može blokirati razvoj
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

export function IndividualDevelopmentProfileReportView(
  props: IndividualDevelopmentProfileReportViewProps,
) {
  const { snapshot, participantDisplayName, generatedAt, completedAt, safeStatusMessage } =
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
            <DashboardStatusBadge tone="success" emphasized>
              Spremno za pregled
            </DashboardStatusBadge>
            <DashboardStatusBadge className="border-[#118ab2]/20 bg-[#118ab2]/10 text-[#073b4c]">
              Razvojni pregled
            </DashboardStatusBadge>
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
              helper={safeStatusMessage ?? snapshot.developmentSummary.usageNote}
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
          description={snapshot.developmentSummary.overallPattern}
          className="gap-2"
          titleClassName="max-w-4xl text-[1.45rem] font-bold tracking-[-0.04em] text-[#073b4c] sm:text-[1.65rem]"
          descriptionClassName="max-w-4xl text-sm leading-6 text-slate-600"
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <InfoPanel label="Glavni signal">{snapshot.developmentSummary.overallPattern}</InfoPanel>
            <InfoPanel label="Kako HR može koristiti nalaz" tone="info">
              {snapshot.developmentSummary.usageNote}
            </InfoPanel>
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
          description="Ove smjernice služe HR-u i menadžeru kao radne hipoteze za oblikovanje saradnje i uloge."
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
          description="Svaka kartica je hipoteza za provjeru: šta se može javiti, zašto je važno i kako HR može postaviti podršku."
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
            description="Korisno je razjasniti kako HR i menadžer strukturiraju feedback i dnevnu saradnju."
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
            description="Ovaj signal može pomoći HR-u da provjeri šta održava angažman i šta ga može oslabiti."
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
          description="Sekcija pomaže da se razvojni signal pretvori u operativan 30/60/90 okvir."
        />
        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <InfoPanel label="Prvih 30 dana">
            <BulletList
              items={snapshot.onboardingAndDevelopmentPlan.first30Days}
              emptyText="U ovom izvještaju nema dodatnih stavki za ovu sekciju."
            />
          </InfoPanel>
          <InfoPanel label="31 do 60 dana" tone="info">
            <BulletList
              items={snapshot.onboardingAndDevelopmentPlan.days31To60}
              emptyText="U ovom izvještaju nema dodatnih stavki za ovu sekciju."
            />
          </InfoPanel>
          <InfoPanel label="61 do 90 dana" tone="warning">
            <BulletList
              items={snapshot.onboardingAndDevelopmentPlan.days61To90}
              emptyText="U ovom izvještaju nema dodatnih stavki za ovu sekciju."
            />
          </InfoPanel>
        </div>
      </DashboardInfoCardShell>

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Menadžerske smjernice"
          eyebrowClassName="text-[#073b4c]"
          title="Na šta menadžer treba obratiti pažnju"
          description="Ove tačke ne služe za presudu, nego za rano prepoznavanje tema koje je korisno razjasniti i pratiti."
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

      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-5 sm:p-6">
        <DashboardSectionHeader
          eyebrow="Oprezno čitanje"
          eyebrowClassName="text-[#073b4c]"
          title="Ograničenja tumačenja"
          description="Nalaz treba koristiti kao razvojni okvir koji HR i menadžer potvrđuju kroz razgovor, opažanje rada i onboarding kontekst."
        />
        <div className="mt-5 rounded-[1rem] border border-slate-200/80 bg-slate-50/75 px-4 py-4">
          <BulletList
            items={snapshot.interpretationLimits}
            emptyText="U ovom izvještaju nema dodatnih ograničenja za ovu sekciju."
          />
        </div>
      </DashboardInfoCardShell>
    </div>
  );
}
