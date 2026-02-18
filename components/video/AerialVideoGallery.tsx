'use client';

import { useState } from 'react';
import { Media } from '@/types/hierarchy.types';
import { VideoPlayer } from './VideoPlayer';

interface AerialVideoGalleryProps {
  media: Media[];
}

export function AerialVideoGallery({ media }: AerialVideoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (media.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No hay videos disponibles
      </div>
    );
  }

  const currentVideo = media[selectedIndex];

  return (
    <div className="flex flex-col h-full">
      {/* Main video player */}
      <div className="flex-1 min-h-0">
        <VideoPlayer
          key={currentVideo.id}
          src={currentVideo.url || currentVideo.storagePath}
          className="w-full h-full"
        />
      </div>

      {/* Video selector tabs */}
      {media.length > 1 && (
        <div className="flex gap-2 p-4 bg-gray-900">
          {media.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => setSelectedIndex(idx)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                idx === selectedIndex
                  ? 'bg-white text-gray-900'
                  : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
              }`}
            >
              {m.title || `Video ${idx + 1}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
