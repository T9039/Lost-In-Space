import { getItems } from "@/lib/api";
import MissionTimeline from "@/components/MissionTimeline";

export const metadata = {
  title: "Lost in Space — NASA Mission Timeline",
  description:
    "Follow NASA missions across time, explore the machines they left behind, and uncover the discoveries they made.",
};

export default async function HomePage() {
  const items = await getItems();
  return <MissionTimeline items={items} />;
}
