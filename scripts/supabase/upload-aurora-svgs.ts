import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * Upload Aurora SVGs to Supabase Storage and update svg_path fields.
 * Also stores 360 viewer SVG URLs in projects.settings.spin_svgs.
 *
 * Usage: npx tsx scripts/supabase/upload-aurora-svgs.ts
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
const SVG_DIR = path.resolve(__dirname, '../../public/svgs/aurora');

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

async function uploadSvg(localRelPath: string, storagePath: string): Promise<string | null> {
  try {
    const fullPath = path.join(SVG_DIR, localRelPath);
    const buffer = fs.readFileSync(fullPath);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: 'image/svg+xml', upsert: true });

    if (error) {
      console.error(`  Upload failed for ${storagePath}: ${error.message}`);
      return null;
    }

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    console.log(`  ✓ ${storagePath} (${(buffer.length / 1024).toFixed(0)}KB)`);
    return publicUrl.publicUrl;
  } catch (err) {
    console.error(`  Error: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

// SVG cyclic reuse for residential floors (matches seed-aurora.ts logic)
function getFloorSvgFile(floorNum: number): string {
  const cycle: Record<number, string> = {
    0: 'niveles/nivel-06.svg',
    1: 'niveles/nivel-07.svg',
    2: 'niveles/nivel-08.svg',
    3: 'niveles/nivel-09.svg',
  };
  return cycle[(floorNum - 6) % 4];
}

// ============================================================
// Main
// ============================================================

async function run() {
  console.log('Starting Aurora SVG upload...\n');

  await ensureBucket();

  // Get project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, slug, settings')
    .eq('slug', 'aurora')
    .single();

  if (projectError || !project) {
    console.error('Project "aurora" not found. Run db:seed first.');
    process.exit(1);
  }

  // ==========================================
  // 1. Upload floor plan SVGs
  // ==========================================
  console.log('=== Floor plan SVGs ===');

  // Upload the 4 unique SVG files and build a map of storage URLs
  const svgFiles = [
    'niveles/nivel-06.svg',
    'niveles/nivel-07.svg',
    'niveles/nivel-08.svg',
    'niveles/nivel-09.svg',
  ];

  const svgUrls: Record<string, string> = {};
  for (const file of svgFiles) {
    const storagePath = `aurora/svgs/${file}`;
    const url = await uploadSvg(file, storagePath);
    if (url) svgUrls[file] = url;
  }

  // Update layer svg_path for all residential floors
  console.log('\n  Updating floor svg_path values...');

  const { data: floors } = await supabase
    .from('layers')
    .select('id, slug')
    .eq('project_id', project.id)
    .eq('depth', 0)
    .order('sort_order');

  let floorUpdateCount = 0;
  for (const floor of floors ?? []) {
    const match = floor.slug.match(/^nivel-(\d+)$/);
    if (!match) continue; // skip basements

    const floorNum = parseInt(match[1], 10);
    const svgFile = getFloorSvgFile(floorNum);
    const url = svgUrls[svgFile];
    if (!url) continue;

    const { error } = await supabase
      .from('layers')
      .update({ svg_path: url })
      .eq('id', floor.id);

    if (error) {
      console.error(`  Failed to update ${floor.slug}: ${error.message}`);
    } else {
      floorUpdateCount++;
    }
  }
  console.log(`  Updated ${floorUpdateCount} floor svg_path values`);

  // ==========================================
  // 2. Upload top-view SVG (project level)
  // ==========================================
  console.log('\n=== Top-view SVG ===');

  const topViewUrl = await uploadSvg('top-view.svg', 'aurora/svgs/top-view.svg');
  if (topViewUrl) {
    const { error } = await supabase
      .from('projects')
      .update({ svg_path: topViewUrl })
      .eq('id', project.id);

    if (error) {
      console.error(`  Failed to update project svg_path: ${error.message}`);
    } else {
      console.log('  Updated project svg_path');
    }
  }

  // ==========================================
  // 3. Upload spin overlay SVGs → project.settings.spin_svgs
  // ==========================================
  console.log('\n=== Spin overlay SVGs ===');

  const spinFiles: Record<string, string> = {
    home: 'exterior/spin-home.svg',
    'point-a': 'exterior/spin-point-a.svg',
    'point-b': 'exterior/spin-point-b.svg',
  };

  const spinSvgs: Record<string, string> = {};
  for (const [viewpoint, file] of Object.entries(spinFiles)) {
    const storagePath = `aurora/svgs/${file}`;
    const url = await uploadSvg(file, storagePath);
    if (url) spinSvgs[viewpoint] = url;
  }

  // Merge spin_svgs into existing project settings
  const currentSettings = (project.settings as Record<string, unknown>) ?? {};
  const { error: settingsError } = await supabase
    .from('projects')
    .update({ settings: { ...currentSettings, spin_svgs: spinSvgs } })
    .eq('id', project.id);

  if (settingsError) {
    console.error(`  Failed to update project settings: ${settingsError.message}`);
  } else {
    console.log('  Updated project settings.spin_svgs');
  }

  // ==========================================
  // Summary
  // ==========================================
  console.log('\nUpload complete!');
  console.log(`  Floor SVGs uploaded: ${Object.keys(svgUrls).length}`);
  console.log(`  Floor layers updated: ${floorUpdateCount}`);
  console.log(`  Spin SVGs: ${Object.keys(spinSvgs).length}`);
}

run().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});
