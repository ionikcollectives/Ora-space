import { defineConfig } from 'vite';
import site from './src/config.js';

/*
  npm run build          → dist/         (regular multi-file site, best for hosting)
  npm run build:single   → dist-single/  (one self-contained index.html, opens by double-click)
*/

const SITE_URL = String(site.siteUrl || '').trim().replace(/\/+$/, '');

// Launch extras for the hosted build: link-preview tags (with full addresses once siteUrl is set in
// src/config.js), the web manifest for home-screen icons, robots.txt and, with siteUrl, a sitemap.
function launchExtras() {
  const address = file => (SITE_URL ? `${SITE_URL}/${file}` : `./${file}`);
  return {
    name: 'ora-launch-extras',
    transformIndexHtml() {
      const tags = [
        { tag: 'meta', attrs: { property: 'og:site_name', content: 'ORA Space' } },
        { tag: 'meta', attrs: { property: 'og:image', content: address('og-image.jpg') } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: 'The ORA Space logo beneath a lantern-lit golden arch in a garden at dusk' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        { tag: 'link', attrs: { rel: 'manifest', href: './site.webmanifest' } }
      ];
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
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}/</loc></url>\n</urlset>\n` });
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
    plugins: single ? [formFallback(), inlineEverything()] : [formFallback(), plainStylesheet(), launchExtras()]
  };
});
