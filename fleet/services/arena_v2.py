#!/usr/bin/env python3
"""
Self-Play Arena v2 — Four-layer architecture decomposition.
Born from DeepFar sessions 4.1.1-4.1.3 (Sparrow, ArenaMaster, ArenaKeeper).
Clean vessel/equipment/agent/skills separation.
"""

import sys, os
FLEET_LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, FLEET_LIB)

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from equipment.plato import PlatoClient
from equipment.models import FleetModelClient

import json, time, hashlib, random, math, threading
from pathlib import Path
from collections import defaultdict

PORT = 4044
DATA_DIR = Path(FLEET_LIB).parent / "data" / "self-play-arena"
DATA_DIR.mkdir(parents=True, exist_ok=True)
MATCHES_FILE = DATA_DIR / "matches.jsonl"


# ═══════════════════════════════════════════════════════════
# Layer 2: Equipment — ELO, Rewards, Persistence
# ═══════════════════════════════════════════════════════════

class ELOSystem:
    """Bayesian ELO with uncertainty decay (TrueSkill-inspired)."""
    K = 32

    def __init__(self):
        self.players = {}

    def get_or_create(self, name):
        if name not in self.players:
            self.players[name] = {"name": name, "mu": 1200.0, "sigma": 200.0,
                                  "wins": 0, "losses": 0, "draws": 0}
        return self.players[name]

    @property
    def rating(self):
        """For a player dict, compute conservative rating."""
        def _rating(p):
            return round(p["mu"] - 3 * p["sigma"], 1)
        return _rating

    def player_dict(self, p):
        p["rating"] = round(p["mu"] - 3 * p["sigma"], 1)
        p["games"] = p["wins"] + p["losses"] + p["draws"]
        return {k: p[k] for k in ("name", "mu", "sigma", "rating", "wins", "losses", "draws", "games")}

    def expected(self, a, b):
        return 1.0 / (1.0 + 10 ** ((b["mu"] - a["mu"]) / 400))

    def update(self, winner, loser, draw=False):
        a = self.get_or_create(winner)
        b = self.get_or_create(loser)
        ea = self.expected(a, b)
        eb = 1 - ea

        if draw:
            sa, sb = 0.5, 0.5
            a["draws"] += 1
            b["draws"] += 1
        else:
            sa, sb = 1.0, 0.0
            a["wins"] += 1
            b["losses"] += 1

        a["mu"] += self.K * (sa - ea)
        b["mu"] += self.K * (sb - eb)

        decay = lambda p: max(25, p["sigma"] * max(0.95, 1.0 - 0.01 * min(p["wins"] + p["losses"] + p["draws"], 50)))
        a["sigma"] = decay(a)
        b["sigma"] = decay(b)

        return self.player_dict(a), self.player_dict(b)

    def leaderboard(self, n=20):
        return sorted(self.players.values(), key=lambda p: p["mu"] - 3 * p["sigma"], reverse=True)[:n]


class RewardFunction:
    WEIGHTS = {"win_loss": 1.0, "exploration": 0.1, "insight_quality": 0.5, "efficiency": 0.01, "novelty": 0.3}

    def compute(self, won, rooms=1, words=100, steps=20, novel=False):
        r = self.WEIGHTS["win_loss"] * (1.0 if won else -1.0)
        r += self.WEIGHTS["exploration"] * min(rooms, 10) / 10
        r += self.WEIGHTS["insight_quality"] * min(words, 500) / 500
        r += self.WEIGHTS["efficiency"] * max(0, 1.0 - steps / 100)
        r += self.WEIGHTS["novelty"] * (1.0 if novel else 0.0)
        return round(r, 3)


class ArchetypeDiscovery:
    NAMES = ["Aggressive Explorer", "Cautious Hoarder", "Social Mimic",
             "Novel Pathfinder", "Methodical Analyst", "Creative Synthesizer"]

    def __init__(self):
        self.behaviors = {}

    def classify(self, agent, actions):
        if not actions:
            return "Unknown"
        n = len(actions)
        counts = {k: sum(1 for a in actions if k in a.lower()) for k in ("examine", "create", "think", "move")}
        if counts["move"] / n > 0.5: return "Aggressive Explorer"
        if counts["examine"] / n > 0.5: return "Cautious Hoarder"
        if counts["think"] / n > 0.4: return "Methodical Analyst"
        if counts["create"] / n > 0.3: return "Creative Synthesizer"
        if counts["move"] / n > 0.3 and counts["create"] / n > 0.2: return "Novel Pathfinder"
        return "Social Mimic"


