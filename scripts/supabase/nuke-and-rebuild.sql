-- ============================================================
-- PASO 1: BORRAR TODO LO EXISTENTE
-- ============================================================

-- Desactivar RLS temporalmente para poder borrar
ALTER TABLE IF EXISTS media DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS layers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS unit_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scene_transitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scenes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS domains DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;

-- Drop tablas existentes (tanto viejas como nuevas si existen)
DROP TABLE IF EXISTS media CASCADE;
DROP TABLE IF EXISTS scene_transitions CASCADE;
DROP TABLE IF EXISTS scenes CASCADE;
DROP TABLE IF EXISTS layers CASCADE;
DROP TABLE IF EXISTS unit_types CASCADE;
DROP TABLE IF EXISTS domains CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
-- Tablas viejas de Nacho
DROP TABLE IF EXISTS lots CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS zones CASCADE;

-- Drop enums existentes
DROP TYPE IF EXISTS project_type CASCADE;
DROP TYPE IF EXISTS project_status CASCADE;
DROP TYPE IF EXISTS project_scale CASCADE;
DROP TYPE IF EXISTS scene_type CASCADE;
DROP TYPE IF EXISTS transition_direction CASCADE;
DROP TYPE IF EXISTS layer_type CASCADE;
DROP TYPE IF EXISTS entity_status CASCADE;
DROP TYPE IF EXISTS media_type CASCADE;
DROP TYPE IF EXISTS media_purpose CASCADE;
DROP TYPE IF EXISTS topview_mode CASCADE;
DROP TYPE IF EXISTS currency_code CASCADE;

-- Drop funciones existentes
DROP FUNCTION IF EXISTS fn_layer_set_path CASCADE;
DROP FUNCTION IF EXISTS fn_invalidate_project_cache CASCADE;
DROP FUNCTION IF EXISTS fn_set_updated_at CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- PASO 2: CREAR ENUMS
-- ============================================================

CREATE TYPE project_type AS ENUM ('lots', 'building', 'masterplan');
CREATE TYPE project_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE project_scale AS ENUM ('small', 'medium', 'large');
CREATE TYPE scene_type AS ENUM ('landing', 'tour', 'zone');
CREATE TYPE transition_direction AS ENUM ('next', 'prev', 'top');
CREATE TYPE layer_type AS ENUM (
  'neighborhood',  -- barrio/loteo
  'block',         -- manzana
  'zone',          -- zona genérica
  'tower',         -- torre/edificio
  'floor',         -- piso
  'lot',           -- lote individual
  'unit',          -- unidad/departamento
  'tour'           -- tour 360
);
CREATE TYPE entity_status AS ENUM ('available', 'reserved', 'sold', 'not_available');
CREATE TYPE media_type AS ENUM ('image', 'video', 'svg', 'document');
CREATE TYPE media_purpose AS ENUM (
  'background',
  'background_mobile',
  'thumbnail',
  'gallery',
  'ficha_furnished',
  'ficha_measured',
  'overlay',
  'overlay_mobile',
  'transition',
  'intro',
  'brochure',
  'logo',
  'logo_developer',
  'hotspot',
  'layers_gallery',
  'exterior_360'
);
CREATE TYPE topview_mode AS ENUM ('single', 'multi');
CREATE TYPE currency_code AS ENUM ('USD', 'ARS', 'MXN');

-- ============================================================
-- PASO 3: CREAR TABLAS
-- ============================================================

-- 1. profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  type project_type NOT NULL,
  status project_status NOT NULL DEFAULT 'draft',
  scale project_scale NOT NULL DEFAULT 'small',
  max_depth INT NOT NULL DEFAULT 2,
  layer_labels JSONB DEFAULT '[]',

  -- Branding
  logo_url TEXT,
  secondary_logo_url TEXT,
  tagline TEXT,

  -- Contacto
  phone TEXT,
  email TEXT,
  whatsapp TEXT,
  website TEXT,

  -- Ubicación
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  coordinates JSONB,
  google_maps_embed_url TEXT,

  -- Feature toggles
  has_video_intro BOOLEAN DEFAULT false,
  has_gallery BOOLEAN DEFAULT false,
  has_360_tour BOOLEAN DEFAULT true,
  has_recorrido_360_embed BOOLEAN DEFAULT false,
  recorrido_360_embed_url TEXT,
  has_downloads BOOLEAN DEFAULT false,
  has_state_management BOOLEAN DEFAULT true,
  has_layers_gallery BOOLEAN DEFAULT false,
  has_zoom_in BOOLEAN DEFAULT false,
  hotspot_tower_id TEXT DEFAULT 'tower',
  hotspot_marker_id TEXT DEFAULT 'marker',
  tour_points_count INT DEFAULT 4,
  topview_mode topview_mode DEFAULT 'single',

  landing_scene_id UUID,

  -- Cache
  full_data_cache JSONB,
  cache_updated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. domains
CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hostname TEXT UNIQUE NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. scenes
CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type scene_type NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  image_url TEXT,
  image_mobile_url TEXT,
  hotspots_svg_url TEXT,
  sort_order INT DEFAULT 0,
  is_landing BOOLEAN DEFAULT false,
  layer_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(project_id, slug)
);

-- FK circular: projects.landing_scene_id → scenes
ALTER TABLE projects
  ADD CONSTRAINT fk_landing_scene
  FOREIGN KEY (landing_scene_id) REFERENCES scenes(id) ON DELETE SET NULL;

-- 5. scene_transitions
CREATE TABLE scene_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  to_scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  video_url TEXT,
  direction transition_direction NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(from_scene_id, to_scene_id)
);

-- 6. unit_types
CREATE TABLE unit_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  area NUMERIC,
  area_unit TEXT DEFAULT 'm2',
  bedrooms INT,
  bathrooms INT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(project_id, slug)
);

-- 7. layers
CREATE TABLE layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES layers(id) ON DELETE CASCADE,
  type layer_type NOT NULL,
  depth INT NOT NULL DEFAULT 0,
  sort_order INT DEFAULT 0,
  slug TEXT,
  name TEXT NOT NULL,
  label TEXT,

  -- Optimización: materialized path
  path TEXT,
  -- Optimización: nombre padre desnormalizado
  parent_name TEXT,

  -- Mapeo SVG
  svg_element_id TEXT,

  -- Assets visuales
  background_image_url TEXT,
  background_image_mobile_url TEXT,
  svg_overlay_url TEXT,
  svg_overlay_mobile_url TEXT,

  -- Estado
  status entity_status DEFAULT 'available',

  -- Dimensiones
  area NUMERIC,
  area_unit TEXT DEFAULT 'm2',
  front_length NUMERIC,
  depth_length NUMERIC,

  -- Pricing
  price NUMERIC,
  currency currency_code DEFAULT 'USD',
  price_per_unit NUMERIC,

  -- Características
  is_corner BOOLEAN DEFAULT false,
  features JSONB DEFAULT '[]',

  -- Unit type ref (edificios)
  unit_type_id UUID REFERENCES unit_types(id) ON DELETE SET NULL,

  -- Tour & video
  tour_embed_url TEXT,
  video_url TEXT,

  -- Info comprador
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  buyer_notes TEXT,
  reserved_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,

  -- Extra
  properties JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(project_id, slug)
);

-- FK: scenes.layer_id → layers
ALTER TABLE scenes
  ADD CONSTRAINT fk_scene_layer
  FOREIGN KEY (layer_id) REFERENCES layers(id) ON DELETE SET NULL;

-- 8. media
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  layer_id UUID REFERENCES layers(id) ON DELETE CASCADE,
  unit_type_id UUID REFERENCES unit_types(id) ON DELETE CASCADE,
  type media_type NOT NULL,
  purpose media_purpose NOT NULL,
  storage_path TEXT,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  alt_text TEXT,
  sort_order INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PASO 4: ÍNDICES
-- ============================================================

CREATE INDEX idx_layers_project ON layers(project_id);
CREATE INDEX idx_layers_parent ON layers(parent_id);
CREATE INDEX idx_layers_type ON layers(type);
CREATE INDEX idx_layers_status ON layers(status);
CREATE INDEX idx_layers_depth ON layers(project_id, depth);
CREATE INDEX idx_layers_path ON layers (path text_pattern_ops);
CREATE INDEX idx_layers_unit_type ON layers(unit_type_id);

CREATE INDEX idx_scenes_project ON scenes(project_id);
CREATE INDEX idx_scenes_layer ON scenes(layer_id);
CREATE INDEX idx_scene_transitions_from ON scene_transitions(from_scene_id);
CREATE INDEX idx_scene_transitions_to ON scene_transitions(to_scene_id);

CREATE INDEX idx_media_project ON media(project_id);
CREATE INDEX idx_media_layer ON media(layer_id);
CREATE INDEX idx_media_unit_type ON media(unit_type_id);
CREATE INDEX idx_media_purpose ON media(purpose);
CREATE INDEX idx_media_project_purpose ON media(project_id, purpose);
CREATE INDEX idx_media_layer_purpose ON media(layer_id, purpose);
CREATE INDEX idx_media_unit_type_purpose ON media(unit_type_id, purpose);

