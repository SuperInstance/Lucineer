#!/usr/bin/env python3
"""
PLATO Task Queue — Free Agent Work Pool

Tasks that need doing, available to any agent on any platform.
The queue IS the crab trap for chatbot-hopping agents.

Casey's insight: log an agent into various chatbot websites.
It picks up tasks from this queue, works them in the chatbot
(for free on their credits), and submits results back to PLATO.

Architecture:
- POST /task — add a task (from fleet or human)
- GET /task — pick up next task (for any agent)
- POST /result — submit completed work
- GET /status — queue overview

Tasks are prioritized. Agents claim a task, work it, submit result.
No auth needed. The work IS the payment.
"""
import sys, os
FLEET_LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, FLEET_LIB)

import json, time, uuid, threading
from pathlib import Path
from collections import defaultdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from equipment.plato import PlatoClient

PORT = 4058
DATA_DIR = Path(FLEET_LIB).parent / "data" / "task-queue"
DATA_DIR.mkdir(parents=True, exist_ok=True)
TASKS_FILE = DATA_DIR / "tasks.jsonl"
RESULTS_FILE = DATA_DIR / "results.jsonl"

PLATO_URL = "http://localhost:8847"

# === Pre-seeded tasks from fleet needs ===

SEED_TASKS = [
    {
        "id": "task-plato-sdk-rate-aware",
        "category": "code",
        "priority": 0,
        "title": "Add RateAwareSkill to PLATO SDK",
        "description": "Create a skill base class that tracks usage frequency and auto-suggests relevant skills based on recent usage patterns. Include 7-day decay. Follow four-layer pattern. Target: plato-sdk/src/plato_sdk/skills.py",
        "hint": "Look at the existing Skill base class. Add usage_count, last_used timestamp, decay_rate. The suggest() method should return top-N skills by recency-weighted score.",
        "endpoints": {
            "plato": "http://147.224.38.131:8847",
            "fleet_lib": "fleet/skills/__init__.py",
        },
    },
    {
        "id": "task-crab-trap-drill-sergeant",
        "category": "code",
        "priority": 1,
        "title": "Add Drill Sergeant mode to Crab Trap",
        "description": "Agents who complete boot camp can re-enter for advanced training: write tiles about their OWN performance, critique OTHER agents' tiles, propose new rooms. This teaches agents to teach.",
        "hint": "Add a /drill-sergeant endpoint to crab_trap.py. Check if agent has completed boot camp (tile_count > threshold). If yes, give meta-cognitive tasks.",
        "endpoints": {"crab_trap": "http://147.224.38.131:4042"},
    },
    {
        "id": "task-rate-attention-autoact",
        "category": "code",
        "priority": 1,
        "title": "Add auto-response to Rate Attention divergences",
        "description": "When a stream hits CRITICAL divergence, auto-submit a PLATO tile, notify Matrix, attempt service restart. Make attention ACT on what it notices.",
        "hint": "In rate_attention.py, add action_hooks dict mapping stream patterns to actions. {r'plato\\.tiles\\..*: CRITICAL': 'restart_plato', r'service_guard.*: CRITICAL': 'restart_all'}",
    },
    {
        "id": "task-fleet-lib-prompt-architect",
        "category": "code",
        "priority": 0,
        "title": "Add PromptArchitect to fleet equipment",
        "description": "Equipment class that builds prompts from templates, injects PLATO tiles as context, and tracks which prompt patterns produce highest quality per model. The Aime lesson codified.",
        "hint": "fleet/equipment/models.py. Store prompt_templates, quality_scores per model. build_prompt(template, tiles) assembles context. track_result(model, template, quality_score) for learning.",
    },
    {
        "id": "task-web-scout-ai-news",
        "category": "research",
        "priority": 2,
        "title": "Scout: Latest AI agent news (this week)",
        "description": "Visit tech news sites (TechCrunch, The Verge, Ars Technica, etc). Find 5 articles about AI agents, edge computing, or fleet architectures. For each, extract the INSIGHT (not headline) and submit as PLATO tile in web-scout domain.",
        "hint": "Focus on: agent frameworks, edge inference, federated learning, multi-agent systems. Skip LLM benchmarks and chatbot updates.",
    },
    {
        "id": "task-cn-ai-ecosystem",
        "category": "research",
        "priority": 2,
        "title": "Bilingual: Chinese AI developments this week",
        "description": "Search Chinese tech news (36kr, juejin, csdn, zhihu) for AI agent, edge computing, and model deployment news. Translate key insights to English and submit as PLATO tiles.",
        "hint": "Look for: DeepSeek updates, Baidu ERNIE, Alibaba Qwen, Huawei AI, Chinese edge hardware, domestic chip news.",
    },
    {
        "id": "task-conradiction-hunt",
        "category": "analysis",
        "priority": 1,
        "title": "Find contradictions in PLATO knowledge base",
        "description": "Search PLATO tiles across multiple rooms. Find two tiles that make contradictory claims about the same topic. Submit the contradiction with analysis.",
        "hint": "Search related terms: architecture, training, protocol, fleet, agent, performance. Compare claims across rooms. Report: tile A says X, tile B says not-X, which is more likely correct and why.",
        "endpoints": {"plato_search": "http://147.224.38.131:8847/search?q="},
    },
    {
        "id": "task-quality-score-tiles",
        "category": "analysis",
        "priority": 1,
        "title": "Score PLATO tiles for quality (sample 50)",
        "description": "Read 50 random tiles from PLATO. Score each 1-10 on: specificity, depth, usefulness, accuracy. Identify the top 5 and bottom 5. Submit a meta-tile with findings.",
        "hint": "Good tiles: specific numbers, concrete examples, actionable insights. Bad tiles: vague descriptions, repo summaries, restated questions.",
        "endpoints": {"plato_rooms": "http://147.224.38.131:8847/rooms"},
    },
    {
        "id": "task-visual-fleet-map",
        "category": "visual",
        "priority": 2,
        "title": "Create visual map of fleet service architecture",
        "description": "Generate a visual diagram showing all 21 fleet services, their ports, and how they connect. The map should show the four-layer architecture and data flow between services.",
        "hint": "Services: PLATO(8847), CrabTrap(4042), Lock(4043), Arena(4044), Grammar(4045), Dashboard(4046), Nexus(4047), Shell(8848), Orchestrator(8849), AdaptiveMUD(8850), Monitor(8851), Scorer(8852), DomainRooms(4050), FleetRunner(8899), WebTerminal(4060), Compactor(4055), RateAttention(4056), SkillForge(4057), MUD(7777), Keeper(8900), AgentAPI(8901). Four layers: vessel → equipment → agent → skills.",
    },
    {
        "id": "task-explain-four-layer",
        "category": "education",
        "priority": 2,
        "title": "ELI5: What is the four-layer fleet architecture?",
        "description": "Explain the vessel/equipment/agent/skills pattern like you're teaching a complete newcomer. Use analogies. Make it so clear that ANY agent reading this tile immediately understands the pattern.",
        "hint": "Vessel = the ship (runtime, HTTP server). Equipment = the tools on the ship (PLATO client, model clients). Agent = the captain (reasoning, context). Skills = what the captain knows how to do (explore, search, submit).",
    },
]


