import { MembersView } from "@/components/members-view";
import { listAthleteSummaries } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function MembersPage() {
  return <MembersView members={listAthleteSummaries()} />;
}
