'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useTransitionRouter } from 'next-view-transitions';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ExplorerPageData } from '@/types/hierarchy.types';
import { getHomeUrl, getBackUrl } from '@/lib/navigation';
import { Spin360Viewer, Spin360ViewerRef } from '@/components/video/Spin360Viewer';
import { MobileHint } from '@/components/shared/MobileHint';
import { BrandingBadge } from '@/components/lots/BrandingBadge';
import { TopNav } from '@/components/lots/TopNav';
import { ContactModal } from '@/components/lots/ContactModal';
import { LocationView } from '@/components/lots/LocationView';

interface ProjectHomePageProps {
  data: ExplorerPageData;
}

type ActiveView = 'tour' | 'location';

export function ProjectHomePage({ data }: ProjectHomePageProps) {
  const router = useTransitionRouter();
  const { project, media, children } = data;

  const spinRef = useRef<Spin360ViewerRef>(null);
  const [activeView, setActiveView] = useState<ActiveView>('tour');
  const [contactOpen, setContactOpen] = useState(false);
  const [currentViewpoint, setCurrentViewpoint] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleTransitionChange = useCallback((transitioning: boolean) => {
    setIsTransitioning(transitioning);
  }, []);

  const logos = useMemo(
    () => media.filter((m) => m.purpose === 'logo' || m.purpose === 'logo_developer'),
    [media]
  );

  // Build spinSvgs from media rows (type='svg', purpose='hotspot')
  const spinSvgs = useMemo(() => {
    const svgMedia = media.filter((m) => m.type === 'svg' && m.purpose === 'hotspot');
    const result: Record<string, string> = {};
    for (const m of svgMedia) {
      const viewpoint = (m.metadata as Record<string, unknown>)?.viewpoint as string | undefined;
      if (viewpoint && m.url) {
        result[viewpoint] = m.url;
      }
    }
    return result;
  }, [media]);

  // Navigation target: children (when at root) or zone sibling (when at tour layer)
  const mapTarget = useMemo(() => {
    if (children.length > 0) {
      return `/p/${project.slug}/${data.currentPath.join('/')}/${children[0].slug}`;
    }
    // At tour layer: navigate to zone sibling
    const currentId = data.currentLayer?.id;
    const zoneSibling = data.siblings.find((s) => s.id !== currentId);
    if (zoneSibling) {
      return `/p/${project.slug}/${zoneSibling.slug}`;
    }
    return null;
  }, [project.slug, data.currentPath, children, data.currentLayer, data.siblings]);

  const homeUrl = getHomeUrl(data);
  const backUrl = getBackUrl(data);

  const isHomeLayer = data.currentLayer?.id === data.rootLayers[0]?.id;

  const handleNavigate = (section: 'home' | 'map' | 'location' | 'contact') => {
    if (section === 'home') {
      if (isHomeLayer) {
        setActiveView('tour');
      } else {
        router.push(homeUrl);
      }
    } else if (section === 'map') {
      spinRef.current?.enterBuilding();
    } else if (section === 'location') {
      setActiveView('location');
    }
  };

  const activeSection = activeView === 'location' ? 'location' as const : 'home' as const;

  // Side arrow classes — matches LotsHomePage
  const arrowClass =
    'absolute top-1/2 -translate-y-1/2 z-30 w-8 h-8 md:w-10 md:h-10 xl:w-12 xl:h-12 rounded-full lots-glass flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-black/50 hover:scale-110 outline-none';

  return (
    <div className="relative h-screen overflow-hidden bg-black">
      {/* Content layer */}
      <div className="absolute inset-0">
        {activeView === 'tour' && (
          <Spin360Viewer
            ref={spinRef}
            media={media}
            spinSvgs={spinSvgs}
            hideControls
            enablePanorama
            hideSvgOverlay={false}
            hotspotTowerId="_none"
            hotspotMarkerId="_none"
            onViewpointChange={setCurrentViewpoint}
            onTransitionChange={handleTransitionChange}
            onEnterBuilding={() => {
              if (mapTarget) router.push(mapTarget);
            }}
            renderNavigation={({ onPrev, onNext, isTransitioning: trans }) => {
              if (trans) return null;
              return (
                <>
                  <button
                    onClick={onPrev}
                    className={`${arrowClass} left-2 md:left-4 xl:left-16`}
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 xl:w-6 xl:h-6 text-white/90" />
                  </button>
                  <button
                    onClick={onNext}
                    className={`${arrowClass} right-2 md:right-4 xl:right-16`}
                    aria-label="Siguiente"
                  >
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 xl:w-6 xl:h-6 text-white/90" />
                  </button>
                </>
              );
            }}
          />
        )}
        {activeView === 'location' && <LocationView project={project} />}
      </div>

      {/* Mobile hint */}
      {activeView === 'tour' && (
        <MobileHint
          isTourActive
          isTransitioning={false}
          currentSceneId={currentViewpoint}
          pillMessage="Tocá el edificio para explorar"
        />
      )}

      {/* Chrome — hidden during transitions */}
      {!isTransitioning && (
        <>
          <BrandingBadge project={project} logos={logos} />
          <TopNav
            activeSection={activeSection}
            onNavigate={handleNavigate}
            onContactOpen={() => setContactOpen(true)}
            mapLabel="Niveles"
            showBack
            onBack={activeView === 'location'
              ? () => setActiveView('tour')
              : () => router.push(backUrl)
            }
          />
        </>
      )}

      {/* Contact modal */}
      <ContactModal
        project={project}
        logos={logos}
        open={contactOpen}
        onClose={() => setContactOpen(false)}
      />
    </div>
  );
}
