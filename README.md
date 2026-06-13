# Backstop — Wind-Down Wireframe (Next.js)

Interactive wireframe for the Backstop agent wind-down / dead-man's switch flow.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Build

```bash
npm run build
npm start
```

## Structure

```
app/
  layout.js        Root layout, loads globals.css + metadata
  page.js          Renders the wireframe
  globals.css      Reset, Inter font, animations + utility classes
components/
  BackstopWireframe.jsx   The flow (client component). All screens live here.
```

## The flow

1. Connect to MetaMask
2. Select wallets to liquidate (toggles)
3. Big "S" sweep button
4. Validate the action (World)
5. Wind-down loader with estimated time
6. Copy new private key

Theme toggle (light/dark) is in the top-right of the header.

## Notes

- `BackstopWireframe.jsx` is a client component (`"use client"`) because it uses
  React state and the clipboard API.
- Styling is inline-style objects keyed off a `PALETTES` token system; only the
  keyframes/utility classes live in `globals.css`.
- The MetaMask fox and World marks are hand-built SVG placeholders — swap in the
  official brand assets for production.
# backstop-next
