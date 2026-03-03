'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { slugify } from '@/lib/utils/slugify';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

// ============================================================
// Projects
// ============================================================

export async function createProject(formData: FormData) {
  const supabase = createAdminClient();

  const name = formData.get('name') as string;
  const slug = (formData.get('slug') as string) || slugify(name);

  const layerLabelsRaw = formData.get('layer_labels') as string;
  const layerLabels = layerLabelsRaw
    ? layerLabelsRaw.split(',').map((l) => l.trim()).filter(Boolean)
    : [];

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name,
      slug,
      description: formData.get('description') as string || null,
      type: formData.get('type') as string,
      status: (formData.get('status') as string) || 'draft',
      scale: (formData.get('scale') as string) || 'small',
      max_depth: parseInt(formData.get('max_depth') as string) || 2,
      layer_labels: layerLabels,
      // Location
      address: formData.get('address') as string || null,
      city: formData.get('city') as string || null,
      state: formData.get('state') as string || null,
      country: formData.get('country') as string || null,
      google_maps_embed_url: formData.get('google_maps_embed_url') as string || null,
      coordinates: parseCoordinates(formData),
      // Contact
      phone: formData.get('phone') as string || null,
      email: formData.get('email') as string || null,
      whatsapp: formData.get('whatsapp') as string || null,
      website: formData.get('website') as string || null,
      // Feature toggles
      has_video_intro: formData.get('has_video_intro') === 'on',
      has_gallery: formData.get('has_gallery') === 'on',
      has_360_tour: formData.get('has_360_tour') === 'on',
      has_recorrido_360_embed: formData.get('has_recorrido_360_embed') === 'on',
      recorrido_360_embed_url: formData.get('recorrido_360_embed_url') as string || null,
      has_downloads: formData.get('has_downloads') === 'on',
      has_state_management: formData.get('has_state_management') === 'on',
      has_layers_gallery: formData.get('has_layers_gallery') === 'on',
      has_zoom_in: formData.get('has_zoom_in') === 'on',
      // SVG config
      hotspot_tower_id: formData.get('hotspot_tower_id') as string || 'tower',
      hotspot_marker_id: formData.get('hotspot_marker_id') as string || 'marker',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Error creating project: ${error.message}`);

  invalidateProjectCache(slug);
  revalidatePath('/admin');
  redirect(`/admin/projects/${data.id}`);
}

export async function updateProject(id: string, formData: FormData) {
  const supabase = createAdminClient();

  // Invalidate old slug cache before update (slug might change)
  const oldSlug = await getProjectSlugById(id);

  const layerLabelsRaw = formData.get('layer_labels') as string;
  const layerLabels = layerLabelsRaw
    ? layerLabelsRaw.split(',').map((l) => l.trim()).filter(Boolean)
    : [];

  const { error } = await supabase
    .from('projects')
    .update({
      name: formData.get('name') as string,
      slug: formData.get('slug') as string,
      description: formData.get('description') as string || null,
      type: formData.get('type') as string,
      status: formData.get('status') as string,
      scale: formData.get('scale') as string,
      max_depth: parseInt(formData.get('max_depth') as string) || 2,
      layer_labels: layerLabels,
      address: formData.get('address') as string || null,
      city: formData.get('city') as string || null,
      state: formData.get('state') as string || null,
      country: formData.get('country') as string || null,
      google_maps_embed_url: formData.get('google_maps_embed_url') as string || null,
      coordinates: parseCoordinates(formData),
      phone: formData.get('phone') as string || null,
      email: formData.get('email') as string || null,
      whatsapp: formData.get('whatsapp') as string || null,
      website: formData.get('website') as string || null,
      has_video_intro: formData.get('has_video_intro') === 'on',
      has_gallery: formData.get('has_gallery') === 'on',
      has_360_tour: formData.get('has_360_tour') === 'on',
      has_recorrido_360_embed: formData.get('has_recorrido_360_embed') === 'on',
      recorrido_360_embed_url: formData.get('recorrido_360_embed_url') as string || null,
      has_downloads: formData.get('has_downloads') === 'on',
      has_state_management: formData.get('has_state_management') === 'on',
      has_layers_gallery: formData.get('has_layers_gallery') === 'on',
      has_zoom_in: formData.get('has_zoom_in') === 'on',
      hotspot_tower_id: formData.get('hotspot_tower_id') as string || 'tower',
      hotspot_marker_id: formData.get('hotspot_marker_id') as string || 'marker',
    })
    .eq('id', id);

  if (error) throw new Error(`Error updating project: ${error.message}`);

  const newSlug = formData.get('slug') as string;
  if (oldSlug) invalidateProjectCache(oldSlug);
  if (newSlug && newSlug !== oldSlug) invalidateProjectCache(newSlug);
  revalidatePath('/admin');
  revalidatePath(`/admin/projects/${id}`);
  redirect(`/admin/projects/${id}`);
}

export async function deleteProject(id: string) {
  const supabase = createAdminClient();

  // Get project slug to clean up storage
  const { data: project } = await supabase
    .from('projects')
    .select('slug')
    .eq('id', id)
    .single();

  if (project) {
    // Delete all storage files under the project slug
    const { data: files } = await supabase.storage
      .from('project-media')
      .list(project.slug, { limit: 1000 });

    if (files?.length) {
      const paths = files.map((f) => `${project.slug}/${f.name}`);
      await supabase.storage.from('project-media').remove(paths);
    }
  }

  // CASCADE deletes layers, media, scenes, etc.
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw new Error(`Error deleting project: ${error.message}`);

  if (project) invalidateProjectCache(project.slug);
  revalidatePath('/admin');
  redirect('/admin');
}

// ============================================================
// Layers
// ============================================================

export async function createLayer(formData: FormData) {
  const supabase = createAdminClient();

  const projectId = formData.get('project_id') as string;
  const parentId = formData.get('parent_id') as string || null;
  const name = formData.get('name') as string;
  const slug = (formData.get('slug') as string) || slugify(name);

  // Auto sort_order: max + 1
  const { data: siblings } = await supabase
    .from('layers')
    .select('sort_order')
    .eq('project_id', projectId)
    .is('parent_id', parentId ?? null)
    .order('sort_order', { ascending: false })
    .limit(1);

  // If parentId is provided but isn't null string, match with eq instead
  let sortOrder = 0;
  if (parentId) {
    const { data: siblingsWithParent } = await supabase
      .from('layers')
      .select('sort_order')
      .eq('project_id', projectId)
      .eq('parent_id', parentId)
      .order('sort_order', { ascending: false })
      .limit(1);
    sortOrder = siblingsWithParent?.[0] ? siblingsWithParent[0].sort_order + 1 : 0;
  } else {
    sortOrder = siblings?.[0] ? siblings[0].sort_order + 1 : 0;
  }

  // Get parent depth
  let depth = 0;
  if (parentId) {
    const { data: parent } = await supabase
      .from('layers')
      .select('depth')
      .eq('id', parentId)
      .single();
    if (parent) depth = parent.depth + 1;
  }

  const type = formData.get('type') as string;
  const isLot = type === 'lot' || type === 'unit';

  const insertData: Record<string, unknown> = {
    project_id: projectId,
    parent_id: parentId,
    type,
    depth,
    sort_order: sortOrder,
    slug,
    name,
    label: formData.get('label') as string || name,
    svg_element_id: formData.get('svg_element_id') as string || null,
    status: (formData.get('status') as string) || 'available',
  };

  if (isLot) {
    const area = formData.get('area') as string;
    const price = formData.get('price') as string;
    const frontLength = formData.get('front_length') as string;
    const depthLength = formData.get('depth_length') as string;
    const pricePerUnit = formData.get('price_per_unit') as string;

    if (area) insertData.area = parseFloat(area);
    insertData.area_unit = (formData.get('area_unit') as string) || 'm2';
    if (price) insertData.price = parseFloat(price);
    insertData.currency = (formData.get('currency') as string) || 'USD';
    if (frontLength) insertData.front_length = parseFloat(frontLength);
    if (depthLength) insertData.depth_length = parseFloat(depthLength);
    if (pricePerUnit) insertData.price_per_unit = parseFloat(pricePerUnit);
    insertData.is_corner = formData.get('is_corner') === 'on';

    const featuresRaw = formData.get('features') as string;
    if (featuresRaw) {
      try {
        insertData.features = JSON.parse(featuresRaw);
      } catch {
        insertData.features = [];
      }
    }

    // Unit type reference
    const unitTypeId = formData.get('unit_type_id') as string;
    if (unitTypeId) insertData.unit_type_id = unitTypeId;

    // Tour & video
    const tourEmbedUrl = formData.get('tour_embed_url') as string;
    insertData.tour_embed_url = tourEmbedUrl || null;
    const videoUrlVal = formData.get('video_url') as string;
    insertData.video_url = videoUrlVal || null;

    // Building-specific properties JSONB
    const properties: Record<string, unknown> = {};
    const orientation = formData.get('orientation') as string;
    if (orientation) properties.orientation = orientation;
    const bedrooms = formData.get('bedrooms') as string;
    if (bedrooms) properties.bedrooms = parseInt(bedrooms);
    const bathrooms = formData.get('bathrooms') as string;
    if (bathrooms) properties.bathrooms = parseInt(bathrooms);
    const hasBalcony = formData.get('has_balcony');
    properties.has_balcony = hasBalcony === 'on';
    const floorNumber = formData.get('floor_number') as string;
    if (floorNumber) properties.floor_number = parseInt(floorNumber);
    const description = formData.get('description') as string;
    if (description) properties.description = description;

    if (Object.keys(properties).length > 0) {
      insertData.properties = properties;
    }
  }

  const { error } = await supabase.from('layers').insert(insertData);
  if (error) throw new Error(`Error creating layer: ${error.message}`);

  const projectSlug = await getProjectSlugById(projectId);
  if (projectSlug) invalidateProjectCache(projectSlug);
  revalidatePath(`/admin/projects/${projectId}/layers`);
}

export async function updateLayer(id: string, formData: FormData) {
  const supabase = createAdminClient();

  const projectId = formData.get('project_id') as string;
  const name = formData.get('name') as string;
  const type = formData.get('type') as string;
  const isLot = type === 'lot' || type === 'unit';

  const updateData: Record<string, unknown> = {
    name,
    slug: (formData.get('slug') as string) || slugify(name),
    label: formData.get('label') as string || name,
    type,
    svg_element_id: formData.get('svg_element_id') as string || null,
    status: (formData.get('status') as string) || 'available',
  };

  if (isLot) {
    const area = formData.get('area') as string;
    const price = formData.get('price') as string;
    const frontLength = formData.get('front_length') as string;
    const depthLength = formData.get('depth_length') as string;
    const pricePerUnit = formData.get('price_per_unit') as string;

    updateData.area = area ? parseFloat(area) : null;
    updateData.area_unit = (formData.get('area_unit') as string) || 'm2';
    updateData.price = price ? parseFloat(price) : null;
    updateData.currency = (formData.get('currency') as string) || 'USD';
    updateData.front_length = frontLength ? parseFloat(frontLength) : null;
    updateData.depth_length = depthLength ? parseFloat(depthLength) : null;
    updateData.price_per_unit = pricePerUnit ? parseFloat(pricePerUnit) : null;
    updateData.is_corner = formData.get('is_corner') === 'on';

    const featuresRaw = formData.get('features') as string;
    if (featuresRaw) {
      try {
        updateData.features = JSON.parse(featuresRaw);
      } catch {
        updateData.features = [];
      }
    }

    // Unit type reference
    const unitTypeId = formData.get('unit_type_id') as string;
    updateData.unit_type_id = unitTypeId || null;

    // Tour & video
    const tourEmbedUrl = formData.get('tour_embed_url') as string;
    updateData.tour_embed_url = tourEmbedUrl || null;
    const videoUrlVal = formData.get('video_url') as string;
    updateData.video_url = videoUrlVal || null;

    // Building-specific properties JSONB
    const properties: Record<string, unknown> = {};
    const orientation = formData.get('orientation') as string;
    if (orientation) properties.orientation = orientation;
    const bedrooms = formData.get('bedrooms') as string;
    if (bedrooms) properties.bedrooms = parseInt(bedrooms);
    const bathrooms = formData.get('bathrooms') as string;
    if (bathrooms) properties.bathrooms = parseInt(bathrooms);
    const hasBalcony = formData.get('has_balcony');
    properties.has_balcony = hasBalcony === 'on';
    const floorNumber = formData.get('floor_number') as string;
    if (floorNumber) properties.floor_number = parseInt(floorNumber);
    const description = formData.get('description') as string;
    if (description) properties.description = description;

    updateData.properties = Object.keys(properties).length > 0 ? properties : {};

    // Buyer info
    const buyerName = formData.get('buyer_name') as string;
    if (buyerName !== null) {
      updateData.buyer_name = buyerName || null;
      updateData.buyer_email = (formData.get('buyer_email') as string) || null;
      updateData.buyer_phone = (formData.get('buyer_phone') as string) || null;
      updateData.buyer_notes = (formData.get('buyer_notes') as string) || null;
    }
  }

  const { error } = await supabase.from('layers').update(updateData).eq('id', id);
  if (error) throw new Error(`Error updating layer: ${error.message}`);

  const projectSlug = await getProjectSlugById(projectId);
  if (projectSlug) invalidateProjectCache(projectSlug);
  revalidatePath(`/admin/projects/${projectId}/layers`);
}

export async function deleteLayer(id: string, projectId: string) {
  const supabase = createAdminClient();

  // CASCADE will delete children and their media rows
  const { error } = await supabase.from('layers').delete().eq('id', id);
  if (error) throw new Error(`Error deleting layer: ${error.message}`);

  const projectSlug = await getProjectSlugById(projectId);
  if (projectSlug) invalidateProjectCache(projectSlug);
  revalidatePath(`/admin/projects/${projectId}/layers`);
}

export async function reorderLayers(layerIds: string[], projectId: string) {
  const supabase = createAdminClient();

  const updates = layerIds.map((id, index) =>
    supabase.from('layers').update({ sort_order: index }).eq('id', id)
  );

  const results = await Promise.all(updates);
  const err = results.find((r) => r.error);
  if (err?.error) throw new Error(`Error reordering: ${err.error.message}`);

  const projectSlug = await getProjectSlugById(projectId);
  if (projectSlug) invalidateProjectCache(projectSlug);
  revalidatePath(`/admin/projects/${projectId}/layers`);
}

export async function importLotsFromCsv(formData: FormData) {
  const supabase = createAdminClient();

  const projectId = formData.get('project_id') as string;
  const parentId = formData.get('parent_id') as string;
  const csvFile = formData.get('csv_file') as File;

  if (!csvFile) throw new Error('No CSV file provided');

  // Fetch current project to validate CSV and know its type/slug
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, slug, type')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    throw new Error('Proyecto no encontrado para el importador CSV');
  }

  const text = await csvFile.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('El CSV debe tener encabezado y al menos 1 fila');

  // Header exactamente como el template de "CSV Carga unidades"
  const headerValues = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const headers = headerValues.map((h) => h.replace(/\s+/g, '_'));

  // Campos esperados mínimos (permitimos extras pero estos deben existir)
  const requiredHeaders = [
    'project_name',
    'zone_id',
    'level_id',
    'unit_name',
    'unit_label',
    'svg_element_id',
    'asset_type',
    'unit_type',
    'status',
    'area_m2',
    'frente_m',
    'fondo_m',
    'price',
    'currency',
    'amb',
    'bathrooms',
    'orientation',
    'corner_unit',
    'features',
    'description',
    'tour_360_url',
    'video_url',
  ];

  for (const key of requiredHeaders) {
    if (!headers.includes(key)) {
      throw new Error(`Falta la columna "${key}" en el encabezado del CSV`);
    }
  }

  // Cache de layers creados para no repetir consultas
  type CachedLayer = { id: string; depth: number };
  const towerOrZoneCache = new Map<string, CachedLayer>();
  const floorCache = new Map<string, CachedLayer>();
  const unitTypeCache = new Map<string, string>(); // name → id

  // Sort order base por padre inicial
  const { data: existingSiblings } = await supabase
    .from('layers')
    .select('sort_order')
    .eq('project_id', projectId)
    .eq('parent_id', parentId || null)
    .order('sort_order', { ascending: false })
    .limit(1);

  let globalSortOrder = existingSiblings?.[0] ? existingSiblings[0].sort_order + 1 : 0;

  const rowsToInsert: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? '';
    });

    // Segunda fila del ejemplo original son descripciones: la saltamos
    if (i === 1 && row.project_name?.toLowerCase() === 'nombre del proyecto') {
      continue;
    }

    // Validar que la fila pertenece a este proyecto (si viene project_name)
    const projectNameCell = (row.project_name || '').trim();
    if (projectNameCell && projectNameCell !== project.slug) {
      throw new Error(
        `La fila ${i + 1} del CSV pertenece al proyecto "${projectNameCell}" y no a "${project.slug}"`
      );
    }

    const zoneId = (row.zone_id || '').trim();
    const levelId = (row.level_id || '').trim();
    const assetType = (row.asset_type || '').toLowerCase();

    const isLot = assetType.includes('lote');

    // ============================================================
    // 1) Resolver/crear padres (zona/torre, piso, etc.)
    // ============================================================
    let parentLayerId: string | null = parentId || null;
    let parentDepth = -1;

    if (parentLayerId) {
      const { data: parentLayer } = await supabase
        .from('layers')
        .select('id, depth')
        .eq('id', parentLayerId)
        .single();
      if (parentLayer) {
        parentDepth = parentLayer.depth;
      }
    }

    // Si hay zone_id, lo usamos como primer padre bajo el parentId (o raíz si parentId es null)
    if (zoneId) {
      const cacheKey = `${projectId}|${parentLayerId || 'root'}|${zoneId}`;
      let cached = towerOrZoneCache.get(cacheKey);

      if (!cached) {
        const zoneSlug = slugify(zoneId);
        const { data: existing } = await supabase
          .from('layers')
          .select('id, depth')
          .eq('project_id', projectId)
          .eq('parent_id', parentLayerId || null)
          .eq('slug', zoneSlug)
          .limit(1)
          .maybeSingle();

        if (existing) {
          cached = { id: existing.id, depth: existing.depth };
        } else {
          const insert = {
            project_id: projectId,
            parent_id: parentLayerId,
            type: project.type === 'lots' ? 'block' : 'tower',
            depth: parentDepth + 1,
            sort_order: globalSortOrder++,
            slug: zoneSlug,
            name: zoneId,
            label: zoneId,
            status: 'available' as const,
          };
          const { data: inserted, error: insertError } = await supabase
            .from('layers')
            .insert(insert)
            .select('id, depth')
            .single();
          if (insertError || !inserted) {
            throw new Error(`Error creando layer padre para zone_id "${zoneId}" en fila ${i + 1}`);
          }
          cached = { id: inserted.id, depth: inserted.depth };
        }

        towerOrZoneCache.set(cacheKey, cached);
      }

      parentLayerId = cached.id;
      parentDepth = cached.depth;
    }

    // Si hay level_id, creamos/obtenemos un piso debajo del padre actual
    if (levelId) {
      const cacheKey = `${projectId}|${parentLayerId || 'root'}|${levelId}`;
      let cached = floorCache.get(cacheKey);

      if (!cached) {
        const levelSlug = slugify(levelId);
        const { data: existing } = await supabase
          .from('layers')
          .select('id, depth')
          .eq('project_id', projectId)
          .eq('parent_id', parentLayerId || null)
          .eq('slug', levelSlug)
          .limit(1)
          .maybeSingle();

        if (existing) {
          cached = { id: existing.id, depth: existing.depth };
        } else {
          const levelName = project.type === 'building' ? `Piso ${levelId}` : levelId;
          const insert = {
            project_id: projectId,
            parent_id: parentLayerId,
            type: project.type === 'building' ? 'floor' : 'zone',
            depth: parentDepth + 1,
            sort_order: globalSortOrder++,
            slug: levelSlug,
            name: levelName,
            label: levelName,
            status: 'available' as const,
          };
          const { data: inserted, error: insertError } = await supabase
            .from('layers')
            .insert(insert)
            .select('id, depth')
            .single();
          if (insertError || !inserted) {
            throw new Error(`Error creando layer padre para level_id "${levelId}" en fila ${i + 1}`);
          }
          cached = { id: inserted.id, depth: inserted.depth };
        }

        floorCache.set(cacheKey, cached);
      }

      parentLayerId = cached.id;
      parentDepth = cached.depth;
    }

    // ============================================================
    // 2) Resolver unit_type_id desde tabla unit_types
    // ============================================================
    let unitTypeId: string | null = null;
    const unitTypeName = (row.unit_type || '').trim();
    if (unitTypeName) {
      const cachedId = unitTypeCache.get(unitTypeName.toLowerCase());
      if (cachedId) {
        unitTypeId = cachedId;
      } else {
        const { data: existing } = await supabase
          .from('unit_types')
          .select('id')
          .eq('project_id', projectId)
          .ilike('name', unitTypeName)
          .limit(1)
          .maybeSingle();

        if (existing) {
          unitTypeId = existing.id;
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from('unit_types')
            .insert({
              project_id: projectId,
              name: unitTypeName,
              slug: slugify(unitTypeName),
            })
            .select('id')
            .single();
          if (insertError || !inserted) {
            throw new Error(`Error creando unit_type "${unitTypeName}" en fila ${i + 1}`);
          }
          unitTypeId = inserted.id;
        }
        unitTypeCache.set(unitTypeName.toLowerCase(), unitTypeId!);
      }
    }

    // ============================================================
    // 3) Crear la unidad/lote final
    // ============================================================
    const name = row.unit_name || `Unidad ${i}`;
    const label = row.unit_label || name;
    const statusRaw = (row.status || '').toLowerCase();
    const statusMap: Record<string, 'available' | 'reserved' | 'sold' | 'not_available'> = {
      disponible: 'available',
      reservado: 'reserved',
      vendido: 'sold',
      'no disponible': 'not_available',
      'not_available': 'not_available',
    };
    const status = statusMap[statusRaw] || 'available';

    const featuresText = row.features || '';
    let features: unknown[] = [];
    if (featuresText) {
      features = featuresText
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
        .map((label) => ({ label }));
    }

    const isCorner = (row.corner_unit || '').toLowerCase() === 'true';

    // Properties JSONB para info adicional
    const properties: Record<string, unknown> = {};
    if (row.amb) {
      const ambNum = parseInt(row.amb, 10);
      if (!Number.isNaN(ambNum)) properties.bedrooms = ambNum;
    }
    if (row.bathrooms) {
      const bathsNum = parseInt(row.bathrooms, 10);
      if (!Number.isNaN(bathsNum)) properties.bathrooms = bathsNum;
    }
    if (row.orientation) properties.orientation = row.orientation;
    if (row.description) properties.description = row.description;
    if (row.unit_type) properties.unit_type = row.unit_type;

    const areaVal = row.area_m2 ? parseFloat(row.area_m2) : null;
    const frontVal = row.frente_m ? parseFloat(row.frente_m) : null;
    const depthVal = row.fondo_m ? parseFloat(row.fondo_m) : null;
    const priceVal = row.price ? parseFloat(row.price) : null;

    rowsToInsert.push({
      project_id: projectId,
      parent_id: parentLayerId,
      type: isLot ? 'lot' : 'unit',
      depth: parentDepth + 1,
      sort_order: globalSortOrder++,
      slug: slugify(label),
      name,
      label,
      svg_element_id: row.svg_element_id || null,
      status,
      area: areaVal,
      area_unit: 'm2',
      front_length: frontVal,
      depth_length: depthVal,
      price: priceVal,
      currency: ((row.currency as string) || 'USD') as 'USD' | 'ARS' | 'MXN',
      is_corner: isCorner,
      features,
      properties,
      unit_type_id: unitTypeId,
      tour_embed_url: row.tour_360_url || null,
      video_url: row.video_url || null,
    });
  }

  if (!rowsToInsert.length) throw new Error('No se encontraron filas válidas en el CSV');

  const { error } = await supabase.from('layers').insert(rowsToInsert);
  if (error) throw new Error(`Error importing lots/units: ${error.message}`);

  const projectSlug = await getProjectSlugById(projectId);
  if (projectSlug) invalidateProjectCache(projectSlug);
  revalidatePath(`/admin/projects/${projectId}/layers`);
  return { count: rowsToInsert.length };
}

// ============================================================
// Unit Types
// ============================================================

export async function createUnitType(formData: FormData) {
  const supabase = createAdminClient();

  const projectId = formData.get('project_id') as string;
  const name = formData.get('name') as string;

  const { error } = await supabase.from('unit_types').insert({
    project_id: projectId,
    name,
    slug: (formData.get('slug') as string) || slugify(name),
    area: formData.get('area') ? parseFloat(formData.get('area') as string) : null,
    area_unit: (formData.get('area_unit') as string) || 'm2',
    bedrooms: formData.get('bedrooms') ? parseInt(formData.get('bedrooms') as string) : null,
    bathrooms: formData.get('bathrooms') ? parseInt(formData.get('bathrooms') as string) : null,
    description: (formData.get('description') as string) || null,
  });

  if (error) throw new Error(`Error creating unit type: ${error.message}`);

  const projectSlug = await getProjectSlugById(projectId);
  if (projectSlug) invalidateProjectCache(projectSlug);
  revalidatePath(`/admin/projects/${projectId}/unit-types`);
}

export async function updateUnitType(id: string, formData: FormData) {
  const supabase = createAdminClient();

  const projectId = formData.get('project_id') as string;
  const name = formData.get('name') as string;

  const { error } = await supabase
    .from('unit_types')
    .update({
      name,
      slug: (formData.get('slug') as string) || slugify(name),
      area: formData.get('area') ? parseFloat(formData.get('area') as string) : null,
      area_unit: (formData.get('area_unit') as string) || 'm2',
      bedrooms: formData.get('bedrooms') ? parseInt(formData.get('bedrooms') as string) : null,
      bathrooms: formData.get('bathrooms') ? parseInt(formData.get('bathrooms') as string) : null,
      description: (formData.get('description') as string) || null,
    })
    .eq('id', id);

  if (error) throw new Error(`Error updating unit type: ${error.message}`);

  const projectSlug = await getProjectSlugById(projectId);
  if (projectSlug) invalidateProjectCache(projectSlug);
  revalidatePath(`/admin/projects/${projectId}/unit-types`);
}

export async function deleteUnitType(id: string, projectId: string) {
  const supabase = createAdminClient();

  // Delete associated media (storage + rows)
  const { data: mediaRows } = await supabase
    .from('media')
    .select('id, storage_path')
    .eq('unit_type_id', id);

  if (mediaRows?.length) {
    const storagePaths = mediaRows
      .map((m) => m.storage_path)
      .filter(Boolean) as string[];
    if (storagePaths.length) {
      await supabase.storage.from('project-media').remove(storagePaths);
    }
    await supabase
      .from('media')
      .delete()
      .in('id', mediaRows.map((m) => m.id));
  }

  // Delete the unit type (layers referencing it get unit_type_id = NULL via SET NULL)
  const { error } = await supabase.from('unit_types').delete().eq('id', id);
  if (error) throw new Error(`Error deleting unit type: ${error.message}`);

  const projectSlug = await getProjectSlugById(projectId);
  if (projectSlug) invalidateProjectCache(projectSlug);
  revalidatePath(`/admin/projects/${projectId}/unit-types`);
  revalidatePath(`/admin/projects/${projectId}/layers`);
}

// ============================================================
// Media
// ============================================================

export async function uploadMedia(formData: FormData) {
  const supabase = createAdminClient();

  const file = formData.get('file') as File;
  if (!file) throw new Error('No file provided');

  const projectId = formData.get('project_id') as string;
  const layerId = formData.get('layer_id') as string || null;
  const unitTypeId = formData.get('unit_type_id') as string || null;
  const purpose = formData.get('purpose') as string;
  const type = formData.get('type') as string;
  const storagePath = formData.get('storage_path') as string;
  const metadataRaw = formData.get('metadata') as string;
  const layerField = formData.get('layer_field') as string || null;

  let metadata = {};
  if (metadataRaw) {
    try {
      metadata = JSON.parse(metadataRaw);
    } catch {
      /* ignore */
    }
  }

  // Upload to storage
  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from('project-media')
    .upload(storagePath, buffer, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('project-media')
    .getPublicUrl(storagePath);
  const url = urlData.publicUrl;

  // Delete existing media with same purpose+owner (replace pattern)
  if (layerId) {
    await supabase
      .from('media')
      .delete()
      .eq('project_id', projectId)
      .eq('layer_id', layerId)
      .eq('purpose', purpose);
  } else if (unitTypeId) {
    await supabase
      .from('media')
      .delete()
      .eq('project_id', projectId)
      .eq('unit_type_id', unitTypeId)
      .eq('purpose', purpose);
  } else {
    // Project-level media: match on null layer_id and null unit_type_id
    await supabase
      .from('media')
      .delete()
      .eq('project_id', projectId)
      .is('layer_id', null)
      .is('unit_type_id', null)
      .eq('purpose', purpose);
  }

  // Insert new media row
  const { error: insertError } = await supabase.from('media').insert({
    project_id: projectId,
    layer_id: layerId,
    unit_type_id: unitTypeId,
    type,
    purpose,
    storage_path: storagePath,
    url,
    metadata,
    sort_order: 0,
  });

  if (insertError) throw new Error(`Media insert error: ${insertError.message}`);

  // Update layer field if specified
  if (layerField && layerId) {
    await supabase
      .from('layers')
      .update({ [layerField]: url })
      .eq('id', layerId);
  }

  // Update project fields for logos
  if (purpose === 'logo') {
    await supabase.from('projects').update({ logo_url: url }).eq('id', projectId);
  } else if (purpose === 'logo_developer') {
    await supabase.from('projects').update({ secondary_logo_url: url }).eq('id', projectId);
  }

  const projectSlug = await getProjectSlugById(projectId);
  if (projectSlug) invalidateProjectCache(projectSlug);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}/layers`);
  revalidatePath(`/admin/projects/${projectId}/media`);
  revalidatePath(`/admin/projects/${projectId}/unit-types`);
  revalidatePath(`/admin/projects/${projectId}/tour`);

  return { url };
}

