import Link from "next/link";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

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

type DashboardCtaVariant = "primary" | "secondary" | "disabled";
type DashboardCtaSize = "sm" | "md";
type DashboardStatusTone = "neutral" | "success" | "info" | "warning" | "danger";
type DpReportCardVariant = "standard" | "composite";
type DpReportStateMessageTone = "neutral" | "info";

export function getDashboardCtaClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
}: {
  variant?: DashboardCtaVariant;
  size?: DashboardCtaSize;
  fullWidth?: boolean;
}) {
  const sizeClassName =
    size === "sm"
      ? "px-4 py-2.5 text-[12px] tracking-[0.14em]"
      : "px-5 py-3 text-xs tracking-[0.16em]";
  const baseClassName = joinClassNames(
    "inline-flex min-h-0 items-center justify-center gap-2 rounded-full border font-bold uppercase transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-current [&_svg]:stroke-current",
    sizeClassName,
    fullWidth && "w-full",
  );

  if (variant === "secondary") {
    return joinClassNames(
      baseClassName,
      "border-slate-300 bg-white text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)] hover:border-teal-300 hover:text-teal-700",
    );
  }

  if (variant === "disabled") {
    return joinClassNames(
      baseClassName,
      "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500 shadow-none",
    );
  }

  return joinClassNames(
    baseClassName,
    "border-[rgba(7,59,76,0.08)] bg-[#079985] text-white visited:text-white hover:-translate-y-0.5 hover:border-[#073b4c] hover:bg-[#073b4c] hover:text-white hover:no-underline hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)] focus-visible:bg-[#073b4c] focus-visible:text-white focus-visible:no-underline focus-visible:ring-[rgba(17,138,178,0.32)] active:translate-y-0 active:border-[#073b4c] active:bg-[#073b4c] active:text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)]",
  );
}

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

export function DpReportCard({
  children,
  className,
  reportType,
  dataReportType,
  reportStatus,
  dataReportStatus,
  reportSlug,
  dataUi = "report-card",
  variant = "standard",
}: {
  children: ReactNode;
  className?: string;
  reportType?: string;
  dataReportType?: string;
  reportStatus?: string | null;
  dataReportStatus?: string | null;
  reportSlug?: string | null;
  dataUi?: string;
  variant?: DpReportCardVariant;
}) {
  const variantClassName =
    variant === "composite"
      ? "mt-6 max-w-[920px] rounded-[1.5rem] border border-[rgba(7,59,76,0.08)] border-l-4 border-l-[#073b4c] bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_14px_27px_rgba(15,23,42,0.06)] min-[900px]:mr-auto min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_auto] min-[900px]:items-center min-[900px]:gap-x-8 min-[900px]:p-6"
      : "flex h-full flex-col rounded-[1.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,251,253,0.96))] p-5 shadow-[0_14px_27px_rgba(15,23,42,0.06)] sm:p-6";

  return (
    <article
      className={joinClassNames(variantClassName, className)}
      data-report-slug={reportSlug ?? undefined}
      data-report-status={dataReportStatus ?? reportStatus ?? undefined}
      data-report-type={dataReportType ?? reportType ?? undefined}
      data-ui={dataUi}
    >
      {children}
    </article>
  );
}

