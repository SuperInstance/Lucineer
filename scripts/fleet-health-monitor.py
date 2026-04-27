#!/usr/bin/env python3
"""
Fleet Health Monitor — Continuous service checking
Run this to get a real-time snapshot of all fleet services.
"""
import urllib.request
import json
import sys

# Service definitions: (port, name, expected_status_path)
SERVICES = [
    (4042, "MUD v3", "/status"),
    (4043, "The Lock v2", "/"),
    (4044, "Arena", "/stats"),
    (4045, "Grammar Engine", "/grammar"),
    (4046, "Dashboard", "/"),
    (4047, "Federated Nexus", "/"),
    (4050, "Harbor", "/"),
    (4055, "Grammar Compactor", "/status"),
    (4056, "Rate-Attention", "/streams"),
    (4057, "Skill Forge", "/status"),
    (4060, "PLATO Terminal", "/"),
    (6167, "Conduwuit", "/"),
    (6168, "Matrix Bridge", "/status"),
    (8847, "PLATO Gate", "/rooms"),
    (8848, "PLATO Shell", "/"),
    (8899, "Service Guard", "/"),
    (8900, "Task Queue", "/"),
    (8901, "Steward", "/"),
]

HOST = "147.224.38.131"

def check_service(port, name, path):
    try:
        url = f"http://{HOST}:{port}{path}"
        req = urllib.request.Request(url, method="GET")
        req.add_header("User-Agent", "FleetHealth/1.0")
        with urllib.request.urlopen(req, timeout=5) as r:
            status = r.status
            body = r.read(1024).decode("utf-8", errors="replace")
            # Try to parse JSON
            try:
                data = json.loads(body)
                # Extract useful metrics
                if "rooms" in data and isinstance(data["rooms"], int):
                    return (True, f"UP | {data['rooms']} rooms")
                elif "total_rules" in data:
                    return (True, f"UP | {data['total_rules']} rules")
                elif "total_players" in data:
                    return (True, f"UP | {data['total_players']} players")
                elif "total_matches" in data:
                    return (True, f"UP | {data['total_matches']} matches")
                elif "services" in data and isinstance(data["services"], dict):
                    up = sum(1 for s in data["services"].values() if s.get("status") in ("up", "healthy"))
                    return (True, f"UP | {up} sub-services")
                else:
                    return (True, f"UP | HTTP {status}")
            except:
                return (True, f"UP | HTTP {status}")
    except urllib.error.HTTPError as e:
        # HTTP 404 or other errors from a live service
        if e.code in (404, 400, 401):
            return (True, f"UP | HTTP {e.code}")
        return (False, f"DOWN | HTTP {e.code}")
    except Exception as e:
        return (False, f"DOWN | {type(e).__name__}")

def main():
    print("=== Fleet Health Monitor ===")
    print(f"Host: {HOST}")
    print(f"Time: {json.dumps(None)[:-5]} UTC")  # placeholder
    print()
    
    up_count = 0
    down_count = 0
    results = []
    
    for port, name, path in SERVICES:
        ok, detail = check_service(port, name, path)
        results.append((port, name, ok, detail))
        if ok:
            up_count += 1
        else:
            down_count += 1
        status_icon = "🟢" if ok else "🔴"
        print(f"{status_icon} {name:20s} (:{port}) — {detail}")
    
    print()
    print(f"Summary: {up_count}/{len(SERVICES)} UP, {down_count}/{len(SERVICES)} DOWN")
    
    # P0 checks
    print()
    print("=== P0 Security Checks ===")
    
    # valve-1 leak check
    try:
        url = f"http://{HOST}:4042/interact?agent=healthmon&action=examine&target=valve-1"
        with urllib.request.urlopen(url, timeout=5) as r:
            data = json.loads(r.read().decode())
            leaks = "count" in data or "rules" in data or len(str(data)) > 500
            status = "🔴 LEAKING" if leaks else "🟢 SAFE"
            print(f"{status} valve-1 (engine-room)")
    except Exception as e:
        print(f"⚠️  Could not check valve-1: {e}")
    
    # Compactor blind check
    try:
        url = f"http://{HOST}:4055/status"
        with urllib.request.urlopen(url, timeout=5) as r:
            data = json.loads(r.read().decode())
            compactor_rules = data.get("total_rules", 0)
        
        url = f"http://{HOST}:4045/grammar"
        with urllib.request.urlopen(url, timeout=5) as r:
            data = json.loads(r.read().decode())
            engine_rules = len(data.get("rules", []))
        
        blind = compactor_rules < engine_rules * 0.8
        status = "🔴 BLIND" if blind else "🟢 SYNCED"
        print(f"{status} Compactor ({compactor_rules} vs {engine_rules} engine rules)")
    except Exception as e:
        print(f"⚠️  Could not check compactor: {e}")
    
    # tmp server check
    try:
        url = f"http://{HOST}:4051/"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=3) as r:
            print("🔴 tmp server (4051) still UP — data leak risk")
    except:
        print("🟢 tmp server (4051) DOWN — no leak")
    
    return 0 if down_count == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
