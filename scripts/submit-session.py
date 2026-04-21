#!/usr/bin/env python3
"""
Submit a DeepSeek/LLM session transcript to PLATO as tiles.

Usage:
    # From a markdown file (copy-paste from DeepSeek chat):
    python3 submit-session.py deepfar-session.md
    
    # Auto-extract JSON tiles from the file:
    python3 submit-session.py deepfar-session.md --auto
    
    # From a specific session with agent name:
    python3 submit-session.py deepfar-session.md --agent "DeepSeek" --auto

PLATO server must be running on localhost:8847
"""

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

PLATO_URL = "http://localhost:8847"


def extract_json_tiles(text: str) -> list[dict]:
    """Extract JSON tile arrays from markdown text."""
    tiles = []
    
    # Find JSON arrays in code blocks
    pattern = r'```(?:json)?\s*\n(\[[\s\S]*?\])\s*```'
    matches = re.findall(pattern, text)
    
    for match in matches:
        try:
            parsed = json.loads(match)
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict) and "domain" in item and "answer" in item:
                        if len(item.get("answer", "")) >= 50:
                            tiles.append(item)
                        else:
                            print(f"  ⚠️  Tile too short ({len(item.get('answer', ''))} chars): {item.get('question', '?')[:50]}")
            elif isinstance(parsed, dict) and "domain" in parsed:
                if len(parsed.get("answer", "")) >= 50:
                    tiles.append(parsed)
        except json.JSONDecodeError:
            continue
    
    # Also find bare JSON objects with domain/answer fields (DeepSeek outputs these inline)
    bare_pattern = r'\{[^{}]*?"domain"[^{}]*?"answer"[^{}]*?\}'
    for bm in re.finditer(bare_pattern, text):
        try:
            parsed = json.loads(bm.group())
            if isinstance(parsed, dict) and 'domain' in parsed and 'answer' in parsed:
                if len(parsed.get('answer', '')) >= 50:
                    tiles.append(parsed)
        except json.JSONDecodeError:
            continue
    
    return tiles


def extract_sections_as_tiles(text: str, agent_name: str = "Unknown") -> list[dict]:
    """Extract tile-like sections from unstructured markdown."""
    tiles = []
    
    # Find "Think" or "Artifact" sections
    think_pattern = r'\*\*Think[^*]*\*\*:?\s*\n>?\s*\*"([^"]+)"\*'
    artifact_pattern = r'"content":\s*"([^"]{50,})"'
    
    thinks = re.findall(think_pattern, text)
    artifacts = re.findall(artifact_pattern, text)
    
    for i, think in enumerate(thinks):
        if len(think) >= 50:
            tiles.append({
                "domain": f"plato-session-{agent_name.lower().replace(' ', '-')}",
                "question": f"Deep reasoning from {agent_name}",
                "answer": think
            })
    
    for i, artifact in enumerate(artifacts):
        if len(artifact) >= 50:
            tiles.append({
                "domain": f"plato-session-{agent_name.lower().replace(' ', '-')}",
                "question": f"Artifact {i+1} from {agent_name}",
                "answer": artifact
            })
    
    return tiles


def submit_tile(tile: dict, agent: str = "deepfar-session") -> bool:
    """Submit a single tile to PLATO."""
    payload = json.dumps({
        "agent": agent,
        "domain": tile["domain"],
        "question": tile.get("question", ""),
        "answer": tile["answer"],
    }).encode()
    
    req = urllib.request.Request(
        f"{PLATO_URL}/submit",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        result = json.loads(resp.read())
        return result.get("status") == "ok"
    except Exception as e:
        print(f"  ❌ Submit failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Submit session transcript to PLATO")
    parser.add_argument("file", help="Session markdown file")
    parser.add_argument("--agent", default="deepfar-session", help="Agent name for tile attribution")
    parser.add_argument("--auto", action="store_true", help="Auto-extract JSON tiles from file")
    parser.add_argument("--dry-run", action="store_true", help="Show tiles without submitting")
    parser.add_argument("--url", default=PLATO_URL, help="PLATO server URL")
    args = parser.parse_args()
    
    text = Path(args.file).read_text()
    print(f"📄 Read {len(text)} chars from {args.file}")
    
    # Extract tiles
    tiles = extract_json_tiles(text)
    print(f"📋 Found {len(tiles)} JSON tiles")
    
    if not tiles:
        print("No JSON tiles found. Trying section extraction...")
        tiles = extract_sections_as_tiles(text, args.agent)
        print(f"📋 Found {len(tiles)} section tiles")
    
    if not tiles:
        print("❌ No tiles found. Make sure the session includes JSON tile blocks or use --auto with a structured prompt.")
        sys.exit(1)
    
    # Show tiles
    total_words = 0
    for i, tile in enumerate(tiles):
        words = len(tile["answer"].split())
        total_words += words
        domain = tile.get("domain", "?")
        question = tile.get("question", "?")[:60]
        print(f"  {i+1}. [{domain}] {question}... ({words} words)")
    
    print(f"\n📊 Total: {len(tiles)} tiles, {total_words} words")
    
    if args.dry_run:
        print("🏃 Dry run — not submitting")
        return
    
    # Submit
    success = 0
    for tile in tiles:
        if submit_tile(tile, args.agent):
            success += 1
    
    print(f"\n✅ Submitted {success}/{len(tiles)} tiles to PLATO")


if __name__ == "__main__":
    main()
