# Privacy Engineering — HIPAA/GDPR Compliant AI

## Overview

A 6-week course on building privacy-preserving AI systems using hardware
enforcement. Covers differential privacy, data redaction, audit trails,
and regulatory compliance — implemented in the CLAW agent framework.

| | |
|---|---|
| **Duration** | 6 weeks, 8 hours/week |
| **Prerequisites** | Chip Design 101 or equivalent, basic ML |
| **Outcome** | Build a HIPAA-compliant medical inference pipeline |

## Weekly Schedule

### Week 1 — Privacy Threat Modeling
- What data leaks from ML inference?
- Side channels: timing, power, electromagnetic
- Regulatory landscape: HIPAA, GDPR, CCPA

### Week 2 — Differential Privacy Fundamentals
- ε-differential privacy definition
- Laplace and Gaussian mechanisms
- Composition theorems (privacy budget)
- **Exercise:** Implement DP noise injection in Python
- **Reference:** `claw/core/privacy_engine.py`

### Week 3 — Hardware Privacy Enforcement
- Why software privacy fails (memory dumps, cold boot attacks)
- Mask-lock advantage: weights aren't readable data
- Volatile KV cache: power-cycle = data erasure
- **Exercise:** Audit the CLAW privacy engine for HIPAA gaps

### Week 4 — PII Detection and Redaction
- Named entity recognition for medical data
- Hardware regex engines (streaming pattern match)
- Redaction strategies: replacement, generalization, suppression
- **Exercise:** Extend the KV260 privacy filter FPGA prototype
- **Reference:** `reference/fpga_prototypes/kv260_privacy_filter/`

### Week 5 — The Privacy Cascade
- Local → Edge → Cloud escalation
- Data redaction at each boundary
- Privacy escrow (blind aggregation via XOR masking)
- Tamper-proof audit trails (hardware-signed)
- **Exercise:** Implement the medical device cascade
- **Reference:** `claw/examples/medical_device.py`

### Week 6 — Compliance Certification
- HIPAA Security Rule mapping to MLS features
- GDPR data minimization via hardware enforcement
- Writing a System Security Plan (SSP) for an MLS device
- **Capstone:** Certify your medical device design
