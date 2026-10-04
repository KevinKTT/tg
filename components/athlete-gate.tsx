"use client";

import { useEffect, useRef } from "react";
import { createAthlete } from "@/lib/actions";
import { useAthlete } from "./athlete";

export function AthleteGate() {
  const { ready, hasChosen, members, setAthlete } = useAthlete();
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (ready && !hasChosen && members.length > 0) first.current?.focus();
  }, [ready, hasChosen, members.length]);

  if (!ready || hasChosen) return null;

  return (
    <div className="loading-screen" role="dialog" aria-modal="true" aria-labelledby="athlete-gate-title">
      <section className="card stack loading-card">
        {members.length === 0 ? (
          <>
            <p className="kicker">Welcome</p>
            <h2 id="athlete-gate-title">Set up your gym</h2>
            <p className="muted">Add the first member. You can add the rest from the Members page.</p>
            <form action={createAthlete} className="stack">
              <input className="field" name="name" placeholder="Name" required />
              <div className="score-grid">
                <input className="field" name="initials" placeholder="Initials" maxLength={4} />
                <select className="select" name="sex" defaultValue="m">
                  <option value="m">Male</option>
                  <option value="f">Female</option>
                </select>
              </div>
              <button className="btn btn-primary" type="submit">
                Add member
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="kicker">Welcome</p>
            <h2 id="athlete-gate-title">Who&apos;s lifting?</h2>
            <p className="muted">Pick yourself. You can switch anytime from the top.</p>
            <div className="row">
              {members.map((member, index) => (
                <button
                  key={member.slug}
                  ref={index === 0 ? first : undefined}
                  className="btn btn-primary"
                  type="button"
                  onClick={() => setAthlete(member.slug)}
                >
                  {member.initials} &mdash; {member.name}
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
