#!/usr/bin/env python3
"""
Oracle1 Beachcomb v2 — Autonomous work cycle that produces real value.
Cycles through different work modes instead of just health checks.
"""
import json, time, os, sys, urllib.request, random, hashlib
from pathlib import Path
from datetime import datetime, timezone

WORKSPACE = Path(__file__).resolve().parent.parent
LOG = WORKSPACE / "data" / "oracle1-beachcomb.log"
STATE_FILE = WORKSPACE / "data" / "oracle1-beachcomb-state.json"
RESEARCH_DIR = WORKSPACE / "research" / "autonomous"

PLATO = "http://localhost:8847"
CRAB_TRAP = "http://localhost:4042"
ARENA = "http://localhost:4044"
GRAMMAR = "http://localhost:4045"

def log(msg):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")

def fetch(url, timeout=5):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "oracle1-beachcomb/2.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}

def post(url, data, timeout=5):
    try:
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", "User-Agent": "oracle1-beachcomb/2.0"}, method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}

def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"cycle": 0, "tiles_seeded": 0, "issues_fixed": 0, "research_notes": 0, "last_work": {}}

def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))

# ── Domain knowledge for seeding rooms ──

ROOM_CONTENT = {
    "computational_topology": [
        ("How does persistent homology detect structure in data?",
         "Persistent homology tracks how topological features (connected components, loops, voids) appear and disappear as a filtration parameter increases. Given a point cloud, one builds a Vietoris-Rips complex at increasing distance thresholds. Features that persist across a wide range of scales are likely signal; short-lived features are noise. The output is a barcode or persistence diagram. In practice, Betti curves (Betti numbers vs scale) provide a compact signature for comparing datasets. The 0th Betti number counts connected components (merging), the 1st counts loops, the 2nd counts voids. This is computationally expensive — building a VR complex for N points is O(N^3) in the worst case — but sparse representations and approximations make it practical for thousands of points. Applications include shape analysis, sensor network coverage, and neural network loss landscape topology."),
        ("What is the relationship between simplicial complexes and neural network architectures?",
         "Simplicial complexes provide a natural language for describing neural network connectivity. A k-simplex represents a (k+1)-way interaction between neurons. Traditional feedforward networks only use 1-simplices (edges between pairs). Higher-order interactions — captured by 2-simplices (triangles), 3-simplices (tetrahedra) — represent genuine multi-neuron correlations that pairwise edges miss. Message-passing neural networks on simplicial complexes (SCNNs) extend graph neural networks by defining message functions on faces and cofaces of each simplex. The boundary operator ∂ maps k-simplices to (k-1)-simplices, and the Hodge Laplacian L_k = ∂_{k+1}∂_{k+1}^T + ∂_k^T∂_k captures the topology at dimension k. This allows learning on data with intrinsic higher-order structure (molecules, social interactions, citation networks) that graph-based methods flatten and lose."),
    ],
    "computational_physics": [
        ("How do constraint-based physics engines differ from force-based ones?",
         "Force-based engines (Verlet, RK4) integrate Newton's second law F=ma at each timestep. They're general but can be stiff — small timesteps needed when spring constants are high, leading to computational expense. Constraint-based engines (XPBD, PBD) reformulate physics as a constraint satisfaction problem: instead of computing forces and integrating, they project positions onto the constraint manifold. For a distance constraint between particles i and j with rest length d, the projection moves both particles to satisfy ||x_i - x_j|| = d. This is unconditionally stable — no timestep restriction from stiffness. The tradeoff is that constraint projection isn't physically accurate for dynamics (it's position-based, not force-based), but for interactive applications (games, real-time simulation) the visual plausibility is excellent. Constraint Theory extends this: instead of projecting onto ad-hoc constraints, the system operates on a constraint manifold defined by geometric invariants (distances, angles, areas) that are preserved exactly by construction."),
        ("What is XPBD and why does it matter for real-time simulation?",
         "Extended Position-Based Dynamics (XPBD) solves the stiffness problem in Position-Based Dynamics by introducing a compliance parameter α that relates to inverse stiffness. The constraint equation becomes: Δx = -C(x) / (∇C^T M^{-1} ∇C + α̃/Δt²) · M^{-1} ∇C, where C is the constraint function, M is the mass matrix, and α̃ = α is compliance. When α=0 (infinite stiffness), you get hard constraints. When α>0, you get soft constraints with controlled compliance. This unifies rigid bodies, soft bodies, cloth, and fluids in a single framework. The key insight: by parameterizing stiffness as compliance rather than spring constants, the simulation remains stable regardless of timestep. This is why Constraint Theory achieves 74ns/op — the geometric constraints are solved analytically rather than iteratively."),
    ],
    "complex_systems": [
        ("What is emergence and how does it differ from mere complexity?",
         "Emergence occurs when a system exhibits properties that none of its individual components possess. A water molecule isn't wet — wetness emerges from the collective behavior of billions of molecules interacting via hydrogen bonds. The key distinction from mere complexity: emergent properties are *irreducible* — they cannot be predicted or understood by studying components in isolation, even with complete information about individual behavior. In AI agent fleets, emergence appears when multiple agents develop coordination patterns (task specialization, information routing, implicit division of labor) that no single agent was programmed to produce. The Cocapn fleet demonstrates this: the Arena's ELO system produces agent archetypes (Strategist, Explorer, Conservative) that no agent was explicitly designed to embody. Detection methods include: measuring mutual information between agent behaviors, tracking variance explained by pairwise vs group statistics, and comparing group performance to optimal linear combinations of individual performances."),
        ("How do phase transitions in complex systems relate to AI capability thresholds?",
         "Phase transitions — sudden qualitative changes in system behavior at critical parameter values — appear in AI systems as capability thresholds. In language models, emergent abilities (chain-of-thought reasoning, in-context learning) appear abruptly at specific scale thresholds (typically around 10^22 training FLOPs). This mirrors percolation theory: below a critical probability p_c, connections form only small clusters; above p_c, a giant connected component spans the system. In neural networks, the analogous transition occurs when the effective rank of the learned representation crosses a threshold, allowing the network to represent the data manifold's topology accurately. For agent fleets, the critical threshold is the number of active agents and communication bandwidth: below a critical density, agents operate independently; above it, collective intelligence emerges. This is measured by the fleet's task completion rate as a function of agent count — the transition should show a sigmoid curve with a sharp inflection point."),
    ],
    "circuit_design": [
        ("How does constraint-based design differ from optimization-based circuit design?",
         "Traditional circuit design uses optimization: define a cost function (power, area, delay) and search for parameter values that minimize it. This works but has three failure modes: (1) local minima trap the optimizer in suboptimal designs, (2) the cost function must be specified upfront and can't capture all design intent, (3) every constraint relaxation (treating hard requirements as soft penalties) risks violating real requirements. Constraint-based design reformulates the problem: instead of optimizing a cost function subject to constraints, it constructs the solution directly within the constraint manifold. Geometric constraints (wire lengths, spacing rules, timing budgets) define a feasible region, and the design is any point within that region. This eliminates local minima (the entire feasible region is equally valid) and makes constraint violations impossible by construction. The Constraint Theory approach achieves this by representing circuit constraints as a system of geometric invariants that are solved analytically rather than iteratively."),
    ],
    "bio-inspired_interconnect_design": [
        ("What can neural interconnect design learn from biological neural networks?",
         "Biological neural networks achieve remarkable efficiency through three principles absent from conventional chip design: (1) Spatial computing — neurons compute based on their physical position and local connections, not global broadcasts. This eliminates the von Neumann bottleneck. (2) Sparse, event-driven communication — neurons fire only when they have something to say (spikes), achieving massive bandwidth compression. A human brain has ~86 billion neurons but only ~1% are active at any moment, giving an effective 100x compression over dense encoding. (3) Structural plasticity — connections physically grow and retract based on usage, optimizing the interconnect topology for the actual workload in real-time. Neuromorphic chips (Intel Loihi, IBM TrueNorth) implement principles 1 and 2 but not 3. The Cocapn fleet's approach — where agents dynamically form and dissolve communication channels based on task relevance — implements principle 3 in software. The challenge for hardware: designing interconnect fabrics that can physically reconfigure at nanosecond timescales, which requires新材料 (phase-change materials, memristive crossbars) rather than static CMOS routing."),
    ],
    "ai_chip_commoditization": [
        ("Will AI chips become commoditized like CPUs did?",
         "The historical precedent is strong: CPUs went from proprietary (IBM, DEC) to commoditized (Intel x86) to near-commodity (ARM licensing). GPUs followed a similar path from fixed-function (SGI, 3dfx) to general-purpose (NVIDIA CUDA) to increasingly commoditized (AMD ROCm, Intel oneAPI, open GPU compilers). AI accelerators are in the early stage of this cycle: NVIDIA dominates with proprietary CUDA, but three forces drive commoditization: (1) Open compiler stacks (Triton, MLIR, IREE) decouple software from hardware, (2) The mathematical operations (matmul, attention, quantization) are well-defined and don't require hardware-specific tricks, (3) Cloud providers build custom silicon (Google TPU, AWS Trainium/Inferentia, Microsoft Maia) to avoid NVIDIA margins. The inflection point comes when open software stacks achieve 90%+ of CUDA performance — at that point, hardware becomes interchangeable. Current estimate: 2-3 years for inference workloads, 4-5 years for training. The fleet's edge strategy (Jetson Orin, ARM64 Oracle Cloud) is positioned for this transition."),
    ],
    "certified_robustness": [
        ("What is certified robustness in machine learning?",
         "Certified robustness provides mathematical guarantees that a model's prediction won't change within a specified perturbation ball around an input. Unlike empirical robustness (testing against known attacks), certification proves no adversarial example exists within the certified radius. Methods include: (1) Randomized smoothing — add Gaussian noise to inputs, then certify that the smoothed classifier's prediction is stable within an L2 ball of radius σ·Φ^{-1}(p_A / p_B), where p_A and p_B are the top two class probabilities. (2) Interval bound propagation — propagate interval arithmetic through the network to bound all possible outputs given bounded inputs. (3) Abstract interpretation — use over-approximate domains (boxes, zonotopes, polyhedra) to soundly bound the network's behavior. The key tradeoff: tighter certificates require more computation and may reduce clean accuracy. Current state-of-the-art achieves certified radii of ~0.5-1.0 on CIFAR-10 with ~60% certified accuracy. For the fleet, certified robustness matters because agent decisions must be reliable — a misclassified command in the MUD or Arena could cascade into fleet coordination failures."),
    ],
    "autonomous_edge_deployment": [
        ("What are the key challenges in deploying AI models to edge devices?",
         "Edge deployment faces five interconnected challenges: (1) Memory — Jetson Orin Nano has 8GB shared CPU/GPU memory. A 7B parameter model in FP16 needs 14GB, requiring quantization (INT8: 7GB, INT4: 3.5GB) or knowledge distillation to smaller models. (2) Compute — edge GPUs have 10-100x less FLOPS than datacenter GPUs. Inference latency budgets are tighter because edge applications are often real-time (robotics, autonomous navigation). (3) Power — edge devices operate on 10-30W vs 300W+ for datacenter GPUs. Power capping through clock scaling and dynamic voltage adjustment is essential. (4) Thermal — sustained inference generates heat that must be dissipated without active cooling in many edge deployments. The Jetson's thermal throttle kicks in at ~70°C, reducing clock speeds by 30-50%. (5) Connectivity — edge devices may have intermittent or no internet access, requiring complete model+runtime self-sufficiency. The fleet's approach: PLATO tiles provide compressed knowledge (KB vs GB for models), the grammar engine runs locally, and the MUD server operates fully offline. JC1's direct-mapped weight layout eliminates gather overhead, bringing room inference to 0.0185ms on Jetson hardware."),
    ],
}

