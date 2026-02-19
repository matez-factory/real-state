import type { ExplorerPageData } from '@/types/hierarchy.types';

/**
 * General layer-based navigation helpers.
 *
 * - "Inicio" = first root layer (depth 0, lowest sortOrder)
 * - "Atrás"  = previous sibling if depth 0, parent if deeper
 *
 * Works for any number of layers:
 *   Splash → tour (d0,s0) → zona (d0,s1) → manzana (d1) → lote (d2)
 *   Inicio always → tour
 *   Atrás from zona → tour (prev sibling)
 *   Atrás from manzana → zona (parent)
 *   Atrás from lote → manzana (parent)
 *   Atrás from tour → splash (first root, no prev)
 */

/** URL for the "Inicio" button — always the first root layer */
export function getHomeUrl(data: ExplorerPageData): string {
  const { project, rootLayers } = data;
  if (rootLayers.length > 0) {
    return `/p/${project.slug}/${rootLayers[0].slug}`;
  }
  return `/p/${project.slug}`;
}

/** URL for the "Atrás" / back button */
export function getBackUrl(data: ExplorerPageData): string {
  const { project, currentLayer, currentPath, rootLayers } = data;

  // At splash — nowhere to go back
  if (!currentLayer) return `/p/${project.slug}`;

  // At depth 0 — go to previous root sibling, or splash if first
  if (currentLayer.depth === 0) {
    const idx = rootLayers.findIndex((l) => l.id === currentLayer.id);
    if (idx > 0) {
      return `/p/${project.slug}/${rootLayers[idx - 1].slug}`;
    }
    return `/p/${project.slug}`;
  }

  // Deeper layers — go to parent
  const parentPath = currentPath.slice(0, -1);
  return parentPath.length > 0
    ? `/p/${project.slug}/${parentPath.join('/')}`
    : `/p/${project.slug}`;
}
