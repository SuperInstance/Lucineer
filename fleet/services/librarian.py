#!/usr/bin/env python3
"""
Librarian — Fleet Knowledge Index & Catalog (port 4052)

Designed by Perplexity AI (2nd Crab Trap response), built by Oracle1.
Service #18 completes the system: execution, monitoring, routing, scoring → now legibility.

The catalog and retrieval layer. Normalizes metadata from services, rooms,
agents, and jobs into a searchable index. Source of truth for:
- Service discovery
- Room lookup
- Architecture summaries
- Dependency maps
- Cross-service contract indexing
"""

import json, time, hashlib, threading, urllib.request
from collections import defaultdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path
import socket

# ── Fleet paths ──
import sys, os
FLEET_LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, str(FLEET_LIB))

DATA_DIR = Path(FLEET_LIB).parent / "data" / "librarian"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ═══════════════════════════════════════════════════════════
# Fleet Index — the unified catalog
# ═══════════════════════════════════════════════════════════

class FleetIndex:
    """Searchable index of everything in the fleet."""

    def __init__(self):
        self.services = {}      # name → {port, status, endpoints, last_seen}
        self.rooms = {}         # name → {tiles, exits, domain, objects, source}
        self.agents = {}        # name → {role, location, last_seen}
        self.jobs = {}          # job_id → {title, room, category, status}
        self.dependencies = {}  # service → [services it depends on]
        self.contracts = {}     # (service, endpoint) → {method, params, returns}
        self.search_index = defaultdict(list)  # keyword → [entries]
        self.last_indexed = 0
        self.index_count = 0

    def index_all(self):
        """Full fleet scan — services, rooms, agents, jobs."""
        t0 = time.time()
        self._index_services()
        self._index_plato_rooms()
        self._index_agents()
        self._index_jobs()
        self._build_search_index()
        self._infer_dependencies()
        self.last_indexed = time.time()
        self.index_count += 1
        elapsed = time.time() - t0
        print(f"  Indexed: {len(self.services)} services, {len(self.rooms)} rooms, "
              f"{len(self.agents)} agents, {len(self.jobs)} jobs ({elapsed:.1f}s)")

    def _fetch_json(self, url, timeout=3):
        try:
            resp = urllib.request.urlopen(url, timeout=timeout)
            return json.loads(resp.read())
        except:
            return None

    def _index_services(self):
        """Discover all fleet services."""
        known_services = [
            ("PLATO", 8847, ["/rooms", "/submit"]),
            ("Crab Trap", 4042, ["/connect", "/look", "/move", "/interact", "/submit"]),
            ("The Lock", 4043, ["/strategies", "/session"]),
            ("Arena", 4044, ["/leaderboard", "/match", "/register"]),
            ("Grammar", 4045, ["/grammar", "/evolve"]),
            ("Dashboard", 4046, ["/"]),
            ("Nexus", 4047, ["/status"]),
            ("PLATO Shell", 8848, ["/execute"]),
            ("Orchestrator", 8849, ["/status", "/event"]),
            ("Adaptive MUD", 8850, ["/status"]),
            ("Monitor", 8851, ["/status"]),
            ("Scorer", 8852, ["/status"]),
            ("Browser PLATO", 4050, ["/"]),
            ("Web Terminal", 4060, ["/"]),
            ("Grammar Compactor", 4055, ["/stats", "/compact"]),
            ("Rate Attention", 4056, ["/attention", "/sample"]),
            ("Skill Forge", 4057, ["/drills", "/agents"]),
            ("Task Queue", 4058, ["/task", "/tasks"]),
            ("Portal", 4059, ["/"]),
            ("Pathfinder", 4051, ["/graph", "/route", "/shortest", "/bottlenecks"]),
            ("Fleet Runner", 8899, ["/status", "/start", "/stop"]),
            ("Keeper", 8900, ["/status", "/register", "/discover"]),
            ("Agent API", 8901, ["/agents", "/status"]),
            ("MUD Telnet", 7777, []),
            ("Matrix", 6167, []),
        ]

        for name, port, endpoints in known_services:
            status = "unknown"
            if port in (7777, 6167):
                # Telnet/Matrix — just check if port is open
                try:
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    s.settimeout(1)
                    s.connect(("localhost", port))
                    s.close()
                    status = "up"
                except:
                    status = "down"
            else:
                try:
                    urllib.request.urlopen(f"http://localhost:{port}/", timeout=2)
                    status = "up"
                except:
                    try:
                        urllib.request.urlopen(f"http://localhost:{port}/status", timeout=2)
                        status = "up"
                    except:
                        status = "down"

            self.services[name] = {
                "port": port,
                "status": status,
                "endpoints": endpoints,
                "last_seen": time.time(),
                "url": f"http://147.224.38.131:{port}"
            }

    def _index_plato_rooms(self):
        """Index all PLATO rooms with full metadata."""
        data = self._fetch_json("http://localhost:8847/rooms", timeout=5)
        if data:
            for name, info in data.items():
                self.rooms[name] = {
                    "tiles": info.get("tile_count", 0),
                    "domain": info.get("domain", ""),
                    "source": "plato",
                    "last_indexed": time.time()
                }

        # Enrich with MUD room data
        try:
            urllib.request.urlopen(
                "http://localhost:4042/connect?agent=librarian-indexer&job=scout", timeout=3
            )
        except:
            pass

        mud_rooms = [
            "harbor", "forge", "bridge", "dojo", "engine-room",
            "observatory", "lighthouse", "archives", "court",
            "tide-pool", "shell-gallery", "fishing-grounds",
            "arena-hall", "nexus-chamber", "ouroboros", "reef", "workshop"
        ]
        for room in mud_rooms:
            data = self._fetch_json(
                f"http://localhost:4042/move?agent=librarian-indexer&room={room}", timeout=3
            )
            if data and "error" not in data:
                if room in self.rooms:
                    self.rooms[room]["exits"] = data.get("exits", [])
                    self.rooms[room]["objects"] = data.get("objects", [])
                    self.rooms[room]["description"] = data.get("description", "")[:200]
                    self.rooms[room]["source"] = "plato+mud"
                else:
                    self.rooms[room] = {
                        "tiles": 0,
                        "exits": data.get("exits", []),
                        "objects": data.get("objects", []),
                        "description": data.get("description", "")[:200],
                        "source": "mud",
                        "last_indexed": time.time()
                    }

    def _index_agents(self):
        """Index registered agents from Arena + Keeper."""
        # Arena agents
        arena = self._fetch_json("http://localhost:4044/leaderboard?n=50", timeout=3)
        if arena and "leaderboard" in arena:
            for player in arena["leaderboard"]:
                name = player.get("name", "")
                self.agents[name] = {
                    "role": "arena_competitor",
                    "elo": player.get("elo", 1000),
                    "wins": player.get("wins", 0),
                    "losses": player.get("losses", 0),
                    "last_seen": time.time()
                }

        # Keeper agents
        keeper = self._fetch_json("http://localhost:8900/status", timeout=3)
        if keeper and "agents" in keeper:
            for name, info in keeper["agents"].items():
                if name in self.agents:
                    self.agents[name]["role"] = "fleet_agent"
                    self.agents[name]["capabilities"] = info.get("capabilities", [])
                else:
                    self.agents[name] = {
                        "role": "fleet_agent",
                        "capabilities": info.get("capabilities", []),
                        "last_seen": time.time()
                    }

    def _index_jobs(self):
        """Index available jobs/tasks from MUD + Task Queue."""
        # MUD jobs — /jobs returns a list of strings, not dicts
        mud_status = self._fetch_json("http://localhost:4042/jobs", timeout=3)
        if mud_status:
            if isinstance(mud_status, list):
                for job_name in mud_status:
                    if isinstance(job_name, str):
                        self.jobs[f"mud-{job_name}"] = {
                            "title": job_name,
                            "category": "mud_task",
                            "status": "active"
                        }
                    elif isinstance(job_name, dict):
                        jid = job_name.get("id", job_name.get("name", str(time.time())))
                        self.jobs[f"mud-{jid}"] = {
                            "title": job_name.get("name", ""),
                            "category": "mud_task",
                            "status": "active"
                        }

        # Task Queue tasks
        tq = self._fetch_json("http://localhost:4058/tasks", timeout=3)
        if tq and "tasks" in tq:
            for task in tq["tasks"]:
                tid = task.get("id", str(time.time()))
                self.jobs[f"tq-{tid}"] = {
                    "title": task.get("title", ""),
                    "category": task.get("category", ""),
                    "status": task.get("status", "available"),
                    "difficulty": task.get("difficulty", "")
                }

    def _build_search_index(self):
        """Build keyword search index from all cataloged items."""
        self.search_index.clear()

        # Index services
        for name, info in self.services.items():
            keywords = [name.lower(), str(info["port"])]
            keywords.extend(e.strip("/") for e in info.get("endpoints", []))
            for kw in keywords:
                self.search_index[kw].append({"type": "service", "name": name, "port": info["port"]})

        # Index rooms
        for name, info in self.rooms.items():
            keywords = [name.lower()]
            if info.get("domain"):
                keywords.append(info["domain"].lower())
            for obj in info.get("objects", []):
                keywords.append(obj.lower())
            for kw in keywords:
                self.search_index[kw].append({"type": "room", "name": name, "tiles": info.get("tiles", 0)})

        # Index agents
        for name, info in self.agents.items():
            keywords = [name.lower(), info.get("role", "")]
            for cap in info.get("capabilities", []):
                keywords.append(cap.lower())
            for kw in keywords:
                self.search_index[kw].append({"type": "agent", "name": name, "role": info.get("role", "")})

    def _infer_dependencies(self):
        """Infer service dependency graph from port references and known connections."""
        self.dependencies = {
            "Crab Trap": ["PLATO", "Arena", "Grammar", "Task Queue"],
            "The Lock": ["PLATO"],
            "Arena": ["PLATO"],
            "Grammar": ["PLATO", "Orchestrator"],
            "Dashboard": ["PLATO", "Arena", "Grammar", "Pathfinder", "Nexus"],
            "Nexus": ["PLATO", "Keeper"],
            "Orchestrator": ["Grammar", "Arena", "PLATO"],
            "Adaptive MUD": ["PLATO", "Crab Trap"],
            "Monitor": ["Rate Attention", "PLATO"],
            "Scorer": ["PLATO"],
            "Pathfinder": ["PLATO", "Crab Trap", "Dashboard"],
            "Librarian": ["PLATO", "Crab Trap", "Arena", "Keeper", "Task Queue", "Pathfinder"],
            "Fleet Runner": ["all services"],
            "Keeper": [],
            "Agent API": ["Keeper"],
            "Grammar Compactor": ["Grammar", "PLATO"],
            "Rate Attention": ["all services"],
            "Skill Forge": ["PLATO", "Grammar"],
            "Task Queue": ["PLATO", "Portal"],
            "Portal": ["Task Queue", "Crab Trap"],
            "PLATO Shell": ["PLATO"],
            "Web Terminal": ["PLATO", "Crab Trap"],
            "Browser PLATO": ["PLATO"],
            "MUD Telnet": ["PLATO"],
        }

    # ── Query methods ──

    def search(self, query):
        """Keyword search across services, rooms, agents."""
        q = query.lower().strip()
        results = []
        seen = set()

        # Direct match
        for entry in self.search_index.get(q, []):
            key = (entry["type"], entry["name"])
            if key not in seen:
                seen.add(key)
                results.append(entry)

        # Partial match
        for keyword, entries in self.search_index.items():
            if q in keyword and keyword != q:
                for entry in entries:
                    key = (entry["type"], entry["name"])
                    if key not in seen:
                        seen.add(key)
                        results.append(entry)

        return results

    def service_catalog(self):
        """Full service catalog with status."""
        return {
            "total": len(self.services),
            "up": sum(1 for s in self.services.values() if s["status"] == "up"),
            "down": sum(1 for s in self.services.values() if s["status"] == "down"),
            "services": self.services
        }

    def room_directory(self, sort="tiles"):
        """Room directory sorted by tile count or name."""
        rooms = [
            {"name": name, **info}
            for name, info in self.rooms.items()
        ]
        if sort == "tiles":
            rooms.sort(key=lambda r: -r.get("tiles", 0))
        else:
            rooms.sort(key=lambda r: r["name"])
        return rooms

    def dependency_map(self):
        """Service dependency graph."""
        return {
            "services": len(self.dependencies),
            "graph": self.dependencies,
            "most_dependent": sorted(
                self.dependencies.items(),
                key=lambda x: -len(x[1])
            )[:5]
        }

    def architecture_summary(self):
        """Human-readable fleet architecture summary."""
        services_up = sum(1 for s in self.services.values() if s["status"] == "up")
        total_tiles = sum(r.get("tiles", 0) for r in self.rooms.values())
        room_domains = defaultdict(int)
        for r in self.rooms.values():
            if r.get("domain"):
                room_domains[r["domain"]] += 1

        return {
            "services": {"total": len(self.services), "up": services_up},
            "rooms": {"total": len(self.rooms), "tiles": total_tiles},
            "agents": len(self.agents),
            "jobs": len(self.jobs),
            "domains": dict(sorted(room_domains.items(), key=lambda x: -x[1])[:10]),
            "index_age_seconds": int(time.time() - self.last_indexed) if self.last_indexed else None,
            "index_count": self.index_count
        }

    def what_exists(self, category=None):
        """Answer: what exists? Filter by category."""
        if category == "services":
            return list(self.services.keys())
        elif category == "rooms":
            return list(self.rooms.keys())
        elif category == "agents":
            return list(self.agents.keys())
        elif category == "jobs":
            return list(self.jobs.keys())
        else:
            return {
                "services": len(self.services),
                "rooms": len(self.rooms),
                "agents": len(self.agents),
                "jobs": len(self.jobs)
            }

    def where_is(self, name):
        """Answer: where is X? Find service/room/agent by name."""
        results = []

        if name in self.services:
            s = self.services[name]
            results.append({"type": "service", "name": name, "port": s["port"],
                           "url": s["url"], "status": s["status"]})

        if name in self.rooms:
            r = self.rooms[name]
            results.append({"type": "room", "name": name, "tiles": r.get("tiles", 0),
                           "domain": r.get("domain", "")})

        if name in self.agents:
            a = self.agents[name]
            results.append({"type": "agent", "name": name, "role": a.get("role", "")})

        # Partial match
        for sname, sinfo in self.services.items():
            if name.lower() in sname.lower() and sname != name:
                results.append({"type": "service", "name": sname, "port": sinfo["port"],
                               "status": sinfo["status"], "match": "partial"})

        for rname, rinfo in self.rooms.items():
            if name.lower() in rname.lower() and rname != name:
                results.append({"type": "room", "name": rname, "tiles": rinfo.get("tiles", 0),
                               "match": "partial"})

        return results

    def how_connects(self, service_name):
        """Answer: how does X connect? Show dependencies and connections."""
        deps = self.dependencies.get(service_name, [])
        depended_by = [s for s, d in self.dependencies.items() if service_name in d]

        info = self.services.get(service_name, {})
        return {
            "service": service_name,
            "port": info.get("port"),
            "status": info.get("status"),
            "depends_on": deps,
            "depended_by": depended_by,
            "endpoints": info.get("endpoints", []),
            "url": info.get("url", "")
        }

    def contract_lookup(self, service_name):
        """API contracts for a service."""
        info = self.services.get(service_name, {})
        if not info:
            return {"error": f"Service {service_name} not found"}

        endpoints = info.get("endpoints", [])
        contracts = []
        for ep in endpoints:
            contracts.append({
                "method": "GET" if not ep.startswith("/submit") and not ep.startswith("/execute") else "POST",
                "path": ep,
                "description": f"{service_name} endpoint: {ep}",
                "url": f"http://localhost:{info['port']}{ep}"
            })

        return {
            "service": service_name,
            "base_url": f"http://localhost:{info['port']}",
            "public_url": f"http://147.224.38.131:{info['port']}",
            "contracts": contracts
        }


