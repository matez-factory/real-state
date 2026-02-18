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

  const spinSvgs = useMemo(
    () => (data.project.settings?.spin_svgs as Record<string, string>) ?? {},
    [data.project.settings]
  );

  // Find last residential floor (top floor) to navigate into
  const targetFloor = useMemo(() => {
    const residential = data.children
      .filter((c) => c.svgPath != null)
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
    if (targetFloor.svgPath) urls.push(targetFloor.svgPath);
    const bg = data.childrenMedia[targetFloor.id]?.find(
      (m) => m.purpose === 'exploration' && m.type === 'image'
    );
    if (bg?.url) urls.push(bg.url);
    return urls;
  }, [targetFloor, data.childrenMedia]);

  return (
    <div className="relative h-screen">
      {/* View content */}
      <div className="absolute inset-0">
        {currentView === 'exterior' && (
          <Spin360Viewer media={data.media} spinSvgs={spinSvgs} onEnterBuilding={enterBuilding} preloadOnEntrance={preloadUrls} />
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
            Niveles
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
