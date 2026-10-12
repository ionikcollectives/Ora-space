import { defineConfig } from 'vite';
import site from './src/config.js';

/*
  npm run build          → dist/         (regular multi-file site, best for hosting)
  npm run build:single   → dist-single/  (one self-contained index.html, opens by double-click)
*/

const SITE_URL = String(site.siteUrl || '').trim().replace(/\/+$/, '');

const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Puts the town from src/config.js into the page wherever it says "in Sri Lanka": the search title gets just
// the town ("…in Piliyandala", short enough to show in full), everything else gets "…in Piliyandala, Sri Lanka".
function placeInTitles() {
  const city = escapeHtml(String(site.city || '').trim());
  return {
    name: 'ora-place-in-titles',
    transformIndexHtml: html => city
      ? html.replace(/(<title>[^<]*)in Sri Lanka/, `$1in ${city}`).replace(/\bin Sri Lanka\b/g, `in ${city}, Sri Lanka`)
      : html
  };
}

// Structured data (schema.org) that tells search engines what ORA Space is: its name, what it offers,
// logo and links, and, once an address is set, its location and opening hours (as a café and art gallery).
function structuredData() {
  const page = SITE_URL ? `${SITE_URL}/` : undefined;
  const file = name => (SITE_URL ? `${SITE_URL}/${name}` : undefined);
  const place = [String(site.city || '').trim(), 'Sri Lanka'].filter(Boolean).join(', ');
  const handle = String(site.instagram || '').replace(/^@/, '').trim();
  const hour = h => `${String(((Math.round(+h) % 24) + 24) % 24).padStart(2, '0')}:00`;
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const openDays = Array.isArray(site.openDays) && site.openDays.length
    ? DAYS.filter(d => site.openDays.some(x => String(x).trim().slice(0, 3).toLowerCase() === d.slice(0, 3).toLowerCase()))
    : DAYS;
  const city = String(site.city || '').trim();
  const facebook = String(site.facebook || '').trim().replace(/#$/, '');
  const ora = {
    '@type': site.address ? ['CafeOrCoffeeShop', 'ArtGallery'] : 'Organization',
    '@id': page && `${page}#ora`,
    name: 'ORA Space',
    alternateName: 'ORA',
    slogan: 'Feel & Belong',
    description: `A café, art space and creative house in a heritage walawwa in ${place}: exhibitions, a library, a studio, film nights, music and private events.`,
    url: page,
    logo: file('icon-512.png'),
    image: file('og-image.jpg'),
    email: site.email || undefined,
    telephone: site.phone || undefined,
    sameAs: [handle && `https://www.instagram.com/${handle}/`, facebook].filter(Boolean),
    knowsAbout: ['Café', 'Art exhibitions', 'Library', 'Recording studio', 'Film screenings', 'Live music', 'Theatre', 'Private events']
  };
  if (site.address) {
    // "3, Wewala, 1 Church Rd, Piliyandala 10300" → street "3, Wewala, 1 Church Rd", town, postcode
    const postalCode = (String(site.address).match(/(\d{5})\s*$/) || [])[1];
    let street = String(site.address).replace(/\s*\d{5}\s*$/, '').trim();
    if (city && street.toLowerCase().endsWith(city.toLowerCase())) street = street.slice(0, -city.length).replace(/[,\s]+$/, '');
    ora.address = { '@type': 'PostalAddress', streetAddress: street, addressLocality: city || undefined, postalCode, addressCountry: 'LK' };
    ora.hasMap = site.mapsUrl || undefined;
    ora.servesCuisine = 'Coffee';
    if (+site.opensAt !== +site.closesAt) {
      ora.openingHoursSpecification = [{
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: openDays,
        opens: hour(site.opensAt ?? 8), closes: hour(site.closesAt ?? 22)
      }];
    }
  }
  const website = { '@type': 'WebSite', '@id': page && `${page}#website`, url: page, name: 'ORA Space', alternateName: 'ORA', inLanguage: 'en', publisher: page && { '@id': `${page}#ora` } };
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [website, ora] }).replace(/</g, '\\u003c');
}

