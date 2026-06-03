import type { ReactNode } from "react";
import { ProtectedAppChrome } from "@/components/app/protected-app-chrome";
import { getAppContextForUserId } from "@/lib/auth/app-context";
import { requireAuthenticatedUser } from "@/lib/auth/session";

type ProtectedLayoutProps = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const user = await requireAuthenticatedUser();
  const context = await getAppContextForUserId(user.id);
  const profileName = context.linkedParticipant?.full_name?.trim() || user.user_metadata?.full_name || null;
  const profileEmail = context.linkedParticipant?.email ?? user.email ?? user.id;

  return (
    <ProtectedAppChrome
      showHrLink={context.recommendedAppArea === "hr"}
      userEmail={profileEmail}
      userName={profileName}
    >
      {children}
    </ProtectedAppChrome>
  );
}
