# Technical Steering Committee (TSC)

## Purpose

The TSC provides technical leadership for the Mask-Lock Standard Project. It makes architectural decisions, approves RFCs, manages releases, and ensures the project serves its community.

## Composition

- **7 elected members** with 2-year staggered terms
- **Chair** elected by TSC members, serves 1-year term (renewable once)
- **Secretary** appointed by Chair, records minutes and manages logistics

## Current Members

| Seat | Member | Term Ends | Focus Area |
|------|--------|-----------|------------|
| 1 | _Vacant — Founding election pending_ | 2028-03 | Hardware |
| 2 | _Vacant_ | 2028-03 | Compiler/Tools |
| 3 | _Vacant_ | 2028-03 | Security/Privacy |
| 4 | _Vacant_ | 2027-03 | Verification |
| 5 | _Vacant_ | 2027-03 | FPGA/Prototyping |
| 6 | _Vacant_ | 2027-03 | Education |
| 7 | _Vacant_ | 2028-03 | Ecosystem/Community |

**Chair:** _To be elected_
**Secretary:** _To be appointed_

## Election Process

### Eligibility

**Candidates** must be:
- Active Contributors (5+ merged PRs in the past 12 months) OR
- Active Reviewers (20+ reviews in the past 12 months) OR
- Working Group Chairs

**Voters** must be:
- Contributors with 1+ merged PR in the past 12 months

### Timeline

1. **Nomination period** (2 weeks): Self-nomination or nomination by another Contributor (with consent)
2. **Campaign period** (1 week): Candidates publish platform statements
3. **Voting period** (1 week): Ranked-choice voting via Helios (verifiable, anonymous)
4. **Results announced** within 48 hours of voting close

### Staggered Terms

- Odd-numbered seats (1, 3, 5, 7): Elected in odd years
- Even-numbered seats (2, 4, 6): Elected in even years
- Founding election: All 7 seats, with seats 4-6 serving initial 1-year terms

### Vacancies

If a seat is vacated mid-term:
- TSC appoints an interim member within 30 days
- Special election held at next regular election cycle
- Interim member may run for the seat

## Responsibilities

### Technical Direction
- Define project roadmap and release milestones
- Approve or reject RFCs (supermajority for spec changes)
- Resolve technical disputes escalated from Working Groups
- Set coding standards and CI requirements

### Community Stewardship
- Charter and dissolve Working Groups
- Appoint Working Group Chairs (with WG confirmation)
- Ensure inclusive, welcoming environment
- Manage Contributor → Reviewer → Committer promotions

### External Relations
- Represent the project at conferences and standards bodies
- Negotiate partnerships and sponsorships
- Manage trademark usage requests
- Coordinate with fiscal sponsor

### Release Management
- Approve major version releases (e.g., MLS 2.0)
- Set quality gates for releases (CI pass, compliance, docs)
- Manage LTS (Long-Term Support) branch policy

## Meeting Schedule

### Regular Meetings
- **Bi-weekly** on Tuesdays, 17:00 UTC
- **Duration:** 60 minutes
- **Format:** Video call (Jitsi), open to all Contributors
- **Agenda:** Published 48 hours before meeting

### Special Meetings
- Called by Chair or any 3 TSC members
- 72-hour notice minimum
- Can be closed (security issues, personnel matters)

### Meeting Format

```
1. Roll call and quorum check (5 min)
2. Approve previous minutes (5 min)
3. Working Group reports (15 min)
4. RFC reviews (15 min)
5. Open discussion (15 min)
6. Action items and next meeting (5 min)
```

### Minutes

- Published to `community/meetings/notes/` within 48 hours
- Include: attendees, decisions, action items, vote results
- Recorded (video) with consent of all participants

## Decision Framework

### What requires TSC approval:
- New Working Group creation or dissolution
- RFC acceptance for specification changes
- Major release approval
- Committer promotion
- Charter amendments
- Trademark usage
- Partnerships with commercial entities

### What does NOT require TSC approval:
- Bug fixes and minor improvements
- Documentation updates
- Working Group internal decisions (within charter scope)
- Individual Contributor workflow choices
- Conference talk submissions

## Conflict of Interest

- TSC members must disclose employer and any financial interest in MLS technology
- Members must recuse themselves from votes where they have a direct financial interest
- Disclosure is updated annually and published on the project website
- Failure to disclose is grounds for removal (requires 5/7 vote)

## Removal

A TSC member may be removed for:
- Inactivity (missing 4 consecutive meetings without notice)
- Code of Conduct violation (as determined by CoC Committee)
- Undisclosed conflict of interest
- Vote of no confidence (5/7 TSC members)

Process:
1. Written notice to member with specific concerns
2. 2-week response period
3. TSC discussion (member may participate)
4. Formal vote (member recused)
5. Decision is final

## Bootstrapping

Until the first election:
- Project founders serve as interim TSC
- Founding election held when the project reaches 20 Contributors
- Interim TSC commits to holding election within 12 months of project launch
