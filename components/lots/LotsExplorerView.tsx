'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ExplorerPageData, SiblingExplorerBundle } from '@/types/hierarchy.types';
import { InteractiveSVG } from '@/components/svg/InteractiveSVG';
import { BrandingBadge } from './BrandingBadge';
import { TopNav } from './TopNav';
import { ContactModal } from './ContactModal';
import { LocationView } from './LocationView';
import { LotFichaOverlay } from './LotFichaOverlay';

interface LotsExplorerViewProps {
  data: ExplorerPageData;
  siblingBundle?: SiblingExplorerBundle;
  preSelectedLotSlug?: string;
}

type ActiveView = 'map' | 'location';

export function LotsExplorerView({
  data,
  preSelectedLotSlug,
}: LotsExplorerViewProps) {
  const router = useRouter();
  const { project, children, media, childrenMedia } = data;

  const [activeView, setActiveView] = useState<ActiveView>('map');
  const [contactOpen, setContactOpen] = useState(false);

  // Find pre-selected lot by slug
  const preSelectedLot = useMemo(
    () =>
      preSelectedLotSlug
        ? children.find((c) => c.slug === preSelectedLotSlug) ?? null
        : null,
    [children, preSelectedLotSlug]
  );

  const [selectedLotId, setSelectedLotId] = useState<string | null>(
    preSelectedLot?.id ?? null
  );

  const selectedLot = useMemo(
    () => children.find((c) => c.id === selectedLotId) ?? null,
    [children, selectedLotId]
  );

  const logos = useMemo(
    () => media.filter((m) => m.purpose === 'logo' || m.purpose === 'logo_developer'),
    [media]
  );

  const svgUrl = data.currentLayer?.svgOverlayUrl ?? project.svgOverlayUrl;
  const svgMobileUrl = data.currentLayer?.svgOverlayMobileUrl;
  const backgroundUrl =
    media.find((m) => m.purpose === 'background' && m.type === 'image')?.url ??
    data.currentLayer?.backgroundImageUrl;
  const backgroundMobileUrl =
    media.find((m) => m.purpose === 'background_mobile' && m.type === 'image')?.url ??
    data.currentLayer?.backgroundImageMobileUrl;

  // Lot click → overlay (no navigation)
  const entityConfigs = useMemo(
    () =>
      children.map((child) => ({
        id: child.svgElementId ?? child.slug,
        label: child.label,
        status: child.status,
        onClick: () => {
          setSelectedLotId(child.id);
          history.pushState(
            null,
            '',
            `/p/${project.slug}/${data.currentPath.join('/')}/${child.slug}`
          );
        },
      })),
    [children, project.slug, data.currentPath]
  );

  const handleCloseFicha = useCallback(() => {
    setSelectedLotId(null);
    history.pushState(
      null,
      '',
      `/p/${project.slug}/${data.currentPath.join('/')}`
    );
  }, [project.slug, data.currentPath]);

  // Navigate to parent path (tour layer) — not the splash
  const parentPath = data.currentPath.slice(0, -1);
  const goToParent = useCallback(() => {
    if (parentPath.length > 0) {
      router.push(`/p/${project.slug}/${parentPath.join('/')}`);
    } else {
      router.push(`/p/${project.slug}`);
    }
  }, [router, project.slug, parentPath]);

  const handleNavigate = (section: 'home' | 'map' | 'location' | 'contact') => {
    // Close ficha if open
    if (selectedLotId) {
      setSelectedLotId(null);
      history.pushState(null, '', `/p/${project.slug}/${data.currentPath.join('/')}`);
    }
    if (section === 'home') {
      goToParent();
    } else if (section === 'map') {
      setActiveView('map');
    } else if (section === 'location') {
      setActiveView('location');
    }
  };

  const activeSection = activeView === 'location' ? 'location' as const : 'map' as const;

  return (
    <div className="relative h-screen bg-black overflow-hidden">
      {/* Content */}
      <div className="absolute inset-0 portrait:scale-[1.3] landscape:scale-[1.15] xl:scale-100">
        {activeView === 'map' && svgUrl && (
          <InteractiveSVG
            svgUrl={svgUrl}
            svgMobileUrl={svgMobileUrl}
            entities={entityConfigs}
            backgroundUrl={backgroundUrl}
            backgroundMobileUrl={backgroundMobileUrl}
          />
        )}
        {activeView === 'map' && !svgUrl && (
          <div className="flex items-center justify-center h-full text-gray-500">
            No hay mapa disponible
          </div>
        )}
        {activeView === 'location' && <LocationView project={project} />}
      </div>

      {/* Branding badge */}
      <BrandingBadge project={project} logos={logos} />

      {/* Top nav */}
      <TopNav
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onContactOpen={() => setContactOpen(true)}
        showBack
        onBack={activeView === 'location' ? () => setActiveView('map') : goToParent}
      />

      {/* Lot ficha overlay */}
      {selectedLot && (
        <LotFichaOverlay
          lot={selectedLot}
          media={childrenMedia[selectedLot.id] ?? []}
          project={project}
          logos={logos}
          onClose={handleCloseFicha}
          onNavigate={handleNavigate}
          onContactOpen={() => setContactOpen(true)}
        />
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
