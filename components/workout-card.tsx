"use client";

import { editDay, editPart, removeDay, removeScore, saveScore } from "@/lib/actions";
import { DAY_TRACK, type Sex } from "@/lib/athletes";
import { formatLabel } from "@/lib/formats";
import { findPercents } from "@/lib/resolve";
import { formatLoad, formatTime, higherIsBetter } from "@/lib/scoring";
import { closestLoad, formatPercentLoad, percentOf, type Plate } from "@/lib/scaling";
import type { DayView, EquipmentRow, MovementRow, PrRow, ScoreView } from "@/lib/db";
import { useAthlete } from "./athlete";

const KIND: Record<string, string> = {
  warmup: "Warm-up",
  prep: "Workout prep",
  strength: "Strength",
  metcon: "Metcon",
  skill: "Skill",
  cooldown: "Cool-down",
};

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
  const person = current;
  const track = day.tracks.find((item) => item.track === DAY_TRACK) ?? day.tracks[0];

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
  const kicker = [formatLabel(day.format), day.focus || day.source].filter(Boolean).join(" · ");

  return (
    <div className="stack">
      <section className="card stack">
        <div className="spread">
          <div>
            <p className="kicker">{kicker}</p>
            <h2>{day.title}</h2>
          </div>
        </div>
        <p className="muted">{day.stimulus}</p>
        <p className="faint">{person.initials}</p>
        {hits.length ? (
          <LoadCallout hits={hits} athlete={person.slug} sex={person.sex} unit={unit} prs={prs} movements={movements} equipment={equipment} />
        ) : null}
      </section>

      {track.summary ? (
        <section className="card">
          <p className="kicker">Equipment &amp; loads</p>
          <p className="pre">{track.summary}</p>
        </section>
      ) : null}

      {track.parts.map((part) => {
        const mine = scores.find((score) => score.partId === part.id && score.athleteSlug === athlete);
        return (
          <section className="card" key={part.id}>
            <p className="kicker">{KIND[part.kind] || part.kind}</p>
            <h3>{part.name}</h3>
            {part.format ? <p className="muted">{part.format}</p> : null}
            {part.timeCapSec ? <p className="faint">Cap {formatTime(part.timeCapSec)}</p> : null}
            <p className="pre">{part.body}</p>
            {part.scoreType !== "none" ? (
              <ScoreForm partId={part.id} scoreType={part.scoreType} athlete={athlete} unit={unit} existing={mine?.display} />
            ) : null}
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
        <p key={row} className="muted">
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