// Launch extras for the hosted build: link-preview tags (with full addresses once siteUrl is set in
// src/config.js), structured data, the web manifest for home-screen icons, robots.txt and, with siteUrl, a sitemap.
function launchExtras() {
  const address = file => (SITE_URL ? `${SITE_URL}/${file}` : `./${file}`);
  return {
    name: 'ora-launch-extras',
    transformIndexHtml() {
      const tags = [
        // Google shows favicons in results only at multiples of 48px, so offer the 192px icon as well
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '192x192', href: './icon-192.png' } },
        { tag: 'script', attrs: { type: 'application/ld+json' }, children: structuredData() },
        { tag: 'meta', attrs: { property: 'og:site_name', content: 'ORA Space' } },
        { tag: 'meta', attrs: { property: 'og:image', content: address('og-image.jpg') } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: 'The ORA Space logo beneath a lantern-lit golden arch in a garden at dusk' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        { tag: 'link', attrs: { rel: 'manifest', href: './site.webmanifest' } }
      ];
      // site-ownership codes from Google Search Console and Bing Webmaster Tools ("HTML tag" method)
      const verify = { 'google-site-verification': site.googleSiteVerification, 'msvalidate.01': site.bingSiteVerification };
      for (const [name, code] of Object.entries(verify)) {
        const value = String(code || '').trim().replace(/^.*content="([^"]+)".*$/, '$1');
        if (value) tags.push({ tag: 'meta', attrs: { name, content: value } });
      }
      if (SITE_URL) {
        tags.unshift(
          { tag: 'link', attrs: { rel: 'canonical', href: `${SITE_URL}/` } },
          { tag: 'meta', attrs: { property: 'og:url', content: `${SITE_URL}/` } }
        );
      }
      return tags.map(t => ({ ...t, injectTo: 'head' }));
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n${SITE_URL ? `\nSitemap: ${SITE_URL}/sitemap.xml\n` : ''}` });
      if (SITE_URL) {
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n` });
      }
    }
  };
}

// Inline the bundled JS and CSS into index.html for the single-file build.
function inlineEverything() {
  return {
    name: 'ora-inline-everything',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = Object.values(bundle).find(f => f.fileName.endsWith('.html'));
      if (!html) return;
      let src = html.source.toString();
      for (const [name, file] of Object.entries(bundle)) {
        if (name.endsWith('.js')) {
          const tag = new RegExp(`<script[^>]*src="[^"]*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*></script>`);
          const code = file.code.replace(/<\/script/gi, '<\\/script');
          src = src.replace(tag, () => `<script type="module">${code}</script>`);
          delete bundle[name];
        } else if (name.endsWith('.css')) {
          const tag = new RegExp(`<link[^>]*href="[^"]*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`);
          // every current browser reads WOFF2, so drop the heavier WOFF fallbacks
          const css = String(file.source).replace(/,\s*url\(data:font\/woff;base64,[^)]*\)\s*format\(["']?woff["']?\)/g, '');
          src = src.replace(tag, () => `<style>${css}</style>`);
          delete bundle[name];
        }
      }
      // anything left that the page points at (favicons) becomes a data URI
      const mime = { png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml', jpg: 'image/jpeg', ico: 'image/x-icon' };
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type !== 'asset' || file === html || !src.includes(name)) continue;
        const ext = name.split('.').pop();
        const uri = `data:${mime[ext] || 'application/octet-stream'};base64,${Buffer.from(file.source).toString('base64')}`;
        src = src.split('./' + name).join(uri).split(name).join(uri);
        delete bundle[name];
      }
      // every image now lives inside the page, so there is nothing left to load lazily
      html.source = src.replace(/\sloading="lazy"/g, '');
    }
  };
}

// The sign-up form also posts straight to the form service when the page script can't run.
function formFallback() {
  const endpoint = String(site.formEndpoint || '').trim();
  return {
    name: 'ora-form-fallback',
    transformIndexHtml: html => endpoint
      ? html.replace('<form class="form glass" id="joinForm"', `<form class="form glass" id="joinForm" action="${encodeURI(endpoint)}" method="POST"`)
      : html
  };
}

// Browsers refuse "crossorigin" files opened straight from disk. Without it the stylesheet still loads there,
// so a dist/index.html double-clicked by mistake shows the styled no-script page rather than raw HTML.
function plainStylesheet() {
  return {
    name: 'ora-plain-stylesheet',
    enforce: 'post',
    transformIndexHtml: html => html.replace(/<link rel="stylesheet" crossorigin /g, '<link rel="stylesheet" ')
  };
}

export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    // the single file stands alone, so it ships without the public/ extras (share image, icons, 404 page)
    publicDir: single ? false : 'public',
    build: {
      outDir: single ? 'dist-single' : 'dist',
      target: 'es2019',
      assetsInlineLimit: single ? 100_000_000 : 4096,
      cssCodeSplit: !single,
      chunkSizeWarningLimit: 900,
      modulePreload: single ? false : { polyfill: true }
    },
    plugins: single ? [formFallback(), placeInTitles(), inlineEverything()] : [formFallback(), placeInTitles(), plainStylesheet(), launchExtras()]
  };
});
