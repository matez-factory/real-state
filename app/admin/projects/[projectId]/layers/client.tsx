'use client';

import { useState } from 'react';
import LayerTree, { type LayerNode } from '@/components/admin/LayerTree';
import LayerForm from '@/components/admin/LayerForm';
import CsvImportForm from '@/components/admin/CsvImportForm';
import { Plus, FileSpreadsheet } from 'lucide-react';

interface RawLayer {
  id: string;
  project_id: string;
  parent_id: string | null;
  type: string;
  depth: number;
  sort_order: number;
  slug: string;
  name: string;
  label: string | null;
  svg_element_id: string | null;
  status: string;
  area: number | null;
  price: number | null;
  currency: string | null;
  is_corner: boolean | null;
  unit_type_id: string | null;
  tour_embed_url: string | null;
  video_url: string | null;
  front_length: number | null;
  depth_length: number | null;
  features: unknown[] | null;
  properties: Record<string, unknown>;
  background_image_url: string | null;
  background_image_mobile_url: string | null;
  svg_overlay_url: string | null;
  svg_overlay_mobile_url: string | null;
}

interface UnitTypeOption {
  id: string;
  name: string;
}

interface Props {
  projectId: string;
  projectSlug: string;
  projectName: string;
  rawLayers: RawLayer[];
  unitTypes: UnitTypeOption[];
}

function buildTree(layers: RawLayer[]): LayerNode[] {
  const map = new Map<string, LayerNode>();
  const roots: LayerNode[] = [];

  // First pass: create nodes
  for (const l of layers) {
    map.set(l.id, { ...l, children: [] });
  }

  // Second pass: build tree
  for (const l of layers) {
    const node = map.get(l.id)!;
    if (l.parent_id && map.has(l.parent_id)) {
      map.get(l.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export default function LayersPageClient({ projectId, projectSlug, projectName, rawLayers, unitTypes }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [editLayer, setEditLayer] = useState<LayerNode | null>(null);
  const [addParentId, setAddParentId] = useState<string | null>(null);

  const tree = buildTree(rawLayers);

  function handleAddChild(parentId: string | null) {
    setAddParentId(parentId);
    setEditLayer(null);
    setShowForm(true);
  }

  function handleEdit(layer: LayerNode) {
    setEditLayer(layer);
    setAddParentId(layer.parent_id);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditLayer(null);
    setAddParentId(null);
  }

  const nonTourLayers = rawLayers.filter((l) => l.type !== 'tour');
  const totalLayers = nonTourLayers.length;
  const lotCount = nonTourLayers.filter((l) => l.type === 'lot' || l.type === 'unit').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Layers</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalLayers} capas, {lotCount} lotes/unidades.
            Cada capa con hijos tiene su vista de mapa (fondo + SVG) siempre visible abajo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCsv(true)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-gray-700"
          >
            <FileSpreadsheet size={14} />
            Importar CSV
          </button>
          <button
            onClick={() => handleAddChild(null)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Capa raíz
          </button>
        </div>
      </div>

      {tree.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No hay layers. Agrega la primera capa raíz o importa desde CSV.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <LayerTree
            layers={tree}
            projectId={projectId}
            projectSlug={projectSlug}
            onAddChild={handleAddChild}
            onEdit={handleEdit}
          />
        </div>
      )}

      {showForm && (
        <LayerForm
          projectId={projectId}
          parentId={addParentId}
          layer={editLayer}
          unitTypes={unitTypes}
          onClose={handleCloseForm}
        />
      )}

      {showCsv && (
        <CsvImportForm
          projectId={projectId}
          layers={tree}
          onClose={() => setShowCsv(false)}
        />
      )}
    </div>
  );
}
