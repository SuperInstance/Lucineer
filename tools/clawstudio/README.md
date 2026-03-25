# ClawStudio — VS Code Extension for Chip Design as Code

## Overview

ClawStudio is a VS Code extension that transforms chip design from a specialized EDA workflow into a modern software development experience. Write SystemVerilog, compile to FPGA with one click, visualize thermals overlaid on RTL, and learn chip design with integrated tutorials — all without leaving your editor.

## Features

### 1. IntelliSense for SystemVerilog & ClawIR

Full language server protocol (LSP) implementation for SystemVerilog (IEEE 1800-2017) and ClawIR (CLAWC intermediate representation).

**Capabilities:**
- **Autocomplete:** Module ports, signal names, MLS types (`weight_t`, `state_t`, `command_t`)
- **Go to Definition:** Jump to module instantiations, `import` packages, `include` files
- **Find All References:** Track signal usage across hierarchy
- **Hover Information:** Signal width, type, driver/load count, timing path membership
- **Diagnostics:** Real-time lint via Verilator `--lint-only` (runs on save)
- **Snippets:** MLS-specific templates (RAU instantiation, register file, FSM, testbench)
- **Signature Help:** Module port lists with direction, width, description
- **Document Symbols:** Outline view for modules, always/generate blocks, assertions

```json
// Example IntelliSense for MLS types
{
  "weight_t": {
    "type": "enum logic [1:0]",
    "values": ["PLUS_ONE (2'b00)", "ZERO (2'b01)", "MINUS_ONE (2'b10)", "RESERVED (2'b11)"],
    "source": "mls_common.sv:12"
  }
}
```

### 2. One-Click Simulation

Run simulations directly from the editor with zero configuration.

**Workflow:**
1. Open a testbench file (`*_tb.sv` or `tb_*.sv`)
2. Click "Run Simulation" button in editor toolbar (or `Ctrl+Shift+R`)
3. ClawStudio auto-detects:
   - Simulator: Verilator (preferred) → Icarus → Vivado XSIM
   - Dependencies: Traces `import` and `` `include`` to find all source files
   - Top module: Infers from filename or `module` declaration
4. Results appear in integrated terminal
5. Waveform viewer opens automatically on pass/fail

**Simulation Panel:**
```
┌─────────────────────────────────────────────┐
│ ClawStudio Simulation                        │
│                                              │
│ Testbench: tb_rau.sv                         │
│ Simulator: Verilator 5.024                   │
│ Status:    ✓ PASSED (14/14 checks)           │
│ Duration:  0.34s                             │
│ Coverage:  87.3% toggle                      │
│                                              │
│ [View Waveform] [Re-run] [Debug] [Coverage]  │
└─────────────────────────────────────────────┘
```

### 3. Thermal Visualization Overlay

Overlay estimated power density and thermal maps directly on your RTL source code.

**How it works:**
1. ClawStudio runs a lightweight synthesis estimate (Yosys `synth` pass)
2. Extracts per-module gate count and switching activity estimates
3. Maps gate count → power density → thermal contribution
4. Renders colored gutters and inline decorations:

```
// Visual representation in editor:
module synaptic_array #(...)  // 🟢 18.2K gates, 0.4W, 42°C
(
    input  logic clk,
    ...
);
    generate
        for (genvar r = 0; r < ROWS; r++) begin : row
            for (genvar c = 0; c < COLS; c++) begin : col
                rau #(.WIDTH(WIDTH)) u_rau (  // 🟡 82 gates, 3.2mW
                    .clk(clk),
                    ...
                );
            end
        end
    endgenerate

    // Adder tree (pipelined)          // 🔴 4.1K gates, 0.15W, 68°C
    always_ff @(posedge clk) begin
        ...
    end
endmodule
```

**Color coding:**
- 🟢 Green: < 50°C estimated (cool)
- 🟡 Yellow: 50-70°C estimated (warm)
- 🔴 Red: > 70°C estimated (hot — consider pipelining or clock gating)

### 4. Cloud FPGA Programming

Program real FPGAs from VS Code — no local Vivado installation required.

**Supported targets:**
| Platform | Access | Latency |
|----------|--------|---------|
| Local KV260 (USB) | Direct | Seconds |
| Cloud KV260 (remote lab) | SSH tunnel | ~30s |
| AWS F1 (cloud FPGA) | API | ~2 min |
| Compile Cloud (SaaS) | REST API | ~5 min |

**Workflow:**
1. Right-click project → "Synthesize for FPGA"
2. Select target (local, cloud, or compile_cloud)
3. Monitor progress in ClawStudio panel
4. Bitstream downloaded and programmed automatically
5. Register access available via integrated terminal

### 5. Claw Academy Integration

Context-aware learning hints and tutorials integrated into the editing experience.

**Features:**
- **Inline Hints:** Hover over MLS types for explanations + links to tutorials
- **Challenge Mode:** "Try implementing a 4×4 RAU array" with scaffolded code
- **Progress Tracking:** Syncs with `education/` certification progress
- **Error Explanations:** When lint fails, explains the error with MLS context
- **Architecture Cards:** Pop-up diagrams showing how current module fits in the chip

```
┌─────────────────────────────────────────────────┐
│ 💡 Academy Hint                                  │
│                                                  │
│ You're editing a RAU module. The weight decoder  │
│ uses ternary encoding {-1, 0, +1} to eliminate   │
│ multipliers. This saves ~90% gate count vs INT8. │
│                                                  │
│ [Learn More] [Lab 2: Build a MAC Unit] [Dismiss] │
└─────────────────────────────────────────────────┘
```

### 6. GDSII Preview

View generated GDSII layouts directly in VS Code (read-only, for quick inspection).

- Layer-by-layer visualization (metal 1-6, via, poly, diffusion)
- Zoom/pan with mouse
- Click-to-identify cells and nets
- Side-by-side with RTL source

### 7. MLS Compliance Checker

Real-time compliance checking against the MLS v1.0 specification.

**Checks:**
- Weight encoding uses only valid values (`2'b00`, `2'b01`, `2'b10`)
- Register map matches A2A specification offsets
- Privacy cascade levels implemented correctly
- Accumulator width sufficient for array size
- Reserved encoding `2'b11` is never generated

