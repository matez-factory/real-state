import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * Upload Aurora SVGs to Supabase Storage and update svg_overlay_url fields.
 * Spin overlay SVGs are stored as media rows (type='svg', purpose='hotspot').
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

// Source content directory
const CONTENT_BASE = path.resolve(__dirname, '../../../Contenido app- Edificio');
const NIVELES_DIR = path.join(CONTENT_BASE, 'NIVELES - SWIPE');
const EXTERIOR_DIR = path.join(CONTENT_BASE, 'EXTERIOR - SPIN360');

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

async function uploadSvgFile(localFullPath: string, storagePath: string): Promise<string | null> {
  try {
    const buffer = fs.readFileSync(localFullPath);

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
// Source files: SVG_nivel_06.svg, SVG_nivel_07.svg, SVG_nivel_08.svg, SVG_nivel_09.svg
function getFloorSvgSourceFile(floorNum: number): string {
  const cycle: Record<number, string> = {
    0: 'SVG_nivel_06.svg',
    1: 'SVG_nivel_07.svg',
    2: 'SVG_nivel_08.svg',
    3: 'SVG_nivel_09.svg',
  };
  return cycle[(floorNum - 6) % 4];
}

// ============================================================
// Main
// ============================================================

async function run() {
  console.log('Starting Aurora SVG upload...\n');
  console.log(`Content source: ${CONTENT_BASE}\n`);

  await ensureBucket();

  // Get project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, slug')
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

  // Upload the 4 unique SVG files from NIVELES - SWIPE/
  const svgSourceFiles = [
    'SVG_nivel_06.svg',
    'SVG_nivel_07.svg',
    'SVG_nivel_08.svg',
    'SVG_nivel_09.svg',
  ];

  const svgUrls: Record<string, string> = {};
  for (const file of svgSourceFiles) {
    const localPath = path.join(NIVELES_DIR, file);
    const storagePath = `aurora/svgs/niveles/${file}`;
    const url = await uploadSvgFile(localPath, storagePath);
    if (url) svgUrls[file] = url;
  }

  // Update layer svg_overlay_url for all residential floors
  console.log('\n  Updating floor svg_overlay_url values...');

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
    const svgFile = getFloorSvgSourceFile(floorNum);
    const url = svgUrls[svgFile];
    if (!url) continue;

    const { error } = await supabase
      .from('layers')
      .update({ svg_overlay_url: url })
      .eq('id', floor.id);

    if (error) {
      console.error(`  Failed to update ${floor.slug}: ${error.message}`);
    } else {
      floorUpdateCount++;
    }
  }
  console.log(`  Updated ${floorUpdateCount} floor svg_overlay_url values`);

  // ==========================================
  // 2. Upload top-view SVG (project level)
  // ==========================================
  console.log('\n=== Top-view SVG ===');

  const topViewPath = path.join(NIVELES_DIR, 'TOP.svg');
  const topViewUrl = await uploadSvgFile(topViewPath, 'aurora/svgs/top-view.svg');
  if (topViewUrl) {
    const { error } = await supabase
      .from('projects')
      .update({ svg_overlay_url: topViewUrl })
      .eq('id', project.id);

    if (error) {
      console.error(`  Failed to update project svg_overlay_url: ${error.message}`);
    } else {
      console.log('  Updated project svg_overlay_url');
    }
  }

  // ==========================================
  // 3. Upload spin overlay SVGs → media rows (type='svg', purpose='hotspot')
  // ==========================================
  console.log('\n=== Spin overlay SVGs ===');

  // Source files in EXTERIOR - SPIN360/
  const spinFiles: Record<string, string> = {
    'home': 'SVG_home.svg',
    'point-a': 'SVG_Spin_point_a.svg',
    'point-b': 'SVG_Spin_point_b.svg',
  };

  let spinCount = 0;
  for (const [viewpoint, fileName] of Object.entries(spinFiles)) {
    const localPath = path.join(EXTERIOR_DIR, fileName);
    const storagePath = `aurora/svgs/exterior/${fileName}`;
    const url = await uploadSvgFile(localPath, storagePath);
    if (!url) continue;

    // Insert as media row
    const { error: mediaError } = await supabase.from('media').insert({
      project_id: project.id,
      layer_id: null,
      type: 'svg',
      purpose: 'hotspot',
      storage_path: storagePath,
      url,
      title: `Spin overlay - ${viewpoint}`,
      alt_text: `Spin overlay - ${viewpoint}`,
      sort_order: spinCount,
      metadata: { viewpoint },
    });

    if (mediaError) {
      console.error(`  Media row failed for ${viewpoint}: ${mediaError.message}`);
    } else {
      spinCount++;
    }
  }
  console.log(`  Created ${spinCount} spin overlay media rows`);

  // ==========================================
  // Summary
  // ==========================================
  console.log('\nUpload complete!');
  console.log(`  Floor SVGs uploaded: ${Object.keys(svgUrls).length}`);
  console.log(`  Floor layers updated: ${floorUpdateCount}`);
  console.log(`  Spin SVG media rows: ${spinCount}`);
}

run().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});
