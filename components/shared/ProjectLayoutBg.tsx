'use client';

import { FadeImage } from './FadeImage';

interface ProjectLayoutBgProps {
  url: string;
}

export function ProjectLayoutBg({ url }: ProjectLayoutBgProps) {
  return (
    <FadeImage
      src={url}
      alt=""
      aria-hidden
      fetchPriority="high"
      className="fixed inset-0 w-full h-full object-cover blur-sm brightness-50 -z-10 pointer-events-none"
      fadeDuration={400}
    />
  );
}
