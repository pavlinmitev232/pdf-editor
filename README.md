# Patch PDF

A simple browser-first PDF editor for quick visual cleanups.

## Current MVP

- Upload and render a PDF locally in the browser.
- Pick a color from the rendered PDF canvas.
- Add cover boxes using the selected color.
- Add text overlays.
- Move, resize, select, and delete overlays.
- Export a new PDF with overlays baked in.

## Tech

- Next.js
- React
- TypeScript
- Tailwind CSS
- PDF.js for rendering
- pdf-lib for export

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## AdSense setup

The app can load the Google AdSense script when you set a public client ID:

```bash
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-0000000000000000
```

Replace the placeholder with your real AdSense publisher ID. After Google gives you an `ads.txt` line, add it to
`public/ads.txt` and redeploy.

Before applying, replace `hello@yourdomain.com` in the legal pages with your public support email. If you serve ads to
users in the EEA, UK, or Switzerland, configure a Google-certified Consent Management Platform instead of relying on a
custom cookie notice.

## Checks

```bash
npm run lint
npm run build
```
