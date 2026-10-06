"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FOCUSES } from "@/lib/athletes";
import { addDays, formatShort, startOfWeek, weekdayShort } from "@/lib/dates";
import { Generating, readGenerate } from "./generating";

export function WeekProgram({ anchor }: { anchor: string }) {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [focuses, setFocuses] = useState<string[]>(["auto", "auto", "auto", "auto", "auto", "auto", "rest"]);
  const [replace, setReplace] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const start = useMemo(() => addDays(startOfWeek(anchor), offset * 7), [anchor, offset]);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(start, index));

  async function run() {
    setPending(true);
    setError("");
    setStatus("");
    try {
      for (let index = 0; index < dates.length; index += 1) {
        const date = dates[index];
        const focus = focuses[index];
        setStatus(`${weekdayShort(date)}…`);
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            mode: focus === "rest" ? "rest" : "program",
            ...(focus !== "auto" ? { focus } : {}),
            force: replace,
          }),
        });
        const data = await readGenerate(response);
        if (!data.ok && data.code !== "exists" && data.code !== "scores") {
          setError(data.error || `Stopped on ${date}.`);
          router.refresh();
          return;
        }
      }
      setPending(false);
      setStatus("Week is on the calendar.");
      router.refresh();
    } catch {
      setError("Could not reach the generator.");
    }
  }

  return (
    <section className="card stack">
      {pending ? (
        <Generating
          title="Writing the week"
          detail={status || "Waiting on the coach. This usually takes a minute."}
          error={error}
          onDismiss={() => {
            setPending(false);
            setError("");
          }}
        />
      ) : null}
      <div className="spread">
        <div>
          <p className="kicker">Schedule</p>
          <h2>Program a week</h2>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={() => setOffset((value) => value - 1)}>
            Prev
          </button>
          <button className="btn" type="button" onClick={() => setOffset((value) => value + 1)}>
            Next
          </button>
        </div>
      </div>
      {dates.map((date, index) => (
        <label className="spread" key={date}>
          <span>
            {weekdayShort(date)} <span className="faint">{formatShort(date)}</span>
          </span>
          <select
            className="select"
            style={{ width: "11rem" }}
            value={focuses[index]}
            onChange={(event) => {
              const next = [...focuses];
              next[index] = event.target.value;
              setFocuses(next);
            }}
          >
            <option value="auto">Coach</option>
            {FOCUSES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="row">
        <input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} />
        Replace days that already exist
      </label>
      {status ? <p className="muted">{status}</p> : null}
      <button className="btn btn-primary" type="button" onClick={run} disabled={pending}>
        {pending ? "Writing the week…" : "Generate the week"}
      </button>
    </section>
  );
}
