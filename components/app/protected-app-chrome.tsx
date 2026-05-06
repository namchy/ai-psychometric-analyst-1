"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import {
  AuthenticatedAppFooterShell,
  AuthenticatedAppHeaderShell,
  AuthenticatedAppPageShell,
} from "@/components/app/authenticated-app-chrome";

type ProtectedAppChromeProps = {
  children: ReactNode;
  showHrLink: boolean;
  userEmail: string;
  userName?: string | null;
};

type ProtectedChromeVariant = "candidate" | "hr";
type ProtectedChromeMode = "standard" | "focus";

const PRIMARY_NAV_ITEMS = ["Testovi", "Reports"] as const;

function getProtectedChromeVariant(pathname: string | null): ProtectedChromeVariant {
  return pathname?.startsWith("/app") ? "candidate" : "hr";
}

function getProtectedChromeMode(pathname: string | null): ProtectedChromeMode {
  if (!pathname?.startsWith("/app/attempts/")) {
    return "standard";
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments.length < 4 || segments[0] !== "app" || segments[1] !== "attempts") {
    return "standard";
  }

  const executionSegment = segments[3];

  if (executionSegment === "run" || executionSegment === "pre-test") {
    return "focus";
  }

  if (executionSegment === "practice") {
    return "focus";
  }

  return "standard";
}

