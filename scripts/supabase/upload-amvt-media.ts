import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * Upload AMVT media to Supabase Storage and create media rows.
 * Reads files from lot-visualizer/public/.
 *
 * Categories:
 * - 4 tour stop images (exterior_360)
 * - 8 transition videos
 * - 32×3 lot media (ficha, background, background_mobile)
 * - 2 zone backgrounds
 * - 2 logos
 *
 * Usage: npx tsx scripts/supabase/upload-amvt-media.ts
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

function contentType(filePath: string): string {
  if (filePath.endsWith('.mp4')) return 'video/mp4';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

async function uploadFile(localPath: string, storagePath: string): Promise<string | null> {
  try {
    const buffer = fs.readFileSync(localPath);
    const ct = contentType(localPath);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: ct, upsert: true });

    if (error) {
      console.error(`    Upload failed: ${error.message}`);
      return null;
    }

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    console.log(`    ✓ ${storagePath} (${(buffer.length / 1024).toFixed(0)}KB)`);
    return publicUrl.publicUrl;
  } catch (err) {
    console.error(`    Error: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function createMediaRow(opts: {
  projectId: string;
  layerId: string | null;
  type: 'image' | 'video' | 'svg';
  purpose: string;
  storagePath: string;
  url: string;
  title: string;
  sortOrder: number;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const { error } = await supabase.from('media').insert({
    project_id: opts.projectId,
    layer_id: opts.layerId,
    type: opts.type,
    purpose: opts.purpose,
    storage_path: opts.storagePath,
    url: opts.url,
    title: opts.title,
    alt_text: opts.title,
    sort_order: opts.sortOrder,
    metadata: opts.metadata ?? {},
  });

  if (error) {
    console.error(`    Media row failed: ${error.message}`);
    return false;
  }
  return true;
}

// ============================================================
// Main
// ============================================================

async function run() {
  console.log('Starting AMVT media upload...\n');
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

  // Clear existing media for this project
  console.log('Clearing existing AMVT media...');
  await supabase.from('media').delete().eq('project_id', project.id);
  console.log('  Done\n');

  // Get zone and lot layers
  const { data: zone } = await supabase
    .from('layers')
    .select('id, slug')
    .eq('project_id', project.id)
    .eq('depth', 0)
    .single();

  const { data: lots } = await supabase
    .from('layers')
    .select('id, slug, label')
    .eq('project_id', project.id)
    .eq('depth', 1)
    .order('sort_order');

  if (!zone || !lots?.length) {
    console.error('Zone or lots not found. Run db:seed-amvt first.');
    process.exit(1);
  }

  // Build slug → id map (e.g. "i-01" → uuid)
  const lotMap = new Map(lots.map((l) => [l.slug, l.id]));

  let count = 0;

  // ==========================================
  // 1. Tour stop images (project-level, exterior_360)
  // ==========================================
  console.log('=== Tour stop images ===');

  for (let i = 1; i <= 4; i++) {
    const stopId = `stop-${String(i).padStart(2, '0')}`;
    const localPath = path.join(CONTENT_BASE, 'tour', `${stopId}.webp`);
    const storagePath = `amvt/tour/${stopId}.webp`;

    const url = await uploadFile(localPath, storagePath);
    if (url && await createMediaRow({
      projectId: project.id,
      layerId: null,
      type: 'image',
      purpose: 'gallery',
      storagePath,
      url,
      title: `Vista ${stopId}`,
      sortOrder: i,
      metadata: { viewpoint: stopId },
    })) count++;
  }

  // ==========================================
  // 2. Transition videos (project-level)
  // ==========================================
  console.log('\n=== Transition videos ===');

  const transitions = [
    { file: '01-02.mp4', from: 'stop-01', to: 'stop-02' },
    { file: '01-04.mp4', from: 'stop-01', to: 'stop-04' },
    { file: '02-01.mp4', from: 'stop-02', to: 'stop-01' },
    { file: '02-03.mp4', from: 'stop-02', to: 'stop-03' },
    { file: '03-02.mp4', from: 'stop-03', to: 'stop-02' },
    { file: '03-04.mp4', from: 'stop-03', to: 'stop-04' },
    { file: '04-01.mp4', from: 'stop-04', to: 'stop-01' },
    { file: '04-03.mp4', from: 'stop-04', to: 'stop-03' },
  ];

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i];
    const localPath = path.join(CONTENT_BASE, 'transitions', t.file);
    const storagePath = `amvt/transitions/${t.file}`;

    const url = await uploadFile(localPath, storagePath);
    if (url && await createMediaRow({
      projectId: project.id,
      layerId: null,
      type: 'video',
      purpose: 'transition',
      storagePath,
      url,
      title: `Transición ${t.from} → ${t.to}`,
      sortOrder: i,
      metadata: { from_viewpoint: t.from, to_viewpoint: t.to },
    })) count++;
  }

  // ==========================================
  // 3. Lot media (32 lots × 3 files each)
  // ==========================================
  console.log('\n=== Lot media ===');

  const lotFiles = [
    { suffix: 'ficha.webp', purpose: 'ficha_measured', titleSuffix: 'Ficha' },
    { suffix: 'fondo.webp', purpose: 'background', titleSuffix: 'Fondo' },
    { suffix: 'fondo-mobile.webp', purpose: 'background_mobile', titleSuffix: 'Fondo mobile' },
  ];

  for (const lot of lots) {
    const lotLabel = lot.label as string; // e.g. "I-01"
    for (let fi = 0; fi < lotFiles.length; fi++) {
      const { suffix, purpose, titleSuffix } = lotFiles[fi];
      const localPath = path.join(CONTENT_BASE, 'lots', lotLabel, suffix);
      const storagePath = `amvt/lots/${lotLabel}/${suffix}`;

      const url = await uploadFile(localPath, storagePath);
      if (url && await createMediaRow({
        projectId: project.id,
        layerId: lot.id,
        type: 'image',
        purpose,
        storagePath,
        url,
        title: `Lote ${lotLabel} - ${titleSuffix}`,
        sortOrder: fi,
      })) count++;
    }

    // Update lot layer background URLs
    const bgUrl = supabase.storage.from(BUCKET).getPublicUrl(`amvt/lots/${lotLabel}/fondo.webp`).data.publicUrl;
    const bgMobileUrl = supabase.storage.from(BUCKET).getPublicUrl(`amvt/lots/${lotLabel}/fondo-mobile.webp`).data.publicUrl;

    await supabase
      .from('layers')
      .update({
        background_image_url: bgUrl,
        background_image_mobile_url: bgMobileUrl,
      })
      .eq('id', lot.id);
  }

  // ==========================================
  // 4. Zone backgrounds
  // ==========================================
  console.log('\n=== Zone backgrounds ===');

  const zoneFiles = [
    { file: 'topview-fondo.webp', purpose: 'background', field: 'background_image_url' },
    { file: 'topview-fondo-mobile.webp', purpose: 'background_mobile', field: 'background_image_mobile_url' },
  ];

  for (let i = 0; i < zoneFiles.length; i++) {
    const { file, purpose, field } = zoneFiles[i];
    const localPath = path.join(CONTENT_BASE, 'zones', file);
    const storagePath = `amvt/zones/${file}`;

    const url = await uploadFile(localPath, storagePath);
    if (url) {
      await createMediaRow({
        projectId: project.id,
        layerId: zone.id,
        type: 'image',
        purpose,
        storagePath,
        url,
        title: `Zona - ${file}`,
        sortOrder: i,
      });
      count++;

      // Update zone layer URL
      await supabase
        .from('layers')
        .update({ [field]: url })
        .eq('id', zone.id);
    }
  }

  // ==========================================
  // 5. Logos (project-level)
  // ==========================================
  console.log('\n=== Logos ===');

  const logos = [
    { file: 'logo-amvt.svg', title: 'Logo AMVT' },
    { file: 'logo-proin.svg', title: 'Logo PRO IN' },
  ];

  for (let i = 0; i < logos.length; i++) {
    const { file, title } = logos[i];
    const localPath = path.join(CONTENT_BASE, 'branding', file);
    const storagePath = `amvt/branding/${file}`;

    const url = await uploadFile(localPath, storagePath);
    if (url && await createMediaRow({
      projectId: project.id,
      layerId: null,
      type: 'image',
      purpose: 'logo',
      storagePath,
      url,
      title,
      sortOrder: i,
    })) count++;
  }

  // ==========================================
  // Summary
  // ==========================================
  console.log(`\nUpload complete!`);
  console.log(`  Total media rows: ${count}`);
  console.log(`  Tour images: 4`);
  console.log(`  Transition videos: ${transitions.length}`);
  console.log(`  Lot media: ${lots.length * 3}`);
  console.log(`  Zone backgrounds: 2`);
  console.log(`  Logos: ${logos.length}`);
}

run().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});
