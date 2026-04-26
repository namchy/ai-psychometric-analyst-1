import type { HTMLAttributes, ReactNode } from "react";

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export const DASHBOARD_PAGE_SHELL_CLASS_NAME =
  "min-h-[calc(100dvh+2rem)] overflow-x-clip bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.07),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(167,139,250,0.08),_transparent_22%),linear-gradient(180deg,#f4f7fb_0%,#edf2f7_48%,#e8eef4_100%)] text-slate-900 -m-4 sm:m-0 sm:min-h-screen";

export const DASHBOARD_MAIN_CLASS_NAME = "w-full max-w-full px-6 pb-12 pt-[4.5rem] lg:px-12";

export const DASHBOARD_CONTENT_GRID_CLASS_NAME =
  "grid grid-cols-1 gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start";

export const DASHBOARD_SIDEBAR_CLASS_NAME = "lg:h-full lg:border-r lg:border-slate-300/80 lg:pr-10";

export const DASHBOARD_SIDEBAR_STACK_CLASS_NAME = "w-full space-y-4";

export const DASHBOARD_PRIMARY_COLUMN_CLASS_NAME = "min-w-0 w-full";

export const DASHBOARD_PRIMARY_COLUMN_STACK_CLASS_NAME = "space-y-4";

export const DASHBOARD_SECTION_EYEBROW_CLASS_NAME =
  "font-label text-[11px] font-semibold uppercase tracking-[0.2em]";

export function DashboardSectionShell({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={joinClassNames(
        "relative overflow-hidden rounded-[1.75rem] border border-slate-300/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(243,249,249,0.97)_58%,rgba(246,242,255,0.95))] p-3.5 shadow-[0_28px_60px_rgba(15,23,42,0.12)] sm:p-4",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function DashboardInfoCardShell({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <article
      className={joinClassNames(
        "rounded-[1.5rem] border border-slate-300/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,251,253,0.96))] p-3 shadow-[0_14px_27px_rgba(15,23,42,0.06)] sm:p-3.5",
        className,
      )}
      {...props}
    >
      {children}
    </article>
  );
}

export function DashboardSectionHeader({
  eyebrow,
  title,
  description,
  eyebrowClassName,
  className,
  titleClassName,
  descriptionClassName,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  eyebrowClassName?: string;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  return (
    <div className={joinClassNames("flex flex-col gap-1", className)}>
      {eyebrow ? (
        <p className={joinClassNames(DASHBOARD_SECTION_EYEBROW_CLASS_NAME, eyebrowClassName)}>
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={joinClassNames(
          "font-headline text-2xl font-bold tracking-[-0.035em] text-slate-950",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={joinClassNames(
            "font-body text-[14px] leading-6 text-slate-700",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function DashboardCompactMetaRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={joinClassNames(
        "mb-3 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-200 pt-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DashboardCompactMetaItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={joinClassNames("inline-flex items-center gap-2 text-xs font-medium", className)}>{children}</span>;
}

export function DashboardStatusBadge({
  children,
  tone = "neutral",
  emphasized = false,
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "success";
  emphasized?: boolean;
  className?: string;
}) {
  const toneClassName =
    tone === "success"
      ? "border border-teal-300/90 bg-teal-100 text-teal-900"
      : "border border-slate-300/95 bg-slate-100 text-slate-700";

  return (
    <span
      className={joinClassNames(
        "inline-flex min-h-8 items-center rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] leading-none",
        emphasized && "shadow-[0_8px_18px_rgba(20,184,166,0.12)]",
        toneClassName,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DashboardActionRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={joinClassNames("mt-auto", className)}>{children}</div>;
}
