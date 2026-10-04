"use client";

import { useMemo, useState } from "react";
import { changeQuantity, createEquipment, toggleEquipment } from "@/lib/actions";
import { CATEGORIES } from "@/lib/catalog";
import type { EquipmentRow } from "@/lib/db";

export function EquipmentView({ items }: { items: EquipmentRow[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [owned, setOwned] = useState<"all" | "have" | "need">("all");
  const ownedCount = items.filter((item) => item.owned).length;
  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (category !== "all" && item.category !== category) return false;
        if (owned === "have" && !item.owned) return false;
        if (owned === "need" && item.owned) return false;
        if (query && !`${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      }),
    [items, category, owned, query],
  );

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="kicker">Inventory</p>
          <h1>Equipment</h1>
        </div>
        <p className="muted">{ownedCount} owned</p>
      </div>
      {ownedCount === 0 ? (
        <div className="banner">
          Nothing marked owned yet. Flip the gear you have to <strong>Have</strong> below, or add a piece, and the coach can
          start building workouts from it.
        </div>
      ) : null}
      <p className="muted">Workouts only use what is marked owned, including the exact bells and plates.</p>
      <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
      <div className="chips">
        <button className="chip" type="button" data-on={owned === "all"} onClick={() => setOwned("all")}>
          All
        </button>
        <button className="chip" type="button" data-on={owned === "have"} onClick={() => setOwned("have")}>
          Have
        </button>
        <button className="chip" type="button" data-on={owned === "need"} onClick={() => setOwned("need")}>
          Need
        </button>
        {CATEGORIES.map((item) => (
          <button
            className="chip"
            type="button"
            key={item.id}
            data-on={category === item.id}
            onClick={() => setCategory(category === item.id ? "all" : item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <section className="card" style={{ paddingTop: 0, paddingBottom: 0 }}>
        {visible.map((item) => (
          <div className="gear-row" data-owned={item.owned} key={item.slug}>
            <div>
              <div className="gear-name">{item.name}</div>
              <div className="faint">{CATEGORIES.find((entry) => entry.id === item.category)?.label}</div>
            </div>
            <div className="row">
              {item.kind !== "item" && item.owned ? (
                <div className="stepper">
                  <form action={changeQuantity}>
                    <input type="hidden" name="slug" value={item.slug} />
                    <input type="hidden" name="quantity" value={Math.max(0, item.quantity - 1)} />
                    <button type="submit" aria-label={`Fewer ${item.name}`}>
                      −
                    </button>
                  </form>
                  <span>{item.quantity}</span>
                  <form action={changeQuantity}>
                    <input type="hidden" name="slug" value={item.slug} />
                    <input type="hidden" name="quantity" value={item.quantity + 1} />
                    <button type="submit" aria-label={`More ${item.name}`}>
                      +
                    </button>
                  </form>
                </div>
              ) : null}
              <form action={toggleEquipment}>
                <input type="hidden" name="slug" value={item.slug} />
                <input type="hidden" name="owned" value={item.owned ? "1" : "0"} />
                <button className={item.owned ? "btn btn-primary" : "btn"} type="submit">
                  {item.owned ? "Have" : "Need"}
                </button>
              </form>
            </div>
          </div>
        ))}
        {visible.length === 0 ? <p className="muted">Nothing in this filter.</p> : null}
      </section>
      <form action={createEquipment} className="card stack">
        <h2>Add a piece</h2>
        <input className="field" name="name" placeholder="Name" required />
        <div className="score-grid">
          <select className="select" name="category" defaultValue="accessory">
            {CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <select className="select" name="kind" defaultValue="item">
            <option value="item">Yes / no</option>
            <option value="implement">Has a weight</option>
            <option value="plate">Plate</option>
            <option value="bar">Bar</option>
          </select>
        </div>
        <div className="score-grid">
          <input className="field" name="load" type="number" step="0.5" placeholder="Weight, optional" />
          <select className="select" name="unit" defaultValue="lb">
            <option value="lb">lb</option>
            <option value="kg">kg</option>
          </select>
        </div>
        <input className="field" name="quantity" type="number" min="1" defaultValue="1" />
        <button className="btn" type="submit">
          Add and mark owned
        </button>
      </form>
    </div>
  );
}
