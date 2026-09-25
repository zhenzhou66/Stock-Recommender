import RunView from "@/components/RunView";
import { getRun } from "@/lib/data";

export const revalidate = 300;

export default async function Home() {
  const r = await getRun();
  if (!r) return <p className="muted">No reports yet.</p>;
  return <RunView r={r} />;
}
