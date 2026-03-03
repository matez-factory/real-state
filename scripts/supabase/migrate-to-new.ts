import { createClient } from '@supabase/supabase-js'

const OLD_URL = 'https://wgritmhmfhhzznqsmumh.supabase.co'
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indncml0bWhtZmhoenpucXNtdW1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQyMTM4MSwiZXhwIjoyMDg2OTk3MzgxfQ.Chemvd3h90lm6bc0iZQD7kI9Pg-uDsogub0xy_Uf9dw'

const NEW_URL = 'https://opfminfiuimyanebogsi.supabase.co'
const NEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZm1pbmZpdWlteWFuZWJvZ3NpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQwMDQwNywiZXhwIjoyMDg3OTc2NDA3fQ.qgIuCIPvSyGKITurb7sgEgXxvhyobAcAP2M9mgpQryA'

const old = createClient(OLD_URL, OLD_KEY)
const neo = createClient(NEW_URL, NEW_KEY)

async function fetchAll(client: ReturnType<typeof createClient>, table: string) {
  const { data, error } = await client.from(table).select('*')
  if (error) throw new Error(`Fetch ${table}: ${error.message}`)
  return data ?? []
}

async function insertBatch(table: string, rows: any[]) {
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (skip)`)
    return
  }
  // Insert in chunks of 100 to avoid payload limits
  const chunkSize = 100
  let inserted = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await neo.from(table).insert(chunk)
    if (error) throw new Error(`Insert ${table} chunk ${i}: ${error.message}`)
    inserted += chunk.length
  }
  console.log(`  ${table}: ${inserted} rows OK`)
}

async function migrateData() {
  console.log('\n=== MIGRATING DATA ===\n')

  // 1. Projects
  const projects = await fetchAll(old, 'projects')
  await insertBatch('projects', projects)

  // 2. Domains
  const domains = await fetchAll(old, 'domains')
  await insertBatch('domains', domains)

  // 3. Unit types
  const unitTypes = await fetchAll(old, 'unit_types')
  await insertBatch('unit_types', unitTypes)

  // 4. Layers - insert by depth to respect self-referencing FK
  const allLayers = await fetchAll(old, 'layers')
  const maxDepth = Math.max(...allLayers.map((l: any) => l.depth), 0)
  console.log(`  layers: ${allLayers.length} total, max depth ${maxDepth}`)
  for (let d = 0; d <= maxDepth; d++) {
    const layersAtDepth = allLayers.filter((l: any) => l.depth === d)
    if (layersAtDepth.length > 0) {
      const { error } = await neo.from('layers').insert(layersAtDepth)
      if (error) throw new Error(`Insert layers depth ${d}: ${error.message}`)
      console.log(`    depth ${d}: ${layersAtDepth.length} rows OK`)
    }
  }

  // 5. Scenes
  const scenes = await fetchAll(old, 'scenes')
  await insertBatch('scenes', scenes)

  // 6. Scene transitions
  const transitions = await fetchAll(old, 'scene_transitions')
  await insertBatch('scene_transitions', transitions)

  // 7. Media
  const media = await fetchAll(old, 'media')
  await insertBatch('media', media)

  // 8. Update landing_scene_id on projects (circular FK)
  for (const p of projects) {
    if (p.landing_scene_id) {
      const { error } = await neo.from('projects').update({ landing_scene_id: p.landing_scene_id }).eq('id', p.id)
      if (error) console.warn(`  Warning: update landing_scene_id for ${p.slug}: ${error.message}`)
    }
  }
}

async function listAllFiles(client: ReturnType<typeof createClient>, bucket: string, prefix: string = ''): Promise<string[]> {
  const paths: string[] = []
  const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error || !data) return paths

  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id) {
      // It's a file
      paths.push(fullPath)
    } else {
      // It's a folder, recurse
      const subPaths = await listAllFiles(client, bucket, fullPath)
      paths.push(...subPaths)
    }
  }
  return paths
}

async function migrateStorage() {
  console.log('\n=== MIGRATING STORAGE ===\n')

  // Create bucket on new project
  const { error: bucketError } = await neo.storage.createBucket('project-media', { public: true })
  if (bucketError && !bucketError.message.includes('already exists')) {
    throw new Error(`Create bucket: ${bucketError.message}`)
  }
  console.log('  Bucket "project-media" ready')

  // List all files recursively
  const files = await listAllFiles(old, 'project-media')
  console.log(`  Found ${files.length} files to copy\n`)

  let copied = 0
  let failed = 0
  for (const filePath of files) {
    // Download from old
    const { data: blob, error: dlError } = await old.storage.from('project-media').download(filePath)
    if (dlError || !blob) {
      console.error(`  SKIP ${filePath}: ${dlError?.message}`)
      failed++
      continue
    }

    // Upload to new
    const buffer = Buffer.from(await blob.arrayBuffer())
    const { error: ulError } = await neo.storage.from('project-media').upload(filePath, buffer, {
      contentType: blob.type,
      upsert: true,
    })
    if (ulError) {
      console.error(`  FAIL upload ${filePath}: ${ulError.message}`)
      failed++
      continue
    }

    copied++
    if (copied % 50 === 0) console.log(`  ...copied ${copied}/${files.length}`)
  }

  console.log(`\n  Storage done: ${copied} copied, ${failed} failed out of ${files.length}`)
}

async function main() {
  try {
    await migrateData()
    await migrateStorage()
    console.log('\n=== MIGRATION COMPLETE ===\n')
  } catch (err) {
    console.error('\nMIGRATION ERROR:', err)
    process.exit(1)
  }
}

main()
