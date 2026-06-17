import { Suspense } from "react";
import { ConversationsList } from "@/components/discovery/conversations-list";

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-neutral-500">Loading…</div>}>
      <ConversationsList />
    </Suspense>
  );
}
