import Link from "next/link";
import { redirect } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import { SetupPanel } from "@/components/setup-panel";
import { getIdentity, isClerkConfigured, isDemoMode } from "@/lib/authz";
import { isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (isDemoMode()) {
    const identity = await getIdentity();
    redirect(identity ? "/portfolio" : "/sign-in");
  }
  if (!isClerkConfigured() || !isDatabaseConfigured()) {
    return <SetupPanel clerkConfigured={isClerkConfigured()} databaseConfigured={isDatabaseConfigured()} />;
  }
  const identity = await getIdentity();
  if (identity) redirect("/portfolio");
  return (
    <div className="page-shell">
      <AppTopbar />
      <main className="container">
        <section className="panel stack">
          <p className="eyebrow">Invite-only access</p>
          <h1>Hosted hotel operations</h1>
          <p className="muted">Sign in with an invited account to see your hotel portfolio or assigned hotel workspace.</p>
          <Link className="button primary" href="/sign-in">Sign in</Link>
        </section>
      </main>
    </div>
  );
}
