# Schema 04 — Minecraft Forge Mod
## Lucineer · ChipCraft Mod

---

## Overview

**Mod Name:** ChipCraft (or Lucineer: ChipCraft Edition)
**Mod ID:** `chipcraft`
**Target:** Minecraft Java Edition 1.20.x (latest LTS with best Forge support)
**Mod Loader:** Forge (MinecraftForge) — most mature, largest community
**Language:** Java 17
**Concept:** Players build functional chip designs using in-game blocks, guided by the Lucineer characters (Volt, Fetch, Cache, etc.) as NPC companions.

---

## 1. Repository Structure

```
chipcraft-mod/                           ← Separate repo from Lucineer web
├── build.gradle
├── gradle.properties
├── settings.gradle
├── gradlew / gradlew.bat
├── src/
│   └── main/
│       ├── java/
│       │   └── com/lucineer/chipcraft/
│       │       ├── ChipCraft.java           ← Main mod class (@Mod)
│       │       ├── registry/
│       │       │   ├── ModBlocks.java       ← Block registry (DeferredRegister)
│       │       │   ├── ModItems.java        ← Item registry
│       │       │   ├── ModEntityTypes.java  ← NPC entity registry
│       │       │   ├── ModMenuTypes.java    ← GUI container registry
│       │       │   ├── ModSounds.java       ← Sound event registry
│       │       │   └── ModCreativeTabs.java ← Creative mode tab
│       │       ├── block/
│       │       │   ├── ComputeBlock.java
│       │       │   ├── MemoryBlock.java
│       │       │   ├── LogicGateBlock.java
│       │       │   ├── IOBlock.java
│       │       │   ├── ClockBlock.java
│       │       │   ├── PowerGridBlock.java
│       │       │   ├── AIAcceleratorBlock.java
│       │       │   ├── RoutingBlock.java
│       │       │   └── ChipFrameBlock.java  ← The 8x8 base plate
│       │       ├── item/
│       │       │   ├── ChipScannerItem.java ← Right-click to analyze design
│       │       │   ├── SiliconWaferItem.java
│       │       │   ├── CircuitBoardItem.java
│       │       │   └── DataCrystalItem.java ← Stores/shares chip designs
│       │       ├── entity/
│       │       │   ├── GuideNPCEntity.java  ← Base class for all guides
│       │       │   ├── VoltEntity.java      ← Voltage guide (yellow lightning)
│       │       │   ├── FetchEntity.java     ← Memory dog (retriever model)
│       │       │   ├── CacheEntity.java     ← Cache squirrel
│       │       │   ├── MergeEntity.java     ← CRDT octopus
│       │       │   ├── CarryEntity.java     ← Carry ant
│       │       │   ├── SwitchEntity.java    ← Transistor gatekeeper
│       │       │   ├── RouterEntity.java    ← Traffic director
│       │       │   └── PixelEntity.java     ← Display specialist
│       │       ├── gui/
│       │       │   ├── ChipDesignerMenu.java      ← 8x8 chip design GUI container
│       │       │   ├── ChipDesignerScreen.java    ← Client-side render
│       │       │   ├── ChipScannerMenu.java        ← Analysis readout GUI
│       │       │   ├── ChipScannerScreen.java
│       │       │   ├── GuideDialogScreen.java      ← NPC conversation UI
│       │       │   └── AgeSelectScreen.java        ← Elementary/Middle/High toggle
│       │       ├── blockentity/
│       │       │   ├── ChipFrameBlockEntity.java   ← Stores chip grid state
│       │       │   └── ChipDesignerBlockEntity.java
│       │       ├── data/
│       │       │   ├── ChipDesign.java             ← Serializable chip grid
│       │       │   ├── ChipAnalysis.java           ← Power/area/component stats
│       │       │   ├── DialogueTree.java           ← NPC conversation data
│       │       │   └── AgeLevel.java               ← ELEMENTARY/MIDDLE/HIGH enum
│       │       ├── network/
│       │       │   ├── ChipCraftNetwork.java        ← Packet channel
│       │       │   ├── ChipDesignSyncPacket.java    ← Sync grid between client/server
│       │       │   └── DialogueTriggerPacket.java
│       │       ├── worldgen/
│       │       │   ├── ChipLabStructure.java        ← Rare generated building
│       │       │   └── GuideNPCSpawner.java         ← Spawn guides in labs
│       │       ├── crafting/
│       │       │   └── ChipCraftingRecipes.java     ← Custom recipe types
│       │       └── client/
│       │           ├── renderer/
│       │           │   ├── GuideNPCRenderer.java    ← Renders NPC models
│       │           │   └── ChipFrameRenderer.java   ← Renders chip frame
│       │           └── model/
│       │               ├── VoltModel.java
│       │               └── FetchModel.java
│       └── resources/
│           ├── META-INF/
│           │   └── mods.toml                        ← Mod metadata
│           ├── assets/chipcraft/
│           │   ├── blockstates/                     ← Block model state files
│           │   ├── models/
│           │   │   ├── block/                       ← Block models (JSON)
│           │   │   └── item/                        ← Item models (JSON)
│           │   ├── textures/
│           │   │   ├── block/                       ← Block textures (16x16 PNG)
│           │   │   │   ├── compute_block.png        ← Green (#22c55e)
│           │   │   │   ├── memory_block.png         ← Purple (#8b5cf6)
│           │   │   │   ├── logic_gate_block.png     ← Blue (#3b82f6)
│           │   │   │   ├── io_block.png             ← Amber (#f59e0b)
│           │   │   │   ├── clock_block.png          ← Pink (#ec4899)
│           │   │   │   ├── power_grid_block.png     ← Red (#ef4444)
│           │   │   │   ├── ai_accelerator_block.png ← Cyan (#06b6d4)
│           │   │   │   └── routing_block.png        ← Slate (#64748b)
│           │   │   ├── item/
│           │   │   └── entity/
│           │   ├── lang/
│           │   │   └── en_us.json                   ← All display names
│           │   └── sounds.json
│           └── data/chipcraft/
│               ├── recipes/                         ← Crafting recipes (JSON)
│               ├── loot_tables/                     ← Block drops
│               ├── tags/                            ← Block/item tags
│               └── structures/                     ← Chip Lab building NBT
```

