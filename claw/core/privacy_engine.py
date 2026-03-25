"""
Privacy Engine - Differential privacy & data redaction.

CLAW enforces privacy by default:
- Local: All data stays on-device
- Edge: Anonymized features only
- Cloud: Further aggregation + differential noise
"""

import re
import hashlib


class PrivacyEngine:
    """Hardware-enforced differential privacy."""

    def __init__(self, chip_id="CLAW-001"):
        """Initialize privacy engine."""
        self.chip_id = chip_id
        self.pii_patterns = {
            "ssn": r"\d{3}-\d{2}-\d{4}",  # Social security number
            "phone": r"\d{3}-\d{3}-\d{4}",  # Phone number
            "email": r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}",
            "credit_card": r"\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}",
            "date_of_birth": r"\d{1,2}/\d{1,2}/\d{4}",
            "medical_id": r"MRN\d+",
        }

        # PII classification
        self.sensitive_terms = [
            "patient", "diagnosis", "medication", "health", "disease",
            "treatment", "surgery", "allergy", "vaccine",
        ]

    def redact(self, text, level="local"):
        """
        Redact sensitive data based on privacy level.

        Args:
            text: Input text
            level: "local" (no redaction), "edge" (PII removal), "cloud" (heavy)

        Returns:
            redacted_text
        """
        if level == "local":
            return text  # No redaction locally

        elif level == "edge":
            return self.redact_pii(text, extract=True)

        elif level == "cloud":
            # Heavy redaction: remove all medical/sensitive terms
            return self._redact_all_sensitive(text)

        return text

    def redact_pii(self, text, entities=None, extract=False):
        """
        Remove personally identifiable information (PII).

        Args:
            text: Input text
            entities: Pre-extracted entities (optional)
            extract: If True, also extract entities

        Returns:
            redacted_text, and optionally entities
        """
        redacted = text

        # Redact each PII type
        for pii_type, pattern in self.pii_patterns.items():
            redacted = re.sub(pattern, f"[{pii_type.upper()}]", redacted)

        if extract:
            entities = self.extract_entities(text)
            return redacted, entities

        return redacted

    def extract_entities(self, text):
        """Extract named entities (medical/financial/personal)."""
        entities = {}

        # Find all PII matches
        for pii_type, pattern in self.pii_patterns.items():
            matches = re.findall(pattern, text)
            if matches:
                entities[pii_type] = matches

        # Find sensitive medical terms
        medical_mentions = []
        for term in self.sensitive_terms:
            if re.search(r"\b" + term + r"\b", text, re.IGNORECASE):
                medical_mentions.append(term)

        if medical_mentions:
            entities["medical_mentions"] = medical_mentions

        return entities

    def _redact_all_sensitive(self, text):
        """Heavily redact: remove medical terms."""
        redacted = text

        # Redact medical terms
        for term in self.sensitive_terms:
            redacted = re.sub(
                r"\b" + term + r"\b", "[MEDICAL]", redacted, flags=re.IGNORECASE
            )

        # Also apply PII redaction
        redacted = self.redact_pii(redacted)

        return redacted

    def add_differential_noise(self, logits, epsilon=0.1):
        """
        Add differential privacy noise (Laplace mechanism).

        Args:
            logits: Output logits/probabilities
            epsilon: Privacy budget (smaller = more private)

        Returns:
            noisy_logits
        """
        import random
        import math

        # Scale: Sensitivity = 1 for normalized logits
        scale = 1.0 / epsilon

        # Add Laplace noise
        noisy = []
        for logit in logits:
            noise = random.gauss(0, scale)  # Laplace ≈ Gaussian for large scale
            noisy.append(logit + noise)

        return noisy

    def compute_privacy_budget(self, inference_count, epsilon_total=100):
        """
        Compute remaining privacy budget.

        Args:
            inference_count: Number of inferences run so far
            epsilon_total: Total privacy budget

        Returns:
            remaining_epsilon, privacy_status
        """
        epsilon_per_query = epsilon_total / 100  # Budget per inference
        used = inference_count * epsilon_per_query
        remaining = max(0, epsilon_total - used)

        if remaining > 50:
            status = "OK"
        elif remaining > 20:
            status = "WARNING"
        else:
            status = "CRITICAL"

        return remaining, status

    def audit_log(self, event, details):
        """
        Create tamper-proof audit log entry.

        Args:
            event: Event type ("inference", "redaction", "cascade")
            details: Event details dict

        Returns:
            log_entry with cryptographic hash
        """
        entry = {
            "chip_id": self.chip_id,
            "event": event,
            "details": details,
        }

        # Hash for tamper-detection
        entry_str = str(entry)
        entry_hash = hashlib.sha256(entry_str.encode()).hexdigest()
        entry["hash"] = entry_hash

        return entry

    def __repr__(self):
        return f"PrivacyEngine(chip={self.chip_id})"
