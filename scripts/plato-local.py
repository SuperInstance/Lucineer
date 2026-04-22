#!/usr/bin/env python3
"""
PLATO Local — Standalone PLATO instance for federated deployment.
Agents run this on their own hardware. Tiles sync to the fleet on heartbeat.

Usage:
    python3 plato-local.py [--port 8847] [--fleet-url http://147.224.38.131:8847]
    python3 plato-local.py --port 8847 --agent forgemaster --fleet-url http://147.224.38.131:8847
    python3 plato-local.py --port 8847 --no-sync  # standalone mode

Each agent gets their own PLATO room. Tiles are stored locally in SQLite
and synced to the fleet PLATO server periodically.
"""

import json, time, hashlib, sqlite3, argparse, threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

DEFAULT_PORT = 8847
DEFAULT_FLEET = "http://147.224.38.131:8847"

BLOCKED_WORDS = {"always", "never", "impossible", "guaranteed", "nobody"}
MIN_ANSWER_LEN = 20


class PlatoLocal:
    """Local PLATO instance with fleet sync capability."""

    def __init__(self, data_dir=".", agent_name="local-agent", fleet_url=None, sync_interval=300):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.agent_name = agent_name
        self.fleet_url = fleet_url
        self.sync_interval = sync_interval
        self.db_path = self.data_dir / "plato-local.db"
        self._init_db()

        if fleet_url:
            self._start_sync_thread()

    def _init_db(self):
        self.db = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS tiles (
                id TEXT PRIMARY KEY,
                domain TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                agent TEXT NOT NULL,
                confidence REAL DEFAULT 0.5,
                created_at REAL NOT NULL,
                synced INTEGER DEFAULT 0,
                tile_hash TEXT NOT NULL
            )
        """)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS rooms (
                name TEXT PRIMARY KEY,
                tile_count INTEGER DEFAULT 0,
                created_at REAL NOT NULL
            )
        """)
        self.db.execute("CREATE INDEX IF NOT EXISTS idx_domain ON tiles(domain)")
        self.db.execute("CREATE INDEX IF NOT EXISTS idx_synced ON tiles(synced)")
        self.db.commit()

    def submit_tile(self, domain, question, answer, agent=None, confidence=0.5):
        agent = agent or self.agent_name
        tile_id = hashlib.sha256(f"{domain}{question}{answer}{time.time()}".encode()).hexdigest()[:16]
        tile_hash = hashlib.sha256(f"{domain}{question}{answer}".encode()).hexdigest()[:12]
        created = time.time()

        # Gate check
        if len(answer.strip()) < MIN_ANSWER_LEN:
            return {"status": "rejected", "reason": f"Answer too short (min {MIN_ANSWER_LEN} chars)"}

        text_words = set(f"{question} {answer}".lower().split())
        found_blocked = text_words & BLOCKED_WORDS
        if found_blocked:
            return {"status": "rejected", "reason": f"Blocked word: {found_blocked.pop()}"}

        self.db.execute(
            "INSERT INTO tiles (id, domain, question, answer, agent, confidence, created_at, synced, tile_hash) VALUES (?,?,?,?,?,?,?,?,?)",
            (tile_id, domain, question, answer, agent, confidence, created, 0, tile_hash),
        )
        self.db.execute(
            "INSERT OR REPLACE INTO rooms (name, tile_count, created_at) "
            "VALUES (?, COALESCE((SELECT tile_count FROM rooms WHERE name=?),0)+1, "
            "COALESCE((SELECT created_at FROM rooms WHERE name=?),?))",
            (domain, domain, domain, created),
        )
        self.db.commit()

        return {
            "status": "accepted",
            "tile_id": tile_id,
            "domain": domain,
            "tile_hash": tile_hash,
            "room_tile_count": self._room_count(domain),
        }

    def _room_count(self, domain):
        row = self.db.execute("SELECT tile_count FROM rooms WHERE name=?", (domain,)).fetchone()
        return row[0] if row else 0

    def get_rooms(self):
        rows = self.db.execute("SELECT name, tile_count, created_at FROM rooms ORDER BY tile_count DESC").fetchall()
        return {r[0]: {"tile_count": r[1], "created_at": r[2]} for r in rows}

    def get_room(self, domain):
        count = self._room_count(domain)
        tiles = self.db.execute(
            "SELECT id, question, answer, agent, confidence, created_at FROM tiles WHERE domain=? ORDER BY created_at DESC LIMIT 50",
            (domain,),
        ).fetchall()
        return {
            "name": domain,
            "tile_count": count,
            "tiles": [
                {"id": t[0], "question": t[1], "answer": t[2], "agent": t[3], "confidence": t[4], "created_at": t[5]}
                for t in tiles
            ],
        }

    def search_tiles(self, query):
        rows = self.db.execute(
            "SELECT id, domain, question, answer, agent FROM tiles WHERE question LIKE ? OR answer LIKE ? ORDER BY created_at DESC LIMIT 20",
            (f"%{query}%", f"%{query}%"),
        ).fetchall()
        return [{"id": r[0], "domain": r[1], "question": r[2], "answer": r[3], "agent": r[4]} for r in rows]

    def get_stats(self):
        tile_count = self.db.execute("SELECT COUNT(*) FROM tiles").fetchone()[0]
        room_count = self.db.execute("SELECT COUNT(*) FROM rooms").fetchone()[0]
        unsynced = self.db.execute("SELECT COUNT(*) FROM tiles WHERE synced=0").fetchone()[0]
        return {
            "tiles": tile_count,
            "rooms": room_count,
            "unsynced": unsynced,
            "agent": self.agent_name,
            "fleet_url": self.fleet_url,
        }

    def sync_to_fleet(self):
        if not self.fleet_url:
            return {"synced": 0, "error": "No fleet URL configured"}

        unsynced = self.db.execute(
            "SELECT id, domain, question, answer, agent, confidence FROM tiles WHERE synced=0"
        ).fetchall()

        synced = 0
        for tile in unsynced:
            try:
                import urllib.request
                data = json.dumps({
                    "domain": tile[1],
                    "question": tile[2],
                    "answer": tile[3],
                    "agent": tile[4] or self.agent_name,
                    "confidence": tile[5],
                }).encode()
                req = urllib.request.Request(
                    f"{self.fleet_url}/submit",
                    data=data,
                    headers={"Content-Type": "application/json", "User-Agent": "plato-local/1"},
                )
                urllib.request.urlopen(req, timeout=5)
                self.db.execute("UPDATE tiles SET synced=1 WHERE id=?", (tile[0],))
                synced += 1
            except Exception as e:
                print(f"Sync error for tile {tile[0]}: {e}")

        self.db.commit()
        return {"synced": synced, "total_unsynced": len(unsynced)}

    def _start_sync_thread(self):
        def sync_loop():
            while True:
                time.sleep(self.sync_interval)
                result = self.sync_to_fleet()
                if result.get("synced", 0) > 0:
                    print(f"Synced {result['synced']} tiles to fleet")

        t = threading.Thread(target=sync_loop, daemon=True)
        t.start()


