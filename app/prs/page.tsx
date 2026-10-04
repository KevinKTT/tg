import { PrView } from "@/components/pr-view";
import { todayISO } from "@/lib/dates";
import { listEquipment, listMovements, listPrs } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function PrsPage() {
  return <PrView movements={listMovements()} prs={listPrs()} equipment={listEquipment()} today={todayISO()} />;
}
