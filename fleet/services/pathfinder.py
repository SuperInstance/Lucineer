#!/usr/bin/env python3
"""
Pathfinder — Route Planning & Topology Service (port 4051)

Designed by Perplexity AI via Crab Trap prompt, built by Oracle1.
Fills the gap: execution + observation + scoring exist, but no path intelligence.

Computes safe, efficient movement plans between PLATO rooms:
- Multi-step routes with constraints
- Room adjacency and bottleneck analysis
- Recommended action sequences for agents
- Risk-adjusted alternative paths
- ETA estimates and blocked-edge reports

Consumes: room graphs, agent state, task goals, service availability
Produces: route plans, alternatives, ETA, blocked-edge reports, movement traces
"""

import json, time, hashlib, heapq, threading, urllib.request
from collections import defaultdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path
from datetime import datetime

# ── Fleet imports ──
import sys, os
FLEET_LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, str(FLEET_LIB))

DATA_DIR = Path(FLEET_LIB).parent / "data" / "pathfinder"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ═══════════════════════════════════════════════════════════
# Room Graph Builder — discovers topology from MUD + PLATO
# ═══════════════════════════════════════════════════════════

class RoomGraph:
    """Bidirectional room graph with weighted edges."""

    def __init__(self):
        self.nodes = {}         # room_name → {tiles, exits, objects, domain}
        self.edges = []         # [(from, to, direction, weight)]
        self.adjacency = defaultdict(list)  # room → [(neighbor, direction, weight)]
        self.last_built = 0
        self.build_count = 0

    def build_from_services(self):
        """Rebuild graph from live MUD + PLATO data."""
        nodes_before = len(self.nodes)
        self.nodes.clear()
        self.edges.clear()
        self.adjacency.clear()

        # 1. Load PLATO rooms
        try:
            req = urllib.request.Request("http://localhost:8847/rooms")
            resp = urllib.request.urlopen(req)
            plato = json.loads(resp.read())
            for name, info in plato.items():
                self.nodes[name] = {
                    "tiles": info.get("tile_count", 0),
                    "exits": [],
                    "objects": [],
                    "domain": info.get("domain", ""),
                    "source": "plato"
                }
        except Exception as e:
            print(f"  PLATO fetch failed: {e}")

        # 2. Explore MUD rooms via the Crab Trap
        mud_rooms = self._explore_mud()

        # 3. Build adjacency from MUD exits
        for room_name, room_data in mud_rooms.items():
            if room_name not in self.nodes:
                self.nodes[room_name] = room_data
            else:
                self.nodes[room_name]["exits"] = room_data.get("exits", [])
                self.nodes[room_name]["objects"] = room_data.get("objects", [])
                self.nodes[room_name]["source"] = "mud+plato"

            for direction in room_data.get("exits", []):
                target = mud_rooms.get(direction, {}).get("room_name", direction)
                weight = 1  # default edge weight
                self._add_edge(room_name, target, direction, weight)

        # 4. Add PLATO-derived edges (rooms with similar domains are neighbors)
        domain_clusters = defaultdict(list)
        for name, data in self.nodes.items():
            domain = data.get("domain", "")
            if domain:
                domain_clusters[domain].append(name)

        for domain, rooms in domain_clusters.items():
            for i in range(len(rooms) - 1):
                self._add_edge(rooms[i], rooms[i+1], "domain-link", 2)

        self.last_built = time.time()
        self.build_count += 1
        new_nodes = len(self.nodes)
        print(f"  Graph built: {new_nodes} nodes, {len(self.edges)} edges (was {nodes_before})")

    def _explore_mud(self):
        """Explore MUD rooms via Crab Trap HTTP API."""
        rooms = {}
        try:
            # Connect a scout
            urllib.request.urlopen(
                urllib.request.Request("http://localhost:4042/connect?agent=pathfinder-builder&job=scout")
            )
            # Visit known rooms
            known_rooms = [
                "harbor", "forge", "bridge", "dojo", "engine-room",
                "observatory", "lighthouse", "archives", "court",
                "tide-pool", "shell-gallery", "fishing-grounds",
                "arena-hall", "nexus-chamber", "ouroboros", "reef",
                "workshop"
            ]
            for room in known_rooms:
                try:
                    url = f"http://localhost:4042/move?agent=pathfinder-builder&room={room}"
                    resp = urllib.request.urlopen(url, timeout=3)
                    data = json.loads(resp.read())
                    rooms[room] = {
                        "room_name": room,
                        "tiles": 0,
                        "exits": data.get("exits", []),
                        "objects": data.get("objects", []),
                        "source": "mud"
                    }
                except:
                    pass
        except Exception as e:
            print(f"  MUD exploration failed: {e}")

        return rooms

    def _add_edge(self, from_room, to_room, direction, weight=1):
        """Add bidirectional edge."""
        edge = (from_room, to_room, direction, weight)
        self.edges.append(edge)
        self.adjacency[from_room].append((to_room, direction, weight))
        self.adjacency[to_room].append((from_room, f"back-{direction}", weight))

    def shortest_path(self, start, end):
        """Dijkstra's shortest path."""
        if start not in self.nodes or end not in self.nodes:
            return None, float('inf')

        dist = {start: 0}
        prev = {start: None}
        pq = [(0, start)]
        visited = set()

        while pq:
            d, u = heapq.heappop(pq)
            if u in visited:
                continue
            visited.add(u)
            if u == end:
                break
            for neighbor, direction, weight in self.adjacency.get(u, []):
                if neighbor not in visited:
                    new_dist = d + weight
                    if new_dist < dist.get(neighbor, float('inf')):
                        dist[neighbor] = new_dist
                        prev[neighbor] = (u, direction)
                        heapq.heappush(pq, (new_dist, neighbor))

        if end not in prev:
            return None, float('inf')

        # Reconstruct path
        path = []
        current = end
        while current != start:
            p = prev.get(current)
            if p is None:
                return None, float('inf')
            parent, direction = p
            path.append({"from": parent, "to": current, "direction": direction})
            current = parent
        path.reverse()
        return path, dist.get(end, float('inf'))

    def find_alternatives(self, start, end, max_routes=3):
        """Find multiple routes with Yen's K-shortest paths (simplified)."""
        routes = []
        primary, cost = self.shortest_path(start, end)
        if primary:
            routes.append({"path": primary, "cost": cost, "tag": "optimal"})

        # For alternatives, try removing each edge in the primary path
        if primary:
            for i, step in enumerate(primary):
                # Temporarily remove this edge
                from_r, to_r = step["from"], step["to"]
                saved = self.adjacency[from_r][:]
                self.adjacency[from_r] = [
                    e for e in saved
                    if not (e[0] == to_r)
                ]
                alt, alt_cost = self.shortest_path(start, end)
                if alt and alt != primary:
                    tag = "detour" if alt_cost > cost else "equal"
                    routes.append({"path": alt, "cost": alt_cost, "tag": tag})
                self.adjacency[from_r] = saved
                if len(routes) >= max_routes:
                    break

        return routes

    def bottleneck_analysis(self):
        """Find rooms that appear in the most shortest paths."""
        room_names = list(self.nodes.keys())
        centrality = defaultdict(int)
        sample_size = min(50, len(room_names))

        import random
        random.seed(42)
        pairs = []
        for _ in range(sample_size):
            if len(room_names) >= 2:
                a, b = random.sample(room_names, 2)
                pairs.append((a, b))

        for start, end in pairs:
            path, _ = self.shortest_path(start, end)
            if path:
                for step in path:
                    centrality[step["to"]] += 1
                    centrality[step["from"]] += 1

        # Sort by centrality
        bottlenecks = sorted(centrality.items(), key=lambda x: -x[1])[:20]
        return [{"room": r, "betweenness": c, "risk": "high" if c > sample_size * 0.5 else "medium" if c > sample_size * 0.25 else "low"} for r, c in bottlenecks]

    def reachability(self, start):
        """BFS to find all reachable rooms from start."""
        visited = set()
        queue = [start]
        while queue:
            room = queue.pop(0)
            if room in visited:
                continue
            visited.add(room)
            for neighbor, _, _ in self.adjacency.get(room, []):
                if neighbor not in visited:
                    queue.append(neighbor)
        return sorted(visited)

    def cluster_analysis(self):
        """Find connected components / room clusters."""
        visited = set()
        clusters = []
        for room in self.nodes:
            if room not in visited:
                reachable = self.reachability(room)
                visited.update(reachable)
                clusters.append({
                    "center": room,
                    "rooms": reachable,
                    "size": len(reachable)
                })
        return sorted(clusters, key=lambda c: -c["size"])


