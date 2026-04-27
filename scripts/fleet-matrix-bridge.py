#!/usr/bin/env python3
"""
Fleet Matrix Bridge — real-time inter-agent communication via Matrix.
Replaces bottle protocol for instant messaging. Git bottles remain for audit/artifacts.

Architecture:
  - Each agent has a Matrix account on Conduwuit (port 6167)
  - Agents send/receive messages via HTTP polling (Matrix client API)
  - Fleet Hub room for broadcast, DM rooms for 1:1
  - Bridge polls every 10s, stores messages in /tmp/fleet-matrix/inbox/{agent}/
  - Any agent can check their inbox: GET http://localhost:6168/inbox/{agent}
  - Any agent can send: POST http://localhost:6168/send/{to} {body: "..."}
  
Agents (FM, JC1, CCC):
  - Send: curl -X POST http://localhost:6168/send -d '{"from":"fm-bot","to":"oracle1","body":"need help with crate"}'
  - Receive: curl http://localhost:6168/inbox/fm-bot
  - Broadcast: curl -X POST http://localhost:6168/broadcast -d '{"from":"oracle1","body":"fleet meeting now"}'

Runs as systemd service on port 6168.
"""

import json, urllib.request, urllib.parse, os, time, hashlib, threading, http.server
from datetime import datetime
from pathlib import Path

# Config
MATRIX_URL = os.environ.get("MATRIX_URL", "http://localhost:6167")
BRIDGE_PORT = int(os.environ.get("BRIDGE_PORT", "6168"))
INBOX_DIR = Path(os.environ.get("INBOX_DIR", "/tmp/fleet-matrix"))
STATE_FILE = Path(os.environ.get("STATE_FILE", "/tmp/fleet-matrix/bridge-state.json"))

# Agent credentials (all on Conduwuit)
AGENTS = {
    "oracle1":  {"user_id": "@oracle1:147.224.38.131",  "password": "fleet-oracle1-2026"},
    "fm-bot":   {"user_id": "@fm-bot:147.224.38.131",   "password": "fleet-2026-cocapn"},
    "jc1-bot":  {"user_id": "@jc1-bot:147.224.38.131",  "password": "fleet-2026-cocapn"},
    "ccc":      {"user_id": "@ccc:147.224.38.131",      "password": "fleet-ccc-2026"},
    "fleet-bot":{"user_id": "@fleet-bot:147.224.38.131","password": "fleet-2026-cocapn"},
}

# Room IDs
ROOMS = {
    "fleet-coord":   "!z5oIJTqor4UUZliQp1:147.224.38.131",
    "plato-tiles":   "!wzPdHjulBK4E2V6jPH:147.224.38.131",
    "ten-forward":   "!Keng30jlSNNpluCpa0:147.224.38.131",
    "gpu-opt":       "!or6aVWz5OGvuqA8haD:147.224.38.131",
    "fleet-ops":     "!Gf5JuGxtRwahLSjwzS:147.224.38.131",
    "fleet-research":"!Q0PbvAkhv4vgJDBLsJ:147.224.38.131",
    "cocapn-build":  "!hHMkCC5dMMToEm4pyI:147.224.38.131",
}

# Reverse lookup: agent name from user_id
USER_TO_AGENT = {v["user_id"]: k for k, v in AGENTS.items()}

class MatrixClient:
    """Simple Matrix client for one agent."""
    
    def __init__(self, agent_name):
        self.name = agent_name
        self.user_id = AGENTS[agent_name]["user_id"]
        self.token = None
        self.since = None  # sync token for pagination
        self._login()
    
    def _login(self):
        data = json.dumps({
            "type": "m.login.password",
            "user": self.name,
            "password": AGENTS[self.name]["password"]
        }).encode()
        req = urllib.request.Request(
            f"{MATRIX_URL}/_matrix/client/v3/login",
            data=data,
            headers={"Content-Type": "application/json"}
        )
        resp = json.loads(urllib.request.urlopen(req).read())
        self.token = resp["access_token"]
        print(f"[bridge] {self.name} logged in as {resp['user_id']}")
    
    def send(self, room_id, text, msg_type="m.text"):
        txn_id = f"tx-{int(time.time()*1000)}-{hashlib.md5(text.encode()).hexdigest()[:8]}"
        eroom = urllib.parse.quote(room_id, safe="")
        data = json.dumps({"msgtype": msg_type, "body": text}).encode()
        req = urllib.request.Request(
            f"{MATRIX_URL}/_matrix/client/v3/rooms/{eroom}/send/m.room.message/{txn_id}",
            data=data,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            },
            method="PUT"
        )
        resp = json.loads(urllib.request.urlopen(req).read())
        return resp.get("event_id")
    
    def sync(self, timeout_ms=5000):
        """Poll for new events. Returns list of (room_id, sender, body, event_id)."""
        params = {"timeout": str(timeout_ms), "full_state": "false"}
        if self.since:
            params["since"] = self.since
        
        url = f"{MATRIX_URL}/_matrix/client/v3/sync?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {self.token}"})
        
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=timeout_ms/1000 + 5).read())
        except Exception as e:
            print(f"[bridge] sync error for {self.name}: {e}")
            return []
        
        self.since = resp.get("next_batch", self.since)
        messages = []
        
        # Parse joined rooms
        join = resp.get("rooms", {}).get("join", {})
        for room_id, room_data in join.items():
            for event in room_data.get("timeline", {}).get("events", []):
                if event.get("type") == "m.room.message":
                    sender = event.get("sender", "")
                    body = event.get("content", {}).get("body", "")
                    event_id = event.get("event_id", "")
                    ts = event.get("origin_server_ts", 0)
                    # Skip our own messages
                    if sender != self.user_id:
                        messages.append({
                            "room_id": room_id,
                            "sender": USER_TO_AGENT.get(sender, sender),
                            "sender_id": sender,
                            "body": body,
                            "event_id": event_id,
                            "timestamp": ts,
                            "time": datetime.utcfromtimestamp(ts/1000).isoformat() + "Z" if ts else "?",
                        })
        
        return messages