export async function uploadTourMedia(formData: FormData) {
  const supabase = createAdminClient();

  const file = formData.get('file') as File;
  if (!file) throw new Error('No file provided');

  const projectId = formData.get('project_id') as string;
  const layerId = formData.get('layer_id') as string;
  const purpose = formData.get('purpose') as string;
  const type = formData.get('type') as string;
  const storagePath = formData.get('storage_path') as string;
  const metadataRaw = formData.get('metadata') as string;

  let metadata = {};
  if (metadataRaw) {
    try {
      metadata = JSON.parse(metadataRaw);
    } catch {
      /* ignore */
    }
  }

  // Upload to storage
  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from('project-media')
    .upload(storagePath, buffer, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

  const { data: urlData } = supabase.storage
    .from('project-media')
    .getPublicUrl(storagePath);
  const url = urlData.publicUrl;

  // For tour media, we match on purpose+metadata (viewpoint) to replace
  // Delete existing with same purpose+viewpoint
  if (purpose === 'transition') {
    const fromVp = (metadata as Record<string, string>).from_viewpoint;
    const toVp = (metadata as Record<string, string>).to_viewpoint;
    // Delete matching transition
    const { data: existing } = await supabase
      .from('media')
      .select('id, metadata')
      .eq('layer_id', layerId)
      .eq('purpose', 'transition');

    if (existing) {
      const toDelete = existing.filter((m) => {
        const md = m.metadata as Record<string, string>;
        return md.from_viewpoint === fromVp && md.to_viewpoint === toVp;
      });
      if (toDelete.length) {
        await supabase
          .from('media')
          .delete()
          .in('id', toDelete.map((m) => m.id));
      }
    }
  } else {
    // gallery or hotspot — match by purpose+viewpoint
    const viewpoint = (metadata as Record<string, string>).viewpoint;
    const { data: existing } = await supabase
      .from('media')
      .select('id, metadata')
      .eq('layer_id', layerId)
      .eq('purpose', purpose);

    if (existing) {
      const toDelete = existing.filter((m) => {
        const md = m.metadata as Record<string, string>;
        return md.viewpoint === viewpoint;
      });
      if (toDelete.length) {
        await supabase
          .from('media')
          .delete()
          .in('id', toDelete.map((m) => m.id));
      }
    }
  }

  // Insert media row
  const { error: insertError } = await supabase.from('media').insert({
    project_id: projectId,
    layer_id: layerId,
    type,
    purpose,
    storage_path: storagePath,
    url,
    metadata,
    sort_order: 0,
  });

  if (insertError) throw new Error(`Media insert error: ${insertError.message}`);

  const projectSlug = await getProjectSlugById(projectId);
  if (projectSlug) invalidateProjectCache(projectSlug);
  revalidatePath(`/admin/projects/${projectId}/tour`);
  return { url };
}

export async function deleteMedia(id: string, projectId: string) {
  const supabase = createAdminClient();

  // Get media info to delete storage file
  const { data: media } = await supabase
    .from('media')
    .select('storage_path, purpose, layer_id')
    .eq('id', id)
    .single();

  if (media?.storage_path) {
    await supabase.storage.from('project-media').remove([media.storage_path]);
  }

  // Null out layer field references
  if (media?.layer_id) {
    const fieldMap: Record<string, string> = {
      background: 'background_image_url',
      background_mobile: 'background_image_mobile_url',
      overlay: 'svg_overlay_url',
      overlay_mobile: 'svg_overlay_mobile_url',
    };
    const field = fieldMap[media.purpose];
    if (field) {
      await supabase
        .from('layers')
        .update({ [field]: null })
        .eq('id', media.layer_id);
    }
  }

  // Null out project-level references
  if (media?.purpose === 'logo') {
    await supabase.from('projects').update({ logo_url: null }).eq('id', projectId);
  } else if (media?.purpose === 'logo_developer') {
    await supabase.from('projects').update({ secondary_logo_url: null }).eq('id', projectId);
  }

  const { error } = await supabase.from('media').delete().eq('id', id);
  if (error) throw new Error(`Error deleting media: ${error.message}`);

  const projectSlug = await getProjectSlugById(projectId);
  if (projectSlug) invalidateProjectCache(projectSlug);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}/layers`);
  revalidatePath(`/admin/projects/${projectId}/media`);
  revalidatePath(`/admin/projects/${projectId}/tour`);
}

export async function updateLotStatus(
  id: string,
  projectId: string,
  status: string,
  buyerInfo?: { buyer_name?: string; buyer_email?: string; buyer_phone?: string; buyer_notes?: string }
) {
  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = { status };

  if (status === 'reserved') {
    updateData.reserved_at = new Date().toISOString();
  } else if (status === 'sold') {
    updateData.sold_at = new Date().toISOString();
  }

  if (buyerInfo) {
    Object.assign(updateData, buyerInfo);
  }

  const { error } = await supabase.from('layers').update(updateData).eq('id', id);
  if (error) throw new Error(`Error updating lot status: ${error.message}`);

  const projectSlug = await getProjectSlugById(projectId);
  if (projectSlug) invalidateProjectCache(projectSlug);
  revalidatePath(`/admin/projects/${projectId}/layers`);
}

// ============================================================
// Helpers
// ============================================================

async function getProjectSlugById(projectId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('projects')
    .select('slug')
    .eq('id', projectId)
    .single();
  return data?.slug ?? null;
}

function invalidateProjectCache(slug: string) {
  revalidateTag(`project-data:${slug}`, { expire: 0 });
}

function parseCoordinates(formData: FormData) {
  const lat = formData.get('lat') as string;
  const lng = formData.get('lng') as string;
  if (lat && lng) {
    return { lat: parseFloat(lat), lng: parseFloat(lng) };
  }
  return null;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