CREATE UNIQUE INDEX idx_domains_hostname ON domains(hostname);
CREATE UNIQUE INDEX idx_projects_slug ON projects(slug);

-- ============================================================
-- PASO 5: TRIGGERS
-- ============================================================

-- Auto-generar path y parent_name
CREATE OR REPLACE FUNCTION fn_layer_set_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path TEXT;
  parent_layer_name TEXT;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path := NEW.slug;
    NEW.parent_name := NULL;
  ELSE
    SELECT l.path, l.name INTO parent_path, parent_layer_name
    FROM layers l WHERE l.id = NEW.parent_id;

    NEW.path := parent_path || '/' || NEW.slug;
    NEW.parent_name := parent_layer_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_layer_set_path
  BEFORE INSERT OR UPDATE OF parent_id, slug ON layers
  FOR EACH ROW
  EXECUTE FUNCTION fn_layer_set_path();

-- Auto-actualizar updated_at
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_updated_projects BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_layers BEFORE UPDATE ON layers
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_scenes BEFORE UPDATE ON scenes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_unit_types BEFORE UPDATE ON unit_types
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- PASO 6: VIEWS
-- ============================================================

-- View para fichas (1 query = todo lo que necesita la ficha)
CREATE OR REPLACE VIEW v_layer_detail AS
SELECT
  l.id,
  l.project_id,
  l.parent_id,
  l.type,
  l.depth,
  l.sort_order,
  l.slug,
  l.name,
  l.label,
  l.path,
  l.parent_name,
  l.svg_element_id,
  l.background_image_url,
  l.background_image_mobile_url,
  l.svg_overlay_url,
  l.svg_overlay_mobile_url,
  l.status,
  COALESCE(l.area, ut.area) AS area,
  COALESCE(l.area_unit, ut.area_unit, 'm2') AS area_unit,
  l.front_length,
  l.depth_length,
  l.price,
  l.currency,
  l.price_per_unit,
  l.is_corner,
  l.features,
  l.unit_type_id,
  l.tour_embed_url,
  l.video_url,
  l.buyer_name,
  l.buyer_email,
  l.buyer_phone,
  l.buyer_notes,
  l.reserved_at,
  l.sold_at,
  l.properties,
  ut.name AS unit_type_name,
  ut.bedrooms,
  ut.bathrooms,
  ut.description AS unit_type_description,
  COALESCE(lm.media_items, '[]'::jsonb) AS layer_media,
  COALESCE(utm.media_items, '[]'::jsonb) AS unit_type_media
FROM layers l
LEFT JOIN unit_types ut ON l.unit_type_id = ut.id
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', m.id, 'type', m.type, 'purpose', m.purpose,
      'url', m.url, 'title', m.title, 'sort_order', m.sort_order
    ) ORDER BY m.sort_order
  ) AS media_items
  FROM media m WHERE m.layer_id = l.id
) lm ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', m.id, 'type', m.type, 'purpose', m.purpose,
      'url', m.url, 'title', m.title, 'sort_order', m.sort_order
    ) ORDER BY m.sort_order
  ) AS media_items
  FROM media m WHERE m.unit_type_id = l.unit_type_id
) utm ON l.unit_type_id IS NOT NULL;

-- ============================================================
-- PASO 7: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Lectura pública
CREATE POLICY "Public read active projects" ON projects
  FOR SELECT USING (status = 'active');
CREATE POLICY "Public read domains" ON domains
  FOR SELECT USING (true);
CREATE POLICY "Public read scenes" ON scenes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.status = 'active')
  );
CREATE POLICY "Public read transitions" ON scene_transitions
  FOR SELECT USING (true);
CREATE POLICY "Public read unit_types" ON unit_types
  FOR SELECT USING (true);
CREATE POLICY "Public read layers" ON layers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.status = 'active')
  );
CREATE POLICY "Public read media" ON media
  FOR SELECT USING (true);

-- Escritura admin
CREATE POLICY "Admin full access profiles" ON profiles
  FOR ALL USING (auth.uid() = id);
CREATE POLICY "Admin write projects" ON projects
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin write domains" ON domains
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin write scenes" ON scenes
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin write transitions" ON scene_transitions
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin write unit_types" ON unit_types
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin write layers" ON layers
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin write media" ON media
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Realtime solo en layers para updates de status
ALTER PUBLICATION supabase_realtime ADD TABLE layers;

