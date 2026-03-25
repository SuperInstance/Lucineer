# ClawView — 3D Chip Visualization

## Overview

ClawView is an interactive 3D visualization tool for mask-lock chip designs. Built on Three.js, it extends the existing Lucineer voxel-explorer to render GDSII layouts, thermal heatmaps, and critical timing paths in a navigable 3D scene.

## Features

### 1. GDSII Layer Visualization

Render chip layouts with per-layer visibility controls:

```
┌─────────────────────────────────────┐
│  ClawView — chip_top.gds            │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │    [3D rendered chip view]  │    │
│  │    Metal layers M1-M6       │    │
│  │    Via connections          │    │
│  │    RAU array grid           │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                      │
│  Layers: □M1 ■M2 □M3 ■M4 □M5 ■M6  │
│  □Vias □Poly □Diffusion □Wells      │
│  Zoom: [+][-]  Rotate: [drag]       │
└─────────────────────────────────────┘
```

**Capabilities:**
- Toggle individual layers on/off
- Color-coded by layer purpose (signal, power, weight storage)
- Highlight weight-carrying layers (M4, M6) to visualize mask-lock patterns
- Click any cell to see module name, dimensions, net connections
- Export rendered view as PNG/SVG

### 2. Thermal Heatmap

Real-time thermal visualization overlaid on chip geometry:

- Color gradient: blue (cool) → green → yellow → red (hot)
- Data sources:
  - Post-synthesis power estimates (Yosys/Vivado)
  - FPGA measurement data (`fpga_lab/measurements/thermal/`)
  - Simulation-based switching activity
- Identify hotspots before fabrication
- Compare designs side-by-side

### 3. Timing Path Visualization

3D trace of critical timing paths through the chip:

- Highlight start/end flops of critical paths
- Color-code by slack (green = met, red = violated)
- Animate signal propagation along paths
- Filter by path group (clock-to-clock, I/O, multicycle)
- Import timing reports from Vivado/OpenSTA

### 4. RAU Array Inspector

Drill into the systolic array structure:

- Visualize weight distribution across RAUs
- Show data flow direction (activations horizontal, weights vertical)
- Highlight zero-weight RAUs (clock-gated, shown transparent)
- Animate inference computation wave through the array

## Architecture

```
┌──────────────────────────────────────────────┐
│  ClawView Application (Next.js page)          │
│                                               │
│  ┌────────────┐  ┌───────────────────────┐   │
│  │ GDSII      │  │ Three.js Scene         │   │
│  │ Parser     │──│  ├─ LayerMeshGroup     │   │
│  │ (gdsii.ts) │  │  ├─ ThermalOverlay     │   │
│  └────────────┘  │  ├─ TimingPathLines    │   │
│                  │  ├─ RAUArrayGrid       │   │
│  ┌────────────┐  │  ├─ OrbitControls      │   │
│  │ Thermal    │──│  └─ AnnotationSprites  │   │
│  │ Data       │  └───────────────────────┘   │
│  │ (csv/json) │                               │
│  └────────────┘  ┌───────────────────────┐   │
│                  │ Control Panel (React)   │   │
│  ┌────────────┐  │  ├─ LayerToggles       │   │
│  │ Timing     │──│  ├─ ThermalRange       │   │
│  │ Report     │  │  ├─ PathFilter         │   │
│  │ (.rpt)     │  │  └─ ExportButtons      │   │
│  └────────────┘  └───────────────────────┘   │
└──────────────────────────────────────────────┘
```

## File Structure

```
clawview/
├── README.md
├── src/
│   ├── index.ts                # Entry point
│   ├── parsers/
│   │   ├── gdsii_parser.ts     # GDSII binary format reader
│   │   ├── thermal_loader.ts   # CSV/JSON thermal data import
│   │   └── timing_parser.ts    # Vivado/OpenSTA timing report parser
│   ├── renderers/
│   │   ├── chip_scene.ts       # Three.js scene setup
│   │   ├── layer_mesh.ts       # GDSII polygon → 3D mesh conversion
│   │   ├── thermal_overlay.ts  # Heatmap texture generation
│   │   ├── timing_lines.ts     # Critical path line rendering
│   │   └── rau_grid.ts         # Systolic array visualization
│   ├── controls/
│   │   ├── layer_panel.tsx     # Layer visibility toggles
│   │   ├── thermal_panel.tsx   # Thermal range controls
│   │   └── info_panel.tsx      # Cell/net information display
│   └── utils/
│       ├── color_scales.ts     # Thermal/timing color gradients
│       └── geometry.ts         # Polygon triangulation utilities
├── public/
│   └── sample_data/
│       ├── usb_dongle.gds      # Sample GDSII for demo
│       └── thermal_sim.json    # Sample thermal data
└── package.json
```

## Integration

ClawView integrates with the existing Lucineer application:

- **Standalone page:** `src/app/clawview/page.tsx`
- **Embedded component:** `<ChipViewer gdsiiPath="..." />`
- **VS Code extension:** ClawStudio embeds ClawView in a webview panel
- **Voxel Explorer bridge:** Shares Three.js scene utilities with `src/app/voxel-explorer/`

## Usage

```bash
# Development
cd tools/clawview
bun install
bun run dev     # Standalone dev server on port 3001

# Build
bun run build   # Outputs to dist/

# Open a GDSII file
clawview open build/gds/chip_top.gds

# With thermal overlay
clawview open chip.gds --thermal thermal_data.json

# With timing paths
clawview open chip.gds --timing timing_summary.rpt
```

## References

- Three.js documentation: https://threejs.org/docs/
- GDSII Stream Format: Calma GDS II reference
- `src/app/voxel-explorer/` — Existing 3D visualization codebase
- `compiler/clawc/backend/gdsii_gen.py` — GDSII generator
