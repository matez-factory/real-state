'use client';

import { useState, useCallback, ImgHTMLAttributes } from 'react';

interface FadeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Duration of the fade-in in ms (default 300) */
  fadeDuration?: number;
}

export function FadeImage({ fadeDuration = 300, className = '', style, onLoad, src, ...props }: FadeImageProps) {
  const [loaded, setLoaded] = useState(false);

  // Ref callback runs during commit (before browser paint).
  // If the image is already cached, mark it loaded instantly — no flash.
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true);
      onLoad?.(e);
    },
    [onLoad]
  );

  return (
    <img
      ref={imgRef}
      src={src}
      {...props}
      className={className}
      style={{
        ...style,
        opacity: loaded ? 1 : 0,
        transition: `opacity ${fadeDuration}ms ease`,
      }}
      onLoad={handleLoad}
    />
  );
}
