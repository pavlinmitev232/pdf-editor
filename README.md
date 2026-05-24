# PDF Editor

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

## Checks

```bash
npm run lint
npm run build
```
