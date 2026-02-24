'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { deleteLayer } from '@/lib/actions/admin';
import LayerMediaPanel from './LayerMediaPanel';
import { STATUS_LABELS } from '@/lib/constants/status';
import type { EntityStatus } from '@/types/hierarchy.types';

export interface LayerNode {
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
  children: LayerNode[];
}

interface Props {
  layers: LayerNode[];
  projectId: string;
  projectSlug: string;
  onAddChild: (parentId: string | null) => void;
  onEdit: (layer: LayerNode) => void;
}

export default function LayerTree({ layers, projectId, projectSlug, onAddChild, onEdit }: Props) {
  // Filter out tour layers — those are managed in the Tour 360 sidebar section
  const filteredLayers = layers.filter((l) => l.type !== 'tour');

  return (
    <div className="space-y-2">
      {filteredLayers.map((layer) => (
        <LayerTreeNode
          key={layer.id}
          layer={layer}
          projectId={projectId}
          projectSlug={projectSlug}
          onAddChild={onAddChild}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

function LayerTreeNode({
  layer,
  projectId,
  projectSlug,
  onAddChild,
  onEdit,
}: {
  layer: LayerNode;
  projectId: string;
  projectSlug: string;
  onAddChild: (parentId: string | null) => void;
  onEdit: (layer: LayerNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showLotMedia, setShowLotMedia] = useState(false);
  const hasChildren = layer.children.length > 0;
  const isLeaf = layer.type === 'lot' || layer.type === 'unit';

  // Non-leaf layers (zone, block, neighborhood, tower, floor) = layers with a "topview"
  const hasTopview = !isLeaf;

  const statusColors: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    reserved: 'bg-orange-100 text-orange-800',
    sold: 'bg-red-100 text-red-800',
    not_available: 'bg-gray-100 text-gray-600',
  };

  async function handleDelete() {
    if (!confirm(`Eliminar "${layer.name}" y todos sus hijos?`)) return;
    await deleteLayer(layer.id, projectId);
  }

  return (
    <div className={`${layer.depth > 0 ? 'ml-6' : ''}`}>
      {/* === NON-LEAF: zone/block/neighborhood/tower/floor — show topview prominently === */}
      {hasTopview && (
        <div className="border border-gray-200 rounded-lg bg-white mb-2">
          {/* Header row */}
          <div className="flex items-center gap-2 py-2 px-3 border-b border-gray-100">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-5 h-5 flex items-center justify-center text-gray-400 shrink-0"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            <span className="text-xs font-mono text-gray-400 uppercase">{layer.type}</span>
            <span className="font-semibold text-gray-900">{layer.name}</span>

            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => onEdit(layer)}
                className="p-1 text-gray-400 hover:text-blue-600 rounded"
                title="Editar"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onAddChild(layer.id)}
                className="p-1 text-gray-400 hover:text-green-600 rounded"
                title="Agregar hijo"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={handleDelete}
                className="p-1 text-gray-400 hover:text-red-600 rounded"
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Topview media — ALWAYS visible */}
          <div className="p-3">
            <p className="text-xs text-gray-500 mb-2">
              Vista del mapa: fondo (imagen aerea/render) + SVG interactivo (poligonos clickeables). Desktop y mobile.
            </p>
            <LayerMediaPanel
              layer={layer}
              projectId={projectId}
              projectSlug={projectSlug}
            />
          </div>

          {/* Children */}
          {expanded && hasChildren && (
            <div className="px-3 pb-3">
              <div className="border-t border-gray-100 pt-2">
                <p className="text-xs text-gray-400 mb-1">
                  {layer.children.length} hijos
                </p>
                {layer.children.map((child) => (
                  <LayerTreeNode
                    key={child.id}
                    layer={child}
                    projectId={projectId}
                    projectSlug={projectSlug}
                    onAddChild={onAddChild}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === LEAF: lot/unit — compact row === */}
      {isLeaf && (
        <>
          <div className="group flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-gray-50 text-sm">
            <GripVertical size={12} className="text-gray-300 shrink-0" />

            <span className="shrink-0 text-xs font-mono text-gray-400 w-10">{layer.type}</span>

            <span className="font-medium text-gray-900 truncate">{layer.name}</span>

            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${statusColors[layer.status] ?? ''}`}>
              {STATUS_LABELS[layer.status as EntityStatus] ?? layer.status}
            </span>

            {layer.area && (
              <span className="text-xs text-gray-500 ml-1">{layer.area}m²</span>
            )}
            {layer.price && (
              <span className="text-xs text-gray-500">
                ${layer.price.toLocaleString()}
              </span>
            )}

            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(layer)}
                className="p-1 text-gray-400 hover:text-blue-600 rounded"
                title="Editar"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => setShowLotMedia(!showLotMedia)}
                className={`p-1 rounded text-xs ${showLotMedia ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
                title="Media (fichas, fondo)"
              >
                Media
              </button>
              <button
                onClick={handleDelete}
                className="p-1 text-gray-400 hover:text-red-600 rounded"
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Lot media panel — togglable */}
          {showLotMedia && (
            <div className="ml-6 mb-2">
              <LayerMediaPanel
                layer={layer}
                projectId={projectId}
                projectSlug={projectSlug}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
