import { GeneratePanel } from "@/components/generate-panel";
import { WorkoutCard } from "@/components/workout-card";
import { formatLong, todayISO } from "@/lib/dates";
import { getDay, getScores, listEquipment, listMovements, listPrs } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const date = todayISO();
  const day = getDay(date);
  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">Today</p>
          <h1>{formatLong(date)}</h1>
        </div>
      </div>
      {day ? (
        <WorkoutCard
          day={day}
          scores={getScores(day.id)}
          prs={listPrs()}
          movements={listMovements()}
          equipment={listEquipment()}
        />
      ) : null}
      <GeneratePanel date={date} hasWorkout={Boolean(day)} />
    </>
  );
}
