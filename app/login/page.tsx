import { LoginForm } from "@/components/auth/login-form";
import { loginScreenContent } from "@/components/auth/login-content";
import { getPostLoginRedirectPathForUserId } from "@/lib/auth/app-context";
import { getAppLocaleCookieValue } from "@/lib/auth/app-locale";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import styles from "./login-scene.module.css";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getAuthenticatedUser();
  const locale = getAppLocaleCookieValue();

  if (user) {
    redirect(await getPostLoginRedirectPathForUserId(user.id));
  }

  return (
    <div className={styles.root}>
      <div className={styles.oceanContainer} aria-hidden="true">
        <div className={`${styles.blobField} ${styles.blobField1}`}>
          <div className={`${styles.blobShape} ${styles.blobShape1}`} />
        </div>
        <div className={`${styles.blobField} ${styles.blobField2}`}>
          <div className={`${styles.blobShape} ${styles.blobShape2}`} />
        </div>
        <div className={`${styles.blobField} ${styles.blobField3}`}>
          <div className={`${styles.blobShape} ${styles.blobShape3}`} />
        </div>
      </div>

      <main className={styles.screenContainer}>
        <section className={`${styles.segment} ${styles.leftSegment}`} aria-hidden="true">
          <div className={`${styles.textWrapper} ${styles.animateDeep}`}>
            <h1 className={styles.brandHeading}>Deep</h1>
          </div>
        </section>

        <section className={`${styles.segment} ${styles.formSegment}`}>
          <div className={styles.formContent}>
            <div className={styles.mobileBrand}>
              <span>{loginScreenContent.brandName}</span>
            </div>
            <LoginForm content={loginScreenContent} initialLocale={locale} />
          </div>
        </section>

        <section className={`${styles.segment} ${styles.rightSegment}`} aria-hidden="true">
          <div className={`${styles.textWrapper} ${styles.animateProfile}`}>
            <h1 className={styles.brandHeading}>Profile</h1>
          </div>
        </section>
      </main>
    </div>
  );
}
