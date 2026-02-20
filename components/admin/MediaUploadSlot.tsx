'use client';

import { useState, useRef } from 'react';
import { Upload, Trash2, Loader2, X, Maximize2 } from 'lucide-react';

interface Props {
  label: string;
  currentUrl?: string | null;
  accept?: string;
  onUpload: (file: File) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export default function MediaUploadSlot({ label, currentUrl, accept, onUpload, onDelete }: Props) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm('Eliminar este archivo?')) return;
    setUploading(true);
    try {
      await onDelete();
    } finally {
      setUploading(false);
    }
  }

  const isImage = currentUrl && /\.(webp|jpg|jpeg|png|gif|svg)$/i.test(currentUrl);
  const isVideo = currentUrl && /\.(mp4|webm|mov)$/i.test(currentUrl);

  return (
    <>
      <div className="border border-gray-200 rounded-lg p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">{label}</span>
          <div className="flex items-center gap-1">
            {currentUrl && (
              <button
                onClick={() => setLightbox(true)}
                className="p-1 text-gray-400 hover:text-blue-600 rounded"
                title="Ver en grande"
              >
                <Maximize2 size={12} />
              </button>
            )}
            {currentUrl && onDelete && (
              <button
                onClick={handleDelete}
                disabled={uploading}
                className="p-1 text-gray-400 hover:text-red-600 rounded"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {currentUrl ? (
          <div className="relative cursor-pointer" onClick={() => setLightbox(true)}>
            {isImage && (
              <img
                src={currentUrl}
                alt={label}
                className="w-full h-24 object-cover rounded border border-gray-100 hover:opacity-80 transition-opacity"
              />
            )}
            {isVideo && (
              <video
                src={currentUrl}
                className="w-full h-24 object-cover rounded border border-gray-100"
                muted
              />
            )}
            {!isImage && !isVideo && (
              <div className="w-full h-16 bg-gray-50 rounded border border-gray-100 flex items-center justify-center">
                <span className="text-xs text-gray-400 truncate px-2">{currentUrl.split('/').pop()}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-16 bg-gray-50 rounded border border-dashed border-gray-300 flex items-center justify-center">
            <span className="text-xs text-gray-400">Sin archivo</span>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="mt-2 w-full flex items-center justify-center gap-1 text-xs py-1.5 border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600 disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Subiendo...
            </>
          ) : (
            <>
              <Upload size={12} />
              {currentUrl ? 'Reemplazar' : 'Subir'}
            </>
          )}
        </button>
      </div>

      {/* Lightbox */}
      {lightbox && currentUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2"
          >
            <X size={20} />
          </button>

          <div className="max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <p className="text-white/60 text-sm mb-2 text-center">{label}</p>
            {isImage && (
              <img
                src={currentUrl}
                alt={label}
                className="max-w-full max-h-[80vh] object-contain rounded"
              />
            )}
            {isVideo && (
              <video
                src={currentUrl}
                className="max-w-full max-h-[80vh] rounded"
                controls
                autoPlay
              />
            )}
            {!isImage && !isVideo && (
              <div className="bg-white rounded p-8 text-center">
                <p className="text-gray-600 text-sm">{currentUrl.split('/').pop()}</p>
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 text-sm mt-2 inline-block"
                >
                  Abrir en nueva pestana
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
