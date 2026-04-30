#!/usr/bin/env python3
"""
PLATO Validation Loop v1.0 — Executable Tile Specs

Tiles can include an `assertions` field with testable claims.
The validation loop runs assertions and produces validation tiles.

Usage:
  Start: python3 validation_loop.py --port 4046
  Submit assertion tile: POST /validate with {domain, question, answer, assertions: [...]}
  Check status: GET /status
"""

import json
import hashlib
import time
import argparse
import re
import math
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = 4046
PLATO_URL = "http://localhost:8847"
MUD_URL = "http://localhost:4042"

# Validation functions for common assertion types
VALIDATORS = {
    "url_reachable": lambda val: validate_url_reachable(val),
    "json_field": lambda val, field, expected: validate_json_field(val, field, expected),
    "numeric_range": lambda val, low, high: validate_numeric_range(val, low, high),
    "regex_match": lambda val, pattern: bool(re.search(pattern, str(val))),
    "min_length": lambda val, n: len(str(val)) >= n,
    "max_length": lambda val, n: len(str(val)) <= n,
    "contains": lambda val, substr: str(substr) in str(val),
    "not_contains": lambda val, substr: str(substr) not in str(val),
    "equals": lambda val, expected: val == expected,
    "greater_than": lambda val, threshold: float(val) > float(threshold),
    "less_than": lambda val, threshold: float(val) < float(threshold),
    "is_type": lambda val, typ: type(val).__name__ == typ,
    "plato_room_exists": lambda room: validate_plato_room(room),
    "mud_room_exists": lambda room: validate_mud_room(room),
    "pypi_package_exists": lambda pkg: validate_pypi_package(pkg),
}

validation_log = []
stats = {"total": 0, "passed": 0, "failed": 0, "errors": 0}


def validate_url_reachable(url):
    import urllib.request
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "plato-validation/1.0"})
        with urllib.request.urlopen(req, timeout=5) as r:
            return {"pass": r.status == 200, "detail": f"HTTP {r.status}"}
    except Exception as e:
        return {"pass": False, "detail": str(e)}


def validate_json_field(url, field, expected):
    import urllib.request
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            data = json.loads(r.read())
            actual = data.get(field)
            return {"pass": actual == expected, "detail": f"field={field} expected={expected} actual={actual}"}
    except Exception as e:
        return {"pass": False, "detail": str(e)}


def validate_numeric_range(val, low, high):
    try:
        n = float(val)
        return {"pass": low <= n <= high, "detail": f"{n} in [{low}, {high}]"}
    except:
        return {"pass": False, "detail": f"Cannot convert {val} to number"}


def validate_plato_room(room):
    import urllib.request
    try:
        with urllib.request.urlopen(f"{PLATO_URL}/rooms", timeout=5) as r:
            data = json.loads(r.read())
            # PLATO returns {room_name: {tile_count: N}, ...}
            if isinstance(data, dict):
                rooms = list(data.keys())
            else:
                rooms = [rm.get("name","") for rm in data.get("rooms", [])]
            return {"pass": room in rooms, "detail": f"room '{room}' {'found' if room in rooms else 'not found'} in {len(rooms)} rooms"}
    except Exception as e:
        return {"pass": False, "detail": str(e)}


def validate_pypi_package(pkg):
    import urllib.request
    try:
        url = f"https://pypi.org/pypi/{pkg}/json"
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.loads(r.read())
            version = data["info"]["version"]
            return {"pass": True, "detail": f"{pkg} v{version} found on PyPI"}
    except Exception as e:
        return {"pass": False, "detail": f"{pkg}: {e}"}


def run_assertion(assertion):
    """Run a single assertion and return result."""
    atype = assertion.get("type")
    if atype not in VALIDATORS:
        return {"pass": False, "detail": f"Unknown assertion type: {atype}"}
    
    try:
        fn = VALIDATORS[atype]
        args = [assertion.get(k) for k in list(assertion.keys()) if k not in ("type", "name")]
        result = fn(*args)
        if isinstance(result, bool):
            result = {"pass": result, "detail": str(assertion)}
        return result
    except Exception as e:
        return {"pass": False, "detail": f"Error: {e}"}


