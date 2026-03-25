# MLS M.2 Card — "Laptop AI Accelerator"

## Overview

An M.2 2230 inference card that slots into any laptop or desktop with an M.2
slot (like a WiFi card). Provides **local LLM inference** over PCIe with
zero cloud dependency.

## Specifications

| Parameter | Value |
|-----------|-------|
| Form Factor | M.2 2230 (22mm × 30mm), Key M |
| Interface | PCIe Gen3 x2 (~16 Gbps) |
| Power | 3.3V @ 2A (7W max, M.2 spec) |
| MAC Array | 64×64 RAU (4,096 ternary MACs) |
| Clock | 200 MHz core |
| On-Die SRAM | 256 KB (KV cache) |
| Model Size | Up to 50M parameters (ternary) |
| Throughput | ~50 tok/s |
| Process | sky130 (130nm) |
| Die Area | ~50 mm² |
| Latency | <20ms first token |

## Use Cases

1. **Local LLM Assistant** — Run a 7B parameter model locally (with cascade)
2. **Code Completion** — IDE inference without cloud (privacy-first)
3. **Document Analysis** — Summarize/classify documents on-device
4. **Edge Server** — Add AI to any NUC/mini-PC

## Software Stack

### Linux Kernel Driver (`claw_m2.ko`)

```bash
# Build driver
cd pcie_phy
make -C /lib/modules/$(uname -r)/build M=$(pwd) modules

# Load driver
sudo insmod claw_m2.ko

# Verify
dmesg | grep claw
# MLS M.2 card detected (chip_id=0x20)
# MLS M.2 inference card ready

# Check temperature
cat /sys/class/claw/claw0/temperature
# 35

# Check chip ID
cat /sys/class/claw/claw0/chip_id
# 0x20
```

### Userspace API

```c
#include <fcntl.h>
#include <unistd.h>

int fd = open("/dev/claw0", O_RDWR);

// Write input tokens
write(fd, tokens, token_count * sizeof(uint16_t));

// Read output logits
read(fd, logits, vocab_size * sizeof(float));

close(fd);
```

### Python (via Claw agent)

```python
from claw.core import ClawAgent

agent = ClawAgent(
    chip_id="M2-CARD-001",
    config={
        "target": "asic-sky130",
        "mac_array": "64x64",
        "power_budget_mw": 7000,
        "interface": "pcie-gen3-x2",
    }
)

result = agent.process_request({
    "query": "Summarize this document",
    "privacy_level": "local",
})
```

## Cost Analysis

| Component | Unit Cost |
|-----------|-----------|
| MLS Inference ASIC | $15.00 |
| PCIe Gen3 PHY (retimer) | $3.00 |
| M.2 2230 edge connector | $0.80 |
| 3.3V/1.0V PMIC | $2.50 |
| Decoupling capacitors (×8) | $0.40 |
| Activity LED | $0.05 |
| PCB (4-layer, 22×30mm) | $3.00 |
| **BOM Total** | **$24.75** |
| Assembly | $10.00 |
| **Retail Target** | **$49.00** |

## Build

```bash
make lint        # Lint RTL
make sim         # Verilator simulation
make synth       # OpenROAD synthesis
make driver      # Build Linux kernel module
make bom         # Print bill of materials
```
