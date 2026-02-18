'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Media } from '@/types/hierarchy.types';
import { VideoPlayer } from './VideoPlayer';

interface Spin360ViewerProps {
  media: Media[];
  spinSvgs: Record<string, string>;
  onEnterBuilding?: () => void;
  /** URLs to preload into browser cache when entrance video starts */
  preloadOnEntrance?: string[];
}

type ViewpointId = 'home' | 'point-a' | 'point-b';

const VIEWPOINT_ORDER: ViewpointId[] = ['home', 'point-a', 'point-b'];

export function Spin360Viewer({ media, spinSvgs, onEnterBuilding, preloadOnEntrance }: Spin360ViewerProps) {
  const [currentViewpoint, setCurrentViewpoint] = useState<ViewpointId>('home');
  const [phase, setPhase] = useState<'idle' | 'transitioning'>('idle');
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [transitionVideoUrl, setTransitionVideoUrl] = useState<string | null>(null);
  const [entranceVideoUrl, setEntranceVideoUrl] = useState<string | null>(null);
  const [entranceVideoPlaying, setEntranceVideoPlaying] = useState(false);
  const onVideoEndRef = useRef<(() => void) | null>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Build viewpoints from media
  const viewpoints = useMemo(() => {
    return VIEWPOINT_ORDER.map((id) => {
      const image = media.find((m) => {
        if (m.type !== 'image') return false;
        const meta = m.metadata as Record<string, unknown>;
        return meta?.viewpoint === id;
      });
      return { id, image, svgPath: spinSvgs[id] };
    });
  }, [media, spinSvgs]);

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
    (from: ViewpointId, to: ViewpointId): Media | undefined => {
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
    (viewpoint: ViewpointId): Media | undefined => {
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

  // Load and inject SVG overlay for current viewpoint
  useEffect(() => {
    if (phase !== 'idle') return;

    const container = svgContainerRef.current;
    if (!container) return;

    let cancelled = false;
    const svgPath = spinSvgs[currentViewpoint];

    (async () => {
      try {
        const res = await fetch(svgPath);
        if (!res.ok || cancelled) return;
        const svgText = await res.text();
        if (cancelled) return;

        container.innerHTML = svgText;

        const svg = container.querySelector('svg');
        if (!svg) return;

        // Make responsive & transparent — match bg-cover behavior
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        svg.style.display = 'block';
        svg.style.background = 'transparent';

        // Remove hidden image reference
        const images = svg.querySelectorAll('image');
        images.forEach((img) => img.remove());

        // Style the tower polygon (building outline)
        const tower = svg.querySelector('#tower') as SVGElement | null;
        if (tower) {
          tower.style.fill = 'rgba(255, 255, 255, 0.05)';
          tower.style.stroke = 'rgba(255, 255, 255, 0.4)';
          tower.style.strokeWidth = '2';
        }

        // Style and make the marker clickable
        const marker = svg.querySelector('#marker') as SVGElement | null;
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

          // Add pulsing animation
          const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
          animate.setAttribute('attributeName', 'r');
          animate.setAttribute('values', '22;28;22');
          animate.setAttribute('dur', '2s');
          animate.setAttribute('repeatCount', 'indefinite');
          marker.appendChild(animate);
        }
      } catch {
        // Silently fail SVG load
      }
    })();

    return () => {
      cancelled = true;
      container.innerHTML = '';
    };
  }, [currentViewpoint, phase, handleEnterBuilding, spinSvgs]);

  const navigateTo = useCallback(
    (target: ViewpointId) => {
      if (target === currentViewpoint || phase === 'transitioning') return;

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
    [currentViewpoint, phase, findTransitionVideo]
  );

  const currentIdx = VIEWPOINT_ORDER.indexOf(currentViewpoint);
  const nextIdx = (currentIdx + 1) % VIEWPOINT_ORDER.length;
  const prevIdx = (currentIdx - 1 + VIEWPOINT_ORDER.length) % VIEWPOINT_ORDER.length;

  const showOverlay = phase === 'idle' || !videoPlaying;

  return (
    <div className="relative w-full h-full">
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

      {/* SVG overlay + controls — visible when idle or video hasn't started */}
      {showOverlay && !entranceVideoPlaying && (
        <>
          {/* SVG overlay (building outline + clickable marker) */}
          <div
            ref={svgContainerRef}
            className="absolute inset-0 z-10"
          />

          {/* "Enter" hint label */}
          {onEnterBuilding && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
              <button
                onClick={handleEnterBuilding}
                className="bg-black/60 backdrop-blur-md border border-white/10 px-5 py-2.5 rounded-full text-sm font-medium text-white shadow-lg hover:bg-white/20 transition-colors"
              >
                Explorar niveles
              </button>
            </div>
          )}

          {/* Navigation controls */}
          <div className="absolute bottom-0 inset-x-0 z-20 flex items-end justify-center pb-20">
            <div className="flex items-center gap-4 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
              <button
                onClick={() => navigateTo(VIEWPOINT_ORDER[prevIdx])}
                className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors"
                aria-label="Vista anterior"
              >
                ←
              </button>
              <button
                onClick={() => navigateTo(VIEWPOINT_ORDER[nextIdx])}
                className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors"
                aria-label="Vista siguiente"
              >
                →
              </button>
            </div>
          </div>
        </>
      )}

      {/* Entrance video — starts behind images (z-1), promoted above
          everything (z-50) once the first frame is playing */}
      {entranceVideoUrl && (
        <div className="absolute inset-0" style={{ zIndex: entranceVideoPlaying ? 50 : 1 }}>
          <VideoPlayer
            src={entranceVideoUrl}
            autoPlay
            muted
            controls={false}
            onPlaying={() => setEntranceVideoPlaying(true)}
            onEnded={() => onEnterBuilding?.()}
            className="w-full h-full"
          />
        </div>
      )}
    </div>
  );
}
