import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import { DemoLoginForm } from "@/components/demo-login-form";
import { SetupPanel } from "@/components/setup-panel";
import { getIdentity, isClerkConfigured, isDemoMode } from "@/lib/authz";
import { isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (isDemoMode()) {
    const identity = await getIdentity();
    if (identity) redirect("/portfolio");
    return <DemoLoginForm />;
  }
  if (!isClerkConfigured()) {
    return <SetupPanel clerkConfigured={false} databaseConfigured={isDatabaseConfigured()} />;
  }
  const identity = await getIdentity();
  if (identity) redirect("/portfolio");
  return (
    <div className="page-shell">
      <AppTopbar />
      <main className="container">
        <section className="panel stack" style={{ maxWidth: 520 }}>
          <p className="eyebrow">Staff invitation</p>
          <h1>Sign in</h1>
          <p className="muted">Only invited owner and staff accounts can access hotel workspaces.</p>
          <SignIn
            routing="path"
            path="/sign-in"
            forceRedirectUrl="/portfolio"
            fallbackRedirectUrl="/portfolio"
            signUpUrl=""
            withSignUp={false}
          />
        </section>
      </main>
    </div>
  );
}
