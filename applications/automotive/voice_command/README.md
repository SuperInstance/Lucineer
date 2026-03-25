# Automotive Voice Command — Offline In-Car Assistant

## Overview

An M.2 card integrated into vehicle infotainment systems providing fully offline voice command recognition. No cloud dependency, no data collection, no subscription fees. The driver's voice never leaves the vehicle.

## The Problem

Current in-car voice assistants (Alexa Auto, Google Assistant, Siri) require:
- **Constant connectivity:** Fails in tunnels, rural areas, poor coverage
- **Cloud processing:** Voice recordings sent to third-party servers
- **Subscription model:** Features degrade or disable without paid plan
- **Privacy concerns:** Passengers' conversations recorded and analyzed
- **Latency:** 500ms-2s round-trip to cloud, dangerous during driving

In 2024, a major automaker admitted storing 90 days of in-cabin audio "for quality improvement." Mask-lock eliminates this entirely.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Vehicle Head Unit                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              M.2 Card (7W)                         │  │
│  │                                                     │  │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐     │  │
│  │  │ Wake Word│    │ ASR      │    │ NLU      │     │  │
│  │  │ Detector │───►│ Engine   │───►│ + Intent │     │  │
│  │  │ (2M)     │    │ (45M)    │    │ (20M)    │     │  │
│  │  └──────────┘    └──────────┘    └────┬─────┘     │  │
│  │                                       │            │  │
│  │  Always-on: 0.5W     Active: 5W      ▼            │  │
│  │                                 ┌──────────┐      │  │
│  │                                 │ Command   │      │  │
│  │                                 │ Executor  │      │  │
│  │                                 └────┬─────┘      │  │
│  └──────────────────────────────────────┼────────────┘  │
│                                          │ CAN bus       │
│  ┌───────────────────────────────────────▼────────────┐  │
│  │  Vehicle Systems                                    │  │
│  │  HVAC · Navigation · Audio · Phone · Windows        │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Supported Commands

### Navigation (15 intents)
| Command | Action | CAN Message |
|---------|--------|-------------|
| "Navigate to [destination]" | Set navigation destination | NAV_SET_DEST |
| "Take me home" | Navigate to saved home address | NAV_GO_HOME |
| "Find nearest gas station" | POI search (local database) | NAV_POI_SEARCH |
| "How far to destination" | Query remaining distance | NAV_QUERY_DIST |
| "Cancel navigation" | Clear route | NAV_CANCEL |

### Climate Control (10 intents)
| Command | Action | CAN Message |
|---------|--------|-------------|
| "Set temperature to [N] degrees" | Adjust HVAC | HVAC_SET_TEMP |
| "Turn on AC" / "Turn off AC" | Toggle A/C compressor | HVAC_AC_TOGGLE |
| "Defrost windshield" | Enable front defrost | HVAC_DEFROST |
| "Fan speed [1-5]" | Adjust blower | HVAC_FAN_SPEED |

### Media (12 intents)
| Command | Action | CAN Message |
|---------|--------|-------------|
| "Play [artist/song]" | Search local library | MEDIA_PLAY |
| "Next track" / "Previous track" | Skip track | MEDIA_SKIP |
| "Volume up/down" | Adjust volume | MEDIA_VOLUME |
| "Tune to [frequency] FM" | Set radio frequency | MEDIA_RADIO |
| "Bluetooth audio" | Switch source | MEDIA_SOURCE |

### Phone (8 intents)
| Command | Action | CAN Message |
|---------|--------|-------------|
| "Call [contact]" | Dial from contacts | PHONE_DIAL |
| "Answer" / "Hang up" | Call control | PHONE_ANSWER |
| "Read messages" | TTS for recent SMS | PHONE_READ_SMS |
| "Send message to [contact]" | Dictate SMS | PHONE_SEND_SMS |