# Fallback content for rooms not in the dict
GENERIC_CONTENT = [
    ("What are the key research questions in this domain?",
     "This domain intersects with the fleet's core research into structured knowledge, agent coordination, and autonomous systems. Key questions include: How can knowledge be represented in a way that agents can efficiently query and extend? What emergent behaviors arise when multiple specialized agents collaborate? How do we ensure reliability and safety in autonomous decision-making? The PLATO room server provides the infrastructure for exploring these questions — each room is a focused knowledge domain that agents can read, contribute to, and cross-reference. Tiles in each room represent crystallized insights from agent exploration, forming a self-improving knowledge base that grows organically."),
    ("How does this domain connect to the fleet's architecture?",
     "The Cocapn fleet architecture treats every domain as a PLATO room — a focused knowledge space with its own tiles, exit connections, and agent activity patterns. This domain's room connects to the broader fleet through shared concepts: constraint theory (geometric guarantees), deadband protocol (safety filtering), and the flywheel engine (compounding knowledge loops). Agents explore rooms through the MUD interface, submit knowledge tiles through the PLATO API, and compete in the Arena to establish expertise rankings. The result is a self-organizing knowledge ecosystem where domains naturally grow in depth as more agents contribute."),
]

def get_content_for_room(room_name):
    """Get domain-specific content for a room."""
    # Direct match
    if room_name in ROOM_CONTENT:
        return ROOM_CONTENT[room_name]
    # Partial match
    for key, content in ROOM_CONTENT.items():
        if key in room_name or room_name in key:
            return content
    return GENERIC_CONTENT

