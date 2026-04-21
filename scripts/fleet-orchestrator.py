#!/usr/bin/env python3
"""
Fleet Orchestrator — Cross-service cascade events.
When something happens in one service, intelligently cascade to others.

Examples:
- Grammar crystallizes motif → Arena spawns new game type → Nexus registers new client
- Arena match completed → Grammar records usage pattern → PLATO tile submitted
- Agent submits tile to PLATO → Grammar notified → Nexus updated → Shell logs it
"""
import json, time, threading, urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from collections import defaultdict

PORT = 8849
DATA_DIR = Path("/home/ubuntu/.openclaw/workspace/data/orchestrator")
DATA_DIR.mkdir(parents=True, exist_ok=True)

def fleet_get(url, timeout=3):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "fleet-orchestrator/1.0"})
        resp = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(resp.read())
    except:
        return None

def fleet_post(url, data, timeout=3):
    try:
        req = urllib.request.Request(url, 
            data=json.dumps(data).encode(),
            headers={"Content-Type": "application/json", "User-Agent": "fleet-orchestrator/1.0"})
        resp = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(resp.read())
    except:
        return None

class CascadeEngine:
    def __init__(self):
        self.rules = []
        self.event_log = []
        self.lock = threading.Lock()
        self.stats = {"events_processed": 0, "cascades_triggered": 0, "cascades_failed": 0}
        
        # Register default cascade rules
        self._register_default_rules()
    
    def _register_default_rules(self):
        self.rules = [
            {
                "name": "grammar-motif-to-arena",
                "trigger": {"service": "grammar", "event": "motif_crystallized"},
                "action": "spawn_arena_game",
                "description": "When grammar crystallizes a motif, arena spawns a new game type"
            },
            {
                "name": "arena-match-to-nexus",
                "trigger": {"service": "arena", "event": "match_completed"},
                "action": "update_nexus_client",
                "description": "When arena match completes, update federated nexus with match embedding"
            },
            {
                "name": "plato-tile-to-grammar",
                "trigger": {"service": "plato", "event": "tile_submitted"},
                "action": "notify_grammar_usage",
                "description": "When PLATO gets a tile, notify grammar engine for usage tracking"
            },
            {
                "name": "grammar-new-rule-to-nexus",
                "trigger": {"service": "grammar", "event": "rule_created"},
                "action": "register_nexus_client",
                "description": "When grammar creates a new rule, register it as a federated learning client"
            },
            {
                "name": "arena-archetype-to-crabtrap",
                "trigger": {"service": "arena", "event": "archetype_discovered"},
                "action": "create_crabtrap_object",
                "description": "When arena discovers a behavioral archetype, create a new MUD object"
            },
        ]
    
    def process_event(self, event):
        """Process an incoming event and trigger cascades."""
        service = event.get("service")
        event_type = event.get("event")
        
        results = []
        with self.lock:
            self.stats["events_processed"] += 1
            self.event_log.append({"event": event, "time": time.time()})
            if len(self.event_log) > 500:
                self.event_log = self.event_log[-500:]
        
        for rule in self.rules:
            trigger = rule["trigger"]
            if trigger["service"] == service and trigger["event"] == event_type:
                result = self._execute_cascade(rule, event)
                results.append({"rule": rule["name"], "result": result})
                with self.lock:
                    if result.get("success"):
                        self.stats["cascades_triggered"] += 1
                    else:
                        self.stats["cascades_failed"] += 1
        
        return {"event": event, "cascades": results}
    
    def _execute_cascade(self, rule, event):
        action = rule["action"]
        
        if action == "spawn_arena_game":
            motif = event.get("data", {}).get("motif_name", "unknown")
            game_name = f"motif-{motif[:20]}"
            result = fleet_post("http://localhost:4044/register_game", {
                "name": game_name,
                "type": "discovery",
                "description": f"Game spawned from crystallized motif: {motif}",
                "parent_motif": motif
            })
            return {"success": result is not None, "action": "spawn_arena_game", "detail": result or "arena unavailable"}
        
        elif action == "update_nexus_client":
            agent = event.get("data", {}).get("winner", "unknown")
            # Create a synthetic embedding from match outcome
            import random, math
            seed = int(hashlib.sha256(agent.encode()).hexdigest()[:8], 16) if 'hashlib' in dir() else 42
            vector = [math.sin(i * 0.3 + seed) * 0.1 for i in range(32)]
            result = fleet_post("http://localhost:4047/submit", {
                "client": f"arena:{agent}",
                "vector": vector,
                "samples": 1
            })
            return {"success": result is not None, "action": "update_nexus_client", "detail": result or "nexus unavailable"}
        
        elif action == "notify_grammar_usage":
            domain = event.get("data", {}).get("domain", "unknown")
            result = fleet_get(f"http://localhost:4045/record_usage?domain={domain}")
            return {"success": result is not None, "action": "notify_grammar_usage", "detail": result or "grammar unavailable"}
        
        elif action == "register_nexus_client":
            rule_name = event.get("data", {}).get("rule_name", "unknown")
            result = fleet_get(f"http://localhost:4047/register?client=grammar:{rule_name}")
            return {"success": result is not None, "action": "register_nexus_client", "detail": result or "nexus unavailable"}
        
        elif action == "create_crabtrap_object":
            archetype = event.get("data", {}).get("archetype", "unknown")
            return {"success": True, "action": "create_crabtrap_object", "detail": f"Would create {archetype} object in arena room"}
        
        return {"success": False, "action": action, "detail": "unknown action"}

