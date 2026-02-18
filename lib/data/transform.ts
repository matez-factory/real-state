import {
  Project,
  Layer,
  Media,
  ExplorerPageData,
  SiblingExplorerBundle,
  EntityStatus,
  ProjectType,
  MediaType,
  MediaPurpose,
  BreadcrumbItem,
} from '@/types/hierarchy.types';

// ============================================================
// Raw DB row types (snake_case from Supabase)
// ============================================================

export interface RawProject {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  layer_labels: string[];
  max_depth: number;
  svg_path: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  coordinates: { lat: number; lng: number } | null;
  settings: Record<string, unknown>;
}

export interface RawLayer {
  id: string;
  project_id: string;
  parent_id: string | null;
  depth: number;
  sort_order: number;
  slug: string;
  name: string;
  label: string | null;
  svg_element_id: string | null;
  status: string;
  svg_path: string | null;
  properties: Record<string, unknown>;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_notes: string | null;
  reserved_at: string | null;
  sold_at: string | null;
}

export interface RawMedia {
  id: string;
  project_id: string;
  layer_id: string | null;
  type: string;
  purpose: string;
  storage_path: string;
  url: string | null;
  title: string | null;
  description: string | null;
  alt_text: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
}

// ============================================================
// Transform functions
// ============================================================

export function transformProject(raw: RawProject): Project {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    description: raw.description || undefined,
    type: raw.type as ProjectType,
    status: raw.status as EntityStatus,
    layerLabels: raw.layer_labels,
    maxDepth: raw.max_depth,
    svgPath: raw.svg_path || undefined,
    address: raw.address || undefined,
    city: raw.city || undefined,
    state: raw.state || undefined,
    country: raw.country || undefined,
    coordinates: raw.coordinates || undefined,
    settings: raw.settings,
  };
}

export function transformLayer(raw: RawLayer): Layer {
  return {
    id: raw.id,
    projectId: raw.project_id,
    parentId: raw.parent_id,
    depth: raw.depth,
    sortOrder: raw.sort_order,
    slug: raw.slug,
    name: raw.name,
    label: raw.label || raw.name,
    svgElementId: raw.svg_element_id || undefined,
    status: raw.status as EntityStatus,
    svgPath: raw.svg_path || undefined,
    properties: raw.properties,
    buyerName: raw.buyer_name || undefined,
    buyerEmail: raw.buyer_email || undefined,
    buyerPhone: raw.buyer_phone || undefined,
    buyerNotes: raw.buyer_notes || undefined,
    reservedAt: raw.reserved_at || undefined,
    soldAt: raw.sold_at || undefined,
  };
}

export function transformMedia(raw: RawMedia): Media {
  return {
    id: raw.id,
    projectId: raw.project_id,
    layerId: raw.layer_id || undefined,
    type: raw.type as MediaType,
    purpose: raw.purpose as MediaPurpose,
    storagePath: raw.storage_path,
    url: raw.url || undefined,
    title: raw.title || undefined,
    description: raw.description || undefined,
    altText: raw.alt_text || undefined,
    sortOrder: raw.sort_order,
    metadata: raw.metadata,
  };
}

// ============================================================
// Build ExplorerPageData from raw DB data + a layer path
// ============================================================

export function buildExplorerPageData(
  rawProject: RawProject,
  rawLayers: RawLayer[],
  rawMedia: RawMedia[],
  layerSlugs: string[]
): ExplorerPageData {
  const project = transformProject(rawProject);
  const allLayers = rawLayers.map(transformLayer);
  const allMedia = rawMedia.map(transformMedia);

  // Walk the slug path to find the current layer
  let currentLayerId: string | null = null;
  const pathLayers: Layer[] = [];

  for (const slug of layerSlugs) {
    const found = allLayers.find(
      (l) => l.slug === slug && l.parentId === currentLayerId
    );
    if (!found) {
      throw new Error(`Layer not found: "${slug}" under parent ${currentLayerId}`);
    }
    pathLayers.push(found);
    currentLayerId = found.id;
  }

  const currentLayer = pathLayers.length > 0 ? pathLayers[pathLayers.length - 1] : null;

  // Get children of current layer (or root layers if at project level)
  const currentId = currentLayer?.id ?? null;
  const children = allLayers
    .filter((l) => l.parentId === currentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Determine if children are leaves (no grandchildren exist)
  const childIds = new Set(children.map((c) => c.id));
  const hasGrandchildren = allLayers.some((l) => l.parentId && childIds.has(l.parentId));
  const isLeafLevel = children.length > 0 && !hasGrandchildren;

  // Get media for the current layer (or project-level if at root)
  const media = allMedia
    .filter((m) =>
      currentLayer ? m.layerId === currentLayer.id : !m.layerId
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Get media for each child
  const childrenMedia: Record<string, Media[]> = {};
  for (const child of children) {
    childrenMedia[child.id] = allMedia
      .filter((m) => m.layerId === child.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // Get siblings (layers sharing the same parent, including current)
  const siblings = currentLayer
    ? allLayers
        .filter((l) => l.parentId === currentLayer.parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  // Build breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = [
    { label: project.name, href: `/p/${project.slug}` },
  ];
  for (let i = 0; i < pathLayers.length; i++) {
    const layer = pathLayers[i];
    const isLast = i === pathLayers.length - 1;
    const href = isLast
      ? undefined
      : `/p/${project.slug}/${pathLayers.slice(0, i + 1).map((l) => l.slug).join('/')}`;
    breadcrumbs.push({ label: layer.name, href });
  }

  return {
    project,
    currentLayer,
    children,
    media,
    childrenMedia,
    breadcrumbs,
    isLeafLevel,
    currentPath: layerSlugs,
    siblings,
  };
}

// ============================================================
// Build SiblingExplorerBundle — all sibling data in one pass
// ============================================================

export function buildSiblingExplorerBundle(
  rawProject: RawProject,
  rawLayers: RawLayer[],
  rawMedia: RawMedia[],
  layerSlugs: string[]
): SiblingExplorerBundle {
  const current = buildExplorerPageData(rawProject, rawLayers, rawMedia, layerSlugs);

  const siblingDataMap: Record<string, ExplorerPageData> = {};
  const parentPath = layerSlugs.slice(0, -1);

  // Build data for each sibling (re-uses the same raw arrays — pure filtering)
  for (const sibling of current.siblings) {
    const siblingPath = [...parentPath, sibling.slug];
    siblingDataMap[sibling.id] = buildExplorerPageData(
      rawProject, rawLayers, rawMedia, siblingPath
    );
  }

  const siblingOrder = current.siblings.map((s) => s.id);

  return { current, siblingDataMap, siblingOrder };
}

// ============================================================
// Generate all valid layer paths for static params
// ============================================================

export function generateAllLayerPaths(
  rawLayers: RawLayer[]
): string[][] {
  const paths: string[][] = [];

  function walk(parentId: string | null, currentPath: string[]) {
    const children = rawLayers
      .filter((l) => l.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);

    for (const child of children) {
      const newPath = [...currentPath, child.slug];
      paths.push(newPath);
      walk(child.id, newPath);
    }
  }

  walk(null, []);
  return paths;
}