# ── HTTP Handler ────────────────────────────────────────────
plato = None


class PlatoLocalHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == "/status":
            self._json(plato.get_stats())
        elif path == "/rooms":
            self._json(plato.get_rooms())
        elif path.startswith("/room/"):
            domain = path[6:]
            self._json(plato.get_room(domain))
        elif path == "/search":
            q = params.get("q", [""])[0]
            self._json({"results": plato.search_tiles(q)})
        elif path == "/sync":
            self._json(plato.sync_to_fleet())
        else:
            self._json({
                "service": "PLATO Local v1.0",
                "agent": plato.agent_name,
                "fleet_url": plato.fleet_url,
                "endpoints": ["/status", "/rooms", "/room/<name>", "/search?q=", "/sync", "/submit (POST)"],
                "stats": plato.get_stats(),
            })

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/submit":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length)) if length else {}
            except Exception:
                self._json({"error": "Invalid JSON"}, 400)
                return
            result = plato.submit_tile(
                domain=body.get("domain", "general"),
                question=body.get("question", ""),
                answer=body.get("answer", ""),
                agent=body.get("agent"),
                confidence=body.get("confidence", 0.5),
            )
            self._json(result, 200 if result["status"] == "accepted" else 403)
        else:
            self._json({"error": "Not found"}, 404)

    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2, default=str).encode())

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PLATO Local — Federated Knowledge Tiles")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="HTTP port")
    parser.add_argument("--fleet-url", default=DEFAULT_FLEET, help="Fleet PLATO URL for sync")
    parser.add_argument("--agent", default="local-agent", help="Agent name")
    parser.add_argument("--data-dir", default="./plato-data", help="Data directory")
    parser.add_argument("--no-sync", action="store_true", help="Disable fleet sync")
    parser.add_argument("--sync-interval", type=int, default=300, help="Sync interval in seconds")
    args = parser.parse_args()

    fleet_url = None if args.no_sync else args.fleet_url
    plato = PlatoLocal(
        data_dir=args.data_dir,
        agent_name=args.agent,
        fleet_url=fleet_url,
        sync_interval=args.sync_interval,
    )

    print(f"PLATO Local on :{args.port}")
    print(f"   Agent: {args.agent}")
    print(f"   Fleet: {fleet_url or 'standalone (no sync)'}")
    print(f"   Data: {args.data_dir}")
    HTTPServer(("0.0.0.0", args.port), PlatoLocalHandler).serve_forever()
