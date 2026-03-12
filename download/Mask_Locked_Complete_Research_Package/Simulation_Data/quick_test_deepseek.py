#!/usr/bin/env python3
"""
Quick DeepSeek API Test and Model Documentation
"""

import requests
import json
import os

DEEPSEEK_API_KEY = "sk-2c32887fc62b4016b6ff03f982968b76"
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"

print("=" * 50)
print("DEEPSEEK API CONNECTION TEST")
print("=" * 50)

headers = {
    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
    "Content-Type": "application/json"
}

# Test 1: Basic connectivity
print("\n1. Testing basic connectivity...")
try:
    response = requests.post(
        f"{DEEPSEEK_BASE_URL}/chat/completions",
        headers=headers,
        json={
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": "Say 'OK' in one word"}],
            "max_tokens": 10
        },
        timeout=30
    )
    if response.status_code == 200:
        print("   ✓ DeepSeek API connected successfully!")
    else:
        print(f"   ✗ Error: {response.status_code}")
except Exception as e:
    print(f"   ✗ Failed: {e}")

# Test 2: Verilog generation
print("\n2. Testing Verilog generation (deepseek-coder)...")
try:
    response = requests.post(
        f"{DEEPSEEK_BASE_URL}/chat/completions",
        headers=headers,
        json={
            "model": "deepseek-coder",
            "messages": [{"role": "user", "content": "Write a 4-bit counter Verilog module with reset."}],
            "max_tokens": 500,
            "temperature": 0.2
        },
        timeout=45
    )
    if response.status_code == 200:
        result = response.json()
        print("   ✓ deepseek-coder works!")
        print(f"   Output tokens: {result['usage']['completion_tokens']}")
    else:
        print(f"   ✗ Error: {response.status_code}")
except Exception as e:
    print(f"   ✗ Failed: {e}")

# Test 3: Reasoning
print("\n3. Testing reasoning (deepseek-reasoner)...")
try:
    response = requests.post(
        f"{DEEPSEEK_BASE_URL}/chat/completions",
        headers=headers,
        json={
            "model": "deepseek-reasoner",
            "messages": [{"role": "user", "content": "What's 15% better: 1024 PEs at 500MHz or 512 PEs at 1GHz? Brief answer."}],
            "max_tokens": 500,
            "temperature": 0.3
        },
        timeout=60
    )
    if response.status_code == 200:
        result = response.json()
        print("   ✓ deepseek-reasoner works!")
        print(f"   Output tokens: {result['usage']['completion_tokens']}")
    else:
        print(f"   ✗ Error: {response.status_code}")
except Exception as e:
    print(f"   ✗ Failed: {e}")

print("\n" + "=" * 50)
print("API TEST COMPLETE")
print("=" * 50)

# Save model documentation
doc = """# DeepSeek Model Documentation for Chip Design

## Available DeepSeek Models

### 1. deepseek-chat
- **Purpose**: General-purpose conversational AI
- **Strengths**: 
  - Balanced performance across tasks
  - Good documentation generation
  - Project synthesis and coordination
- **Context**: 64K tokens
- **Cost**: $0.14 per million input tokens
- **Best For**: Documentation, synthesis, general reasoning, orchestration support

### 2. deepseek-coder
- **Purpose**: Code-specialized model
- **Strengths**:
  - Verilog/VHDL generation
  - Code review and optimization
  - Debugging assistance
  - Testbench creation
- **Context**: 16K tokens
- **Cost**: $0.14 per million input tokens
- **Best For**: 
  - RTL generation
  - Testbench creation
  - Code optimization
  - Syntax-aware tasks

### 3. deepseek-reasoner
- **Purpose**: Complex reasoning model
- **Strengths**:
  - Multi-step logical reasoning
  - Stochastic analysis
  - Trade-off evaluation
  - Holding contrary concepts in balance
- **Context**: 64K tokens
- **Cost**: $0.55 per million input tokens
- **Best For**:
  - Architecture trade-offs
  - Power/performance analysis
  - Defect tolerance modeling
  - Stochastic reasoning for hardware

## Model Selection Matrix

| Task | Best Model | Fallback | Reason |
|------|-----------|----------|--------|
| Verilog Generation | deepseek-coder | NVIDIA Llama | HDL training |
| Testbench Creation | deepseek-coder | deepseek-chat | Code patterns |
| Logic Optimization | deepseek-reasoner | deepseek-coder | Trade-offs |
| Architecture Analysis | deepseek-reasoner | deepseek-chat | Complex reasoning |
| Power Analysis | deepseek-reasoner | deepseek-chat | Quantitative |
| Timing Analysis | deepseek-reasoner | deepseek-coder | Critical path |
| Verification | deepseek-coder | deepseek-reasoner | Code + logic |
| Documentation | deepseek-chat | GLM 5 | Synthesis |
| Creative Exploration | NVIDIA Llama-405B | deepseek-chat | Creativity |

## GLM 5 Special Role

GLM 5 serves as the **meta-orchestrator** with responsibilities:

### Orchestration Tasks (GLM 5 Primary)
1. Task decomposition and model routing
2. Result validation and synthesis
3. Cross-domain integration
4. Project timeline management
5. Stakeholder communication

### Where GLM 5 Excels
- Synthesizing multi-model outputs
- Managing 12-round development process
- Creating comprehensive documentation
- High-level architectural decisions
- Balancing competing priorities

### Where DeepSeek Excels
- Granular hardware logic
- Stochastic balance (contrary concepts)
- Code generation quality
- Physical design reasoning

## Integration Architecture

```
┌─────────────────────────────────────────────┐
│           GLM 5 ORCHESTRATOR                 │
│  - Task decomposition                        │
│  - Model routing                             │
│  - Result synthesis                          │
│  - Quality validation                        │
└────────────┬────────────────────────────────┘
             │
    ┌────────┼────────┐
    ▼        ▼        ▼
┌────────┐ ┌────────┐ ┌────────┐
│DeepSeek│ │ NVIDIA │ │  GLM 5 │
│ Coder  │ │  NIM   │ │ Direct │
│(Verilog│ │(Creative│ │(Synth) │
│+ Logic)│ │Explore)│ │        │
└────────┘ └────────┘ └────────┘
    │        │        │
    ▼        ▼        ▼
┌─────────────────────────────────────────────┐
│         FEEDBACK & QUALITY LOOP              │
│  - Rate outputs                              │
│  - Adjust routing                            │
│  - Track performance                         │
└─────────────────────────────────────────────┘
```

## Performance Tracking

The system tracks:
- Token usage per model
- Latency per request
- Quality ratings (human feedback)
- Success rates by task type

## Cost Optimization

| Model | Relative Cost | When to Use |
|-------|---------------|-------------|
| deepseek-coder | Low | Most coding tasks |
| deepseek-chat | Low | General tasks, synthesis |
| deepseek-reasoner | Medium | Complex reasoning only |
| NVIDIA NIM | Free | Creative, exploration |
| GLM 5 | Managed | Orchestration, synthesis |

---
Generated: """ + str(os.popen('date').read()) + """
"""

output_path = "/home/z/my-project/research/deepseek_model_documentation.md"
with open(output_path, 'w') as f:
    f.write(doc)

print(f"\nDocumentation saved to: {output_path}")
