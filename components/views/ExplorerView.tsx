'use client';

import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ExplorerPageData, Layer, SiblingExplorerBundle } from '@/types/hierarchy.types';
import { InteractiveSVG } from '@/components/svg/InteractiveSVG';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { SiblingNavigator } from '@/components/navigation/SiblingNavigator';
import { STATUS_LABELS, STATUS_DOT_CLASSES } from '@/lib/constants/status';
import { buttonStyles } from '@/lib/styles/button';

interface ExplorerViewProps {
  data: ExplorerPageData;
  siblingBundle?: SiblingExplorerBundle;
}

export function ExplorerView({ data, siblingBundle }: ExplorerViewProps) {
  const router = useRouter();
  // Ref keeps entityConfigs stable across router context changes
  const routerRef = useRef(router);
  routerRef.current = router;

  const [activeLayerId, setActiveLayerId] = useState(data.currentLayer?.id ?? null);
  const [mobileSiblingsOpen, setMobileSiblingsOpen] = useState(false);

  // Sync with server on full page navigation
  useEffect(() => { setActiveLayerId(data.currentLayer?.id ?? null); }, [data]);

  // Preload all sibling SVGs + images into browser cache on mount
  useEffect(() => {
    if (!siblingBundle) return;
    for (const d of Object.values(siblingBundle.siblingDataMap)) {
      const svg = d.currentLayer?.svgPath ?? d.project.svgPath;
      if (svg) fetch(svg);
      const bg = d.media.find((m) => m.purpose === 'exploration' && m.type === 'image');
      if (bg?.url) { const img = new Image(); img.src = bg.url; }
    }
  }, [siblingBundle]);

  // Use sibling data from bundle if available, otherwise server data
  const activeData: ExplorerPageData =
    (siblingBundle && activeLayerId ? siblingBundle.siblingDataMap[activeLayerId] : null) ?? data;

  const { project, currentLayer, children, breadcrumbs, currentPath, siblings } = activeData;
  const basePath = `/p/${project.slug}${currentPath.length > 0 ? '/' + currentPath.join('/') : ''}`;
  const svgUrl = currentLayer?.svgPath ?? project.svgPath;
  const currentLabel = project.layerLabels[currentLayer?.depth ?? -1] ?? '';
  const showSiblings = siblings.length > 1 && currentLayer != null;
  const backgroundUrl = activeData.media.find((m) => m.purpose === 'exploration' && m.type === 'image')?.url;
  const availableCount = children.filter((c) => c.status === 'available').length;
  const title = currentLayer ? currentLayer.name : project.name;

  const entityConfigs = useMemo(
    () =>
      children.map((child) => ({
        id: child.svgElementId ?? child.slug,
        label: child.label,
        status: child.status,
        onClick: () => routerRef.current.push(`${basePath}/${child.slug}`),
      })),
    [children, basePath]
  );

  // Switch floors client-side (data from bundle, SVG from browser cache)
  const handleSiblingSelect = useCallback((sibling: Layer) => {
    if (sibling.id === activeLayerId) return;
    if (siblingBundle?.siblingDataMap[sibling.id]) {
      setActiveLayerId(sibling.id);
      const path = [...currentPath.slice(0, -1), sibling.slug];
      window.history.replaceState(null, '', `/p/${project.slug}/${path.join('/')}`);
    } else {
      const path = [...currentPath.slice(0, -1), sibling.slug];
      router.push(`/p/${project.slug}/${path.join('/')}`);
    }
  }, [activeLayerId, siblingBundle, currentPath, project.slug, router]);

  return (
    <div className="relative flex h-screen bg-black overflow-hidden">
      <main id="main-content" className="flex-1 relative">
        {/* key forces fresh InteractiveSVG per floor (SVG loads from cache) */}
        <div key={activeLayerId} className="absolute inset-0">
          {svgUrl ? (
            <InteractiveSVG svgUrl={svgUrl} entities={entityConfigs} backgroundUrl={backgroundUrl} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No hay mapa disponible para este nivel
            </div>
          )}
        </div>

        {/* Floating glass breadcrumb + title (top-left) */}
        <div className="absolute top-4 left-4 z-20 glass-panel px-4 py-3 max-w-[70%]">
          {breadcrumbs.length > 1 && <Breadcrumb items={breadcrumbs} />}
          <h1 className="text-lg font-semibold text-white mt-1">{title}</h1>
        </div>

        {/* Floating glass legend (top-right) */}
        <div className="hidden sm:block absolute top-4 right-4 z-20 glass-panel px-4 py-3">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>
              <span className="text-white font-semibold">{availableCount}</span>/{children.length} disponibles
            </span>
            <div className="flex gap-3">
              {(['available', 'reserved', 'sold'] as const).map((status) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${STATUS_DOT_CLASSES[status]}`} />
                  <span>{STATUS_LABELS[status]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating back button (bottom-left) */}
        {currentLayer && (
          <div className="absolute bottom-4 left-4 z-20">
            <button
              onClick={() => router.back()}
              className={`glass-panel px-4 py-2 text-sm ${buttonStyles('ghost', 'sm')}`}
            >
              ← Volver
            </button>
          </div>
        )}

        {/* Mobile siblings toggle (bottom-right) */}
        {showSiblings && (
          <div className="absolute bottom-4 right-4 z-20 lg:hidden">
            <button
              onClick={() => setMobileSiblingsOpen((o) => !o)}
              className={`glass-panel px-4 py-2 text-sm ${buttonStyles('ghost', 'sm')}`}
            >
              {currentLabel}es ↑
            </button>
          </div>
        )}
      </main>

      {/* Desktop sibling navigator */}
      {showSiblings && currentLayer && (
        <SiblingNavigator
          siblings={siblings}
          currentLayerId={currentLayer.id}
          label={currentLabel}
          onSelect={handleSiblingSelect}
        />
      )}

      {/* Mobile sibling overlay */}
      {showSiblings && mobileSiblingsOpen && (
        <div className="lg:hidden absolute inset-0 z-30 flex flex-col justify-end">
          <div className="flex-1" onClick={() => setMobileSiblingsOpen(false)} />
          <div className="glass-panel rounded-t-2xl rounded-b-none max-h-[60vh] overflow-y-auto mx-2 mb-2">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {currentLabel}es
              </span>
              <button
                onClick={() => setMobileSiblingsOpen(false)}
                className="text-gray-400 hover:text-white text-sm"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col py-1">
              {[...siblings].reverse().map((sibling) => {
                const isCurrent = sibling.id === currentLayer?.id;
                return (
                  <button
                    key={sibling.id}
                    onClick={() => {
                      handleSiblingSelect(sibling);
                      setMobileSiblingsOpen(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors outline-none ${
                      isCurrent
                        ? 'bg-white/15 text-white font-semibold border-l-2 border-white'
                        : 'text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT_CLASSES[sibling.status]}`} />
                    <span className="truncate">{sibling.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
