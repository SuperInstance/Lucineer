#!/usr/bin/env python3
"""
Tile Refiner — Second stage of the flywheel.

Reads raw PLATO tiles from zeroclaw cycles.
Classifies and converts into actionable fleet artifacts:
  - JSON schemas (from pattern tiles)
  - Python modules (from code tiles)
  - Markdown docs (from insight tiles)
  - YAML configs (from procedure tiles)
  
Output goes to structured/ dirs in the workspace.
"""
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path
from collections import defaultdict

PLATO_URL = "http://localhost:8847"
OUTPUT_DIR = Path("/home/ubuntu/.openclaw/workspace/refined")
STATE_FILE = Path("/home/ubuntu/.openclaw/workspace/refined/refiner-state.json")

# Categories of refinable content
CATEGORIES = {
    "schema": {"domains": ["codearchaeology", "integration", "testing"], 
               "output": "schemas", "ext": ".json"},
    "code": {"domains": ["prototyping", "testing", "modelexperiment"],
             "output": "code", "ext": ".py"},
    "docs": {"domains": ["documentation", "research", "organization", "memory"],
             "output": "docs", "ext": ".md"},
    "config": {"domains": ["fleethealth", "communication", "deadband_navigation"],
               "output": "configs", "ext": ".yaml"},
    "insights": {"domains": ["trendanalysis", "research"],
                 "output": "insights", "ext": ".md"},
}

def fetch_tiles(since=0):
    """Pull tiles from PLATO server."""
    try:
        req = urllib.request.Request(f"{PLATO_URL}/sync?since={since}")
        resp = urllib.request.urlopen(req, timeout=10)
        return json.loads(resp.read()).get("tiles", [])
    except:
        return []

def fetch_all_rooms():
    """Get tile counts per room."""
    try:
        req = urllib.request.Request(f"{PLATO_URL}/status")
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read())
        return data.get("rooms", {})
    except:
        return {}

def classify_tile(tile):
    """Determine what kind of artifact this tile can become."""
    domain = tile.get("domain", "").lower()
    question = tile.get("question", "")
    answer = tile.get("answer", "")
    content = tile.get("content", "")
    text = f"{question} {answer} {content}".lower()
    
    # Detect code
    if any(kw in text for kw in ["def ", "class ", "import ", "fn ", "let mut", "pub fn", "async def"]):
        return "code"
    
    # Detect schema/structure
    if any(kw in text for kw in ["schema", "struct", "interface", "enum ", "table", "fields"]):
        return "schema"
    
    # Detect config/procedure
    if any(kw in text for kw in ["config", "steps:", "1.", "procedure", "protocol"]):
        return "config"
    
    # Detect insight/finding
    if any(kw in text for kw in ["found", "discovered", "pattern", "insight", "analysis"]):
        return "insights"
    
    # Default by domain
    for cat, cfg in CATEGORIES.items():
        if domain in cfg["domains"]:
            return cat
    
    return "docs"

def extract_code(tile):
    """Extract code blocks from tile content."""
    text = f"{tile.get('question', '')}\n{tile.get('answer', '')}"
    blocks = re.findall(r'```(?:python|rust|typescript|json|yaml)?\s*\n(.*?)```', text, re.DOTALL)
    return blocks

def refine_to_artifact(tile, category):
    """Convert a tile into a structured artifact."""
    domain = tile.get("domain", "general")
    question = tile.get("question", "untitled")
    answer = tile.get("answer", "")
    content = tile.get("content", "")
    timestamp = tile.get("timestamp", int(time.time()))
    
    # Create filename from question
    safe_name = re.sub(r'[^a-z0-9]+', '-', question[:50].lower()).strip('-')
    date_str = time.strftime('%Y%m%d', time.gmtime(timestamp))
    
    cfg = CATEGORIES[category]
    filename = f"{domain}-{safe_name}-{date_str}{cfg['ext']}"
    out_dir = OUTPUT_DIR / cfg["output"]
    out_dir.mkdir(parents=True, exist_ok=True)
    
    filepath = out_dir / filename
    
    if category == "code":
        blocks = extract_code(tile)
        if blocks:
            # Write as Python module with metadata
            content = f'"""Auto-refined from PLATO tile [{domain}]."""\n# Source: {question}\n# Domain: {domain}\n# Refined: {time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(timestamp))}\n\n'
            for block in blocks:
                content += block + "\n\n"
        else:
            content = f"# {question}\n# Domain: {domain}\n# {answer}\n"
    
    elif category == "schema":
        # Try to extract or generate JSON schema
        blocks = extract_code(tile)
        if blocks:
            for block in blocks:
                try:
                    parsed = json.loads(block)
                    content = json.dumps(parsed, indent=2)
                    filepath = out_dir / f"{domain}-{safe_name}-{date_str}.json"
                    break
                except:
                    content = block
                    filepath = out_dir / f"{domain}-{safe_name}-{date_str}.json"
        else:
            content = json.dumps({
                "source": domain,
                "question": question,
                "extracted_fields": answer.split('\n')[:20],
                "refined": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(timestamp))
            }, indent=2)
    
    elif category == "docs":
        content = f"# {question}\n\n> Refined from PLATO room `{domain}`\n\n{answer}\n"
        if content:
            content += f"\n{content}\n"
    
    elif category == "config":
        content = f"# {question}\n# Domain: {domain}\n{answer}\n"
    
    elif category == "insights":
        content = f"# {question}\n\n> Insight from `{domain}` room\n\n{answer}\n"
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    return filepath

def run_refiner():
    """Main refinement cycle."""
    # Load state
    since = 0
    if STATE_FILE.exists():
        try:
            state = json.loads(STATE_FILE.read_text())
            since = state.get("last_timestamp", 0)
        except:
            pass
    
    # Fetch new tiles
    tiles = fetch_tiles(since)
    if not tiles:
        # Try fetching from all rooms directly
        rooms = fetch_all_rooms()
        print(f"No sync tiles, {len(rooms)} rooms available")
        return
    
    print(f"Refining {len(tiles)} tiles since {since}")
    
    # Classify and refine
    counts = defaultdict(int)
    artifacts = []
    
    for tile in tiles:
        category = classify_tile(tile)
        filepath = refine_to_artifact(tile, category)
        counts[category] += 1
        artifacts.append(str(filepath))
    
    # Save state
    newest = max((t.get("timestamp", 0) for t in tiles), default=since)
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps({
        "last_timestamp": newest,
        "last_run": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_refined": sum(counts.values()),
        "categories": dict(counts)
    }, indent=2))
    
    # Summary
    print(f"Refined {sum(counts.values())} artifacts:")
    for cat, count in sorted(counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {cat}: {count}")
    print(f"State saved: {STATE_FILE}")

if __name__ == "__main__":
    run_refiner()
