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
  svgPath: string | null; // null = basement (leaf, no children)
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
  { name: 'Subsuelo 3', slug: 'nivel-as3', label: 'AS3', svgElementId: 'nivel-as3', sortOrder: 0, svgPath: null },
  { name: 'Subsuelo 2', slug: 'nivel-as2', label: 'AS2', svgElementId: 'nivel-as2', sortOrder: 1, svgPath: null },
  { name: 'Subsuelo 1', slug: 'nivel-as1', label: 'AS1', svgElementId: 'nivel-as1', sortOrder: 2, svgPath: null },
  // Residential floors 6-26
  ...Array.from({ length: 21 }, (_, i) => {
    const n = i + 6;
    return {
      name: `Nivel ${n}`,
      slug: `nivel-${n}`,
      label: `N${n}`,
      svgElementId: `nivel-${n}`,
      sortOrder: i + 3,
      svgPath: getFloorSvgPath(n),
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
  unitType: string;
}

const UNIT_TYPES: Record<string, UnitTypeDef> = {
  a: { area: 80, bedrooms: 2, bathrooms: 1, unitType: '2 Ambientes' },
  b: { area: 106, bedrooms: 3, bathrooms: 2, unitType: '3 Ambientes' },
  c: { area: 120, bedrooms: 3, bathrooms: 2, unitType: '3 Ambientes' },
  d: { area: 80, bedrooms: 2, bathrooms: 1, unitType: '2 Ambientes' },
  e: { area: 106, bedrooms: 3, bathrooms: 2, unitType: '3 Ambientes' },
  f: { area: 80, bedrooms: 2, bathrooms: 1, unitType: '2 Ambientes' },
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

function generateUnitProperties(floorNum: number, letter: string): Record<string, unknown> {
  const typeDef = UNIT_TYPES[letter];
  const basePricePerSqm = 2200 + (floorNum - 6) * 80; // floor premium
  const status = getUnitStatus(floorNum, UNIT_LETTERS.indexOf(letter));
  const price = status === 'sold' ? null : typeDef.area * basePricePerSqm;

  const hasBalcony = letter === 'a' || letter === 'b' || letter === 'c';

  const baseFeatures = ['Aire acondicionado', 'Calefacción central', 'Portero eléctrico', 'Cochera'];
  const premiumFeatures = ['Piso de porcelanato', 'Cocina equipada', 'Vestidor', 'Toilette'];
  const features = typeDef.area >= 106
    ? [...baseFeatures, ...premiumFeatures]
    : [...baseFeatures, premiumFeatures[0]];

  return {
    area: typeDef.area,
    price,
    bedrooms: typeDef.bedrooms,
    bathrooms: typeDef.bathrooms,
    unit_type: typeDef.unitType,
    floor_number: floorNum,
    has_balcony: hasBalcony,
    orientation: ORIENTATIONS[letter],
    features,
    description: `Departamento ${typeDef.unitType.toLowerCase()} de ${typeDef.area}m² en nivel ${floorNum}. ${hasBalcony ? 'Con balcón.' : ''} Orientación ${ORIENTATIONS[letter].toLowerCase()}.`,
  };
}

// ============================================================
// Main seed
// ============================================================

async function seed() {
  console.log('Starting Aurora seed...\n');

  // Clear existing data
  console.log('Clearing existing data...');
  await supabase.from('media').delete().not('id', 'is', null);
  await supabase.from('layers').delete().not('id', 'is', null);
  await supabase.from('projects').delete().not('id', 'is', null);
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
      status: 'available',
      layer_labels: ['Nivel', 'Departamento'],
      max_depth: 2,
      svg_path: null,
      city: 'Buenos Aires',
      state: 'CABA',
      country: 'Argentina',
    })
    .select()
    .single();

  if (projectError) throw projectError;
  console.log(`  Created: ${project.name}\n`);

  let totalLayers = 0;

  for (const floor of floors) {
    const isBasement = floor.svgPath === null;

    // Floor layer (depth 0)
    const { data: floorLayer, error: floorError } = await supabase
      .from('layers')
      .insert({
        project_id: project.id,
        parent_id: null,
        depth: 0,
        sort_order: floor.sortOrder,
        slug: floor.slug,
        name: floor.name,
        label: floor.label,
        svg_element_id: floor.svgElementId,
        status: isBasement ? 'not_available' : 'available',
        svg_path: floor.svgPath,
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

    const unitsToInsert = UNIT_LETTERS.map((letter, idx) => ({
      project_id: project.id,
      parent_id: floorLayer.id,
      depth: 1,
      sort_order: idx,
      slug: `nivel-${floorNum}-depto-${letter}`,
      name: `Depto ${letter.toUpperCase()}`,
      label: letter.toUpperCase(),
      svg_element_id: letter,
      status: getUnitStatus(floorNum, idx),
      svg_path: null,
      properties: generateUnitProperties(floorNum, letter),
    }));

    const { error: unitsError } = await supabase.from('layers').insert(unitsToInsert);
    if (unitsError) throw unitsError;
    totalLayers += unitsToInsert.length;

    console.log(`  Floor: ${floor.slug} (${unitsToInsert.length} units)`);
  }

  const basementCount = floors.filter((f) => f.svgPath === null).length;
  const residentialCount = floors.length - basementCount;

  console.log(`\nSeed complete!`);
  console.log(`  Project: ${project.name}`);
  console.log(`  Total layers: ${totalLayers}`);
  console.log(`    Basements: ${basementCount}`);
  console.log(`    Residential floors: ${residentialCount}`);
  console.log(`    Units: ${residentialCount * UNIT_LETTERS.length}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
