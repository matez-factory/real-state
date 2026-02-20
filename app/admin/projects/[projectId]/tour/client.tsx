'use client';

import { useRouter } from 'next/navigation';
import TourStopManager, { type TourStop } from '@/components/admin/TourStopManager';
import TransitionManager, { type TransitionPair } from '@/components/admin/TransitionManager';
import { createLayer } from '@/lib/actions/admin';

interface MediaRow {
  id: string;
  purpose: string;
  url: string;
  storage_path: string;
  metadata: Record<string, unknown>;
}

interface Props {
  projectId: string;
  projectSlug: string;
  tourLayerId: string | null;
  tourMedia: MediaRow[];
}

export default function TourPageClient({ projectId, projectSlug, tourLayerId, tourMedia }: Props) {
  const router = useRouter();

  function refresh() {
    router.refresh();
  }

  // If no tour layer exists, offer to create one
  if (!tourLayerId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Tour 360</h1>
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-4">
            No hay un layer de tour en este proyecto.
          </p>
          <form
            action={async () => {
              const formData = new FormData();
              formData.set('project_id', projectId);
              formData.set('name', 'Tour 360');
              formData.set('type', 'tour');
              formData.set('slug', 'tour');
              formData.set('label', 'Tour');
              await createLayer(formData);
            }}
          >
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Crear layer Tour
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Parse stops from media
  const galleryMedia = tourMedia.filter((m) => m.purpose === 'gallery');
  const hotspotMedia = tourMedia.filter((m) => m.purpose === 'hotspot');
  const transitionMedia = tourMedia.filter((m) => m.purpose === 'transition');

  // Extract unique viewpoints from gallery media
  const viewpoints = new Set<string>();
  for (const m of galleryMedia) {
    const vp = (m.metadata as Record<string, string>).viewpoint;
    if (vp) viewpoints.add(vp);
  }
  for (const m of hotspotMedia) {
    const vp = (m.metadata as Record<string, string>).viewpoint;
    if (vp) viewpoints.add(vp);
  }

  const sortedViewpoints = Array.from(viewpoints).sort();

  const stops: TourStop[] = sortedViewpoints.map((vp, idx) => {
    const pano = galleryMedia.find(
      (m) => (m.metadata as Record<string, string>).viewpoint === vp
    );
    const hs = hotspotMedia.find(
      (m) => (m.metadata as Record<string, string>).viewpoint === vp
    );
    const name = (pano?.metadata as Record<string, string>)?.name || `Stop ${idx + 1}`;

    return {
      index: idx + 1,
      viewpoint: vp,
      name,
      panoramaMedia: pano ?? null,
      hotspotMedia: hs ?? null,
    };
  });

  // Parse transition pairs
  const transitionPairsMap = new Map<string, TransitionPair>();
  for (const m of transitionMedia) {
    const fromVp = (m.metadata as Record<string, string>).from_viewpoint;
    const toVp = (m.metadata as Record<string, string>).to_viewpoint;
    if (!fromVp || !toVp) continue;

    const sortedKey = [fromVp, toVp].sort().join('--');
    const fromStop = stops.find((s) => s.viewpoint === fromVp);
    const toStop = stops.find((s) => s.viewpoint === toVp);
    if (!fromStop || !toStop) continue;

    if (!transitionPairsMap.has(sortedKey)) {
      const [firstVp, secondVp] = [fromVp, toVp].sort();
      transitionPairsMap.set(sortedKey, {
        from: stops.find((s) => s.viewpoint === firstVp)!,
        to: stops.find((s) => s.viewpoint === secondVp)!,
        forwardMedia: null,
        reverseMedia: null,
      });
    }

    const pair = transitionPairsMap.get(sortedKey)!;
    if (fromVp === pair.from.viewpoint && toVp === pair.to.viewpoint) {
      pair.forwardMedia = m;
    } else {
      pair.reverseMedia = m;
    }
  }

  const transitions = Array.from(transitionPairsMap.values());

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Tour 360</h1>

      <TourStopManager
        projectId={projectId}
        projectSlug={projectSlug}
        tourLayerId={tourLayerId}
        stops={stops}
        onStopsChange={refresh}
      />

      <TransitionManager
        projectId={projectId}
        projectSlug={projectSlug}
        tourLayerId={tourLayerId}
        stops={stops}
        transitions={transitions}
        allTransitionMedia={transitionMedia}
        onTransitionsChange={refresh}
      />
    </div>
  );
}
