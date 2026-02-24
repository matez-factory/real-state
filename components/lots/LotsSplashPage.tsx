'use client';

import { useTransitionRouter } from 'next-view-transitions';
import { useMemo } from 'react';
import { ExplorerPageData } from '@/types/hierarchy.types';
import { LandingOverlay } from './LandingOverlay';
import { FadeImage } from '@/components/shared/FadeImage';

interface LotsSplashPageProps {
  data: ExplorerPageData;
}

export function LotsSplashPage({ data }: LotsSplashPageProps) {
  const router = useTransitionRouter();
  const { project, media, children } = data;

  const logos = useMemo(
    () => media.filter((m) => m.purpose === 'logo' || m.purpose === 'logo_developer'),
    [media]
  );

  const backgroundUrl = useMemo(
    () => media.find((m) => m.purpose === 'background' && m.type === 'image')?.url,
    [media]
  );

  const firstChildSlug = children[0]?.slug;

  return (
    <div className="relative h-screen overflow-hidden bg-black">
      {backgroundUrl && (
        <FadeImage
          src={backgroundUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      <LandingOverlay
        project={project}
        logos={logos}
        onEnter={() => {
          if (firstChildSlug) router.push(`/p/${project.slug}/${firstChildSlug}`);
        }}
      />
    </div>
  );
}
