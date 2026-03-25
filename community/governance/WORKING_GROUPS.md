# Working Groups

Working Groups (WGs) are chartered by the TSC to focus on specific technical or community domains. Each WG operates semi-autonomously within its charter scope.

## Active Working Groups

### WG-Standards
**Charter:** Develop and maintain the MLS specification, compliance test suite, and certification program.

| Role | Member |
|------|--------|
| Chair | _TBD_ |
| Scope | `standards/`, `fpga_lab/testbenches/compliance/` |

**Deliverables:**
- MLS specification versions (major: annual, minor: quarterly)
- Compliance test suite updates
- Certification exam question pool
- Interoperability test events

**Meetings:** Weekly, Mondays 16:00 UTC

---

### WG-Tools
**Charter:** Develop the CLAWC compiler, build systems, CI infrastructure, and developer tooling.

| Role | Member |
|------|--------|
| Chair | _TBD_ |
| Scope | `compiler/`, `fpga_lab/Makefile`, `.github/workflows/` |

**Deliverables:**
- CLAWC compiler releases (monthly)
- Target backend support (new PDKs, FPGAs)
- IDE integration (VS Code extension for MLS)
- Package registry for MLS IP blocks

**Meetings:** Weekly, Wednesdays 17:00 UTC

---

### WG-Education
**Charter:** Create and maintain learning materials, certification programs, and community education initiatives.

| Role | Member |
|------|--------|
| Chair | _TBD_ |
| Scope | `education/`, certification programs |

**Deliverables:**
- Course content (Chip Design 101, Privacy Engineering, Compiler Construction)
- Lab environments (Codespaces devcontainers)
- Certification exams (Associate, Professional, Fellow)
- Mentorship program operations
- Workshop materials for conferences

**Meetings:** Bi-weekly, Thursdays 18:00 UTC

---

### WG-Security
**Charter:** Ensure the security properties of mask-lock hardware are correctly implemented and verified. Manage vulnerability disclosure and security audits.

| Role | Member |
|------|--------|
| Chair | _TBD_ |
| Scope | Privacy cascade, weight integrity, side-channel resistance |

**Deliverables:**
- Security audit reports (annual, third-party)
- Vulnerability disclosure process
- Side-channel analysis methodology
- Hardware security best practices guide
- Threat model documentation

**Meetings:** Bi-weekly, Tuesdays 15:00 UTC (some sessions closed for security-sensitive topics)

---

### WG-Hardware
**Charter:** Design and maintain reference implementations for all form factors and FPGA prototypes.

| Role | Member |
|------|--------|
| Chair | _TBD_ |
| Scope | `reference/`, `fpga_lab/platforms/` |

**Deliverables:**
- Reference RTL for each form factor
- FPGA prototype bitstreams
- Board design files (KiCad)
- BOM and manufacturing guides
- Performance benchmarks (monthly)

**Meetings:** Weekly, Fridays 16:00 UTC

---

### WG-Ethics
**Charter:** Ensure MLS technology is developed and deployed responsibly. Consider societal impact, dual-use concerns, and equitable access.

| Role | Member |
|------|--------|
| Chair | _TBD_ |
| Scope | Ethics guidelines, use-case review, access policies |

**Deliverables:**
- Ethical use guidelines for mask-lock chips
- Dual-use technology assessment framework
- Annual impact report
- Recommendations on export control compliance
- Community diversity and inclusion initiatives

**Meetings:** Monthly, first Wednesday 18:00 UTC

---

### WG-Ecosystem
**Charter:** Grow the MLS ecosystem through partnerships, integrations, events, and developer relations.

| Role | Member |
|------|--------|
| Chair | _TBD_ |
| Scope | `community/events/`, partnerships, developer advocacy |

**Deliverables:**
- MLSConf (annual conference)
- Chipathon events (quarterly hackathons)
- Partner integration guides
- Developer newsletter (monthly)
- Social media and blog content

**Meetings:** Bi-weekly, Mondays 18:00 UTC

---

## Creating a New Working Group

### Proposal Process

1. **Draft charter** using the template below
2. **Submit RFC** to `community/rfc/` with WG proposal
3. **2-week public comment period**
4. **TSC vote** (simple majority to approve)

### Charter Template

```markdown
# WG-[Name] Charter

## Mission
[One paragraph describing the WG's purpose]

## Scope
[Specific directories, specifications, or domains this WG owns]

## Out of Scope
[Explicitly list what this WG does NOT cover]

## Deliverables
[Concrete, measurable outputs with timelines]

## Membership
- Open to all Contributors
- Chair appointed by TSC, confirmed by WG members
- Minimum 3 active members to remain chartered

## Meetings
- Frequency: [weekly/bi-weekly/monthly]
- Day/Time: [specify in UTC]
- Notes published to: community/meetings/notes/wg-[name]/

## Success Criteria
[How will the TSC evaluate this WG's effectiveness?]

## Duration
[Permanent or time-limited with specific end date]
```

## Dissolving a Working Group

A WG may be dissolved by TSC vote if:
- Fewer than 3 active members for 3 consecutive months
- Deliverables are complete (for time-limited WGs)
- Scope is absorbed by another WG
- TSC determines the WG is no longer needed

Process:
1. TSC notifies WG members with 30-day notice
2. WG members may petition to continue (requires plan for addressing concerns)
3. TSC final vote after 30-day period
4. Assets transferred to successor WG or archived

## Cross-WG Coordination

- **Monthly cross-WG sync:** First Tuesday of each month, 17:00 UTC
- **Shared Slack channel:** #wg-coordination
- **RFC review:** All WG Chairs review RFCs touching their scope
- **Conflict resolution:** Escalate to TSC if WGs disagree on scope overlap
