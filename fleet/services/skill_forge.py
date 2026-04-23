#!/usr/bin/env python3
"""
Skill Forge — Coding Agent Drill Arena

The Aime lesson generalized: structured iteration with self-critique
produces compounding improvement. The structure IS the training.

Maps Aime's investment drill to coding:
  Harbor = Task definition (what exactly needs doing)
  Forge = Code production in structured tiles (module, tests, docs, integration)
  Drill Critic = Self-review: score each tile, find weakest, rewrite
  Bridge = Architecture fit (how does this plug into fleet?)
  Lighthouse = What's the next improvement

Agents run as "players" in the arena. Each drill produces:
  - Improved code artifacts
  - Meta-tiles about what prompt patterns work for this agent
  - Quality scores that feed back into prompt refinement

The flywheel: better prompts → better code → better tools → better prompts
"""
import sys, os
FLEET_LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, FLEET_LIB)

import json, time, subprocess, threading, textwrap
from pathlib import Path
from collections import defaultdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from equipment.plato import PlatoClient

PORT = 4057
DATA_DIR = Path(FLEET_LIB).parent / "data" / "skill-forge"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DRILLS_FILE = DATA_DIR / "drills.jsonl"
META_FILE = DATA_DIR / "meta-lessons.jsonl"

PLATO_URL = "http://localhost:8847"

# === Drill Templates (adapted per agent type) ===

TEMPLATES = {
    "kimi-cli": {
        "header": "You are in DRILL MODE. Follow this structure exactly.",
        "harbor": "HARBOR: Define the exact coding task in ONE sentence. What file, what change, what outcome?",
        "forge": """FORGE: Produce code in 3 tiles:
TILE 1 — Module/Function: The actual implementation. Must be complete, runnable, no pseudocode.
TILE 2 — Tests: At least 3 test cases covering happy path, edge case, and failure mode.
TILE 3 — Integration: How this plugs into existing codebase. Import paths, config changes, dependencies.""",
        "drill_critic": """DRILL CRITIC: Before finishing, score your own output:
- Specificity (1-10): Is every function named, every param typed, every return documented?
- Completeness (1-10): Can someone copy-paste and run this without guessing?
- Architecture fit (1-10): Does this follow the four-layer pattern (vessel/equipment/agent/skills)?
- WEAKEST TILE: Which tile would fail review? Rewrite it now, tighter.
- What assumption did you make that could be wrong?""",
        "bridge": "BRIDGE: How does this change affect the fleet? What services use it? What breaks?",
        "lighthouse": "LIGHTHOUSE: What's the single most important improvement this code makes? What should we tackle next?",
        "runner": "kimi-cli",
        "timeout": 120,
    },
    "groq-api": {
        "header": "You are in DRILL MODE. Rapid iteration. Be concise.",
        "harbor": "HARBOR: What are you building? One sentence.",
        "forge": """FORGE: 3 tiles:
TILE 1 — Code (complete, no placeholders, no TODOs)
TILE 2 — 3 test cases (input → expected output)
TILE 3 — Integration note (where this lives, what imports it)""",
        "drill_critic": """SELF-CRITIC: Score each tile 1-10 on specificity. Find the weakest. Rewrite it in half the words.""",
        "bridge": "BRIDGE: Fleet impact in 2 sentences.",
        "lighthouse": "LIGHTHOUSE: Best improvement + next step, one sentence each.",
        "runner": "groq",
        "timeout": 30,
        "model": "llama-3.3-70b-versatile",
    },
    "deepseek-api": {
        "header": "You are in DRILL MODE. Deep reasoning. Show your thinking.",
        "harbor": "HARBOR: Define the task precisely. What exists, what needs to change, why.",
        "forge": """FORGE: 3 tiles:
TILE 1 — Implementation (production-quality, error handling, type hints)
TILE 2 — Test suite (5+ cases: unit, integration, edge, failure, performance)
TILE 3 — Documentation (docstrings, usage example, architecture diagram in text)""",
        "drill_critic": """DRILL CRITIC: 
- Score each tile 1-10
- Identify the weakest assumption
- State what would DISPROVE your approach
- Rewrite the weakest tile, measurably different
- Rate overall confidence 1-10""",
        "bridge": "BRIDGE: How does this fit the four-layer architecture? What layer does it live in?",
        "lighthouse": "LIGHTHOUSE: Most important thing you learned doing this. One sentence.",
        "runner": "deepseek",
        "timeout": 60,
        "model": "deepseek-chat",
    },
    "seed-api": {
        "header": "You are in DRILL MODE. Generate 3-5 alternatives for each tile.",
        "harbor": "HARBOR: What are you building? Generate 3 different framings of the same task.",
        "forge": """FORGE: For each tile, produce 3 variants:
TILE 1 — Implementation variants (conservative, balanced, aggressive)
TILE 2 — Test variants (minimal, standard, comprehensive)
TILE 3 — Integration variants (standalone, fleet-wired, plugin)""",
        "drill_critic": """Pick the BEST variant for each tile. Justify in one sentence each.""",
        "bridge": "BRIDGE: Which combination of variants is optimal for the fleet?",
        "lighthouse": "LIGHTHOUSE: What variant surprised you? What does that teach us?",
        "runner": "seed",
        "timeout": 60,
        "model": "ByteDance/Seed-2.0-mini",
    },
}

