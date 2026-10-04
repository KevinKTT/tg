"use client";

import { useEffect, useState } from "react";

export function Generating({
  title,
  detail,
  error,
  onDismiss,
}: {
  title: string;
  detail: string;
  error: string;
  onDismiss: () => void;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (error) return;
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [error]);

  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <section className="card stack loading-card">
        <p className="kicker">{error ? "Stopped" : "Coach"}</p>
        <h2>{error ? "Could not write it" : title}</h2>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <>
            <p className="muted">{detail}</p>
            <p className="faint">{seconds}s</p>
            <div className="loading-bar" aria-hidden="true" />
          </>
        )}
        {error ? (
          <button className="btn" type="button" onClick={onDismiss}>
            Close
          </button>
        ) : null}
      </section>
    </div>
  );
}

export async function readGenerate(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as { ok: boolean; error?: string; code?: string };
  } catch {
    return { ok: false as const, error: text.slice(0, 240) || `The generator returned ${response.status}.` };
  }
}
