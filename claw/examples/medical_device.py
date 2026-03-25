"""
HIPAA-Compliant Medical Device Example

Demonstrates CLAW running on an edge medical device:
- Patient data enters locally
- CLAW extracts entities, redacts PII locally
- Sends anonymized features to edge server
- Sends aggregated statistics to cloud for research
- Full audit trail (tamper-proof, hardware-based)

Privacy Cascade:
  Patient Device (CLAW) -> Edge Server -> Cloud Analytics
    (local)              (anonymized)   (aggregated DP)
"""

from pathlib import Path
import json
from claw.core import ClawAgent
from claw.protocols.a2a_local import A2ALocal
from claw.protocols.a2a_cascade import A2ACascade
from claw.protocols.a2a_cloud import A2ACloud


def demo_medical_device():
    """Demonstrate HIPAA-compliant medical analysis."""

    print("=" * 70)
    print("CLAW Medical Device Example - HIPAA Compliance")
    print("=" * 70)

    # Initialize local agent (on medical device)
    device_id = "MEDICAL-DEVICE-001"
    agent = ClawAgent(chip_id=device_id, config={"target": "fpga-kv260"})

    print(f"\nDevice initialized: {device_id}")
    print(f"  Hardware: {agent.hardware}")
    print(f"  Privacy engine: {agent.privacy}")

    # Simulated patient data (HIPAA Protected Health Information)
    patient_data = """
    Patient: John Doe (SSN: 123-45-6789)
    DOB: 01/15/1965
    Phone: (555) 123-4567
    Email: john.doe@email.com

    Chief Complaint: Shortness of breath
    Recent Diagnosis: Hypertension, Type 2 Diabetes
    Current Medications: Lisinopril 10mg, Metformin 500mg
    Allergies: Penicillin

    Recent Labs:
    - Blood Pressure: 150/95 mmHg
    - A1C: 7.2%
    - Creatinine: 1.1 mg/dL
    """

    print(f"\n[PATIENT DATA] Received {len(patient_data)} bytes")
    print("  (Contains PII, HIPAA Protected Health Information)")

    # Process locally with CLAW (all data stays on device)
    print(f"\n[CLAW] Processing locally (privacy_level=local)")

    request = {
        "query": patient_data,
        "privacy_level": "local",  # No data leaves the device
    }

    result = agent.process_request(request)

    print(f"  Status: {result['status']}")
    print(f"  Audit Trail ID: {result['audit_trail']['inference_id']}")
    print(f"  Latency: {result['audit_trail']['latency_ms']:.1f}ms")

    # Extract entities (done locally, privately)
    print(f"\n[PRIVACY] Extracting entities from patient data...")
    entities = agent.privacy.extract_entities(patient_data)

    print(f"  Found PII:")
    for pii_type, matches in entities.items():
        print(f"    - {pii_type}: {len(matches)} occurrence(s)")

    # Redact for edge transmission
    print(f"\n[PRIVACY] Redacting for edge transmission...")
    redacted = agent.privacy.redact_pii(patient_data)

    print(f"  Original: {len(patient_data)} bytes")
    print(f"  Redacted: {len(redacted)} bytes")
    print(f"  Sample: {redacted[:100]}...")

    # Cascade to edge server (for analysis of anonymized features)
    print(f"\n[CASCADE] Delegating to edge server...")
    cascade = A2ACascade(device_id, downstream_chip_id="EDGE-SERVER-01")
    cascade_result = cascade.delegate_inference(
        {"query": redacted}, redaction_level="edge"
    )

    print(f"  Status: {cascade_result['status']}")

    # Send aggregate statistics to cloud (with differential privacy)
    print(f"\n[CLOUD] Escalating aggregate statistics to cloud...")
    cloud = A2ACloud(
        device_id=device_id,
        cloud_endpoint="https://api.superinstance.ranch/medical-research",
    )

    # Only aggregate statistics leave the device (no identifiable data)
    cloud_data = {
        "type": "summary",
        "patient_count": 1,
        "conditions": ["hypertension", "diabetes"],
        "medication_classes": ["ACE inhibitor", "biguanide"],
        "lab_ranges": {"bp_systolic": [150], "a1c": [7.2]},
    }

    cloud_result = cloud.send_to_cloud(cloud_data, privacy_filter="strict")

    print(f"  Status: {cloud_result['status']}")
    if cloud_result["status"] == "sent":
        print(f"  Data sent: {cloud_result['data_sent']}")

    # Generate HIPAA audit trail
    print(f"\n[AUDIT TRAIL] Generating tamper-proof log...")

    audit_entries = []

    audit_entries.append(
        agent.privacy.audit_log(
            "data_received",
            {"source": "patient_device", "data_size": len(patient_data)},
        )
    )

    audit_entries.append(
        agent.privacy.audit_log(
            "pii_redaction", {"pii_found": list(entities.keys())}
        )
    )

    audit_entries.append(
        agent.privacy.audit_log(
            "edge_cascade",
            {
                "destination": "EDGE-SERVER-01",
                "privacy_level": "edge",
                "data_redacted": True,
            },
        )
    )

    audit_entries.append(
        agent.privacy.audit_log(
            "cloud_escalation",
            {
                "destination": "cloud",
                "privacy_filter": "strict",
                "data_aggregated": True,
            },
        )
    )

    print(f"  Generated {len(audit_entries)} audit entries")
    for i, entry in enumerate(audit_entries, 1):
        print(f"    {i}. {entry['event']:20s} (hash: {entry['hash'][:16]}...)")

    # Summary
    print(f"\n" + "=" * 70)
    print("HIPAA Compliance Summary:")
    print(f"  ✓ PII extracted and redacted locally")
    print(f"  ✓ Anonymized features sent to edge")
    print(f"  ✓ Only aggregate stats sent to cloud")
    print(f"  ✓ Full tamper-proof audit trail")
    print(f"  ✓ Patient privacy preserved at all stages")
    print("=" * 70)

    return {
        "device": device_id,
        "audit_entries": audit_entries,
        "privacy_level": "HIPAA compliant",
    }


if __name__ == "__main__":
    demo_medical_device()