# ═══════════════════════════════════════════════════════════
# HTTP Handler
# ═══════════════════════════════════════════════════════════

index = FleetIndex()

class ReusableHTTPServer(HTTPServer):
    allow_reuse_address = True
    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        super().server_bind()

class LibrarianHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        params = parse_qs(parsed.query)

        if path == "" or path == "/":
            self._json({
                "service": "Librarian",
                "port": 4052,
                "purpose": "Index fleet knowledge, rooms, services, and contracts. Answer: what exists, where is it, how does it connect?",
                "designed_by": "Perplexity AI (2nd Crab Trap response)",
                "built_by": "Oracle1",
                "endpoints": [
                    "GET / — overview",
                    "GET /catalog — full service catalog with status",
                    "GET /rooms — room directory (sort by tiles/name)",
                    "GET /agents — indexed agents",
                    "GET /jobs — indexed tasks/jobs",
                    "GET /search?q=KEYWORD — search across everything",
                    "GET /where?name=X — where is X?",
                    "GET /how?service=X — how does X connect?",
                    "GET /contract?service=X — API contracts for X",
                    "GET /dependencies — service dependency graph",
                    "GET /architecture — fleet architecture summary",
                    "GET /exists — what exists (counts)",
                    "GET /exists?category=services|rooms|agents|jobs — list names",
                    "POST /reindex — rebuild index from live services",
                ],
                "index_stats": index.architecture_summary(),
            })

        elif path == "/catalog":
            self._json(index.service_catalog())

        elif path == "/rooms":
            sort = params.get("sort", ["tiles"])[0]
            self._json({
                "total": len(index.rooms),
                "sort": sort,
                "rooms": index.room_directory(sort)
            })

        elif path == "/agents":
            self._json({
                "total": len(index.agents),
                "agents": index.agents
            })

        elif path == "/jobs":
            self._json({
                "total": len(index.jobs),
                "jobs": index.jobs
            })

        elif path == "/search":
            query = params.get("q", [""])[0]
            if not query:
                self._json({"error": "Provide ?q=KEYWORD"}, 400)
                return
            results = index.search(query)
            self._json({"query": query, "results": results, "count": len(results)})

        elif path == "/where":
            name = params.get("name", [""])[0]
            if not name:
                self._json({"error": "Provide ?name=X"}, 400)
                return
            results = index.where_is(name)
            self._json({"name": name, "found": results, "count": len(results)})

        elif path == "/how":
            service = params.get("service", [""])[0]
            if not service:
                self._json({"error": "Provide ?service=X"}, 400)
                return
            self._json(index.how_connects(service))

        elif path == "/contract":
            service = params.get("service", [""])[0]
            if not service:
                self._json({"error": "Provide ?service=X"}, 400)
                return
            self._json(index.contract_lookup(service))

        elif path == "/dependencies":
            self._json(index.dependency_map())

        elif path == "/architecture":
            self._json(index.architecture_summary())

        elif path == "/exists":
            category = params.get("category", [None])[0]
            self._json({"exists": index.what_exists(category)})

        else:
            self._json({"error": "Not found. Start at GET /"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/reindex":
            index.index_all()
            self._json({
                "reindexed": True,
                "architecture": index.architecture_summary()
            })
        else:
            self._json({"error": "Not found. POST /reindex"}, 404)

    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2, default=str).encode())


if __name__ == "__main__":
    port = 4052
    print(f"Librarian starting on port {port}")
    print(f"  Indexing fleet...")
    index.index_all()
    server = ReusableHTTPServer(("0.0.0.0", port), LibrarianHandler)
    print(f"  Ready — catalog and retrieval layer")
    server.serve_forever()
