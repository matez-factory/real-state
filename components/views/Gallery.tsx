'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Media } from '@/types/hierarchy.types';

interface GalleryProps {
  media: Media[];
  unitName: string;
}

export function Gallery({ media, unitName }: GalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [imageCache, setImageCache] = useState<Map<string, string>>(new Map());
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const imageCacheRef = useRef<Map<string, string>>(new Map());

  const loadImage = useCallback(async (url: string) => {
    if (imageCacheRef.current.has(url)) return;
    setLoadingImages((prev) => new Set(prev).add(url));
    setFailedImages((prev) => {
      if (!prev.has(url)) return prev;
      const next = new Set(prev);
      next.delete(url);
      return next;
    });
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      imageCacheRef.current.set(url, blobUrl);
      setImageCache((prev) => new Map(prev).set(url, blobUrl));
    } catch {
      setFailedImages((prev) => new Set(prev).add(url));
    } finally {
      setLoadingImages((prev) => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  }, []);

  const retryImage = useCallback((url: string) => {
    imageCacheRef.current.delete(url);
    loadImage(url);
  }, [loadImage]);

  // Load current and adjacent images
  useEffect(() => {
    const indices = [selectedIndex - 1, selectedIndex, selectedIndex + 1]
      .filter((i) => i >= 0 && i < media.length);
    for (const i of indices) {
      const url = media[i].url || media[i].storagePath;
      if (url) loadImage(url);
    }
  }, [selectedIndex, media, loadImage]);

  // Cleanup
  useEffect(() => {
    const ref = imageCacheRef;
    return () => {
      ref.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  if (media.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-lg flex items-center justify-center min-h-[400px]">
        <div className="text-center text-gray-500">
          <svg className="mx-auto h-16 w-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No hay imágenes disponibles para {unitName}</p>
          <p className="text-xs mt-1">Las imágenes se cargarán desde el bucket de almacenamiento</p>
        </div>
      </div>
    );
  }

  const currentMedia = media[selectedIndex];
  const currentUrl = currentMedia.url || currentMedia.storagePath;
  const cached = currentUrl ? imageCache.get(currentUrl) : undefined;
  const isLoading = currentUrl ? loadingImages.has(currentUrl) : false;
  const hasFailed = currentUrl ? failedImages.has(currentUrl) : false;

  return (
    <div>
      {/* Main image */}
      <div className="bg-gray-800 rounded-lg overflow-hidden relative min-h-[400px]">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : cached ? (
          /* eslint-disable-next-line @next/next/no-img-element -- blob URLs incompatible with next/image */
          <img
            src={cached}
            alt={currentMedia.altText || currentMedia.title || unitName}
            className="w-full h-full object-cover min-h-[400px] max-h-[500px]"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <p className="text-sm">{hasFailed ? 'Error al cargar la imagen' : 'Imagen no disponible'}</p>
            {hasFailed && currentUrl && (
              <button
                onClick={() => retryImage(currentUrl)}
                className="mt-3 glass-panel px-4 py-1.5 text-sm text-gray-300 hover:text-white transition-colors"
              >
                Reintentar
              </button>
            )}
          </div>
        )}

        {/* Navigation arrows */}
        {media.length > 1 && (
          <>
            <button
              onClick={() => setSelectedIndex((i) => (i > 0 ? i - 1 : media.length - 1))}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white shadow transition-colors"
              aria-label="Imagen anterior"
            >
              ←
            </button>
            <button
              onClick={() => setSelectedIndex((i) => (i < media.length - 1 ? i + 1 : 0))}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white shadow transition-colors"
              aria-label="Imagen siguiente"
            >
              →
            </button>
          </>
        )}

        {/* Counter */}
        {media.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {selectedIndex + 1} / {media.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {media.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
          {media.map((m, idx) => {
            const thumbUrl = m.url || m.storagePath;
            const thumbCached = thumbUrl ? imageCache.get(thumbUrl) : undefined;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedIndex(idx)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                  idx === selectedIndex ? 'border-blue-400' : 'border-transparent hover:border-gray-600'
                }`}
              >
                {thumbCached ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={thumbCached} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-800" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
