"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BedDouble, CalendarCheck, Hotel } from "lucide-react";

const codeHints = [
  "1 Manager",
  "2 Front desk",
  "3 HK supervisor",
  "31 Ava",
  "32 Ben",
  "33 Mia",
  "34 Noah",
  "4 Maintenance",
];

export function DemoLoginForm() {
  const router = useRouter();
  const [credential, setCredential] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(() => {
      void fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: credential }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(body?.error ?? "Demo login failed.");
          }
          const body = (await response.json()) as { memberships?: { hotelId: string; role: string }[] };
          const primary = body.memberships?.[0];
          router.push(primary && primary.role !== "owner" ? `/hotels/${primary.hotelId}` : "/portfolio");
          router.refresh();
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
    });
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <span className="brand-mark"><Hotel size={22} /></span>
          <div>
            <p className="eyebrow">Hotel Management</p>
            <h1>Welcome back</h1>
            <p>Sign in to the local operations dashboard.</p>
          </div>
        </div>
        <form className="login-form" onSubmit={submit}>
          <label>
            <span>Demo access code</span>
            <input
              autoFocus
              inputMode="numeric"
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              placeholder="1, 2, 3, 31-34, or 4"
            />
          </label>
          <button className="primary-button" type="submit" disabled={pending || credential.trim().length === 0}>
            <ArrowRight size={17} />
            {pending ? "Signing in..." : "Enter dashboard"}
          </button>
        </form>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="code-grid">
          {codeHints.map((hint) => (
            <span key={hint}>{hint}</span>
          ))}
        </div>
        <p className="prototype-note">Prototype login only. Replace before real hotel deployment.</p>
        <p className="hosted-owner-note">Hosted owner demo: enter 0 for portfolio.</p>
      </section>
      <aside className="login-showcase" aria-label="Operations preview">
        <div className="showcase-card large">
          <span>Occupancy</span>
          <strong>78%</strong>
          <i />
        </div>
        <div className="showcase-row">
          <div className="showcase-card">
            <CalendarCheck size={20} />
            <strong>12</strong>
            <span>Arrivals</span>
          </div>
          <div className="showcase-card">
            <BedDouble size={20} />
            <strong>34</strong>
            <span>Rooms</span>
          </div>
        </div>
      </aside>
    </main>
  );
}
