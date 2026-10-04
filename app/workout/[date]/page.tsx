import Link from "next/link";
import { notFound } from "next/navigation";
import { GeneratePanel } from "@/components/generate-panel";
import { WorkoutCard } from "@/components/workout-card";
import { formatLong, isISODate } from "@/lib/dates";
import { getDay, getScores, listEquipment, listMovements, listPrs } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function WorkoutPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isISODate(date)) notFound();
  const day = getDay(date);
  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <Link href="/calendar">Calendar</Link>
          </p>
          <h1>{formatLong(date)}</h1>
        </div>
      </div>
      {day ? (
        <>
          <WorkoutCard
            day={day}
            scores={getScores(day.id)}
            prs={listPrs()}
            movements={listMovements()}
            equipment={listEquipment()}
          />
          <GeneratePanel date={date} hasWorkout />
        </>
      ) : (
        <GeneratePanel date={date} hasWorkout={false} />
      )}
    </>
  );
}
