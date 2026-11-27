import AppDetailView from "@/components/AppDetailView";
import SiteShell from "@/components/SiteShell";
import {
  allCatalogApps,
  appStaticParams,
  getCatalogApp,
  sortAppsByReleasedAt,
} from "@/lib/sections";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return appStaticParams();
}

export default async function AppIntroPage({ params }: Props) {
  const { slug } = await params;
  const app = getCatalogApp(slug);
  if (!app) notFound();

  const others = sortAppsByReleasedAt(
    allCatalogApps().filter((entry) => entry.slug !== app.slug),
  ).slice(0, 6);

  return (
    <SiteShell tagline={app.name}>
      <AppDetailView app={app} others={others} />
    </SiteShell>
  );
}
