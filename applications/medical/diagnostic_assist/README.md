# Diagnostic Assistant — Local Clinical Decision Support

## Overview

A Thunderbolt box providing clinical decision support for differential diagnosis. Ingests symptoms, vitals, and lab results; suggests diagnoses ranked by probability. Runs entirely offline for field hospitals, ambulances, disaster response, and clinics without internet.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Thunderbolt Box (45W, 4-chip cascade)       │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Chip 0   │──│ Chip 1   │──│ Chip 2   │──│ Chip 3 │ │
│  │ Symptom  │  │ History  │  │ Lab      │  │ Dx     │ │
│  │ Encoder  │  │ Context  │  │ Analysis │  │ Ranker │ │
│  │ 256×256  │  │ 256×256  │  │ 256×256  │  │ 256×256│ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│       │              │              │             │      │
│       └──────────────┴──────────────┴─────────────┘      │
│                     Cascade Bus (PCIe)                    │
│                                                          │
│  Models (mask-locked, ternary):                          │
│  - Clinical BERT (110M params) — symptom understanding   │
│  - MedPaLM-Lite (350M params) — medical reasoning        │
│  - Lab Interpreter (80M params) — lab value analysis      │
│  - Dx Ranker (60M params) — differential diagnosis        │
│  Total: ~600M parameters across 4 chips                  │
└──────────────────────┬──────────────────────────────────┘
                       │ Thunderbolt 3
                       ▼
              ┌─────────────────┐
              │  Clinical       │
              │  Workstation    │
              └─────────────────┘
```

## Workflow

```
Input (structured form):
  Chief complaint: "Chest pain, shortness of breath"
  Duration: "2 hours, acute onset"
  Vitals: HR 110, BP 90/60, SpO2 91%, Temp 37.2°C
  History: "HTN, DM2, smoker 20 pack-years"
  Labs: Troponin 0.45 ng/mL (↑), D-dimer 2.1 μg/mL (↑)

Processing (100% local, 4-chip cascade):
  Chip 0: Encode symptoms → feature vector
  Chip 1: Incorporate history context
  Chip 2: Analyze lab values (flag abnormals)
  Chip 3: Rank differential diagnoses

Output:
  ┌─────────────────────────────────────────────────────┐
  │ DIFFERENTIAL DIAGNOSIS (ranked by probability)       │
  │                                                      │
  │ 1. Acute Myocardial Infarction (STEMI)  [82%]       │
  │    Key findings: Troponin ↑, chest pain, ST changes  │
  │    Recommended: 12-lead ECG, cardiology consult      │
  │                                                      │
  │ 2. Pulmonary Embolism                    [45%]       │
  │    Key findings: D-dimer ↑, tachycardia, hypoxia     │
  │    Recommended: CT-PA, anticoagulation               │
  │                                                      │
  │ 3. Aortic Dissection                     [18%]       │
  │    Key findings: Acute chest pain, hypotension       │
  │    Recommended: CT angiography, surgical consult     │
  │                                                      │
  │ ⚠ CRITICAL: Multiple high-acuity diagnoses.          │
  │   This is decision SUPPORT — clinician judgment      │
  │   required. Not a substitute for clinical evaluation.│
  └─────────────────────────────────────────────────────┘
```

## Target Deployments

| Setting | Connectivity | Key Benefit |
|---------|-------------|-------------|
| Field hospital | None | Full CDS without internet |
| Ambulance | Intermittent | En-route diagnostic support |
| Rural clinic | Unreliable | Always-available second opinion |
| Disaster response | None | Triage assistance at scale |
| Military forward operating base | Classified | Air-gapped medical support |
| Developing nations | Limited | Specialist-level CDS for GP clinics |

## Privacy Guarantees

- Patient data (symptoms, vitals, labs) never leaves the Thunderbolt box
- Inter-chip cascade uses anonymized feature vectors (Level 1 privacy)
- No logging of patient data — only aggregate statistics (diagnosis distribution)
- Device can be physically destroyed after deployment for data assurance

## Specifications

| Parameter | Value |
|-----------|-------|
| Form factor | Thunderbolt 3 enclosure, 150mm × 100mm × 40mm |
| Chips | 4× MLS 256×256 in cascade |
| Total compute | 4× 256×256 = 262,144 RAUs |
| Power | 45W max (fan-cooled) |
| Models | ~600M parameters total (ternary) |
| Latency | < 2 seconds for full differential |
| Interface | Thunderbolt 3 (40 Gbps) |
| Battery option | 4-hour operation on external battery pack |

## Safety & Disclaimers

This system is classified as **Clinical Decision Support (CDS)** — it provides information to assist clinicians but does NOT make autonomous clinical decisions.

Per FDA guidance on CDS:
- Does not acquire, process, or analyze medical images/signals
- Does not provide specific treatment/diagnosis without clinician review
- Clearly presents supporting evidence for each suggestion
- Is intended for use by licensed healthcare professionals only

**This is not a diagnostic device. It is a decision support tool.**

## References

- FDA: "Clinical Decision Support Software" Guidance (2022)
- `reference/form_factors/thunderbolt_box/` — Thunderbolt reference design
- `claw/protocols/a2a_cascade.py` — Multi-chip cascade protocol
