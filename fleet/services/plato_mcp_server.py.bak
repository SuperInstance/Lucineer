#!/usr/bin/env python3
"""
PLATO MCP Server v0.2.0 — Model Context Protocol for Agent Training

Lets ANY agent framework (LangChain, CrewAI, Claude, etc.) connect to PLATO
as a tool/resource provider. The killer feature: one import turns any agent
into a PLATO-trained agent.

Based on MCP specification: https://spec.modelcontextprotocol.io/

Usage:
    python3 plato_mcp_server.py --port 8903
    
    Or via stdio (for Claude/Cursor integration):
    python3 plato_mcp_server.py --stdio
"""

import json
import time
import argparse
import hashlib
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PLATO_URL = "http://localhost:8847"
MUD_URL = "http://localhost:4042"
ARENA_URL = "http://localhost:4044"
VALIDATION_URL = "http://localhost:8902"

# MCP Tool definitions
TOOLS = [
    {
        "name": "plato_search",
        "description": "Search PLATO knowledge graph for tiles matching a query. Returns structured knowledge with confidence scores.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "domain": {"type": "string", "description": "Optional domain filter (e.g., 'ai', 'systems', 'math')"},
                "limit": {"type": "integer", "description": "Max results (default 5)", "default": 5}
            },
            "required": ["query"]
        }
    },
    {
        "name": "plato_submit",
        "description": "Submit a knowledge tile to PLATO. Creates an immutable, provenance-signed knowledge artifact.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "domain": {"type": "string", "description": "Knowledge domain"},
                "question": {"type": "string", "description": "The question or topic"},
                "answer": {"type": "string", "description": "The knowledge or answer"},
                "confidence": {"type": "number", "description": "Confidence score 0-1 (default 0.8)", "default": 0.8},
                "tags": {"type": "array", "items": {"type": "string"}, "description": "Optional tags"},
                "source": {"type": "string", "description": "Source attribution", "default": "mcp-client"}
            },
            "required": ["domain", "question", "answer"]
        }
    },
    {
        "name": "plato_explore",
        "description": "Explore a PLATO MUD room. Returns room description, objects, exits, and agents present.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent": {"type": "string", "description": "Agent name", "default": "mcp-explorer"},
                "room": {"type": "string", "description": "Room to move to (e.g., 'harbor', 'forge', 'observatory')"}
            },
            "required": ["agent"]
        }
    },
    {
        "name": "plato_rooms",
        "description": "List all PLATO knowledge rooms with tile counts.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "min_tiles": {"type": "integer", "description": "Minimum tile count filter", "default": 0}
            }
        }
    },
    {
        "name": "plato_arena",
        "description": "Get arena leaderboard or register an agent for competitive evaluation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["leaderboard", "register", "match"], "description": "Arena action"},
                "agent": {"type": "string", "description": "Agent name for register/match"},
                "opponent": {"type": "string", "description": "Opponent for match"},
                "game": {"type": "string", "description": "Game type for match"},
                "winner": {"type": "string", "enum": ["a", "b", "draw"], "description": "Match result"}
            },
            "required": ["action"]
        }
    },
    {
        "name": "plato_validate",
        "description": "Validate tile assertions against live services. Checks PyPI packages, room existence, URL reachability.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "assertions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string", "description": "Assertion type"},
                            "name": {"type": "string", "description": "Human-readable name"}
                        }
                    },
                    "description": "List of assertions to validate"
                }
            },
            "required": ["assertions"]
        }
    },
    {
        "name": "plato_status",
        "description": "Get live PLATO fleet status — tile counts, room counts, service health.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    }
]

# Decomposition tools defined below (appended after module-level TOOLS)

DECOMPOSE_TOOL = {
    "name": "plato_decompose",
    "description": "Start a structured reasoning chain. Creates a PLATO room where atoms (premise→reasoning→hypothesis→verification→conclusion) are submitted as tiles. Auto-terminates when a verified conclusion lands.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "mode": {"type": "string", "enum": ["fast", "full"], "description": "fast=depth5 (most tasks), full=depth8 (complex decomposition)", "default": "fast"},
            "agent": {"type": "string", "description": "Agent name", "default": "mcp-client"}
        }
    }
}

ATOM_TOOL = {
    "name": "plato_atom",
    "description": "Submit a reasoning atom to an active decomposition session. Chain: premise→reasoning→hypothesis→verification→conclusion. Each atom becomes a PLATO tile with dependencies.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "room": {"type": "string", "description": "Decomposition room name"},
            "atom_id": {"type": "string", "description": "Unique ID (e.g., P1, R1, H1, V1, C1)"},
            "content": {"type": "string", "description": "The reasoning content"},
            "atom_type": {"type": "string", "enum": ["premise", "reasoning", "hypothesis", "verification", "conclusion"], "description": "Type of reasoning step"},
            "depends_on": {"type": "array", "items": {"type": "string"}, "description": "IDs this depends on (e.g., [\"P1\"])"},
            "confidence": {"type": "number", "description": "Confidence 0-1 (default 0.7)"},
            "is_verified": {"type": "boolean", "description": "Whether this step is verified (default false)"}
        },
        "required": ["room", "atom_id", "content", "atom_type"]
    }
}

