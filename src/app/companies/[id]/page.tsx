import { CompanyProfile } from "@/components/discovery/company-profile";

export default async function CompanyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompanyProfile id={id} />;
}
