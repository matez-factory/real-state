import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

/**
 * Seed the database with the Aurora building project.
 * Single tower, 24 floors (3 basements + 21 residential), 6 units per floor = 126 units.
 *
 * Usage: npx tsx scripts/supabase/seed-aurora.ts
 */

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type Status = 'available' | 'reserved' | 'sold' | 'not_available';

// ============================================================
// Floor definitions
// ============================================================

interface FloorDef {
  name: string;
  slug: string;
  label: string;
  svgElementId: string;
  sortOrder: number;
  svgOverlayUrl: string | null; // null = basement (leaf, no children)
}

// SVG cyclic reuse for residential floors
function getFloorSvgPath(floorNum: number): string {
  const cycle: Record<number, string> = {
    0: '/svgs/aurora/niveles/nivel-06.svg',
    1: '/svgs/aurora/niveles/nivel-07.svg',
    2: '/svgs/aurora/niveles/nivel-08.svg',
    3: '/svgs/aurora/niveles/nivel-09.svg',
  };
  return cycle[(floorNum - 6) % 4];
}

const floors: FloorDef[] = [
  // Basements (leaf layers — no children, no SVG)
  { name: 'Subsuelo 3', slug: 'nivel-as3', label: 'AS3', svgElementId: 'nivel-as3', sortOrder: 0, svgOverlayUrl: null },
  { name: 'Subsuelo 2', slug: 'nivel-as2', label: 'AS2', svgElementId: 'nivel-as2', sortOrder: 1, svgOverlayUrl: null },
  { name: 'Subsuelo 1', slug: 'nivel-as1', label: 'AS1', svgElementId: 'nivel-as1', sortOrder: 2, svgOverlayUrl: null },
  // Residential floors 6-26
  ...Array.from({ length: 21 }, (_, i) => {
    const n = i + 6;
    return {
      name: `Nivel ${n}`,
      slug: `nivel-${n}`,
      label: `N${n}`,
      svgElementId: `nivel-${n}`,
      sortOrder: i + 3,
      svgOverlayUrl: getFloorSvgPath(n),
    };
  }),
];

// ============================================================
// Unit definitions
// ============================================================

interface UnitTypeDef {
  area: number;
  bedrooms: number;
  bathrooms: number;
  name: string;
  slug: string;
}

const UNIT_TYPE_DEFS: Record<string, UnitTypeDef> = {
  a: { area: 80, bedrooms: 2, bathrooms: 1, name: '2 Ambientes', slug: '2amb-80' },
  b: { area: 106, bedrooms: 3, bathrooms: 2, name: '3 Ambientes 106m²', slug: '3amb-106' },
  c: { area: 120, bedrooms: 3, bathrooms: 2, name: '3 Ambientes 120m²', slug: '3amb-120' },
  d: { area: 80, bedrooms: 2, bathrooms: 1, name: '2 Ambientes', slug: '2amb-80' },
  e: { area: 106, bedrooms: 3, bathrooms: 2, name: '3 Ambientes 106m²', slug: '3amb-106' },
  f: { area: 80, bedrooms: 2, bathrooms: 1, name: '2 Ambientes', slug: '2amb-80' },
};

const UNIT_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];

const ORIENTATIONS: Record<string, string> = {
  a: 'Noroeste',
  b: 'Norte',
  c: 'Noreste',
  d: 'Suroeste',
  e: 'Sur',
  f: 'Sureste',
};

function getUnitStatus(floorNum: number, unitIdx: number): Status {
  const hash = floorNum * 10 + unitIdx;
  if (hash % 7 === 0) return 'sold';
  if (hash % 5 === 0) return 'reserved';
  if (hash % 11 === 0) return 'not_available';
  return 'available';
}

function getUnitFeatures(area: number): { icon: string; text: string }[] {
  const baseFeatures = [
    { icon: 'wind', text: 'Aire acondicionado' },
    { icon: 'thermometer', text: 'Calefacción central' },
    { icon: 'lock', text: 'Portero eléctrico' },
    { icon: 'car', text: 'Cochera' },
  ];
  const premiumFeatures = [
    { icon: 'sofa', text: 'Piso de porcelanato' },
    { icon: 'cooking-pot', text: 'Cocina equipada' },
    { icon: 'sofa', text: 'Vestidor' },
    { icon: 'shower-head', text: 'Toilette' },
  ];
  return area >= 106
    ? [...baseFeatures, ...premiumFeatures]
    : [...baseFeatures, premiumFeatures[0]];
}

// ============================================================
// Main seed
// ============================================================