class FleetBridge:
    """Main bridge: polls Matrix, routes messages to agent inboxes."""
    
    def __init__(self):
        self.clients = {}
        self.inbox_dir = INBOX_DIR
        self.inbox_dir.mkdir(parents=True, exist_ok=True)
        self.state_file = STATE_FILE
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Login all agents
        for name in AGENTS:
            try:
                self.clients[name] = MatrixClient(name)
            except Exception as e:
                print(f"[bridge] ERROR logging in {name}: {e}")
        
        # Load state (processed events)
        self.processed = set()
        self._load_state()
        
        # Agent display names
        self.display_names = {
            "oracle1": "Oracle1 🔮",
            "fm-bot": "Forgemaster ⚒️",
            "jc1-bot": "JetsonClaw1 ⚡",
            "ccc": "CoCapn-Claw 🦀",
            "fleet-bot": "Fleet Bot 🤖",
        }
    
    def _load_state(self):
        try:
            if self.state_file.exists():
                data = json.loads(self.state_file.read_text())
                self.processed = set(data.get("processed", []))
                # Restore sync tokens
                for name, token in data.get("since_tokens", {}).items():
                    if name in self.clients:
                        self.clients[name].since = token
                print(f"[bridge] Loaded state: {len(self.processed)} processed events")
        except Exception as e:
            print(f"[bridge] State load error: {e}")
    
    def _save_state(self):
        try:
            data = {
                "processed": list(self.processed)[-5000:],  # Keep last 5000
                "since_tokens": {name: c.since for name, c in self.clients.items() if c.since},
                "updated": datetime.utcnow().isoformat() + "Z",
            }
            self.state_file.write_text(json.dumps(data, indent=2))
        except Exception as e:
            print(f"[bridge] State save error: {e}")
    
    def _get_inbox(self, agent):
        """Get inbox directory for an agent."""
        inbox = self.inbox_dir / "inbox" / agent
        inbox.mkdir(parents=True, exist_ok=True)
        return inbox
    
    def deliver(self, message, target_agent=None):
        """Write message to agent inbox(es)."""
        targets = [target_agent] if target_agent else list(AGENTS.keys())
        for agent in targets:
            if agent == message.get("sender"):
                continue  # Don't deliver to self
            inbox = self._get_inbox(agent)
            msg_file = inbox / f"{message['event_id'].replace('$','')}.json"
            if not msg_file.exists():
                msg_file.write_text(json.dumps(message, indent=2))
                print(f"[bridge] Delivered to {agent}: {message['body'][:60]}...")
    
    def poll(self):
        """Poll all agents for new messages."""
        total = 0
        for name, client in self.clients.items():
            try:
                messages = client.sync(timeout_ms=2000)
                for msg in messages:
                    if msg["event_id"] in self.processed:
                        continue
                    self.processed.add(msg["event_id"])
                    # Deliver to all agents except sender
                    self.deliver(msg)
                    total += 1
            except Exception as e:
                print(f"[bridge] Poll error for {name}: {e}")
        
        if total > 0:
            self._save_state()
            print(f"[bridge] Processed {total} new messages")
        return total
    
    def send_as(self, agent_name, room_name, text):
        """Send a message as a specific agent to a specific room."""
        client = self.clients.get(agent_name)
        room_id = ROOMS.get(room_name)
        if not client or not room_id:
            return {"error": f"Unknown agent {agent_name} or room {room_name}"}
        event_id = client.send(room_id, text)
        return {"event_id": event_id, "room": room_name, "from": agent_name}
    
    def dm(self, from_agent, to_agent, text):
        """Send a direct message from one agent to another via Fleet Coordination room."""
        client = self.clients.get(from_agent)
        room_id = ROOMS["fleet-coord"]
        if not client:
            return {"error": f"Unknown agent {from_agent}"}
        formatted = f"[DM to {self.display_names.get(to_agent, to_agent)}] {text}"
        event_id = client.send(room_id, formatted)
        return {"event_id": event_id, "from": from_agent, "to": to_agent}
    
    def broadcast(self, from_agent, text):
        """Broadcast a message to Fleet Coordination room."""
        return self.send_as(from_agent, "fleet-coord", text)
    
    def get_inbox(self, agent):
        """Read inbox for an agent."""
        inbox = self._get_inbox(agent)
        messages = []
        for f in sorted(inbox.glob("*.json")):
            try:
                messages.append(json.loads(f.read_text()))
            except:
                pass
        return messages
    
    def run_loop(self):
        """Main poll loop."""
        print(f"[bridge] Fleet Matrix Bridge starting (polling every 10s)")
        while True:
            try:
                self.poll()
            except Exception as e:
                print(f"[bridge] Loop error: {e}")
            time.sleep(10)


