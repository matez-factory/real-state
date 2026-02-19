import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

/**
 * Seed the database with the Loteo AMVT project.
 * 1 zone ("Lotes") + 32 residential lots (2 manzanas × 16 lotes).
 *
 * Usage: npx tsx scripts/supabase/seed-amvt.ts
 */

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================
// Lot data from lots-data.json
// ============================================================

interface LotDef {
  id: string;       // e.g. "I-01"
  dimensions: string;
  area: number;
  price: number;
  status: 'available' | 'reserved' | 'sold' | 'not_available';
}

const LOTS: LotDef[] = [
  // Manzana I
  { id: 'I-01', dimensions: '13,25m x 20,75m', area: 275, price: 33500, status: 'available' },
  { id: 'I-02', dimensions: '12,25m x 20,75m', area: 254, price: 31500, status: 'available' },
  { id: 'I-03', dimensions: '12,25m x 20,75m', area: 254, price: 31500, status: 'available' },
  { id: 'I-04', dimensions: '12,25m x 20,75m', area: 254, price: 31500, status: 'available' },
  { id: 'I-05', dimensions: '12,25m x 20,75m', area: 254, price: 31500, status: 'available' },
  { id: 'I-06', dimensions: '12,25m x 20,75m', area: 254, price: 31500, status: 'available' },
  { id: 'I-07', dimensions: '12,25m x 20,75m', area: 254, price: 31500, status: 'available' },
  { id: 'I-08', dimensions: '13,25m x 20,75m', area: 275, price: 35500, status: 'available' },
  { id: 'I-09', dimensions: '13,25m x 20,75m', area: 275, price: 28500, status: 'available' },
  { id: 'I-10', dimensions: '12,25m x 20,75m', area: 254, price: 30500, status: 'available' },
  { id: 'I-11', dimensions: '12,25m x 20,75m', area: 254, price: 30500, status: 'available' },
  { id: 'I-12', dimensions: '12,25m x 20,75m', area: 254, price: 30500, status: 'available' },
  { id: 'I-13', dimensions: '12,25m x 20,75m', area: 254, price: 30500, status: 'available' },
  { id: 'I-14', dimensions: '12,25m x 20,75m', area: 254, price: 30500, status: 'available' },
  { id: 'I-15', dimensions: '12,25m x 20,75m', area: 254, price: 30500, status: 'available' },
  { id: 'I-16', dimensions: '13,25m x 20,75m', area: 275, price: 35500, status: 'available' },
  // Manzana B
  { id: 'B-01', dimensions: '13,25m x 20,75m', area: 275, price: 35500, status: 'available' },
  { id: 'B-02', dimensions: '12,25m x 20,75m', area: 254, price: 31500, status: 'available' },
  { id: 'B-03', dimensions: '12,25m x 20,75m', area: 254, price: 31500, status: 'available' },
  { id: 'B-04', dimensions: '12,25m x 20,75m', area: 254, price: 31500, status: 'available' },
  { id: 'B-05', dimensions: '12,25m x 20,75m', area: 254, price: 31500, status: 'available' },
  { id: 'B-06', dimensions: '12,25m x 20,75m', area: 254, price: 31500, status: 'available' },
  { id: 'B-07', dimensions: '12,25m x 20,75m', area: 254, price: 31500, status: 'available' },
  { id: 'B-08', dimensions: '13,25m x 20,75m', area: 275, price: 33500, status: 'available' },
  { id: 'B-09', dimensions: '13,25m x 20,75m', area: 275, price: 35500, status: 'available' },
  { id: 'B-10', dimensions: '12,25m x 20,75m', area: 254, price: 30500, status: 'available' },
  { id: 'B-11', dimensions: '12,25m x 20,75m', area: 254, price: 30500, status: 'available' },
  { id: 'B-12', dimensions: '12,25m x 20,75m', area: 254, price: 30500, status: 'available' },
  { id: 'B-13', dimensions: '12,25m x 20,75m', area: 254, price: 30500, status: 'available' },
  { id: 'B-14', dimensions: '12,25m x 20,75m', area: 254, price: 30500, status: 'available' },
  { id: 'B-15', dimensions: '12,25m x 20,75m', area: 254, price: 30500, status: 'available' },
  { id: 'B-16', dimensions: '13,25m x 20,75m', area: 275, price: 33500, status: 'available' },
];

const PROJECT_FEATURES = [
  { icon: 'flame', text: 'Factibilidad de conexión a los servicios de gas natural, cloacas y electricidad' },
  { icon: 'car', text: 'Acceso por calle pavimentada' },
  { icon: 'dollar-sign', text: 'Posibilidad de financiación con crédito hipotecario hasta el 50% del valor del lote (sujeto a verificación crediticia)' },
];

// ============================================================
// SVG ID mapping (critical — handles row inversions)
// ============================================================

/**
 * Maps lot ID (e.g. "I-05") to SVG polygon ID (e.g. "_05").
 *
 * Manzana I upper row:  I-01→_01, ..., I-08→_08 (direct)
 * Manzana I lower row:  I-09→_16, I-10→_15, ..., I-16→_09 (inverted: 25-lotNum)
 * Manzana B upper row:  B-01→_17, ..., B-08→_24 (offset +16)
 * Manzana B lower row:  B-09→_32, B-10→_31, ..., B-16→_25 (inverted + offset)
 */
