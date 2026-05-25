"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="container">
      <section className="panel stack">
        <p className="eyebrow">Error</p>
        <h1>Something needs attention</h1>
        <p className="error-text">{error.message}</p>
        <button className="primary" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}