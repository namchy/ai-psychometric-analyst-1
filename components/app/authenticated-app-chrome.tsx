import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export const AUTHENTICATED_APP_PAGE_SHELL_CLASS_NAME =
  "min-h-[calc(100dvh+2rem)] overflow-x-clip bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.07),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(167,139,250,0.08),_transparent_22%),linear-gradient(180deg,#f4f7fb_0%,#edf2f7_48%,#e8eef4_100%)] text-slate-900 -m-4 flex flex-col sm:m-0 sm:min-h-screen";

export const AUTHENTICATED_APP_MAIN_CLASS_NAME = "w-full max-w-full flex-1 px-6 pb-14 pt-[120px] lg:px-12";

export function AuthenticatedAppPageShell({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={joinClassNames(AUTHENTICATED_APP_PAGE_SHELL_CLASS_NAME, className)} style={style}>
      {children}
    </div>
  );
}

export function AuthenticatedAppHeaderShell({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <header
      className={joinClassNames(
        "fixed top-0 z-50 w-full border-b border-slate-300/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.94),rgba(243,247,251,0.9))] shadow-[0_16px_40px_rgba(15,23,42,0.07)] backdrop-blur-xl",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-200/70 to-transparent"
      />
      <div className="mx-auto flex h-16 w-full max-w-full items-center justify-between px-4 sm:px-6 lg:px-12">
        {children}
      </div>
    </header>
  );
}

export function AuthenticatedAppMainContent({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <main className={joinClassNames(AUTHENTICATED_APP_MAIN_CLASS_NAME, className)} {...props}>
      {children}
    </main>
  );
}

export function AuthenticatedAppFooterShell({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <footer
      className={joinClassNames("border-t border-slate-200/80 bg-transparent", className)}
      {...props}
    >
      <div className="flex w-full flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-12">
        {children}
      </div>
    </footer>
  );
}
