'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ExplorerPageData } from '@/types/hierarchy.types';
import { Spin360Viewer } from '@/components/video/Spin360Viewer';
import { MobileHint } from '@/components/shared/MobileHint';
import { BrandingBadge } from './BrandingBadge';
import { TopNav } from './TopNav';
import { ContactModal } from './ContactModal';
import { LocationView } from './LocationView';

interface LotsHomePageProps {
  data: ExplorerPageData;
}

type ActiveView = 'tour' | 'location';

export function LotsHomePage({ data }: LotsHomePageProps) {
  const router = useRouter();
  const { project, media, children } = data;

  const [activeView, setActiveView] = useState<ActiveView>('tour');
  const [contactOpen, setContactOpen] = useState(false);
  const [currentViewpoint, setCurrentViewpoint] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleTransitionChange = useCallback((transitioning: boolean) => {
    setIsTransitioning(transitioning);
  }, []);

  const logos = useMemo(
    () => media.filter((m) => m.purpose === 'logo'),
    [media]
  );

  // Build spinSvgs from media (type='svg', purpose='hotspot')
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

  // Navigate to first child (zone)
  const firstChildSlug = children[0]?.slug;

  const handleNavigate = (section: 'home' | 'map' | 'location' | 'contact') => {
    if (section === 'home') {
      setActiveView('tour');
    } else if (section === 'map') {
      if (firstChildSlug) {
        router.push(`/p/${project.slug}/${data.currentPath.join('/')}/${firstChildSlug}`);
      }
    } else if (section === 'location') {
      setActiveView('location');
    }
  };

  const activeSection = activeView === 'location' ? 'location' as const : 'home' as const;

  // Side arrow classes — matches original NavigationArrows exactly
  const arrowClass =
    'absolute top-1/2 -translate-y-1/2 z-30 w-8 h-8 md:w-10 md:h-10 xl:w-12 xl:h-12 rounded-full lots-glass flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-black/50 hover:scale-110 outline-none';

  return (
    <div className="relative h-screen bg-black overflow-hidden">
      {/* Content layer */}
      <div className="absolute inset-0">
        {activeView === 'tour' && (
          <Spin360Viewer
            media={media}
            spinSvgs={spinSvgs}
            hideControls
            enablePanorama
            hideSvgOverlay={false}
            onViewpointChange={setCurrentViewpoint}
            onTransitionChange={handleTransitionChange}
            onEnterBuilding={() => {
              if (firstChildSlug) router.push(`/p/${project.slug}/${data.currentPath.join('/')}/${firstChildSlug}`);
            }}
            renderNavigation={({ onPrev, onNext, isTransitioning }) => {
              if (isTransitioning) return null;
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
            showBack={activeView === 'location'}
            onBack={() => setActiveView('tour')}
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
