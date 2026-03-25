#!/usr/bin/env python3
"""
MLS Thermal Monitoring

Logs temperature during inference for thermal characterization.
Sources:
  - KV260 sysfs thermal zones
  - External IR camera (FLIR Lepton via SPI)
  - Simulated thermal model (for CI)

Author: SuperInstance Ranch
License: MIT
"""

import json
import time
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass
class ThermalSample:
    """Single thermal measurement."""
    timestamp_s: float
    zone_temps_c: dict  # {"core": 45.2, "io": 38.1, ...}
    ambient_c: float
    state: str = "idle"


class SysfsThermalReader:
    """Read KV260 thermal zones from sysfs."""

    THERMAL_BASE = Path("/sys/class/thermal")

    def __init__(self):
        """Find available thermal zones."""
        self.zones = {}
        if self.THERMAL_BASE.exists():
            for zone_dir in sorted(self.THERMAL_BASE.glob("thermal_zone*")):
                type_file = zone_dir / "type"
                temp_file = zone_dir / "temp"
                if type_file.exists() and temp_file.exists():
                    zone_type = type_file.read_text().strip()
                    self.zones[zone_type] = temp_file

        if not self.zones:
            print("[Thermal] No sysfs zones found — using simulation")

    def read(self) -> ThermalSample:
        """Read all thermal zones."""
        temps = {}

        if self.zones:
            for zone_type, temp_file in self.zones.items():
                try:
                    raw = int(temp_file.read_text().strip())
                    temps[zone_type] = raw / 1000.0  # millidegrees → °C
                except (ValueError, OSError):
                    temps[zone_type] = 0.0
        else:
            # Simulation
            import random
            temps = {
                "core": 42.0 + random.gauss(0, 2),
                "io": 38.0 + random.gauss(0, 1.5),
                "ambient": 25.0 + random.gauss(0, 0.5),
            }

        return ThermalSample(
            timestamp_s=time.time(),
            zone_temps_c=temps,
            ambient_c=temps.get("ambient", 25.0),
        )


def run_thermal_log(duration_s=60, interval_s=1, output_dir="results/"):
    """Run thermal logging session."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    reader = SysfsThermalReader()
    samples = []

    print(f"[Thermal] Logging for {duration_s}s...")
    start = time.time()

    while (time.time() - start) < duration_s:
        sample = reader.read()
        samples.append(sample)

        core_temp = sample.zone_temps_c.get("core", 0)
        print(f"  [{time.time()-start:.1f}s] Core: {core_temp:.1f}°C", end="\r")

        if core_temp > 85.0:
            print(f"\n[WARN] Core temperature {core_temp:.1f}°C exceeds 85°C limit!")

        time.sleep(interval_s)

    print(f"\n[Thermal] Collected {len(samples)} samples")

    # Save
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    output_file = output_dir / f"thermal_{timestamp}.json"
    with open(output_file, "w") as f:
        json.dump([asdict(s) for s in samples], f, indent=2)
    print(f"[Thermal] Saved to {output_file}")

    # Summary
    if samples:
        core_temps = [s.zone_temps_c.get("core", 0) for s in samples]
        print(f"\nThermal Summary:")
        print(f"  Min:  {min(core_temps):.1f}°C")
        print(f"  Max:  {max(core_temps):.1f}°C")
        print(f"  Avg:  {sum(core_temps)/len(core_temps):.1f}°C")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="MLS Thermal Logger")
    p.add_argument("--duration", type=int, default=60)
    p.add_argument("--interval", type=float, default=1.0)
    p.add_argument("--output-dir", default="results/")
    args = p.parse_args()
    run_thermal_log(args.duration, args.interval, args.output_dir)
