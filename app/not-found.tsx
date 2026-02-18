import Link from 'next/link';
import { buttonStyles } from '@/lib/styles/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-400 mb-4">
          Página no encontrada
        </h2>
        <p className="text-gray-400 mb-8">
          Lo sentimos, la página que estás buscando no existe.
        </p>
        <Link
          href="/"
          className={buttonStyles('primary')}
        >
          Volver al Mapa Principal
        </Link>
      </div>
    </div>
  );
}
