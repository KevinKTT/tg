import { EquipmentView } from "@/components/equipment-view";
import { listEquipment } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function EquipmentPage() {
  return <EquipmentView items={listEquipment()} />;
}