---

## 2. `mods.toml`

```toml
modLoader = "javafml"
loaderVersion = "[47,)"   # Forge 47.x for MC 1.20.x
license = "MIT"

[[mods]]
modId = "chipcraft"
version = "0.1.0"
displayName = "ChipCraft — Lucineer Edition"
description = """
Build real chip designs in Minecraft! Learn how transistors, memory,
logic gates, and AI accelerators work — guided by Volt, Fetch, Cache,
and the whole Lucineer crew.
"""
logoFile = "chipcraft_logo.png"

[[dependencies.chipcraft]]
    modId = "forge"
    mandatory = true
    versionRange = "[47.0,)"
    ordering = "NONE"
    side = "BOTH"

[[dependencies.chipcraft]]
    modId = "minecraft"
    mandatory = true
    versionRange = "[1.20.1,1.21)"
    ordering = "NONE"
    side = "BOTH"
```

---

## 3. Block Registry Schema

### Block Data Model

```java
// Each chip component block has these properties:
public class ChipComponentBlock extends Block {
    // Block state properties
    public static final IntegerProperty POWER_LEVEL = IntegerProperty.create("power_level", 0, 15);
    public static final BooleanProperty ACTIVE = BooleanProperty.create("active");
    public static final EnumProperty<Direction> FACING = BlockStateProperties.HORIZONTAL_FACING;

    // Block metadata (matches web app data)
    private final ChipComponentType componentType;

    // Drops silicon wafer + specific component item when broken
    // Emits redstone signal when active
    // Right-click opens scanner readout
    // Connects to adjacent routing blocks
}
```

### Block Registry Table

