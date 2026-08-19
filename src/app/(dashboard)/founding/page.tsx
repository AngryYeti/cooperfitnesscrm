import { getFoundingDashboard } from "@/lib/actions/founding";
import { FoundingDashboard } from "@/components/founding/founding-dashboard";

export default async function FoundingPage() {
  const data = await getFoundingDashboard();
  return <FoundingDashboard initialData={data} />;
}
