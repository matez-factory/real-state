-- Real Estate Explorer Database Schema V2
-- Supports subdivisions and buildings with up to 4 exploration layers
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE project_type AS ENUM ('subdivision', 'building');
CREATE TYPE entity_status AS ENUM ('available', 'reserved', 'sold', 'not_available');
CREATE TYPE media_type AS ENUM ('image', 'video');
CREATE TYPE media_purpose AS ENUM (
  'cover',        -- Hero/card image
  'gallery',      -- Gallery carousel content
  'exploration',  -- Visual shown while at a layer (drone view, render)
  'transition',   -- Played when entering a layer (zoom-in, fly-through)
  'thumbnail',    -- Small preview
  'floor_plan'    -- Architectural plan
);

-- ============================================================
-- PROJECTS TABLE
-- ============================================================

CREATE TABLE projects (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug           TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  type           project_type NOT NULL,
  status         entity_status NOT NULL DEFAULT 'available',

  -- Configurable labels for each depth level
  -- Subdivision: ["Zona", "Manzana", "Lote"]
  -- Building:    ["Torre", "Piso", "Departamento"]
  layer_labels   JSONB NOT NULL DEFAULT '[]',
  max_depth      INTEGER NOT NULL DEFAULT 3 CHECK (max_depth BETWEEN 1 AND 4),

  -- The SVG map shown at the project root level (navigating depth-0 layers)
  svg_path       TEXT,

  -- Location
  address        TEXT,
  city           TEXT,
  state          TEXT,
  country        TEXT DEFAULT 'Argentina',
  coordinates    JSONB,  -- { "lat": -34.6, "lng": -58.4 }

  -- Project-wide settings (theme colors, currency, contact info, etc.)
  settings       JSONB DEFAULT '{}',

  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LAYERS TABLE (self-referencing hierarchy)
-- ============================================================

CREATE TABLE layers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id      UUID REFERENCES layers(id) ON DELETE CASCADE,

  -- Position in hierarchy (0 = first level under project, up to 3)
  depth          INTEGER NOT NULL CHECK (depth BETWEEN 0 AND 3),
  sort_order     INTEGER NOT NULL DEFAULT 0,

  -- Identity
  slug           TEXT NOT NULL,
  name           TEXT NOT NULL,
  label          TEXT,

  -- The element ID within the parent's SVG that represents this layer
  -- e.g., "zona-a", "manzana-1", "lote-01"
  svg_element_id TEXT,

  -- Status
  status         entity_status NOT NULL DEFAULT 'available',

  -- SVG map/floor plan for navigating THIS layer's children
  svg_path       TEXT,

  -- Flexible properties per depth/type (see comments below)
  properties     JSONB DEFAULT '{}',
  /*
    Subdivision leaf (lot):
    {
      "area": 250,
      "price": 50000,
      "is_corner": true,
      "front_meters": 10,
      "depth_meters": 25,
      "orientation": "Norte",
      "features": ["Esquina", "Cerca del parque"],
      "description": "Lote ubicado en esquina con vista al parque"
    }

    Building leaf (unit):
    {
      "area": 85,
      "price": 120000,
      "bedrooms": 2,
      "bathrooms": 1,
      "floor_number": 5,
      "unit_type": "2 ambientes",
      "has_balcony": true,
      "orientation": "Norte",
      "features": ["Balcon", "Vista al rio"],
      "description": "Departamento luminoso con balcon"
    }

    Intermediate layer:
    {
      "description": "Zona residencial premium"
    }
  */

  -- Buyer info (relevant for leaf layers only)
  buyer_name     TEXT,
  buyer_email    TEXT,
  buyer_phone    TEXT,
  buyer_notes    TEXT,
  reserved_at    TIMESTAMPTZ,
  sold_at        TIMESTAMPTZ,

  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, slug)
);

-- ============================================================
-- MEDIA TABLE
-- ============================================================

CREATE TABLE media (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  layer_id       UUID REFERENCES layers(id) ON DELETE CASCADE,  -- NULL = project-level

  type           media_type NOT NULL,
  purpose        media_purpose NOT NULL,

  -- Storage
  storage_path   TEXT NOT NULL,   -- Path within the bucket
  url            TEXT,            -- Full public URL (cached/computed)

  -- Display
  title          TEXT,
  description    TEXT,
  alt_text       TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,

  -- Technical metadata
  metadata       JSONB DEFAULT '{}',
  /*
    Images: { "width": 1920, "height": 1080, "format": "jpg", "size_bytes": 245000 }
    Videos: { "duration_s": 12, "width": 1920, "height": 1080, "format": "mp4", "size_bytes": 8500000 }
  */

  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Projects
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_type ON projects(type);

-- Layers
CREATE INDEX idx_layers_project ON layers(project_id);
CREATE INDEX idx_layers_parent ON layers(parent_id);
CREATE INDEX idx_layers_project_depth ON layers(project_id, depth);
CREATE INDEX idx_layers_status ON layers(status);

-- Media
CREATE INDEX idx_media_project ON media(project_id);
CREATE INDEX idx_media_layer ON media(layer_id);
CREATE INDEX idx_media_layer_purpose ON media(layer_id, purpose);

-- ============================================================
-- AUTO-UPDATE TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_layers_updated_at
  BEFORE UPDATE ON layers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Public read layers" ON layers FOR SELECT USING (true);
CREATE POLICY "Public read media" ON media FOR SELECT USING (true);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE projects IS 'Real estate projects (subdivisions, buildings)';
COMMENT ON TABLE layers IS 'Hierarchical exploration layers within a project (zones, blocks, lots, towers, floors, units)';
COMMENT ON TABLE media IS 'Images and videos for projects and layers (gallery, exploration, transitions)';
COMMENT ON COLUMN projects.layer_labels IS 'UI labels for each depth level, e.g. ["Zona", "Manzana", "Lote"]';
COMMENT ON COLUMN projects.max_depth IS 'Number of exploration layers (1-4)';
COMMENT ON COLUMN layers.depth IS 'Position in hierarchy: 0=first level, up to 3';
COMMENT ON COLUMN layers.svg_element_id IS 'Element ID within the parent SVG that represents this layer';
COMMENT ON COLUMN layers.properties IS 'Flexible JSON properties varying by project type and depth';
COMMENT ON COLUMN media.purpose IS 'How the media is used: cover, gallery, exploration view, transition animation, thumbnail, floor plan';

-- ============================================================
-- ADMIN WRITE POLICIES (authenticated users only)
-- ============================================================

-- Projects
CREATE POLICY "Authenticated can insert projects" ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update projects" ON projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete projects" ON projects FOR DELETE TO authenticated USING (true);

-- Layers
CREATE POLICY "Authenticated can insert layers" ON layers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update layers" ON layers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete layers" ON layers FOR DELETE TO authenticated USING (true);

-- Media
CREATE POLICY "Authenticated can insert media" ON media FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update media" ON media FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete media" ON media FOR DELETE TO authenticated USING (true);

-- ============================================================
-- STORAGE POLICIES (project-media bucket)
-- ============================================================

CREATE POLICY "Authenticated can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-media');
CREATE POLICY "Authenticated can update files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'project-media') WITH CHECK (bucket_id = 'project-media');
CREATE POLICY "Authenticated can delete files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'project-media');
CREATE POLICY "Public can read files" ON storage.objects FOR SELECT USING (bucket_id = 'project-media');
