'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ExplorerPageData } from '@/types/hierarchy.types';
import { Spin360Viewer } from '@/components/video/Spin360Viewer';
import { AerialVideoGallery } from '@/components/video/AerialVideoGallery';

interface ProjectHomePageProps {
  data: ExplorerPageData;
}

type View = 'exterior' | 'videos';

export function ProjectHomePage({ data }: ProjectHomePageProps) {
  const router = useRouter();

  const hasExterior = useMemo(
    () => data.media.some((m) => m.purpose === 'transition'),
    [data.media]
  );

  const aerialVideos = useMemo(
    () => data.media.filter((m) => m.type === 'video' && m.purpose === 'gallery' && (m.metadata as Record<string, unknown>)?.category === 'aerial'),
    [data.media]
  );

  const [currentView, setCurrentView] = useState<View>('exterior');

  // Build spinSvgs from media rows (type='svg', purpose='hotspot') instead of project.settings
  const spinSvgs = useMemo(() => {
    const svgMedia = data.media.filter((m) => m.type === 'svg' && m.purpose === 'hotspot');
    const result: Record<string, string> = {};
    for (const m of svgMedia) {
      const viewpoint = (m.metadata as Record<string, unknown>)?.viewpoint as string | undefined;
      if (viewpoint && m.url) {
        result[viewpoint] = m.url;
      }
    }
    return result;
  }, [data.media]);

  // Find last residential floor (top floor) to navigate into
  const targetFloor = useMemo(() => {
    const residential = data.children
      .filter((c) => c.svgOverlayUrl != null)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return residential[residential.length - 1] ?? data.children[data.children.length - 1];
  }, [data.children]);

  const enterBuilding = useCallback(() => {
    if (targetFloor) {
      router.push(`/p/${data.project.slug}/${targetFloor.slug}`);
    }
  }, [targetFloor, data.project.slug, router]);

  // URLs to preload into browser cache while entrance video plays
  const preloadUrls = useMemo(() => {
    if (!targetFloor) return [];
    const urls: string[] = [];
    if (targetFloor.svgOverlayUrl) urls.push(targetFloor.svgOverlayUrl);
    const bg = data.childrenMedia[targetFloor.id]?.find(
      (m) => m.purpose === 'background' && m.type === 'image'
    );
    if (bg?.url) urls.push(bg.url);
    // Also try the layer's own backgroundImageUrl
    if (targetFloor.backgroundImageUrl) urls.push(targetFloor.backgroundImageUrl);
    return urls;
  }, [targetFloor, data.childrenMedia]);

  return (
    <div className="relative h-screen">
      {/* View content */}
      <div className="absolute inset-0">
        {currentView === 'exterior' && (
          <Spin360Viewer media={data.media} spinSvgs={spinSvgs} onEnterBuilding={enterBuilding} preloadOnEntrance={preloadUrls} enterLabel={data.project.type === 'lots' ? 'Explorar lotes' : 'Explorar niveles'} />
        )}
        {currentView === 'videos' && <AerialVideoGallery media={aerialVideos} />}
      </div>

      {/* Bottom navigation bar */}
      <div className="absolute bottom-4 inset-x-4 z-20 glass-panel px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-center gap-2">
          {hasExterior && (
            <button
              onClick={() => setCurrentView('exterior')}
              aria-current={currentView === 'exterior' ? 'true' : undefined}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'exterior'
                  ? 'bg-white text-gray-900'
                  : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
              }`}
            >
              Exterior 360°
            </button>
          )}
          <button
            onClick={enterBuilding}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-colors bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
          >
            {data.project.type === 'lots' ? 'Lotes' : 'Niveles'}
          </button>
          {aerialVideos.length > 0 && (
            <button
              onClick={() => setCurrentView('videos')}
              aria-current={currentView === 'videos' ? 'true' : undefined}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'videos'
                  ? 'bg-white text-gray-900'
                  : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
              }`}
            >
              Videos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
