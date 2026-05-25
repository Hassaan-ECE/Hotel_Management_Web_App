import { AlertTriangle, Database, KeyRound } from "lucide-react";
import Link from "next/link";

export function SetupPanel({ clerkConfigured, databaseConfigured }: { clerkConfigured: boolean; databaseConfigured: boolean }) {
  return (
    <main className="container">
      <section className="panel stack">
        <div>
          <p className="eyebrow">Setup required</p>
          <h1>Connect Clerk and Neon to run the hosted app</h1>
          <p className="muted">The app is scaffolded and buildable, but protected workflows need real environment variables.</p>
        </div>
        <div className="grid metric-grid">
          <article className="card">
            <KeyRound size={20} />
            <h2>Clerk invite-only auth</h2>
            <p className={clerkConfigured ? "muted" : "error-text"}>{clerkConfigured ? "Configured" : "Missing Clerk env vars"}</p>
            <span>Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.</span>
          </article>
          <article className="card">
            <Database size={20} />
            <h2>Neon Postgres</h2>
            <p className={databaseConfigured ? "muted" : "error-text"}>{databaseConfigured ? "Configured" : "Missing DATABASE_URL"}</p>
            <span>Provision Neon through Vercel Marketplace and run the Drizzle migration.</span>
          </article>
        </div>
        <div className="notice">
          <AlertTriangle size={18} /> The existing Tauri desktop app was not modified. This is a separate hosted project.
        </div>
        <div className="actions">
          <Link className="button primary" href="/sign-in">Sign in</Link>
          <Link className="button" href="/portfolio">Portfolio</Link>
        </div>
      </section>
    </main>
  );
}