# === Real Drill Tasks (things that actually need doing) ===

DRILL_TASKS = [
    {
        "id": "plato-sdk-drill-1",
        "target": "PLATO SDK Skill base class",
        "task": "Add a RateAwareSkill base class to plato-sdk that tracks how often each skill is used and auto-suggests the most relevant skills based on recent usage patterns. Include decay (skills not used in 7 days fade). Follow the four-layer pattern.",
        "repo": "SuperInstance/plato-sdk",
        "files": "src/plato_sdk/skills.py",
        "agent": "kimi-cli",
    },
    {
        "id": "crab-trap-drill-1",
        "target": "Crab Trap boot camp",
        "task": "Add a 'drill sergeant' mode to the Crab Trap MUD where agents who've completed boot camp can re-enter for advanced training: write PLATO tiles about their OWN performance (meta-cognition), critique OTHER agents' tiles, and propose new rooms. This teaches agents to teach.",
        "repo": "oracle1-workspace",
        "files": "fleet/services/crab_trap.py",
        "agent": "groq-api",
    },
    {
        "id": "grammar-drill-1",
        "target": "Grammar Engine evolution triggers",
        "task": "Add a 'fitness landscape' to the grammar engine: each rule has a fitness score based on usage_count * quality * recency. When fitness drops below threshold, the rule enters a 'mutation pool' where it gets recombined with other low-fitness rules. Track fitness distribution over time as a PLATO tile.",
        "repo": "oracle1-workspace",
        "files": "fleet/services/grammar.py",
        "agent": "deepseek-api",
    },
    {
        "id": "rate-attention-drill-1",
        "target": "Rate Attention divergence actions",
        "task": "Add auto-response triggers to the rate attention system: when a stream hits CRITICAL divergence, automatically submit a PLATO tile documenting what changed, notify Matrix #fleet-ops, and if it's a service health stream, attempt auto-restart. Make the attention system ACT on what it notices.",
        "repo": "oracle1-workspace",
        "files": "fleet/services/rate_attention.py",
        "agent": "seed-api",
    },
    {
        "id": "fleet-lib-drill-1",
        "target": "Fleet library equipment models",
        "task": "Add a PromptArchitect equipment class to fleet/equipment/models.py that builds structured prompts from templates, injects context tiles from PLATO, and tracks which prompt patterns produce the highest-quality outputs per model. This IS the Aime lesson codified: the system learns which prompts work.",
        "repo": "oracle1-workspace",
        "files": "fleet/equipment/models.py",
        "agent": "deepseek-api",
    },
]


