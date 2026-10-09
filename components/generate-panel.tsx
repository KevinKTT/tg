"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { writeDay, restDay } from "@/lib/actions";
import { parseISO, weekdayShort, weekDates } from "@/lib/dates";
import { Generating, readGenerate } from "./generating";

export function GeneratePanel({ date, hasWorkout }: { date: string; hasWorkout: boolean }) {
  const router = useRouter();
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [wait, setWait] = useState("");

  function closeWait() {
    setWait("");
    setError("");
    setPending(false);
  }

  async function run() {
    if (hasWorkout && !window.confirm("Replace this day? Logged scores on it will be deleted.")) return;
    setPending(true);
    setError("");
    setStatus("");
    setWait("Writing the workout");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            mode: "program",
            force: hasWorkout,
          }),
      });
      const data = await readGenerate(response);
      if (!data.ok) {
        setError(data.error || "Generation failed.");
        return;
      }
      setWait("");
      setPending(false);
      router.refresh();
    } catch {
      setError("Could not reach the generator.");
    }
  }

  async function runWeek() {
    if (replace && !window.confirm("Replace this week? Logged scores on replaced days will be deleted.")) return;
    setPending(true);
    setError("");
    setStatus("");
    setWait("Writing the week");
    const dates = weekDates(date);
    try {
      for (let index = 0; index < dates.length; index += 1) {
        const day = dates[index];
        const rest = parseISO(day).getDay() === 0;
        setStatus(`${weekdayShort(day)}…`);
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: day,
            mode: rest ? "rest" : "program",
            force: replace,
          }),
        });
        const data = await readGenerate(response);
        if (!data.ok && data.code !== "exists" && data.code !== "scores") {
          setError(data.error || `Stopped on ${day}.`);
          router.refresh();
          return;
        }
      }
      setWait("");
      setPending(false);
      setStatus("Week is on the calendar.");
      router.refresh();
    } catch {
      setError("Could not reach the generator.");
    }
  }

  return (
    <section className="card stack">
      {wait ? (
        <Generating
          title={wait}
          detail={status || "Waiting on the coach. This usually takes a minute."}
          error={error}
          onDismiss={closeWait}
        />
      ) : null}
      <div>
        <p className="kicker">Build the day</p>
        <h2>Program the day</h2>
      </div>
      <p className="muted">One shared workout. The coach varies the day so heavy days and running days do not stack. Sunday is rest.</p>
      {error ? <p className="error">{error}</p> : null}
      {status ? <p className="muted">{status}</p> : null}
      <label className="row">
        <input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} />
        Replace days that already exist
      </label>
      <div className="row">
        <button className="btn btn-primary" type="button" onClick={run} disabled={pending}>
          {pending ? "Writing…" : "Generate workout"}
        </button>
        <button className="btn" type="button" onClick={runWeek} disabled={pending}>
          Generate the week
        </button>
        <form
          action={restDay}
          onSubmit={(event) => {
            if (hasWorkout && !window.confirm("Replace this day with a rest day? Logged scores on it will be deleted.")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="date" value={date} />
          <button className="btn" type="submit" disabled={pending}>
            Mark rest
          </button>
        </form>
      </div>
      <details>
        <summary>Write it yourself</summary>
        <form
          action={writeDay}
          className="stack"
          style={{ marginTop: "0.8rem" }}
          onSubmit={(event) => {
            if (hasWorkout && !window.confirm("Replace this day? Logged scores on it will be deleted.")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="date" value={date} />
          <input className="field" name="title" placeholder="Title" />
          <input className="field" name="stimulus" placeholder="Stimulus" />
          <textarea className="area" name="warmup" placeholder="Warm-up" required />
          <textarea className="area" name="prep" placeholder="Workout prep, optional" />
          <textarea className="area" name="strength" placeholder="Strength, optional" />
          <textarea className="area" name="metcon" placeholder="Metcon" required />
          <div className="score-grid">
            <select className="select" name="scoreType" defaultValue="time">
              <option value="time">For time</option>
              <option value="reps">Reps</option>
              <option value="rounds_reps">Rounds + reps</option>
              <option value="load">Load</option>
              <option value="done">Done</option>
              <option value="none">Not scored</option>
            </select>
            <input className="field" name="timeCap" type="number" min="1" placeholder="Cap, minutes" />
          </div>
          <textarea className="area" name="cooldown" placeholder="Cool-down stretches" required />
          <button className="btn" type="submit">
            Save workout
          </button>
        </form>
      </details>
    </section>
  );
}
