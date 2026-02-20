'use client';

import { slugify } from '@/lib/utils/slugify';
import { useState } from 'react';

interface ProjectData {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  type?: string;
  status?: string;
  scale?: string;
  max_depth?: number;
  layer_labels?: string[];
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  coordinates?: { lat: number; lng: number } | null;
  google_maps_embed_url?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  website?: string;
  has_video_intro?: boolean;
  has_gallery?: boolean;
  has_360_tour?: boolean;
  has_recorrido_360_embed?: boolean;
  recorrido_360_embed_url?: string;
  has_downloads?: boolean;
  has_state_management?: boolean;
  has_layers_gallery?: boolean;
  has_zoom_in?: boolean;
  hotspot_tower_id?: string;
  hotspot_marker_id?: string;
}

interface Props {
  project?: ProjectData;
  action: (formData: FormData) => Promise<void>;
  isEdit?: boolean;
}

export default function ProjectForm({ project, action, isEdit }: Props) {
  const [nameVal, setNameVal] = useState(project?.name ?? '');
  const [slugVal, setSlugVal] = useState(project?.slug ?? '');
  const [autoSlug, setAutoSlug] = useState(!isEdit);

  function handleNameChange(name: string) {
    setNameVal(name);
    if (autoSlug) setSlugVal(slugify(name));
  }

  function handleSlugChange(slug: string) {
    setSlugVal(slug);
    setAutoSlug(false);
  }

  const lat = project?.coordinates?.lat;
  const lng = project?.coordinates?.lng;

  return (
    <form action={action} className="space-y-8 max-w-3xl">
      {/* Básico */}
      <Section
        title="Datos Basicos"
        description="Nombre, tipo y estado del proyecto. El slug se usa en la URL publica (/p/slug)."
      >
        <Field label="Nombre" required>
          <input
            name="name"
            value={nameVal}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Slug" hint="Identificador en la URL. Se genera automaticamente del nombre.">
          <input
            name="slug"
            value={slugVal}
            onChange={(e) => handleSlugChange(e.target.value)}
            className={inputClass}
            placeholder="auto-generado"
          />
        </Field>
        <Field label="Descripcion">
          <textarea
            name="description"
            defaultValue={project?.description ?? ''}
            rows={3}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Tipo" required hint="Loteo = lotes, Edificio = pisos/deptos, Masterplan = mixto">
            <select name="type" defaultValue={project?.type ?? 'lots'} className={inputClass} required>
              <option value="lots">Loteo</option>
              <option value="building">Edificio</option>
              <option value="masterplan">Masterplan</option>
            </select>
          </Field>
          <Field label="Estado" hint="Solo los proyectos 'Activo' son visibles al publico">
            <select name="status" defaultValue={project?.status ?? 'draft'} className={inputClass}>
              <option value="draft">Borrador</option>
              <option value="active">Activo</option>
              <option value="archived">Archivado</option>
            </select>
          </Field>
          <Field label="Escala">
            <select name="scale" defaultValue={project?.scale ?? 'small'} className={inputClass}>
              <option value="small">Chico</option>
              <option value="medium">Mediano</option>
              <option value="large">Grande</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* Configuración */}
      <Section
        title="Configuracion"
        description="Define la estructura de capas del proyecto. La profundidad indica cuantos niveles tiene el arbol (ej: Zona > Manzana > Lote = 3). Los labels son los nombres que se muestran en la navegacion para cada nivel."
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Profundidad maxima" hint="Cantidad de niveles en el arbol de capas (sin contar el Tour)">
            <input
              name="max_depth"
              type="number"
              min={1}
              max={10}
              defaultValue={project?.max_depth ?? 2}
              className={inputClass}
            />
          </Field>
          <Field label="Labels de capas (separados por coma)" hint="Ej: Zona, Manzana, Lote">
            <input
              name="layer_labels"
              defaultValue={project?.layer_labels?.join(', ') ?? ''}
              placeholder="Zona, Manzana, Lote"
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      {/* Ubicación */}
      <Section
        title="Ubicacion"
        description="Datos de ubicacion del proyecto. La URL de Google Maps embed se usa para mostrar el mapa interactivo en la pagina publica."
      >
        <Field label="Direccion">
          <input name="address" defaultValue={project?.address ?? ''} className={inputClass} />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Ciudad">
            <input name="city" defaultValue={project?.city ?? ''} className={inputClass} />
          </Field>
          <Field label="Provincia / Estado">
            <input name="state" defaultValue={project?.state ?? ''} className={inputClass} />
          </Field>
          <Field label="Pais">
            <input name="country" defaultValue={project?.country ?? 'Argentina'} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Latitud">
            <input
              name="lat"
              type="number"
              step="any"
              defaultValue={lat != null ? lat : ''}
              className={inputClass}
              placeholder="-33.7456"
            />
          </Field>
          <Field label="Longitud">
            <input
              name="lng"
              type="number"
              step="any"
              defaultValue={lng != null ? lng : ''}
              className={inputClass}
              placeholder="-61.9692"
            />
          </Field>
        </div>
        <Field label="Google Maps Embed URL">
          <input
            name="google_maps_embed_url"
            defaultValue={project?.google_maps_embed_url ?? ''}
            className={inputClass}
            placeholder="https://www.google.com/maps/embed?..."
          />
        </Field>
      </Section>

      {/* Contacto */}
      <Section
        title="Contacto"
        description="Informacion de contacto que se muestra al usuario en la pagina publica del proyecto."
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Telefono" hint="Si hay varios, separarlos con ' / '. Ej: 3462-334848 / 3462-336552">
            <input
              name="phone"
              defaultValue={project?.phone ?? ''}
              className={inputClass}
              placeholder="3462-334848 / 3462-336552"
            />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={project?.email ?? ''} className={inputClass} />
          </Field>
          <Field label="WhatsApp" hint="Numero completo con codigo de pais, sin espacios">
            <input name="whatsapp" defaultValue={project?.whatsapp ?? ''} className={inputClass} placeholder="+5493462334848" />
          </Field>
          <Field label="Website">
            <input name="website" defaultValue={project?.website ?? ''} className={inputClass} placeholder="www.ejemplo.com" />
          </Field>
        </div>
      </Section>

      {/* Feature Toggles */}
      <Section
        title="Funcionalidades"
        description="Activa o desactiva secciones de la pagina publica del proyecto. Solo se muestran al usuario final las funcionalidades que esten activadas."
      >
        <div className="grid grid-cols-2 gap-3">
          <Toggle name="has_360_tour" label="Tour 360" description="Recorrido interactivo con imagenes panoramicas" defaultChecked={project?.has_360_tour ?? true} />
          <Toggle name="has_video_intro" label="Video intro" description="Video de presentacion al entrar al proyecto" defaultChecked={project?.has_video_intro} />
          <Toggle name="has_gallery" label="Galeria" description="Galeria de fotos/renders del proyecto" defaultChecked={project?.has_gallery} />
          <Toggle name="has_downloads" label="Descargas" description="Seccion para descargar brochures/PDFs" defaultChecked={project?.has_downloads} />
          <Toggle name="has_state_management" label="Estado de lotes" description="Mostrar disponible/reservado/vendido en el mapa" defaultChecked={project?.has_state_management ?? true} />
          <Toggle name="has_layers_gallery" label="Galeria de layers" description="Galeria de imagenes por cada capa" defaultChecked={project?.has_layers_gallery} />
          <Toggle name="has_zoom_in" label="Zoom In" description="Permitir zoom en el mapa SVG" defaultChecked={project?.has_zoom_in} />
          <Toggle name="has_recorrido_360_embed" label="Recorrido 360 embed" description="Embed externo de recorrido 360 (Matterport, etc)" defaultChecked={project?.has_recorrido_360_embed} />
        </div>
        <Field label="URL Recorrido 360 embed" hint="Solo si 'Recorrido 360 embed' esta activado">
          <input
            name="recorrido_360_embed_url"
            defaultValue={project?.recorrido_360_embed_url ?? ''}
            className={inputClass}
          />
        </Field>
      </Section>

      {/* SVG Config */}
      <Section
        title="SVG Config"
        description="IDs de elementos dentro de los archivos SVG interactivos. Se usan para identificar que partes del SVG son clickeables (ej: la torre en el tour, o los marcadores de lotes)."
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Hotspot Tower ID" hint="ID del grupo SVG que representa la torre/edificio en el tour">
            <input
              name="hotspot_tower_id"
              defaultValue={project?.hotspot_tower_id ?? 'tower'}
              className={inputClass}
            />
          </Field>
          <Field label="Hotspot Marker ID" hint="ID del grupo SVG que representa los marcadores/puntos del tour">
            <input
              name="hotspot_marker_id"
              defaultValue={project?.hotspot_marker_id ?? 'marker'}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {isEdit ? 'Guardar cambios' : 'Crear proyecto'}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// Sub-components
// ============================================================

const inputClass =
  'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none';

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <div>
        <legend className="text-base font-semibold text-gray-900">{title}</legend>
        {description && (
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        )}
      </div>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {hint && <span className="block text-xs text-gray-400 mb-1">{hint}</span>}
      {children}
    </label>
  );
}

function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
      />
      <div>
        <span className="font-medium">{label}</span>
        {description && <p className="text-xs text-gray-400">{description}</p>}
      </div>
    </label>
  );
}
