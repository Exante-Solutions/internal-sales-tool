import { DiscoveryHome } from "@/components/discovery-home";
import { requireSession } from "@/lib/require-session";

export default async function HomePage() {
  // Resolve the session, provisioning the team + app_user on first login. With no
  // Auth0 session this redirects to /auth/login; in seeded mode it always resolves.
  const session = await requireSession();
  return <DiscoveryHome session={session} />;
}
