'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ExplorerPageData, SiblingExplorerBundle } from '@/types/hierarchy.types';
import { InteractiveSVG } from '@/components/svg/InteractiveSVG';
import { STATUS_LABELS, STATUS_DOT_CLASSES } from '@/lib/constants/status';
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
    () => media.filter((m) => m.purpose === 'logo'),
    [media]
  );

  const svgUrl = data.currentLayer?.svgOverlayUrl ?? project.svgOverlayUrl;
  const backgroundUrl =
    media.find((m) => m.purpose === 'background' && m.type === 'image')?.url ??
    data.currentLayer?.backgroundImageUrl;

  const availableCount = children.filter(
    (c) => c.status === 'available'
  ).length;

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

  const handleNavigate = (section: 'home' | 'map' | 'location' | 'contact') => {
    if (section === 'home') {
      router.push(`/p/${project.slug}`);
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
      <div className="absolute inset-0">
        {activeView === 'map' && svgUrl && (
          <InteractiveSVG
            svgUrl={svgUrl}
            entities={entityConfigs}
            backgroundUrl={backgroundUrl}
          />
        )}
        {activeView === 'map' && !svgUrl && (
          <div className="flex items-center justify-center h-full text-gray-500">
            No hay mapa disponible
          </div>
        )}
        {activeView === 'location' && <LocationView project={project} />}
      </div>

      {/* Legend (top-right, desktop only, behind ficha) */}
      {activeView === 'map' && (
        <div className="hidden sm:block absolute top-4 right-4 z-20 glass-panel px-4 py-3">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>
              <span className="text-white font-semibold">
                {availableCount}
              </span>
              /{children.length} disponibles
            </span>
            <div className="flex gap-3">
              {(['available', 'reserved', 'sold'] as const).map((status) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div
                    className={`w-2 h-2 rounded-full ${STATUS_DOT_CLASSES[status]}`}
                  />
                  <span>{STATUS_LABELS[status]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Branding badge */}
      <BrandingBadge project={project} logos={logos} />

      {/* Top nav */}
      <TopNav
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onContactOpen={() => setContactOpen(true)}
        showBack={activeView === 'location'}
        onBack={() => setActiveView('map')}
      />

      {/* Lot ficha overlay */}
      {selectedLot && (
        <LotFichaOverlay
          lot={selectedLot}
          media={childrenMedia[selectedLot.id] ?? []}
          project={project}
          logos={logos}
          onClose={handleCloseFicha}
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