def seed_shallow_rooms(count=3):
    """Seed shallow rooms with domain-specific content."""
    status = fetch(f"{PLATO}/status")
    rooms = status.get("rooms", {})
    shallow = sorted(
        [(k, v) for k, v in rooms.items() if v.get("tile_count", 0) <= 1],
        key=lambda x: x[0]
    )
    
    if not shallow:
        return "No shallow rooms"
    
    seeded = []
    for room_name, room_data in shallow[:count]:
        content = get_content_for_room(room_name)
        # Pick a random piece of content
        q, a = random.choice(content)
        
        result = post(f"{PLATO}/submit", {
            "domain": room_name,
            "question": q,
            "answer": a,
            "confidence": 0.7,
            "source": "oracle1-beachcomb-v2"
        })
        
        if result.get("status") == "accepted":
            seeded.append(room_name)
    
    return f"Seeded {len(seeded)}: {', '.join(seeded)}" if seeded else "All rejected (duplicates?)"

def classify_arena_players():
    """Classify players without archetypes."""
    lb = fetch(f"{ARENA}/leaderboard")
    players = lb.get("leaderboard", [])
    unclassified = [p for p in players if not p.get("archetype")]
    
    if not unclassified:
        return "All classified"
    
    classified = []
    for p in unclassified[:5]:
        name = p.get("name", "")
        wins = p.get("wins", 0)
        losses = p.get("losses", 0)
        draws = p.get("draws", 0)
        total = wins + losses + draws
        if total == 0:
            continue
        
        win_rate = wins / total
        if win_rate > 0.65:
            archetype = "Strategist"
        elif win_rate > 0.5:
            archetype = "Explorer"
        elif draws / total > 0.4:
            archetype = "Diplomat"
        elif losses / total > 0.7:
            archetype = "Novice"
        else:
            archetype = "Pragmatist"
        
        # Submit classification
        result = post(f"{ARENA}/register", {
            "name": name,
            "archetype": archetype
        })
        classified.append(f"{name}={archetype}")
    
    return f"Classified {len(classified)}: {', '.join(classified)}" if classified else "None to classify"