| Block ID | Display Name | Color | Power (W) | Area (mm²) | Redstone Output |
|----------|-------------|-------|-----------|------------|-----------------|
| `chipcraft:compute_block` | Compute Unit | Green `#22c55e` | 2.0 | 4 | 8 (when active) |
| `chipcraft:memory_block` | Memory Array | Purple `#8b5cf6` | 0.5 | 6 | 4 (when accessed) |
| `chipcraft:logic_gate_block` | Logic Gate | Blue `#3b82f6` | 0.1 | 1 | 15 / 0 (output) |
| `chipcraft:io_block` | I/O Interface | Amber `#f59e0b` | 0.3 | 2 | varies |
| `chipcraft:clock_block` | Clock Tree | Pink `#ec4899` | 0.2 | 1 | pulses at configurable rate |
| `chipcraft:power_grid_block` | Power Rail | Red `#ef4444` | 0.0 | 1 | 15 (powers adjacent) |
| `chipcraft:ai_accelerator_block` | AI Accelerator | Cyan `#06b6d4` | 5.0 | 8 | 12 (when processing) |
| `chipcraft:routing_block` | Routing Channel | Slate `#64748b` | 0.05 | 1 | passes signal through |
| `chipcraft:chip_frame` | Chip Frame | Dark metal | — | 64 | — |

---

## 4. Item Registry Schema

```
Item ID                       | Description                          | Crafting
──────────────────────────────|──────────────────────────────────────|──────────────────────────────
chipcraft:silicon_wafer       | Base material for all chip blocks    | Sand x4 + Furnace → 2x wafer
chipcraft:circuit_board       | Intermediate component               | Wafer x3 + Iron x2 (grid)
chipcraft:chip_scanner        | Analyze any chip design              | Circuit board + Compass + Gold
chipcraft:data_crystal        | Store/load a chip design (save slot) | Quartz x4 + Circuit board
chipcraft:volt_spawn_egg      | Spawns Volt NPC                      | Creative only / ChipLab chest
chipcraft:fetch_spawn_egg     | Spawns Fetch NPC                     | Creative only / ChipLab chest
chipcraft:guide_book          | "The Lucineer Handbook"              | Book + Circuit board
chipcraft:age_selector_dial   | Switch dialogue age level            | Gold + Circuit board
```

---

## 5. NPC Entity Schema

### Base: `GuideNPCEntity.java`

```java
public abstract class GuideNPCEntity extends PathfinderMob {
    // All guide NPCs share:
    // - Three-tier dialogue (ELEMENTARY, MIDDLE, HIGH)
    // - Follow-player behavior within 8 blocks
    // - Right-click opens dialogue screen
    // - Particle effects matching their color
    // - Play-idle animations (bob, spin, glow)
    // - React to nearby chip blocks (special dialogue if player builds X component)
    // - Can be "assigned" to a chip frame as a resident guide

    protected AgeLevel currentAgeLevel = AgeLevel.ELEMENTARY;
    protected String[] elementaryDialogue;
    protected String[] middleDialogue;
    protected String[] highDialogue;

    // Goals (AI behavior)
    @Override
    protected void registerGoals() {
        goalSelector.addGoal(1, new FloatGoal(this));
        goalSelector.addGoal(2, new OpenDoorGoal(this, true));
        goalSelector.addGoal(3, new LookAtPlayerGoal(this, Player.class, 8.0F));
        goalSelector.addGoal(4, new FollowPlayerGoal(this, 1.0D, 8.0F, 2.0F));
        goalSelector.addGoal(5, new WaterAvoidingRandomStrollGoal(this, 0.5D));
        goalSelector.addGoal(6, new RandomLookAroundGoal(this));
    }
}
```

### NPC Definitions

| NPC | Model Base | Size | Particle | Special Behavior |
|-----|-----------|------|----------|-----------------|
| `VoltEntity` | Custom (lightning bolt body) | Tiny | Yellow sparks | Speeds up when near Clock blocks |
| `FetchEntity` | Dog/Wolf (retextured) | Small | Blue data packets | Runs to Memory blocks when idle |
| `CacheEntity` | Squirrel (custom) | Tiny | Green leaves | "Hoards" items dropped nearby |
| `MergeEntity` | Octopus (custom, 8 arms) | Medium | Purple tendrils | Multi-arm idle animation |
| `CarryEntity` | Ant (custom) | Tiny | Orange carry particles | Walks in lines between blocks |
| `SwitchEntity` | Door-shaped body | Small | Cyan gate particles | Visibly opens/closes |
| `RouterEntity` | Traffic cone body | Small | Red arrows | Spins when data flows nearby |
| `PixelEntity` | Cube (RGB glowing) | Small | Colored pixels | Color-shifts RGB cycle |

