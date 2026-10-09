import Link from "next/link";
import { addDays, formatLong, isISODate, todayISO } from "@/lib/dates";
import { getDay, getScores, listAthletes } from "@/lib/db";
import { pieceScheme } from "@/lib/formats";
import { higherIsBetter } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date && isISODate(params.date) ? params.date : todayISO();
  const day = getDay(date);
  const members = listAthletes();
  const scores = day && day.status !== "rest" ? getScores(day.id) : [];
  const parts = day?.tracks.flatMap((track) => track.parts) ?? [];
  const groups = new Map<string, typeof scores>();
  for (const score of scores) {
    const part = parts.find((item) => item.id === score.partId);
    const scoreType = part && day ? (pieceScheme(part.format, day.format, part.kind)?.scoreType ?? score.scoreType) : score.scoreType;
    if (scoreType === "none") continue;
    const typed = { ...score, scoreType };
    const key = `${typed.partKind}:${typed.partName}:${typed.scoreType}`;
    groups.set(key, [...(groups.get(key) ?? []), typed]);
  }
  const prev = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">Leaderboard</p>
          <h1>{formatLong(date)}</h1>
        </div>
        <div className="row">
          <Link className="btn" href={`/board?date=${prev}`}>
            Prev
          </Link>
          <Link className="btn" href={`/board?date=${next}`}>
            Next
          </Link>
        </div>
      </div>
      {!day ? <section className="card">No workout this day.</section> : null}
      {day?.status === "rest" ? <section className="card">Rest day.</section> : null}
      {day && day.status !== "rest" ? (
        <section className="card">
          <h2>{day.title}</h2>
          <p className="muted">{day.stimulus}</p>
        </section>
      ) : null}
      {[...groups.entries()].map(([key, rows]) => {
        const done = rows[0].scoreType === "done";
        const betterLow = rows[0].scoreDirection === "asc" || !higherIsBetter(rows[0].scoreType);
        const ranked = done ? rows : [...rows].sort((a, b) => (betterLow ? a.valueNumeric - b.valueNumeric : b.valueNumeric - a.valueNumeric));
        const comparable = new Set(rows.map((row) => row.scoreType)).size === 1;
        return (
          <section className="card" key={key}>
            <p className="kicker">{rows[0].partKind}</p>
            <h2>{rows[0].partName}</h2>
            {members.map((member) => {
              const score = ranked.find((row) => row.athleteSlug === member.slug);
              const place = score && comparable ? ranked.findIndex((row) => row.id === score.id) + 1 : null;
              return (
                <div className="spread" key={member.slug} style={{ padding: "0.45rem 0" }}>
                  <span>
                    {member.name} <span className="faint">{member.initials}</span>
                  </span>
                  <strong>
                    {score ? score.display : "—"} {place && !done && ranked.length > 1 ? <span className="faint">#{place}</span> : null}
                  </strong>
                </div>
              );
            })}
            {!comparable ? <p className="faint">Different score types, so no rank.</p> : null}
          </section>
        );
      })}
      {day && day.status !== "rest" && groups.size === 0 ? <section className="card">No scores logged.</section> : null}
    </>
  );
}
