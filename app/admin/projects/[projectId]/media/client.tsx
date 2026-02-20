'use client';

import MediaUploadSlot from '@/components/admin/MediaUploadSlot';
import { uploadMedia, deleteMedia } from '@/lib/actions/admin';

interface MediaRow {
  id: string;
  purpose: string;
  url: string;
  storage_path: string;
}

interface Props {
  projectId: string;
  projectSlug: string;
  media: MediaRow[];
  logoUrl: string | null;
  secondaryLogoUrl: string | null;
}

export default function ProjectMediaClient({ projectId, projectSlug, media, logoUrl, secondaryLogoUrl }: Props) {
  const slots = [
    {
      label: 'Splash Background',
      purpose: 'background',
      type: 'image',
      accept: 'image/*',
      storagePath: `${projectSlug}/splash/background.webp`,
    },
    {
      label: 'Logo Proyecto',
      purpose: 'logo',
      type: 'image',
      accept: 'image/*,.svg',
      storagePath: `${projectSlug}/branding/logo.svg`,
    },
    {
      label: 'Logo Developer',
      purpose: 'logo_developer',
      type: 'image',
      accept: 'image/*,.svg',
      storagePath: `${projectSlug}/branding/logo-dev.svg`,
    },
    {
      label: 'Thumbnail',
      purpose: 'thumbnail',
      type: 'image',
      accept: 'image/*',
      storagePath: `${projectSlug}/splash/thumbnail.webp`,
    },
  ];

  function findMedia(purpose: string): MediaRow | undefined {
    return media.find((m) => m.purpose === purpose);
  }

  function getCurrentUrl(purpose: string): string | null {
    const m = findMedia(purpose);
    if (m) return m.url;
    if (purpose === 'logo') return logoUrl;
    if (purpose === 'logo_developer') return secondaryLogoUrl;
    return null;
  }

  async function handleUpload(purpose: string, type: string, storagePath: string, file: File) {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('project_id', projectId);
    formData.set('purpose', purpose);
    formData.set('type', type);
    formData.set('storage_path', storagePath);
    await uploadMedia(formData);
  }

  async function handleDelete(purpose: string) {
    const m = findMedia(purpose);
    if (m) {
      await deleteMedia(m.id, projectId);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Media del Proyecto</h1>
      <p className="text-sm text-gray-500 mb-6">
        Imagenes a nivel de proyecto. Si no se sube un logo, simplemente no se muestra en la pagina publica.
        La media de cada layer (fondos, SVGs, fichas) se gestiona desde la seccion Layers.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
        <p className="col-span-2 md:col-span-4 text-xs text-gray-400 mb-1">
          <strong>Splash Background:</strong> Fondo de la pantalla de inicio.
          <strong> Logo Proyecto:</strong> Logo del desarrollo.
          <strong> Logo Developer:</strong> Logo de la inmobiliaria.
          <strong> Thumbnail:</strong> Miniatura para listados y previews.
        </p>
        {slots.map((slot) => (
          <MediaUploadSlot
            key={slot.purpose}
            label={slot.label}
            currentUrl={getCurrentUrl(slot.purpose)}
            accept={slot.accept}
            onUpload={(file) => handleUpload(slot.purpose, slot.type, slot.storagePath, file)}
            onDelete={getCurrentUrl(slot.purpose) ? () => handleDelete(slot.purpose) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