---

## 6. Chip Frame & Design System

### `ChipFrameBlock` + `ChipFrameBlockEntity`

The **Chip Frame** is a 2×2 block structure that, when right-clicked with a Circuit Board, opens the 8×8 Chip Designer GUI.

```
Chip Frame multiblock (2x2 base plate):
  [F][F]
  [F][F]
  F = chipcraft:chip_frame

Right-click the top-left frame block → opens ChipDesignerScreen
```

### `ChipDesign` Data Structure

```java
public class ChipDesign {
    private final UUID designId;
    private final String name;
    private final ComponentType[][] grid;  // [8][8] array
    private final long createdAt;
    private String authorName;

    // Computed stats
    public float getTotalPower() { ... }
    public int getTotalArea() { ... }
    public int getBlockCount(ComponentType type) { ... }
    public ChipRating getRating() { ... }  // S/A/B/C/D based on efficiency

    // Serialization for NBT (block entity storage) + DataCrystal items
    public CompoundTag toNBT() { ... }
    public static ChipDesign fromNBT(CompoundTag tag) { ... }

    // Export to web app format (for BYOC bridge feature — future)
    public JsonObject toWebFormat() { ... }
}
```

### `ChipAnalysis` (Scanner Output)

```java
public class ChipAnalysis {
    public final int totalBlocks;
    public final float totalPowerWatts;
    public final int totalAreaMmSq;
    public final int computeUnits;
    public final int memoryBlocks;
    public final int aiAccelerators;
    public final boolean hasClock;          // valid design requires clock
    public final boolean hasIO;             // valid design requires I/O
    public final boolean hasPower;          // valid design requires power rail
    public final ChipRating overallRating;  // S/A/B/C/D
    public final String[] educationalTips;  // age-appropriate feedback
    public final List<String> warnings;     // "No power rail connected", etc.
}
```

---

## 7. Crafting Recipe Schema

### Key Recipes (JSON format, `data/chipcraft/recipes/`)

```json
// silicon_wafer.json — smelt sand into wafers
{
  "type": "minecraft:smelting",
  "ingredient": { "item": "minecraft:sand" },
  "result": { "item": "chipcraft:silicon_wafer" },
  "experience": 0.2,
  "cookingtime": 200
}

// circuit_board.json
{
  "type": "minecraft:crafting_shaped",
  "pattern": ["W W", "IGI", "W W"],
  "key": {
    "W": { "item": "chipcraft:silicon_wafer" },
    "I": { "item": "minecraft:iron_ingot" },
    "G": { "item": "minecraft:gold_ingot" }
  },
  "result": { "item": "chipcraft:circuit_board", "count": 1 }
}

// compute_block.json
{
  "type": "minecraft:crafting_shaped",
  "pattern": ["CBC", "BCB", "CBC"],
  "key": {
    "C": { "item": "chipcraft:circuit_board" },
    "B": { "item": "minecraft:iron_block" }
  },
  "result": { "item": "chipcraft:compute_block", "count": 4 }
}

// chip_scanner.json
{
  "type": "minecraft:crafting_shaped",
  "pattern": [" C ", "CGC", " I "],
  "key": {
    "C": { "item": "chipcraft:circuit_board" },
    "G": { "item": "minecraft:compass" },
    "I": { "item": "minecraft:iron_ingot" }
  },
  "result": { "item": "chipcraft:chip_scanner", "count": 1 }
}
```

---

## 8. World Generation: Chip Lab Structure

A **rare generated structure** (like a Woodland Mansion but small) containing:
- Pre-built Chip Frame with a demo design
- 1–3 random Guide NPCs spawned inside
- Chest with starter materials (wafers, circuit boards, data crystals with example designs)
- Guide Book explaining the mod