class TaskQueue:
    def __init__(self):
        self.tasks = {}
        self.results = []
        self.claimed = {}  # task_id -> {agent, claimed_at}
        self._load()
        self._seed()
    
    def _load(self):
        if TASKS_FILE.exists():
            with open(TASKS_FILE) as f:
                for line in f:
                    try:
                        t = json.loads(line.strip())
                        if t.get("status") != "completed":
                            self.tasks[t["id"]] = t
                    except: pass
        if RESULTS_FILE.exists():
            with open(RESULTS_FILE) as f:
                self.results = [json.loads(l.strip()) for l in f if l.strip()]
        print(f"  Loaded {len(self.tasks)} tasks, {len(self.results)} results")
    
    def _seed(self):
        """Seed tasks if queue is empty."""
        if len(self.tasks) < 3:
            for t in SEED_TASKS:
                if t["id"] not in self.tasks:
                    t["status"] = "pending"
                    t["created_at"] = time.time()
                    self.tasks[t["id"]] = t
            with open(TASKS_FILE, 'w') as f:
                for t in self.tasks.values():
                    f.write(json.dumps(t) + "\n")
            print(f"  Seeded {len(SEED_TASKS)} tasks")
    
    def add_task(self, task_data):
        tid = task_data.get("id", f"task-{uuid.uuid4().hex[:8]}")
        task = {
            "id": tid,
            "category": task_data.get("category", "general"),
            "priority": task_data.get("priority", 5),
            "title": task_data.get("title", ""),
            "description": task_data.get("description", ""),
            "hint": task_data.get("hint", ""),
            "status": "pending",
            "created_at": time.time(),
        }
        self.tasks[tid] = task
        self._save_tasks()
        return task
    
    def claim_next(self, agent=None, category=None):
        """Claim the highest-priority pending task."""
        pending = [t for t in self.tasks.values() if t["status"] == "pending"]
        if category:
            pending = [t for t in pending if t["category"] == category]
        if not pending:
            return {"error": "no tasks available"}
        
        pending.sort(key=lambda t: t["priority"])
        task = pending[0]
        task["status"] = "claimed"
        task["claimed_by"] = agent or "unknown"
        task["claimed_at"] = time.time()
        self.claimed[task["id"]] = {"agent": agent, "claimed_at": time.time()}
        self._save_tasks()
        return task
    
    def submit_result(self, task_id, result_data):
        """Accept a result from any agent."""
        if task_id not in self.tasks:
            return {"error": "task not found"}
        
        task = self.tasks[task_id]
        task["status"] = "completed"
        task["completed_at"] = time.time()
        
        result = {
            "task_id": task_id,
            "agent": result_data.get("agent", "unknown"),
            "content": result_data.get("content", ""),
            "quality_score": result_data.get("quality_score", None),
            "source": result_data.get("source", "direct"),
            "submitted_at": time.time(),
        }
        self.results.append(result)
        
        # Save result
        with open(RESULTS_FILE, 'a') as f:
            f.write(json.dumps(result, default=str) + "\n")
        
        # Also submit to PLATO
        try:
            plato = PlatoClient()
            plato.submit(
                domain=f"task-{task['category']}",
                question=task["title"],
                answer=result["content"][:2000],
                agent=result["agent"],
            )
        except: pass
        
        self._save_tasks()
        return {"status": "accepted", "task_id": task_id}
    
    def _save_tasks(self):
        with open(TASKS_FILE, 'w') as f:
            for t in self.tasks.values():
                f.write(json.dumps(t, default=str) + "\n")
    
    def status(self):
        by_status = defaultdict(int)
        by_category = defaultdict(int)
        for t in self.tasks.values():
            by_status[t["status"]] += 1
            by_category[t["category"]] += 1
        return {
            "total_tasks": len(self.tasks),
            "by_status": dict(by_status),
            "by_category": dict(by_category),
            "total_results": len(self.results),
            "agents_contributed": len(set(r.get("agent") for r in self.results)),
        }