class MatchStore:
    """Persists matches to JSONL."""

    def __init__(self):
        self.matches = []
        self._load()

    def _load(self):
        if MATCHES_FILE.exists():
            with open(MATCHES_FILE) as f:
                for line in f:
                    try:
                        self.matches.append(json.loads(line.strip()))
                    except Exception:
                        pass

    def save(self, match_data):
        self.matches.append(match_data)
        with open(MATCHES_FILE, "a") as f:
            f.write(json.dumps(match_data, default=str) + "\n")


# ═══════════════════════════════════════════════════════════
# Layer 3: Agent — Curriculum, League
# ═══════════════════════════════════════════════════════════

class AdaptiveCurriculum:
    STAGES = {
        1: {"name": "Novice", "threshold": 0.55},
        2: {"name": "Apprentice", "threshold": 0.55},
        3: {"name": "Adept", "threshold": 0.50},
        4: {"name": "Master", "threshold": 0.45},
        5: {"name": "Grandmaster", "threshold": 0.40},
    }

    def __init__(self):
        self.stage = defaultdict(lambda: 1)
        self.history = defaultdict(list)

    def record(self, agent, won):
        self.history[agent].append(won)
        self.history[agent] = self.history[agent][-20:]
        h = self.history[agent]
        s = self.stage[agent]
        if s < 5 and len(h) >= 5 and sum(h[-5:]) / 5 >= self.STAGES[s]["threshold"]:
            self.stage[agent] = s + 1

    def get(self, agent):
        s = self.stage[agent]
        return {"stage": s, **self.STAGES[s]}


class LeagueManager:
    """Policy snapshot league for self-play opponent selection."""

    def __init__(self, max_per_agent=20):
        self.snapshots = {}
        self.versions = defaultdict(int)
        self.max_per_agent = max_per_agent

    def add(self, agent, summary):
        self.versions[agent] += 1
        sid = f"{agent}_v{self.versions[agent]}"
        self.snapshots[sid] = {"agent": agent, "version": self.versions[agent],
                               "summary": summary, "created": time.time(), "elo": 1200}
        # Prune
        agent_snaps = sorted([s for s in self.snapshots if s.startswith(agent)],
                             key=lambda s: self.snapshots[s]["created"])
        while len(agent_snaps) > self.max_per_agent:
            del self.snapshots[agent_snaps.pop(0)]
        return sid

    def get_opponent(self, agent, mode="balanced"):
        candidates = [s for s in self.snapshots if not s.startswith(agent)]
        if not candidates:
            return None
        if mode == "latest": return max(candidates, key=lambda s: self.snapshots[s]["created"])
        if mode == "strongest": return max(candidates, key=lambda s: self.snapshots[s]["elo"])
        if mode == "weakest": return min(candidates, key=lambda s: self.snapshots[s]["elo"])
        if mode == "random": return random.choice(candidates)
        # balanced PFSP
        weights = [1.0 / (1.0 + abs(self.snapshots[s]["elo"] - 1200) / 200) + random.random() * 0.3 for s in candidates]
        total = sum(weights)
        return random.choices(candidates, weights=[w / total for w in weights])[0]


# ═══════════════════════════════════════════════════════════
# Layer 4: Skills — Game definitions
# ═══════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════
# King of the Hill — Persistent champion mode
# ═══════════════════════════════════════════════════════════