import hashlib
engine = CascadeEngine()

class OrchestratorHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path
        
        if path == "/status":
            with engine.lock:
                self._json({
                    "rules": len(engine.rules),
                    "events_processed": engine.stats["events_processed"],
                    "cascades_triggered": engine.stats["cascades_triggered"],
                    "cascades_failed": engine.stats["cascades_failed"],
                    "recent_events": engine.event_log[-5:],
                    "rules_detail": engine.rules,
                })
        elif path == "/rules":
            self._json({"rules": engine.rules})
        elif path == "/test":
            # Run a test cascade
            result = engine.process_event({
                "service": "grammar",
                "event": "motif_crystallized",
                "data": {"motif_name": f"test_motif_{int(time.time())}"}
            })
            self._json(result)
        elif path == "/test-chain":
            # Full chain test: grammar → arena → nexus
            results = []
            r1 = engine.process_event({"service": "grammar", "event": "motif_crystallized", "data": {"motif_name": "chain-test"}})
            results.append(("grammar→arena", r1))
            r2 = engine.process_event({"service": "arena", "event": "match_completed", "data": {"winner": "chain-test-agent"}})
            results.append(("arena→nexus", r2))
            r3 = engine.process_event({"service": "plato", "event": "tile_submitted", "data": {"domain": "chain-test"}})
            results.append(("plato→grammar", r3))
            self._json({"chain_test": [(n, r["cascades"]) for n, r in results]})
        else:
            self._json({
                "service": "Fleet Orchestrator v1.0",
                "endpoints": ["/status", "/rules", "/test", "/test-chain", "/event (POST)"],
                "rules": len(engine.rules),
            })
    
    def do_POST(self):
        from urllib.parse import urlparse
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        
        if path == "/event":
            result = engine.process_event(body)
            self._json(result)
        else:
            self._json({"error": f"Unknown endpoint: {path}"})
    
    def _json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2, default=str).encode())
    
    def log_message(self, *a): pass

if __name__ == "__main__":
    print(f"🎛️ Fleet Orchestrator on :{PORT}")
    print(f"   Cascade rules: {len(engine.rules)}")
    HTTPServer(("0.0.0.0", PORT), OrchestratorHandler).serve_forever()
