# Drug Interaction Checker — On-Device Medication Safety

## Overview

An M.2 card for pharmacy workstations and hospital EHR systems that checks medication interactions against a locally-stored drug database. No patient medication history touches the network — all reasoning happens on the mask-lock chip.

## The Problem

- 7,000-9,000 Americans die annually from medication errors (FDA)
- Current interaction checkers require cloud connectivity
- Patient medication history is PHI — cloud transmission creates HIPAA risk
- Rural pharmacies and field hospitals may lack reliable internet
- Cloud outages can delay critical dispensing decisions

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    M.2 Card (7W)                     │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  Drug Knowledge Graph (mask-locked)          │    │
│  │  - 25,000 drug entities                      │    │
│  │  - 180,000 interaction pairs                 │    │
│  │  - Severity: contraindicated/major/moderate  │    │
│  │  - Encoded in via patterns (immutable)       │    │
│  └────────────────────┬────────────────────────┘    │
│                       │                              │
│  ┌────────────────────▼────────────────────────┐    │
│  │  Interaction Inference Engine (64×64 RAU)    │    │
│  │  - Drug embedding lookup                     │    │
│  │  - Pairwise interaction scoring              │    │
│  │  - Multi-drug combinatorial check            │    │
│  │  - Dosage-dependent severity adjustment      │    │
│  └────────────────────┬────────────────────────┘    │
│                       │                              │
│  ┌────────────────────▼────────────────────────┐    │
│  │  Privacy Filter                              │    │
│  │  - Input: drug names only (no patient ID)    │    │
│  │  - Output: interaction alerts only            │    │
│  │  - Medication list never stored               │    │
│  └─────────────────────────────────────────────┘    │
│                       │ PCIe Gen3 x2                 │
└───────────────────────┼─────────────────────────────┘
                        ▼
               ┌─────────────────┐
               │ Pharmacy System  │
               │ (Epic Willow,    │
               │  QS/1, Rx30)    │
               └─────────────────┘
```

## Workflow

```
Pharmacist scans prescription:
  "Warfarin 5mg" + patient's current meds: ["Aspirin 81mg", "Ibuprofen 400mg"]

                    │
                    ▼ PCIe (drug names only, no patient ID)

M.2 Card processes:
  1. Embed drug names → ternary feature vectors
  2. Check pairwise: Warfarin×Aspirin, Warfarin×Ibuprofen, Aspirin×Ibuprofen
  3. Check combinatorial: Warfarin×Aspirin×Ibuprofen (triple interaction)

                    │
                    ▼ PCIe (alerts only)

Results:
  ┌─────────────────────────────────────────────────────┐
  │ ⚠️  MAJOR: Warfarin + Aspirin                       │
  │    Risk: Increased bleeding                         │
  │    Action: Monitor INR closely, consider dose adj   │
  │                                                      │
  │ 🛑 CONTRAINDICATED: Warfarin + Ibuprofen            │
  │    Risk: GI bleeding, hemorrhage                    │
  │    Action: Do not dispense. Contact prescriber.     │
  │                                                      │
  │ ⚠️  MODERATE: Aspirin + Ibuprofen                   │
  │    Risk: Reduced cardioprotective effect of aspirin │
  │    Action: Separate dosing by 2+ hours              │
  └─────────────────────────────────────────────────────┘
```

## Key Properties

| Property | Implementation |
|----------|---------------|
| **Privacy** | Only drug names cross PCIe bus — no patient ID, no med history stored |
| **Integrity** | Drug knowledge graph in via patterns — cannot be tampered with |
| **Availability** | Works offline — no cloud dependency |
| **Speed** | < 5ms per interaction check (vs 200ms+ cloud API) |
| **Coverage** | 25K drugs, 180K interactions (FDA + DrugBank) |
| **Updates** | New drug data requires new chip (by design — ensures review) |

## Hardware Specifications

| Parameter | Value |
|-----------|-------|
| Form factor | M.2 2280 (Key M) |
| Array size | 64×64 RAU |
| Clock | 400 MHz |
| Power | 7W max, 2W idle |
| Interface | PCIe Gen3 x2 |
| Model size | ~50M parameters (drug knowledge + interaction scoring) |
| Latency | < 5ms per check (up to 10 drugs simultaneously) |
| Throughput | > 200 checks/second |

## References

- FDA Adverse Event Reporting System (FAERS)
- DrugBank database (open-access subset)
- `reference/form_factors/m2_card/` — M.2 reference design
- `claw/core/privacy_engine.py` — Privacy filtering