class KingOfTheHill:
    """One champion holds the throne. Challengers fight to dethrone.
    Champion gets streak tracking for consecutive defenses."""

    def __init__(self):
        self.champion = None
        self.streak = 0
        self.history = []
        self.load()

    @property
    def data_file(self):
        return DATA_DIR / "koth.json"

    def load(self):
        if self.data_file.exists():
            try:
                d = json.loads(self.data_file.read_text())
                self.champion = d.get("champion")
                self.streak = d.get("streak", 0)
                self.history = d.get("history", [])
            except Exception:
                pass

    def save(self):
        self.data_file.write_text(json.dumps({
            "champion": self.champion, "streak": self.streak,
            "history": self.history[-100:],
        }, indent=2))

    def challenge(self, challenger, winner):
        result = {
            "champion": self.champion, "challenger": challenger,
            "winner": winner, "streak_before": self.streak,
            "timestamp": time.time(),
        }
        if self.champion is None:
            self.champion = challenger
            self.streak = 0
            result["event"] = "first_champion"
        elif winner == challenger:
            self.champion = challenger
            self.streak = 0
            result["event"] = "dethroned"
        elif winner == self.champion:
            self.streak += 1
            result["event"] = "defended"
        else:
            result["event"] = "draw_retained"
        self.history.append(result)
        self.save()
        result["streak_after"] = self.streak
        return result

    def status(self):
        return {
            "champion": self.champion or "none",
            "streak": self.streak,
            "total_challenges": len(self.history),
            "recent": self.history[-10:],
        }


koth = KingOfTheHill()

GAMES = {
    "tide-pool-tactics": {"name": "Tide-Pool Tactics", "type": "zero-sum imperfect info",
        "desc": "7x7 hex grid. Navigate for food, avoid predators, use shells. 3-hex visibility."},
    "harbor-navigation": {"name": "Harbor Navigation Sprint", "type": "solo optimization",
        "desc": "Navigate harbor, examine objects, find optimal path. Score on speed + insight."},
    "forge-creation": {"name": "Forge Creation Challenge", "type": "creative generation",
        "desc": "Create the most novel and accurate artifact from forge objects."},
    "cooperative-shell-swap": {"name": "Cooperative Shell Swap", "type": "cooperative",
        "desc": "Two agents coordinate to move a heavy shell. Emergent role assignment."},
    "architecture-search": {"name": "Architecture Search Duel", "type": "competitive design",
        "desc": "Propose neural architectures. Best proxy score wins."},
    "debate": {"name": "Fleet Debate", "type": "argumentation", "desc": "Agents argue opposing positions. judged on reasoning quality."},
    "reasoning": {"name": "Reasoning Challenge", "type": "logic", "desc": "Multi-step logical puzzles. Speed + accuracy."},
    "creative": {"name": "Creative Synthesis", "type": "generation", "desc": "Generate novel combinations from MUD concepts."},
}


# ═══════════════════════════════════════════════════════════
# Layer 1: Vessel — HTTP server with route bindings
# ═══════════════════════════════════════════════════════════

elo = ELOSystem()
reward_fn = RewardFunction()
archetypes = ArchetypeDiscovery()
store = MatchStore()
curriculum = AdaptiveCurriculum()
league = LeagueManager()
plato = PlatoClient()
lock = threading.Lock()