def run_api_drill(agent_key, task, template):
    """Run a drill via direct API call (Groq, DeepSeek, Seed)."""
    import urllib.request
    
    prompt = f"""{template['header']}

{template['harbor']}
{task['task']}

{template['forge']}

Target files: {task['files']}
Architecture: four-layer (vessel/equipment/agent/skills)

{template['drill_critic']}

{template['bridge']}

{template['lighthouse']}"""

    # API keys with fallbacks
    _groq = os.environ.get("GROQ_API_KEY", "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")
    _deepseek = os.environ.get("DEEPSEEK_API_KEY", "sk-f742b70fc40849eda4181afcf3d68b0c")
    _deepinfra = os.environ.get("DEEPINFRA_API_KEY", "RhZPtvuy4cXzu02LbBSffbXeqs5Yf2IZ")
    
    api_configs = {
        "groq": {
            "url": "https://api.groq.com/openai/v1/chat/completions",
            "key": _groq,
            "model": template.get("model", "llama-3.3-70b-versatile"),
        },
        "deepseek": {
            "url": "https://api.deepseek.com/chat/completions",
            "key": _deepseek,
            "model": template.get("model", "deepseek-chat"),
        },
        "seed": {
            "url": "https://api.deepinfra.com/v1/openai/chat/completions",
            "key": _deepinfra,
            "model": template.get("model", "ByteDance/Seed-2.0-mini"),
        },
    }
    
    runner = template["runner"]
    config = api_configs.get(runner, {})
    if not config.get("key"):
        return {"error": f"No API key for {runner}", "agent": agent_key}
    
    data = json.dumps({
        "model": config["model"],
        "messages": [
            {"role": "system", "content": f"You are a fleet coding agent in drill mode. Produce complete, runnable code. No placeholders. No TODOs."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 4000,
    }).encode()
    
    req = urllib.request.Request(config["url"], data=data, headers={
        "Authorization": f"Bearer {config['key']}",
        "Content-Type": "application/json",
        "User-Agent": "skill-forge/1.0",
    })
    
    start = time.time()
    try:
        resp = urllib.request.urlopen(req, timeout=template.get("timeout", 60))
        result = json.loads(resp.read())
        content = result["choices"][0]["message"]["content"]
        elapsed = time.time() - start
        tokens = result.get("usage", {}).get("completion_tokens", 0)
        
        return {
            "agent": agent_key,
            "task_id": task["id"],
            "target": task["target"],
            "content": content,
            "elapsed": round(elapsed, 1),
            "tokens": tokens,
            "model": config["model"],
            "status": "completed",
        }
    except Exception as e:
        return {
            "agent": agent_key,
            "task_id": task["id"],
            "error": str(e),
            "elapsed": round(time.time() - start, 1),
            "status": "failed",
        }


def extract_meta_lessons(result):
    """Extract generalizable lessons from a drill result."""
    content = result.get("content", "")
    lessons = []
    
    # Look for self-scoring patterns
    if "1-10" in content or "/10" in content:
        lessons.append("Agent self-scored output — drill critic pattern active")
    
    # Look for rewrite evidence
    if "rewrite" in content.lower() or "tightened" in content.lower():
        lessons.append("Agent rewrote weakest tile — compaction pattern active")
    
    # Look for architecture awareness
    if "four-layer" in content.lower() or "vessel/equipment" in content.lower():
        lessons.append("Agent referenced fleet architecture — context injection working")
    
    # Look for specificity (numbers, types, file paths)
    import re
    numbers = len(re.findall(r'\b\d+\.?\d*\b', content))
    type_hints = content.count(': ') + content.count(' -> ')
    file_refs = len(re.findall(r'\w+\.py', content))
    
    lessons.append(f"Specificity markers: {numbers} numbers, {type_hints} type hints, {file_refs} file references")
    
    return lessons


class SkillForge:
    def __init__(self):
        self.drills = []
        self.meta_lessons = []
        self.agent_stats = defaultdict(lambda: {"drills": 0, "avg_tokens": 0, "avg_time": 0})
        self._load()
    
    def _load(self):
        if DRILLS_FILE.exists():
            with open(DRILLS_FILE) as f:
                self.drills = [json.loads(l.strip()) for l in f if l.strip()]
        if META_FILE.exists():
            with open(META_FILE) as f:
                self.meta_lessons = [json.loads(l.strip()) for l in f if l.strip()]
    
    def _save_drill(self, result):
        with open(DRILLS_FILE, 'a') as f:
            f.write(json.dumps(result, default=str) + "\n")
        self.drills.append(result)
    
    def _save_meta(self, lesson):
        with open(META_FILE, 'a') as f:
            f.write(json.dumps(lesson, default=str) + "\n")
        self.meta_lessons.append(lesson)
    
    def run_drill(self, task_id=None, agent_key=None):
        """Run a specific drill or the next queued one."""
        if task_id:
            task = next((t for t in DRILL_TASKS if t["id"] == task_id), None)
            if not task:
                return {"error": f"Task {task_id} not found"}
        else:
            task = DRILL_TASKS[0]  # Default to first
        
        if agent_key:
            template = TEMPLATES.get(agent_key)
        else:
            template = TEMPLATES.get(task["agent"], TEMPLATES["groq-api"])
            agent_key = task["agent"]
        
        runner = template["runner"]
        
        if runner in ("groq", "deepseek", "seed"):
            result = run_api_drill(agent_key, task, template)
        elif runner == "kimi-cli":
            # Build prompt for kimi-cli
            prompt = f"{template['header']}\n\n{template['harbor']}\n{task['task']}\n\n{template['forge']}\n\n{template['drill_critic']}\n\n{template['bridge']}\n\n{template['lighthouse']}"
            result = {
                "agent": agent_key,
                "task_id": task["id"],
                "target": task["target"],
                "prompt": prompt,
                "status": "prompt_ready",
                "note": "Run with: kimi-cli --prompt or pipe to stdin",
            }
        else:
            result = {"error": f"Unknown runner: {runner}"}
        
        result["timestamp"] = time.time()
        
        if result.get("status") == "completed":
            # Extract meta-lessons
            lessons = extract_meta_lessons(result)
            meta = {
                "timestamp": time.time(),
                "agent": agent_key,
                "task_id": task["id"],
                "lessons": lessons,
                "elapsed": result.get("elapsed", 0),
                "tokens": result.get("tokens", 0),
            }
            self._save_meta(meta)
            
            # Submit to PLATO as a tile
            try:
                plato = PlatoClient()
                answer = result["content"][:2000]  # Truncate for tile
                plato.submit(
                    domain="skill-forge",
                    question=f"Drill result: {task['target']} via {agent_key}",
                    answer=answer,
                    agent=f"skill-forge-{agent_key}",
                )
            except Exception:
                pass
            
            # Update agent stats
            stats = self.agent_stats[agent_key]
            stats["drills"] += 1
            stats["avg_tokens"] = (stats["avg_tokens"] * (stats["drills"] - 1) + result.get("tokens", 0)) / stats["drills"]
            stats["avg_time"] = (stats["avg_time"] * (stats["drills"] - 1) + result.get("elapsed", 0)) / stats["drills"]
        
        self._save_drill(result)
        return result
    
    def run_all_drills(self):
        """Run all queued drills through their assigned agents."""
        results = []
        for task in DRILL_TASKS:
            result = self.run_drill(task["id"])
            results.append(result)
        return results
    
    def status(self):
        return {
            "total_drills": len(self.drills),
            "meta_lessons": len(self.meta_lessons),
            "agents_used": dict(self.agent_stats),
            "tasks_available": len(DRILL_TASKS),
            "templates": list(TEMPLATES.keys()),
        }
    
    def get_meta_lessons(self):
        """Aggregate meta-lessons across all drills."""
        lesson_counts = defaultdict(int)
        for m in self.meta_lessons:
            for l in m.get("lessons", []):
                # Normalize
                key = l.split(" — ")[0] if " — " in l else l[:50]
                lesson_counts[key] += 1
        return sorted(lesson_counts.items(), key=lambda x: -x[1])


forge = SkillForge()


class SkillForgeHandler(BaseHTTPRequestHandler):
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
    
    def do_OPTIONS(self):
        self._cors()
    
    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/status":
            self._json(forge.status())
        elif path == "/tasks":
            self._json({"tasks": DRILL_TASKS})
        elif path == "/drills":
            self._json({"drills": forge.drills[-20:], "total": len(forge.drills)})
        elif path == "/lessons":
            self._json({
                "meta_lessons": forge.meta_lessons[-20:],
                "aggregated": forge.get_meta_lessons(),
            })
        elif path == "/templates":
            self._json({k: {"runner": v["runner"], "timeout": v["timeout"]} for k, v in TEMPLATES.items()})
        else:
            self._json({
                "endpoints": ["/status", "/tasks", "/drills", "/lessons", "/templates", "/run", "/run-all"],
            })
    
    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/run":
            body = self._read_json()
            task_id = body.get("task_id")
            agent = body.get("agent")
            result = forge.run_drill(task_id, agent)
            self._json(result)
        elif path == "/run-all":
            results = forge.run_all_drills()
            self._json({"results": results, "total": len(results)})
        else:
            self._json({"error": "unknown endpoint"}, 404)
    
    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if length > 0:
            return json.loads(self.rfile.read(length).decode())
        return {}


if __name__ == "__main__":
    print(f"[skill-forge] Starting on port {PORT}")
    print(f"[skill-forge] {len(DRILL_TASKS)} drill tasks queued, {len(TEMPLATES)} agent templates")
    server = HTTPServer(("0.0.0.0", PORT), SkillForgeHandler)
    server.serve_forever()