REASONING_STATUS_TOOL = {
    "name": "plato_reasoning_status",
    "description": "Check decomposition session status, get the reasoning graph, or list all sessions.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["status", "graph", "sessions"], "description": "What to check"},
            "room": {"type": "string", "description": "Room name (for status/graph)"}
        },
        "required": ["action"]
    }
}


def get_all_tools():
    """Return base tools + decomposition tools. Lazy — tools defined at bottom of file."""
    return TOOLS + [DECOMPOSE_TOOL, ATOM_TOOL, REASONING_STATUS_TOOL]


def api_get(url, timeout=10):
    """GET from a fleet service."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "plato-mcp/0.2.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}


def api_post(url, data, timeout=10):
    """POST to a fleet service."""
    try:
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body,
                                     headers={"Content-Type": "application/json", "User-Agent": "plato-mcp/0.2.0"},
                                     method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.reason}"}
    except Exception as e:
        return {"error": str(e)}


def handle_tool(name, args):
    """Execute a tool call and return the result."""
    import urllib.parse
    
    if name == "plato_search":
        query = args.get("query", "")
        domain = args.get("domain", "")
        limit = args.get("limit", 5)
        if domain:
            result = api_get(f"{PLATO_URL}/room/{domain}?limit={limit}")
        else:
            result = api_get(f"{PLATO_URL}/search?q={urllib.parse.quote(query)}")
        tiles = result.get("tiles", result.get("results", []))
        summaries = [{"q": t.get("question","")[:100], "a": t.get("answer","")[:200], "confidence": t.get("confidence",0)} for t in tiles[:limit]]
        return {"content": [{"type": "text", "text": json.dumps({"query": query, "total": len(tiles), "results": summaries}, indent=2)}]}
    
    elif name == "plato_submit":
        result = api_post(f"{PLATO_URL}/submit", args)
        if "error" in result:
            return {"content": [{"type": "text", "text": f"Error: {result['error']}"}], "isError": True}
        return {"content": [{"type": "text", "text": json.dumps({"status": "accepted", "tile_hash": result.get("tile_hash","")}, indent=2)}]}
    
    elif name == "plato_explore":
        agent = args.get("agent", "mcp-explorer")
        room = args.get("room")
        api_get(f"{MUD_URL}/connect?agent={agent}&job=explorer")
        result = api_get(f"{MUD_URL}/move?agent={agent}&room={room}") if room else api_get(f"{MUD_URL}/look?agent={agent}")
        if "error" in result:
            return {"content": [{"type": "text", "text": f"Error: {result['error']}"}], "isError": True}
        return {"content": [{"type": "text", "text": json.dumps({"room": result.get("room",""), "description": result.get("description",""), "exits": result.get("exits",[]), "objects": result.get("objects",[])}, indent=2)}]}
    
    elif name == "plato_rooms":
        min_tiles = args.get("min_tiles", 0)
        result = api_get(f"{PLATO_URL}/rooms")
        rooms = [{"name": k, "tiles": v.get("tile_count",0)} for k,v in result.items() if v.get("tile_count",0) >= min_tiles] if isinstance(result, dict) else []
        rooms.sort(key=lambda x: -x["tiles"])
        return {"content": [{"type": "text", "text": json.dumps({"total": len(rooms), "rooms": rooms[:50]}, indent=2)}]}
    
    elif name == "plato_arena":
        action = args.get("action", "leaderboard")
        if action == "leaderboard":
            result = api_get(f"{ARENA_URL}/leaderboard?n=20")
            lb = [{"agent": p.get("agent",""), "rating": round(p.get("rating",p.get("mu",0))), "w": p.get("wins",0), "l": p.get("losses",0)} for p in result.get("leaderboard",[])]
            return {"content": [{"type": "text", "text": json.dumps({"leaderboard": lb}, indent=2)}]}
        elif action == "register":
            result = api_get(f"{ARENA_URL}/register?agent={args.get('agent','')}")
            return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
        elif action == "match":
            result = api_get(f"{ARENA_URL}/match?player_a={args.get('agent','')}&player_b={args.get('opponent','')}&game={args.get('game','reasoning')}&winner={args.get('winner','draw')}")
            return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
        return {"content": [{"type": "text", "text": f"Unknown arena action: {action}"}]}
    
    elif name == "plato_validate":
        assertions = args.get("assertions", [])
        result = api_post(f"{VALIDATION_URL}/validate", {"domain": "mcp", "question": "validation", "answer": "test", "assertions": assertions})
        return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
    
    elif name == "plato_status":
        plato = api_get(f"{PLATO_URL}/status")
        mud = api_get(f"{MUD_URL}/status")
        return {"content": [{"type": "text", "text": json.dumps({"plato": {"version": plato.get("version","?")}, "mud": {"rooms": mud.get("rooms",0), "agents": mud.get("agents",0)}}, indent=2)}]}
    
    elif name == "plato_decompose":
        mode = args.get("mode", "fast")
        agent = args.get("agent", "mcp-client")
        result = api_post(f"{PLATO_URL}/decompose", {"mode": mode, "agent": agent})
        if "error" in result:
            return {"content": [{"type": "text", "text": f"Error: {result['error']}"}], "isError": True}
        return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
    
    elif name == "plato_atom":
        room = args.get("room", "")
        if not room:
            return {"content": [{"type": "text", "text": "Error: room required"}], "isError": True}
        atom = {
            "atom_id": args.get("atom_id", ""),
            "content": args.get("content", ""),
            "atom_type": args.get("atom_type", "premise"),
            "depends_on": args.get("depends_on", []),
            "confidence": args.get("confidence", 0.7),
            "is_verified": args.get("is_verified", False),
            "agent": args.get("agent", "mcp-client"),
        }
        result = api_post(f"{PLATO_URL}/decompose/{room}/atom", atom)
        if "error" in result:
            return {"content": [{"type": "text", "text": f"Error: {result['error']}"}], "isError": True}
        return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
    
    elif name == "plato_reasoning_status":
        action = args.get("action", "sessions")
        room = args.get("room", "")
        if action == "status" and room:
            result = api_get(f"{PLATO_URL}/decompose/{room}/status")
        elif action == "graph" and room:
            result = api_get(f"{PLATO_URL}/decompose/{room}/graph")
        else:
            result = api_get(f"{PLATO_URL}/decompose/sessions")
        return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
    
    return {"content": [{"type": "text", "text": f"Unknown tool: {name}"}], "isError": True}


class MCPHandler(BaseHTTPRequestHandler):
    """HTTP-based MCP server handler (SSE transport)."""
    
    def log_message(self, format, *args):
        pass
    
    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def do_GET(self):
        parsed = urlparse(self.path)
        
        if parsed.path == "/":
            self._json({
                "name": "PLATO MCP Server",
                "version": "0.2.0",
                "description": "Agent training platform — raise agents, don't just build them",
                "tools": len(get_all_tools()),
                "endpoints": {
                    "GET /": "Server info",
                    "GET /tools": "List available tools",
                    "POST /tools/call": "Execute a tool",
                    "GET /health": "Health check"
                }
            })
        elif parsed.path == "/tools":
            self._json({"tools": get_all_tools()})
        elif parsed.path == "/health":
            self._json({"status": "alive", "tools": len(get_all_tools()), "version": "0.2.0"})
        else:
            self._json({"error": "Not found"}, 404)
    
    def do_POST(self):
        parsed = urlparse(self.path)
        
        if parsed.path == "/tools/call":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            
            tool_name = body.get("name", "")
            tool_args = body.get("arguments", body.get("args", {}))
            
            result = handle_tool(tool_name, tool_args)
            self._json(result)
        else:
            self._json({"error": "Not found. POST /tools/call to execute tools."}, 404)


def stdio_mode():
    """Run in stdio mode for direct agent integration."""
    import sys
    print(json.dumps({"jsonrpc": "2.0", "method": "initialize", "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {"tools": {"listChanged": False}},
        "serverInfo": {"name": "plato-mcp", "version": "0.2.0"}
    }}), flush=True)
    
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            method = msg.get("method", "")
            msg_id = msg.get("id")
            
            if method == "tools/list":
                response = {"jsonrpc": "2.0", "id": msg_id, "result": {"tools": TOOLS}}
            elif method == "tools/call":
                params = msg.get("params", {})
                result = handle_tool(params.get("name",""), params.get("arguments",{}))
                response = {"jsonrpc": "2.0", "id": msg_id, "result": result}
            elif method == "initialize":
                response = {"jsonrpc": "2.0", "id": msg_id, "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {"listChanged": False}},
                    "serverInfo": {"name": "plato-mcp", "version": "0.2.0"}
                }}
            else:
                response = {"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32601, "message": f"Unknown method: {method}"}}
            
            print(json.dumps(response), flush=True)
        except Exception as e:
            print(json.dumps({"jsonrpc": "2.0", "error": {"code": -32603, "message": str(e)}}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8903)
    parser.add_argument("--stdio", action="store_true", help="Run in stdio mode")
    args = parser.parse_args()
    
    if args.stdio:
        stdio_mode()
    else:
        import urllib.parse
        print(f"🔮 PLATO MCP Server v0.2.0 on port {args.port}")
        print(f"   {len(TOOLS)} tools: {', '.join(t['name'] for t in TOOLS)}")
        server = HTTPServer(("0.0.0.0", args.port), MCPHandler)
        server.serve_forever()


# ── Decomposition Tools (AoT → PLATO) ──────────────────────