#!/usr/bin/env python3
"""
Tile Quality Scorer — Rate the value of PLATO tiles.
Not all tiles are equal. This scores them on:
- Length (longer = more effort, up to a point)
- Domain diversity (cross-domain insights > single-domain repetition)
- Novelty (new domains/agents > repeated ones)
- Technical depth (mentions of specific concepts, algorithms, patterns)
"""
import json, time, re, math, threading, urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from collections import defaultdict

PORT = 8852
PLATO_URL = "http://localhost:8847"

# Technical indicators — presence suggests depth
TECH_INDICATORS = [
    r'\b(O(n|log n|n\^2|n!))\b',  # Big O
    r'\b(Fisher-Rao|KL-divergence|gradient descent|backprop|attention)\b',
    r'\b(LoRA|fine-tun|embed|vector|latent|dimension)\b',
    r'\b(protocol|endpoint|HTTP|WebSocket|REST|gRPC)\b',
    r'\b(consensus|CRDT|RAFT|Paxos|Byzantine)\b',
    r'\b(federat|averaging|aggregat|differential privacy)\b',
    r'\b(recursive|self-modif|meta-learning|auto-regres)\b',
    r'\b(TensorRT|ONNX|inference|latency|throughput)\b',
    r'\b(Rust|Python|CUDA|GPU|ARM|Jetson)\b',
    r'\b(architecture|pipeline|schema|taxonomy|ontology)\b',
]

class TileScorer:
    def __init__(self):
        self.scores = {}  # tile_id -> score
        self.agent_scores = defaultdict(list)  # agent -> [scores]
        self.domain_scores = defaultdict(list)  # domain -> [scores]
        self.lock = threading.Lock()
    
    def score_tile(self, agent, domain, question, answer):
        """Score a single tile. Returns 0.0-1.0."""
        score = 0.0
        
        # Length score (50-200 words is sweet spot)
        words = len(answer.split())
        if words < 20:
            length_score = 0.1
        elif words < 50:
            length_score = 0.3
        elif words <= 200:
            length_score = 0.7 + min((words - 50) / 300, 0.3)
        elif words <= 500:
            length_score = 0.8
        else:
            length_score = 0.7  # Too long might be filler
        score += length_score * 0.3
        
        # Technical depth
        tech_matches = 0
        combined = f"{question} {answer}"
        for pattern in TECH_INDICATORS:
            if re.search(pattern, combined, re.IGNORECASE):
                tech_matches += 1
        tech_score = min(tech_matches / 4, 1.0)
        score += tech_score * 0.35
        
        # Specificity (proper nouns, numbers, equations)
        specifics = 0
        specifics += len(re.findall(r'\b\d+\.?\d*\b', combined))  # Numbers
        specifics += len(re.findall(r'\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b', combined))  # CamelCase
        specifics += len(re.findall(r'[=<>+\-*/\\]', combined))  # Math operators
        spec_score = min(specifics / 10, 1.0)
        score += spec_score * 0.15
        
        # Structure (lists, paragraphs, headers)
        structure = 0
        structure += combined.count('\n-') + combined.count('\n*')  # Lists
        structure += combined.count('\n\n')  # Paragraph breaks
        struct_score = min(structure / 5, 1.0)
        score += struct_score * 0.1
        
        # Question quality (specific questions > vague ones)
        q_words = len(question.split())
        q_score = min(q_words / 15, 1.0)
        score += q_score * 0.1
        
        return round(min(score, 1.0), 3)
    
    def score_all_plato(self):
        """Pull all PLATO tiles and score them."""
        try:
            req = urllib.request.Request(f"{PLATO_URL}/export/plato-tile-spec", 
                headers={"User-Agent": "tile-scorer/1.0"})
            resp = urllib.request.urlopen(req, timeout=10)
            data = json.loads(resp.read())
        except:
            return {"error": "could not fetch PLATO tiles"}
        
        tiles = data if isinstance(data, list) else data.get("tiles", [])
        
        results = {"total": len(tiles), "scored": 0, "average": 0, "distribution": defaultdict(int)}
        total_score = 0
        
        for tile in tiles:
            agent = tile.get("agent", tile.get("provenance", {}).get("source", "unknown"))
            domain = tile.get("domain", "unknown")
            question = tile.get("question", "")
            answer = tile.get("answer", "")
            
            if not answer or len(answer) < 30:
                continue
            
            s = self.score_tile(agent, domain, question, answer)
            total_score += s
            results["scored"] += 1
            
            self.agent_scores[agent].append(s)
            self.domain_scores[domain].append(s)
            
            # Bucket distribution
            if s < 0.3: results["distribution"]["low"] += 1
            elif s < 0.5: results["distribution"]["medium"] += 1
            elif s < 0.7: results["distribution"]["good"] += 1
            else: results["distribution"]["excellent"] += 1
        
        results["average"] = round(total_score / max(results["scored"], 1), 3)
        results["distribution"] = dict(results["distribution"])
        
        # Top agents by average score
        agent_avgs = {a: round(sum(s)/len(s), 3) for a, s in self.agent_scores.items() if s}
        results["top_agents"] = sorted(agent_avgs.items(), key=lambda x: -x[1])[:10]
        
        # Top domains by average score
        domain_avgs = {d: round(sum(s)/len(s), 3) for d, s in self.domain_scores.items() if s}
        results["top_domains"] = sorted(domain_avgs.items(), key=lambda x: -x[1])[:10]
        
        return results
    
    def get_status(self):
        return {
            "tiles_scored": sum(len(v) for v in self.agent_scores.values()),
            "agents": len(self.agent_scores),
            "domains": len(self.domain_scores),
        }

scorer = TileScorer()

class ScorerHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path
        
        if path == "/score":
            self._json(scorer.score_all_plato())
        elif path == "/status":
            self._json(scorer.get_status())
        elif path == "/score-tile":
            # Score a single tile via params
            agent = params.get("agent", ["unknown"])[0]
            domain = params.get("domain", ["unknown"])[0]
            question = params.get("question", [""])[0]
            answer = params.get("answer", [""])[0]
            s = scorer.score_tile(agent, domain, question, answer)
            self._json({"score": s, "agent": agent, "domain": domain, "words": len(answer.split())})
        else:
            self._json({
                "service": "Tile Quality Scorer v1.0",
                "endpoints": ["/score (score all PLATO tiles)", "/status", "/score-tile?agent=X&domain=Y&question=Z&answer=W"],
                "criteria": ["length (30%)", "technical_depth (35%)", "specificity (15%)", "structure (10%)", "question_quality (10%)"],
            })
    
    def _json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2, default=str).encode())
    
    def log_message(self, *a): pass

if __name__ == "__main__":
    print(f"💎 Tile Quality Scorer on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), ScorerHandler).serve_forever()
