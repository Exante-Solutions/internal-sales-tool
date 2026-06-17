import { PersonProfile } from "@/components/discovery/person-profile";

export default async function PersonProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PersonProfile id={id} />;
}