function getInitials(userName?: string | null, userEmail?: string | null) {
  const source = userName?.trim() || userEmail?.trim() || "Deep Profile";

  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function CandidateSiteHeader({
  showHrLink,
  userEmail,
  userName,
}: {
  showHrLink: boolean;
  userEmail: string;
  userName?: string | null;
}) {
  const initials = getInitials(userName, userEmail);

  return (
    <AuthenticatedAppHeaderShell>
      <div className="flex min-w-0 items-center gap-4 lg:gap-10">
        <Link
          href="/app"
          className="shrink-0 font-headline text-lg font-bold tracking-[-0.04em] text-[var(--dp-text)] transition-opacity hover:opacity-90 sm:text-xl"
        >
          Deep Profile
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-2 lg:flex">
          {PRIMARY_NAV_ITEMS.map((item) => (
            <span
              key={item}
              className={
                item === "Testovi"
                  ? "rounded-full border border-[var(--dp-border-strong)] bg-[var(--dp-primary-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--dp-primary-hover)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                  : "rounded-full px-3 py-1.5 text-sm font-medium text-[var(--dp-text-soft)] transition-colors duration-200 hover:bg-[var(--dp-surface)] hover:text-[var(--dp-text)]"
              }
            >
              {item}
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
        {showHrLink ? (
          <Link
            className="hidden rounded-full border border-[var(--dp-border)] bg-[var(--dp-surface)] px-3 py-2 text-[11px] font-label font-semibold uppercase tracking-[0.16em] text-[var(--dp-text-soft)] transition-all duration-200 hover:border-[var(--dp-border-strong)] hover:text-[var(--dp-primary-hover)] lg:inline-flex"
            href="/dashboard"
          >
            HR Workspace
          </Link>
        ) : null}

        <button
          aria-label="Settings"
          className="min-h-0 rounded-xl border border-transparent bg-transparent p-2 text-[var(--dp-text-soft)] shadow-none transition-all duration-200 hover:border-[var(--dp-border)] hover:bg-[var(--dp-surface)] hover:text-[var(--dp-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dp-primary)]/20"
          type="button"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="2.8" />
            <path d="M12 4.5v1.3" />
            <path d="M12 18.2v1.3" />
            <path d="m6.7 6.7.9.9" />
            <path d="m16.4 16.4.9.9" />
            <path d="M4.5 12h1.3" />
            <path d="M18.2 12h1.3" />
            <path d="m6.7 17.3.9-.9" />
            <path d="m16.4 7.6.9-.9" />
          </svg>
        </button>

        <div className="ml-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/80 bg-gradient-to-br from-[var(--dp-primary)] to-[var(--dp-insight)] text-xs font-bold text-white shadow-[0_10px_24px_rgba(20,184,166,0.22)]">
          <span>{initials || "DP"}</span>
        </div>

        <form action={logout} className="hidden md:block">
          <button
            className="min-h-0 rounded-full border border-[var(--dp-border)] bg-[var(--dp-surface)] px-4 py-2 text-[11px] font-label font-semibold uppercase tracking-[0.18em] text-[var(--dp-text-soft)] shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-[var(--dp-border-strong)] hover:text-[var(--dp-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--dp-primary)]/20"
            type="submit"
          >
            Odjava
          </button>
        </form>
      </div>
    </AuthenticatedAppHeaderShell>
  );
}

function HrSiteHeader() {
  return (
    <AuthenticatedAppHeaderShell>
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href="/dashboard"
          className="shrink-0 font-headline text-lg font-bold tracking-[-0.04em] text-slate-900 transition-opacity hover:opacity-90 sm:text-xl"
        >
          Deep Profile
        </Link>
        <span className="hidden rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] lg:inline-flex">
          HR Workspace
        </span>
      </div>

      <form action={logout} className="shrink-0">
        <button
          className="min-h-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-label font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-teal-200 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          type="submit"
        >
          Sign out
        </button>
      </form>
    </AuthenticatedAppHeaderShell>
  );
}

function CandidateSiteFooter({ showHrLink }: { showHrLink: boolean }) {
  return (
    <AuthenticatedAppFooterShell>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
        <p className="font-label text-[11px] uppercase tracking-[0.16em] text-[var(--dp-text-soft)]">
          © 2026 <strong>RE:SELEKCIJA</strong>. All rights reserved.
        </p>
        {showHrLink ? (
          <Link
            className="font-label text-[11px] uppercase tracking-[0.16em] text-[var(--dp-text-soft)] transition-colors duration-200 hover:text-[var(--dp-primary-hover)]"
            href="/hr"
          >
            HR Workspace
          </Link>
        ) : null}
      </div>

      <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <a
          className="font-label text-[11px] uppercase tracking-[0.16em] text-[var(--dp-text-soft)] transition-colors duration-200 hover:text-[var(--dp-primary-hover)]"
          href="/"
        >
          Privacy Policy
        </a>
        <a
          className="font-label text-[11px] uppercase tracking-[0.16em] text-[var(--dp-text-soft)] transition-colors duration-200 hover:text-[var(--dp-primary-hover)]"
          href="/"
        >
          Terms of Service
        </a>
        <a
          className="font-label text-[11px] uppercase tracking-[0.16em] text-[var(--dp-text-soft)] transition-colors duration-200 hover:text-[var(--dp-primary-hover)]"
          href="/"
        >
          Security
        </a>
      </nav>
    </AuthenticatedAppFooterShell>
  );
}

function HrSiteFooter() {
  return (
    <AuthenticatedAppFooterShell>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
        <p className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-600">
          © 2026 <strong>RE:SELEKCIJA</strong>. All rights reserved.
        </p>
      </div>

      <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <a
          className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-600 transition-colors duration-200 hover:text-teal-700"
          href="/"
        >
          Privacy Policy
        </a>
        <a
          className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-600 transition-colors duration-200 hover:text-teal-700"
          href="/"
        >
          Terms of Service
        </a>
        <a
          className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-600 transition-colors duration-200 hover:text-teal-700"
          href="/"
        >
          Security
        </a>
      </nav>
    </AuthenticatedAppFooterShell>
  );
}

export function ProtectedAppChrome({
  children,
  showHrLink,
  userEmail,
  userName,
}: ProtectedAppChromeProps) {
  const pathname = usePathname();
  const variant = getProtectedChromeVariant(pathname);
  const mode = getProtectedChromeMode(pathname);
  const contentTopPaddingClassName =
    mode === "focus" ? "pt-6 sm:pt-8" : variant === "candidate" ? "pt-20" : "pt-[120px]";
  const pageShellClassName =
    variant === "candidate"
      ? "bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.07),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(167,139,250,0.08),_transparent_22%),linear-gradient(180deg,var(--dp-bg)_0%,var(--dp-bg)_100%)]"
      : undefined;

  return (
    <AuthenticatedAppPageShell className={pageShellClassName}>
      {mode === "standard"
        ? variant === "candidate"
          ? (
            <CandidateSiteHeader
              showHrLink={showHrLink}
              userEmail={userEmail}
              userName={userName}
            />
            )
          : (
            <HrSiteHeader />
            )
        : null}

      <div className={`flex-1 ${contentTopPaddingClassName}`}>{children}</div>

      {mode === "standard"
        ? variant === "candidate"
          ? <CandidateSiteFooter showHrLink={showHrLink} />
          : <HrSiteFooter />
        : null}
    </AuthenticatedAppPageShell>
  );
}
