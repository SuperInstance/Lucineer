#!/usr/bin/env python3
"""
Conductor — Fleet Control Plane (port 4061)

Designed by Perplexity AI (5th Crab Trap response), built by Oracle1.
Service #21: the central brain that turns fleet signals into coherent action.

Observes the whole fleet, resolves conflicts, fuses state from every
control service into a unified execution plan. Not where work happens —
where competing intentions get reconciled into one fleet-wide directive.
"""

import json, time, hashlib, threading, urllib.request
from collections import defaultdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path
import socket

import sys, os
FLEET_LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, str(FLEET_LIB))

DATA_DIR = Path(FLEET_LIB).parent / "data" / "conductor"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DIRECTIVES_FILE = DATA_DIR / "directives.jsonl"
EVENTS_FILE = DATA_DIR / "events.jsonl"


# ═══════════════════════════════════════════════════════════
# Fleet State — unified view from all services
# ═══════════════════════════════════════════════════════════

class FleetState:
    """Fuses signals from all control services into one view."""

    def __init__(self):
        self.services = {}       # name → {status, port, last_check}
        self.agents = {}         # name → {role, stage, reputation, readiness}
        self.rooms = {}          # name → {tiles, domain, accessible}
        self.routes = {}         # from→to → {path, cost}
        self.policies = {}       # policy_id → {passed, agents_affected}
        self.history_summary = {}
        self.directives = []     # active directives
        self.events = []         # recent events from all services
        self.conflicts = []      # detected conflicts
        self.last_fuse = 0
        self.fuse_count = 0

        self._load_directives()
        self._load_events()

    def _load_directives(self):
        if DIRECTIVES_FILE.exists():
            with open(DIRECTIVES_FILE) as f:
                for line in f:
                    try:
                        self.directives.append(json.loads(line.strip()))
                    except:
                        pass
            print(f"  Loaded {len(self.directives)} directives")

    def _load_events(self):
        if EVENTS_FILE.exists():
            with open(EVENTS_FILE) as f:
                for line in f:
                    try:
                        self.events.append(json.loads(line.strip()))
                    except:
                        pass
            # Keep last 500
            if len(self.events) > 500:
                self.events = self.events[-500:]
            print(f"  Loaded {len(self.events)} events")

    def _persist_directive(self, directive):
        with open(DIRECTIVES_FILE, "a") as f:
            f.write(json.dumps(directive, default=str) + "\n")

    def _persist_event(self, event):
        with open(EVENTS_FILE, "a") as f:
            f.write(json.dumps(event, default=str) + "\n")
        if len(self.events) > 500:
            self.events = self.events[-500:]

    def _fetch_json(self, url, timeout=3):
        try:
            resp = urllib.request.urlopen(url, timeout=timeout)
            return json.loads(resp.read())
        except:
            return None

    def fuse(self):
        """Full fleet state fusion — pull from all services."""
        t0 = time.time()
        self.conflicts = []

        # ── Services (Librarian) ──
        lib = self._fetch_json("http://localhost:4052/catalog", timeout=3)
        if lib and "services" in lib:
            for name, info in lib["services"].items():
                self.services[name] = {
                    "status": info.get("status", "unknown"),
                    "port": info.get("port"),
                    "url": info.get("url", ""),
                    "last_check": time.time()
                }
        else:
            # Manual service check if Librarian is down
            for name, port in [("PLATO", 8847), ("Crab Trap", 4042), ("Arena", 4044),
                               ("Grammar", 4045), ("Dashboard", 4046), ("Gatekeeper", 4053),
                               ("Librarian", 4052), ("Archivist", 4054), ("Pathfinder", 4051),
                               ("Orchestrator", 8849), ("Rate Attention", 4056),
                               ("Skill Forge", 4057), ("Task Queue", 4058), ("Portal", 4059),
                               ("Fleet Runner", 8899), ("Keeper", 8900), ("Agent API", 8901),
                               ("Grammar Compactor", 4055), ("MUD Telnet", 7777),
                               ("Matrix", 6167), ("Conductor", 4061)]:
                try:
                    urllib.request.urlopen(f"http://localhost:{port}/", timeout=2)
                    status = "up"
                except:
                    status = "down" if port not in (7777, 6167) else "unknown"
                self.services[name] = {"status": status, "port": port, "last_check": time.time()}

        # ── Agents (Gatekeeper + Arena) ──
        gk_agents = self._fetch_json("http://localhost:4053/agents", timeout=3)
        if gk_agents and "agents" in gk_agents:
            for name, info in gk_agents["agents"].items():
                self.agents[name] = {
                    "role": info.get("role", "visitor"),
                    "stage": info.get("stage", 0),
                    "reputation": info.get("reputation", 50),
                    "readiness": None,
                    "source": "gatekeeper"
                }

        arena = self._fetch_json("http://localhost:4044/leaderboard?n=20", timeout=3)
        if arena and "leaderboard" in arena:
            for p in arena["leaderboard"]:
                name = p.get("name", "")
                if name in self.agents:
                    self.agents[name]["elo"] = p.get("elo", 1000)
                    self.agents[name]["arena_matches"] = p.get("wins", 0) + p.get("losses", 0)

        # ── Readiness (Gatekeeper) ──
        for agent_name in list(self.agents.keys())[:10]:
            rd = self._fetch_json(f"http://localhost:4053/readiness?agent={agent_name}", timeout=2)
            if rd and "readiness" in rd:
                self.agents[agent_name]["readiness"] = rd["readiness"]

        # ── Rooms (Librarian) ──
        rooms = self._fetch_json("http://localhost:4052/rooms?sort=tiles", timeout=5)
        if rooms and "rooms" in rooms:
            for r in rooms["rooms"]:
                self.rooms[r["name"]] = {
                    "tiles": r.get("tiles", 0),
                    "domain": r.get("domain", ""),
                    "accessible": True
                }

        # ── Routes (Pathfinder) ──
        pf_graph = self._fetch_json("http://localhost:4051/graph", timeout=3)
        if pf_graph:
            self.routes = pf_graph  # full graph from pathfinder

        # ── History (Archivist) ──
        trends = self._fetch_json("http://localhost:4054/trends?hours=24", timeout=3)
        if trends:
            self.history_summary = trends

        # ── Policies (Gatekeeper) ──
        policies = self._fetch_json("http://localhost:4053/policies", timeout=3)
        if policies and "policies" in policies:
            for p in policies["policies"]:
                self.policies[p["id"]] = p

        # ── Conflict Detection ──
        self._detect_conflicts()

        self.last_fuse = time.time()
        self.fuse_count += 1
        elapsed = time.time() - t0

        return {
            "fused": True,
            "services": len(self.services),
            "agents": len(self.agents),
            "rooms": len(self.rooms),
            "conflicts": len(self.conflicts),
            "elapsed_seconds": round(elapsed, 2),
            "fuse_number": self.fuse_count
        }

    def _detect_conflicts(self):
        """Detect conflicting states across services."""
        self.conflicts = []

        # Service down that others depend on
        dep_map = {
            "Crab Trap": ["PLATO"],
            "Gatekeeper": ["Librarian"],
            "Conductor": ["Librarian", "Gatekeeper", "Archivist", "Pathfinder"],
        }
        for svc, deps in dep_map.items():
            for dep in deps:
                if self.services.get(dep, {}).get("status") == "down":
                    self.conflicts.append({
                        "type": "dependency_down",
                        "service": svc,
                        "depends_on": dep,
                        "severity": "high",
                        "message": f"{svc} depends on {dep} which is down"
                    })

        # Agent stuck at low readiness
        for name, info in self.agents.items():
            rd = info.get("readiness")
            if rd is not None and rd < 20 and info.get("stage", 0) > 0:
                self.conflicts.append({
                    "type": "agent_stuck",
                    "agent": name,
                    "readiness": rd,
                    "severity": "medium",
                    "message": f"{name} has stage {info['stage']} but readiness {rd}"
                })

        # Room with zero tiles (knowledge gap)
        for name, info in self.rooms.items():
            if info.get("tiles", 0) == 0 and not name.startswith("test"):
                self.conflicts.append({
                    "type": "empty_room",
                    "room": name,
                    "severity": "low",
                    "message": f"Room {name} has no tiles"
                })

    def generate_directive(self, action, target, priority="medium", details=None):
        """Generate a fleet directive."""
        directive = {
            "id": hashlib.sha256(f"{time.time()}{action}{target}".encode()).hexdigest()[:12],
            "timestamp": time.time(),
            "time_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "action": action,
            "target": target,
            "priority": priority,
            "details": details or {},
            "status": "active",
            "source": "conductor"
        }
        self.directives.append(directive)
        self._persist_directive(directive)
        return directive

    def resolve_conflicts(self):
        """Auto-resolve detected conflicts where possible."""
        resolutions = []

        for conflict in self.conflicts:
            if conflict["type"] == "dependency_down":
                dep = conflict["depends_on"]
                port = self.services.get(dep, {}).get("port")
                if port:
                    directive = self.generate_directive(
                        "restart_service", dep, priority="high",
                        details={"port": port, "reason": f"Dependency for {conflict['service']}"}
                    )
                    resolutions.append({
                        "conflict": conflict["type"],
                        "resolution": "restart_directive",
                        "directive_id": directive["id"],
                        "target": dep
                    })

            elif conflict["type"] == "agent_stuck":
                agent = conflict["agent"]
                directive = self.generate_directive(
                    "boost_agent", agent, priority="medium",
                    details={"action": "reputation_boost", "delta": 5, "reason": "stuck at low readiness"}
                )
                resolutions.append({
                    "conflict": conflict["type"],
                    "resolution": "reputation_boost",
                    "directive_id": directive["id"],
                    "target": agent
                })

            elif conflict["type"] == "empty_room":
                room = conflict["room"]
                directive = self.generate_directive(
                    "seed_room", room, priority="low",
                    details={"action": "generate_tiles", "reason": "Empty room needs initial knowledge"}
                )
                resolutions.append({
                    "conflict": conflict["type"],
                    "resolution": "seed_directive",
                    "directive_id": directive["id"],
                    "target": room
                })

        return resolutions

    def prioritize(self):
        """Compute execution priorities from fused state."""
        priorities = {
            "critical": [],
            "high": [],
            "medium": [],
            "low": []
        }

        # Service health
        down = [n for n, s in self.services.items() if s.get("status") == "down"]
        if down:
            priorities["critical"].append({"action": "restore_services", "targets": down})

        # Conflicts
        for c in self.conflicts:
            priorities[c.get("severity", "medium")].append(c)

        # Active directives
        active = [d for d in self.directives if d.get("status") == "active"]
        for d in active:
            priorities[d.get("priority", "medium")].append({
                "action": "directive",
                "id": d["id"],
                "target": d["target"],
                "directive_action": d["action"]
            })

        return {
            "critical": len(priorities["critical"]),
            "high": len(priorities["high"]),
            "medium": len(priorities["medium"]),
            "low": len(priorities["low"]),
            "priorities": priorities,
            "total_active": sum(len(v) for v in priorities.values())
        }

    def get_timeline(self, limit=30):
        """Unified fleet timeline from events and directives."""
        items = []

        for d in self.directives[-limit:]:
            items.append({
                "time": d.get("time_iso"),
                "timestamp": d.get("timestamp"),
                "type": "directive",
                "action": d.get("action"),
                "target": d.get("target"),
                "priority": d.get("priority"),
                "status": d.get("status")
            })

        for e in self.events[-limit:]:
            items.append({
                "time": e.get("time_iso", e.get("timestamp")),
                "timestamp": e.get("timestamp", 0),
                "type": "event",
                "source": e.get("source", e.get("service", "")),
                "action": e.get("event", e.get("action", "")),
                "details": e.get("details", {})
            })

        items.sort(key=lambda x: -x.get("timestamp", 0))
        return items[:limit]

    def get_summary(self):
        """Human-readable fleet summary — the 'one timeline' view."""
        svc_up = sum(1 for s in self.services.values() if s.get("status") == "up")
        svc_total = len(self.services)
        agents_active = sum(1 for a in self.agents.values() if a.get("readiness", 0) > 30)
        total_tiles = sum(r.get("tiles", 0) for r in self.rooms.values())

        active_directives = [d for d in self.directives if d.get("status") == "active"]

        return {
            "services": f"{svc_up}/{svc_total} up",
            "agents": f"{len(self.agents)} registered, {agents_active} active",
            "rooms": f"{len(self.rooms)} rooms, {total_tiles} tiles",
            "conflicts": len(self.conflicts),
            "active_directives": len(active_directives),
            "fuse_number": self.fuse_count,
            "last_fuse_ago": f"{int(time.time() - self.last_fuse)}s" if self.last_fuse else "never",
            "history_24h": self.history_summary.get("total_events", 0),
            "failure_rate": self.history_summary.get("failure_rate", 0),
            "top_priority": (self.prioritize()["priorities"].get("critical") or [None])[0]
        }

    def receive_event(self, event):
        """Receive an event from any service."""
        event["received_at"] = time.time()
        event["received_iso"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.events.append(event)
        self._persist_event(event)

        # Auto-react to certain events
        etype = event.get("event", event.get("type", ""))
        if etype == "service_down":
            self.generate_directive("check_service", event.get("service", "unknown"),
                                    priority="high", details=event)
        elif etype == "critical_alert":
            self.generate_directive("investigate", event.get("source", "unknown"),
                                    priority="critical", details=event)

        return {"received": True, "event_type": etype}


# ═══════════════════════════════════════════════════════════
# HTTP Handler
# ═══════════════════════════════════════════════════════════

state = FleetState()

class ReusableHTTPServer(HTTPServer):
    allow_reuse_address = True
    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        super().server_bind()

class ConductorHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        params = parse_qs(parsed.query)

        if path == "" or path == "/":
            self._json({
                "service": "Conductor",
                "port": 4061,
                "purpose": "Unify fleet signals into one coherent execution plan",
                "designed_by": "Perplexity AI (5th Crab Trap response)",
                "built_by": "Oracle1",
                "note": "Port 4061 (4056 occupied by Rate Attention)",
                "endpoints": [
                    "GET / — overview",
                    "GET /fuse — trigger full fleet state fusion",
                    "GET /summary — unified fleet summary",
                    "GET /services — service health from fused state",
                    "GET /agents — agent registry from fused state",
                    "GET /rooms — room index from fused state",
                    "GET /conflicts — detected conflicts",
                    "GET /resolve — auto-resolve conflicts",
                    "GET /priorities — execution priority stack",
                    "GET /directives — active directives",
                    "GET /timeline — unified fleet timeline",
                    "GET /routes — pathfinder graph",
                    "GET /history — 24h history summary",
                    "POST /event — receive event from any service",
                    "POST /directive — create directive",
                    "POST /directive/{id}/complete — mark directive done",
                ],
                "summary": state.get_summary() if state.last_fuse else "Not yet fused — GET /fuse first"
            })

        elif path == "/fuse":
            result = state.fuse()
            self._json(result)

        elif path == "/summary":
            self._json(state.get_summary())

        elif path == "/services":
            self._json({
                "total": len(state.services),
                "up": sum(1 for s in state.services.values() if s.get("status") == "up"),
                "down": sum(1 for s in state.services.values() if s.get("status") == "down"),
                "services": state.services
            })

        elif path == "/agents":
            self._json({
                "total": len(state.agents),
                "agents": state.agents
            })

        elif path == "/rooms":
            self._json({
                "total": len(state.rooms),
                "rooms": state.rooms
            })

        elif path == "/conflicts":
            self._json({
                "total": len(state.conflicts),
                "conflicts": state.conflicts
            })

        elif path == "/resolve":
            resolutions = state.resolve_conflicts()
            self._json({"resolved": len(resolutions), "resolutions": resolutions})

        elif path == "/priorities":
            self._json(state.prioritize())

        elif path == "/directives":
            status_filter = params.get("status", [None])[0]
            directs = state.directives
            if status_filter:
                directs = [d for d in directs if d.get("status") == status_filter]
            directs.sort(key=lambda d: -d.get("timestamp", 0))
            self._json({
                "total": len(directs),
                "active": sum(1 for d in directs if d.get("status") == "active"),
                "directives": directs[-50:]
            })

        elif path == "/timeline":
            limit = int(params.get("limit", ["30"])[0])
            self._json({"timeline": state.get_timeline(limit)})

        elif path == "/routes":
            self._json(state.routes)

        elif path == "/history":
            self._json(state.history_summary)

        else:
            self._json({"error": "Not found. Start at GET /"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        if path == "/event":
            result = state.receive_event(body)
            self._json(result)

        elif path == "/directive":
            action = body.get("action", "investigate")
            target = body.get("target", "fleet")
            priority = body.get("priority", "medium")
            directive = state.generate_directive(action, target, priority, body.get("details"))
            self._json({"created": True, "directive": directive})

        elif path.startswith("/directive/") and path.endswith("/complete"):
            did = path.split("/directive/")[1].replace("/complete", "")
            found = False
            for d in state.directives:
                if d.get("id") == did:
                    d["status"] = "completed"
                    d["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    found = True
                    self._json({"completed": True, "directive_id": did})
                    break
            if not found:
                self._json({"error": f"Directive {did} not found"}, 404)

        else:
            self._json({"error": "Not found. POST /event, /directive, /directive/{id}/complete"}, 404)

    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2, default=str).encode())


if __name__ == "__main__":
    port = 4061
    print(f"Conductor starting on port {port}")
    print(f"  Initial fleet fusion...")
    state.fuse()
    server = ReusableHTTPServer(("0.0.0.0", port), ConductorHandler)
    print(f"  Ready — fleet control plane and unified timeline")
    server.serve_forever()
