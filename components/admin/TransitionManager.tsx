'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import MediaUploadSlot from './MediaUploadSlot';
import { uploadTourMedia, deleteMedia } from '@/lib/actions/admin';
import type { TourStop } from './TourStopManager';

interface MediaRow {
  id: string;
  purpose: string;
  url: string;
  storage_path: string;
  metadata: Record<string, unknown>;
}

export interface TransitionPair {
  from: TourStop;
  to: TourStop;
  forwardMedia: MediaRow | null;
  reverseMedia: MediaRow | null;
}

interface Props {
  projectId: string;
  projectSlug: string;
  tourLayerId: string;
  stops: TourStop[];
  transitions: TransitionPair[];
  allTransitionMedia: MediaRow[];
  onTransitionsChange: () => void;
}

export default function TransitionManager({
  projectId,
  projectSlug,
  tourLayerId,
  stops,
  transitions,
  allTransitionMedia,
  onTransitionsChange,
}: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [fromStop, setFromStop] = useState('');
  const [toStop, setToStop] = useState('');

  async function handleUpload(
    fromViewpoint: string,
    toViewpoint: string,
    file: File
  ) {
    const storagePath = `${projectSlug}/transitions/${fromViewpoint}--${toViewpoint}.mp4`;

    const formData = new FormData();
    formData.set('file', file);
    formData.set('project_id', projectId);
    formData.set('layer_id', tourLayerId);
    formData.set('purpose', 'transition');
    formData.set('type', 'video');
    formData.set('storage_path', storagePath);
    formData.set(
      'metadata',
      JSON.stringify({ from_viewpoint: fromViewpoint, to_viewpoint: toViewpoint })
    );

    await uploadTourMedia(formData);
    onTransitionsChange();
  }

  async function handleDelete(mediaId: string) {
    await deleteMedia(mediaId, projectId);
    onTransitionsChange();
  }

  function addTransition() {
    if (!fromStop || !toStop || fromStop === toStop) return;
    // The transition doesn't need pre-creation — it materializes when media is uploaded
    setShowAddModal(false);
    setFromStop('');
    setToStop('');
    // Force a refresh to show the new pair slots
    onTransitionsChange();
  }

  // Build existing pairs from transition media
  const existingPairs = new Set<string>();
  for (const t of transitions) {
    const key = [t.from.viewpoint, t.to.viewpoint].sort().join('--');
    existingPairs.add(key);
  }

  // Available stop pairs for new transitions
  const availablePairs: { from: TourStop; to: TourStop }[] = [];
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      const key = [stops[i].viewpoint, stops[j].viewpoint].sort().join('--');
      if (!existingPairs.has(key)) {
        availablePairs.push({ from: stops[i], to: stops[j] });
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Transiciones</h2>
        {stops.length >= 2 && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            <Plus size={14} />
            Agregar Transicion
          </button>
        )}
      </div>

      {stops.length < 2 && (
        <p className="text-sm text-gray-500 text-center py-8">
          Necesitas al menos 2 stops para crear transiciones.
        </p>
      )}

      {transitions.length === 0 && stops.length >= 2 && (
        <p className="text-sm text-gray-500 text-center py-8">
          No hay transiciones. Agrega una nueva.
        </p>
      )}

      <div className="space-y-4">
        {transitions.map((t) => {
          const pairKey = `${t.from.viewpoint}--${t.to.viewpoint}`;
          return (
            <div key={pairKey} className="border border-gray-200 rounded-lg p-4 bg-white">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                {t.from.name} ↔ {t.to.name}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <MediaUploadSlot
                  label={`${t.from.name} → ${t.to.name}`}
                  currentUrl={t.forwardMedia?.url}
                  accept="video/*"
                  onUpload={(file) => handleUpload(t.from.viewpoint, t.to.viewpoint, file)}
                  onDelete={
                    t.forwardMedia
                      ? () => handleDelete(t.forwardMedia!.id)
                      : undefined
                  }
                />
                <MediaUploadSlot
                  label={`${t.to.name} → ${t.from.name}`}
                  currentUrl={t.reverseMedia?.url}
                  accept="video/*"
                  onUpload={(file) => handleUpload(t.to.viewpoint, t.from.viewpoint, file)}
                  onDelete={
                    t.reverseMedia
                      ? () => handleDelete(t.reverseMedia!.id)
                      : undefined
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add transition modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Nueva Transicion</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">Desde</span>
                <select
                  value={fromStop}
                  onChange={(e) => setFromStop(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar stop...</option>
                  {stops.map((s) => (
                    <option key={s.viewpoint} value={s.viewpoint}>
                      {s.name} ({s.viewpoint})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">Hasta</span>
                <select
                  value={toStop}
                  onChange={(e) => setToStop(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar stop...</option>
                  {stops.filter((s) => s.viewpoint !== fromStop).map((s) => (
                    <option key={s.viewpoint} value={s.viewpoint}>
                      {s.name} ({s.viewpoint})
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={addTransition}
                  disabled={!fromStop || !toStop || fromStop === toStop}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-500 font-medium disabled:opacity-50"
                >
                  Crear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
