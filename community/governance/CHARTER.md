# Mask-Lock Standard Project Charter

**Version:** 1.0
**Effective Date:** 2026-03-25
**Last Amended:** 2026-03-25

---

## 1. Mission

The Mask-Lock Standard (MLS) Project exists to develop, maintain, and promote open standards and open-source implementations for physically-immutable inference hardware — chips where neural network weights are encoded in metal via patterns, not stored as mutable data.

Our mission is to make privacy-preserving, tamper-proof AI inference accessible to everyone: from $7 chiplets to $199 desktop accelerators, from medical devices to smart batteries.

## 2. Licensing

### 2.1 Software

All software in the MLS ecosystem is licensed under the **Apache License 2.0**.

This includes:
- CLAWC compiler (`compiler/`)
- Claw agent framework (`claw/`)
- Test infrastructure (`fpga_lab/`)
- Education materials (`education/`)
- CI/CD pipelines and tooling
- Python libraries and utilities

### 2.2 Hardware

All hardware designs (RTL, GDSII, constraints, board files) are licensed under the **CERN Open Hardware Licence Version 2 — Strongly Reciprocal (CERN-OHL-S-2.0)**.

This includes:
- Reference designs (`reference/`)
- FPGA prototypes and bitstreams
- PCB layouts and schematics
- Mask-lock via pattern specifications

### 2.3 Specifications

All standards and specifications are licensed under the **Community Specification License 1.0**, allowing royalty-free implementation by anyone.

This includes:
- MLS v1.0 and future versions (`standards/`)
- RFC documents (`community/rfc/`)
- Compliance test suites

### 2.4 Documentation

All documentation is licensed under **Creative Commons Attribution 4.0 International (CC-BY-4.0)**.

## 3. Governance Structure

```
┌─────────────────────────────────────────┐
│         Community Contributors          │
│  (anyone who submits a patch or RFC)    │
└────────────────┬────────────────────────┘
                 │ elect
                 ▼
┌─────────────────────────────────────────┐
│    Technical Steering Committee (TSC)    │
│  7 members, 2-year staggered terms      │
│  Chair rotates annually                 │
└────────────────┬────────────────────────┘
                 │ charter
                 ▼
┌─────────────────────────────────────────┐
│          Working Groups (WGs)           │
│  Standards · Tools · Education · Ethics │
│  Security · Hardware · Ecosystem        │
└─────────────────────────────────────────┘
```

### 3.1 Technical Steering Committee (TSC)

The TSC is the primary decision-making body for the MLS Project. See [TSC.md](TSC.md) for full details.

**Composition:**
- 7 elected members
- 2-year terms, staggered (3-4 seats per election cycle)
- Chair elected by TSC members, rotates annually

**Responsibilities:**
- Approve major architectural decisions
- Accept or reject RFCs
- Charter and dissolve Working Groups
- Manage release schedules
- Resolve disputes escalated from Working Groups
- Represent the project externally

### 3.2 Working Groups

Working Groups are chartered by the TSC to focus on specific domains. See [WORKING_GROUPS.md](WORKING_GROUPS.md) for current groups.

**Each Working Group has:**
- A chair (appointed by TSC, confirmed by WG members)
- A charter defining scope and deliverables
- Regular meetings (at least monthly)
- Public meeting notes

### 3.3 Contributors

Anyone who submits a patch, RFC, documentation improvement, bug report, or review is a Contributor. Contributors are the lifeblood of the project.

**Contributor levels:**
| Level | Requirements | Privileges |
|-------|-------------|------------|
| **Contributor** | 1+ merged PR | Listed in CONTRIBUTORS.md |
| **Reviewer** | 10+ reviews, nominated by Committer | Can approve PRs (non-binding) |
| **Committer** | 20+ merged PRs, nominated by TSC member | Merge access, binding reviews |
| **TSC Member** | Elected by Contributors | Vote on project direction |

## 4. Decision Making

### 4.1 Lazy Consensus