## Installation

### From VS Code Marketplace
```
ext install superinstance.clawstudio
```

### From Source
```bash
cd tools/clawstudio
bun install
bun run compile
# Press F5 in VS Code to launch Extension Development Host
```

### Dependencies
- **Required:** Verilator (for lint + simulation)
- **Optional:** Yosys (for synthesis estimates), GTKWave (for waveforms)
- **Optional:** Vivado WebPACK (for Xilinx FPGA programming)

## Extension Settings

```jsonc
{
  // Simulator preference order
  "clawstudio.simulator": "verilator",  // "verilator" | "icarus" | "vivado"

  // Auto-lint on save
  "clawstudio.lintOnSave": true,

  // Thermal overlay
  "clawstudio.thermalOverlay": true,
  "clawstudio.thermalTarget": "sky130",  // PDK for power estimates

  // Cloud compilation
  "clawstudio.cloudApiKey": "",
  "clawstudio.cloudEndpoint": "https://api.clawcloud.dev",

  // Academy
  "clawstudio.academyHints": true,
  "clawstudio.academyLevel": "intermediate",  // "beginner" | "intermediate" | "advanced"

  // FPGA
  "clawstudio.fpgaTarget": "kv260",
  "clawstudio.fpgaConnection": "local",  // "local" | "ssh" | "cloud"
}
```

## File Structure

```
clawstudio/
├── README.md                   # This file
├── package.json                # Extension manifest
├── syntax/
│   ├── systemverilog.tmLanguage.json   # TextMate grammar for SV
│   ├── clawir.tmLanguage.json          # TextMate grammar for ClawIR
│   └── mls-snippets.json              # MLS-specific code snippets
├── simulation/
│   ├── sim_runner.ts           # Simulation orchestration
│   ├── sim_panel.ts            # Results panel webview
│   └── waveform_viewer.ts      # Integrated waveform display
├── synthesis/
│   ├── synth_runner.ts         # Yosys/Vivado synthesis integration
│   ├── fpga_programmer.ts      # FPGA programming (local + cloud)
│   └── cloud_client.ts         # Compile Cloud API client
├── lsp/
│   ├── sv_language_server.ts   # SystemVerilog LSP
│   ├── completion.ts           # Autocomplete provider
│   ├── diagnostics.ts          # Lint diagnostics
│   └── hover.ts                # Hover information
├── thermal/
│   ├── power_estimator.ts      # Gate count → power estimation
│   ├── thermal_decorator.ts    # Editor gutter decorations
│   └── heatmap_panel.ts        # Full-chip heatmap view
├── academy/
│   ├── hint_provider.ts        # Context-aware learning hints
│   ├── challenge_runner.ts     # Interactive coding challenges
│   └── progress_tracker.ts     # Certification progress sync
├── compliance/
│   ├── mls_checker.ts          # MLS v1.0 compliance validation
│   └── rules.json              # Compliance rule definitions
└── gdsii/
    ├── gdsii_parser.ts         # GDSII file reader
    └── gdsii_viewer.ts         # WebGL layer visualization
```

## Development

```bash
# Install dependencies
cd tools/clawstudio
bun install

# Compile TypeScript
bun run compile

# Watch mode (recompile on change)
bun run watch

# Run tests
bun run test

# Package for marketplace
bun run package  # produces clawstudio-x.y.z.vsix
```

## Keybindings

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+R` | Run simulation |
| `Ctrl+Shift+S` | Synthesize for FPGA |
| `Ctrl+Shift+T` | Toggle thermal overlay |
| `Ctrl+Shift+C` | Run MLS compliance check |
| `Ctrl+Shift+W` | Open waveform viewer |
| `Ctrl+Shift+H` | Toggle Academy hints |

## Roadmap

- [ ] v0.1: Syntax highlighting + basic lint (Verilator)
- [ ] v0.2: IntelliSense (autocomplete, go-to-definition)
- [ ] v0.3: One-click simulation + waveform viewer
- [ ] v0.4: Thermal overlay
- [ ] v0.5: Cloud FPGA programming
- [ ] v0.6: Academy integration
- [ ] v0.7: GDSII preview
- [ ] v1.0: Full release with MLS compliance checker

## References

- VS Code Extension API: https://code.visualstudio.com/api
- Language Server Protocol: https://microsoft.github.io/language-server-protocol/
- IEEE 1800-2017: SystemVerilog standard
- `compiler/clawc/` — CLAWC compiler (used by cloud compilation)
- `education/` — Academy course content
