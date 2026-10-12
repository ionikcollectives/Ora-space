# ORA Space · Website

**Space · Art · Café — Feel & Belong**

The ORA Space website: a scroll-driven 3D walk through lantern-lit heritage arches under old trees. The hero is the ORA primary logo brought to life, each arch is one room of the house, and a 24-hour sun clock re-lights the garden hour by hour, with the sun straight overhead at noon.

Built with plain HTML, CSS and JavaScript, [Three.js](https://threejs.org) for the 3D scene, and [Vite](https://vite.dev) for the dev server and builds. No framework.

---

## 1. Get started

You need **Node.js 20.19+ or 22.12+** (download the LTS version from [nodejs.org](https://nodejs.org)).

1. Open this folder in VS Code (**File → Open Folder…** and choose `ora-space-site`).
2. Open the terminal (**Terminal → New Terminal**) and run:

   ```bash
   npm install
   npm run dev
   ```

3. Open the link it prints (usually **http://localhost:5173**). Every time you save a file, the page updates instantly.

**Shortcut in VS Code:** press **⌘⇧B** (Mac) or **Ctrl+Shift+B** (Windows) to start the dev server, or press **F5** to start it and open Chrome. Other tasks are under **Terminal → Run Task…** (all start with `ORA:`).

---

## 2. Project structure

```
ora-space-site/
├── index.html          ← all page content and copy (sections, rooms, cards, form)
├── src/
│   ├── config.js       ← your details: opening date, address, contact, form endpoint
│   ├── main.js         ← interactions: scroll journey, rooms, day clock, cursor, menu, form
│   ├── scene.js        ← the 3D world: arches, lanterns, trees, fireflies, sky, lighting
│   ├── style.css       ← design system (colours, type, layout) and all section styles
│   ├── fonts.css       ← brand fonts (Cinzel, Cormorant Garamond, Pinyon Script)
│   └── images/         ← logos from the ORA Logo Suite, favicon
├── public/             ← copied as-is into the hosted build: link-preview image, home-screen icons,
│                         web manifest, 404 page, hosting headers
├── vite.config.js      ← build settings (normal and single-file) and the launch extras
├── wrangler.jsonc      ← Cloudflare deploy settings: serve the built dist/ folder as a static site
├── package.json
├── .nvmrc              ← the Node version hosting services should build with
└── .vscode/            ← one-click tasks and Chrome launch
```

---

## 3. Before launch: fill in `src/config.js`

```js
export default {
  siteUrl: 'https://oraspace.lk',  // the live address: link previews, sitemap, search engines
  openingDate: 'Saturday, 12 December 2026',
  address: 'No. 12, Old Lane, Kandy',
  mapsUrl: 'https://maps.app.goo.gl/…',
  opensAt: 8,                      // 8.00 am, on the 24-hour clock
  closesAt: 22,                    // 10.00 pm
  hours: 'Daily, 8.00 am to 10.00 pm',   // optional; left empty it is written from opensAt and closesAt
  email: 'hello@yourdomain.com',
  phone: '+94 77 123 4567',       // also creates the WhatsApp link
  instagram: 'ora.space',          // without the @
  formEndpoint: 'https://formspree.io/f/xxxxxxx'
};
```

Empty values show a graceful "coming soon" line, so the site looks finished either way.

### Receiving sign-ups

The "Join the Opening List" form is connected to the Formspree form `https://formspree.io/f/xaeqbkbw` (set as `formEndpoint`). Each sign-up arrives in your Formspree inbox and email with the subject "Opening List sign-up: *name*", and includes the name, email, chosen interests (for example "Café, Art") and the optional note.

- **Spam:** the form carries Formspree's hidden `_gotcha` trap, so automated sign-ups are dropped. If Formspree's reCAPTCHA is turned on in the form's settings, turn it off, because the page sends sign-ups in the background and can't show a captcha.
- **Limits:** check your Formspree plan's monthly allowance. Comparison sites put the free plan at about 50 sign-ups a month.
- **Without the page script** (rare), the form still posts straight to Formspree, which then shows its own thank-you page.
- **To use a different service,** change `formEndpoint`. Any service that accepts a JSON `POST` works the same way. Left empty, visitors still see the thank-you message but nothing is stored.

### Launch checklist

1. Set `siteUrl` to the live address. The build then writes full-address link previews, a canonical link, `sitemap.xml` and a sitemap line in `robots.txt`.
2. Send yourself a test sign-up on the live site and check it reaches Formspree.
3. Fill in the opening date, address, map link and contact details (or leave any of them empty for the "coming soon" wording).
4. Run `npm run build` and upload the `dist` folder (see section 5).
5. Paste the live address into WhatsApp or Facebook to check the link preview, and optionally submit `sitemap.xml` in Google Search Console.

---

## 4. Common edits

| I want to change… | Where |
|---|---|
| Headlines, room descriptions, card text | `index.html` (search for the text) |
| Opening hours (the "A day at ORA" clock shows Closed outside them, and the lanterns burn low) | `opensAt` and `closesAt` in `src/config.js` |
| The "A day at ORA" moments: name, starting hour, spaces and text | `MOMENTS` at the top of the day clock code in `src/main.js` |
| Brand colours and fonts | the `:root` block at the top of `src/style.css` |
| Logos | replace files in `src/images/` (keep the same names) |
| Link-preview image (WhatsApp, Facebook, X, LinkedIn) | replace `public/og-image.jpg` (1200 × 630) |
| Home-screen icons | `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` |
| Distance between arches | `ARCH_SPACING` at the top of `src/scene.js` |
| Time-of-day colours of the 3D garden | the `KEYS` table at the top of `src/scene.js` |
| Firefly, leaf and tree counts | `FLY_N`, `LEAF_N`, `TREE_N` in `src/scene.js` |
| Camera framing in each section | `measure()` and `journey()` in `src/main.js` |

**Adding or removing a room:** in `index.html`, add or remove an `<article class="room">` panel and its matching button in `#roomsIndex` (keep the `data-room` and `data-go` numbers in order). The 3D arches and scroll length adjust automatically. Line-drawing icons live in the SVG sprite at the top of `index.html`.

---

## 5. Build and publish

```bash
npm run build          # → dist/          multi-file site, best for hosting
npm run build:single   # → dist-single/   one self-contained index.html (~1.3 MB)
npm run preview        # serves dist/ locally to check the build
```

**Hosting the `dist/` folder** (all have free plans):

- **Netlify Drop**: drag the `dist` folder onto [app.netlify.com/drop](https://app.netlify.com/drop).
- **Cloudflare (connected to GitHub)**: build command `npm run build`, deploy command `npx wrangler deploy`. `wrangler.jsonc` tells Cloudflare to serve `dist` as a static site, so every push to `main` rebuilds the site.
- **Vercel** or **Cloudflare Pages**: connect the project, build command `npm run build`, output folder `dist`.
- **Any web host or cPanel**: upload the contents of `dist/` to `public_html`.

Then connect your own domain in the host's settings. Hosts that build for you read the Node version from `.nvmrc`.

Besides the page itself, `dist/` contains the link-preview image, home-screen icons and `site.webmanifest`, a branded `404.html` that Netlify, Cloudflare Pages and GitHub Pages show for missing addresses, `robots.txt` (plus `sitemap.xml` once `siteUrl` is set), and `_headers`, which Netlify and Cloudflare Pages use to cache the bundled files for a year.

**Single-file build:** `dist-single/index.html` contains everything (code, fonts, logos) and opens with a double-click, so it's handy for sending to someone or as a preview. It leaves out the link-preview tags and home-screen icons, so host the `dist` build for the public site.

> Opening `dist/index.html` directly from your disk shows only a static version of the page (no 3D or animations), because browsers block module scripts loaded from `file://` paths. Use `npm run preview`, host it, or use the single-file build.

---

## 6. Built in

- **Responsive** from 280 px folding phones to 2560 px monitors, in portrait and landscape, with no horizontal scrolling. On narrower screens the 3D arch steps aside so it never sits under the room text.
- **Light on phones and tablets:** touch devices skip the film grain and the live blur behind panels, and the 3D scene uses a lighter setting.
- **Reduced motion:** visitors who prefer it get a calm, static version.
- **No-WebGL fallback:** browsers without 3D get a gradient page with a drawn gold arch. All content still works.
- **Adaptive quality:** on slow devices the scene drops its bloom glow, then lowers its resolution, to stay smooth.
- **Link previews and search:** a share image, home-screen icons, and (with `siteUrl`) a canonical address and sitemap.
- **Accessible:** skip link, keyboard-operable menu, rooms and day clock (arrow keys move an hour, Page Up and Page Down three hours, Home and End go to midnight and 11 pm), labelled form with inline errors.

For testing, adding `?still` to the URL makes the camera snap into position instead of easing.

---

© ORA Space. Brand assets from the ORA Logo Suite. Fonts under the SIL Open Font License via Fontsource. Three.js under the MIT license.
