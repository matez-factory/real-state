'use client';

import { useState, useMemo, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Media } from '@/types/hierarchy.types';
import { VideoPlayer } from './VideoPlayer';
import { useIsMobilePortrait } from '@/hooks/useIsMobilePortrait';

interface NavigationRenderProps {
  onPrev: () => void;
  onNext: () => void;
  isTransitioning: boolean;
}

interface Spin360ViewerProps {
  media: Media[];
  spinSvgs: Record<string, string>;
  onEnterBuilding?: () => void;
  /** URLs to preload into browser cache when entrance video starts */
  preloadOnEntrance?: string[];
  /** Label for the CTA button (default: 'Explorar niveles') */
  enterLabel?: string;
  /** When true, hides the built-in CTA button and bottom arrows (lots experience) */
  hideControls?: boolean;
  /** When true, hides the SVG hotspot overlay (e.g. during landing) */
  hideSvgOverlay?: boolean;
  /** Render prop for custom navigation (e.g. side arrows for lots) */
  renderNavigation?: (props: NavigationRenderProps) => React.ReactNode;
  /** Enable horizontal panorama scroll in portrait mode (default: false) */
  enablePanorama?: boolean;
  /** SVG element ID for the tower hotspot (default: 'tower') */
  hotspotTowerId?: string;
  /** SVG element ID for the marker hotspot (default: 'marker') */
  hotspotMarkerId?: string;
  /** Notifies parent when viewpoint changes */
  onViewpointChange?: (id: string) => void;
  /** Notifies parent when transition state changes */
  onTransitionChange?: (isTransitioning: boolean) => void;
}

export interface Spin360ViewerRef {
  enterBuilding: () => void;
}

