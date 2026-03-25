# MLS Request for Comments (RFC) Process

## Overview

RFCs are the mechanism for proposing significant changes to the MLS ecosystem. Inspired by Python PEPs, Rust RFCs, and IETF RFCs, this process ensures that major decisions are made transparently with community input.

## When to Write an RFC

**Required for:**
- Changes to the MLS specification
- New form factor reference designs
- New compiler backend targets
- Breaking changes to APIs or protocols
- New Working Group proposals
- Governance changes

**NOT required for:**
- Bug fixes
- Documentation improvements
- Minor refactors
- New tests or benchmarks
- Dependency updates

## RFC Lifecycle

```
    ┌──────────┐
    │  Draft   │  Author writes RFC, opens PR
    └────┬─────┘
         │ PR opened
         ▼
    ┌──────────┐
    │ Proposed │  2-week public comment period
    └────┬─────┘
         │ Comments addressed
         ▼
    ┌──────────┐
    │  Review  │  Relevant WG reviews, TSC discusses
    └────┬─────┘
         │ TSC vote
         ▼
    ┌──────────┐     ┌──────────┐
    │ Accepted │     │ Rejected │
    └────┬─────┘     └──────────┘
         │ Implementation complete
         ▼
    ┌──────────┐
    │  Final   │  Reference implementation merged
    └────┬─────┘
         │ (eventually)
         ▼
    ┌──────────────┐
    │  Deprecated  │  Superseded by newer RFC
    └──────────────┘
```

## RFC Template

Every RFC must follow this structure:

```markdown
# RFC-NNNN: [Title]

- **Author(s):** [Names and GitHub handles]
- **Status:** Draft | Proposed | Accepted | Rejected | Final | Deprecated
- **Created:** [YYYY-MM-DD]
- **Updated:** [YYYY-MM-DD]
- **Supersedes:** [RFC-NNNN, if applicable]
- **Superseded by:** [RFC-NNNN, if applicable]

## Abstract

[One paragraph summary — what is this RFC about?]

## Motivation

[Why is this change needed? What problem does it solve?
What use cases does it enable?]

## Specification

[Detailed technical specification. Be precise enough that
an independent implementation is possible from this document alone.]

## Rationale

[Why this design? What alternatives were considered?
What are the trade-offs?]

## Backwards Compatibility

[Does this break existing implementations? If so, what is
the migration path? If not, explain why.]

## Reference Implementation

[Link to PR or branch with reference implementation.
Required before RFC can move to "Final" status.]

## Security Considerations

[What security implications does this change have?
How are they mitigated?]

## Test Plan

[How will this change be verified? What new tests are needed?]

## Unresolved Questions

[Open questions to be resolved during the review process.]

## References

[Links to related RFCs, papers, specifications, etc.]
```

## Numbering

- RFCs are numbered sequentially: 0001, 0002, 0003, ...
- Numbers are assigned when the PR is opened (not when accepted)
- Rejected RFCs keep their number (the number is never reused)

## How to Submit

1. Fork the repository
2. Create `community/rfc/NNNN-short-title.md` (use next available number)
3. Fill in the template
4. Open PR with title `RFC-NNNN: Short Title`
5. Label PR with `rfc` and relevant WG labels
6. Post to mailing list / Slack announcing the RFC

## Review Process

1. **Author** addresses all comments within the 2-week period
2. **Relevant WG** provides formal review (approve/request-changes)
3. **TSC** discusses at next regular meeting
4. **TSC vote:**
   - Simple majority for most RFCs
   - Supermajority (5/7) for specification changes
5. **Result** recorded in RFC header and meeting minutes

## Index

| RFC | Title | Status | Author |
|-----|-------|--------|--------|
| [0001](0001-mask-lock-standard.md) | Mask-Lock Standard v1.0 | Final | SuperInstance |
| [0002](0002-cascade-protocol.md) | Privacy Cascade Protocol | Proposed | SuperInstance |
