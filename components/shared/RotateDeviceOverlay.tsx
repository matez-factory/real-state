'use client';

import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

export function RotateDeviceOverlay() {
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait) and (max-width: 1279px)');
    const handler = () => {
      setIsPortrait(mq.matches);
      if (!mq.matches) setDismissed(false);
    };
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (!isPortrait || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-900/95 backdrop-blur-sm flex flex-col items-center justify-center text-white p-8">
      <div className="animate-pulse mb-8">
        <RotateCcw className="w-20 h-20 text-white/80" />
      </div>
      <h2 className="text-xl font-light text-center mb-3">
        Gir&aacute; tu dispositivo
      </h2>
      <p className="text-white/60 text-center text-sm max-w-xs mb-8">
        Para una mejor experiencia, us&aacute; tu dispositivo en modo horizontal
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="px-6 py-2 rounded-full border border-white/30 text-white/80 text-sm transition-colors hover:bg-white/10 active:bg-white/20 outline-none"
      >
        Continuar de todos modos
      </button>
    </div>
  );
}
