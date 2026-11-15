import { getItems } from "@/lib/api";
import MissionQuiz from "@/components/MissionQuiz";

export const metadata = {
  title: "Mission Test — Lost in Space",
  description: "Test your NASA mission retrieval knowledge with telemetry challenges grounded in official records.",
};

export default async function TestPage() {
  const items = await getItems();

  return (
    <div className="container test-page-container">
      <section className="test-header-section">
        <div className="eyebrow">[ S6 // RETRIEVAL SIMULATOR ]</div>
        <h1 className="test-page-title">MISSION TEST // KNOWLEDGE RETRIEVAL</h1>
        <p className="test-page-lead">
          Test what you learned about NASA's silent sentinels. Every challenge is deterministically verified
          against official NASA provenance records. Complete the simulation to unlock your flight debrief.
        </p>
      </section>

      <MissionQuiz items={items} />
    </div>
  );
}
