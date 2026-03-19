import { redirect } from "next/navigation";
import { getPostLoginRedirectPathForUserId } from "@/lib/auth/app-context";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  redirect(await getPostLoginRedirectPathForUserId(user.id));
}
