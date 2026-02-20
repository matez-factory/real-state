'use client';

import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import MediaUploadSlot from './MediaUploadSlot';
import { uploadTourMedia, deleteMedia } from '@/lib/actions/admin';

export interface TourStop {
  index: number;
  viewpoint: string;
  name: string;
  panoramaMedia: MediaRow | null;
  hotspotMedia: MediaRow | null;
}

interface MediaRow {
  id: string;
  purpose: string;
  url: string;
  storage_path: string;
  metadata: Record<string, unknown>;
}

interface Props {
  projectId: string;
  projectSlug: string;
  tourLayerId: string;
  stops: TourStop[];
  onStopsChange: () => void;
}

export default function TourStopManager({
  projectId,
  projectSlug,
  tourLayerId,
  stops,
  onStopsChange,
}: Props) {
  const [editingName, setEditingName] = useState<number | null>(null);
  const [nameValue, setNameValue] = useState('');

  function startEditName(stop: TourStop) {
    setEditingName(stop.index);
    setNameValue(stop.name);
  }

  async function handleUpload(
    stop: TourStop,
    purpose: 'gallery' | 'hotspot',
    file: File
  ) {
    const ext = purpose === 'hotspot' ? 'svg' : 'webp';
    const storagePath = `${projectSlug}/tour/${stop.viewpoint}-${purpose}.${ext}`;

    const formData = new FormData();
    formData.set('file', file);
    formData.set('project_id', projectId);
    formData.set('layer_id', tourLayerId);
    formData.set('purpose', purpose);
    formData.set('type', purpose === 'hotspot' ? 'svg' : 'image');
    formData.set('storage_path', storagePath);
    formData.set('metadata', JSON.stringify({ viewpoint: stop.viewpoint }));

    await uploadTourMedia(formData);
    onStopsChange();
  }

  async function handleDeleteMedia(mediaId: string) {
    await deleteMedia(mediaId, projectId);
    onStopsChange();
  }

  // Compute next stop index
  const nextIndex = stops.length > 0 ? Math.max(...stops.map((s) => s.index)) + 1 : 1;

  async function addStop() {
    const viewpoint = `stop-${String(nextIndex).padStart(2, '0')}`;
    // Create a placeholder media (gallery type) so the stop exists
    // We need at least one media row to materialize the stop
    // For now, we'll create an empty panorama placeholder
    const formData = new FormData();
    // Create a tiny placeholder file
    const placeholder = new Blob([''], { type: 'text/plain' });
    const file = new File([placeholder], 'placeholder.txt', { type: 'text/plain' });

    formData.set('file', file);
    formData.set('project_id', projectId);
    formData.set('layer_id', tourLayerId);
    formData.set('purpose', 'gallery');
    formData.set('type', 'image');
    formData.set('storage_path', `${projectSlug}/tour/${viewpoint}-placeholder.txt`);
    formData.set('metadata', JSON.stringify({ viewpoint, name: `Stop ${nextIndex}` }));

    await uploadTourMedia(formData);
    onStopsChange();
  }

  async function deleteStop(stop: TourStop) {
    if (!confirm(`Eliminar stop "${stop.name}"?`)) return;
    if (stop.panoramaMedia) {
      await deleteMedia(stop.panoramaMedia.id, projectId);
    }
    if (stop.hotspotMedia) {
      await deleteMedia(stop.hotspotMedia.id, projectId);
    }
    onStopsChange();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Stops del Tour</h2>
        <button
          onClick={addStop}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
        >
          <Plus size={14} />
          Agregar Stop
        </button>
      </div>

      {stops.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No hay stops. Agrega el primero.</p>
      ) : (
        <div className="space-y-4">
          {stops.map((stop) => (
            <div key={stop.viewpoint} className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400">{stop.viewpoint}</span>
                  {editingName === stop.index ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-40"
                        autoFocus
                      />
                      <button
                        onClick={() => setEditingName(null)}
                        className="text-green-600 p-1"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingName(null)}
                        className="text-gray-400 p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="font-medium text-gray-900">
                      {stop.name}
                      <button
                        onClick={() => startEditName(stop)}
                        className="ml-1 text-gray-400 hover:text-gray-600"
                      >
                        <Pencil size={12} />
                      </button>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteStop(stop)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MediaUploadSlot
                  label="Imagen panoramica"
                  currentUrl={stop.panoramaMedia?.url}
                  accept="image/*"
                  onUpload={(file) => handleUpload(stop, 'gallery', file)}
                  onDelete={
                    stop.panoramaMedia
                      ? () => handleDeleteMedia(stop.panoramaMedia!.id)
                      : undefined
                  }
                />
                <MediaUploadSlot
                  label="Hotspot SVG"
                  currentUrl={stop.hotspotMedia?.url}
                  accept=".svg,image/svg+xml"
                  onUpload={(file) => handleUpload(stop, 'hotspot', file)}
                  onDelete={
                    stop.hotspotMedia
                      ? () => handleDeleteMedia(stop.hotspotMedia!.id)
                      : undefined
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