function lotIdToSvgElementId(lotId: string): string {
  const [block, numStr] = lotId.split('-');
  const num = parseInt(numStr, 10);
  const offset = block === 'B' ? 16 : 0;

  if (num <= 8) {
    // Upper row: direct mapping
    return `_${String(num + offset).padStart(2, '0')}`;
  } else {
    // Lower row: inverted (25 - num for I, 25 - num + 16 for B)
    const invertedNum = 25 - num;
    return `_${String(invertedNum + offset).padStart(2, '0')}`;
  }
}

function parseDimensions(dim: string): { front: number; depth: number } {
  // "13,25m x 20,75m" → { front: 13.25, depth: 20.75 }
  const parts = dim.split(' x ');
  return {
    front: parseFloat(parts[0].replace(',', '.').replace('m', '')),
    depth: parseFloat(parts[1].replace(',', '.').replace('m', '')),
  };
}

function isCornerLot(lotId: string): boolean {
  const num = parseInt(lotId.split('-')[1], 10);
  return num === 1 || num === 8 || num === 9 || num === 16;
}

// ============================================================
// Main seed
// ============================================================

async function seed() {
  console.log('Starting AMVT seed...\n');

  // Check if AMVT already exists — delete it
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', 'amvt')
    .single();

  if (existing) {
    console.log('Deleting existing AMVT data...');
    await supabase.from('media').delete().eq('project_id', existing.id);
    await supabase.from('layers').delete().eq('project_id', existing.id);
    await supabase.from('projects').delete().eq('id', existing.id);
    console.log('  Done\n');
  }

  // Create project
  console.log('Creating AMVT project...');
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      slug: 'amvt',
      name: 'Loteo AMVT',
      description: 'Loteo residencial de 32 lotes distribuidos en 2 manzanas. Ubicación privilegiada con todos los servicios.',
      type: 'lots',
      status: 'active',
      scale: 'small',
      layer_labels: ['Zona', 'Lote'],
      max_depth: 2,
      city: 'Venado Tuerto',
      state: 'Santa Fe',
      country: 'Argentina',
      // Contact
      phone: '3462-334848 / 3462-336552',
      email: 'Proin.inmuebles@gmail.com',
      whatsapp: '+5493462334848',
      website: 'www.proin.ar',
      // Feature toggles
      has_video_intro: false,
      has_gallery: false,
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

  // Create tour layer (depth 0) — holds 360 panorama + hotspots + transitions
  console.log('Creating tour layer...');
  const { data: tour, error: tourError } = await supabase
    .from('layers')
    .insert({
      project_id: project.id,
      parent_id: null,
      type: 'tour',
      depth: 0,
      sort_order: 0,
      slug: 'tour',
      name: 'Tour 360',
      label: 'Tour',
      svg_element_id: null,
      status: 'available',
      properties: {},
    })
    .select()
    .single();

  if (tourError) throw tourError;
  console.log(`  Created tour: ${tour.name} (id: ${tour.id})\n`);

  // Create zone layer (depth 0) — holds topview map + lot children
  console.log('Creating zone "Lotes"...');
  const { data: zone, error: zoneError } = await supabase
    .from('layers')
    .insert({
      project_id: project.id,
      parent_id: null,
      type: 'zone',
      depth: 0,
      sort_order: 1,
      slug: 'lotes',
      name: 'Lotes',
      label: 'Lotes',
      svg_element_id: null,
      status: 'available',
      svg_overlay_url: null,       // updated later by upload-amvt-svgs
      svg_overlay_mobile_url: null, // updated later by upload-amvt-svgs
      properties: {},
    })
    .select()
    .single();

  if (zoneError) throw zoneError;
  console.log(`  Created zone: ${zone.name} (id: ${zone.id})\n`);

  // Create 32 lot layers (depth 1)
  console.log('Creating 32 lots...');

  const lotsToInsert = LOTS.map((lot, idx) => {
    const { front, depth } = parseDimensions(lot.dimensions);
    const block = lot.id.split('-')[0]; // "I" or "B"
    const svgElementId = lotIdToSvgElementId(lot.id);

    return {
      project_id: project.id,
      parent_id: zone.id,
      type: 'lot',
      depth: 1,
      sort_order: idx,
      slug: lot.id.toLowerCase(), // "i-01", "b-01"
      name: `Lote ${lot.id}`,
      label: lot.id,
      svg_element_id: svgElementId,
      status: lot.status,
      svg_overlay_url: null,
      // Typed columns
      area: lot.area,
      area_unit: 'm2',
      price: lot.price,
      currency: 'USD',
      front_length: front,
      depth_length: depth,
      is_corner: isCornerLot(lot.id),
      features: PROJECT_FEATURES,
      // Properties for extra data
      properties: {
        dimensions: lot.dimensions,
        block,
      },
    };
  });

  const { error: lotsError } = await supabase.from('layers').insert(lotsToInsert);
  if (lotsError) throw lotsError;

  // Log SVG mapping for verification
  console.log('\n  SVG ID mapping:');
  for (const lot of lotsToInsert) {
    console.log(`    ${lot.name} → ${lot.svg_element_id}`);
  }

  console.log(`\nSeed complete!`);
  console.log(`  Project: ${project.name}`);
  console.log(`  Zone: 1`);
  console.log(`  Lots: ${lotsToInsert.length}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