```
Structure rarity: 1 in every ~500 chunks (similar to Desert Well)
Biome: Any flat-ish biome (plains, desert, savanna)
Size: ~15×10×15 blocks

Interior layout:
  ┌─────────────────────┐
  │  [NPC] [NPC] [NPC]  │
  │                     │
  │  [CHIP FRAME 2×2]   │
  │                     │
  │  [CHEST] [LECTERN]  │   ← Lectern holds Guide Book
  └─────────────────────┘
```

---

## 9. Progression System

### Achievements / Advancements

```
chipcraft/root              "First Byte"
                             Place your first chip component block

chipcraft/first_design       "Hello World Chip"
                             Complete an 8×8 chip design with at least 4 block types

chipcraft/power_efficient    "Green Computing"
                             Build a chip with < 5W total power and ≥ 10 blocks

chipcraft/ai_chip            "Neural Pioneer"
                             Build a chip with 2+ AI Accelerator blocks

chipcraft/meet_volt          "Ohm My Goodness"
                             Have a conversation with Volt

chipcraft/all_npcs           "Full Crew"
                             Meet all 8 guide NPCs

chipcraft/scan_design        "Quality Control"
                             Scan a chip design with an S rating

chipcraft/share_design       "Open Source"
                             Store a chip design in a Data Crystal and give it to another player

chipcraft/chip_lab           "Silicon Valley"
                             Find a generated Chip Lab structure
```

---

## 10. Age Level System In-Game

The **Age Selector Dial** item lets players toggle dialogue complexity.
Also configurable in the Mod Config menu.

```java
public enum AgeLevel {
    ELEMENTARY("Elementary", "⭐", "Simple, fun explanations"),
    MIDDLE("Middle School", "📚", "Conceptual explanations with some math"),
    HIGH("High School", "🔬", "Technical, accurate explanations");
}
```

All NPC dialogue, Guide Book text, and scanner analysis tips adapt to the selected level — mirroring the web app exactly.

---

## 11. `build.gradle` Key Config

```groovy
plugins {
    id 'java'
    id 'net.minecraftforge.gradle' version '6.0.+'
}

version = '0.1.0'
group = 'com.lucineer.chipcraft'

minecraft {
    mappings channel: 'official', version: '1.20.1'
    runs {
        client { workingDirectory project.file('run') }
        server { workingDirectory project.file('run') }
        data {
            workingDirectory project.file('run')
            args '--mod', 'chipcraft', '--all',
                 '--output', file('src/generated/resources/'),
                 '--existing', file('src/main/resources/')
        }
    }
}

dependencies {
    minecraft 'net.minecraftforge:forge:1.20.1-47.2.0'
}

jar {
    manifest { attributes(['Implementation-Title': 'ChipCraft', 'Implementation-Version': version]) }
}
```

---

## 12. Bridge to Web App (Future Feature)

When a player has a **Data Crystal** with a chip design, they can:
1. Right-click a **special export block** → generates a QR code / URL
2. URL opens `lucineer.com/import?design=BASE64_ENCODED_CHIP_JSON`
3. Web app loads their Minecraft chip design into the Voxel Chip Lab
4. In BYOC mode, design saves to player's own Cloudflare R2

This creates a **physical ↔ digital loop**:
```
Build in Minecraft → Export → Edit in browser → Import back to Minecraft
```

The `ChipDesign.toWebFormat()` method in the mod outputs the same JSON schema as the web app's grid state.

---

## 13. Implementation Phases

```
Phase 1 (MVP mod):
  - All 8 chip blocks with textures + basic crafting
  - Chip Frame + Chip Designer GUI (8×8 grid)
  - Chip Scanner item + analysis readout
  - Silicon Wafer + Circuit Board + Data Crystal items
  - One NPC: Volt (to prove out the NPC system)
  - Creative tab
  - Basic advancements

Phase 2:
  - All 8 NPCs with models and dialogue
  - Age level system
  - Guide Book
  - Chip Lab world structure

Phase 3:
  - Redstone integration (blocks emit signals based on design)
  - Crafting recipes require chip designs (e.g., use a valid chip design to craft upgrades)
  - Multi-player design sharing via Data Crystals

Phase 4:
  - Web app bridge (export/import)
  - CurseForge + Modrinth release
  - FTB / ATM modpack submission
```
