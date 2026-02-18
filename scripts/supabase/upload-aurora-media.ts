import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * Upload Aurora media to Supabase Storage and create media rows.
 * Reads files directly from public/content/aurora/ (no HTTP downloads).
 *
 * Usage: npx tsx scripts/supabase/upload-aurora-media.ts
 */

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET = 'project-media';
const CONTENT_DIR = path.resolve(__dirname, '../../public/content/aurora');

// ============================================================
// Helpers
// ============================================================

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    console.log(`Creating bucket "${BUCKET}"...`);
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) throw error;
  }
  console.log(`Bucket "${BUCKET}" ready\n`);
}

function readFile(relativePath: string): Buffer {
  const fullPath = path.join(CONTENT_DIR, relativePath);
  return fs.readFileSync(fullPath);
}

function contentType(filePath: string): string {
  if (filePath.endsWith('.mp4')) return 'video/mp4';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

async function uploadAndCreateMedia(opts: {
  projectId: string;
  layerId: string | null;
  localPath: string;
  storagePath: string;
  type: 'image' | 'video';
  purpose: string;
  title: string;
  sortOrder: number;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const buffer = readFile(opts.localPath);
    const ct = contentType(opts.localPath);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(opts.storagePath, buffer, { contentType: ct, upsert: true });

    if (uploadError) {
      console.error(`    Upload failed: ${uploadError.message}`);
      return false;
    }

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(opts.storagePath);

    const { error: mediaError } = await supabase.from('media').insert({
      project_id: opts.projectId,
      layer_id: opts.layerId,
      type: opts.type,
      purpose: opts.purpose,
      storage_path: opts.storagePath,
      url: publicUrl.publicUrl,
      title: opts.title,
      alt_text: opts.title,
      sort_order: opts.sortOrder,
      metadata: {
        format: opts.localPath.split('.').pop(),
        size_bytes: buffer.length,
        ...opts.metadata,
      },
    });

    if (mediaError) {
      console.error(`    Media row failed: ${mediaError.message}`);
      return false;
    }

    console.log(`    ✓ ${opts.storagePath} (${(buffer.length / 1024).toFixed(0)}KB)`);
    return true;
  } catch (err) {
    console.error(`    Error: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

// ============================================================
// Floor-level image mapping
// ============================================================

// Basement floors get their own unique images
const BASEMENT_IMAGE_MAP: Record<string, string> = {
  'nivel-as3': '00_Nivel_AS3',
  'nivel-as2': '22_Nivel_AS2',
  'nivel-as1': '23_Nivel_AS1',
};

// Residential floors: background must match the SVG they use,
// since the SVG outlines were drawn to align with specific renders.
// SVG cycle: (floorNum - 6) % 4 → 0=nivel-06, 1=nivel-07, 2=nivel-08, 3=nivel-09
const SVG_MATCHED_IMAGES: Record<number, string> = {
  0: '21_Nivel_06', // nivel-06.svg → 21_Nivel_06.jpg
  1: '20_Nivel_07', // nivel-07.svg → 20_Nivel_07.jpg
  2: '19_Nivel_08', // nivel-08.svg → 19_Nivel_08.jpg
  3: '18_Nivel_09', // nivel-09.svg → 18_Nivel_09.jpg
};

function getFloorImagePrefix(slug: string): string | null {
  // Basements
  if (BASEMENT_IMAGE_MAP[slug]) return BASEMENT_IMAGE_MAP[slug];

  // Residential: match the SVG cycle
  const match = slug.match(/^nivel-(\d+)$/);
  if (!match) return null;
  const floorNum = parseInt(match[1], 10);
  return SVG_MATCHED_IMAGES[(floorNum - 6) % 4];
}

// Unit letter → area type prefix for floor plan images
const UNIT_AREA_MAP: Record<string, string> = {
  a: '80m2',
  b: '106m2',
  c: '120m2',
  d: '80m2',
  e: '106m2',
  f: '80m2',
};

// ============================================================
// Main
// ============================================================

async function run() {
  console.log('Starting Aurora media upload...\n');

  await ensureBucket();

  // Get project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, slug')
    .eq('slug', 'aurora')
    .single();

  if (projectError || !project) {
    console.error('Project "aurora" not found. Run db:seed-aurora first.');
    process.exit(1);
  }

  // Clear existing media
  console.log('Clearing existing media...');
  await supabase.from('media').delete().eq('project_id', project.id);
  console.log('  Done\n');

  let count = 0;

  // ==========================================
  // 1. Project-level media (layer_id = null)
  // ==========================================
  console.log('=== Project-level media ===');

  // Cover image
  if (await uploadAndCreateMedia({
    projectId: project.id, layerId: null,
    localPath: 'exterior/home_img.jpg',
    storagePath: 'aurora/project/home_img.jpg',
    type: 'image', purpose: 'cover', title: 'Aurora - Fachada', sortOrder: 0,
    metadata: { viewpoint: 'home' },
  })) count++;

  // Exploration background
  if (await uploadAndCreateMedia({
    projectId: project.id, layerId: null,
    localPath: 'exterior/intro_img.jpg',
    storagePath: 'aurora/project/intro_img.jpg',
    type: 'image', purpose: 'exploration', title: 'Aurora - Vista general', sortOrder: 0,
  })) count++;

  // Spin viewpoint images
  if (await uploadAndCreateMedia({
    projectId: project.id, layerId: null,
    localPath: 'exterior/home_img.jpg',
    storagePath: 'aurora/spin/home_img.jpg',
    type: 'image', purpose: 'gallery', title: 'Vista Home', sortOrder: 1,
    metadata: { viewpoint: 'home' },
  })) count++;

  if (await uploadAndCreateMedia({
    projectId: project.id, layerId: null,
    localPath: 'exterior/spin_pointa_img.jpg',
    storagePath: 'aurora/spin/spin_pointa_img.jpg',
    type: 'image', purpose: 'gallery', title: 'Vista A', sortOrder: 2,
    metadata: { viewpoint: 'point-a' },
  })) count++;

  if (await uploadAndCreateMedia({
    projectId: project.id, layerId: null,
    localPath: 'exterior/spin_point_b.jpg',
    storagePath: 'aurora/spin/spin_point_b.jpg',
    type: 'image', purpose: 'gallery', title: 'Vista B', sortOrder: 3,
    metadata: { viewpoint: 'point-b' },
  })) count++;

  // Intro video
  if (await uploadAndCreateMedia({
    projectId: project.id, layerId: null,
    localPath: 'exterior/intro_video.mp4',
    storagePath: 'aurora/spin/intro_video.mp4',
    type: 'video', purpose: 'transition', title: 'Intro', sortOrder: 0,
    metadata: { from_viewpoint: 'intro', to_viewpoint: 'home' },
  })) count++;

  // Transition videos
  // avance: suffix = destination (avance_a = advance TO point-a)
  // retroceso: suffix = departure (retroceso_a = retreat FROM point-a)
  const transitions = [
    { file: 'video_avance_a.mp4', from: 'home', to: 'point-a', title: 'Avance Home → A' },
    { file: 'video_avance_b.mp4', from: 'point-a', to: 'point-b', title: 'Avance A → B' },
    { file: 'video_avance_c.mp4', from: 'point-b', to: 'home', title: 'Avance B → Home' },
    { file: 'video_retroceso_a.mp4', from: 'point-a', to: 'home', title: 'Retroceso A → Home' },
    { file: 'video_retroceso_b.mp4', from: 'point-b', to: 'point-a', title: 'Retroceso B → A' },
    { file: 'video_retroceso_c.mp4', from: 'home', to: 'point-b', title: 'Retroceso Home → B' },
  ];

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i];
    if (await uploadAndCreateMedia({
      projectId: project.id, layerId: null,
      localPath: `exterior/${t.file}`,
      storagePath: `aurora/spin/${t.file}`,
      type: 'video', purpose: 'transition', title: t.title, sortOrder: i + 1,
      metadata: { from_viewpoint: t.from, to_viewpoint: t.to },
    })) count++;
  }

  // Aerial videos (also serve as entrance transitions)
  const aerialVideos = ['aurora-01-top.mp4', 'aurora-02-top.mp4', 'aurora-03-top.mp4'];
  const aerialViewpoints = ['home', 'point-a', 'point-b'];
  for (let i = 0; i < aerialVideos.length; i++) {
    if (await uploadAndCreateMedia({
      projectId: project.id, layerId: null,
      localPath: `videos/${aerialVideos[i]}`,
      storagePath: `aurora/videos/${aerialVideos[i]}`,
      type: 'video', purpose: 'gallery', title: `Vuelo aéreo ${i + 1}`, sortOrder: 10 + i,
      metadata: { category: 'aerial', entrance_from_viewpoint: aerialViewpoints[i] },
    })) count++;
  }

  // ==========================================
  // 2. Floor-level media (3D renders)
  // ==========================================
  console.log('\n=== Floor exploration backgrounds ===');

  const { data: allFloors } = await supabase
    .from('layers')
    .select('id, slug')
    .eq('project_id', project.id)
    .eq('depth', 0)
    .order('sort_order');

  for (const floor of allFloors ?? []) {
    const filePrefix = getFloorImagePrefix(floor.slug);
    if (!filePrefix) {
      console.log(`  Skipping ${floor.slug} (no image mapping)`);
      continue;
    }

    if (await uploadAndCreateMedia({
      projectId: project.id, layerId: floor.id,
      localPath: `niveles/${filePrefix}.jpg`,
      storagePath: `aurora/niveles/${floor.slug}.jpg`,
      type: 'image', purpose: 'exploration', title: `Render ${floor.slug}`, sortOrder: 0,
    })) count++;
  }

  // ==========================================
  // 3. Unit-level media (floor plans)
  // ==========================================
  console.log('\n=== Unit floor plans ===');

  // Upload the 12 unique floor plan files to storage once
  const planFiles = [
    '80m2_planta_amoblada.jpg', '80m2_planta_amoblada2.jpg',
    '80m2_planta_medidas.jpg', '80m2_planta_medidas2.jpg',
    '106m2_planta_amoblada.jpg', '106m2_planta_amoblada2.jpg',
    '106m2_planta_medidas.jpg', '106m2_planta_medidas2.jpg',
    '120m2_planta_amoblada.jpg', '120m2_planta_amoblada2.jpg',
    '120m2_planta_medidas.jpg', '120m2_planta_medidas2.jpg',
  ];

  console.log('  Uploading 12 unique floor plan images...');
  const planUrls: Record<string, string> = {};
  for (const file of planFiles) {
    const buffer = readFile(`fichas/${file}`);
    const storagePath = `aurora/fichas/${file}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true });
    if (error) {
      console.error(`    Upload failed for ${file}: ${error.message}`);
      continue;
    }
    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    planUrls[file] = publicUrl.publicUrl;
    console.log(`    ✓ ${file}`);
  }

  // Get all units
  const { data: units } = await supabase
    .from('layers')
    .select('id, slug')
    .eq('project_id', project.id)
    .eq('depth', 1)
    .order('slug');

  console.log(`  Creating floor plan media for ${units?.length ?? 0} units...`);

  const planTitles = [
    'Planta amoblada', 'Planta amoblada (alt)',
    'Planta con medidas', 'Planta con medidas (alt)',
  ];

  let unitMediaCount = 0;
  for (const unit of units ?? []) {
    // Extract unit letter from slug: "nivel-6-depto-a" → "a"
    const letter = unit.slug.split('-').pop()!;
    const areaPrefix = UNIT_AREA_MAP[letter];
    if (!areaPrefix) continue;

    const unitPlanFiles = [
      `${areaPrefix}_planta_amoblada.jpg`,
      `${areaPrefix}_planta_amoblada2.jpg`,
      `${areaPrefix}_planta_medidas.jpg`,
      `${areaPrefix}_planta_medidas2.jpg`,
    ];

    const mediaRows = unitPlanFiles
      .map((file, idx) => {
        const url = planUrls[file];
        if (!url) return null;
        return {
          project_id: project.id,
          layer_id: unit.id,
          type: 'image' as const,
          purpose: 'floor_plan' as const,
          storage_path: `aurora/fichas/${file}`,
          url,
          title: planTitles[idx],
          alt_text: `${unit.slug} - ${planTitles[idx]}`,
          sort_order: idx,
          metadata: { format: 'jpg', area_type: areaPrefix },
        };
      })
      .filter(Boolean);

    if (mediaRows.length > 0) {
      const { error } = await supabase.from('media').insert(mediaRows);
      if (error) {
        console.error(`    Media rows failed for ${unit.slug}: ${error.message}`);
      } else {
        unitMediaCount += mediaRows.length;
      }
    }
  }
  count += unitMediaCount;

  console.log(`\nUpload complete!`);
  console.log(`  Project media: ${count - unitMediaCount}`);
  console.log(`  Unit floor plans: ${unitMediaCount}`);
  console.log(`  Total media rows: ${count}`);
}

run().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});
