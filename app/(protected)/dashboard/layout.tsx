import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  getAppContextForUserId,
  resolveDashboardWorkspaceAccess,
} from "@/lib/auth/app-context";
import { requireAuthenticatedUser } from "@/lib/auth/session";

type DashboardLayoutProps = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await requireAuthenticatedUser();
  const context = await getAppContextForUserId(user.id);
  const dashboardAccess = resolveDashboardWorkspaceAccess(context);

  if (dashboardAccess.kind === "hr" && dashboardAccess.action === "allow") {
    return <>{children}</>;
  }

  if (dashboardAccess.kind === "candidate") {
    redirect(dashboardAccess.redirectPath);
  }

  if (dashboardAccess.kind === "none") {
    redirect("/app");
  }

  return <>{children}</>;
}
