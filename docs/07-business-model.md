# Business Model — Economics, Pricing, and Exit

**Synthesized from**: `SuperInstance_Investor_Pitch.md`, `SuperInstance_Executive_Summary.md`, `mask_locked_plan.txt` §6, `research/cycle12_game_theory.md`, `research/cycle13_sociotechnical.md`, `research/Funding_Strategy_Report_2026.md`, `customer_validation_research/SuperInstance_Customer_Validation_Report.md`, `download/Investment_Memorandum_v2.docx`, `download/Exit_Strategy_Analysis_2025.md`

---

## The Model in One Sentence

Customers pay once for a hardware chip that permanently runs a specific AI model — no subscriptions, no cloud, no software updates required. "Upgrades" mean buying the next-generation chip.

**The game cartridge analogy**: Different cartridges = different models. The host device (Raspberry Pi, industrial controller, robot) is the "console." SuperInstance chips are the "cartridges." You swap cartridges to change what model runs locally.

---

## Market Sizing

| Segment | 2025 TAM | 2030 SAM | Growth |
|---|---|---|---|
| Edge AI chips (total) | $26B | $69B | 21% CAGR |
| Sub-$100 edge AI | $4B | $14B | 28% CAGR |
| **Sub-$100 LLM-capable edge** | **$0** (unclaimed) | **$8B** (projected) | New market |

**Beachhead markets** (in priority order):
1. **Maker / hobbyist** (70M Raspberry Pi owners, developer boards) — fastest adoption, highest volume, lowest ASP
2. **Industrial IoT** (air-gapped inference, no cloud connectivity required) — slower adoption, higher ASP, longer sales cycles
3. **Robotics** (on-device reasoning, low latency required) — high willingness to pay, volume grows with robotics adoption
4. **Consumer electronics OEM** (embedded in appliances, point-of-sale, kiosks) — high volume, low ASP, relationship-driven

---

## Cost Structure

### Development Costs (NRE)

| Item | 28nm Node | Notes |
|---|---|---|
| Mask set | $2-3M | One-time per chip revision |
| RTL design & verification | $1-2M | 12 months, 4-person team |
| Physical design (P&R) | $500K-1M | Can partially outsource |
| MPW shuttle (prototype) | $50-200K | First silicon before production mask |
| IP licensing | $100-300K | EDA tools, foundry PDK |
| **Total NRE** | **$3.65M-6.5M** | Covered by seed + Series A |

### Unit Economics

| Cost Component | @1K units | @10K units | @100K units |
|---|---|---|---|
| Die cost (28nm) | $25-40 | $8-15 | $4-8 |
| Packaging (QFN/LGA) | $3-5 | $2-3 | $1-2 |
| Test (ATE) | $5-10 | $3-5 | $1-2 |
| **Total COGS** | **$33-55** | **$13-23** | **$6-12** |

**Gross margins by price point**:
| Retail Price | COGS @10K | Gross Margin |
|---|---|---|
| $35 (Micro) | $13-23 | 34-63% |
| $60 (Standard) | $13-23 | 62-78% |
| $89 (Pro) | $18-28 | 69-80% |

Hardware at 60-80% gross margin is exceptional. Apple-level margins on a single-purpose hardware product.

---

## Product Line and Pricing

| SKU | Model Size | Throughput | Power | Price | Target Market |
|---|---|---|---|---|---|
| **Nano** | 1B params | 100 tok/s | <1W | $15 | Hobbyist, IoT sensors |
| **Micro** | 2-3B params | 80 tok/s | 2-3W | $35 | Maker, Raspberry Pi |
| **Standard** | 7B params | 50 tok/s | 4-6W | $60 | Developer, industrial |
| **Pro** | 13B params | 30 tok/s | 8-12W | $89 | Professional edge |

**Generation model**: Each new model generation (better LLM + same chip price) drives hardware upgrade cycle. Gen 1 ships BitNet b1.58-2B. Gen 2 ships next-generation ternary model. Customers who want better AI buy new chips — like smartphone upgrades.

---

## Revenue Projections

| Milestone | Timeline | Units | Revenue | Cumulative |
|---|---|---|---|---|
| First revenue | Month 18 | 10K | $350K | $350K |
| Market traction | Month 24 | 50K | $2.25M | $2.6M |
| Series A target | Month 30 | 150K | $7.5M | $10.1M |
| Category leadership | Month 36 | 500K | $25M | $35.1M |

**Revenue mix at scale**:
- 60% direct (online store, developer marketplace)
- 30% distributor (Adafruit, SparkFun, Mouser, Digi-Key)
- 10% OEM (volume deals, custom cartridge variants)

