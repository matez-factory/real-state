import { notFound, redirect } from 'next/navigation';
import { getSiblingExplorerBundle } from '@/lib/data/repository';
import { getProjectSlugsAdmin, getLayerPathsAdmin } from '@/lib/data/repository-admin';
import { ExplorerView } from '@/components/views/ExplorerView';
import { ProjectHomePage } from '@/components/views/ProjectHomePage';
import { UnitPage } from '@/components/views/UnitPage';
import { LotsHomePage } from '@/components/lots/LotsHomePage';
import { LotsExplorerView } from '@/components/lots/LotsExplorerView';

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

  // 1. Lots project: layer with hotspot media → tour 360
  const hasSpinMedia = current.media.some((m) => m.purpose === 'hotspot');
  if (current.project.type === 'lots' && hasSpinMedia) {
    return <LotsHomePage data={current} />;
  }

  // 2. Building: tour layer with hotspot media → Spin360 tour
  if (current.project.type === 'building' && hasSpinMedia) {
    return <ProjectHomePage data={current} />;
  }

  // 3. Lots project: leaf layer → render map with ficha pre-selected
  if (current.children.length === 0 && current.currentLayer && current.project.type === 'lots') {
    const parentLayers = layers.slice(0, -1);
    let zoneBundle;
    try {
      zoneBundle = await getSiblingExplorerBundle(projectSlug, parentLayers);
    } catch {
      notFound();
    }
    return (
      <LotsExplorerView
        data={zoneBundle.current}
        siblingBundle={zoneBundle}
        preSelectedLotSlug={layers[layers.length - 1]}
      />
    );
  }

  // 4. Lots project: zone level → render lots explorer
  if (current.project.type === 'lots' && current.children.length > 0) {
    return <LotsExplorerView data={current} siblingBundle={bundle} />;
  }

  // 5. Building: non-leaf layer with children → redirect to first child
  //    (e.g. torre-aurora → first floor nivel-6)
  if (current.project.type === 'building' && !current.isLeafLevel && current.children.length > 0) {
    redirect(`/p/${projectSlug}/${layers.join('/')}/${current.children[0].slug}`);
  }

  // 6. Building: leaf layer → full detail page with gallery
  if (current.children.length === 0 && current.currentLayer) {
    // Get parent floor's background for the blurred backdrop
    let floorBackgroundUrl: string | undefined;
    if (layers.length > 1) {
      try {
        const parentBundle = await getSiblingExplorerBundle(projectSlug, layers.slice(0, -1));
        floorBackgroundUrl = parentBundle.current.media.find(
          (m) => m.purpose === 'background' && m.type === 'image'
        )?.url;
      } catch { /* no parent bg, continue */ }
    }
    return <UnitPage data={current} floorBackgroundUrl={floorBackgroundUrl} />;
  }

  // 7. Default: explorer with SVG map + sibling navigator
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
