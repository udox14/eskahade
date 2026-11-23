// Manifest PWA khusus Portal Orang Tua (start_url & scope di /portal-ortu).
export const dynamic = 'force-static'

export function GET() {
  const manifest = {
    id: '/portal-ortu/',
    name: 'Portal Orang Tua ESKAHADE',
    short_name: 'Portal Ortu',
    description: 'Portal orang tua santri Pondok Pesantren Sukahideng',
    start_url: '/portal-ortu/beranda',
    scope: '/portal-ortu/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fafaf9',
    theme_color: '#fafaf9',
    lang: 'id',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
  })
}