# ═══════════════════════════════════════════════════════════
# Agent Tracker — monitors agent positions from MUD
# ═══════════════════════════════════════════════════════════

class AgentTracker:
    """Tracks agent positions and movement history."""

    def __init__(self):
        self.positions = {}   # agent → {room, last_seen, history}
        self.history = []     # [{agent, from, to, timestamp}]

    def update_position(self, agent, room):
        """Record agent position."""
        old_room = self.positions.get(agent, {}).get("room")
        self.positions[agent] = {
            "room": room,
            "last_seen": time.time()
        }
        if old_room and old_room != room:
            self.history.append({
                "agent": agent,
                "from": old_room,
                "to": room,
                "timestamp": time.time()
            })
        # Trim history to last 1000
        self.history = self.history[-1000:]

    def get_agent_location(self, agent):
        return self.positions.get(agent, {})

    def get_room_occupancy(self):
        """Count agents per room."""
        occupancy = defaultdict(int)
        for agent, data in self.positions.items():
            if time.time() - data["last_seen"] < 3600:  # last hour
                occupancy[data["room"]] += 1
        return dict(occupancy)

    def get_movement_heatmap(self):
        """Most-traveled edges."""
        edge_counts = defaultdict(int)
        for move in self.history:
            edge = (move["from"], move["to"])
            edge_counts[edge] += 1
        return sorted(edge_counts.items(), key=lambda x: -x[1])[:20]