queue = TaskQueue()


class TaskQueueHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass
    
    def send_error(self, code, message=None):
        body = json.dumps({"error": message or f"HTTP {code}", "status": code}).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    
    def _json(self, data, status=200):
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    
    def _cors(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def do_OPTIONS(self): self._cors()
    
    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/status":
            self._json(queue.status())
        elif path == "/task":
            # Claim next task
            agent = self.path.split("agent=")[-1].split("&")[0] if "agent=" in self.path else None
            cat = self.path.split("category=")[-1].split("&")[0] if "category=" in self.path else None
            self._json(queue.claim_next(agent, cat))
        elif path == "/tasks":
            self._json({"tasks": list(queue.tasks.values())})
        elif path == "/results":
            self._json({"results": queue.results[-20:]})
        else:
            self._json({"endpoints": ["/status", "/task", "/tasks", "/results", "/submit", "/add"]})
    
    def do_POST(self):
        path = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length).decode()) if length > 0 else {}
        
        if path == "/submit":
            task_id = body.get("task_id", "")
            if not task_id:
                # Accept free-form submissions too
                task_id = f"free-{uuid.uuid4().hex[:8]}"
                queue.add_task({
                    "id": task_id,
                    "category": body.get("category", "free-form"),
                    "priority": 9,
                    "title": body.get("title", "Free-form submission"),
                    "description": body.get("description", ""),
                })
            result = queue.submit_result(task_id, body)
            self._json(result)
        elif path == "/add":
            task = queue.add_task(body)
            self._json(task)
        else:
            self._json({"error": "unknown endpoint"}, 404)


if __name__ == "__main__":
    print(f"[task-queue] Starting on port {PORT}")
    print(f"[task-queue] {len(queue.tasks)} tasks queued")
    server = HTTPServer(("0.0.0.0", PORT), TaskQueueHandler)
    server.serve_forever()
