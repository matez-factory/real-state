importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js'
);

if (workbox) {
  const { registerRoute } = workbox.routing;
  const { CacheFirst } = workbox.strategies;
  const { ExpirationPlugin } = workbox.expiration;

  // Cache Supabase Storage assets (images, SVGs, videos)
  registerRoute(
    ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/'),
    new CacheFirst({
      cacheName: 'supabase-media',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 1500,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    })
  );
}
