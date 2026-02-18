'use client';

import { useEffect } from 'react';
import { buttonStyles } from '@/lib/styles/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-white mb-4">
          Algo salió mal
        </h2>
        <p className="text-gray-400 mb-8">
          Ocurrió un error inesperado. Por favor, intenta nuevamente.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className={buttonStyles('primary')}
          >
            Intentar nuevamente
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className={buttonStyles('secondary')}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
