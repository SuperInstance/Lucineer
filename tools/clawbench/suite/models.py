"""
ClawBench — Standard Benchmark Model Definitions

Pre-quantized ternary models for reproducible MLS benchmarking.
Each model is defined as a configuration that can be compiled
through CLAWC and run on any MLS-compatible target.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class ModelCategory(Enum):
    VISION = "vision"
    NLP = "nlp"
    SPEECH = "speech"
    GENERATIVE = "generative"


@dataclass
class LayerConfig:
    """Configuration for a single model layer."""
    name: str
    op_type: str  # matmul, conv2d, attention, mlp, embed, layernorm
    input_dim: int
    output_dim: int
    weight_params: int
    mac_ops: int  # multiply-accumulate operations per inference
    ternary_sparsity: float  # fraction of zero weights (0.0-1.0)


@dataclass
class BenchmarkModel:
    """A standard benchmark model definition."""
    name: str
    display_name: str
    category: ModelCategory
    total_params: int
    total_params_ternary_mb: float  # size in MB at 1.58 bits/param
    layers: list[LayerConfig]
    input_shape: list[int]  # e.g., [1, 128] for sequence, [1, 3, 32, 32] for image
    output_shape: list[int]
    vocab_size: Optional[int] = None  # for language models
    sequence_length: int = 1
    description: str = ""
    min_form_factor: str = "usb_c"  # smallest form factor that can run this

    @property
    def total_mac_ops(self) -> int:
        return sum(layer.mac_ops for layer in self.layers)

    @property
    def avg_sparsity(self) -> float:
        if not self.layers:
            return 0.0
        total_params = sum(l.weight_params for l in self.layers)
        weighted_sparsity = sum(
            l.weight_params * l.ternary_sparsity for l in self.layers
        )
        return weighted_sparsity / total_params if total_params > 0 else 0.0


# ---------- Standard Models ----------

MNIST_TINY = BenchmarkModel(
    name="mnist-tiny",
    display_name="MNIST-Tiny",
    category=ModelCategory.VISION,
    total_params=50_000,
    total_params_ternary_mb=0.01,
    input_shape=[1, 1, 28, 28],
    output_shape=[1, 10],
    description="Minimal CNN for digit recognition. Smoke test model.",
    min_form_factor="battery_pack",
    layers=[
        LayerConfig("conv1", "conv2d", 1, 16, 160, 1_003_520, 0.55),
        LayerConfig("conv2", "conv2d", 16, 32, 4_640, 3_211_264, 0.58),
        LayerConfig("fc1", "matmul", 1568, 64, 100_352, 100_352, 0.62),
        LayerConfig("fc2", "matmul", 64, 10, 650, 650, 0.48),
    ],
)

CIFAR_CNN = BenchmarkModel(
    name="cifar-cnn",
    display_name="CIFAR-CNN",
    category=ModelCategory.VISION,
    total_params=500_000,
    total_params_ternary_mb=0.10,
    input_shape=[1, 3, 32, 32],
    output_shape=[1, 10],
    description="8-layer CNN for CIFAR-10. Tests convolution pipeline.",
    min_form_factor="usb_c",
    layers=[
        LayerConfig("conv1", "conv2d", 3, 32, 896, 917_504, 0.52),
        LayerConfig("conv2", "conv2d", 32, 32, 9_248, 9_437_184, 0.55),
        LayerConfig("conv3", "conv2d", 32, 64, 18_496, 4_718_592, 0.57),
        LayerConfig("conv4", "conv2d", 64, 64, 36_928, 9_437_184, 0.60),
        LayerConfig("conv5", "conv2d", 64, 128, 73_856, 4_718_592, 0.58),
        LayerConfig("conv6", "conv2d", 128, 128, 147_584, 9_437_184, 0.61),
        LayerConfig("fc1", "matmul", 2048, 256, 524_544, 524_544, 0.63),
        LayerConfig("fc2", "matmul", 256, 10, 2_570, 2_570, 0.45),
    ],
)

BERT_NANO = BenchmarkModel(
    name="bert-nano",
    display_name="BERT-Nano",
    category=ModelCategory.NLP,
    total_params=4_000_000,
    total_params_ternary_mb=0.79,
    input_shape=[1, 128],
    output_shape=[1, 128, 256],
    vocab_size=30_522,
    sequence_length=128,
    description="4-layer BERT for text classification. Tests attention mechanism.",
    min_form_factor="usb_c",
    layers=[
        LayerConfig("embed", "embed", 30_522, 256, 7_813_632, 256, 0.40),
        LayerConfig("attn_0", "attention", 256, 256, 262_144, 33_554_432, 0.58),
        LayerConfig("mlp_0", "mlp", 256, 1024, 525_312, 67_108_864, 0.62),
        LayerConfig("attn_1", "attention", 256, 256, 262_144, 33_554_432, 0.59),
        LayerConfig("mlp_1", "mlp", 256, 1024, 525_312, 67_108_864, 0.63),
        LayerConfig("attn_2", "attention", 256, 256, 262_144, 33_554_432, 0.60),
        LayerConfig("mlp_2", "mlp", 256, 1024, 525_312, 67_108_864, 0.64),
        LayerConfig("attn_3", "attention", 256, 256, 262_144, 33_554_432, 0.61),
        LayerConfig("mlp_3", "mlp", 256, 1024, 525_312, 67_108_864, 0.65),
    ],
)

GPT_MICRO = BenchmarkModel(
    name="gpt-micro",
    display_name="GPT-Micro",
    category=ModelCategory.GENERATIVE,
    total_params=25_000_000,
    total_params_ternary_mb=4.94,
    input_shape=[1, 128],
    output_shape=[1, 128, 512],
    vocab_size=32_000,
    sequence_length=128,
    description="12-layer decoder-only transformer. Tests autoregressive generation.",
    min_form_factor="m2_card",
    layers=[
        LayerConfig("embed", "embed", 32_000, 512, 16_384_000, 512, 0.42),
        *[
            LayerConfig(f"block_{i}", "attention", 512, 512, 1_048_576,
                       134_217_728, 0.58 + i * 0.005)
            for i in range(12)
        ],
        *[
            LayerConfig(f"mlp_{i}", "mlp", 512, 2048, 2_097_152,
                       268_435_456, 0.62 + i * 0.005)
            for i in range(12)
        ],
        LayerConfig("lm_head", "matmul", 512, 32_000, 16_384_000,
                   16_384_000, 0.55),
    ],
)

LLAMA_TINY = BenchmarkModel(
    name="llama-tiny",
    display_name="LLaMA-Tiny (110M)",
    category=ModelCategory.GENERATIVE,
    total_params=110_000_000,
    total_params_ternary_mb=21.7,
    input_shape=[1, 128],
    output_shape=[1, 128, 768],
    vocab_size=32_000,
    sequence_length=128,
    description="12-layer LLaMA-architecture model. Production-scale benchmark.",
    min_form_factor="thunderbolt",
    layers=[
        LayerConfig("embed", "embed", 32_000, 768, 24_576_000, 768, 0.43),
        *[
            LayerConfig(f"attn_{i}", "attention", 768, 768, 2_359_296,
                       301_989_888, 0.59 + i * 0.004)
            for i in range(12)
        ],
        *[
            LayerConfig(f"mlp_{i}", "mlp", 768, 3072, 4_718_592,
                       603_979_776, 0.63 + i * 0.004)
            for i in range(12)
        ],
        LayerConfig("lm_head", "matmul", 768, 32_000, 24_576_000,
                   24_576_000, 0.56),
    ],
)


# ---------- Model Registry ----------

STANDARD_SUITE: dict[str, BenchmarkModel] = {
    "mnist-tiny": MNIST_TINY,
    "cifar-cnn": CIFAR_CNN,
    "bert-nano": BERT_NANO,
    "gpt-micro": GPT_MICRO,
    "llama-tiny": LLAMA_TINY,
}


def get_model(name: str) -> BenchmarkModel:
    """Get a benchmark model by name."""
    if name not in STANDARD_SUITE:
        available = ", ".join(STANDARD_SUITE.keys())
        raise ValueError(f"Unknown model '{name}'. Available: {available}")
    return STANDARD_SUITE[name]


def get_models_for_platform(form_factor: str) -> list[BenchmarkModel]:
    """Get all models that can run on a given form factor."""
    form_factor_order = ["battery_pack", "usb_c", "m2_card", "thunderbolt", "ucie"]

    if form_factor not in form_factor_order:
        return list(STANDARD_SUITE.values())

    max_idx = form_factor_order.index(form_factor)
    return [
        model for model in STANDARD_SUITE.values()
        if form_factor_order.index(model.min_form_factor) <= max_idx
    ]