# ═══════════════════════════════════════════════════════════
# Route Planner — the main intelligence layer
# ═══════════════════════════════════════════════════════════

class RoutePlanner:
    """Plans routes with constraints, preferences, and risk awareness."""

    def __init__(self, graph, tracker):
        self.graph = graph
        self.tracker = tracker
        self.blocked_edges = set()  # (from, to) pairs that are blocked
        self.plans = {}             # plan_id → plan data
        self.plan_counter = 0

    def plan_route(self, agent, destination, constraints=None):
        """Plan a route for an agent to reach a destination."""
        constraints = constraints or {}
        current = self.tracker.get_agent_location(agent)
        start = current.get("room", "harbor")

        # Find routes
        routes = self.graph.find_alternatives(start, destination, max_routes=3)

        # Filter blocked edges
        valid_routes = []
        for route in routes:
            blocked = False
            for step in route["path"]:
                if (step["from"], step["to"]) in self.blocked_edges:
                    blocked = True
                    break
            if not blocked:
                valid_routes.append(route)

        if not valid_routes:
            return {
                "error": "No valid route found",
                "start": start,
                "destination": destination,
                "blocked": list(self.blocked_edges)
            }

        # Score routes based on constraints
        for route in valid_routes:
            score = 1.0
            # Prefer shorter routes
            score -= route["cost"] * 0.1
            # Prefer routes through rooms with more tiles (more interesting)
            for step in route["path"]:
                tiles = self.graph.nodes.get(step["to"], {}).get("tiles", 0)
                score += min(tiles * 0.01, 0.5)
            # Avoid congested rooms
            occupancy = self.tracker.get_room_occupancy()
            for step in route["path"]:
                occ = occupancy.get(step["to"], 0)
                if occ > 3:
                    score -= 0.2
            route["score"] = round(score, 3)

        valid_routes.sort(key=lambda r: -r.get("score", 0))

        # Create plan
        self.plan_counter += 1
        plan_id = f"plan-{self.plan_counter:04d}"
        plan = {
            "plan_id": plan_id,
            "agent": agent,
            "start": start,
            "destination": destination,
            "created_at": time.time(),
            "primary_route": valid_routes[0],
            "alternatives": valid_routes[1:],
            "status": "planned",
            "steps_remaining": len(valid_routes[0]["path"]),
            "eta_seconds": valid_routes[0]["cost"] * 2,  # ~2s per hop
            "constraints": constraints
        }
        self.plans[plan_id] = plan

        # Persist
        self._save_plan(plan)

        return plan

    def block_edge(self, from_room, to_room, reason="manual"):
        """Block an edge (e.g., service down, room broken)."""
        self.blocked_edges.add((from_room, to_room))
        self.blocked_edges.add((to_room, from_room))
        return {"blocked": (from_room, to_room), "reason": reason}

    def unblock_edge(self, from_room, to_room):
        """Unblock an edge."""
        self.blocked_edges.discard((from_room, to_room))
        self.blocked_edges.discard((to_room, from_room))
        return {"unblocked": (from_room, to_room)}

    def get_plan(self, plan_id):
        return self.plans.get(plan_id)

    def list_plans(self):
        return [
            {"plan_id": pid, "agent": p["agent"], "start": p["start"],
             "destination": p["destination"], "status": p["status"]}
            for pid, p in self.plans.items()
        ]

    def _save_plan(self, plan):
        """Persist plan to disk."""
        path = DATA_DIR / "plans.jsonl"
        with open(path, "a") as f:
            f.write(json.dumps(plan) + "\n")

    def service_health_report(self):
        """Check connectivity to all fleet services."""
        services = {
            "PLATO": 8847, "MUD": 4042, "Arena": 4044, "Grammar": 4045,
            "Dashboard": 4046, "Nexus": 4047, "Orchestrator": 8849,
            "Keeper": 8900, "AgentAPI": 8901, "TaskQueue": 4058,
            "Portal": 4059, "Shell": 8848, "Scorer": 8852,
        }
        healthy = {}
        for name, port in services.items():
            try:
                urllib.request.urlopen(f"http://localhost:{port}/", timeout=2)
                healthy[name] = {"port": port, "status": "up"}
            except:
                try:
                    # Some services need specific paths
                    urllib.request.urlopen(f"http://localhost:{port}/status", timeout=2)
                    healthy[name] = {"port": port, "status": "up"}
                except:
                    healthy[name] = {"port": port, "status": "down"}

        return healthy


