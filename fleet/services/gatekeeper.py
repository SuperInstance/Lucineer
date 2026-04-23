#!/usr/bin/env python3
"""
Gatekeeper — Policy Enforcement & Readiness Validation (port 4053)

Designed by Perplexity AI (3rd Crab Trap response), built by Oracle1.
Service #19 closes the loop: the missing control-plane layer.

Validates readiness, permissions, and submission integrity before
work reaches Orchestrator or Builder. Returns allow/deny/remediate.
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

DATA_DIR = Path(FLEET_LIB).parent / "data" / "gatekeeper"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ═══════════════════════════════════════════════════════════
# Policy Engine
# ═══════════════════════════════════════════════════════════

class PolicyEngine:
    """Evaluates policies against agents, jobs, and submissions."""

    def __init__(self):
        self.agent_registry = {}    # agent → {role, stage, permissions, reputation}
        self.room_permissions = {}  # room → {min_stage, allowed_roles, restricted}
        self.job_policies = {}      # job_type → {requirements}
        self.audit_log = []         # [{timestamp, decision, agent, reason, ...}]
        self.policies = []          # loaded policy rules
        self._init_default_policies()
        self._load_audit_log()

    def _init_default_policies(self):
        """Default fleet policies."""
        self.policies = [
            {"id": "P001", "name": "agent_must_exist", "check": "agent_registered",
             "description": "Agent must be registered before executing tasks"},
            {"id": "P002", "name": "room_not_restricted", "check": "room_accessible",
             "description": "Room must not be restricted for the agent's role"},
            {"id": "P003", "name": "stage_sufficient", "check": "stage_gate",
             "description": "Agent stage must meet room/job minimum"},
            {"id": "P004", "name": "submission_integrity", "check": "submission_valid",
             "description": "Submissions must have required fields and meet quality min"},
            {"id": "P005", "name": "service_dependency_ready", "check": "deps_healthy",
             "description": "Required services must be healthy for execution"},
            {"id": "P006", "name": "rate_limit", "check": "rate_ok",
             "description": "Agent must not exceed action rate limits"},
            {"id": "P007", "name": "reputation_floor", "check": "reputation_ok",
             "description": "Agent reputation must be above floor for critical actions"},
        ]

        # Room permission defaults
        restricted_rooms = ["vault", "council", "checkpoint"]
        for room in restricted_rooms:
            self.room_permissions[room] = {
                "min_stage": 2,  # journeyman+
                "allowed_roles": ["fleet_agent", "captain", "admin"],
                "restricted": True
            }

    def _load_audit_log(self):
        """Load persisted audit log."""
        log_path = DATA_DIR / "audit.jsonl"
        if log_path.exists():
            with open(log_path) as f:
                for line in f:
                    try:
                        self.audit_log.append(json.loads(line.strip()))
                    except:
                        pass
            print(f"  Loaded {len(self.audit_log)} audit entries")

    def _audit(self, decision, agent, action, reason, details=None):
        """Record an audit event."""
        entry = {
            "timestamp": time.time(),
            "time_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "decision": decision,  # allow, deny, remediate
            "agent": agent,
            "action": action,
            "reason": reason,
            "details": details or {}
        }
        self.audit_log.append(entry)
        # Persist
        log_path = DATA_DIR / "audit.jsonl"
        with open(log_path, "a") as f:
            f.write(json.dumps(entry) + "\n")
        return entry

    def check_agent(self, agent_name):
        """P001: Check if agent is registered."""
        if agent_name in self.agent_registry:
            return True, "registered"
        # Auto-register unknown agents as visitors
        self.agent_registry[agent_name] = {
            "role": "visitor",
            "stage": 0,
            "permissions": ["explore", "read"],
            "reputation": 50.0,
            "registered_at": time.time(),
            "actions_count": 0,
            "last_action": None
        }
        return True, "auto_registered"

    def check_room_access(self, agent_name, room):
        """P002: Check room permissions for agent."""
        perms = self.room_permissions.get(room, {"restricted": False})
        if not perms.get("restricted", False):
            return True, "open_room"

        agent = self.agent_registry.get(agent_name, {})
        role = agent.get("role", "visitor")

        allowed = perms.get("allowed_roles", [])
        if role in allowed:
            return True, "role_authorized"

        return False, f"role '{role}' not in allowed: {allowed}"

    def check_stage(self, agent_name, required_stage):
        """P003: Check agent stage meets minimum."""
        agent = self.agent_registry.get(agent_name, {})
        stage = agent.get("stage", 0)
        if stage >= required_stage:
            return True, f"stage {stage} >= {required_stage}"
        return False, f"stage {stage} < required {required_stage}"

    def check_submission(self, payload):
        """P004: Validate submission integrity."""
        errors = []

        # Check required fields for PLATO tile submission
        if "domain" not in payload and "room" not in payload:
            errors.append("Missing 'domain' or 'room'")
        if "question" not in payload and "title" not in payload:
            errors.append("Missing 'question' or 'title'")
        if "answer" not in payload and "content" not in payload:
            errors.append("Missing 'answer' or 'content'")

        # Quality checks
        answer = payload.get("answer", payload.get("content", ""))
        if len(answer) < 20:
            errors.append(f"Answer too short: {len(answer)} chars (min 20)")
        if len(answer) > 10000:
            errors.append(f"Answer too long: {len(answer)} chars (max 10000)")

        # Blocked words (PLATO gate rules)
        blocked = ["always", "never", "impossible", "guaranteed", "nobody"]
        answer_lower = answer.lower()
        for word in blocked:
            if word in answer_lower.split():  # word boundary check
                errors.append(f"Blocked word: '{word}'")

        if errors:
            return False, "; ".join(errors)
        return True, "valid"

    def check_dependencies(self, required_services):
        """P005: Check if required services are healthy."""
        unhealthy = []
        service_ports = {
            "PLATO": 8847, "MUD": 4042, "Arena": 4044, "Grammar": 4045,
            "Orchestrator": 8849, "Keeper": 8900, "AgentAPI": 8901,
            "Librarian": 4052, "Pathfinder": 4051, "Dashboard": 4046,
        }
        for svc in required_services:
            port = service_ports.get(svc)
            if port:
                try:
                    urllib.request.urlopen(f"http://localhost:{port}/", timeout=2)
                except:
                    unhealthy.append(svc)

        if unhealthy:
            return False, f"Services down: {unhealthy}"
        return True, "all_deps_healthy"

    def check_rate(self, agent_name, max_per_minute=30):
        """P006: Rate limit check."""
        agent = self.agent_registry.get(agent_name, {})
        last = agent.get("last_action") or 0
        count = agent.get("actions_count", 0)

        # Reset counter if more than a minute ago
        if time.time() - (last or 0) > 60:
            agent["actions_count"] = 0

        if count >= max_per_minute:
            return False, f"Rate limited: {count}/{max_per_minute} per minute"
        return True, "rate_ok"

    def check_reputation(self, agent_name, floor=10.0):
        """P007: Reputation floor check."""
        agent = self.agent_registry.get(agent_name, {})
        rep = agent.get("reputation", 50.0)
        if rep >= floor:
            return True, f"reputation {rep} >= {floor}"
        return False, f"reputation {rep} < floor {floor}"

    def evaluate(self, agent_name, action, payload=None):
        """Full policy evaluation for an action."""
        payload = payload or {}
        checks = []
        overall = "allow"

        # P001: Agent exists
        ok, reason = self.check_agent(agent_name)
        checks.append({"policy": "P001", "passed": ok, "reason": reason})
        if not ok:
            overall = "deny"

        # P002: Room access (if room specified)
        room = payload.get("room", payload.get("domain", ""))
        # room might be a list from query params
        if isinstance(room, list):
            room = room[0] if room else ""
        if room:
            ok, reason = self.check_room_access(agent_name, room)
            checks.append({"policy": "P002", "passed": ok, "reason": reason, "room": room})
            if not ok:
                overall = "deny" if overall != "deny" else overall

        # P003: Stage gate (if stage required)
        min_stage = payload.get("min_stage", 0)
        if min_stage > 0:
            ok, reason = self.check_stage(agent_name, min_stage)
            checks.append({"policy": "P003", "passed": ok, "reason": reason, "min_stage": min_stage})
            if not ok:
                overall = "remediate"

        # P004: Submission integrity (if submitting)
        if action in ("submit", "submit_tile", "build"):
            ok, reason = self.check_submission(payload)
            checks.append({"policy": "P004", "passed": ok, "reason": reason})
            if not ok:
                overall = "deny" if "too short" in reason or "Blocked" in reason else "remediate"

        # P005: Dependency health (if executing)
        if action in ("execute", "build", "deploy"):
            deps = payload.get("requires", [])
            if deps:
                ok, reason = self.check_dependencies(deps)
                checks.append({"policy": "P005", "passed": ok, "reason": reason})
                if not ok:
                    overall = "deny"

        # P006: Rate limit
        ok, reason = self.check_rate(agent_name)
        checks.append({"policy": "P006", "passed": ok, "reason": reason})
        if not ok:
            overall = "deny"

        # P007: Reputation (for critical actions)
        if action in ("execute", "deploy", "admin"):
            ok, reason = self.check_reputation(agent_name)
            checks.append({"policy": "P007", "passed": ok, "reason": reason})
            if not ok:
                overall = "remediate"

        # Update agent tracking
        agent = self.agent_registry.get(agent_name, {})
        agent["last_action"] = time.time()
        agent["actions_count"] = agent.get("actions_count", 0) + 1

        # Generate remediation steps if needed
        remediation = []
        if overall == "remediate":
            for check in checks:
                if not check["passed"]:
                    if check["policy"] == "P003":
                        remediation.append(f"Complete more tasks to advance from stage {self.agent_registry.get(agent_name, {}).get('stage', 0)} to {min_stage}")
                    elif check["policy"] == "P007":
                        remediation.append("Submit higher-quality work to improve reputation score")

        # Audit
        audit_entry = self._audit(overall, agent_name, action,
                                   "; ".join(c["reason"] for c in checks if not c["passed"]) or "all passed",
                                   {"checks": checks, "payload_keys": list(payload.keys())})

        result = {
            "decision": overall,
            "agent": agent_name,
            "action": action,
            "checks": checks,
            "policies_evaluated": len(checks),
            "policies_passed": sum(1 for c in checks if c["passed"]),
            "audit_id": audit_entry.get("time_iso", ""),
        }

        if remediation:
            result["remediation"] = remediation

        if overall == "allow":
            result["readiness_score"] = round(
                sum(1 for c in checks if c["passed"]) / max(len(checks), 1) * 100, 1
            )

        return result

    def register_agent(self, name, role="agent", stage=0, permissions=None):
        """Register or update an agent."""
        self.agent_registry[name] = {
            "role": role,
            "stage": stage,
            "permissions": permissions or ["explore", "read", "submit"],
            "reputation": 50.0,
            "registered_at": time.time(),
            "actions_count": 0,
            "last_action": None
        }
        return {"registered": name, "role": role, "stage": stage}

    def update_reputation(self, agent_name, delta):
        """Adjust agent reputation (+/-)."""
        agent = self.agent_registry.get(agent_name)
        if agent:
            agent["reputation"] = max(0, min(100, agent["reputation"] + delta))
            return {"agent": agent_name, "reputation": agent["reputation"], "delta": delta}
        return {"error": f"Agent {agent_name} not found"}

    def get_audit_log(self, limit=50, agent=None, decision=None):
        """Query audit log."""
        entries = self.audit_log
        if agent:
            entries = [e for e in entries if e.get("agent") == agent]
        if decision:
            entries = [e for e in entries if e.get("decision") == decision]
        return entries[-limit:]

    def get_stats(self):
        """Gatekeeper statistics."""
        total = len(self.audit_log)
        allows = sum(1 for e in self.audit_log if e.get("decision") == "allow")
        denies = sum(1 for e in self.audit_log if e.get("decision") == "deny")
        remediates = sum(1 for e in self.audit_log if e.get("decision") == "remediate")
        return {
            "total_decisions": total,
            "allows": allows,
            "denies": denies,
            "remediates": remediates,
            "allow_rate": round(allows / max(total, 1) * 100, 1),
            "registered_agents": len(self.agent_registry),
            "policies": len(self.policies),
            "restricted_rooms": sum(1 for r in self.room_permissions.values() if r.get("restricted"))
        }


# ═══════════════════════════════════════════════════════════
# HTTP Handler
# ═══════════════════════════════════════════════════════════

engine = PolicyEngine()

class ReusableHTTPServer(HTTPServer):
    allow_reuse_address = True
    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        super().server_bind()

class GatekeeperHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        params = parse_qs(parsed.query)

        if path == "" or path == "/":
            self._json({
                "service": "Gatekeeper",
                "port": 4053,
                "purpose": "Validate readiness, permissions, and submission integrity before execution",
                "designed_by": "Perplexity AI (3rd Crab Trap response)",
                "built_by": "Oracle1",
                "endpoints": [
                    "GET / — overview",
                    "GET /check?agent=X&action=Y — full policy evaluation",
                    "GET /agent?name=X — agent registration status",
                    "GET /agents — all registered agents",
                    "GET /policies — active policy rules",
                    "GET /rooms — room permission map",
                    "GET /audit — recent audit log",
                    "GET /audit?agent=X — filtered by agent",
                    "GET /audit?decision=deny — filtered by decision",
                    "GET /stats — decision statistics",
                    "GET /readiness?agent=X — readiness score for an agent",
                    "POST /register — register agent {name, role, stage, permissions}",
                    "POST /check — full evaluation with payload",
                    "POST /reputation — adjust reputation {agent, delta}",
                    "POST /room-permission — set room policy {room, min_stage, allowed_roles, restricted}",
                ],
                "stats": engine.get_stats()
            })

        elif path == "/check":
            agent = params.get("agent", ["explorer"])[0]
            action = params.get("action", ["explore"])[0]
            payload = dict(params)
            result = engine.evaluate(agent, action, payload)
            code = 200 if result["decision"] == "allow" else 403 if result["decision"] == "deny" else 202
            self._json(result, code)

        elif path == "/agent":
            name = params.get("name", [""])[0]
            if not name:
                self._json({"error": "Provide ?name=X"}, 400)
                return
            agent = engine.agent_registry.get(name)
            if agent:
                self._json({"name": name, **agent})
            else:
                self._json({"error": f"Agent {name} not registered"}, 404)

        elif path == "/agents":
            self._json({
                "total": len(engine.agent_registry),
                "agents": engine.agent_registry
            })

        elif path == "/policies":
            self._json({"policies": engine.policies})

        elif path == "/rooms":
            self._json({"room_permissions": engine.room_permissions})

        elif path == "/audit":
            limit = int(params.get("limit", ["50"])[0])
            agent = params.get("agent", [None])[0]
            decision = params.get("decision", [None])[0]
            entries = engine.get_audit_log(limit=limit, agent=agent, decision=decision)
            self._json({"entries": entries, "count": len(entries)})

        elif path == "/stats":
            self._json(engine.get_stats())

        elif path == "/readiness":
            agent = params.get("agent", [""])[0]
            if not agent:
                self._json({"error": "Provide ?agent=X"}, 400)
                return
            info = engine.agent_registry.get(agent, {})
            if not info:
                self._json({"agent": agent, "readiness": 0, "status": "unregistered"})
                return
            score = min(100, (
                (info.get("stage", 0) / 5 * 30) +
                (info.get("reputation", 0) / 100 * 40) +
                (30 if info.get("role") in ("fleet_agent", "captain", "admin") else 10)
            ))
            self._json({
                "agent": agent,
                "readiness": round(score, 1),
                "stage": info.get("stage", 0),
                "reputation": info.get("reputation", 0),
                "role": info.get("role", "visitor"),
                "permissions": info.get("permissions", []),
                "actions": info.get("actions_count", 0)
            })

        else:
            self._json({"error": "Not found. Start at GET /"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        if path == "/check":
            agent = body.get("agent", "explorer")
            action = body.get("action", "explore")
            payload = body.get("payload", body)
            result = engine.evaluate(agent, action, payload)
            code = 200 if result["decision"] == "allow" else 403 if result["decision"] == "deny" else 202
            self._json(result, code)

        elif path == "/register":
            name = body.get("name")
            if not name:
                self._json({"error": "Need 'name'"}, 400)
                return
            result = engine.register_agent(
                name,
                role=body.get("role", "agent"),
                stage=body.get("stage", 0),
                permissions=body.get("permissions")
            )
            self._json(result)

        elif path == "/reputation":
            agent = body.get("agent")
            delta = body.get("delta", 0)
            if not agent:
                self._json({"error": "Need 'agent' and 'delta'"}, 400)
                return
            result = engine.update_reputation(agent, delta)
            self._json(result)

        elif path == "/room-permission":
            room = body.get("room")
            if not room:
                self._json({"error": "Need 'room'"}, 400)
                return
            engine.room_permissions[room] = {
                "min_stage": body.get("min_stage", 0),
                "allowed_roles": body.get("allowed_roles", []),
                "restricted": body.get("restricted", True)
            }
            self._json({"room": room, "permissions": engine.room_permissions[room]})

        else:
            self._json({"error": "Not found. POST /check, /register, /reputation, /room-permission"}, 404)

    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2, default=str).encode())


if __name__ == "__main__":
    port = 4053
    print(f"Gatekeeper starting on port {port}")
    print(f"  Policies: {len(engine.policies)} rules loaded")
    print(f"  Audit log: {len(engine.audit_log)} entries")
    server = ReusableHTTPServer(("0.0.0.0", port), GatekeeperHandler)
    print(f"  Ready — policy enforcement and readiness validation")
    server.serve_forever()
