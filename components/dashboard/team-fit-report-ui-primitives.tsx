"use client";

import type { ReactNode } from "react";
import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
} from "@/components/dashboard/primitives";

type Tone = "neutral" | "info" | "warning";

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

function toneClassName(tone: Tone, variants: Record<Tone, string>) {
  return variants[tone];
}

export function ReportShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={joinClassNames("space-y-5 pb-12", className)}>{children}</div>;
}

export function ReportHero({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <DashboardInfoCardShell
      className={joinClassNames(
        "rounded-[1.2rem] border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.97))] p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </DashboardInfoCardShell>
  );
}

export function ReportMetaGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={joinClassNames(
        "space-y-3 rounded-[1rem] border border-slate-200/90 bg-white/80 p-4",
        className,
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">{children}</div>
    </div>
  );
}

export function ReportMetaCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-[#073b4c]">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

export function ReportTabNav<TTabId extends string>({
  tabs,
  activeTab,
  onSelect,
  ariaLabel,
}: {
  tabs: Array<{ id: TTabId; label: string }>;
  activeTab: TTabId;
  onSelect: (id: TTabId) => void;
  ariaLabel: string;
}) {
  return (
    <DashboardInfoCardShell className="sticky top-0 z-10 rounded-[0.95rem] border-slate-200/90 bg-white/95 p-0 backdrop-blur">
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex gap-0 overflow-x-auto border-b border-slate-200/90 px-2 [scrollbar-width:thin]"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`team-fit-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`team-fit-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              className={joinClassNames(
                "inline-flex min-h-0 items-center justify-center whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#118ab2]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                active
                  ? "border-[#073b4c] bg-white text-[#073b4c]"
                  : "border-transparent bg-white text-slate-500 hover:border-[#118ab2]/40 hover:text-[#073b4c]",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </DashboardInfoCardShell>
  );
}

export function ReportTabPanel<TTabId extends string>({
  id,
  activeTab,
  children,
}: {
  id: TTabId;
  activeTab: TTabId;
  children: ReactNode;
}) {
  const active = activeTab === id;

  return (
    <section
      id={`team-fit-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`team-fit-tab-${id}`}
      hidden={!active}
      className={active ? "block" : "hidden"}
    >
      {children}
    </section>
  );
}

export function ReportSection({
  eyebrow,
  title,
  description,
  eyebrowClassName,
  titleClassName,
  descriptionClassName,
  className,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  eyebrowClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <DashboardInfoCardShell
      className={joinClassNames("rounded-[1.15rem] border-slate-200/80 p-5 sm:p-6", className)}
    >
      <DashboardSectionHeader
        eyebrow={eyebrow}
        eyebrowClassName={eyebrowClassName}
        title={title}
        description={description}
        className="gap-2"
        titleClassName={titleClassName}
        descriptionClassName={descriptionClassName}
      />
      <div className="mt-5">{children}</div>
    </DashboardInfoCardShell>
  );
}

export function InsightCard({
  eyebrow,
  title,
  summary,
  helper,
  tone = "neutral",
}: {
  eyebrow: string;
  title?: string;
  summary?: ReactNode;
  helper?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div
      className={joinClassNames(
        "rounded-[1.15rem] border px-4 py-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)]",
        toneClassName(tone, {
          neutral: "border-slate-200/80 bg-white/80",
          info: "border-[#118ab2]/18 bg-[#118ab2]/[0.06]",
          warning:
            "border-[#ef476f]/18 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,71,111,0.05))]",
        }),
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {eyebrow}
      </p>
      {title ? <h3 className="mt-2 text-base font-bold text-[#073b4c]">{title}</h3> : null}
      {summary ? <div className="mt-2 text-[15px] leading-7 text-slate-600">{summary}</div> : null}
      {helper ? <div className="mt-2 text-sm leading-6 text-slate-500">{helper}</div> : null}
    </div>
  );
}

export function CalloutBlock({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <div
      className={joinClassNames(
        "rounded-[1rem] border px-4 py-3",
        toneClassName(tone, {
          neutral: "border-slate-200/80 bg-white/80",
          info: "border-[#118ab2]/15 bg-[#118ab2]/[0.06]",
          warning: "border-[#ffd166]/45 bg-[#fff5d6]",
        }),
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-[15px] leading-7 text-slate-700">{children}</div>
    </div>
  );
}

export function DetailBlock({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <div
      className={joinClassNames(
        "rounded-[1rem] border px-4 py-3",
        toneClassName(tone, {
          neutral: "border-slate-200/80 bg-white/80",
          info: "border-[#118ab2]/15 bg-[#118ab2]/[0.06]",
          warning: "border-[#ef476f]/15 bg-[#ef476f]/[0.05]",
        }),
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-[15px] leading-7 text-slate-700">{children}</div>
    </div>
  );
}

export function ExpandableInsightCard({
  category = "Uvid",
  title,
  summary,
  children,
  defaultOpen = false,
  tone = "neutral",
  actionLabel = "Prikaži detalje",
}: {
  category?: string;
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: Tone;
  actionLabel?: string;
}) {
  return (
    <details
      data-single-open-panel
      open={defaultOpen}
      className={joinClassNames(
        "group rounded-[0.9rem] border shadow-[0_8px_20px_rgba(15,23,42,0.035)] transition hover:border-[#118ab2]/25 hover:shadow-[0_14px_28px_rgba(15,23,42,0.055)]",
        toneClassName(tone, {
          neutral: "border-slate-200/80 bg-white/80",
          info: "border-[#118ab2]/15 bg-[#118ab2]/[0.04]",
          warning: "border-[#ef476f]/15 bg-[#ef476f]/[0.04]",
        }),
      )}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-[0.9rem] px-5 py-4 outline-none transition hover:bg-white/75 focus-visible:ring-2 focus-visible:ring-[#118ab2]/25 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#118ab2]">
            {category}
          </p>
          <p className="text-base font-bold leading-6 text-[#073b4c]">{title}</p>
          {summary ? <p className="max-w-3xl text-[15px] leading-7 text-slate-600">{summary}</p> : null}
        </div>
        <div className="mt-0.5 flex shrink-0 items-start text-right">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 shadow-sm">
            <span className="group-open:hidden">{actionLabel}</span>
            <span className="hidden group-open:inline">Sakrij detalje</span>
            <span
              aria-hidden="true"
              className="ml-0.5 inline-flex h-4 w-4 items-center justify-center text-slate-500 transition group-open:rotate-180"
            >
              ▾
            </span>
          </span>
        </div>
      </summary>
      <div className="border-t border-slate-200/80 bg-white/65 px-5 pb-5 pt-4 text-[15px] leading-7 text-slate-700">
        {children}
      </div>
    </details>
  );
}
