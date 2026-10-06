"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FOCUSES } from "@/lib/athletes";
import { Generating, readGenerate } from "./generating";

const INTENTS = [
  { id: "clarify", label: "Clarify" },
  ...FOCUSES.filter((item) => item.id !== "rest").map((item) => ({ id: item.id, label: item.label })),
];

export function RewriteDay({ date, hasScores, kicker }: { date: string; hasScores: boolean; kicker: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [wait, setWait] = useState("");

  function closeWait() {
    setWait("");
    setError("");
    setPending(false);
  }

  async function run(intent: string, label: string) {
    if (hasScores && !window.confirm("Replace this day? Logged scores on it will be deleted.")) return;
    setPending(true);
    setError("");
    setWait(intent === "clarify" ? "Clarifying the workout" : `Rewriting toward ${label.toLowerCase()}`);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mode: "rewrite", intent, force: hasScores }),
      });
      const data = await readGenerate(response);
      if (!data.ok) {
        setError(data.error || "Rewrite failed.");
        return;
      }
      setWait("");
      setPending(false);
      setOpen(false);
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
        <button className="chip" type="button" data-on={open} onClick={() => setOpen((value) => !value)} disabled={pending}>
          Rewrite
        </button>
      </div>
      {open ? (
        <div className="stack">
          <p className="faint">Clarify keeps this workout. A focus restyles it.</p>
          <div className="chips">
            {INTENTS.map((item) => (
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
