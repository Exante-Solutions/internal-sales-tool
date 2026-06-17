import { DiscoveryHome } from "@/components/discovery-home";
import { SignedOut } from "@/components/signed-out";
import { buildSession } from "@/infrastructure/composition";

export default async function HomePage() {
  // In seeded mode current() always resolves; in live Auth0 mode it throws when
  // there is no session — render the signed-out landing with a /auth/login CTA.
  let session;
  try {
    session = await buildSession().current();
  } catch {
    return <SignedOut />;
  }
  return <DiscoveryHome session={session} />;
}