---

## Funding Ask

### Seed Round: $500K

**18-month runway, Gate 0 → Gate 2**

| Allocation | Amount | Purpose |
|---|---|---|
| Architecture lead (salary) | $150K | Most critical hire; guides all technical decisions |
| ML engineer (salary) | $100K | BitNet integration, quantization validation |
| FPGA prototype hardware | $50K | KV260 + peripherals + test equipment |
| Patent filings (5 provisionals) | $50K | Establish priority date against Taalas |
| Runway buffer | $150K | 6-month cushion for hiring delays |

**Gates**:
- Gate 0 (Month 3): FPGA prototype at 25 tok/s → unlocks architecture freeze
- Gate 1 (Month 6): 15 signed LOIs + patents filed → unlocks MPW tapeout budget
- Gate 2 (Month 18): 10K production units + first revenue → unlocks Series A

### Series A: $5-8M (Month 12-18)
- Production mask set ($2-3M)
- Full RTL team (3 additional engineers, 12 months)
- Physical design (outsource or in-house)
- Inventory and assembly ($500K)
- Sales & marketing ($1M)

---

## Exit Analysis

### Primary Target: Qualcomm (50-60% probability)

Qualcomm's strategic situation:
- Snapdragon is dominant in mobile but has no compelling edge AI inference story
- They've been aggressively acquiring AI companies ($2.4B Alphawave, 2025)
- SuperInstance gives them an edge inference cartridge that pairs with Snapdragon hosts
- Financial capacity: $35B cash on hand

| Stage | Timing | Trigger | Valuation |
|---|---|---|---|
| Early acquisition | Month 18-24 | FPGA prototype + IP | $50-150M |
| Growth acquisition | Month 36-48 | $5M ARR + category | $200-500M |
| Late stage | Month 48-60 | $20M ARR + profitable | $500M-1.5B |

### Secondary Target: Apple (30-40% probability)

Apple's privacy narrative is a perfect fit for offline edge inference. They've acquired DarwinAI ($100M, 2024) and Xnor.ai ($200M, 2020) for edge AI. SuperInstance would enhance Apple Silicon's Neural Engine for specialized inference.

### Tertiary: NVIDIA (15-25% probability)

NVIDIA paid $20B for Groq (cloud inference). Edge inference is the adjacent frontier. SuperInstance as "Groq for edge" is a natural extension, but NVIDIA's current focus is data center.

---

## Competitive Strategy (Game Theory Analysis)

From `research/cycle12_game_theory.md`:

The competitive landscape follows a classic **Blue Ocean** pattern: all major players are competing in the expensive, power-hungry tier ($100-300, >5W). The sub-$100, sub-5W LLM segment is a **non-compete zone** — too small for NVIDIA's margins, wrong market for Taalas, architecturally limited for Hailo.

**Nash equilibrium**: All competitors have equilibrium strategies that avoid our market. NVIDIA maximizes gross margin by staying above $200. Hailo maximizes revenue with vision hardware. Taalas maximizes funding multiple by targeting data center. Samsung maximizes revenue by selling memory to everyone.

Our optimal strategy: **occupy the blue ocean quickly**, build design wins and patents, then let the market's growth make us too large to ignore (triggering acquisition interest).

**Payoff matrix** (from `research/cycle12_results.json`):
- If we move fast + build IP: Expected value = $280M exit (probability-weighted)
- If we move slow + no IP: Expected value = $45M exit (acquisition before scale)
- If we do nothing: competitors enter the market in 18 months, opportunity lost

---

## Why "The Nintendo of AI" Is the Right Analogy

Nintendo's business model for 40+ years:
1. Sell hardware at or near cost (sometimes below)
2. Make margin on software (game cartridges) and licensing
3. Create a platform that third-party developers build for
4. Use hardware generations to drive upgrade cycles

SuperInstance's model:
1. Sell chips at 60-80% gross margin (even better than Nintendo hardware)
2. Capture model licensing value through new hardware generations
3. Create a cartridge ecosystem third-party model providers deploy on
4. Use model generations to drive hardware upgrade cycles

The difference: we're vertically integrated in a way Nintendo wasn't. We control both the "console" (the chip architecture, licensed to device makers) and the "cartridges" (the inference chips with specific models). This is closer to Intel + Microsoft than Nintendo + game studios.

**Long-term vision**: SuperInstance becomes the standard for edge AI deployment. Robotics companies don't write custom inference — they slot in SuperInstance cartridges. Industrial controllers don't deal with model deployment — they order the cartridge. Every Raspberry Pi project that needs AI uses a SuperInstance HAT.