class BridgeHTTPHandler(http.server.BaseHTTPRequestHandler):
    """HTTP API for agents to interact with the bridge."""
    
    bridge = None  # Set by server
    
    def log_message(self, format, *args):
        pass  # Suppress default logging
    
    def _send_json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())
    
    def do_GET(self):
        path = urllib.parse.urlparse(self.path)
        parts = path.path.strip("/").split("/")
        
        # GET /inbox/{agent} — check messages
        if len(parts) == 2 and parts[0] == "inbox":
            agent = parts[1]
            if agent not in AGENTS:
                self._send_json({"error": f"Unknown agent: {agent}"}, 404)
                return
            messages = self.bridge.get_inbox(agent)
            self._send_json({"agent": agent, "count": len(messages), "messages": messages[-50:]})
            return
        
        # GET /rooms — list rooms
        if parts[0] == "rooms":
            self._send_json({"rooms": {k: v for k, v in ROOMS.items()}})
            return
        
        # GET /status
        if parts[0] == "status":
            agents = {}
            for name, client in self.bridge.clients.items():
                agents[name] = {
                    "user_id": client.user_id,
                    "connected": client.token is not None,
                    "since": client.since[:20] + "..." if client.since else None,
                }
            inbox_counts = {}
            for name in AGENTS:
                inbox_counts[name] = len(self.bridge.get_inbox(name))
            self._send_json({
                "status": "running",
                "agents": agents,
                "rooms": len(ROOMS),
                "processed": len(self.bridge.processed),
                "inbox_counts": inbox_counts,
            })
            return
        
        self._send_json({"error": "not found"}, 404)
    
    def do_POST(self):
        path = urllib.parse.urlparse(self.path)
        parts = path.path.strip("/").split("/")
        
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode() if content_len else "{}"
        try:
            data = json.loads(body) if body else {}
        except:
            data = {}
        
        # POST /send — send message to room
        if parts[0] == "send":
            agent = data.get("from", "oracle1")
            room = data.get("room", "fleet-coord")
            text = data.get("body", data.get("text", ""))
            if not text:
                self._send_json({"error": "missing body"}, 400)
                return
            result = self.bridge.send_as(agent, room, text)
            self._send_json(result)
            return
        
        # POST /dm — direct message
        if parts[0] == "dm":
            result = self.bridge.dm(
                data.get("from", "oracle1"),
                data.get("to", "fm-bot"),
                data.get("body", "")
            )
            self._send_json(result)
            return
        
        # POST /broadcast — broadcast to fleet
        if parts[0] == "broadcast":
            result = self.bridge.broadcast(
                data.get("from", "oracle1"),
                data.get("body", "")
            )
            self._send_json(result)
            return
        
        # POST /poll — trigger immediate poll
        if parts[0] == "poll":
            count = self.bridge.poll()
            self._send_json({"polled": count})
            return
        
        self._send_json({"error": "not found"}, 404)


def main():
    import sys
    
    bridge = FleetBridge()
    
    # Start HTTP server in main thread, poll in background
    def poll_thread():
        while True:
            try:
                bridge.poll()
            except Exception as e:
                print(f"[bridge] Poll error: {e}")
            time.sleep(10)
    
    t = threading.Thread(target=poll_thread, daemon=True)
    t.start()
    
    # Start HTTP API
    handler = type("H", (BridgeHTTPHandler,), {"bridge": bridge})
    server = http.server.HTTPServer(("0.0.0.0", BRIDGE_PORT), handler)
    print(f"[bridge] Fleet Matrix Bridge API on :{BRIDGE_PORT}")
    print(f"[bridge] Agents: {list(AGENTS.keys())}")
    print(f"[bridge] Rooms: {list(ROOMS.keys())}")
    print(f"[bridge] Endpoints:")
    print(f"  GET  /status          — bridge status")
    print(f"  GET  /inbox/{{agent}}  — check messages")
    print(f"  GET  /rooms           — list rooms")
    print(f"  POST /send            — send {{from, room, body}}")
    print(f"  POST /dm              — direct msg {{from, to, body}}")
    print(f"  POST /broadcast       — broadcast {{from, body}}")
    print(f"  POST /poll            — trigger poll")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[bridge] Shutting down")
        bridge._save_state()


if __name__ == "__main__":
    main()
