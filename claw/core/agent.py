"""
CLAW Agent - Main inference loop and decision engine.

Hardware-rooted LLM that:
1. Knows its own chip architecture (transistor-level)
2. Compiles requests directly to metal-mask operations
3. Enforces privacy by default (differential privacy in hardware)
4. Cascades to other agents with automatic data redaction
"""

import time
from pathlib import Path

from .hardware_model import HardwareModel
from .compiler_iface import CompilerInterface
from .privacy_engine import PrivacyEngine


class ClawAgent:
    """CLAW: Closest-to-metal LLM agent."""

    def __init__(self, chip_id="CLAW-001", model_path=None, config=None):
        """Initialize CLAW agent."""
        self.chip_id = chip_id
        self.model_path = Path(model_path) if model_path else None
        self.config = config or {}

        # Core subsystems
        self.hardware = HardwareModel(chip_id=chip_id)
        self.compiler = CompilerInterface(target=self.config.get("target", "fpga-kv260"))
        self.privacy = PrivacyEngine(chip_id=chip_id)

        # State
        self.state = "idle"
        self.request_queue = []
        self.inference_count = 0

        print(f"[CLAW] Initialized agent {chip_id}")
        print(f"[CLAW] Hardware: {self.hardware}")
        print(f"[CLAW] Target: {self.compiler.target}")

    def process_request(self, request):
        """
        Process a high-level request and compile to hardware operations.

        Args:
            request: User request dict with:
                - "query": Text query
                - "context": Optional context
                - "privacy_level": "local", "edge", "cloud"

        Returns:
            response: dict with result and audit trail
        """
        self.inference_count += 1
        timestamp = time.time()

        print(f"[CLAW #{self.inference_count}] Processing request...")
        print(f"  Query: {request.get('query', '')[:50]}...")
        print(f"  Privacy: {request.get('privacy_level', 'local')}")

        # Step 1: Privacy assessment
        privacy_level = request.get("privacy_level", "local")
        redacted_input = self.privacy.redact(
            request.get("query", ""), level=privacy_level
        )

        # Step 2: Hardware-aware compilation
        # Check if request fits in local hardware
        can_run_locally = self.hardware.can_fit_inference()

        if can_run_locally:
            print(f"[CLAW] Running inference locally (power: {self.hardware.power_mw}mW)")
            result = self._run_local_inference(redacted_input, request)
        else:
            print(f"[CLAW] Cascading to edge/cloud (local capacity exceeded)")
            result = self._cascade_inference(redacted_input, request, privacy_level)

        # Step 3: Generate audit trail
        audit = {
            "timestamp": timestamp,
            "chip_id": self.chip_id,
            "inference_id": self.inference_count,
            "privacy_level": privacy_level,
            "execution_location": result.get("location", "local"),
            "latency_ms": (time.time() - timestamp) * 1000,
        }

        return {
            "result": result.get("output", ""),
            "audit_trail": audit,
            "status": "success",
        }

    def _run_local_inference(self, input_text, request):
        """Run inference on local hardware."""
        # Step 1: Encode input
        tokens = self._tokenize(input_text)

        # Step 2: Compile to MAC operations via CLAWC
        # (In real implementation: actual compilation + loading)
        mac_program = self.compiler.compile_inference(tokens, self.hardware)

        # Step 3: Execute on chip
        # (In real implementation: write to chip registers, wait for result)
        output_logits = self._execute_mac_program(mac_program)

        # Step 4: Decode output
        output_text = self._decode_logits(output_logits)

        return {"output": output_text, "location": "local", "latency_ms": 50}

    def _cascade_inference(self, input_text, request, privacy_level):
        """Cascade to edge or cloud with data redaction."""
        # Extract entities and redact PII
        entities = self.privacy.extract_entities(input_text)
        pii_redacted = self.privacy.redact_pii(input_text, entities)

        # For "edge" level: send anonymized features to edge server
        # For "cloud" level: further aggregate and send to cloud

        # Placeholder: just return local result for now
        print(f"[CLAW] Cascade path (privacy_level={privacy_level})")
        print(f"  Redacted entities: {len(entities)}")

        return {"output": "[REDACTED]", "location": "cascaded", "latency_ms": 100}

    def _tokenize(self, text):
        """Tokenize input text."""
        # Placeholder: simple tokenization
        return text.split()[:128]  # Truncate to 128 tokens

    def _execute_mac_program(self, mac_program):
        """Execute compiled MAC program on chip."""
        # Placeholder: return dummy logits
        return [0.1 * i for i in range(10)]  # 10-class output

    def _decode_logits(self, logits):
        """Decode logits to output text."""
        # Placeholder: argmax
        max_idx = logits.index(max(logits))
        return f"Class {max_idx}"

    def compile_custom_model(self, model_path, target=None):
        """
        Compile a custom model for this hardware.

        Args:
            model_path: Path to ONNX/GGUF model
            target: Target hardware (defaults to self.compiler.target)

        Returns:
            compiled_binary: Chip-ready bitstream
        """
        target = target or self.compiler.target
        print(f"[CLAW] Compiling {model_path} for {target}")

        result = self.compiler.compile_model(model_path, target)
        return result.get("binary", None)

    def __repr__(self):
        return (
            f"ClawAgent({self.chip_id}, target={self.compiler.target}, "
            f"inferences={self.inference_count})"
        )