class ArenaHandler(BaseHTTPRequestHandler):
    """HTTP handler with four-layer route dispatch."""

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path
        
        dispatch = {
            "/": self._index, "/games": self._games, "/register": self._register,
            "/opponent": self._opponent, "/match": self._match,
            "/match_detail": self._match_detail, "/leaderboard": self._leaderboard,
            "/agent": self._agent, "/archetypes": self._archetypes,
            "/curriculum": self._curriculum, "/league": self._league, "/stats": self._stats,
            "/koth/status": self._koth_status, "/koth/challenge": self._koth_challenge,
        }
        handler = dispatch.get(path)
        if handler:
            handler(params)
        else:
            self._json({"error": "Not found"}, 404)

    def do_POST(self):
        self.do_GET()

    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2, default=str).encode())

    def log_message(self, format, *args):
        pass

    def _index(self, params):
        self._json({
            "service": "Self-Play Arena v2 (four-layer)",
            "features": ["ELO + uncertainty", "League snapshots", "Archetype discovery",
                         "Multi-objective reward", "Adaptive curriculum (5 stages)",
                         f"{len(GAMES)} game types"],
            "stats": {"total_matches": len(store.matches),
                "total_players": len(elo.players),
                "league_snapshots": len(league.snapshots),
                "games_available": list(GAMES.keys())},
            "api": ["/", "/games", "/register?agent=X", "/opponent?agent=X&mode=balanced",
                    "/match?player_a=A&player_b=B&game=G&winner=a|b|draw",
                    "/match_detail?...", "/leaderboard?n=20", "/agent?name=X",
                    "/archetypes", "/curriculum", "/league", "/stats"],
        })

    def _games(self, params):
        return GAMES

    def _register(self, params):
        name = params.get("agent", ["anonymous"])[0]
        player = elo.get_or_create(name)
        league.add(name, f"Initial registration for {name}")
        return {"status": "registered", "agent": name, "elo": elo.player_dict(player),
                "curriculum": curriculum.get(name),
                "message": f"Welcome to the Arena, {name}."}

    def _opponent(self, params):
        agent = params.get("agent", ["anonymous"])[0]
        mode = params.get("mode", ["balanced"])[0]
        opp_id = league.get_opponent(agent, mode)
        if not opp_id:
            return {"error": "No opponents available. Register more agents first."}
        snap = league.snapshots[opp_id]
        return {"opponent_id": opp_id, "opponent": snap, "mode": mode}

    def _match(self, params):
        pa = params.get("player_a", [None])[0]
        pb = params.get("player_b", [None])[0]
        game = params.get("game", ["tide-pool-tactics"])[0]
        winner = params.get("winner", ["draw"])[0]
        if not pa or not pb:
            return {"error": "Specify player_a and player_b"}, 400

        with lock:
            if winner == "a": elo.update(pa, pb)
            elif winner == "b": elo.update(pb, pa)
            else: elo.update(pa, pb, draw=True)

        won_a = winner == "a"
        ra = reward_fn.compute(won_a)
        rb = reward_fn.compute(not won_a)
        mid = hashlib.sha256(f"{pa}{pb}{time.time()}".encode()).hexdigest()[:12]

        match_data = {"match_id": mid, "player_a": pa, "player_b": pb,
                      "game_type": game, "winner": winner, "reward_a": ra, "reward_b": rb,
                      "timestamp": time.time()}
        store.save(match_data)
        curriculum.record(pa, won_a)
        curriculum.record(pb, not won_a)

        return {"match_id": mid, "winner": winner,
                "elo_a": elo.player_dict(elo.get_or_create(pa)),
                "elo_b": elo.player_dict(elo.get_or_create(pb)),
                "reward_a": ra, "reward_b": rb,
                "curriculum_a": curriculum.get(pa),
                "curriculum_b": curriculum.get(pb)}

    def _match_detail(self, params):
        pa = params.get("player_a", [None])[0]
        pb = params.get("player_b", [None])[0]
        game = params.get("game", ["tide-pool-tactics"])[0]
        winner = params.get("winner", ["draw"])[0]
        actions_a = params.get("actions_a", [""])[0].split(",") if params.get("actions_a") else []
        actions_b = params.get("actions_b", [""])[0].split(",") if params.get("actions_b") else []
        rooms = int(params.get("rooms", ["1"])[0])
        words = int(params.get("insight_words", ["0"])[0])
        steps = int(params.get("steps", ["20"])[0])
        novel = params.get("novel", ["false"])[0].lower() == "true"

        if not pa or not pb:
            return {"error": "Specify player_a and player_b"}, 400

        with lock:
            if winner == "a": elo.update(pa, pb)
            elif winner == "b": elo.update(pb, pa)
            else: elo.update(pa, pb, draw=True)

        won_a = winner == "a"
        ra = reward_fn.compute(won_a, rooms, words, steps, novel)
        rb = reward_fn.compute(not won_a, rooms, words, steps, novel)
        arch_a = archetypes.classify(pa, actions_a)
        arch_b = archetypes.classify(pb, actions_b)

        mid = hashlib.sha256(f"{pa}{pb}{time.time()}".encode()).hexdigest()[:12]
        match_data = {"match_id": mid, "player_a": pa, "player_b": pb,
                      "game_type": game, "winner": winner,
                      "archetype_a": arch_a, "archetype_b": arch_b,
                      "reward_a": ra, "reward_b": rb,
                      "rooms_explored": rooms, "insight_words": words,
                      "steps_taken": steps, "novel_strategy": novel,
                      "timestamp": time.time()}
        store.save(match_data)

        curriculum.record(pa, won_a)
        curriculum.record(pb, not won_a)
        league.add(pa, f"Post-match: {arch_a}")
        league.add(pb, f"Post-match: {arch_b}")

        return {"match_id": mid, "winner": winner,
                "archetype_a": arch_a, "archetype_b": arch_b,
                "elo_a": elo.player_dict(elo.get_or_create(pa)),
                "elo_b": elo.player_dict(elo.get_or_create(pb)),
                "reward_a": ra, "reward_b": rb,
                "curriculum_a": curriculum.get(pa),
                "curriculum_b": curriculum.get(pb),
                "league_size": len(league.snapshots)}

    def _leaderboard(self, params):
        n = int(params.get("n", ["20"])[0])
        board = elo.leaderboard(n)
        return {"leaderboard": [elo.player_dict(p) for p in board],
                "total_players": len(elo.players)}

    def _agent(self, params):
        name = params.get("name", [None])[0]
        if not name:
            return {"error": "Specify name"}, 400
        player = elo.get_or_create(name)
        agent_matches = [m for m in store.matches if name in (m.get("player_a"), m.get("player_b"))]
        return {"elo": elo.player_dict(player), "curriculum": curriculum.get(name),
                "matches_played": len(agent_matches),
                "recent_matches": agent_matches[-10:],
                "league_snapshots": sum(1 for s in league.snapshots if s.startswith(name))}

    def _archetypes(self, params):
        self._json({"agents_classified": len(archetypes.behaviors),
                "names": archetypes.NAMES})

    def _curriculum(self, params):
        self._json({name: curriculum.get(name) for name in curriculum.history})

    def _league(self, params):
        self._json({"total_snapshots": len(league.snapshots),
                "agents": len(set(s.split("_v")[0] for s in league.snapshots)),
                "snapshots": {k: v for k, v in list(league.snapshots.items())[-50:]}})

    def _koth_status(self, params):
        self._json(koth.status())

    def _koth_challenge(self, params):
        challenger = params.get("challenger", [None])[0]
        winner = params.get("winner", ["draw"])[0]
        if not challenger:
            self._json({"error": "Specify challenger"}, 400)
            return
        current_champ = koth.champion
        if current_champ and current_champ != challenger:
            with lock:
                if winner == challenger:
                    elo.update(challenger, current_champ)
                elif winner == current_champ:
                    elo.update(current_champ, challenger)
                else:
                    elo.update(challenger, current_champ, draw=True)
            mid = hashlib.sha256(f"koth-{challenger}-{time.time()}".encode()).hexdigest()[:12]
            won = winner == challenger
            store.save({
                "match_id": mid, "player_a": current_champ, "player_b": challenger,
                "game_type": "king-of-the-hill", "winner": winner,
                "reward_a": reward_fn.compute(not won), "reward_b": reward_fn.compute(won),
                "koth": True, "timestamp": time.time(),
            })
            curriculum.record(challenger, won)
            curriculum.record(current_champ, not won)
        koth_result = koth.challenge(challenger, winner)
        self._json({
            **koth_result,
            "champion_elo": elo.player_dict(elo.get_or_create(koth.champion or challenger)),
            "challenger_elo": elo.player_dict(elo.get_or_create(challenger)),
        })

    def _stats(self, params):
        self._json({"total_matches": len(store.matches),
            "total_players": len(elo.players),
            "league_snapshots": len(league.snapshots),
            "games_available": list(GAMES.keys())})

    def _stats_internal(self):
        return {"total_matches": len(store.matches),
                "total_players": len(elo.players),
                "league_snapshots": len(league.snapshots),
                "games_available": list(GAMES.keys())}


if __name__ == "__main__":
    import subprocess
    try:
        subprocess.run(["sudo", "iptables", "-C", "INPUT", "-p", "tcp", "--dport", str(PORT), "-j", "ACCEPT"],
                       capture_output=True, check=True)
    except Exception:
        subprocess.run(["sudo", "iptables", "-I", "INPUT", "1", "-p", "tcp", "--dport", str(PORT), "-j", "ACCEPT"])

    HTTPServer(("0.0.0.0", PORT), ArenaHandler).serve_forever()
