'use client';

import { useEffect, useRef, useCallback } from 'react';
import { EntityStatus } from '@/types/hierarchy.types';
import { STATUS_LABELS } from '@/lib/constants/status';

interface SVGEntityConfig {
  id: string;
  label: string;
  status: EntityStatus;
  onClick: () => void;
}

interface InteractiveSVGProps {
  svgUrl: string;
  svgMobileUrl?: string;
  entities: SVGEntityConfig[];
  backgroundUrl?: string;
  backgroundMobileUrl?: string;
}

// Status dot colors matching original lot-visualizer
const STATUS_DOT_COLORS: Record<EntityStatus, string> = {
  available: '#22c55e',
  reserved: '#eab308',
  sold: '#ef4444',
  not_available: '#9ca3af',
};

type ListenerEntry = { element: SVGElement; event: string; handler: EventListener };

export function InteractiveSVG({
  svgUrl,
  svgMobileUrl,
  entities,
  backgroundUrl,
  backgroundMobileUrl,
}: InteractiveSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listenersRef = useRef<ListenerEntry[]>([]);

  // Resolve which SVG/background to use based on orientation
  const resolveAssets = useCallback(() => {
    const isPortrait =
      typeof window !== 'undefined' &&
      window.matchMedia('(orientation: portrait) and (max-width: 1279px)').matches;
    return {
      activeSvgUrl: (isPortrait && svgMobileUrl) ? svgMobileUrl : svgUrl,
      activeBgUrl: (isPortrait && backgroundMobileUrl) ? backgroundMobileUrl : backgroundUrl,
    };
  }, [svgUrl, svgMobileUrl, backgroundUrl, backgroundMobileUrl]);

  const setupSVG = useCallback(async (container: HTMLDivElement) => {
    const { activeSvgUrl, activeBgUrl } = resolveAssets();

    const res = await fetch(activeSvgUrl);
    if (!res.ok) throw new Error(`Failed to load SVG: ${res.statusText}`);

    const svgText = await res.text();
    container.innerHTML = svgText;

    const svg = container.querySelector('svg');
    if (!svg) throw new Error('No SVG element found');

    // Make SVG fill the viewport (like the original: cover, not contain)
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.style.display = 'block';
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.background = 'transparent';

    // Inject background image inside SVG so it scales with the same coordinate system
    if (activeBgUrl) {
      const viewBox = svg.getAttribute('viewBox');
      const [, , vbWidth, vbHeight] = (viewBox ?? '0 0 1920 1080').split(' ');
      const bgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      bgImage.setAttribute('href', activeBgUrl);
      bgImage.setAttribute('x', '0');
      bgImage.setAttribute('y', '0');
      bgImage.setAttribute('width', vbWidth);
      bgImage.setAttribute('height', vbHeight);
      bgImage.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      svg.insertBefore(bgImage, svg.firstChild);
    }

    // Make non-interactive SVG elements semi-transparent so background shows through
    const allPaths = svg.querySelectorAll('path, rect, polygon, circle, ellipse');
    allPaths.forEach((el) => {
      const element = el as SVGElement;
      if (!element.id || !entities.find(e => e.id === element.id)) {
        element.style.opacity = '0.3';
      }
    });

    const listeners: ListenerEntry[] = [];

    // Process each entity — matching original SVGLotOverlay style
    entities.forEach((entity) => {
      const element = svg.querySelector(`#${CSS.escape(entity.id)}`) as SVGElement;
      if (!element) {
        console.warn(`Element with id "${entity.id}" not found in SVG`);
        return;
      }

      // Original style: transparent fill, white hover
      element.style.fill = 'transparent';
      element.style.cursor = 'pointer';
      element.style.pointerEvents = 'all';
      element.style.transition = 'fill 0.2s ease';

      // Keyboard accessibility
      element.setAttribute('tabindex', '0');
      element.setAttribute('role', 'button');
      element.setAttribute('aria-label', `${entity.label} — ${STATUS_LABELS[entity.status]}`);
      element.style.outline = 'none';

      // We'll store the label bgRect reference for hover darkening
      let bgRect: SVGRectElement | null = null;
      let scaleGroup: SVGGElement | null = null;

      const onEnter = () => {
        element.style.fill = 'rgba(255, 255, 255, 0.15)';
        if (bgRect) bgRect.setAttribute('fill', 'rgba(0, 0, 0, 0.75)');
        if (scaleGroup) scaleGroup.style.transform = 'scale(1.2)';
      };
      const onLeave = () => {
        element.style.fill = 'transparent';
        if (bgRect) bgRect.setAttribute('fill', 'rgba(0, 0, 0, 0.45)');
        if (scaleGroup) scaleGroup.style.transform = 'scale(1)';
      };
      const onClick = (e: Event) => {
        e.stopPropagation();
        entity.onClick();
      };
      const onFocus = () => {
        element.style.fill = 'rgba(255, 255, 255, 0.15)';
        if (bgRect) bgRect.setAttribute('fill', 'rgba(0, 0, 0, 0.75)');
        if (scaleGroup) scaleGroup.style.transform = 'scale(1.2)';
      };
      const onBlur = () => {
        element.style.fill = 'transparent';
        if (bgRect) bgRect.setAttribute('fill', 'rgba(0, 0, 0, 0.45)');
        if (scaleGroup) scaleGroup.style.transform = 'scale(1)';
      };
      const onKeyDown = (e: Event) => {
        const key = (e as KeyboardEvent).key;
        if (key === 'Enter' || key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          entity.onClick();
        }
      };

      element.addEventListener('mouseenter', onEnter);
      element.addEventListener('mouseleave', onLeave);
      element.addEventListener('click', onClick);
      element.addEventListener('focus', onFocus);
      element.addEventListener('blur', onBlur);
      element.addEventListener('keydown', onKeyDown);

      listeners.push(
        { element, event: 'mouseenter', handler: onEnter },
        { element, event: 'mouseleave', handler: onLeave },
        { element, event: 'click', handler: onClick },
        { element, event: 'focus', handler: onFocus },
        { element, event: 'blur', handler: onBlur },
        { element, event: 'keydown', handler: onKeyDown },
      );

      // Add label — matching original SVGLotOverlay style (pill with dot inside)
      try {
        const bbox = (element as SVGGraphicsElement).getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;

        // Outer group positioned at center
        const posGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        posGroup.setAttribute('transform', `translate(${centerX}, ${centerY})`);
        posGroup.setAttribute('pointer-events', 'none');

        // Inner group for scale transform (centered at 0,0)
        scaleGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        scaleGroup.style.transition = 'transform 0.2s ease';
        scaleGroup.style.transformOrigin = '0 0';

        // Pill background
        const textWidth = entity.label.length * 8 + 28;
        bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('x', String(-textWidth / 2));
        bgRect.setAttribute('y', '-13');
        bgRect.setAttribute('width', String(textWidth));
        bgRect.setAttribute('height', '26');
        bgRect.setAttribute('rx', '13');
        bgRect.setAttribute('fill', 'rgba(0, 0, 0, 0.45)');
        bgRect.style.transition = 'fill 0.2s ease';

        // Status indicator dot (inside pill, left side)
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', String(-textWidth / 2 + 13));
        dot.setAttribute('cy', '0');
        dot.setAttribute('r', '4');
        dot.setAttribute('fill', STATUS_DOT_COLORS[entity.status]);

        // Label text (after dot)
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(-textWidth / 2 + 23));
        text.setAttribute('y', '4');
        text.setAttribute('font-family', 'system-ui, sans-serif');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', '600');
        text.setAttribute('fill', '#ffffff');
        text.textContent = entity.label;

        scaleGroup.appendChild(bgRect);
        scaleGroup.appendChild(dot);
        scaleGroup.appendChild(text);
        posGroup.appendChild(scaleGroup);
        svg.appendChild(posGroup);
      } catch (err) {
        console.warn(`Could not add label for ${entity.id}:`, err);
      }
    });

    listenersRef.current = listeners;
  }, [resolveAssets, entities]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      // Clean up previous SVG
      for (const { element, event, handler } of listenersRef.current) {
        element.removeEventListener(event, handler);
      }
      listenersRef.current = [];
      container.innerHTML = '';

      setupSVG(container).catch((err) => {
        if (!cancelled) console.error('Error loading SVG:', err);
      });
    };

    run();

    // Re-setup on orientation change (portrait ↔ landscape)
    const hasMobileAssets = !!(svgMobileUrl || backgroundMobileUrl);
    const mq = hasMobileAssets
      ? window.matchMedia('(orientation: portrait) and (max-width: 1279px)')
      : null;

    if (mq) {
      const onOrientationChange = () => run();
      mq.addEventListener('change', onOrientationChange);
      return () => {
        cancelled = true;
        mq.removeEventListener('change', onOrientationChange);
        for (const { element, event, handler } of listenersRef.current) {
          element.removeEventListener(event, handler);
        }
        listenersRef.current = [];
        container.innerHTML = '';
      };
    }

    return () => {
      cancelled = true;
      for (const { element, event, handler } of listenersRef.current) {
        element.removeEventListener(event, handler);
      }
      listenersRef.current = [];
      container.innerHTML = '';
    };
  }, [setupSVG, svgMobileUrl, backgroundMobileUrl]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
    />
  );
}
