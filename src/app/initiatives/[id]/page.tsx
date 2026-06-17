import { InitiativeDetail } from "@/components/discovery/initiative-detail";

export default async function InitiativeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InitiativeDetail id={id} />;
}
