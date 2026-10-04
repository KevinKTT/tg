"use client";

import { createAthlete, editAthlete, removeAthlete } from "@/lib/actions";
import type { AthleteSummary } from "@/lib/db";

export function MembersView({ members }: { members: AthleteSummary[] }) {
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="kicker">Gym</p>
          <h1>Members</h1>
        </div>
        <p className="muted">{members.length} lifting</p>
      </div>
      <p className="muted">
        Everyone shares one workout each day and logs their own scores and PRs. Switch between members from the top bar.
      </p>

      <section className="stack">
        {members.map((member) => (
          <details className="card" key={member.slug}>
            <summary className="spread">
              <h3>
                {member.name} <span className="faint">{member.initials}</span>
              </h3>
              <span className="faint">{member.sex === "f" ? "Female" : "Male"}</span>
            </summary>
            <div className="stack" style={{ marginTop: "0.8rem" }}>
              <form action={editAthlete} className="stack">
                <input type="hidden" name="slug" value={member.slug} />
                <input className="field" name="name" defaultValue={member.name} required />
                <div className="score-grid">
                  <input className="field" name="initials" defaultValue={member.initials} maxLength={4} />
                  <select className="select" name="sex" defaultValue={member.sex}>
                    <option value="m">Male</option>
                    <option value="f">Female</option>
                  </select>
                </div>
                <button className="btn" type="submit">
                  Save
                </button>
              </form>
              {member.hasData ? (
                <p className="faint">Has logged scores or PRs. Clear them before removing this member.</p>
              ) : (
                <form
                  action={removeAthlete}
                  onSubmit={(event) => {
                    if (!window.confirm(`Remove ${member.name}?`)) event.preventDefault();
                  }}
                >
                  <input type="hidden" name="slug" value={member.slug} />
                  <button className="btn btn-danger" type="submit">
                    Remove
                  </button>
                </form>
              )}
            </div>
          </details>
        ))}
        {members.length === 0 ? <section className="card">No members yet. Add the first one below.</section> : null}
      </section>

      <form action={createAthlete} className="card stack">
        <h2>Add a member</h2>
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
    </div>
  );
}
