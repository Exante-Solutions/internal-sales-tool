import { ConversationDetail } from "@/components/discovery/conversation-detail";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConversationDetail id={id} />;
}
