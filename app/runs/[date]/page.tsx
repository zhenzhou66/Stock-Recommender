import { notFound } from "next/navigation";
import RunView from "@/components/RunView";
import { getRun } from "@/lib/data";

export const revalidate = 300;

export default async function RunPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const r = await getRun(date);
  if (!r) notFound();
  return <RunView r={r} />;
}