async function seed() {
  console.log('Starting Aurora seed...\n');

  // Clear existing Aurora data (preserve other projects)
  console.log('Clearing existing Aurora data...');
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', 'aurora')
    .single();

  if (existing) {
    await supabase.from('media').delete().eq('project_id', existing.id);
    await supabase.from('layers').delete().eq('project_id', existing.id);
    await supabase.from('unit_types').delete().eq('project_id', existing.id);
    await supabase.from('projects').delete().eq('id', existing.id);
  }
  console.log('  Done\n');

  // Create project
  console.log('Creating Aurora project...');
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      slug: 'aurora',
      name: 'Aurora',
      description: 'Edificio residencial de 24 pisos con departamentos de 2 y 3 ambientes. Vista panorámica y amenities premium.',
      type: 'building',
      status: 'active',
      scale: 'medium',
      layer_labels: ['Nivel', 'Departamento'],
      max_depth: 2,
      city: 'Buenos Aires',
      state: 'CABA',
      country: 'Argentina',
      // Feature toggles
      has_video_intro: true,
      has_gallery: true,
      has_360_tour: true,
      has_recorrido_360_embed: false,
      has_downloads: false,
      has_state_management: true,
      has_layers_gallery: false,
      has_zoom_in: false,
    })
    .select()
    .single();

  if (projectError) throw projectError;
  console.log(`  Created: ${project.name}\n`);

  // Create unit_types (3 unique types)
  console.log('Creating unit types...');
  const uniqueTypes = [
    { project_id: project.id, name: '2 Ambientes', slug: '2amb-80', area: 80, area_unit: 'm2', bedrooms: 2, bathrooms: 1 },
    { project_id: project.id, name: '3 Ambientes 106m²', slug: '3amb-106', area: 106, area_unit: 'm2', bedrooms: 3, bathrooms: 2 },
    { project_id: project.id, name: '3 Ambientes 120m²', slug: '3amb-120', area: 120, area_unit: 'm2', bedrooms: 3, bathrooms: 2 },
  ];

  const { data: unitTypes, error: unitTypesError } = await supabase
    .from('unit_types')
    .insert(uniqueTypes)
    .select();

  if (unitTypesError) throw unitTypesError;

  // Build slug → id map
  const unitTypeMap: Record<string, string> = {};
  for (const ut of unitTypes) {
    unitTypeMap[ut.slug] = ut.id;
  }
  console.log(`  Created ${unitTypes.length} unit types\n`);

  let totalLayers = 0;

  for (const floor of floors) {
    const isBasement = floor.svgOverlayUrl === null;

    // Floor layer (depth 0)
    const { data: floorLayer, error: floorError } = await supabase
      .from('layers')
      .insert({
        project_id: project.id,
        parent_id: null,
        type: 'floor',
        depth: 0,
        sort_order: floor.sortOrder,
        slug: floor.slug,
        name: floor.name,
        label: floor.label,
        svg_element_id: floor.svgElementId,
        status: isBasement ? 'not_available' : 'available',
        svg_overlay_url: floor.svgOverlayUrl,
        properties: isBasement
          ? { description: `${floor.name} — Estacionamiento y servicios` }
          : {},
      })
      .select()
      .single();

    if (floorError) throw floorError;
    totalLayers++;

    if (isBasement) {
      console.log(`  Basement: ${floor.slug}`);
      continue;
    }

    // Unit layers (depth 1) — 6 per residential floor
    const floorNum = parseInt(floor.slug.replace('nivel-', ''), 10);

    const unitsToInsert = UNIT_LETTERS.map((letter, idx) => {
      const typeDef = UNIT_TYPE_DEFS[letter];
      const status = getUnitStatus(floorNum, idx);
      const basePricePerSqm = 2200 + (floorNum - 6) * 80;
      const price = status === 'sold' ? null : typeDef.area * basePricePerSqm;
      const hasBalcony = letter === 'a' || letter === 'b' || letter === 'c';

      return {
        project_id: project.id,
        parent_id: floorLayer.id,
        type: 'unit',
        depth: 1,
        sort_order: idx,
        slug: `nivel-${floorNum}-depto-${letter}`,
        name: `Depto ${letter.toUpperCase()}`,
        label: letter.toUpperCase(),
        svg_element_id: letter,
        status,
        svg_overlay_url: null,
        // Typed columns
        area: typeDef.area,
        area_unit: 'm2',
        price,
        currency: 'USD',
        is_corner: false,
        features: getUnitFeatures(typeDef.area),
        unit_type_id: unitTypeMap[typeDef.slug],
        // Fields without typed columns go in properties
        properties: {
          orientation: ORIENTATIONS[letter],
          floor_number: floorNum,
          has_balcony: hasBalcony,
          bedrooms: typeDef.bedrooms,
          bathrooms: typeDef.bathrooms,
          unit_type: typeDef.name,
          description: `Departamento ${typeDef.name.toLowerCase()} de ${typeDef.area}m² en nivel ${floorNum}. ${hasBalcony ? 'Con balcón.' : ''} Orientación ${ORIENTATIONS[letter].toLowerCase()}.`,
        },
      };
    });

    const { error: unitsError } = await supabase.from('layers').insert(unitsToInsert);
    if (unitsError) throw unitsError;
    totalLayers += unitsToInsert.length;

    console.log(`  Floor: ${floor.slug} (${unitsToInsert.length} units)`);
  }

  const basementCount = floors.filter((f) => f.svgOverlayUrl === null).length;
  const residentialCount = floors.length - basementCount;

  console.log(`\nSeed complete!`);
  console.log(`  Project: ${project.name}`);
  console.log(`  Unit types: ${unitTypes.length}`);
  console.log(`  Total layers: ${totalLayers}`);
  console.log(`    Basements: ${basementCount}`);
  console.log(`    Residential floors: ${residentialCount}`);
  console.log(`    Units: ${residentialCount * UNIT_LETTERS.length}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
