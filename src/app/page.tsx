import { HomeMenu } from "@/components/home-menu";
import { buildSession } from "@/infrastructure/composition";

export default async function HomePage() {
  const session = await buildSession().current();
  return <HomeMenu session={session} />;
}
