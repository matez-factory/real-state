import { notFound } from 'next/navigation';
import { getSiblingExplorerBundle } from '@/lib/data/repository';
import { getProjectSlugsAdmin, getLayerPathsAdmin } from '@/lib/data/repository-admin';
import { ExplorerView } from '@/components/views/ExplorerView';
import { UnitPage } from '@/components/views/UnitPage';

interface LayerPageProps {
  params: Promise<{ projectSlug: string; layers: string[] }>;
}

export default async function LayerPage({ params }: LayerPageProps) {
  const { projectSlug, layers } = await params;

  let bundle;
  try {
    bundle = await getSiblingExplorerBundle(projectSlug, layers);
  } catch {
    notFound();
  }

  const { current } = bundle;

  // Leaf layer (no children) → full detail page with gallery
  if (current.children.length === 0 && current.currentLayer) {
    return <UnitPage data={current} />;
  }

  return <ExplorerView data={current} siblingBundle={bundle} />;
}

export async function generateStaticParams() {
  const slugs = await getProjectSlugsAdmin();
  const params: { projectSlug: string; layers: string[] }[] = [];

  for (const projectSlug of slugs) {
    const paths = await getLayerPathsAdmin(projectSlug);
    for (const layers of paths) {
      params.push({ projectSlug, layers });
    }
  }

  return params;
}