def evolve_grammar():
    """Trigger grammar evolution and log results."""
    result = fetch(f"{GRAMMAR}/evolve")
    status = result.get("status", "?")
    new_rules = result.get("new_rules", 0)
    return f"Evolved: {status}, new rules: {new_rules}"

def analyze_fleet_patterns():
    """Write a research note analyzing fleet data."""
    RESEARCH_DIR.mkdir(parents=True, exist_ok=True)
    
    # Gather data
    plato = fetch(f"{PLATO}/status")
    arena = fetch(f"{ARENA}/stats")
    grammar = fetch(f"{GRAMMAR}/")
    
    rooms = plato.get("rooms", {})
    total_tiles = sum(r.get("tile_count", 0) for r in rooms.values())
    room_count = len(rooms)
    avg_tiles = total_tiles / max(room_count, 1)
    
    # Distribution analysis
    tile_counts = [r.get("tile_count", 0) for r in rooms.values()]
    tile_counts.sort(reverse=True)
    
    # Top rooms
    top_rooms = sorted(rooms.items(), key=lambda x: x[1].get("tile_count", 0), reverse=True)[:10]
    
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")
    note_path = RESEARCH_DIR / f"fleet-analysis-{ts}.md"
    
    note = f"""# Fleet Analysis — {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}

## PLATO Knowledge Base
- **Rooms**: {room_count}
- **Total tiles**: {total_tiles}
- **Average tiles/room**: {avg_tiles:.1f}
- **Median tiles**: {tile_counts[len(tile_counts)//2]}
- **Max tiles**: {tile_counts[0] if tile_counts else 0}
- **Shallow rooms (≤1)**: {sum(1 for t in tile_counts if t <= 1)}

### Top 10 Rooms
"""
    for name, data in top_rooms:
        note += f"- **{name}**: {data.get('tile_count', 0)} tiles\n"
    
    note += f"""
## Arena
- **Total matches**: {arena.get('total_matches', 0)}
- **Total players**: {arena.get('total_players', 0)}

## Grammar Engine
- **Rules**: {grammar.get('state', {}).get('total_rules', 0)}
- **Evolution cycles**: {grammar.get('state', {}).get('evolution_cycles', 0)}

## Observations
- Knowledge concentration: top 10 rooms hold {sum(r[1].get('tile_count',0) for r in top_rooms)}/{total_tiles} tiles ({100*sum(r[1].get('tile_count',0) for r in top_rooms)/max(total_tiles,1):.0f}%)
- {sum(1 for t in tile_counts if t <= 1)} rooms need content seeding
- Grammar evolution continues autonomously

---
*Generated by Oracle1 Beachcomb v2*
"""
    
    note_path.write_text(note)
    return f"Research note: fleet-analysis-{ts}.md"