Most decisions are made by **lazy consensus**:
1. A proposal is made (PR, RFC, mailing list post)
2. A reasonable review period passes (72 hours for minor, 2 weeks for major)
3. If no objections are raised, the proposal is accepted
4. Silence is consent

### 4.2 Formal Vote

If consensus cannot be reached, any TSC member may call a formal vote:
- Each TSC member gets one vote: **+1** (approve), **0** (abstain), **-1** (reject with stated reason)
- Approval requires: simple majority of TSC members casting +1
- A **-1** vote must include a technical justification
- Quorum: 5 of 7 TSC members must participate
- Voting period: 7 calendar days
- Results are recorded in meeting minutes

### 4.3 Escalation Path

```
Contributor disagreement
    → Working Group discussion
        → WG Chair decision
            → TSC review (if appealed)
                → Formal TSC vote (final)
```

## 5. Contribution Process

### 5.1 Code Contributions

1. Fork the repository
2. Create a feature branch
3. Write code + tests + documentation
4. Submit PR against `main`
5. Pass CI (lint, testbenches, compliance)
6. Receive 2 approving reviews (1 must be from Committer)
7. Squash-merge by Committer

### 5.2 RFC Process

For significant changes (new features, breaking changes, new form factors):
1. Write RFC using template in `community/rfc/README.md`
2. Submit as PR to `community/rfc/`
3. 2-week public comment period
4. Working Group review
5. TSC vote to accept/reject/revise

### 5.3 Specification Changes

Changes to the MLS specification require:
1. RFC accepted by TSC
2. Reference implementation in `reference/`
3. Compliance tests in `fpga_lab/`
4. 30-day public review period
5. TSC supermajority (5/7) approval

## 6. Intellectual Property

### 6.1 Contributor License Agreement (CLA)

All contributors must sign the MLS CLA before their first PR is merged. The CLA:
- Grants the project a perpetual, royalty-free license to use contributions
- Confirms the contributor has the right to make the contribution
- Does NOT transfer copyright (contributors retain ownership)

### 6.2 Patent Policy

- Contributors grant a royalty-free patent license for any patents embodied in their contributions
- The project will not knowingly incorporate patented technology without a royalty-free license
- Patent claims against the project or its users result in automatic license termination for the claimant

### 6.3 Trademark

- "Mask-Lock Standard" and "MLS" are trademarks of the MLS Project
- Use in product names requires TSC approval
- "MLS Compatible" certification requires passing the compliance test suite
- "MLS Certified" for individuals requires passing the certification exam

## 7. Code of Conduct

The MLS Project follows the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

**Enforcement:**
- Reports to conduct@mls-project.org
- Investigated by Code of Conduct Committee (3 members, appointed by TSC)
- Responses range from warning to permanent ban
- All reports are confidential

## 8. Financial

### 8.1 Fiscal Sponsorship

The MLS Project operates under fiscal sponsorship of [TBD Foundation]. All donations are tax-deductible where applicable.

### 8.2 Funding Allocation

| Category | Target % |
|----------|---------|
| Infrastructure (CI, hosting, hardware) | 30% |
| Events (conferences, chipathons) | 25% |
| Education (scholarships, materials) | 20% |
| Security (audits, bounties) | 15% |
| Administration | 10% |

### 8.3 Corporate Sponsorship Tiers

| Tier | Annual | Benefits |
|------|--------|----------|
| **Platinum** | $100K+ | TSC observer seat, logo on all materials, 4 conf passes |
| **Gold** | $50K+ | Logo on website, 2 conf passes, quarterly briefing |
| **Silver** | $10K+ | Logo on sponsors page, 1 conf pass |
| **Bronze** | $1K+ | Listed on sponsors page |

Corporate sponsors do NOT receive additional votes or decision-making power. Technical decisions are made on merit alone.

## 9. Amendments

This Charter may be amended by:
1. Proposal via RFC process
2. 30-day public comment period
3. TSC supermajority (5/7) approval
4. Recorded in `community/governance/CHARTER.md` with version bump

---

_This Charter is inspired by governance models from the Linux Foundation, Apache Software Foundation, CNCF, and OpenHW Group._