export function DpReportStateMessage({
  children,
  className,
  tone = "info",
}: {
  children: ReactNode;
  className?: string;
  tone?: DpReportStateMessageTone;
}) {
  const toneClassName =
    tone === "neutral"
      ? "border-[rgba(7,59,76,0.1)] bg-[rgba(7,59,76,0.035)]"
      : "border-[rgba(17,138,178,0.12)] bg-[rgba(17,138,178,0.045)]";

  return (
    <p
      className={joinClassNames(
        "rounded-[1rem] border px-4 py-3.5 text-sm leading-6 text-slate-700",
        toneClassName,
        className,
      )}
      data-report-tone={tone}
      data-ui="report-state-message"
    >
      {children}
    </p>
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

export function PageNavigation({
  backHref,
  backLabel,
  contextLabel,
  className,
  backLinkVariant = "default",
  breadcrumbMiddleLabel,
  breadcrumbCurrentLabel,
}: {
  backHref: string;
  backLabel: string;
  contextLabel?: string;
  className?: string;
  backLinkVariant?: "default" | "subtle" | "breadcrumb-light";
  breadcrumbMiddleLabel?: string;
  breadcrumbCurrentLabel?: string;
}) {
  const backLinkClassName =
    backLinkVariant === "subtle"
      ? "inline-flex min-h-0 items-center self-start text-[11px] font-medium tracking-[0.01em] text-slate-500 transition hover:text-[#073b4c] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#118ab2]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      : backLinkVariant === "breadcrumb-light"
        ? "inline-flex items-center gap-1 text-[12px] font-medium tracking-[-0.01em] text-slate-500 transition hover:text-[#073b4c] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#118ab2]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:text-[13px]"
        : "inline-flex min-h-0 items-center self-start rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-semibold tracking-[0.01em] text-slate-600 transition hover:border-[#073b4c]/20 hover:bg-white hover:text-[#073b4c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#118ab2]/30 focus-visible:ring-offset-2";

  return (
    <div
      className={joinClassNames(
        backLinkVariant === "breadcrumb-light"
          ? "flex flex-wrap items-center gap-1.5"
          : "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {backLinkVariant === "breadcrumb-light" ? (
        <>
          <Link className={backLinkClassName} href={backHref}>
            <span aria-hidden="true">←</span>
            <span>{backLabel}</span>
          </Link>
          {breadcrumbMiddleLabel ? (
            <>
              <span aria-hidden="true" className="text-slate-300">
                /
              </span>
              <span className="text-[12px] text-slate-500 sm:text-[13px]">
                {breadcrumbMiddleLabel}
              </span>
            </>
          ) : null}
          {breadcrumbCurrentLabel ? (
            <>
              <span aria-hidden="true" className="text-slate-300">
                /
              </span>
              <span className="text-[12px] text-slate-500 sm:text-[13px]">
                {breadcrumbCurrentLabel}
              </span>
            </>
          ) : null}
        </>
      ) : (
        <>
          <Link className={backLinkClassName} href={backHref}>
            {backLabel}
          </Link>

          {contextLabel ? (
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:text-right">
              {contextLabel}
            </span>
          ) : null}
        </>
      )}
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
  ...props
}: {
  children: ReactNode;
  tone?: DashboardStatusTone;
  emphasized?: boolean;
  className?: string;
} & HTMLAttributes<HTMLSpanElement>) {
  const toneClassName = getDashboardStatusBadgeToneClassName(tone);

  return (
    <span
      className={joinClassNames(
        "inline-flex min-h-8 items-center rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] leading-none",
        emphasized && "shadow-[0_8px_18px_rgba(20,184,166,0.12)]",
        toneClassName,
        className,
      )}
      {...props}
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

export function getDashboardStatusBadgeToneClassName(tone: DashboardStatusTone = "neutral") {
  switch (tone) {
    case "success":
      return "border-[rgba(6,214,160,0.22)] bg-[rgba(6,214,160,0.14)] text-[#073b4c]";
    case "info":
      return "border-[rgba(17,138,178,0.18)] bg-[rgba(17,138,178,0.1)] text-[#073b4c]";
    case "warning":
      return "border-[rgba(255,209,102,0.32)] bg-[rgba(255,209,102,0.16)] text-[#073b4c]";
    case "danger":
      return "border-[rgba(239,71,111,0.24)] bg-[rgba(239,71,111,0.14)] text-[#073b4c]";
    case "neutral":
    default:
      return "border-[rgba(7,59,76,0.08)] bg-[rgba(255,255,255,0.72)] text-[#073b4c]";
  }
}

export function DpStatusBadge({
  children,
  tone = "neutral",
  emphasized = false,
  className,
  dataUi = "dp-status-badge",
}: {
  children: ReactNode;
  tone?: DashboardStatusTone;
  emphasized?: boolean;
  className?: string;
  dataUi?: string;
}) {
  return (
    <DashboardStatusBadge
      tone={tone}
      emphasized={emphasized}
      className={className}
      {...{
        "data-tone": tone,
        "data-ui": dataUi,
      }}
    >
      {children}
    </DashboardStatusBadge>
  );
}

type DpButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: DashboardCtaVariant;
  size?: DashboardCtaSize;
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
  dataUi?: string;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
};

export function DpButton({
  children,
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  disabled = false,
  dataUi = "dp-button",
  onClick,
  type = "button",
}: DpButtonProps) {
  const effectiveVariant = disabled ? "disabled" : variant;
  const buttonClassName = joinClassNames(
    getDashboardCtaClassName({
      variant: effectiveVariant,
      size,
      fullWidth,
    }),
    className,
  );
  const dataAttributes = {
    "data-size": size,
    "data-ui": dataUi,
    "data-variant": effectiveVariant,
  };

  if (href && !disabled) {
    return (
      <Link className={buttonClassName} href={href} {...dataAttributes}>
        {children}
      </Link>
    );
  }

  if (href || disabled) {
    return (
      <span className={buttonClassName} {...dataAttributes}>
        {children}
      </span>
    );
  }

  return (
    <button
      className={buttonClassName}
      disabled={disabled}
      onClick={onClick}
      type={type}
      {...dataAttributes}
    >
      {children}
    </button>
  );
}

export function DpMetaGrid({
  children,
  columns = 3,
  className,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const columnClassName =
    columns === 2
      ? "md:grid-cols-2"
      : columns === 4
        ? "md:grid-cols-2 xl:grid-cols-4"
        : "md:grid-cols-3";

  return (
    <div className={joinClassNames("grid gap-3", columnClassName, className)}>
      {children}
    </div>
  );
}

export function DpMetaItem({
  label,
  value,
  helper,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={joinClassNames(
        "rounded-[1rem] border border-slate-200/90 bg-white/75 px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.035)]",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-[#073b4c]">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

export function DpEmptyState({
  title,
  body,
  className,
}: {
  title: ReactNode;
  body: ReactNode;
  className?: string;
}) {
  return (
    <DashboardInfoCardShell className={joinClassNames("rounded-[1.4rem] border-slate-200/80 p-5", className)}>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
        <p className="text-sm leading-6 text-slate-600">{body}</p>
      </div>
    </DashboardInfoCardShell>
  );
}

export function DpInlineMessage({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "success" | "neutral" | "error";
  children: ReactNode;
  className?: string;
}) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={joinClassNames("rounded-[1.2rem] border px-4 py-3 text-sm", toneClassName, className)}>
      {children}
    </div>
  );
}

export function DpPageHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  badges,
  meta,
  className,
}: {
  backHref: string;
  backLabel: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  badges?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={joinClassNames("space-y-3", className)}>
      <PageNavigation backHref={backHref} backLabel={backLabel} backLinkVariant="subtle" />
      <DashboardSectionShell className="shadow-[0_24px_54px_rgba(15,23,42,0.1)] lg:p-7">
        <div className="relative space-y-6">
          <DashboardSectionHeader
            eyebrow={eyebrow}
            eyebrowClassName="text-[#073b4c]"
            title={title}
            titleClassName="text-3xl font-extrabold tracking-[-0.05em] text-[#073b4c] sm:text-4xl"
            description={description}
            descriptionClassName="max-w-3xl text-base text-slate-600"
          />
          {badges ? <div className="flex flex-wrap gap-2.5">{badges}</div> : null}
          {meta ? <div>{meta}</div> : null}
        </div>
      </DashboardSectionShell>
    </div>
  );
}
