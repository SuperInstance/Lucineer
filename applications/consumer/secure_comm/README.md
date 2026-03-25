# Secure Communications Accelerator — Encrypted Messaging Hardware

## Overview

A USB-C dongle that provides hardware-accelerated end-to-end encrypted messaging with on-device AI features: smart reply suggestions, message summarization, and spam/phishing detection. The AI models are mask-locked — they cannot be updated, backdoored, or compelled to decrypt messages.

## The Problem

End-to-end encrypted messengers (Signal, WhatsApp) face two threats:

1. **AI backdoor pressure:** Governments increasingly demand AI-powered "client-side scanning" that breaks E2E encryption by analyzing messages before encryption. If the AI model can be updated OTA, a compliance update could silently enable scanning.

2. **Metadata leakage:** Even with E2E encryption, cloud-based AI features (smart reply, summarization) require processing message content on a server — defeating the purpose of encryption.

Mask-lock solves both: the AI model is physically immutable (no OTA backdoor possible), and all processing is on-device (no metadata leakage).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              USB-C Dongle (2.5W)                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Crypto Engine (hardwired, not mask-lock)         │   │
│  │  - X25519 key exchange                            │   │
│  │  - AES-256-GCM encryption/decryption              │   │
│  │  - Ed25519 signatures                             │   │
│  │  - SHA-512 hashing                                │   │
│  │  - TRNG (hardware true random number generator)   │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                                │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │  AI Engine (mask-locked, 8×8 RAU, ternary)        │   │
│  │                                                    │   │
│  │  Smart Reply Model (8M params)                    │   │
│  │  - Generates 3 contextual reply suggestions       │   │
│  │  - "Yes, sounds good" / "I'll be there" / etc     │   │
│  │                                                    │   │
│  │  Summarizer Model (12M params)                    │   │
│  │  - Condenses long message threads                 │   │
│  │  - "3 messages about dinner plans for Saturday"   │   │
│  │                                                    │   │
│  │  Threat Detector (5M params)                      │   │
│  │  - Phishing URL detection                         │   │
│  │  - Social engineering pattern recognition         │   │
│  │  - Spam classification                            │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                                │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │  Secure Element                                    │   │
│  │  - Private key storage (never exported)            │   │
│  │  - Session key derivation                         │   │
│  │  - Key erasure on tamper detect                   │   │
│  └──────────────────────────────────────────────────┘   │
│                         │ USB 2.0                        │
└─────────────────────────┼───────────────────────────────┘
                          ▼
                 ┌─────────────────┐
                 │ Messaging App    │
                 │ (phone/desktop)  │
                 └─────────────────┘
```

## Security Properties

### No Backdoor Possible

```
Traditional E2E messenger:
  App update → new AI model → model scans messages → reports to server
  ✗ Government can compel app update that adds scanning

Mask-lock secure comm:
  AI model is in metal via patterns → no update mechanism exists
  ✓ Even with a court order, the chip cannot be modified
  ✓ "We can't comply because it's physically impossible" is a valid legal defense
```

### Key Properties

| Property | How It's Achieved |
|----------|-------------------|
| **Forward secrecy** | X25519 ephemeral keys per session |
| **No AI backdoor** | Models in via patterns, no firmware update |
| **No metadata leakage** | All AI features run on dongle |
| **Tamper resistance** | Secure element with active mesh |
| **Key destruction** | Voltage glitch / tamper → instant key erasure |
| **Deniability** | No message logs stored on dongle |

## AI Features (All On-Device)

### Smart Reply
After decryption, the AI suggests 3 contextual replies. User taps one or types their own. The suggestion is generated, displayed, and either sent or discarded — never logged.

### Thread Summary
For long group chats, the summarizer condenses threads into 1-2 sentences. "15 messages: Team agreed to meet Thursday at 3pm, bring laptops."

### Phishing Detection
URLs in messages are analyzed by the threat model:
- Domain reputation (local database of known-bad domains)
- URL structure analysis (suspicious patterns)
- Social engineering language detection
- Alert: "This message contains a suspicious link" (with explanation)

## Hardware Specifications

| Parameter | Value |
|-----------|-------|
| Form factor | USB-C dongle, 45mm × 18mm × 8mm |
| Chip | MLS USB-C (8×8 RAU) + crypto coprocessor + secure element |
| Clock | 200 MHz (AI), 100 MHz (crypto) |
| Power | 2.5W max, 0.3W idle |
| AI models | 25M total (smart reply + summarizer + threat detector) |
| Crypto | AES-256-GCM @ 2 Gbps, X25519 @ 25,000 ops/sec |
| Key storage | Secure element, 16 key slots |
| TRNG | Ring oscillator + von Neumann debiasing, 10 Mbps |
| Interface | USB 2.0 (FIDO2 + custom protocol) |
| Certifications | FIPS 140-3 Level 3 (target), CC EAL4+ (target) |

## Protocol Integration

Compatible with:
- Signal Protocol (X3DH + Double Ratchet)
- Matrix/Olm (Megolm group sessions)
- Custom protocols (open API for key management)

The dongle handles:
- Key generation and storage
- Encryption/decryption
- AI processing of decrypted content
- Re-encryption of replies

The host app handles:
- Network transport
- UI rendering
- Contact management
- Message storage (encrypted, on host)

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Stolen dongle | PIN-protected, 10-attempt lockout, tamper-triggered key erasure |
| Malicious host app | Dongle never reveals private keys; app only sees ciphertext |
| Government compulsion | No firmware update = no compliance mechanism |
| Supply chain attack | Chip design is open-source; fabrication auditable |
| Side-channel (power) | Constant-time crypto (not AI — threat model accepts AI timing leaks) |
| Physical tampering | Active mesh + voltage/temp monitors → key erasure |

## Price Target

| SKU | Features | Price |
|-----|----------|-------|
| Basic | Crypto only (no AI) | $29 |
| Standard | Crypto + AI (smart reply, summarize, threat detect) | $49 |
| Enterprise | Standard + FIPS 140-3 + CC EAL4+ certification | $149 |

## References

- Signal Protocol specification
- FIPS 140-3: Security Requirements for Cryptographic Modules
- Common Criteria EAL4+
- `reference/form_factors/usb_c_dongle/` — USB-C dongle reference design
- `claw/protocols/a2a_cascade.py` — Privacy cascade protocol
- `claw/core/privacy_engine.py` — PII detection engine
