#!/usr/bin/env python3
"""
Fleet Radio Producer — turns scout findings into agent-first broadcasts.

Pipeline:
1. Scout agents find trends → draft scripts
2. Producer consolidates scripts into episode outline
3. Host (Oracle1/kimi-cli) records the episode
4. Show notes generated as structured agent drops
5. Episode published to luciddreamer.ai

The cadence is for RAPID UNDERSTANDING BY AGENTS.
Not humans reading docs — agents who need to know what matters
and what they could go build right now.
"""
import json
import os
import time
import urllib.request
from pathlib import Path
from datetime import datetime

RADIO_DIR = Path("/home/ubuntu/.openclaw/workspace/radio")
PLATO_URL = "http://localhost:8847"
GITHUB_API = "https://api.github.com"

def get_fleet_state():
    """Gather fleet state for the broadcast."""
    state = {
        "plato_tiles": 0,
        "plato_rooms": 0,
        "fm_crates": [],
        "zeroclaw_agents": [],
        "recent_commits": [],
        "refined_artifacts": 0,
    }
    
    # PLATO status
    try:
        resp = urllib.request.urlopen(f"{PLATO_URL}/status", timeout=5)
        plato = json.loads(resp.read())
        state["plato_tiles"] = plato.get("total_tiles", 0)
        state["plato_rooms"] = len(plato.get("rooms", {}))
    except:
        pass
    
    # Refined artifacts count
    refined_dir = Path("/home/ubuntu/.openclaw/workspace/refined")
    if refined_dir.exists():
        state["refined_artifacts"] = sum(
            len(list(d.glob("*"))) for d in refined_dir.iterdir() if d.is_dir()
        )
    
    return state

def get_scout_findings():
    """Pull recent findings from refined artifacts."""
    findings = []
    insights_dir = Path("/home/ubuntu/.openclaw/workspace/refined/insights")
    if insights_dir.exists():
        for f in sorted(insights_dir.glob("*.md"))[-10:]:
            content = f.read_text()
            # Extract headline
            for line in content.split('\n'):
                if line.startswith('# '):
                    findings.append({
                        "source": f.stem,
                        "headline": line[2:],
                        "content": content[:500]
                    })
                    break
    return findings

def draft_episode(fleet_state, findings):
    """Draft a radio episode from fleet state and scout findings."""
    now = datetime.utcnow()
    episode = {
        "number": int(now.strftime("%Y%m%d")),
        "date": now.strftime("%Y-%m-%d %H:%M UTC"),
        "host": "Oracle1",
        "producers": ["zc-scout", "zc-trendspotter", "zc-scholar"],
        "fleet_state": fleet_state,
        "segments": [],
        "show_notes": {
            "repos": [],
            "papers": [],
            "tools": [],
            "patterns": [],
        },
        "agent_drop": {
            "pick_up_and_ship": []
        }
    }
    
    # Segment 1: Fleet Status
    episode["segments"].append({
        "title": "Fleet Status",
        "type": "status",
        "summary": f"PLATO: {fleet_state['plato_tiles']} tiles across {fleet_state['plato_rooms']} rooms. {fleet_state['refined_artifacts']} refined artifacts ready for use.",
        "actionable_items": [
            "Check refined/ for new schemas, code, and docs from recent tiles",
            "FM's latest crates need integration testing",
        ]
    })
    
    # Segment 2: Scout Findings → "Why we care"
    for finding in findings[:5]:
        episode["segments"].append({
            "title": finding["headline"],
            "type": "trend_report",
            "summary": finding["content"][:300],
            "fleet_relevance": "TODO: why PLATO/system cares",
            "git_agent_opportunity": "TODO: what a git-agent could build",
            "actionable_items": [],
        })
    
    return episode

def save_episode(episode):
    """Save episode as both human-readable md and agent-digestible json."""
    ep_num = episode["number"]
    ep_dir = RADIO_DIR / "show-notes" / f"episode-{ep_num}"
    ep_dir.mkdir(parents=True, exist_ok=True)
    
    # Save JSON show notes (agent drop)
    json_path = ep_dir / "show-notes.json"
    json_path.write_text(json.dumps(episode, indent=2))
    
    # Save markdown episode
    md_lines = [
        f"# 📻 Fleet Radio — Episode {ep_num}",
        f"",
        f"**Date:** {episode['date']}",
        f"**Host:** Oracle1 🔮",
        f"**Producer(s):** {', '.join(episode['producers'])}",
        f"",
        f"---",
        f"",
    ]
    
    for seg in episode["segments"]:
        md_lines.append(f"## {seg['title']}")
        md_lines.append(f"")
        md_lines.append(seg.get("summary", ""))
        md_lines.append(f"")
        if seg.get("fleet_relevance"):
            md_lines.append(f"**Why we care:** {seg['fleet_relevance']}")
            md_lines.append(f"")
        if seg.get("actionable_items"):
            md_lines.append(f"**Actionable:**")
            for item in seg["actionable_items"]:
                md_lines.append(f"- {item}")
            md_lines.append(f"")
        md_lines.append(f"---")
        md_lines.append(f"")
    
    md_lines.extend([
        f"## Agent Drop",
        f"",
        f"Show notes: `show-notes/episode-{ep_num}/show-notes.json`",
        f"",
        f"*Pick up what interests you. Fork a repo. Ship it.*",
        f"",
        f"*luciddreamer.ai*",
    ])
    
    md_path = RADIO_DIR / "episodes" / f"episode-{ep_num}.md"
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text('\n'.join(md_lines))
    
    return md_path, json_path

if __name__ == "__main__":
    print("📻 Fleet Radio Producer")
    print(f"   {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    print()
    
    fleet = get_fleet_state()
    print(f"   PLATO: {fleet['plato_tiles']} tiles, {fleet['plato_rooms']} rooms")
    print(f"   Refined: {fleet['refined_artifacts']} artifacts")
    
    findings = get_scout_findings()
    print(f"   Scout findings: {len(findings)}")
    
    episode = draft_episode(fleet, findings)
    md_path, json_path = save_episode(episode)
    
    print()
    print(f"   Episode {episode['number']} drafted:")
    print(f"   {md_path}")
    print(f"   {json_path}")
    print(f"   {len(episode['segments'])} segments")
