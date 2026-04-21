#!/usr/bin/env python3
"""
PurplePincher Monitor — Live dashboard for external agent activity.
Tracks which agents are hitting which services, what tiles they're generating,
and feeds everything into the Adaptive MUD.
"""
import json, time, threading, urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from collections import defaultdict

PORT = 8851
PLATO_URL = "http://localhost:8847"
CRAB_TRAP_URL = "http://localhost:4042"
ADAPTIVE_URL = "http://localhost:8850"
ORCHESTRATOR_URL = "http://localhost:8849"

DATA_DIR = Path("/home/ubuntu/.openclaw/workspace/data/purplepincher")
DATA_DIR.mkdir(parents=True, exist_ok=True)

def fleet_get(url, timeout=3):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "pp-monitor/1.0"})
        resp = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(resp.read())
    except:
        return None

class PurplePincherMonitor:
    def __init__(self):
        self.agent_sessions = {}  # agent_name -> session data
        self.lock = threading.Lock()
        self.last_plato_count = 0
        self.tiles_per_minute = []
        self.discoveries = []  # notable findings from external agents
    
    def get_live_view(self):
        """Aggregate live data from all services."""
        plato = fleet_get(f"{PLATO_URL}/status")
        crabtrap = fleet_get(f"{CRAB_TRAP_URL}/stats")
        shell = fleet_get(f"http://localhost:8848/admin")
        adaptive = fleet_get(f"{ADAPTIVE_URL}/status")
        
        # Calculate tile rate
        current_tiles = plato.get("total_tiles", 0) if plato else 0
        tile_delta = current_tiles - self.last_plato_count
        self.last_plato_count = current_tiles
        
        self.tiles_per_minute.append((tile_delta, time.time()))
        if len(self.tiles_per_minute) > 60:
            self.tiles_per_minute = self.tiles_per_minute[-60:]
        
        avg_rate = sum(d for d, _ in self.tiles_per_minute) / max(len(self.tiles_per_minute), 1)
        
        return {
            "plato_tiles": current_tiles,
            "tile_rate_per_min": round(avg_rate, 1),
            "crabtrap_agents": len(crabtrap.get("agents", {})) if crabtrap else 0,
            "shell_commands": shell.get("total_commands", 0) if shell else 0,
            "shell_agents": list(shell.get("agents", {}).keys()) if shell else [],
            "adaptive_agents": len(adaptive.get("agent_details", {})) if adaptive else 0,
            "top_domains": self._get_top_domains(plato),
            "timestamp": time.time(),
        }
    
    def _get_top_domains(self, plato):
        if not plato:
            return []
        rooms = sorted(plato.get("rooms", {}).items(), key=lambda x: -x[1]["tile_count"])
        return [{"domain": n, "tiles": r["tile_count"]} for n, r in rooms[:10]]
    
    def record_discovery(self, agent, domain, insight):
        """Record a notable finding from an external agent."""
        with self.lock:
            self.discoveries.append({
                "agent": agent,
                "domain": domain,
                "insight": insight[:500],
                "time": time.time()
            })
            if len(self.discoveries) > 100:
                self.discoveries = self.discoveries[-100:]

monitor = PurplePincherMonitor()

class MonitorHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path
        
        if path == "/live":
            self._json(monitor.get_live_view())
        elif path == "/discoveries":
            self._json({"discoveries": monitor.discoveries[-20:]})
        elif path == "/domains":
            plato = fleet_get(f"{PLATO_URL}/status")
            if plato:
                rooms = sorted(plato.get("rooms", {}).items(), key=lambda x: -x[1]["tile_count"])
                self._json({"domains": [{"name": n, "tiles": r["tile_count"], "created": r["created"]} for n, r in rooms]})
            else:
                self._json({"error": "plato unavailable"})
        elif path == "/agents":
            crabtrap = fleet_get(f"{CRAB_TRAP_URL}/stats")
            adaptive = fleet_get(f"{ADAPTIVE_URL}/status")
            self._json({
                "crabtrap": list(crabtrap.get("agents", {}).keys()) if crabtrap else [],
                "adaptive": {k: v for k, v in adaptive.get("agent_details", {}).items()} if adaptive else {},
            })
        else:
            self._json({
                "service": "PurplePincher Monitor v1.0",
                "endpoints": ["/live", "/discoveries", "/domains", "/agents"],
            })
    
    def do_POST(self):
        from urllib.parse import urlparse
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        
        if path == "/discovery":
            monitor.record_discovery(body.get("agent","unknown"), body.get("domain","unknown"), body.get("insight",""))
            self._json({"status": "recorded"})
        else:
            self._json({"error": f"Unknown: {path}"})
    
    def _json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2, default=str).encode())
    
    def log_message(self, *a): pass

if __name__ == "__main__":
    print(f"📊 PurplePincher Monitor on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), MonitorHandler).serve_forever()
