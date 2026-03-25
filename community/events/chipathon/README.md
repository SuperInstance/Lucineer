# MLS Chipathon

## Overview

Chipathons are hackathon-style events focused on mask-lock chip design. Participants form teams, choose a challenge, and build a working prototype in 48 hours.

## Event Format

### Timeline
- **Friday 18:00:** Kickoff, challenge reveal, team formation
- **Saturday:** Hacking (mentors available all day)
- **Sunday 14:00:** Submissions due
- **Sunday 16:00:** Demos and judging
- **Sunday 18:00:** Awards ceremony

### Challenges (rotate each event)

**Challenge 1: Smallest Chip**
Design the smallest possible MLS-compliant inference engine. Minimize gate count while passing the compliance test suite.
- Metric: Gate count (fewer = better)
- Constraint: Must pass `tb_mls_compliance.sv`

**Challenge 2: Fastest Inference**
Maximize tokens-per-second on the KV260 FPGA for a given model.
- Metric: Tokens/second
- Constraint: Must run on KV260 hardware

**Challenge 3: Lowest Power**
Achieve the lowest power consumption while maintaining coherent text generation.
- Metric: Watts (lower = better)
- Constraint: Must generate coherent text (human eval)

**Challenge 4: Best Application**
Build the most creative real-world application using mask-lock inference.
- Metric: Innovation + feasibility (judge panel)
- Constraint: Must use MLS architecture

**Challenge 5: Open Innovation**
Surprise us. Any improvement to the MLS ecosystem.
- Metric: Impact potential (judge panel)
- Constraint: Must be open-source

## Participation

### In-Person
- Hosted at partner universities and company offices
- Equipment provided: KV260 boards, power meters, JTAG cables
- Catering included

### Virtual
- GitHub Codespaces with pre-configured environments
- Discord voice channels for team coordination
- Live-streamed demos and judging

### Team Size
- 2-4 members per team
- Solo participation allowed but teams recommended
- Cross-organization teams encouraged

## Prizes

| Place | Prize |
|-------|-------|
| 1st | KV260 board + $1000 + conference pass |
| 2nd | KV260 board + $500 |
| 3rd | $250 |
| Best First-Timer | KV260 board |
| People's Choice | $250 |

## Past Events

_Events will be listed here as they occur._

## Hosting a Chipathon

Want to host at your university or company? Contact events@mls-project.org with:
- Proposed date and venue
- Expected attendance
- Available equipment
- Sponsor commitments
