"use client";

import { useEffect, useMemo, useState } from "react";
import { editDay, editPart, removeDay, removeScore, saveScore } from "@/lib/actions";
import { DAY_TRACK, focusLabel, type Sex } from "@/lib/athletes";
import { parseBoard, parseSummary, type BoardLine } from "@/lib/board";
import { clockWorkout } from "@/lib/clock";
import { formatLabel } from "@/lib/formats";
import { findPercents } from "@/lib/resolve";
import { formatLoad, formatTime, higherIsBetter } from "@/lib/scoring";
import { closestLoad, formatPercentLoad, percentOf, type Plate } from "@/lib/scaling";
import type { DayView, EquipmentRow, MovementRow, PartView, PrRow, ScoreView } from "@/lib/db";
import { useAthlete } from "./athlete";
import { useClock } from "./clock";
import { RewriteDay } from "./rewrite-day";

const KIND: Record<string, string> = {
  warmup: "Warm-up",
  prep: "Workout prep",
  strength: "Strength",
  metcon: "Metcon",
  skill: "Skill",
  cooldown: "Cool-down",
};

const HERO = new Set(["strength", "metcon", "skill"]);

export function WorkoutCard({
  day,
  scores,
  prs,
  movements,
  equipment,
}: {
  day: DayView;
  scores: ScoreView[];
  prs: PrRow[];
  movements: MovementRow[];
  equipment: EquipmentRow[];
}) {
  const { athlete, current, unit } = useAthlete();
  const { register } = useClock();
  const person = current;
  const track = day.tracks.find((item) => item.track === DAY_TRACK) ?? day.tracks[0];
  const spec = useMemo(() => {
    if (!athlete || day.status === "rest" || !track) return null;
    return clockWorkout(day.format, day.date, athlete, track.parts);
  }, [athlete, day, track]);

  useEffect(() => {
    register(spec);
    return () => register(null);
  }, [register, spec]);

  if (!person || !athlete) return null;

  if (day.status === "rest") {
    return (
      <section className="card stack">
        <p className="kicker">Rest</p>
        <h2>Take the day</h2>
        <p className="muted">No workout. Walk if you want, then leave it.</p>
        <DeleteDay date={day.date} />
      </section>
    );
  }

  if (!track) return null;
  const text = track.parts.map((part) => part.body).join("\n");
  const hits = findPercents(text);
  const kicker = [formatLabel(day.format), day.focus ? focusLabel(day.focus) : day.source].filter(Boolean).join(" · ");
  const summary = parseSummary(track.summary);
  const heroes = track.parts.filter((part) => HERO.has(part.kind));
  const lastHero = heroes[heroes.length - 1];

  return (
    <div className="stack">
      <section className="board">
        <RewriteDay date={day.date} hasScores={scores.length > 0} kicker={kicker} />
        <h2>{day.title}</h2>
        {day.stimulus ? <p className="board-stimulus">{day.stimulus}</p> : null}
        {summary.equipment.length ? <p className="board-gear">{summary.equipment.join(" · ")}</p> : null}

        {track.parts.map((part) => (
          <div key={part.id}>
            <Piece part={part} date={day.date} showName={heroes.length > 1} />
            {part.id === lastHero?.id ? (
              <Loads loads={summary.loads} initials={person.initials} />
            ) : null}
          </div>
        ))}
        {!lastHero ? <Loads loads={summary.loads} initials={person.initials} /> : null}
        {hits.length ? (
          <LoadCallout hits={hits} athlete={person.slug} sex={person.sex} unit={unit} prs={prs} movements={movements} equipment={equipment} />
        ) : null}
      </section>

      {track.parts.map((part) => {
        if (part.scoreType === "none") return null;
        const mine = scores.find((score) => score.partId === part.id && score.athleteSlug === athlete);
        return (
          <section className="card" key={part.id}>
            <p className="kicker">Score</p>
            <h3>{part.name}</h3>
            <ScoreForm partId={part.id} scoreType={part.scoreType} athlete={athlete} unit={unit} existing={mine?.display} />
            {mine ? (
              <form
                action={removeScore}
                onSubmit={(event) => {
                  if (!window.confirm(`Clear your score of ${mine.display}?`)) event.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={mine.id} />
                <button className="btn" type="submit" style={{ marginTop: "0.6rem" }}>
                  Clear {mine.display}
                </button>
              </form>
            ) : null}
          </section>
        );
      })}

      <DayBoard scores={scores} />

      <details className="card">
        <summary>Edits</summary>
        <div className="stack" style={{ marginTop: "0.8rem" }}>
          <form action={editDay} className="stack">
            <input type="hidden" name="date" value={day.date} />
            <input className="field" name="title" defaultValue={day.title} />
            <textarea className="area" name="stimulus" defaultValue={day.stimulus} />
            <button className="btn" type="submit">
              Save title
            </button>
          </form>
          {track.parts.map((part) => (
            <form action={editPart} className="stack" key={`edit-${part.id}`}>
              <input type="hidden" name="id" value={part.id} />
              <span className="muted">Edit {part.name}</span>
              <input className="field" name="format" defaultValue={part.format} placeholder="Format" />
              <textarea className="area" name="body" defaultValue={part.body} />
              <button className="btn" type="submit">
                Save piece
              </button>
            </form>
          ))}
          <DeleteDay date={day.date} />
        </div>
      </details>
    </div>
  );
}

function checksKey(date: string, partId: number) {
  return `tg-board:${date}:${partId}`;
}

function readChecks(date: string, partId: number) {
  try {
    const raw = localStorage.getItem(checksKey(date, partId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => Number.isInteger(item)) : [];
  } catch {
    return [];
  }
}

function Piece({ part, date, showName }: { part: PartView; date: string; showName: boolean }) {
  const hero = HERO.has(part.kind);
  const lines = parseBoard(part.body);
  const label = KIND[part.kind] || part.kind;
  const [done, setDone] = useState<number[]>([]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setDone(readChecks(date, part.id));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [date, part.id]);

  function toggle(index: number) {
    setDone((current) => {
      const next = current.includes(index) ? current.filter((item) => item !== index) : [...current, index];
      try {
        localStorage.setItem(checksKey(date, part.id), JSON.stringify(next));
      } catch {
        // Storage can be blocked. The check still shows for this view.
      }
      return next;
    });
  }

  return (
    <div className={hero ? "board-piece board-hero" : "board-piece"}>
      <p className="kicker">{label}</p>
      {showName && part.name && part.name !== label ? <h3 className="board-piece-name">{part.name}</h3> : null}
      {part.format ? (
        <p className="board-scheme">
          {part.format}
          {part.timeCapSec ? <span className="board-cap"> · Cap {formatTime(part.timeCapSec)}</span> : null}
        </p>
      ) : part.timeCapSec ? (
        <p className="board-scheme">Cap {formatTime(part.timeCapSec)}</p>
      ) : null}
      {lines.length ? <BoardLines lines={lines} done={done} onToggle={toggle} /> : part.body ? <p className="pre">{part.body}</p> : null}
    </div>
  );
}

function BoardLines({ lines, done, onToggle }: { lines: BoardLine[]; done: number[]; onToggle: (index: number) => void }) {
  return (
    <div className="move-list">
      {lines.map((line, index) =>
        line.type === "note" ? (
          <p className="board-note" key={index}>
            {line.text}
          </p>
        ) : (
          <button
            type="button"
            className="move"
            key={index}
            data-done={done.includes(index) ? "true" : "false"}
            aria-pressed={done.includes(index)}
            onClick={() => onToggle(index)}
          >
            <span className="move-reps">{line.reps}</span>
            <span className="move-name">{line.name}</span>
            {line.scales.map((scale) => (
              <span className="scale-line" key={scale.label}>
                <span className="scale-label">{scale.label}</span>
                {scale.text}
              </span>
            ))}
          </button>
        ),
      )}
    </div>
  );
}

function Loads({ loads, initials }: { loads: { label: string; value: string }[]; initials: string }) {
  if (!loads.length) return null;
  return (
    <div className="load-grid">
      {loads.map((row) => (
        <div className="load-row" key={row.label}>
          <span className="load-label">{row.label}</span>
          <LoadValue value={row.value} initials={initials} />
        </div>
      ))}
    </div>
  );
}

function LoadValue({ value, initials }: { value: string; initials: string }) {
  const parts = value.split(/(\s*\/\s*)/);
  return (
    <span className="load-value">
      {parts.map((part, index) => {
        const mine = Boolean(initials) && new RegExp(`^${initials.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(part.trim());
        return (
          <span key={index} data-mine={mine ? "true" : undefined}>
            {part}
          </span>
        );
      })}
    </span>
  );
}

function LoadCallout({
  hits,
  athlete,
  sex,
  unit,
  prs,
  movements,
  equipment,
}: {
  hits: { pct: number; slug: string; label: string }[];
  athlete: string;
  sex: Sex;
  unit: "lb" | "kg";
  prs: PrRow[];
  movements: MovementRow[];
  equipment: EquipmentRow[];
}) {
  const rows = hits.flatMap((hit) => {
    const movement = movements.find((item) => item.slug === hit.slug);
    if (!movement || movement.scoreKind !== "load") return [];
    const best = prs
      .filter((row) => row.athleteSlug === athlete && row.movementSlug === hit.slug)
      .sort((a, b) => b.value - a.value)[0];
    if (!best) return [`${hit.pct}% ${hit.label}: no PR logged`];
    const target = percentOf(best.value, hit.pct);
    const bar = barWeight(sex, equipment);
    const plates = plateList(equipment);
    const loaded = bar ? closestLoad(target, bar, plates) : null;
    const raw = formatPercentLoad(target, unit);
    const snap = loaded ? `${formatLoad(loaded.loaded, unit)} · ${loaded.label}` : "no bar marked";
    return [`${hit.pct}% ${hit.label}: ${raw} → ${snap}`];
  });
  if (!rows.length) return null;
  return (
    <div>
      {rows.map((row) => (
        <p key={row} className="board-callout">
          {row}
        </p>
      ))}
    </div>
  );
}

function ScoreForm({
  partId,
  scoreType,
  athlete,
  unit,
  existing,
}: {
  partId: number;
  scoreType: string;
  athlete: string;
  unit: "lb" | "kg";
  existing?: string;
}) {
  return (
    <form action={saveScore} className="stack" style={{ marginTop: "0.8rem" }}>
      <input type="hidden" name="partId" value={partId} />
      <input type="hidden" name="athlete" value={athlete} />
      <input type="hidden" name="scoreType" value={scoreType} />
      <input type="hidden" name="unit" value={unit} />
      {scoreType === "time" ? (
        <div className="score-grid">
          <input className="field" name="minutes" type="number" min="0" placeholder="Min" required />
          <input className="field" name="seconds" type="number" min="0" max="59" placeholder="Sec" required />
        </div>
      ) : null}
      {scoreType === "reps" ? <input className="field" name="reps" type="number" min="0" placeholder="Reps" required /> : null}
      {scoreType === "rounds_reps" ? (
        <div className="score-grid">
          <input className="field" name="rounds" type="number" min="0" placeholder="Rounds" required />
          <input className="field" name="reps" type="number" min="0" placeholder="Reps" required />
        </div>
      ) : null}
      {scoreType === "load" ? (
        <input className="field" name="load" type="number" min="0" step="0.5" placeholder={`Load (${unit})`} required />
      ) : null}
      <input className="field" name="notes" placeholder="Note, optional" />
      <button className="btn btn-primary" type="submit">
        {existing ? `Update ${existing}` : "Log score"}
      </button>
    </form>
  );
}

function DayBoard({ scores }: { scores: ScoreView[] }) {
  const { members } = useAthlete();
  const groups = new Map<string, ScoreView[]>();
  for (const score of scores) {
    if (score.scoreType === "none") continue;
    const key = `${score.partKind}:${score.partName}:${score.scoreType}`;
    groups.set(key, [...(groups.get(key) ?? []), score]);
  }
  if (groups.size === 0) return null;
  return (
    <section className="card">
      <p className="kicker">Today</p>
      <h3>Board</h3>
      {[...groups.entries()].map(([key, rows]) => {
        const direction = rows[0]?.scoreDirection === "asc" || !higherIsBetter(rows[0]?.scoreType || "");
        const ranked = [...rows].sort((a, b) => (direction ? a.valueNumeric - b.valueNumeric : b.valueNumeric - a.valueNumeric));
        return (
          <div key={key} style={{ marginTop: "0.7rem" }}>
            <p className="muted">{rows[0].partName}</p>
            {members.map((member) => {
              const score = ranked.find((row) => row.athleteSlug === member.slug);
              const place = score ? ranked.findIndex((row) => row.id === score.id) + 1 : null;
              return (
                <div className="spread" key={member.slug}>
                  <span>{member.initials}</span>
                  <span>
                    {score ? score.display : "—"} {place && ranked.length > 1 ? <span className="faint">#{place}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

function DeleteDay({ date }: { date: string }) {
  return (
    <form
      action={removeDay}
      onSubmit={(event) => {
        if (!window.confirm("Delete this day and its scores?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="date" value={date} />
      <button className="btn btn-danger" type="submit">
        Delete day
      </button>
    </form>
  );
}

function barWeight(sex: Sex, equipment: EquipmentRow[]) {
  const owned = equipment.filter((item) => item.owned && item.kind === "bar" && item.loadValue);
  const womens = owned.find((item) => item.slug === "womens_bar");
  const mens = owned.find((item) => item.slug === "mens_bar");
  if (sex === "f" && womens?.loadValue) return womens.loadValue;
  return mens?.loadValue ?? womens?.loadValue ?? owned[0]?.loadValue ?? null;
}

function plateList(equipment: EquipmentRow[]): Plate[] {
  return equipment
    .filter((item) => item.owned && item.kind === "plate" && item.loadValue && item.quantity >= 2)
    .map((item) => ({
      lb: item.unit === "kg" ? item.loadValue! * 2.2046226218 : item.loadValue!,
      quantity: item.quantity,
      label: `${item.loadValue} ${item.unit}`,
    }));
}

