# Lab 4: Model Quantization — BitNet b1.58

**Duration:** 4 hours | **Difficulty:** Advanced | **Prerequisites:** Labs 1-3, Python/PyTorch

## Objective

Take a pretrained FP32 language model, quantize its weights to ternary `{-1, 0, +1}`, measure accuracy degradation, and export for mask-lock compilation.

## Learning Outcomes

- Understand weight quantization theory (FP32 → INT8 → ternary)
- Implement the BitNet b1.58 quantization algorithm
- Measure perplexity impact of aggressive quantization
- Export quantized weights in MLS-compatible format

## Background

### Why Ternary?

| Precision | Bits/Weight | Multiplier Cost | Memory (1B params) |
|-----------|------------|----------------|-------------------|
| FP32 | 32 | ~5,000 gates | 4.0 GB |
| INT8 | 8 | ~900 gates | 1.0 GB |
| INT4 | 4 | ~200 gates | 0.5 GB |
| Ternary | 1.58 | ~50 gates | 0.2 GB |

### BitNet b1.58 Algorithm

For each weight matrix W:
1. Compute scale: `α = mean(|W|)`
2. Quantize: `W_ternary = round_clip(W / α, -1, 1)`
3. Store: `{-1, 0, +1}` as 2-bit codes

## Part 1: Quantization Implementation (90 min)

### 1.1 Basic Ternary Quantizer

```python
import torch
import torch.nn as nn

def quantize_ternary(weight: torch.Tensor) -> tuple[torch.Tensor, float]:
    """Quantize FP32 weights to ternary {-1, 0, +1}.

    Args:
        weight: FP32 weight tensor

    Returns:
        (quantized_weight, scale_factor)
    """
    # YOUR CODE HERE
    # Step 1: Compute scale factor α = mean(|W|)
    # Step 2: Normalize: W_norm = W / α
    # Step 3: Round to nearest {-1, 0, +1}
    # Step 4: Return quantized weights and scale
    pass
```

### 1.2 Quantization-Aware Forward Pass

```python
class TernaryLinear(nn.Module):
    """Drop-in replacement for nn.Linear with ternary weights."""

    def __init__(self, in_features: int, out_features: int):
        super().__init__()
        self.weight = nn.Parameter(torch.randn(out_features, in_features))
        self.scale = nn.Parameter(torch.ones(1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # YOUR CODE HERE
        # Quantize weights on-the-fly during forward pass
        # Use straight-through estimator for gradient
        pass
```

### 1.3 Straight-Through Estimator

```python
class STEQuantize(torch.autograd.Function):
    """Quantize forward, pass gradient straight through backward."""

    @staticmethod
    def forward(ctx, input):
        # Round to {-1, 0, +1}
        return torch.clamp(torch.round(input), -1, 1)

    @staticmethod
    def backward(ctx, grad_output):
        # Pass gradient unchanged
        return grad_output
```

## Part 2: Quantize a Real Model (60 min)

### 2.1 Load Pretrained Model

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
model = AutoModelForCausalLM.from_pretrained(model_name, torch_dtype=torch.float32)
tokenizer = AutoTokenizer.from_pretrained(model_name)
```

### 2.2 Apply Quantization

```python
def quantize_model(model):
    """Replace all Linear layers with TernaryLinear."""
    stats = {"total_params": 0, "zero_params": 0, "sparsity": 0.0}

    for name, module in model.named_modules():
        if isinstance(module, nn.Linear):
            q_weight, scale = quantize_ternary(module.weight.data)

            # Count statistics
            total = q_weight.numel()
            zeros = (q_weight == 0).sum().item()
            stats["total_params"] += total
            stats["zero_params"] += zeros

            module.weight.data = q_weight * scale

    stats["sparsity"] = stats["zero_params"] / stats["total_params"]
    return model, stats
```

### 2.3 Measure Perplexity

```python
def evaluate_perplexity(model, tokenizer, dataset="wikitext-2"):
    """Compute perplexity on validation set."""
    # YOUR CODE HERE
    # Load dataset, tokenize, compute cross-entropy loss
    # Return exp(average_loss)
    pass
```

**Expected results:**
| Model | FP32 PPL | Ternary PPL | Degradation |
|-------|---------|------------|-------------|
| TinyLlama 1.1B | ~7.5 | ~9.2 | +22% |

## Part 3: Export for Mask-Lock (45 min)

### 3.1 MLS Weight Format

```python
def export_mls_weights(model, output_path: str):
    """Export quantized weights in MLS binary format.

    Format per layer:
        - 4 bytes: layer_id (uint32)
        - 4 bytes: rows (uint32)
        - 4 bytes: cols (uint32)
        - N bytes: packed ternary weights (4 weights per byte)

    Encoding: +1=0b00, 0=0b01, -1=0b10, reserved=0b11
    """
    # YOUR CODE HERE
    pass
```

### 3.2 Verify Export

```python
def verify_mls_weights(original_model, mls_path: str) -> bool:
    """Load MLS weights back and compare against original quantized model."""
    # YOUR CODE HERE
    pass
```

## Part 4: Analysis (45 min)

### 4.1 Weight Distribution

Plot histograms of weight values before and after quantization. Calculate:
- Sparsity ratio (fraction of zero weights)
- Distribution of +1 vs -1 vs 0
- Per-layer quantization error

### 4.2 Accuracy vs Compression

Create a table comparing:
- FP32 baseline
- INT8 quantization
- INT4 quantization
- Ternary quantization
- Ternary with fine-tuning (2 epochs QAT)

## Deliverables

1. `quantizer.py` — Working ternary quantization implementation
2. `export_mls.py` — MLS weight export tool
3. Perplexity comparison table (FP32 vs ternary)
4. Weight distribution plots (before/after)
5. Written analysis: When is ternary quantization acceptable? What models benefit most?

## Reference

- BitNet b1.58 paper: "The Era of 1-bit LLMs" (Ma et al., 2024)
- `compiler/clawc/middle_end/quantizer.py` — CLAWC quantizer implementation
- `standards/mls_v1.0_quantization.md` — MLS quantization specification
