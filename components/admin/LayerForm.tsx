'use client';

import { useState, useEffect } from 'react';
import { createLayer, updateLayer } from '@/lib/actions/admin';
import { slugify } from '@/lib/utils/slugify';
import { X } from 'lucide-react';
import { FEATURE_ICON_MAP } from '@/lib/constants/feature-icons';
import type { LayerNode } from './LayerTree';

interface UnitTypeOption {
  id: string;
  name: string;
}

interface Props {
  projectId: string;
  parentId: string | null;
  layer?: LayerNode | null;
  unitTypes?: UnitTypeOption[];
  onClose: () => void;
}

interface FeatureItem {
  icon: string;
  text: string;
}

export default function LayerForm({ projectId, parentId, layer, unitTypes = [], onClose }: Props) {
  const isEdit = !!layer;
  const [nameVal, setNameVal] = useState(layer?.name ?? '');
  const [slugVal, setSlugVal] = useState(layer?.slug ?? '');
  const [autoSlug, setAutoSlug] = useState(!isEdit);
  const [type, setType] = useState(layer?.type ?? 'zone');
  const [features, setFeatures] = useState<FeatureItem[]>([]);

  useEffect(() => {
    if (layer?.features && Array.isArray(layer.features)) {
      setFeatures(layer.features as FeatureItem[]);
    } else {
      setFeatures([]);
    }
  }, [layer]);

  const isLot = type === 'lot' || type === 'unit';
  const iconNames = Object.keys(FEATURE_ICON_MAP);

  function handleNameChange(name: string) {
    setNameVal(name);
    if (autoSlug) setSlugVal(slugify(name));
  }

  async function handleSubmit(formData: FormData) {
    formData.set('project_id', projectId);
    if (parentId && !isEdit) formData.set('parent_id', parentId);
    if (features.length > 0) {
      formData.set('features', JSON.stringify(features));
    }

    if (isEdit && layer) {
      await updateLayer(layer.id, formData);
    } else {
      await createLayer(formData);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {isEdit ? `Editar: ${layer.name}` : 'Nueva capa'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form action={handleSubmit} className="p-6 space-y-4">
          <input type="hidden" name="project_id" value={projectId} />

          {/* Common fields */}
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Nombre *</span>
              <input
                name="name"
                value={nameVal}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                className={inputClass}
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

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Label</span>
              <input
                name="label"
                defaultValue={layer?.label ?? ''}
                className={inputClass}
                placeholder="Texto corto para SVG"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Tipo *</span>
              <select
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={inputClass}
              >
                <option value="neighborhood">Barrio</option>
                <option value="zone">Zona</option>
                <option value="block">Manzana</option>
                <option value="tower">Torre</option>
                <option value="floor">Piso</option>
                <option value="lot">Lote</option>
                <option value="unit">Unidad</option>
                <option value="tour">Tour</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">SVG Element ID</span>
              <input
                name="svg_element_id"
                defaultValue={layer?.svg_element_id ?? ''}
                className={inputClass}
                placeholder="_01, zona-a, etc."
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Estado</span>
              <select
                name="status"
                defaultValue={layer?.status ?? 'available'}
                className={inputClass}
              >
                <option value="available">Disponible</option>
                <option value="reserved">Reservado</option>
                <option value="sold">Vendido</option>
                <option value="not_available">No disponible</option>
              </select>
            </label>
          </div>

          {/* Lot/Unit specific fields */}
          {isLot && (
            <>
              <div className="pt-2 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Dimensiones y Precio</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">Área</span>
                  <input
                    name="area"
                    type="number"
                    step="any"
                    defaultValue={layer?.area ?? ''}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">Frente (m)</span>
                  <input
                    name="front_length"
                    type="number"
                    step="any"
                    defaultValue={layer?.front_length ?? ''}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">Fondo (m)</span>
                  <input
                    name="depth_length"
                    type="number"
                    step="any"
                    defaultValue={layer?.depth_length ?? ''}
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">Precio</span>
                  <input
                    name="price"
                    type="number"
                    step="any"
                    defaultValue={layer?.price ?? ''}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">Moneda</span>
                  <select
                    name="currency"
                    defaultValue={layer?.currency ?? 'USD'}
                    className={inputClass}
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                    <option value="MXN">MXN</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">Precio/m²</span>
                  <input
                    name="price_per_unit"
                    type="number"
                    step="any"
                    defaultValue={''}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="is_corner"
                  defaultChecked={layer?.is_corner ?? false}
                  className="rounded border-gray-300"
                />
                Lote esquina
              </label>

              {/* Building unit fields (visible for type=unit) */}
              {type === 'unit' && (
                <>
                  <div className="pt-2 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Datos del departamento</h3>
                  </div>

                  {unitTypes.length > 0 && (
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1">Tipo de Unidad</span>
                      <select
                        name="unit_type_id"
                        defaultValue={layer?.unit_type_id ?? ''}
                        className={inputClass}
                      >
                        <option value="">— Sin tipo —</option>
                        {unitTypes.map((ut) => (
                          <option key={ut.id} value={ut.id}>{ut.name}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1">Orientación</span>
                      <select
                        name="orientation"
                        defaultValue={(layer?.properties?.orientation as string) ?? ''}
                        className={inputClass}
                      >
                        <option value="">— Sin orientación —</option>
                        <option value="Norte">Norte</option>
                        <option value="Sur">Sur</option>
                        <option value="Este">Este</option>
                        <option value="Oeste">Oeste</option>
                        <option value="Noreste">Noreste</option>
                        <option value="Noroeste">Noroeste</option>
                        <option value="Sudeste">Sudeste</option>
                        <option value="Sudoeste">Sudoeste</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1">Piso</span>
                      <input
                        name="floor_number"
                        type="number"
                        defaultValue={(layer?.properties?.floor_number as number) ?? ''}
                        className={inputClass}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1">Dormitorios</span>
                      <input
                        name="bedrooms"
                        type="number"
                        defaultValue={(layer?.properties?.bedrooms as number) ?? ''}
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1">Baños</span>
                      <input
                        name="bathrooms"
                        type="number"
                        defaultValue={(layer?.properties?.bathrooms as number) ?? ''}
                        className={inputClass}
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      name="has_balcony"
                      defaultChecked={(layer?.properties?.has_balcony as boolean) ?? false}
                      className="rounded border-gray-300"
                    />
                    Tiene balcón
                  </label>

                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1">Descripción</span>
                    <textarea
                      name="description"
                      rows={2}
                      defaultValue={(layer?.properties?.description as string) ?? ''}
                      className={inputClass}
                    />
                  </label>
                </>
              )}

              {/* Features mini-editor */}
              <div className="pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">Features</h3>
                  <button
                    type="button"
                    onClick={() => setFeatures([...features, { icon: 'flame', text: '' }])}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    + Agregar
                  </button>
                </div>
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <select
                      value={f.icon}
                      onChange={(e) => {
                        const updated = [...features];
                        updated[i] = { ...f, icon: e.target.value };
                        setFeatures(updated);
                      }}
                      className="w-32 rounded border border-gray-300 text-sm px-2 py-1"
                    >
                      {iconNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <input
                      value={f.text}
                      onChange={(e) => {
                        const updated = [...features];
                        updated[i] = { ...f, text: e.target.value };
                        setFeatures(updated);
                      }}
                      className="flex-1 rounded border border-gray-300 text-sm px-2 py-1"
                      placeholder="Descripción del feature"
                    />
                    <button
                      type="button"
                      onClick={() => setFeatures(features.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Buyer info */}
              <div className="pt-2 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Info comprador</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-xs text-gray-500 mb-1">Nombre</span>
                    <input name="buyer_name" className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-gray-500 mb-1">Email</span>
                    <input name="buyer_email" type="email" className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-gray-500 mb-1">Teléfono</span>
                    <input name="buyer_phone" className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-gray-500 mb-1">Notas</span>
                    <input name="buyer_notes" className={inputClass} />
                  </label>
                </div>
              </div>
            </>
          )}

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
