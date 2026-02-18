# Configuracion de Supabase

## Pre-requisitos

- Cuenta de Supabase (crear en https://supabase.com)
- Node.js 18+

## 1. Crear Proyecto en Supabase

1. Ve a https://app.supabase.com
2. Click en "New Project"
3. Completa nombre, password y region
4. Espera a que se cree (~2 minutos)

## 2. Obtener Credenciales

1. Ve a **Project Settings** > **API**
2. Copia:
   - **Project URL** -> `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** -> `SUPABASE_SERVICE_ROLE_KEY`

## 3. Configurar Variables de Entorno

```bash
cp .env.local.example .env.local
```

Edita `.env.local` con tus credenciales:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

## 4. Crear Esquema de Base de Datos

1. Ve al **SQL Editor** en Supabase
2. Pega el contenido de [`SETUP_SCHEMA_V2.sql`](./SETUP_SCHEMA_V2.sql)
3. Click en **Run**

Esto crea:

- 3 tablas: `projects`, `layers`, `media`
- Indices para performance
- Triggers para `updated_at`
- Row Level Security con lectura publica

## 5. Poblar la Base de Datos

```bash
npm run db:seed
```

Resultado esperado:

```
Projects: 1
Layers: ~30 (torres, pisos, unidades)
Media: variable
```

## 6. Configurar Supabase Storage (imagenes)

Las imagenes de fondo y fotos se sirven desde Supabase Storage.

1. Ve a **Storage** en el dashboard de Supabase
2. Crea un bucket llamado `images`
3. Marcalo como **Public**
4. Usa los scripts para subir imagenes:

```bash
npm run db:upload-images       # Galeria de unidades
npm run db:upload-backgrounds  # Fondos de exploracion
```

## 7. Verificar

```bash
npm run dev
```

Abrir http://localhost:3000 y verificar:

- Listado de proyectos en la pagina principal
- Click en proyecto muestra SVG interactivo con capas clickeables
- Navegacion por capas hasta llegar a unidades/lotes
- Imagenes de fondo detras de los SVGs
- Galeria de fotos en paginas de detalle

## Estructura de Datos

### projects

| slug | name | type | status |
|------|------|------|--------|
| edificio-central | Edificio Central | building | available |

### layers (jerarquia variable, hasta 4 niveles)

| slug | name | depth | parent |
|------|------|-------|--------|
| torre-a | Torre A | 0 | (root) |
| piso-1 | Piso 1 | 1 | Torre A |
| unidad-101 | Unidad 101 | 2 | Piso 1 |

### media

| purpose | type | layer |
|---------|------|-------|
| exploration | image | Torre A |
| gallery | image | Unidad 101 |
| cover | image | Unidad 101 |

## Seguridad (RLS)

- Lectura publica: cualquiera puede ver proyectos, capas y media
- Escritura restringida: solo `service_role` key puede modificar datos

## Troubleshooting

### Error: "Missing Supabase credentials"
Verificar que `.env.local` tenga las 3 variables. Reiniciar el servidor.

### Error: "relation 'projects' does not exist"
Ejecutar `SETUP_SCHEMA_V2.sql` en el SQL Editor de Supabase.

### Error TLS en WSL2
El script `dev` ya incluye `NODE_TLS_REJECT_UNAUTHORIZED=0`. Si otros scripts fallan, agregar el mismo prefijo.

### Imagenes no se ven
1. Verificar que el bucket `images` sea publico
2. Verificar que los archivos existan en Storage con la estructura correcta
3. Verificar que las URLs en la tabla `media` sean correctas