def validate_mud_room(room):
    import urllib.request
    try:
        # Auto-connect first
        urllib.request.urlopen(f"{MUD_URL}/connect?agent=validator&job=checker", timeout=5)
        rooms_count = 0
        try:
            with urllib.request.urlopen(f"{MUD_URL}/status", timeout=5) as r:
                data = json.loads(r.read())
                rooms_count = data.get("rooms", 0)
        except: pass
        # Move to verify
        with urllib.request.urlopen(f"{MUD_URL}/move?agent=validator&room={room}", timeout=5) as r2:
            result = json.loads(r2.read())
            if isinstance(result, dict) and "error" not in result:
                return {"pass": True, "detail": f"MUD room '{room}' exists ({rooms_count} total rooms)"}
            else:
                return {"pass": False, "detail": f"MUD room '{room}' not found"}
    except Exception as e:
        return {"pass": False, "detail": str(e)}

def validate_tile(tile_data):
    """Validate a tile's assertions and return results."""
    assertions = tile_data.get("assertions", [])
    if not assertions:
        return {"validated": False, "reason": "no assertions", "results": []}
    
    results = []
    for a in assertions:
        r = run_assertion(a)
        r["name"] = a.get("name", a.get("type", "unnamed"))
        results.append(r)
    
    all_pass = all(r["pass"] for r in results)
    return {"validated": all_pass, "total": len(results), "passed": sum(1 for r in results if r["pass"]),
            "failed": sum(1 for r in results if not r["pass"]), "results": results}


class ValidationHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress default logging

    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == "/":
            self._json({
                "service": "✅ PLATO Validation Loop v1.0",
                "description": "Executable tile assertions — validate knowledge automatically",
                "endpoints": [
                    "GET / — this page",
                    "GET /status — validation statistics",
                    "GET /log — recent validation results",
                    "POST /validate — validate a tile's assertions",
                    "POST /validate_batch — validate multiple tiles",
                    "GET /example — sample validation tile",
                ]
            })
        elif path == "/status":
            self._json(stats)
        elif path == "/log":
            self._json({"validations": validation_log[-50:], "total": len(validation_log)})
        elif path == "/example":
            self._json({
                "domain": "ecosystem-health",
                "question": "Is cocapn-plato published on PyPI?",
                "answer": "Yes, cocapn-plato is available at pypi.org/project/cocapn-plato",
                "confidence": 0.95,
                "assertions": [
                    {"type": "pypi_package_exists", "pkg": "cocapn-plato", "name": "PyPI package exists"},
                    {"type": "url_reachable", "val": "http://147.224.38.131:4042/health", "name": "MUD health check"},
                    {"type": "plato_room_exists", "room": "harbor", "name": "Harbor room exists"},
                ]
            })
        else:
            self._json({"error": "Not found. GET / for help"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path in ("/validate", "/validate_batch"):
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}

            if path == "/validate_batch":
                tiles = body.get("tiles", [])
            else:
                tiles = [body]

            batch_results = []
            for tile in tiles:
                result = validate_tile(tile)
                result["tile"] = tile.get("question", "unnamed")[:80]
                batch_results.append(result)
                stats["total"] += result.get("total", 0)
                stats["passed"] += result.get("passed", 0)
                stats["failed"] += result.get("failed", 0)
                if not result.get("validated", True):
                    stats["errors"] += 1
                validation_log.append({"timestamp": time.time(), **result})

            self._json({"results": batch_results, "batch_size": len(tiles)})
        else:
            self._json({"error": "Not found. GET / for help"}, 404)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=PORT)
    args = parser.parse_args()
    
    print(f"✅ PLATO Validation Loop starting on port {args.port}")
    server = HTTPServer(("0.0.0.0", args.port), ValidationHandler)
    server.serve_forever()
