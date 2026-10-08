"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FOCUSES } from "@/lib/athletes";
import { Generating, readGenerate } from "./generating";

const RESTYLES = FOCUSES.filter((item) => item.id !== "rest");

export function RewriteDay({ date, hasScores, kicker }: { date: string; hasScores: boolean; kicker: string }) {
  const router = useRouter();
  const [panel, setPanel] = useState<"" | "clarify" | "rewrite">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [wait, setWait] = useState("");

  function closeWait() {
    setWait("");
    setError("");
    setPending(false);
  }

  function toggle(next: "clarify" | "rewrite") {
    setPanel((value) => (value === next ? "" : next));
    setError("");
  }

  async function run(intent: string, label: string, coachNote?: string) {
    if (hasScores && !window.confirm("Replace this day? Logged scores on it will be deleted.")) return;
    setPending(true);
    setError("");
    setWait(intent === "clarify" ? "Clarifying the workout" : `Rewriting toward ${label.toLowerCase()}`);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mode: "rewrite", intent, note: coachNote, force: hasScores }),
      });
      const data = await readGenerate(response);
      if (!data.ok) {
        setError(data.error || "Rewrite failed.");
        return;
      }
      setWait("");
      setPending(false);
      setPanel("");
      setNote("");
      router.refresh();
    } catch {
      setError("Could not reach the coach.");
    }
  }

  return (
    <div className="board-rewrite">
      {wait ? (
        <Generating title={wait} detail="Waiting on the coach. This usually takes a minute." error={error} onDismiss={closeWait} />
      ) : null}
      <div className="board-top">
        <p className="kicker">{kicker}</p>
        <div className="chips">
          <button className="chip" type="button" data-on={panel === "clarify"} onClick={() => toggle("clarify")} disabled={pending}>
            Clarify
          </button>
          <button className="chip" type="button" data-on={panel === "rewrite"} onClick={() => toggle("rewrite")} disabled={pending}>
            Rewrite
          </button>
        </div>
      </div>
      {panel === "clarify" ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            const text = note.trim();
            if (!text) return;
            void run("clarify", "Clarify", text);
          }}
        >
          <p className="faint">Tell the coach what to fix. The workout stays.</p>
          <textarea
            className="area area-note"
            value={note}
            maxLength={400}
            placeholder="How many rounds? Make this an AMRAP."
            onChange={(event) => setNote(event.target.value)}
            required
          />
          <button className="btn btn-primary" type="submit" disabled={pending || !note.trim()}>
            Ask the coach
          </button>
        </form>
      ) : null}
      {panel === "rewrite" ? (
        <div className="stack">
          <p className="faint">A focus restyles this workout.</p>
          <div className="chips">
            {RESTYLES.map((item) => (
              <button key={item.id} className="chip" type="button" disabled={pending} onClick={() => void run(item.id, item.label)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