### Vehicle (5 intents)
| Command | Action | CAN Message |
|---------|--------|-------------|
| "Open/close windows" | Window control | VEH_WINDOW |
| "Lock/unlock doors" | Door control | VEH_DOOR_LOCK |
| "Turn on parking sensors" | Toggle sensors | VEH_PARK_SENS |

## Performance

| Metric | Value | Comparison |
|--------|-------|------------|
| Wake word accuracy | 98.5% | Cloud: 99.2% |
| Command recognition | 96.8% | Cloud: 98.1% |
| False activation rate | < 0.5/hour | Cloud: 0.3/hour |
| Latency (wake → action) | < 200ms | Cloud: 800-2000ms |
| Power (always-on) | 0.5W | Cloud: N/A (mic always hot) |
| Power (active) | 5W | Cloud: N/A |
| Works offline | Always | Never |
| Voice data stored | Never | 30-90 days (cloud) |

## Models

### Wake Word Detector
| Parameter | Value |
|-----------|-------|
| Architecture | Temporal CNN |
| Parameters | 2M (ternary) |
| Wake words | "Hey car" / "Okay drive" (customizable at fab) |
| Always-on power | 0.5W |
| Detection latency | < 50ms |

### ASR (Automatic Speech Recognition)
| Parameter | Value |
|-----------|-------|
| Architecture | Whisper-Tiny variant |
| Parameters | 45M (ternary) |
| Vocabulary | 5,000 words (automotive domain) |
| WER (command phrases) | 3.2% |
| Language | English (other languages: different chip SKU) |

### NLU (Natural Language Understanding)
| Parameter | Value |
|-----------|-------|
| Architecture | BERT-Tiny + intent classifier |
| Parameters | 20M (ternary) |
| Intents | 50 (navigation, climate, media, phone, vehicle) |
| Slot filling | Destination, temperature, contact name, frequency |
| Intent accuracy | 97.5% |

## Automotive Qualification

| Standard | Requirement | Status |
|----------|-------------|--------|
| AEC-Q100 | IC reliability qualification | Design-for (Grade 2: -40 to +105°C) |
| ISO 26262 | Functional safety (ASIL-A) | Non-safety-critical (advisory only) |
| CISPR 25 | EMC for vehicles | Designed for Class 5 compliance |
| ISO 11452 | RF immunity | M.2 shielding + filtering |
| IATF 16949 | Automotive QMS | Production partner required |

## Integration Guide

### CAN Bus Interface

```c
// CAN message format for voice commands
typedef struct {
    uint32_t id;          // CAN ID (0x600-0x6FF reserved for voice)
    uint8_t  dlc;         // Data length (max 8 bytes)
    uint8_t  intent;      // Intent code (0x01-0x32)
    uint8_t  confidence;  // 0-100%
    uint8_t  slot_type;   // Slot data type
    uint8_t  slot_data[4]; // Slot value (e.g., temperature, contact index)
} voice_can_msg_t;

// Example: "Set temperature to 72 degrees"
// CAN ID: 0x610 (HVAC domain)
// intent: 0x11 (SET_TEMP)
// confidence: 97
// slot_type: TEMPERATURE_F
// slot_data: {72, 0, 0, 0}
```

### Head Unit Integration

```
USB-C dongle:  Plug-and-play retrofit for older vehicles
M.2 card:      OEM integration into head unit PCB
PCIe mini:     Tier-1 supplier integration
```

## Business Model

| Channel | Volume | Price Point |
|---------|--------|-------------|
| Aftermarket USB-C dongle | Consumer | $49 |
| OEM M.2 module | 100K+ units/year | $15/unit |
| Tier-1 supplier license | 1M+ units/year | $3/unit + NRE |
| Custom wake word / language | Per SKU | $50K NRE |

## References

- AEC-Q100 Rev. H: Failure Mechanism Based Stress Test Qualification
- ISO 26262: Road vehicles — Functional safety
- SAE J2735: V2X communications
- `reference/form_factors/m2_card/` — M.2 reference design
- `reference/form_factors/m2_card/pcie_phy/claw_m2_driver.c` — Linux driver
