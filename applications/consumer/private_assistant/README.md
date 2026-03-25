# Private Assistant — Home Device with Zero Cloud Dependency

## Overview

A Thunderbolt box or standalone appliance that provides a full voice assistant experience — wake word, conversation, smart home control, Q&A — with absolutely no cloud connectivity. Your voice, your questions, your habits never leave your home.

## Why This Matters

Every major voice assistant records, transmits, and stores your voice:

| Assistant | Data Sent | Retention | Employees Listen? |
|-----------|-----------|-----------|-------------------|
| Alexa | All audio after wake word | Indefinitely | Yes (confirmed 2019) |
| Google | All audio after wake word | Indefinitely | Yes (confirmed 2019) |
| Siri | All audio after wake word | 6 months+ | Yes (confirmed 2019) |
| **MLS Private Assistant** | **Nothing. Ever.** | **N/A** | **Impossible** |

A mask-lock private assistant is not "privacy-focused" — it is **physically incapable** of sending data anywhere. There is no network interface. There is no microphone-to-cloud path. The weights are in metal. The inference is local. Period.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Private Assistant Appliance                    │
│                                                              │
│  ┌──────────┐                                                │
│  │ Mic Array │ (4× MEMS, beamforming)                       │
│  │ (local)   │                                               │
│  └─────┬────┘                                                │
│        │ I2S (audio never leaves appliance)                   │
│        ▼                                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │          Thunderbolt Box (4-chip cascade)              │    │
│  │                                                        │    │
│  │  Chip 0: Wake Word + ASR (67M params)                 │    │
│  │  Chip 1: Language Understanding (350M params)          │    │
│  │  Chip 2: Knowledge + Reasoning (400M params)           │    │
│  │  Chip 3: Response Generation (350M params)             │    │
│  │                                                        │    │
│  │  Total: ~1.17B parameters (ternary, mask-locked)       │    │
│  │  Power: 30W typical, 45W peak                         │    │
│  └───────────────────────────┬──────────────────────────┘    │
│                              │                                │
│  ┌───────────────────────────▼──────────────────────────┐    │
│  │                 Local Services                        │    │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ │    │
│  │  │ Smart   │ │ Calendar│ │ Timer /  │ │ Knowledge│ │    │
│  │  │ Home    │ │ (local) │ │ Alarm    │ │ Base     │ │    │
│  │  │ (Zigbee)│ │         │ │          │ │ (local)  │ │    │
│  │  └─────────┘ └─────────┘ └──────────┘ └──────────┘ │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────┐                                                │
│  │ Speaker   │ (local TTS output)                            │
│  └──────────┘                                                │
│                                                              │
│  Network interfaces: Zigbee (smart home), Bluetooth (audio)  │
│  NOT present: Wi-Fi, Ethernet, cellular, USB data            │
└──────────────────────────────────────────────────────────────┘
```

## Capabilities

### Voice Interaction
- Wake word detection ("Hey home" — customizable at fabrication)
- Conversational speech recognition (continuous, not command-only)
- Natural language understanding with context carry-over
- Text-to-speech response generation
- Multi-turn dialogue (up to 10 turns)

### Smart Home Control
- Zigbee 3.0 hub built-in (no separate hub needed)
- Lights, thermostats, locks, blinds, plugs
- Scenes and routines (locally configured)
- "Turn off the living room lights"
- "Set thermostat to 68 when I say goodnight"

### Information
- Local knowledge base: encyclopedia, unit conversions, math, definitions
- Weather: requires optional weather radio receiver (NOAA, no internet)
- Time, date, timezone calculations
- Cooking conversions, timers, measurement help

### Entertainment
- Bluetooth audio playback (phone → speaker)
- Radio (optional FM/AM receiver)
- Audiobook player (USB storage)
- Bedtime stories for kids (generated on-device)

### Productivity
- Timers and alarms (multiple, named)
- Shopping list (spoken, stored locally, display on companion app via BLE)
- Calendar (local, iCal import via USB)
- Reminders (time and location-based via BLE beacons)

## What It Cannot Do (By Design)

| Feature | Why Not | Alternative |
|---------|---------|-------------|
| Stream music (Spotify, etc.) | No internet | Bluetooth from phone |
| Make phone calls | No network | Phone's own assistant |
| Order products | No internet | Shopping list → phone app |
| Answer real-time questions | No internet | Local knowledge base |
| Learn your preferences over time | Weights immutable | Fixed model, consistent behavior |
| Update firmware | No update mechanism | Buy new model for updates |

**These are features, not bugs.** The inability to connect to the internet IS the privacy guarantee.

## Hardware Specifications

| Parameter | Value |
|-----------|-------|
| Form factor | Desktop appliance, 120mm diameter × 80mm height |
| Compute | Thunderbolt box internals (4× 256×256 RAU) |
| Power | 30W typical, 45W peak, USB-C PD |
| Microphones | 4× MEMS array with beamforming |
| Speaker | 10W full-range + passive radiator |
| Wireless | Zigbee 3.0 + Bluetooth 5.2 (NO Wi-Fi) |
| Storage | 32GB local (knowledge base, calendar, lists) |
| Models | 1.17B parameters total (ternary, mask-locked) |
| Response latency | < 1.5s (wake word to first speech) |
| Operating temp | 0°C to 40°C |
| Price target | $199 (one-time, no subscription) |

## References

- Zigbee 3.0 specification (Connectivity Standards Alliance)
- `reference/form_factors/thunderbolt_box/` — Thunderbolt cascade design
- `claw/protocols/a2a_cascade.py` — Inter-chip cascade protocol
