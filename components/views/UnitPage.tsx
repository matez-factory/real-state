'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ExplorerPageData, Layer } from '@/types/hierarchy.types';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { STATUS_LABELS, STATUS_CLASSES } from '@/lib/constants/status';
import { buttonStyles } from '@/lib/styles/button';
import { Gallery } from '@/components/views/Gallery';

interface UnitPageProps {
  data: ExplorerPageData;
}

export function UnitPage({ data }: UnitPageProps) {
  const router = useRouter();
  const { project, currentLayer, media, breadcrumbs, siblings, currentPath } = data;

  // Navigate to sibling unit
  const navigateToSibling = useCallback((sibling: Layer) => {
    const siblingPath = [...currentPath.slice(0, -1), sibling.slug];
    router.push(`/p/${project.slug}/${siblingPath.join('/')}`);
  }, [currentPath, project.slug, router]);

  if (!currentLayer) return null;

  const props = currentLayer.properties;
  const galleryMedia = media.filter((m) => m.type === 'image' && (m.purpose === 'gallery' || m.purpose === 'cover' || m.purpose === 'floor_plan'));
  const allMedia = media.filter((m) => m.type === 'image');

  const area = props.area as number | undefined;
  const price = props.price as number | undefined;
  const description = props.description as string | undefined;
  const orientation = props.orientation as string | undefined;
  const features = props.features as string[] | undefined;
  const frontMeters = props.front_meters as number | undefined;
  const depthMeters = props.depth_meters as number | undefined;
  const isCorner = props.is_corner as boolean | undefined;
  const bedrooms = props.bedrooms as number | undefined;
  const bathrooms = props.bathrooms as number | undefined;
  const unitType = props.unit_type as string | undefined;
  const hasBalcony = props.has_balcony as boolean | undefined;
  const floorNumber = props.floor_number as number | undefined;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="glass-panel rounded-none px-4 py-3">
        <div className="max-w-5xl mx-auto">
          <Breadcrumb items={breadcrumbs} />
          <div className="flex items-center gap-4 mt-2">
            <h1 className="text-2xl font-bold text-white">{currentLayer.name}</h1>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_CLASSES[currentLayer.status]}`}>
              {STATUS_LABELS[currentLayer.status]}
            </span>
          </div>
          {floorNumber && (
            <p className="text-sm text-gray-400 mt-1">Piso {floorNumber}</p>
          )}
        </div>
      </header>

      <main id="main-content" className="max-w-5xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Gallery */}
          <div className="lg:col-span-2">
            <Gallery media={galleryMedia.length > 0 ? galleryMedia : allMedia} unitName={currentLayer.name} />
          </div>

          {/* Right column: Info */}
          <div className="space-y-6">
            {/* Price */}
            {price != null && (
              <div className="glass-panel p-5">
                <p className="text-3xl font-bold text-green-400">
                  ${price.toLocaleString()}
                </p>
                {area && (
                  <p className="text-sm text-gray-400 mt-1">
                    ${Math.round(price / area)}/m²
                  </p>
                )}
              </div>
            )}

            {/* Details card */}
            <div className="glass-panel p-5 space-y-4">
              <h3 className="font-semibold text-white">Detalles</h3>

              {unitType && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Tipo</span>
                  <span className="text-sm font-medium text-white">{unitType}</span>
                </div>
              )}

              {area != null && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Superficie</span>
                  <span className="text-sm font-medium text-white">{area} m²</span>
                </div>
              )}

              {(bedrooms != null || bathrooms != null) && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Ambientes</span>
                  <span className="text-sm font-medium text-white">
                    {bedrooms != null && `${bedrooms} dorm.`}
                    {bedrooms != null && bathrooms != null && ' / '}
                    {bathrooms != null && `${bathrooms} baño${bathrooms !== 1 ? 's' : ''}`}
                  </span>
                </div>
              )}

              {(frontMeters || depthMeters) && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Dimensiones</span>
                  <span className="text-sm font-medium text-white">
                    {frontMeters && `${frontMeters}m`}
                    {frontMeters && depthMeters && ' × '}
                    {depthMeters && `${depthMeters}m`}
                  </span>
                </div>
              )}

              {orientation && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Orientación</span>
                  <span className="text-sm font-medium text-white">{orientation}</span>
                </div>
              )}
            </div>

            {/* Features card */}
            <div className="glass-panel p-5">
              <h3 className="font-semibold text-white mb-3">Características</h3>
              <ul className="space-y-2">
                {isCorner && project.type === 'subdivision' && (
                  <li className="flex items-center text-sm text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Lote de esquina
                  </li>
                )}
                {hasBalcony && (
                  <li className="flex items-center text-sm text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Balcón
                  </li>
                )}
                {features && features.map((feature, idx) => (
                  <li key={idx} className="flex items-center text-sm text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Description */}
            {description && (
              <div className="glass-panel p-5">
                <h3 className="font-semibold text-white mb-2">Descripción</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{description}</p>
              </div>
            )}

            {/* CTA */}
            {currentLayer.status === 'available' && (
              <button className={`${buttonStyles('primary')} w-full`}>
                Consultar Disponibilidad
              </button>
            )}
          </div>
        </div>

        {/* Sibling units */}
        {siblings.length > 1 && (
          <div className="mt-10">
            <h3 className="font-semibold text-white mb-4">Otras unidades en este piso</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {siblings.map((sibling) => {
                const isCurrent = sibling.id === currentLayer.id;
                const siblingPrice = sibling.properties.price as number | undefined;
                const siblingArea = sibling.properties.area as number | undefined;
                return (
                  <button
                    key={sibling.id}
                    onClick={() => !isCurrent && navigateToSibling(sibling)}
                    disabled={isCurrent}
                    className={`glass-panel p-4 text-left transition-all ${
                      isCurrent
                        ? 'border-blue-400 bg-blue-500/10 cursor-default'
                        : 'hover:bg-white/10 hover:shadow-lg hover:shadow-blue-500/10'
                    }`}
                  >
                    <div className="font-semibold text-white">{sibling.name}</div>
                    {siblingArea && (
                      <div className="text-xs text-gray-400 mt-1">{siblingArea} m²</div>
                    )}
                    {siblingPrice && (
                      <div className="text-sm font-medium text-green-400 mt-1">
                        ${siblingPrice.toLocaleString()}
                      </div>
                    )}
                    <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[sibling.status]}`}>
                      {STATUS_LABELS[sibling.status]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="glass-panel rounded-none px-4 py-3 mt-8">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => router.back()}
            className={buttonStyles('ghost', 'sm')}
          >
            ← Volver al plano
          </button>
        </div>
      </footer>
    </div>
  );
}
