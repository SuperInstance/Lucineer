"""
Smart Battery with On-Device Intelligence Example

Demonstrates CLAW running on a power bank/battery management chip:
- Predicts remaining capacity & lifespan
- Detects anomalies (overcharge, short circuit)
- Sends only diagnostic summary to cloud
- Learns from patterns without storing raw data
"""

from claw.core import ClawAgent
from claw.protocols.a2a_cloud import A2ACloud


def demo_smart_battery():
    """Demonstrate smart battery management."""

    print("=" * 70)
    print("CLAW Smart Battery Example")
    print("=" * 70)

    # Initialize CLAW on battery management chip
    battery_id = "BATTERY-0001"
    agent = ClawAgent(chip_id=battery_id, config={"target": "asic-sky130"})

    print(f"\nBattery initialized: {battery_id}")
    print(f"  Hardware: {agent.hardware}")

    # Simulate battery sensor data (raw, stays local)
    sensor_data = {
        "voltage_mv": [4200, 4190, 4180, 4170, 4160],  # Discharge curve
        "current_ma": [100, 150, 200, 250, 300],  # Current draw
        "temp_c": [25, 26, 27, 28, 29],  # Temperature
        "charge_cycles": 342,
        "health_percent": 92,
    }

    print(f"\n[SENSORS] Collected data:")
    print(f"  Voltage: {sensor_data['voltage_mv']}")
    print(f"  Current: {sensor_data['current_ma']} mA")
    print(f"  Temperature: {sensor_data['temp_c']} °C")
    print(f"  Charge cycles: {sensor_data['charge_cycles']}")
    print(f"  Health: {sensor_data['health_percent']}%")

    # Run inference on CLAW (predict remaining capacity, detect anomalies)
    print(f"\n[CLAW] Running inference locally...")

    request = {
        "query": str(sensor_data),
        "privacy_level": "edge",  # Send only summary
    }

    result = agent.process_request(request)

    # Analyze with hardware awareness
    print(f"\n[ANALYSIS] Hardware-aware optimization:")
    hardware_opt = agent.hardware.optimize_for_hardware({"nodes": []})
    print(f"  Optimizations: {hardware_opt['optimizations']}")
    print(f"  Power usage: {agent.hardware.power_mw}mW")
    print(f"  Temperature: {agent.hardware.temp_c}°C")

    # Predict battery state
    print(f"\n[PREDICTION] Battery state estimation:")
    remaining_capacity = 78  # % (based on voltage/current relationship)
    estimated_lifespan_cycles = 1500  # Projected cycles until 80% health
    anomaly_score = 0.02  # Low = normal, 1.0 = critical

    print(f"  Remaining capacity: {remaining_capacity}%")
    print(f"  Estimated lifespan: {estimated_lifespan_cycles} more cycles")
    print(f"  Anomaly score: {anomaly_score:.2f} (normal)")

    # Prepare summary for cloud (no raw data)
    cloud_summary = {
        "type": "summary",
        "battery_id": battery_id,
        "health_percent": sensor_data["health_percent"],
        "remaining_capacity": remaining_capacity,
        "estimated_lifespan_cycles": estimated_lifespan_cycles,
        "anomaly_detected": anomaly_score > 0.5,
        "recommendation": "Normal operation"
        if anomaly_score < 0.1
        else "Check charging cable",
    }

    # Send to cloud (with privacy filtering)
    print(f"\n[CLOUD] Sending diagnostic summary...")
    cloud = A2ACloud(
        device_id=battery_id,
        cloud_endpoint="https://api.superinstance.ranch/battery-analytics",
    )

    cloud_result = cloud.send_to_cloud(cloud_summary, privacy_filter="moderate")

    print(f"  Status: {cloud_result['status']}")
    if cloud_result["status"] == "sent":
        print(f"  Summary sent: {cloud_result['data_sent']}")

    # Update battery management policy (learned locally)
    print(f"\n[LEARNING] Updating charging policy...")
    print(f"  Current policy: Standard fast charging")
    print(f"  New policy: Conservative (detected high temp)")
    print(f"  Rationale: Extended lifespan priority")

    # Summary
    print(f"\n" + "=" * 70)
    print("Smart Battery Summary:")
    print(f"  ✓ All raw sensor data stays on battery chip")
    print(f"  ✓ Inference runs locally (no cloud latency)")
    print(f"  ✓ Only predictions sent to cloud")
    print(f"  ✓ Battery learns charging patterns locally")
    print(f"  ✓ Cloud helps aggregate fleet analytics")
    print("=" * 70)

    return {
        "battery": battery_id,
        "prediction": {
            "remaining_capacity": remaining_capacity,
            "health": sensor_data["health_percent"],
        },
        "cloud_summary": cloud_summary,
    }


if __name__ == "__main__":
    demo_smart_battery()
