# Explorador Inmobiliario

Aplicacion Next.js para navegacion interactiva de proyectos inmobiliarios (loteos y edificios) con mapas SVG clickeables y profundidad variable de exploracion.

## Stack

- **Next.js 16** (App Router, Server Components, Static Generation)
- **React 19** (Client Components para interactividad SVG)
- **TypeScript 5** (strict mode)
- **Tailwind CSS 4** (via PostCSS)
- **Supabase** (PostgreSQL + Storage para imagenes y videos)

## Setup

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

```bash
cp .env.local.example .env.local
# Editar .env.local con tus credenciales de Supabase
```

Variables requeridas:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

### 3. Crear esquema de base de datos

Ejecutar [`SETUP_SCHEMA_V2.sql`](./SETUP_SCHEMA_V2.sql) en el SQL Editor de Supabase.

### 4. Poblar con datos de ejemplo

```bash
npm run db:seed            # Crea el proyecto Aurora con torres, pisos y unidades
npm run db:upload-media    # Sube imagenes y videos al Storage de Supabase
```

### 5. Iniciar servidor de desarrollo

```bash
npm run dev
```

Ver [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) para la guia completa de configuracion.

## Scripts

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (puerto 3000) |
| `npm run build` | Build de produccion con SSG |
| `npm run lint` | ESLint |
| `npm run db:seed` | Poblar DB con proyecto Aurora |
| `npm run db:upload-media` | Subir media de Aurora al Storage |

## Arquitectura

### Esquema de base de datos

Tres tablas con relaciones simples:

```
projects
  └── layers (self-referencing via parent_id, depth 0-3)
        └── media (imagenes y videos por capa)
```

- **projects**: slug, name, type (`subdivision` | `building`), layer_labels, svg_path
- **layers**: parent_id (jerarquia), depth, sort_order, svg_element_id, status, properties (JSONB)
- **media**: type (`image` | `video`), purpose (`cover` | `gallery` | `exploration` | `transition` | `thumbnail` | `floor_plan`)

`layer.properties` almacena campos especificos por tipo — area, precio, dormitorios, orientacion, etc.

### Jerarquia de exploracion

El sistema soporta hasta 4 niveles de profundidad, configurables por proyecto:

```
Edificio (project)                    Loteo (project)
  └── Torre A, Torre B (depth=0)        └── Zona A, Zona B (depth=0)
        └── Piso 1-4 (depth=1)               └── Manzana 1-3 (depth=1)
              └── Unidades (depth=2)                └── Lotes (depth=2)
```

Cada proyecto define sus etiquetas por nivel via `layer_labels` — por ejemplo `["Torre", "Piso", "Departamento"]`.

### Flujo de datos

```
page.tsx (Server Component)
  → repository.ts (queries Supabase)
    → transform.ts (rows → typed hierarchy)
      → ExplorerView.tsx (Client Component, renders SVG map)
```

1. Las paginas son **Server Components** que consultan Supabase
2. `buildExplorerPageData()` recibe todos los layers y media del proyecto y filtra por la ruta actual
3. Los datos tipados se pasan como props a **Client Components** para interactividad

Para `generateStaticParams` (build time) se usa `repository-admin.ts` con `SUPABASE_SERVICE_ROLE_KEY`, ya que no hay cookies disponibles durante el build.

### Cambio de nivel client-side

Los niveles hermanos (ej: Piso 1, Piso 2) se cambian sin recarga de pagina:

1. El servidor envia un `SiblingExplorerBundle` con datos de **todos** los pisos hermanos en una sola consulta a la DB
2. `buildSiblingExplorerBundle()` llama a `buildExplorerPageData()` una vez por hermano — es puro filtrado en memoria, sin queries adicionales
3. `ExplorerView` trackea el piso activo via `activeLayerId` en estado local
4. Al seleccionar otro piso, se swappea la data del bundle y se actualiza la URL con `window.history.replaceState()`
5. Los SVGs e imagenes de fondo se precargan en el cache del browser al montar el componente

### SVG interactivo

`InteractiveSVG.tsx` carga un archivo SVG via `fetch()`, lo inyecta en el DOM, y agrega interactividad:

- Colorea cada elemento segun su status (available=verde, reserved=amarillo, sold=rojo)
- Agrega hover effects, labels con fondo oscuro, e indicadores de status
- Inyecta una imagen de fondo dentro del SVG (mismo sistema de coordenadas)
- Los elementos no-interactivos se hacen semi-transparentes
- Soporta navegacion por teclado (Tab, Enter, Space)

Los archivos SVG deben tener IDs de elemento que coincidan con `layer.svg_element_id` o `layer.slug`.

## Rutas

