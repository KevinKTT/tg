"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="card stack">
      <h1>Something broke</h1>
      <p className="error">{error.message}</p>
      <button className="btn" type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
