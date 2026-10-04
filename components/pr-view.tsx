"use client";

import { createMovement, removePr, savePr } from "@/lib/actions";
import type { Sex } from "@/lib/athletes";
import { MOVEMENT_GROUPS, PERCENT_STEPS } from "@/lib/catalog";
import { todayISO } from "@/lib/dates";
import type { EquipmentRow, MovementRow, PrRow } from "@/lib/db";
import { formatLoad } from "@/lib/scoring";
import { closestLoad, formatPercentLoad, percentOf, type Plate } from "@/lib/scaling";
import { useState } from "react";
import { useAthlete } from "./athlete";

export function PrView({
  movements,
  prs,
  equipment,
  today,
}: {
  movements: MovementRow[];
  prs: PrRow[];
  equipment: EquipmentRow[];
  today: string;
}) {
  const { athlete, current, setAthlete, unit, setUnit, members } = useAthlete();
  const [onlyLogged, setOnlyLogged] = useState(false);
  const person = current;

  if (!person || !athlete) return null;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="kicker">Numbers</p>
          <h1>PRs</h1>
        </div>
        <div className="seg">
          <button type="button" data-on={unit === "lb"} onClick={() => setUnit("lb")}>
            lb
          </button>
          <button type="button" data-on={unit === "kg"} onClick={() => setUnit("kg")}>
            kg
          </button>
        </div>
      </div>
      <div className="seg">
        {members.map((member) => (
          <button
            key={member.slug}
            type="button"
            data-on={athlete === member.slug}
            onClick={() => setAthlete(member.slug)}
          >
            {member.initials}
          </button>
        ))}
      </div>
      <div className="spread">
        <p className="muted">
          Percentages are calculated here, not by the model. {person.name}&apos;s bar is used when you own one.
        </p>
        <button className="chip" type="button" data-on={onlyLogged} onClick={() => setOnlyLogged((value) => !value)}>
          Logged
        </button>
      </div>
      {MOVEMENT_GROUPS.map((group) => {
        const rows = movements.filter((item) => {
          if (item.category !== group.id) return false;
          if (!onlyLogged) return true;
          return prs.some((row) => row.athleteSlug === athlete && row.movementSlug === item.slug);
        });
        if (!rows.length) return null;
        return (
          <section key={group.id} className="stack">
            <h2>{group.label}</h2>
            {rows.map((movement) => (
              <MovementCard
                key={movement.slug}
                movement={movement}
                athlete={athlete}
                sex={person.sex}
                unit={unit}
                today={today}
                history={prs.filter((row) => row.athleteSlug === athlete && row.movementSlug === movement.slug)}
                equipment={equipment}
              />
            ))}
          </section>
        );
      })}
      <form action={createMovement} className="card stack">
        <h2>Add a movement</h2>
        <input className="field" name="name" placeholder="Name" required />
        <div className="score-grid">
          <select className="select" name="category" defaultValue="lift">
            {MOVEMENT_GROUPS.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
          <select className="select" name="scoreKind" defaultValue="load">
            <option value="load">Load</option>
            <option value="reps">Reps</option>
            <option value="time">Time</option>
            <option value="rounds_reps">Rounds + reps</option>
          </select>
        </div>
        <button className="btn" type="submit">
          Add
        </button>
      </form>
    </div>
  );
}

function MovementCard({
  movement,
  athlete,
  sex,
  unit,
  today,
  history,
  equipment,
}: {
  movement: MovementRow;
  athlete: string;
  sex: Sex;
  unit: "lb" | "kg";
  today: string;
  history: PrRow[];
  equipment: EquipmentRow[];
}) {
  const best = history.reduce<PrRow | null>((current, row) => {
    if (!current) return row;
    if (movement.scoreKind === "time") return row.value < current.value ? row : current;
    return row.value > current.value ? row : current;
  }, null);
  const bar = barWeight(sex, equipment);
  const plates = plateList(equipment);

  return (
    <details className="card" open={Boolean(best)}>
      <summary className="spread">
        <h3>{movement.name}</h3>
        <span>{best ? best.display : "Add"}</span>
      </summary>
      <div className="stack" style={{ marginTop: "0.8rem" }}>
      {best && movement.scoreKind === "load" ? (
        <table className="table">
          <thead>
            <tr>
              <th>%</th>
              <th>Target</th>
              <th>Loadable</th>
            </tr>
          </thead>
          <tbody>
            {PERCENT_STEPS.map((pct) => {
              const target = percentOf(best.value, pct);
              const loaded = bar ? closestLoad(target, bar, plates) : null;
              return (
                <tr key={pct}>
                  <td>{pct}</td>
                  <td>{formatPercentLoad(target, unit)}</td>
                  <td className="muted">
                    {loaded ? `${formatLoad(loaded.loaded, unit)} · ${loaded.label}` : bar ? "no plates marked" : "no bar marked"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      {best && movement.scoreKind === "reps" ? (
        <p className="muted">
          {PERCENT_STEPS.map((pct) => `${pct}% ${Math.max(1, Math.round((best.value * pct) / 100))}`).join(" · ")}
        </p>
      ) : null}
      <form action={savePr} className="stack">
        <input type="hidden" name="athlete" value={athlete} />
        <input type="hidden" name="movement" value={movement.slug} />
        <input type="hidden" name="unit" value={unit} />
        {movement.scoreKind === "load" ? (
          <input className="field" name="value" type="number" min="0" step="0.5" placeholder={`Load (${unit})`} required />
        ) : null}
        {movement.scoreKind === "reps" ? (
          <input className="field" name="reps" type="number" min="0" placeholder="Reps" required />
        ) : null}
        {movement.scoreKind === "time" ? (
          <div className="score-grid">
            <input className="field" name="minutes" type="number" min="0" placeholder="Min" required />
            <input className="field" name="seconds" type="number" min="0" max="59" placeholder="Sec" required />
          </div>
        ) : null}
        {movement.scoreKind === "rounds_reps" ? (
          <div className="score-grid">
            <input className="field" name="rounds" type="number" min="0" placeholder="Rounds" required />
            <input className="field" name="reps" type="number" min="0" placeholder="Reps" required />
          </div>
        ) : null}
        <input className="field" name="date" type="date" defaultValue={today || todayISO()} required />
        <input className="field" name="notes" placeholder="Note, optional" />
        <button className="btn" type="submit">
          Save PR
        </button>
      </form>
      {history.length ? (
        <div>
          {history.map((row) => (
            <div className="spread" key={row.id}>
              <span>
                {row.display} <span className="faint">{row.date}</span>
              </span>
              <form
                action={removePr}
                onSubmit={(event) => {
                  if (!window.confirm(`Delete this PR (${row.display} on ${row.date})?`)) event.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={row.id} />
                <button className="btn" type="submit">
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}
      </div>
    </details>
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
