'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { createUnitType, updateUnitType, deleteUnitType, uploadMedia, deleteMedia } from '@/lib/actions/admin';
import { slugify } from '@/lib/utils/slugify';
import MediaUploadSlot from '@/components/admin/MediaUploadSlot';

interface UnitType {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  area: number | null;
  area_unit: string;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
}

interface MediaRow {
  id: string;
  unit_type_id: string | null;
  purpose: string;
  url: string;
  storage_path: string;
}

interface Props {
  projectId: string;
  projectSlug: string;
  unitTypes: UnitType[];
  media: MediaRow[];
}

export default function UnitTypesClient({ projectId, projectSlug, unitTypes, media }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState<UnitType | null>(null);

  function handleAdd() {
    setEditingType(null);
    setShowForm(true);
  }

  function handleEdit(ut: UnitType) {
    setEditingType(ut);
    setShowForm(true);
  }

  async function handleDelete(ut: UnitType) {
    if (!confirm(`Eliminar tipo "${ut.name}"? Las unidades que lo usen quedarán sin tipo asignado.`)) return;
    await deleteUnitType(ut.id, projectId);
  }

  function getMediaForType(unitTypeId: string, purpose: string): MediaRow | undefined {
    return media.find((m) => m.unit_type_id === unitTypeId && m.purpose === purpose);
  }

  async function handleMediaUpload(unitTypeId: string, purpose: string, storagePath: string, file: File) {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('project_id', projectId);
    formData.set('unit_type_id', unitTypeId);
    formData.set('purpose', purpose);
    formData.set('type', 'image');
    formData.set('storage_path', storagePath);
    await uploadMedia(formData);
  }

  async function handleMediaDelete(mediaRow: MediaRow) {
    await deleteMedia(mediaRow.id, projectId);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tipos de Unidad</h1>
          <p className="text-sm text-gray-500 mt-1">
            Templates de unidades (ej: 2 Amb 80m², 3 Amb 106m²). Cada unidad en Layers puede referenciar un tipo.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nuevo tipo
        </button>
      </div>

      {unitTypes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No hay tipos de unidad. Crea el primero para asignarlo a las unidades del edificio.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {unitTypes.map((ut) => {
            const fichaMeasured = getMediaForType(ut.id, 'ficha_measured');
            const fichaFurnished = getMediaForType(ut.id, 'ficha_furnished');

            return (
              <div key={ut.id} className="border border-gray-200 rounded-lg bg-white p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{ut.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{ut.slug}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(ut)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(ut)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-3">
                  {ut.area && (
                    <span>{ut.area} {ut.area_unit}</span>
                  )}
                  {ut.bedrooms != null && (
                    <span>{ut.bedrooms} dorm.</span>
                  )}
                  {ut.bathrooms != null && (
                    <span>{ut.bathrooms} bano(s)</span>
                  )}
                </div>

                {ut.description && (
                  <p className="text-sm text-gray-500 mb-3">{ut.description}</p>
                )}

                {/* Media slots: fichas */}
                <div className="grid grid-cols-2 gap-3">
                  <MediaUploadSlot
                    label="Ficha Acotada"
                    currentUrl={fichaMeasured?.url ?? null}
                    accept="image/*"
                    onUpload={(file) =>
                      handleMediaUpload(
                        ut.id,
                        'ficha_measured',
                        `${projectSlug}/unit-types/${ut.slug}/ficha-measured.webp`,
                        file
                      )
                    }
                    onDelete={fichaMeasured ? () => handleMediaDelete(fichaMeasured) : undefined}
                  />
                  <MediaUploadSlot
                    label="Ficha Amoblada"
                    currentUrl={fichaFurnished?.url ?? null}
                    accept="image/*"
                    onUpload={(file) =>
                      handleMediaUpload(
                        ut.id,
                        'ficha_furnished',
                        `${projectSlug}/unit-types/${ut.slug}/ficha-furnished.webp`,
                        file
                      )
                    }
                    onDelete={fichaFurnished ? () => handleMediaDelete(fichaFurnished) : undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <UnitTypeFormModal
          projectId={projectId}
          unitType={editingType}
          onClose={() => { setShowForm(false); setEditingType(null); }}
        />
      )}
    </div>
  );
}

function UnitTypeFormModal({
  projectId,
  unitType,
  onClose,
}: {
  projectId: string;
  unitType: UnitType | null;
  onClose: () => void;
}) {
  const isEdit = !!unitType;
  const [nameVal, setNameVal] = useState(unitType?.name ?? '');
  const [slugVal, setSlugVal] = useState(unitType?.slug ?? '');
  const [autoSlug, setAutoSlug] = useState(!isEdit);

  function handleNameChange(name: string) {
    setNameVal(name);
    if (autoSlug) setSlugVal(slugify(name));
  }

  async function handleSubmit(formData: FormData) {
    formData.set('project_id', projectId);
    if (isEdit && unitType) {
      await updateUnitType(unitType.id, formData);
    } else {
      await createUnitType(formData);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {isEdit ? `Editar: ${unitType.name}` : 'Nuevo Tipo de Unidad'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form action={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Nombre *</span>
              <input
                name="name"
                value={nameVal}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                className={inputClass}
                placeholder="2 Ambientes 80m²"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Slug</span>
              <input
                name="slug"
                value={slugVal}
                onChange={(e) => { setSlugVal(e.target.value); setAutoSlug(false); }}
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Area</span>
              <input
                name="area"
                type="number"
                step="any"
                defaultValue={unitType?.area ?? ''}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Unidad</span>
              <select
                name="area_unit"
                defaultValue={unitType?.area_unit ?? 'm2'}
                className={inputClass}
              >
                <option value="m2">m²</option>
                <option value="ft2">ft²</option>
              </select>
            </label>
            <div />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Dormitorios</span>
              <input
                name="bedrooms"
                type="number"
                defaultValue={unitType?.bedrooms ?? ''}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Banos</span>
              <input
                name="bathrooms"
                type="number"
                defaultValue={unitType?.bathrooms ?? ''}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Descripcion</span>
            <textarea
              name="description"
              rows={3}
              defaultValue={unitType?.description ?? ''}
              className={inputClass}
              placeholder="Descripcion del tipo de unidad..."
            />
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-500 font-medium"
            >
              {isEdit ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none';