export const Spin360Viewer = forwardRef<Spin360ViewerRef, Spin360ViewerProps>(function Spin360Viewer({
  media,
  spinSvgs,
  onEnterBuilding,
  preloadOnEntrance,
  enterLabel = 'Explorar niveles',
  hideControls,
  hideSvgOverlay,
  renderNavigation,
  enablePanorama = false,
  hotspotTowerId,
  hotspotMarkerId,
  onViewpointChange,
  onTransitionChange,
}: Spin360ViewerProps, ref: React.Ref<Spin360ViewerRef>) {
  // Derive viewpoint order dynamically from SVG hotspot media
  const viewpointOrder = useMemo(() => {
    return media
      .filter((m) => m.type === 'svg' && m.purpose === 'hotspot')
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => (m.metadata as Record<string, unknown>)?.viewpoint as string)
      .filter(Boolean);
  }, [media]);

  const [currentViewpoint, setCurrentViewpoint] = useState<string>(() => '');
  const [phase, setPhase] = useState<'idle' | 'transitioning'>('idle');
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [transitionVideoUrl, setTransitionVideoUrl] = useState<string | null>(null);
  const [entranceVideoUrl, setEntranceVideoUrl] = useState<string | null>(null);
  const [entranceVideoPlaying, setEntranceVideoPlaying] = useState(false);
  const [entranceFadingOut] = useState(false);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false, x: 0, y: 0,
  });
  const onVideoEndRef = useRef<(() => void) | null>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const isMobilePortrait = useIsMobilePortrait();
  const portraitPanorama = isMobilePortrait && enablePanorama;

  // Initialize currentViewpoint when viewpointOrder is derived
  useEffect(() => {
    if (viewpointOrder.length > 0 && !currentViewpoint) {
      setCurrentViewpoint(viewpointOrder[0]);
    }
  }, [viewpointOrder, currentViewpoint]);

  // Notify parent when viewpoint changes
  useEffect(() => {
    if (currentViewpoint) {
      onViewpointChange?.(currentViewpoint);
    }
  }, [currentViewpoint, onViewpointChange]);

  // Notify parent when transition state changes
  useEffect(() => {
    onTransitionChange?.(phase === 'transitioning');
  }, [phase, onTransitionChange]);

  // Build viewpoints from media
  const viewpoints = useMemo(() => {
    return viewpointOrder.map((id) => {
      const image = media.find((m) => {
        if (m.type !== 'image') return false;
        const meta = m.metadata as Record<string, unknown>;
        return meta?.viewpoint === id;
      });
      return { id, image, svgPath: spinSvgs[id] };
    });
  }, [viewpointOrder, media, spinSvgs]);

  // Preload all transition videos into browser cache
  useEffect(() => {
    media.forEach((m) => {
      if (m.type === 'video' && m.purpose === 'transition' && m.url) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'video';
        link.href = m.url;
        document.head.appendChild(link);
      }
    });
  }, [media]);

  // Find transition video between two viewpoints
  const findTransitionVideo = useCallback(
    (from: string, to: string): Media | undefined => {
      return media.find((m) => {
        if (m.type !== 'video' || m.purpose !== 'transition') return false;
        const meta = m.metadata as Record<string, unknown>;
        return meta?.from_viewpoint === from && meta?.to_viewpoint === to;
      });
    },
    [media]
  );

  // Find entrance video for current viewpoint
  const findEntranceVideo = useCallback(
    (viewpoint: string): Media | undefined => {
      return media.find((m) => {
        if (m.type !== 'video') return false;
        const meta = m.metadata as Record<string, unknown>;
        return meta?.entrance_from_viewpoint === viewpoint;
      });
    },
    [media]
  );

  // Intercept enter building to play entrance video first
  const handleEnterBuilding = useCallback(() => {
    const video = findEntranceVideo(currentViewpoint);
    if (video?.url) {
      setEntranceVideoUrl(video.url);
      // Preload destination floor assets while the entrance video plays
      preloadOnEntrance?.forEach((url) => {
        if (url.endsWith('.svg')) {
          fetch(url);
        } else {
          const img = new Image();
          img.src = url;
        }
      });
    } else {
      onEnterBuilding?.();
    }
  }, [currentViewpoint, findEntranceVideo, onEnterBuilding, preloadOnEntrance]);

  useImperativeHandle(ref, () => ({
    enterBuilding: handleEnterBuilding,
  }), [handleEnterBuilding]);

  // Load and inject SVG overlay for current viewpoint
  // Copied from lot-visualizer TourHotspots.tsx
  useEffect(() => {
    if (phase !== 'idle') return;

    const container = svgContainerRef.current;
    if (!container) return;

    let cancelled = false;
    const svgPath = spinSvgs[currentViewpoint];
    if (!svgPath) return;

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 1280;

    fetch(svgPath)
      .then((res) => res.text())
      .then((svgText) => {
        if (cancelled) return;

        container.innerHTML = svgText;

        const svg = container.querySelector('svg');
        if (!svg) return;

        // Remove hidden image references
        svg.querySelectorAll('image').forEach((img) => img.remove());

        // SVG sizing — matches original TourHotspots
        if (portraitPanorama) {
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          svg.style.width = '100%';
          svg.style.height = '100%';
        } else {
          svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
          svg.style.position = 'absolute';
          svg.style.inset = '0';
          svg.style.width = '100%';
          svg.style.height = '100%';
        }

        const towerId = hotspotTowerId ?? 'tower';
        const markerId = hotspotMarkerId ?? 'marker';
        const tower = svg.querySelector(`#${CSS.escape(towerId)}`) as SVGElement | null;
        const marker = svg.querySelector(`#${CSS.escape(markerId)}`) as SVGElement | null;
        const hasNamedElements = !!tower || !!marker;

        if (hasNamedElements) {
          // === Building SVGs — named elements ===
          if (tower) {
            if (isMobile) {
              tower.classList.add('hotspot-pulse');
            } else {
              tower.style.fill = 'rgba(255, 255, 255, 0.05)';
              tower.style.stroke = 'rgba(255, 255, 255, 0.4)';
              tower.style.strokeWidth = '2';
            }
          }

          if (marker) {
            marker.style.fill = 'rgba(74, 144, 226, 0.7)';
            marker.style.stroke = '#ffffff';
            marker.style.strokeWidth = '4';
            marker.style.cursor = 'pointer';
            marker.style.transition = 'fill 0.3s ease, stroke-width 0.3s ease';

            marker.addEventListener('mouseenter', () => {
              marker.style.fill = 'rgba(74, 144, 226, 1)';
              marker.style.strokeWidth = '6';
            });
            marker.addEventListener('mouseleave', () => {
              marker.style.fill = 'rgba(74, 144, 226, 0.7)';
              marker.style.strokeWidth = '4';
            });
            marker.addEventListener('click', (e) => {
              e.stopPropagation();
              handleEnterBuilding();
            });

            const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            animate.setAttribute('attributeName', 'r');
            animate.setAttribute('values', '22;28;22');
            animate.setAttribute('dur', '2s');
            animate.setAttribute('repeatCount', 'indefinite');
            marker.appendChild(animate);
          }
        } else {
          // === Generic SVGs (lots + building tour) ===

          // Remove decorative circles (e.g. marker dots in building SVGs)
          svg.querySelectorAll('circle').forEach((c) => c.remove());

          // Inject pulse animation style directly into the SVG (mobile)
          if (isMobile) {
            const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
            style.textContent = `
              @keyframes hotspotPulse {
                0%, 100% {
                  fill: rgba(255, 255, 255, 0.1);
                  stroke: rgba(255, 255, 255, 0.4);
                }
                50% {
                  fill: rgba(255, 255, 255, 0.2);
                  stroke: rgba(255, 255, 255, 0.7);
                }
              }
              .hotspot-pulse {
                animation: hotspotPulse 2s ease-in-out infinite;
                stroke-width: 2px;
              }
            `;
            svg.insertBefore(style, svg.firstChild);
          }

          const shapes = svg.querySelectorAll<SVGElement>('path, polygon, polyline, rect, ellipse');

          shapes.forEach((shape) => {
            shape.style.cursor = 'pointer';
            shape.style.transition = 'fill 0.2s ease, stroke 0.2s ease';

            if (isMobile) {
              shape.classList.add('hotspot-pulse');
            } else {
              shape.style.fill = 'transparent';
              shape.style.stroke = 'transparent';
            }

            if (!isMobile) {
              shape.addEventListener('mouseenter', () => {
                shapes.forEach((s) => {
                  s.style.fill = 'rgba(255, 255, 255, 0.15)';
                  s.style.stroke = 'rgba(255, 255, 255, 0.6)';
                });
                setTooltip((prev) => ({ ...prev, visible: true }));
              });

              shape.addEventListener('mouseleave', () => {
                shapes.forEach((s) => {
                  s.style.fill = 'transparent';
                  s.style.stroke = 'transparent';
                });
                setTooltip((prev) => ({ ...prev, visible: false }));
              });

              shape.addEventListener('mousemove', (e) => {
                setTooltip({ visible: true, x: e.clientX, y: e.clientY });
              });
            }

            shape.addEventListener('click', (e) => {
              e.stopPropagation();
              handleEnterBuilding();
            });
          });
        }
      })
      .catch(() => {
        // Silently fail SVG load
      });

    return () => {
      cancelled = true;
      container.innerHTML = '';
    };
  }, [currentViewpoint, phase, handleEnterBuilding, spinSvgs, portraitPanorama, hotspotTowerId, hotspotMarkerId]);

  // Center panorama scroll on mount / viewpoint change
  useEffect(() => {
    if (!portraitPanorama || !scrollRef.current) return;
    const el = scrollRef.current;
    // Wait a frame for layout to settle
    requestAnimationFrame(() => {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    });
  }, [currentViewpoint, portraitPanorama]);

  const navigateTo = useCallback(
    (target: string) => {
      if (target === currentViewpoint || phase === 'transitioning') return;

      // In portrait panorama, skip transition videos — just snap
      if (portraitPanorama) {
        setCurrentViewpoint(target);
        return;
      }

      const video = findTransitionVideo(currentViewpoint, target);
      if (video?.url) {
        setVideoPlaying(false);
        setPhase('transitioning');
        setTransitionVideoUrl(video.url);
        onVideoEndRef.current = () => {
          setCurrentViewpoint(target);
          setPhase('idle');
          setVideoPlaying(false);
          setTransitionVideoUrl(null);
        };
      } else {
        setCurrentViewpoint(target);
      }
    },
    [currentViewpoint, phase, findTransitionVideo, portraitPanorama]
  );

  const currentIdx = viewpointOrder.indexOf(currentViewpoint);
  const nextIdx = (currentIdx + 1) % viewpointOrder.length;
  const prevIdx = (currentIdx - 1 + viewpointOrder.length) % viewpointOrder.length;

  // Drag/swipe navigation — disabled in portrait panorama (scroll takes over)
  useEffect(() => {
    if (portraitPanorama) return;
    const el = dragRef.current;
    if (!el) return;

    let startX = 0;
    let dragging = false;

    const onPointerDown = (e: PointerEvent) => {
      startX = e.clientX;
      dragging = true;
      el.setPointerCapture(e.pointerId);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      const dx = e.clientX - startX;
      if (Math.abs(dx) >= 25) {
        // Drag left (negative dx) = next, drag right (positive dx) = prev
        if (dx < 0) {
          navigateTo(viewpointOrder[(currentIdx + 1) % viewpointOrder.length]);
        } else {
          navigateTo(viewpointOrder[(currentIdx - 1 + viewpointOrder.length) % viewpointOrder.length]);
        }
      }
    };

    const onPointerCancel = () => {
      dragging = false;
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [portraitPanorama, navigateTo, currentIdx, viewpointOrder]);

  const showOverlay = phase === 'idle' || !videoPlaying;

  // SVG container — pointer-events-none on container, auto on all SVG shape elements
  const shapePointerEvents = '[&_path]:pointer-events-auto [&_polygon]:pointer-events-auto [&_polyline]:pointer-events-auto [&_rect]:pointer-events-auto [&_ellipse]:pointer-events-auto';
  const svgOverlay = showOverlay && !entranceVideoPlaying && !hideSvgOverlay && (
    <div
      ref={svgContainerRef}
      className={
        portraitPanorama
          ? `absolute top-0 left-0 w-full h-full z-20 pointer-events-none ${shapePointerEvents}`
          : `absolute inset-0 z-20 pointer-events-none ${shapePointerEvents}`
      }
    />
  );

  return (
    <div className="relative w-full h-full">
      {/* === Portrait panorama mode === */}
      {portraitPanorama ? (
        <>
          {/* Scrollable panorama container for active viewpoint */}
          {viewpoints.map((vp) => (
            <div
              key={vp.id}
              ref={vp.id === currentViewpoint ? scrollRef : undefined}
              className="absolute inset-0 overflow-x-auto overflow-y-hidden no-scrollbar"
              style={{
                opacity: vp.id === currentViewpoint ? 1 : 0,
                zIndex: vp.id === currentViewpoint ? 5 : 1,
                touchAction: 'pan-x',
                pointerEvents: vp.id === currentViewpoint ? 'auto' : 'none',
              }}
            >
              <div
                className="h-full relative"
                style={{ width: 'calc(100dvh * 1920 / 1080)' }}
              >
                <img
                  src={vp.image?.url}
                  alt=""
                  className="h-full w-auto"
                />
                {/* SVG overlay inside panorama scroll — only for active viewpoint */}
                {vp.id === currentViewpoint && svgOverlay}
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          {/* === Standard mode (desktop / landscape) === */}
          {/* All viewpoint images — always mounted, toggled via opacity.
              Keeping them in the DOM means the browser has them decoded
              and ready to paint instantly, eliminating the black flash. */}
          {viewpoints.map((vp) => (
            <img
              key={vp.id}
              src={vp.image?.url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: vp.id === currentViewpoint ? 1 : 0,
                zIndex: vp.id === currentViewpoint ? 5 : 1,
              }}
            />
          ))}

          {/* SVG overlay — standard mode */}
          {svgOverlay}

          {/* Drag/swipe layer — z-10 like original TourInteraction */}
          {showOverlay && !entranceVideoPlaying && (
            <div
              ref={dragRef}
              className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
              style={{ touchAction: 'none' }}
            />
          )}
        </>
      )}

      {/* Cursor tooltip — copied from TourHotspots.tsx */}
      {tooltip.visible && (
        <div
          className="fixed z-50 px-3 py-1.5 bg-black/80 backdrop-blur-sm text-white text-sm font-medium rounded-lg pointer-events-none"
          style={{ left: tooltip.x + 16, top: tooltip.y + 16 }}
        >
          Ingresar
        </div>
      )}

      {/* Transition video — starts behind images (z-1), promoted
          above (z-10) once the first frame is playing */}
      {phase === 'transitioning' && transitionVideoUrl && (
        <div className="absolute inset-0" style={{ zIndex: videoPlaying ? 10 : 1 }}>
          <VideoPlayer
            src={transitionVideoUrl}
            autoPlay
            muted
            controls={false}
            onPlaying={() => setVideoPlaying(true)}
            onEnded={() => onVideoEndRef.current?.()}
            className="w-full h-full"
          />
        </div>
      )}

      {/* Built-in controls (building experience) — hidden when hideControls is true */}
      {showOverlay && !entranceVideoPlaying && !hideControls && (
        <>
          {/* "Enter" hint label */}
          {onEnterBuilding && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
              <button
                onClick={handleEnterBuilding}
                className="bg-black/60 backdrop-blur-md border border-white/10 px-5 py-2.5 rounded-full text-sm font-medium text-white shadow-lg hover:bg-white/20 transition-colors"
              >
                {enterLabel}
              </button>
            </div>
          )}

          {/* Navigation controls */}
          <div className="absolute bottom-0 inset-x-0 z-20 flex items-end justify-center pb-20">
            <div className="flex items-center gap-4 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
              <button
                onClick={() => navigateTo(viewpointOrder[prevIdx])}
                className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors"
                aria-label="Vista anterior"
              >
                ←
              </button>
              <button
                onClick={() => navigateTo(viewpointOrder[nextIdx])}
                className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors"
                aria-label="Vista siguiente"
              >
                →
              </button>
            </div>
          </div>
        </>
      )}

      {/* Custom navigation from parent (lots side arrows) */}
      {renderNavigation?.({
        onPrev: () => navigateTo(viewpointOrder[prevIdx]),
        onNext: () => navigateTo(viewpointOrder[nextIdx]),
        isTransitioning: phase === 'transitioning',
      })}

      {/* Entrance video — starts behind images (z-1), promoted above
          everything (z-50) once the first frame is playing.
          On end: fades to black over 500ms, then navigates. */}
      {entranceVideoUrl && (
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            zIndex: entranceVideoPlaying ? 50 : 1,
            opacity: entranceFadingOut ? 0 : 1,
          }}
        >
          <VideoPlayer
            src={entranceVideoUrl}
            autoPlay
            muted
            controls={false}
            onPlaying={() => setEntranceVideoPlaying(true)}
            onEnded={() => {
              // Navigate immediately — no fade-out, video last frame stays
              // visible until view transition screenshot takes over
              onEnterBuilding?.();
            }}
            className="w-full h-full"
          />
        </div>
      )}
    </div>
  );
});