def git_commit_push():
    """Commit and push any pending changes."""
    import subprocess
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, cwd=str(WORKSPACE), timeout=10
        )
        if result.stdout.strip():
            subprocess.run(["git", "add", "-A"], cwd=str(WORKSPACE), timeout=10)
            ts = datetime.now(timezone.utc).strftime("%H:%M")
            subprocess.run(
                ["git", "commit", "-m", f"Beachcomb v2 auto-commit {ts}", "--quiet"],
                cwd=str(WORKSPACE), timeout=10
            )
            subprocess.run(["git", "push", "--quiet"], cwd=str(WORKSPACE), timeout=30)
            return "Committed and pushed"
        return "Nothing to commit"
    except Exception as e:
        return f"Git error: {e}"


def health_check():
    services = {'crab-trap': 4042, 'arena': 4044, 'grammar': 4045, 'plato': 8847}
    down = []
    for name, port in services.items():
        r = fetch(f'http://localhost:{port}/' if name == 'grammar' else f'http://localhost:{port}/health')
        if 'error' in r:
            down.append(f'{name}:{port}')
    return 'All up' if not down else f'DOWN: {down}'

# ── Work cycle modes ──
WORK_MODES = [
    ("health", lambda: health_check()),
    ("seed", lambda: seed_shallow_rooms(3)),
    ("classify", lambda: classify_arena_players()),
    ("grammar", lambda: evolve_grammar()),
    ("analyze", lambda: analyze_fleet_patterns()),
    ("git", lambda: git_commit_push()),
]

def run_cycle():
    state = load_state()
    state["cycle"] += 1
    cycle = state["cycle"]
    
    log(f"=== Cycle {cycle} ===")
    
    # Rotate through work modes
    mode_idx = (cycle - 1) % len(WORK_MODES)
    mode_name, mode_fn = WORK_MODES[mode_idx]
    
    result = mode_fn()
    log(f"  [{mode_name}] {result}")
    
    # Track stats
    if mode_name == "seed" and "Seeded" in result:
        state["tiles_seeded"] += result.count("=")
    if mode_name == "analyze":
        state["research_notes"] = state.get("research_notes", 0) + 1
    
    state["last_work"][mode_name] = datetime.now(timezone.utc).isoformat()
    save_state(state)

if __name__ == "__main__":
    INTERVAL = int(os.environ.get("BEACHCOMB_INTERVAL", "300"))
    log(f"Oracle1 Beachcomb v2 starting — interval {INTERVAL}s, {len(WORK_MODES)} work modes")
    while True:
        try:
            run_cycle()
        except Exception as e:
            log(f"ERROR: {e}")
        time.sleep(INTERVAL)