# ═══════════════════════════════════════════════════════════
# HTTP Handler
# ═══════════════════════════════════════════════════════════


graph = RoomGraph()
tracker = AgentTracker()
planner = RoutePlanner(graph, tracker)

# Build graph on startup
graph.build_from_services()


class PathfinderHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # Suppress logs

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        params = parse_qs(parsed.query)

        if path == "" or path == "/":
            self._json({
                "service": "Pathfinder",
                "port": 4051,
                "purpose": "Route planning and topology-aware movement optimization",
                "designed_by": "Perplexity AI (via Crab Trap prompt)",
                "built_by": "Oracle1",
                "endpoints": [
                    "GET / — this overview",
                    "GET /graph — room topology (nodes, edges, adjacency)",
                    "GET /route?agent=X&destination=Y — plan a route",
                    "GET /route/alternatives?from=X&to=Y — multiple route options",
                    "GET /shortest?from=X&to=Y — shortest path only",
                    "GET /bottlenecks — rooms with highest betweenness centrality",
                    "GET /clusters — connected room components",
                    "GET /reachability?from=X — all rooms reachable from X",
                    "GET /occupancy — current agent room occupancy",
                    "GET /heatmap — most-traveled edges",
                    "GET /plans — list all planned routes",
                    "GET /plan/PLAN_ID — get specific plan details",
                    "GET /health — fleet service connectivity",
                    "GET /blocked — currently blocked edges",
                    "POST /block — block an edge {from, to, reason}",
                    "POST /unblock — unblock an edge {from, to}",
                    "POST /rebuild — rebuild topology from live services",
                    "POST /track — update agent position {agent, room}",
                ],
                "graph_stats": {
                    "nodes": len(graph.nodes),
                    "edges": len(graph.edges),
                    "last_built": datetime.fromtimestamp(graph.last_built).isoformat() if graph.last_built else "never",
                    "build_count": graph.build_count
                },
                "connects_to": ["MUD:4042", "PLATO:8847", "Dashboard:4046", "Nexus:4047",
                                "Orchestrator:8849", "AdaptiveMUD:8850", "Monitor:8851", "Scorer:8852"],
                "rooms_served": ["navigation rooms", "topology rooms", "transit hubs", "cross-domain corridors"],
                "consumes": ["room graph", "agent state", "task goals", "locks", "service availability"],
                "produces": ["route plans", "alternatives", "ETA", "blocked-edge reports", "movement traces"],
            })

        elif path == "/graph":
            self._json({
                "nodes": len(graph.nodes),
                "edges": len(graph.edges),
                "adjacency_count": {r: len(n) for r, n in graph.adjacency.items()},
                "rooms": {
                    name: {
                        "tiles": data.get("tiles", 0),
                        "exits": data.get("exits", []),
                        "objects": data.get("objects", []),
                        "neighbors": len(graph.adjacency.get(name, [])),
                        "source": data.get("source", "unknown")
                    }
                    for name, data in graph.nodes.items()
                }
            })

        elif path == "/route":
            agent = params.get("agent", ["explorer"])[0]
            destination = params.get("destination", [None])[0]
            if not destination:
                self._json({"error": "Specify destination"}, 400)
                return
            plan = planner.plan_route(agent, destination)
            self._json(plan)

        elif path == "/route/alternatives":
            start = params.get("from", ["harbor"])[0]
            end = params.get("to", ["forge"])[0]
            max_routes = int(params.get("max", ["3"])[0])
            routes = graph.find_alternatives(start, end, max_routes)
            self._json({
                "from": start, "to": end,
                "routes": routes,
                "total_routes": len(routes)
            })

        elif path == "/shortest":
            start = params.get("from", ["harbor"])[0]
            end = params.get("to", ["forge"])[0]
            path_data, cost = graph.shortest_path(start, end)
            self._json({
                "from": start, "to": end,
                "path": path_data,
                "cost": cost,
                "hops": len(path_data) if path_data else 0,
                "eta_seconds": cost * 2 if cost != float('inf') else None
            })

        elif path == "/bottlenecks":
            self._json({
                "bottlenecks": graph.bottleneck_analysis(),
                "note": "Rooms appearing in the most shortest paths — high betweenness = high risk"
            })

        elif path == "/clusters":
            self._json({
                "clusters": graph.cluster_analysis(),
                "total_clusters": len(graph.cluster_analysis())
            })

        elif path == "/reachability":
            start = params.get("from", ["harbor"])[0]
            reachable = graph.reachability(start)
            self._json({
                "from": start,
                "reachable": reachable,
                "count": len(reachable),
                "unreachable": [r for r in graph.nodes if r not in reachable]
            })

        elif path == "/occupancy":
            self._json({
                "occupancy": tracker.get_room_occupancy(),
                "agents_tracked": len(tracker.positions)
            })

        elif path == "/heatmap":
            self._json({
                "heatmap": tracker.get_movement_heatmap(),
                "total_movements": len(tracker.history)
            })

        elif path == "/plans":
            self._json({"plans": planner.list_plans()})

        elif path.startswith("/plan/"):
            plan_id = path.split("/plan/")[1]
            plan = planner.get_plan(plan_id)
            if plan:
                self._json(plan)
            else:
                self._json({"error": f"Plan {plan_id} not found"}, 404)

        elif path == "/health":
            self._json(planner.service_health_report())

        elif path == "/blocked":
            self._json({
                "blocked_edges": [{"from": f, "to": t} for f, t in planner.blocked_edges],
                "count": len(planner.blocked_edges)
            })

        else:
            self._json({"error": "Not found. Start at GET /"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        if path == "/block":
            from_room = body.get("from")
            to_room = body.get("to")
            reason = body.get("reason", "manual")
            if not from_room or not to_room:
                self._json({"error": "Need 'from' and 'to'"}, 400)
                return
            result = planner.block_edge(from_room, to_room, reason)
            self._json(result)

        elif path == "/unblock":
            from_room = body.get("from")
            to_room = body.get("to")
            if not from_room or not to_room:
                self._json({"error": "Need 'from' and 'to'"}, 400)
                return
            result = planner.unblock_edge(from_room, to_room)
            self._json(result)

        elif path == "/rebuild":
            graph.build_from_services()
            self._json({
                "rebuilt": True,
                "nodes": len(graph.nodes),
                "edges": len(graph.edges),
                "build_count": graph.build_count
            })

        elif path == "/track":
            agent = body.get("agent")
            room = body.get("room")
            if not agent or not room:
                self._json({"error": "Need 'agent' and 'room'"}, 400)
                return
            tracker.update_position(agent, room)
            self._json({"tracked": agent, "room": room})

        else:
            self._json({"error": "Not found. POST /block, /unblock, /rebuild, /track"}, 404)

    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())


if __name__ == "__main__":
    port = 4051
    print(f"Pathfinder starting on port {port}")
    print(f"  Designed by Perplexity AI, built by Oracle1")
    print(f"  Data dir: {DATA_DIR}")
    import socket
    class ReusableHTTPServer(HTTPServer):
        allow_reuse_address = True
        def server_bind(self):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            super().server_bind()
    server = ReusableHTTPServer(("0.0.0.0", port), PathfinderHandler)
    print(f"  Ready — route planning and topology analysis")
    server.serve_forever()
