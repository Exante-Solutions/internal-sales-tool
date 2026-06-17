import { DiscoveryHome } from "@/components/discovery-home";
import { SignedOut } from "@/components/signed-out";
import { buildSession } from "@/infrastructure/composition";

/**
 * True only for the "no Auth0 session" signal thrown by Auth0SessionGateway
 * before it touches any collaborator — a genuinely signed-out request. Other
 * throws (e.g. a DB failure while provisioning the user) must NOT be masked as
 * signed-out (3425177919); they re-throw so the error surfaces.
 */
function isMissingSessionError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("no Auth0 session");
}

export default async function HomePage() {
  // In seeded mode current() always resolves; in live Auth0 mode it throws when
  // there is no session — render the signed-out landing with a /auth/login CTA.
  let session;
  try {
    session = await buildSession().current();
  } catch (err) {
    if (isMissingSessionError(err)) return <SignedOut />;
    throw err;
  }
  return <DiscoveryHome session={session} />;
}
