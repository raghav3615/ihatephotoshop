# ihatephotoshop

A fast, private, browser-based image and layout editor. Built with Next.js and vanilla HTML5 Canvas 2D. Everything runs 100% client-side in the browser—no accounts, no subscriptions, and no files sent to any server.

## Features

### Core Canvas & Layers
- Canvas composition with customizable dimensions and background colors (default white, presets, custom hex, or transparent checkerboard).
- Multi-layer arrangement: reorder layers (bring forward, send backward), toggle visibility, lock layers, duplicate, and remove.
- Multi-canvas tabs: work on multiple compositions side by side, rename tabs, and apply dimension presets (Instagram, YouTube thumbnail, Square, Portrait, Presentation).

### Transform & Cropping
- 8-point interactive resize handles (4 corners + 4 edges) with orientation-aware cursors.
- Top rotation handle with smooth 360-degree rotation.
- Invariant center anchor math: opposite anchor point stays fixed regardless of layer rotation.
- Aspect ratio lock: hold Shift while dragging corner handles, or automatically for images.
- Interactive Crop Tool (shortcut: `C`):
  - Canvas Crop: drag handles or marquee to crop the entire document canvas.
  - Image Layer Crop: crop any selected image layer directly on canvas without affecting other layers.
  - Visual guides: darkened mask outside crop area, rule-of-thirds grid, and live dimension indicator.
  - Apply with Enter or double-click; cancel with Escape.

### Typography
- 14 Google Fonts loaded locally: Inter, Roboto, Montserrat, DM Sans, Space Grotesk, Bebas Neue, Oswald, Anton, Playfair Display, Cinzel, DM Mono, Courier Prime, Caveat, and Pacifico.
- Full typography controls: font size, font weight (300 to 900), italic toggle, text alignment (left, center, right), text fill color, outline stroke, and letter spacing.
- Text layers automatically adapt default color based on canvas luminance (dark text on white/light backgrounds, white text on dark backgrounds).

### Adjustments & Blend Modes
- Real-time photo adjustments: Brightness, Contrast, Saturation, Blur, Invert, Sepia, Grayscale, and Hue-Rotate.
- Photoshop blend modes: Normal, Multiply, Screen, Overlay, Darken, Lighten, Color Dodge, and Difference.
- Layer operations: Flip Horizontal, Flip Vertical, Center Horizontally, Center Vertically.
- Vector shapes: rounded rectangles with adjustable corner radius and circles with custom fill and stroke.
- Eyedropper tool (shortcut: `I`): click anywhere on canvas to sample pixel color.

### Import & Export
- Import images (PNG, JPG, WebP, SVG) and PDF documents via drag-and-drop or file selector.
- Export options:
  - PNG (high-resolution with transparency support)
  - JPG (optimized photo format)
  - WebP (lightweight web image)
  - PDF (single-page printable document)
  - Direct Clipboard Copy (copy rendered image to paste into Figma, Slack, docs, etc.)

### Themes & Display
- Calibrated light and dark modes with synchronized local storage (`ihp-theme`).
- Responsive UI down to mobile displays (bottom docking navigation on screens under 640px).

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `V` | Move / Select Tool |
| `H` | Hand / Pan Tool |
| `C` | Crop Tool |
| `T` | Add Text Layer (Heading preset) |
| `R` | Add Rectangle Shape Layer |
| `O` | Add Circle Shape Layer |
| `I` | Eyedropper / Color Picker |
| `Enter` | Apply Active Crop |
| `Escape` | Cancel Active Crop / Deselect Layer |
| `Ctrl` / `Cmd` + `Z` | Undo |
| `Ctrl` / `Cmd` + `Y` (or `Shift`+`Z`) | Redo |
| `Ctrl` / `Cmd` + `D` | Duplicate Selected Layer |
| `Delete` / `Backspace` | Remove Selected Layer |
| `Arrow Keys` | Nudge Layer 1px (`Shift` + Arrow for 10px) |
| `Ctrl` / `Cmd` + Scroll | Zoom in / Zoom out |
| `Space` + Drag | Pan Canvas |

## Getting Started

### Prerequisites
- Node.js 18.18.0 or later
- npm or pnpm

### Installation

```bash
git clone https://github.com/raghav3615/ihatephotoshop.git
cd ihatephotoshop
npm install
```

### Running Locally

To start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page or [http://localhost:3000/canva](http://localhost:3000/canva) for the editor.

### Production Build

```bash
npm run build
npm run start
```

### Standalone HTML Server

The editor can also run as a standalone static HTML/JS application without the Next.js runtime:

```bash
node server.js
```

Open [http://localhost:4173](http://localhost:4173).

## Project Structure

```
├── app/
│   ├── api/editor-shell/   # API route serving editor markup
│   ├── canva/              # Next.js editor studio page (/canva)
│   ├── editor-shell-content.js # Shared editor DOM markup
│   ├── editor.css          # Calibrated dark theme and editor layout
│   ├── globals.css         # Global Tailwind and base styles
│   ├── landing-extra.css   # Landing page tool strip and utilities
│   ├── layout.js           # Root layout and font imports
│   └── page.js             # Landing page (/)
├── app.js                  # Canvas 2D engine, transform math, tools, state
├── index.html              # Standalone static editor shell
├── server.js               # Lightweight Node static file server (port 4173)
├── styles.css              # Main workspace UI styles and breakpoints
└── next.config.mjs         # Next.js configuration
```

## Deployment

### Vercel
Deploy directly by importing the repository into Vercel. Next.js App Router configuration is auto-detected.

### Netlify / Node VPS
Run `npm run build` followed by `npm run start`. The application uses standard Next.js standalone/server output.

## License

MIT
