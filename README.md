# Rempaint

**A better MS Paint for Windows** — built because classic Paint has no plugin API and no way to extend it. Rempaint keeps the familiar ribbon UI and tools, then goes well past what Paint ever offered: parametric objects for math and diagrams, a real layers system, and a full undo/redo history engine (Upto 60 actions).

---

## ✨ Features

### Classic raster tools
- Pencil, Eraser, Paint Bucket flood fill, Colour Picker (eyedropper), Magnifier (1×/2×/3× zoom cycle)
- Text tool with in-place floating editor

### Selection engine
- **Rectangular** and **free-form Lasso** selection, scoped per-layer
- Rotate 90° CW/CCW, flip horizontal/vertical
- Automatic background-color transparency on cutouts (no more pasting an opaque white box over your artwork)
- Clipboard support (copy/cut/paste) and Ctrl+drag duplication
- Distinct **vector Select & Transform** tool for grabbing individual objects (shapes, text, parametric objects) regardless of layer

### Shapes gallery
20+ vector shapes — lines, curves, polygons, block arrows, stars, callouts and speech bubbles — all with independent outline/fill styling, draggable and resizable after placement.

### Layers
Full layer stack: create, duplicate, delete, reorder, rename, toggle visibility, and lock. Drawing tools and raster selection are scoped to the active layer, so parametric objects (graphs especially) stay untouched by selections on other layers.

### Parametric objects — the part real Paint can't do
- **Number Line generator** — fully configurable range, tick spacing, per-tick labeling, and custom highlighted points with labels. Center-anchored, so extending it via the transform handles grows both ends symmetrically. Double-click to re-open and adjust.
- **Math Text (LaTeX)** — type real LaTeX (`\delta`, `\frac{a}{b}`, `t_0`, …), rendered live via KaTeX. Re-renders at full resolution on every resize instead of blurring like a scaled raster image would.
- **Graph tool** — a full embedded Desmos calculator for plotting equations, inequalities, parametric/polar curves, and point sets, with complete control over grid/axis/label display, per-expression color, and native pan/zoom. Inserted graphs stay fully editable — double-click reopens the exact graph state to keep working on it.

### Dual-color system
Classic Color 1 (foreground) / Color 2 (background) model with a 20-swatch quick palette and a full RGB/hex color dialog.

### History & files
- 60-step undo/redo with full JSON state serialization
- PNG export at full resolution
- Save/reopen full editable projects (`.rempaint` files) — not just flattened images

---

## 🖥️ Installation

Download the latest installer from the [Releases](https://github.com/flashwebby/Rempaint/releases) page:
- `Rempaint-Setup.exe` — standard installer
- `Rempaint.msi` — MSI package for managed/enterprise installs

## 🛠️ Building from source

Requires [Rust](https://rustup.rs/) (stable-msvc), [Node.js](https://nodejs.org/) (LTS), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for Windows (MSVC Build Tools + WebView2).

```bash
git clone https://github.com/<your-username>/rempaint.git
cd rempaint
npm install
cargo tauri dev     # run in development
cargo tauri build   # produce installer + exe
```

---
