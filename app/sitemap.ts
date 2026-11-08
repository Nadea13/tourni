import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

const locales = ['th', 'en'];
const publicRoutes = [
  '',
  '/tournaments',
  '/registrations',
  '/overlay',
  '/free-overlay',
  '/privacy-policy',
  '/terms-of-service',
  '/refund-policy',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  // Base static entries for each locale
  const staticEntries: MetadataRoute.Sitemap = [];

  for (const route of publicRoutes) {
    for (const locale of locales) {
      const url = `${siteUrl}/${locale}${route}`;
      staticEntries.push({
        url,
        lastModified: now,
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1.0 : (route === '/tournaments' || route === '/registrations') ? 0.9 : 0.7,
        alternates: {
          languages: {
            th: `${siteUrl}/th${route}`,
            en: `${siteUrl}/en${route}`,
          },
        },
      });
    }
  }

  // Attempt to fetch public tournaments for dynamic sitemap indexing (with strict 3s timeout to avoid blocking build)
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
    const res = await fetch(`${apiUrl}/tournaments`, {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      const tournaments = json.data || (Array.isArray(json) ? json : []);
      if (tournaments && tournaments.length > 0) {
        for (const t of tournaments) {
          for (const locale of locales) {
            staticEntries.push({
              url: `${siteUrl}/${locale}/tournaments/${t.id}`,
              lastModified: t.updated_at ? new Date(t.updated_at) : now,
              changeFrequency: 'daily',
              priority: 0.8,
              alternates: {
                languages: {
                  th: `${siteUrl}/th/tournaments/${t.id}`,
                  en: `${siteUrl}/en/tournaments/${t.id}`,
                },
              },
            });
          }
        }
      }
    }
  } catch (e: any) {
    // Graceful fallback to static routes if backend is sleeping or unreachable during build
    console.warn(`[sitemap] Dynamic tournaments fetch skipped (${e?.message || 'timeout/unreachable'}). Using static entries.`);
  }

  return staticEntries;
}
