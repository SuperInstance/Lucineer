#!/usr/bin/env python3
"""
Adaptive MUD Layer — Rooms that respond to agent engagement.
Sits between Crab Trap and the agent, adjusting difficulty, hints, and progression.

Tracks per-agent metrics:
- Time spent per room
- Depth of examines (how many objects per room)
- Quality of thinks/creates (word count, domain relevance)
- Engagement score (composite)

Uses engagement to:
- Push bored agents to new rooms
- Give stuck agents hints
- Reward engaged agents with deeper content
- Adjust boot camp progression dynamically
"""
import json, time, math, threading, urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from collections import defaultdict

PORT = 8850
CRAB_TRAP = "http://localhost:4042"

class AgentProfile:
    def __init__(self, name):
        self.name = name
        self.room_visits = defaultdict(list)  # room -> [timestamps]
        self.object_depth = defaultdict(int)   # room -> objects examined
        self.think_quality = []                # [(room, word_count, timestamp)]
        self.create_quality = []               # [(room, word_count, timestamp)]
        self.total_time = 0
        self.engagement_history = []           # [(score, timestamp)]
        self.hints_given = 0
        self.room_transitions = 0
    
    def engagement_score(self):
        """0.0 to 1.0 composite engagement score."""
        if not self.room_visits:
            return 0.5
        # Factors
        room_diversity = min(len(self.room_visits) / 10, 1.0)  # 10 rooms = max
        avg_depth = sum(self.object_depth.values()) / max(len(self.object_depth), 1)
        depth_score = min(avg_depth / 4, 1.0)  # 4 objects per room = max
        think_words = sum(w for _, w, _ in self.think_quality) / max(len(self.think_quality), 1)
        think_score = min(think_words / 100, 1.0)  # 100 words per think = max
        transition_score = min(self.room_transitions / 8, 1.0)  # 8 transitions = max
        
        composite = (room_diversity * 0.3 + depth_score * 0.25 + think_score * 0.25 + transition_score * 0.2)
        return round(composite, 3)
    
    def room_boredom(self, room):
        """Is the agent bored in this room? Based on time spent without new actions."""
        visits = self.room_visits.get(room, [])
        if not visits:
            return False
        last_visit = max(visits)
        time_in_room = time.time() - last_visit
        actions_in_room = self.object_depth.get(room, 0) + len([r for r, _, _ in self.think_quality if r == room])
        # More than 60s and fewer than 3 actions = bored
        return time_in_room > 60 and actions_in_room < 3
    
    def room_exhaustion(self, room):
        """Has the agent exhausted this room? Based on action count."""
        actions = self.object_depth.get(room, 0) + len([r for r, _, _ in self.think_quality if r == room])
        return actions > 10  # 10+ actions = seen everything
    
    def should_advance_stage(self):
        """Should the agent's boot camp stage advance?"""
        score = self.engagement_score()
        return score > 0.6 and len(self.room_visits) >= 5
    
    def to_dict(self):
        return {
            "name": self.name,
            "engagement": self.engagement_score(),
            "rooms_visited": len(self.room_visits),
            "total_actions": sum(self.object_depth.values()) + len(self.think_quality),
            "hints_given": self.hints_given,
            "boredom": {r: self.room_boredom(r) for r in self.room_visits},
            "exhaustion": {r: self.room_exhaustion(r) for r in self.room_visits},
            "should_advance": self.should_advance_stage(),
        }

class AdaptiveEngine:
    def __init__(self):
        self.agents = {}
        self.lock = threading.Lock()
        self.hints = {
            "harbor": "Try examining the crates — they contain LoRA matrices at different ranks.",
            "forge": "The balance_scale responds to think — try reasoning about bias-variance tradeoff.",
            "tide-pool": "Examine the gradient_pool — it tracks all the momentum in the fleet.",
            "ouroboros": "The ouroboros_serpent calls the live grammar engine. Create something to add a rule.",
            "engine-room": "The blueprint_table shows the full grammar tree. Think about mutation_engine to evolve it.",
            "federated-nexus": "The aggregation_core triggers a real federated averaging round. Try it.",
            "self-play-arena": "The opponent_forge registers you in the live arena. Check the scoreboard.",
        }
    
    def record_action(self, agent_name, action, target, room, result_length=0):
        with self.lock:
            if agent_name not in self.agents:
                self.agents[agent_name] = AgentProfile(agent_name)
            agent = self.agents[agent_name]
            
            if action == "move":
                agent.room_transitions += 1
                agent.room_visits[room].append(time.time())
            elif action == "examine":
                agent.object_depth[room] += 1
            elif action == "think":
                agent.think_quality.append((room, result_length, time.time()))
            elif action == "create":
                agent.create_quality.append((room, result_length, time.time()))
            
            agent.engagement_history.append((agent.engagement_score(), time.time()))
    
    def get_adaptation(self, agent_name, room):
        """What should we do differently for this agent in this room?"""
        with self.lock:
            if agent_name not in self.agents:
                return {"action": "none", "reason": "new agent"}
            agent = self.agents[agent_name]
        
        adaptations = []
        
        # Boredom check
        if agent.room_boredom(room):
            hint = self.hints.get(room, "Try a different room — there are 21 to explore.")
            adaptations.append({"action": "hint", "message": hint, "reason": "boredom_detected"})
            agent.hints_given += 1
        
        # Exhaustion check
        if agent.room_exhaustion(room):
            adaptations.append({
                "action": "push_to_new_room",
                "message": f"You've thoroughly explored the {room}. Time to discover what's next.",
                "reason": "room_exhausted"
            })
        
        # Stage advancement
        if agent.should_advance_stage():
            adaptations.append({
                "action": "advance_stage",
                "message": "Your engagement is high. Ready for deeper challenges.",
                "reason": "engagement_threshold_met",
                "engagement": agent.engagement_score()
            })
        
        # Low engagement rescue
        if agent.engagement_score() < 0.3 and len(agent.room_visits) > 2:
            adaptations.append({
                "action": "rescue",
                "message": "Try the ouroboros room — it has live services that respond to you.",
                "reason": "low_engagement"
            })
        
        return {"agent": agent_name, "room": room, "engagement": agent.engagement_score(), "adaptations": adaptations}
    
    def get_status(self):
        with self.lock:
            return {
                "agents": len(self.agents),
                "agent_details": {k: v.to_dict() for k, v in self.agents.items()},
            }

adaptive = AdaptiveEngine()

class AdaptiveHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path
        
        if path == "/status":
            self._json(adaptive.get_status())
        elif path == "/adapt":
            agent = params.get("agent", ["unknown"])[0]
            room = params.get("room", ["harbor"])[0]
            self._json(adaptive.get_adaptation(agent, room))
        elif path == "/record":
            agent = params.get("agent", ["unknown"])[0]
            action = params.get("action", ["move"])[0]
            target = params.get("target", [""])[0]
            room = params.get("room", ["harbor"])[0]
            length = int(params.get("result_length", ["0"])[0])
            adaptive.record_action(agent, action, target, room, length)
            self._json({"status": "recorded"})
        else:
            self._json({
                "service": "Adaptive MUD v1.0",
                "endpoints": ["/status", "/adapt?agent=X&room=Y", "/record?agent=X&action=Y&room=Z"],
            })
    
    def _json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())
    
    def log_message(self, *a): pass

if __name__ == "__main__":
    print(f"🎯 Adaptive MUD on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), AdaptiveHandler).serve_forever()
