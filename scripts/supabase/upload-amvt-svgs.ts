import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * Upload AMVT SVGs to Supabase Storage and update layer/media records.
 *
 * - Zone topview SVGs → zone layer svg_overlay_url / svg_overlay_mobile_url
 * - Tour stop SVGs → media rows (type='svg', purpose='hotspot')
 *
 * Usage: npx tsx scripts/supabase/upload-amvt-svgs.ts
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
const CONTENT_BASE = path.resolve(__dirname, '../../../lot-visualizer/public');

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
    console.log(`  ✓ ${storagePath} (${(buffer.length / 1024).toFixed(1)}KB)`);
    return publicUrl.publicUrl;
  } catch (err) {
    console.error(`  Error: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

// ============================================================
// Main
// ============================================================

async function run() {
  console.log('Starting AMVT SVG upload...\n');
  console.log(`Content source: ${CONTENT_BASE}\n`);

  await ensureBucket();

  // Get project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, slug')
    .eq('slug', 'amvt')
    .single();

  if (projectError || !project) {
    console.error('Project "amvt" not found. Run db:seed-amvt first.');
    process.exit(1);
  }

  // Get zone layer
  const { data: zone } = await supabase
    .from('layers')
    .select('id, slug')
    .eq('project_id', project.id)
    .eq('depth', 0)
    .single();

  if (!zone) {
    console.error('Zone not found. Run db:seed-amvt first.');
    process.exit(1);
  }

  // ==========================================
  // 1. Zone topview SVGs → layer svg_overlay_url
  // ==========================================
  console.log('=== Zone topview SVGs ===');

  const topviewDesktop = path.join(CONTENT_BASE, 'zones', 'topview-lotes.svg');
  const topviewMobile = path.join(CONTENT_BASE, 'zones', 'topview-lotes-mobile.svg');

  const desktopUrl = await uploadSvgFile(topviewDesktop, 'amvt/svgs/zones/topview-lotes.svg');
  const mobileUrl = await uploadSvgFile(topviewMobile, 'amvt/svgs/zones/topview-lotes-mobile.svg');

  if (desktopUrl || mobileUrl) {
    const updateFields: Record<string, string> = {};
    if (desktopUrl) updateFields.svg_overlay_url = desktopUrl;
    if (mobileUrl) updateFields.svg_overlay_mobile_url = mobileUrl;

    const { error } = await supabase
      .from('layers')
      .update(updateFields)
      .eq('id', zone.id);

    if (error) {
      console.error(`  Failed to update zone: ${error.message}`);
    } else {
      console.log(`  Updated zone svg_overlay_url(s)`);
    }
  }

  // ==========================================
  // 2. Tour stop SVGs → media rows (hotspot)
  // ==========================================
  console.log('\n=== Tour stop SVGs (hotspots) ===');

  // Delete existing SVG hotspot media for this project
  await supabase
    .from('media')
    .delete()
    .eq('project_id', project.id)
    .eq('type', 'svg')
    .eq('purpose', 'hotspot');

  let hotspotCount = 0;
  for (let i = 1; i <= 4; i++) {
    const stopId = `stop-${String(i).padStart(2, '0')}`;
    const localPath = path.join(CONTENT_BASE, 'tour', `${stopId}.svg`);
    const storagePath = `amvt/svgs/tour/${stopId}.svg`;

    const url = await uploadSvgFile(localPath, storagePath);
    if (!url) continue;

    const { error: mediaError } = await supabase.from('media').insert({
      project_id: project.id,
      layer_id: null,
      type: 'svg',
      purpose: 'hotspot',
      storage_path: storagePath,
      url,
      title: `Hotspot overlay - ${stopId}`,
      alt_text: `Hotspot overlay - ${stopId}`,
      sort_order: i - 1,
      metadata: { viewpoint: stopId },
    });

    if (mediaError) {
      console.error(`  Media row failed for ${stopId}: ${mediaError.message}`);
    } else {
      hotspotCount++;
    }
  }

  // ==========================================
  // Summary
  // ==========================================
  console.log('\nUpload complete!');
  console.log(`  Zone SVGs: desktop=${desktopUrl ? 'yes' : 'no'}, mobile=${mobileUrl ? 'yes' : 'no'}`);
  console.log(`  Hotspot SVG media rows: ${hotspotCount}`);
}

run().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});