| Ruta | Vista | Componente |
|------|-------|------------|
| `/` | Listado de proyectos | `app/page.tsx` |
| `/p/[projectSlug]` | Home del proyecto (360, videos aereos) | `ProjectHomePage` |
| `/p/[projectSlug]/[...layers]` | Exploracion por capas | `ExplorerView` o `UnitPage` |
| `/admin` | Panel de administracion | `app/admin/page.tsx` |
| `/admin/login` | Login de admin | `app/admin/login/page.tsx` |

La ruta `[...layers]` es catch-all — soporta profundidad variable (`/torre-a`, `/torre-a/piso-1`, `/torre-a/piso-1/unidad-101`).

Cuando una capa no tiene hijos (leaf), se renderiza `UnitPage` con galeria de fotos y detalles.

## Estructura del Proyecto

```
app/
  layout.tsx                              Root layout (lang="es", dark theme)
  page.tsx                                Listado de proyectos
  globals.css                             Glass-morphism + theme variables
  error.tsx                               Error boundary
  not-found.tsx                           Pagina 404
  p/[projectSlug]/
    page.tsx                              Home del proyecto (360 viewer)
    [...layers]/
      page.tsx                            Exploracion por capas / detalle unidad
  admin/
    layout.tsx                            Layout admin (light theme)
    page.tsx                              Panel de administracion
    login/page.tsx                        Login

components/
  svg/
    InteractiveSVG.tsx                    Carga SVG, aplica colores y eventos via DOM
  views/
    ExplorerView.tsx                      Vista de exploracion con mapa SVG interactivo
    UnitPage.tsx                          Detalle de unidad/lote con galeria
    ProjectHomePage.tsx                   Home del proyecto (exterior 360, videos)
    Gallery.tsx                           Galeria de imagenes
  navigation/
    Breadcrumb.tsx                        Navegacion breadcrumb
    SiblingNavigator.tsx                  Sidebar para cambiar entre pisos/niveles
  video/
    Spin360Viewer.tsx                     Visor 360 del exterior
    AerialVideoGallery.tsx               Galeria de videos aereos
    VideoPlayer.tsx                       Reproductor de video

lib/
  data/
    repository.ts                        Queries Supabase (server client, cookies)
    repository-admin.ts                  Queries Supabase (admin client, sin cookies)
    transform.ts                         Rows de DB → jerarquia tipada + sibling bundle
  constants/
    status.ts                            Labels, clases CSS y colores por status
  styles/
    button.ts                            Estilos de botones reutilizables
  supabase/
    server.ts                            Cliente Supabase para Server Components
    admin.ts                             Cliente Supabase con service role key
    client.ts                            Cliente Supabase para Client Components
    auth.ts                              Helpers de autenticacion
  actions/
    auth.ts                              Server actions de autenticacion

types/
  hierarchy.types.ts                     Project, Layer, Media, ExplorerPageData,
                                         SiblingExplorerBundle, BreadcrumbItem

scripts/supabase/
  seed-aurora.ts                         Seed del proyecto Aurora (edificio)
  upload-aurora-media.ts                 Upload de media de Aurora

public/svgs/                             Archivos SVG interactivos por proyecto
```

## Tema visual

La aplicacion usa un tema oscuro inmersivo con glass-morphism:

- **Fondo negro** (`bg-black`) con overlays de vidrio translucido
- `.glass-panel` — `background: rgba(0,0,0,0.6)` + `backdrop-filter: blur(16px)` + borde sutil blanco
- Los overlays de UI flotan sobre el mapa SVG (breadcrumb, leyenda, botones)
- Las paginas de admin overriden con `text-gray-900` para tema claro
- Labels en SVG usan fondo oscuro (`rgba(0,0,0,0.7)`) con texto blanco

## Tipos principales

```typescript
// Status de una entidad
type EntityStatus = 'available' | 'reserved' | 'sold' | 'not_available';

// Datos que reciben las vistas
interface ExplorerPageData {
  project: Project;
  currentLayer: Layer | null;           // null = raiz del proyecto
  children: Layer[];                    // hijos del layer actual
  media: Media[];                       // media del layer actual
  childrenMedia: Record<string, Media[]>;
  breadcrumbs: BreadcrumbItem[];
  isLeafLevel: boolean;
  currentPath: string[];                // slugs hasta la posicion actual
  siblings: Layer[];                    // hermanos (mismo parent)
}

// Bundle para cambio de nivel client-side
interface SiblingExplorerBundle {
  current: ExplorerPageData;
  siblingDataMap: Record<string, ExplorerPageData>;  // layerId → data
  siblingOrder: string[];                            // IDs ordenados
}
```

## Convenciones

- **Idioma**: UI en espanol, codigo en ingles
- **SVG IDs**: cada elemento interactivo necesita un ID que coincida con `svg_element_id` o `slug` del layer
- **Status colors**: verde (available), amarillo (reserved), rojo (sold) — definidos en `lib/constants/status.ts`
- **Supabase clients**: `server.ts` para runtime (con cookies), `admin.ts` para build time (service role key)
- **Botones**: `outline-none` en todos los botones interactivos para evitar el anillo de foco del browser
