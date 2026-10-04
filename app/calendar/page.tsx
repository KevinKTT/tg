import Link from "next/link";
import { WeekProgram } from "@/components/week-program";
import { formatShort, monthLabel, monthMatrix, shiftMonth, todayISO } from "@/lib/dates";
import { listDays } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const today = todayISO();
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));
  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    year = Number(params.month.slice(0, 4));
    month = Number(params.month.slice(5, 7));
  }
  const cells = monthMatrix(year, month);
  const marks = new Map(listDays(cells[0].iso, cells[cells.length - 1].iso).map((day) => [day.date, day]));
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">Month</p>
          <h1>{monthLabel(year, month)}</h1>
        </div>
        <div className="row">
          <Link className="btn" href={`/calendar?month=${prev.year}-${String(prev.month).padStart(2, "0")}`}>
            Prev
          </Link>
          <Link className="btn" href={`/calendar?month=${next.year}-${String(next.month).padStart(2, "0")}`}>
            Next
          </Link>
        </div>
      </div>
      <div className="cal" style={{ marginBottom: "0.35rem" }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day} className="faint" style={{ aspectRatio: "auto", background: "transparent" }}>
            {day}
          </span>
        ))}
      </div>
      <div className="cal" style={{ marginBottom: "1rem" }}>
        {cells.map((cell) => {
          const mark = marks.get(cell.iso);
          return (
            <Link
              key={cell.iso}
              href={`/workout/${cell.iso}`}
              data-today={cell.iso === today}
              data-out={!cell.inMonth}
              aria-label={formatShort(cell.iso)}
            >
              {Number(cell.iso.slice(8))}
              {mark ? <i className="dot" data-rest={mark.status === "rest"} data-logged={mark.scoreCount > 0} /> : <i />}
            </Link>
          );
        })}
      </div>
      <WeekProgram anchor={today} />
    </>
  );
}
