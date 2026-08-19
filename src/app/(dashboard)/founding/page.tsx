import { getFoundingDashboard, isFoundingOperator } from "@/lib/actions/founding";
import { FoundingDashboard } from "@/components/founding/founding-dashboard";
import { notFound } from "next/navigation";

export default async function FoundingPage() {
  if (!(await isFoundingOperator())) notFound();
  const data = await getFoundingDashboard();
  return <FoundingDashboard initialData={data} />;
}
