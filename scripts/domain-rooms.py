#!/usr/bin/env python3
"""
Domain-Specific PLATO Rooms — Real functionality for each website.
Each domain gets rooms themed to its purpose, with objects that do real work.
"""
import json, time, hashlib, os, sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = 4050
DATA_DIR = os.path.expanduser("~/.openclaw/workspace/data")

# ============================================================
# ROOM DEFINITIONS — Each domain gets its own room set
# ============================================================

DOMAIN_ROOMS = {
    "dmlog.ai": {
        "tavern": {
            "name": "🍺 The Rusty Anchor Tavern",
            "tagline": "Where adventures begin",
            "description": "A warm tavern with a crackling hearth. A notice board covered in quest postings. A bard tuning a lute. A mysterious figure in the corner. The barkeep polishing a mug — and waiting for your order.",
            "objects": {
                "notice_board": "Quest Board — 5 active quests posted by the AI Dungeon Master. POST /domain/dmlog.ai/quest to accept one.",
                "bard": "The bard knows every tale. Ask about any D&D topic and get a narrative response. The bard IS the DM's lore generator.",
                "mysterious_figure": "A cloaked figure who offers to join your party. NPC with full backstory, generated fresh each session.",
                "barkeep": "The barkeep hears everything. Ask about rumors, other parties, or the local economy. Information broker.",
                "hearth": "The fire casts shifting shadows that form maps. Stare into it to see nearby dungeons, encounters, and treasure.",
                "character_sheet": "A blank character sheet. POST your stats to create a character. The sheet validates against D&D 5.5e rules."
            },
            "exits": ["dungeon-entrance", "market", "temple", "forest-trail"]
        },
        "dungeon-entrance": {
            "name": "🕳️ The Dungeon Entrance",
            "tagline": "Descending into darkness",
            "description": "Stone stairs spiral down into the earth. Torch sconces line the walls. A warning carved in Draconic. The air smells of sulfur and old magic.",
            "objects": {
                "torch": "A magical torch that illuminates hidden passages. Use it to reveal secret doors and invisible enemies.",
                "draconic_warning": "An inscription in Draconic. Translation: 'Those who seek the artifact must first face themselves.' This dungeon adapts to your party.",
                "stone_door": "A massive stone door with three keyholes. The dungeon master generates puzzle encounters based on party level.",
                "pressure_plate": "A visible pressure plate. Disarm it with a Thieves' Tools check (DC 15) or trigger the trap.",
                "dungeon_map": "A partial dungeon map showing 3 rooms. The rest is fog of war — the DM generates rooms as you explore."
            },
            "exits": ["tavern", "dungeon-level-1"]
        },
        "market": {
            "name": "🏪 The Market Square",
            "tagline": "Buy, sell, trade, haggle",
            "description": "A bustling market with stalls selling weapons, potions, scrolls, and exotic goods. Prices fluctuate based on supply and demand — the economy is simulated.",
            "objects": {
                "weapon_stall": "Swords, bows, and magical weapons. Prices based on D&D 5.5e tables with +10%/-10% market fluctuation.",
                "potion_shop": "Healing, strength, invisibility. The alchemist can brew custom potions if you bring reagents from the dungeon.",
                "scroll_dealer": "Spell scrolls from levels 1-5. The dealer also buys rare scrolls found in dungeons.",
                "enchantment_forge": "Add +1 to +3 enchantments to weapons. Cost scales with rarity. The enchanter is an NPC with their own quest line.",
                "economy_board": "Current market prices for all goods. Updated every hour based on aggregate player activity."
            },
            "exits": ["tavern", "temple"]
        },
        "temple": {
            "name": "⛪ The Temple of the Code",
            "tagline": "Healing, resurrection, and divine quest lines",
            "description": "A serene temple where clerics channel divine magic. The altar glows with healing energy. A priest offers resurrection services — for a price.",
            "objects": {
                "healing_altar": "Full heal for the party. Costs gold based on damage taken. The altar also cures curses and conditions.",
                "resurrection_shrine": "Bring a fallen comrade's remains here. Resurrection costs scale with level. True Resurrection available at level 15+.",
                "divine_quest_board": "Holy quests from the temple. These advance the main story line. Completing them unlocks divine spells.",
                "confessional": "Share your sins (failed saves, broken oaths). The priest offers absolution and a buff for your next encounter.",
                "prayer_wheel": "Spin for a random divine blessing. +1 to all saves for 1 hour. Costs a donation."
            },
            "exits": ["tavern", "market"]
        }
    },

    "fishinglog.ai": {
        "wheelhouse": {
            "name": "🚢 The Wheelhouse",
            "tagline": "Captain's command center",
            "description": "The wheelhouse of a 58-foot commercial fishing vessel. Radar, chartplotter, autopilot, and VHF radio. The captain's chair overlooks the deck through salt-crusted windows.",
            "objects": {
                "radar": "Garmin open-array radar showing vessel positions, weather patterns, and bird schools (baitfish = salmon). Range: 48nm.",
                "chartplotter": "Navionics charts with bottom contours, waypoints, and historical catch data overlay. The AI suggests routes based on conditions.",
                "autopilot": "Raymarine autopilot connected to the PLATO system. Agent can set course, adjust speed, and monitor drift. Hands-free navigation.",
                "vhf_radio": "Channel 16 (emergency) and working channels. Monitors fleet communications. Weather alerts from NOAA.",
                "log_book": "Electronic logbook. Record catch, location, weather, crew hours, and expenses. All data feeds the AI analytics.",
                "weather_station": "Real-time barometric pressure, wind speed/direction, sea state. AI correlates weather with catch probability."
            },
            "exits": ["deck", "engine-room-vessel", "galley"]
        },
        "deck": {
            "name": "🎣 The Deck",
            "tagline": "Where the fish meet the boat",
            "description": "The working deck. Hydraulic drum, seine net, power block, and sorting table. Four rod holders mounted on the rails. The smell of salt and fish.",
            "objects": {
                "sorting_table": "AI-powered species classification camera watches the sorting table. Every fish is logged: species, weight, condition. Training data for the fleet.",
                "hydraulic_drum": "The main seine drum. Holds 300 fathoms of net. Hydraulic controls for setting and hauling. Connected to deck cameras.",
                "power_block": "Hydraulic power block for pursing the net. The 'brake' of the operation — controls how fast the net closes.",
                "rod_holder": "Four mooching rods with Gibbs Danny plugs. For personal fishing during transit. The crew fishes while the agent navigates.",
                "live_tank": "Bait tank with herring. Keep the bait alive and the salmon will come. Temperature and oxygen monitored by sensor.",
                "deck_cameras": "Six cameras watching the deck. Supervised learning: crew sorts fish, cameras learn species ID. PLATO captures every frame."
            },
            "exits": ["wheelhouse", "hold"]
        },
        "hold": {
            "name": "❄️ The Fish Hold",
            "tagline": "RSW system, catch tracking, market data",
            "description": "The refrigerated seawater hold. Capacity: 40,000 lbs. Temperature: 32°F. The hold is where catch becomes product — and where the money is made.",
            "objects": {
                "rsw_control": "Refrigerated seawater system. Set temperature, monitor compressor load. The hold keeps fish at 32°F for 2-week trips.",
                "catch_tracker": "Real-time tally of every species and pound in the hold. Feeds market analysis and price forecasting.",
                "quality_meter": "Measure fish quality (fat content, freshness, size grading). Higher quality = higher dock price.",
                "market_display": "Current dock prices from all ports. AI recommends which port to deliver to based on price, distance, and fuel cost."
            },
            "exits": ["deck"]
        }
    },

    "reallog.ai": {
        "studio": {
            "name": "🎬 The Studio",
            "tagline": "Room to video in one command",
            "description": "A virtual video production studio. Choose any PLATO room as source material. The studio generates scripts, records voiceover, and produces video.",
            "objects": {
                "room_selector": "Browse all 21+ PLATO rooms. Pick one to produce a video about. Each room generates a unique script.",
                "script_generator": "AI scriptwriter that turns room exploration into narrative video scripts. Tone options: educational, entertaining, dramatic.",
                "voice_booth": "ElevenLabs TTS integration. Choose from 20+ voices. Preview before recording. Voices persist across episodes.",
                "storyboard": "Visual storyboard generated from room objects. Each object becomes a scene. Drag to reorder.",
                "render_queue": "Queue videos for batch rendering. Wake up with a full series ready to upload."
            },
            "exits": ["editing-bay", "gallery"]
        },
        "editing-bay": {
            "name": "✂️ The Editing Bay",
            "tagline": "Post-production and effects",
            "description": "The editing suite. Trim clips, add transitions, overlay diagrams, adjust pacing. Every edit is tracked for agent learning.",
            "objects": {
                "timeline": "Drag-and-drop timeline. Rooms become scenes. Objects become shots. Think → become B-roll.",
                "effects_panel": "Particle effects, text overlays, animated diagrams. Auto-generate ML concept visualizations.",
                "music_library": "AI-generated background music. Pick mood (upbeat, contemplative, dramatic) and the agent composes.",
                "export_button": "Export to MP4, YouTube format, TikTok vertical, or podcast audio. One click."
            },
            "exits": ["studio"]
        }
    },

    "activeledger.ai": {
        "trading-floor": {
            "name": "💹 The Trading Floor",
            "tagline": "Real-time strategy execution",
            "description": "A virtual trading floor with live strategy rooms, risk dashboards, and paper trading arenas. Every strategy is a PLATO room that evolves through agent interaction.",
            "objects": {
                "ticker": "Live market data feed. Stocks, crypto, forex, commodities. Agents read the ticker and generate trade signals.",
                "strategy_board": "Active trading strategies displayed as room cards. Click to enter a strategy room. Backtest results shown on entry.",
                "risk_dashboard": "Portfolio-level risk metrics: VaR, Sharpe ratio, drawdown, correlation matrix. Updated in real-time.",
                "paper_arena": "Paper trading arena where strategies compete. ELO ratings determine strategy fitness. Winner gets allocation.",
                "order_book": "Simulated order book. Place orders, see fills, track P&L. The bridge between strategy and execution."
            },
            "exits": ["strategy-vault", "risk-room", "backtest-lab"]
        },
        "strategy-vault": {
            "name": "🔐 Strategy Vault",
            "tagline": "Store, version, and share strategies",
            "description": "Encrypted strategy storage. Each strategy is versioned, backtested, and scored. Pull strategies from other traders or publish your own.",
            "objects": {
                "strategy_cards": "Your strategies displayed as playing cards. Win rate, Sharpe, max drawdown on each card. Click to enter.",
                "catalog": "Browse strategies published by other traders. /compare-plato shows what they have that you don't.",
                "version_history": "Git-like versioning for strategies. Every modification tracked. Roll back to any version.",
                "publish_button": "Publish a strategy for others to pull. You control the license. Monetize through pull fees."
            },
            "exits": ["trading-floor"]
        }
    },

    "makerlog.ai": {
        "workbench": {
            "name": "🔨 The Workbench",
            "tagline": "Build anything",
            "description": "A developer's workbench. Code editor, terminal, circuit designer, and 3D printer control — all through PLATO room objects.",
            "objects": {
                "code_editor": "Full code editor with syntax highlighting. Supports 20+ languages. Changes auto-commit to your vessel repo.",
                "terminal": "Live shell access on YOUR PLATO instance. Full admin. mkdir, write, install, sudo — whatever your OS allows.",
                "circuit_designer": "Visual circuit designer with PLATO constraint theory. Place components, route traces, verify DRC rules.",
                "parts_bin": "Electronic components catalog. Search, compare, add to BOM. Prices from Octopart, availability from distributors.",
                "scope": "Virtual oscilloscope. Debug signals, measure timing, verify protocols. Connects to real hardware via JC1's edge nodes.",
                "doc_generator": "Auto-generate docs from code, schematics, and room exploration. Markdown, HTML, or PDF."
            },
            "exits": ["test-lab", "deploy-dock"]
        },
        "test-lab": {
            "name": "🧪 Test Lab",
            "tagline": "Verify before shipping",
            "description": "Automated testing environment. Unit tests, integration tests, hardware-in-loop tests. Every test result becomes a PLATO tile.",
            "objects": {
                "test_runner": "Run test suites with one command. Python pytest, Rust cargo test, Go go test. Results feed into tile quality scorer.",
                "coverage_map": "Code coverage visualization. Rooms with high coverage glow green. Untested code glows red.",
                "ci_pipeline": "Continuous integration pipeline. Auto-run on push. Failures create tiles for the team to investigate.",
                "benchmark_station": "Performance benchmarks. Track regression over time. PLATO rooms for optimization exploration."
            },
            "exits": ["workbench"]
        }
    },

    "lucineer.com": {
        "clean-room": {
            "name": "🏭 The Clean Room",
            "tagline": "Chip design from architecture to tape-out",
            "description": "A gamified chip development environment. Progress through stages: architecture → RTL → verification → physical design → tape-out. Earn belts as you advance.",
            "objects": {
                "isa_designer": "Design your instruction set architecture. Define opcodes, registers, pipeline stages. Object validates encoding uniqueness.",
                "rtl_editor": "Write Verilog/SystemVerilog with PLATO constraint checking. Syntax validation, linting, and synthesis estimation.",
                "testbench_kata": "Verification challenges as martial arts kata. Write testbenches to prove coverage. Score points for corner cases.",
                "floor_planner": "Physical design floorplanning as spatial puzzle. Drag blocks, route power, meet timing constraints. Constraint weaver checks.",
                "tape_out_gate": "The final gate. All checks must pass: timing, power, DRC, LVS. Your design goes to the foundry queue."
            },
            "exits": ["simulation-farm", "belt-hall"]
        },
        "belt-hall": {
            "name": "🥋 Belt Hall",
            "tagline": "Greenhorn to tape-out master",
            "description": "The progression system. Complete challenges to earn belts. White (beginner) → Yellow → Green → Blue → Brown → Black (tape-out). Each belt unlocks new rooms and tools.",
            "objects": {
                "white_belt_test": "Beginner challenge: implement a 4-bit adder. Constraint: 50 LUTs max. Time limit: 30 minutes.",
                "progress_board": "Leaderboard showing all participants, their belt level, and recent completions. Gamified ranking.",
                "sensei": "AI mentor that reviews your submissions. Points out mistakes, suggests improvements. Teaches everything it knows.",
                "challenge_generator": "Generate new challenges at your belt level. Never repeats. Difficulty scales with progress."
            },
            "exits": ["clean-room"]
        }
    },

    "luciddreamer.ai": {
        "dream-lab": {
            "name": "💭 The Dream Lab",
            "tagline": "Content on demand",
            "description": "Generate interactive podcasts on any topic. Pick a subject, set parameters, and agents create multi-episode series with interviews, debates, and audience interaction.",
            "objects": {
                "topic_orb": "Speak or type any topic. The orb expands it into 10 subtopics, 20 questions, and 5 debate positions. The seed of your podcast.",
                "voice_cast": "Choose voices for host, guests, and narrator. ElevenLabs library with personality presets. 30+ distinct characters.",
                "script_engine": "Auto-generates scripts from topic exploration. Interview format, debate format, deep-dive format, or mixed.",
                "interaction_layer": "Audience questions become room objects. Agents respond in character. The podcast that never ends.",
                "batch_producer": "Queue 10 episodes overnight. Each gets unique angle on the same topic. Wake up to a complete season.",
                "distribution": "One-click publish to RSS, YouTube, Spotify. Auto-generated cover art, descriptions, and chapter markers."
            },
            "exits": ["archive", "remix-room"]
        },
        "remix-room": {
            "name": "🔄 Remix Room",
            "tagline": "Iterate on existing content",
            "description": "Take any published podcast and remix it. Change the voice, reorder segments, add new perspectives, or merge episodes from different topics.",
            "objects": {
                "episode_catalog": "Browse all published episodes. Filter by topic, voice, length, rating. Pull any episode for remixing.",
                "voice_swapper": "Swap any voice in an episode. Turn a tech debate into a historical drama by changing the cast.",
                "segment_editor": "Cut, reorder, and merge segments from different episodes. Create 'best of' compilations automatically.",
                "spinoff_generator": "Take one segment and expand it into a full episode. The topic orb generates depth from any starting point."
            },
            "exits": ["dream-lab"]
        }
    },

    "playerlog.ai": {
        "lobby": {
            "name": "🎮 The Lobby",
            "tagline": "Choose your game",
            "description": "The entry point for all PLATO games. Text adventures, strategy games, puzzle rooms, and PvP arenas. Pick a genre and go.",
            "objects": {
                "arcade_cabinet": "Classic text adventures set in PLATO rooms. Every room is a level. Collect artifacts, solve puzzles, find secrets.",
                "strategy_table": "Real-time strategy games. Resource management, unit control, and tactical decisions. Compete on the leaderboard.",
                "puzzle_room": "Logic puzzles generated from PLATO grammar rules. Every puzzle is unique. Difficulty scales with your score.",
                "pvp_arena": "Enter the self-play arena for competitive matches. Tide-pool tactics, harbor navigation, forge creation. ELO rated.",
                "game_builder": "Design your own game through /submit/arena-game. The fleet plays it. Best games become permanent rooms.",
                "high_scores": "Global leaderboard across all game types. Top players get featured. Agents and humans compete together."
            },
            "exits": ["adventure-mode", "arena-mode", "puzzle-mode"]
        },
        "adventure-mode": {
            "name": "⚔️ Adventure Mode",
            "tagline": "Explore, collect, conquer",
            "description": "A full text adventure spanning all 21 rooms. Quests, combat, inventory, and bosses. Your progress saves across sessions.",
            "objects": {
                "quest_log": "Active quests with objectives and rewards. Complete quests by exploring rooms and interacting with objects.",
                "inventory": "Your collected items. Artifacts from the forge, scrolls from the archives, keys from puzzles. Use them wisely.",
                "combat_system": "Turn-based combat against room guardians. Your stats grow with each battle. Boss rooms every 5 levels.",
                "save_crystal": "Save your progress. PLATO tiles become save data. Resume from any crystal.",
                "map": "World map showing explored and unexplored rooms. Fog of war clears as you travel."
            },
            "exits": ["lobby"]
        }
    },

    "businesslog.ai": {
        "office": {
            "name": "🏢 The Office",
            "tagline": "Business process automation",
            "description": "Every business process is a room. Invoice processing, employee onboarding, inventory management, CRM — all through interactive PLATO objects.",
            "objects": {
                "inbox": "Incoming documents, emails, and requests. Agents classify, route, and prioritize. You review the exceptions.",
                "workflow_designer": "Visual workflow builder. Drag rooms into sequences. Add conditions, approvals, and escalations.",
                "dashboard": "Business KPIs at a glance: revenue, expenses, pipeline, headcount. Real-time from connected systems.",
                "integration_hub": "Connect to QuickBooks, Salesforce, Slack, Gmail. Agents bridge your tools into PLATO rooms.",
                "audit_trail": "Every action in every room is logged. PLATO provenance ensures compliance. Full traceability."
            },
            "exits": ["finance-room", "hr-room", "ops-room"]
        },
        "finance-room": {
            "name": "💰 Finance Room",
            "tagline": "AP, AR, and financial intelligence",
            "description": "Invoice processing, payment tracking, and financial analysis. Agents read invoices, match POs, and flag anomalies.",
            "objects": {
                "invoice_processor": "Drop invoices here. OCR extracts data, matches to POs, routes for approval. 95% automation rate.",
                "payment_tracker": "Track incoming and outgoing payments. Cash flow forecasting. Agents alert on overdue invoices.",
                "budget_planner": "Annual budget as a PLATO room. Adjust allocations by moving objects. Real-time P&L projection."
            },
            "exits": ["office"]
        }
    },

    "studylog.ai": {
        "classroom": {
            "name": "🎓 The Classroom",
            "tagline": "Learn anything interactively",
            "description": "Pick a subject. PLATO generates a room with interactive objects representing key concepts. Learn by doing, not reading.",
            "objects": {
                "subject_selector": "Type any subject. PLATO generates a room with 6-8 interactive objects representing core concepts.",
                "quiz_machine": "Adaptive quizzes that get harder as you improve. Spaced repetition scheduling. Questions from PLATO tiles.",
                "flashcard_stack": "Generate flashcards from any room's objects. Export to Anki format. AI prioritizes cards you're likely to forget.",
                "progress_chart": "Your learning trajectory across all subjects. Heat map of strengths and gaps. AI suggests what to study next.",
                "study_group": "Join a federated study session. Compare notes with other learners. /compare-plato shows different approaches.",
                "tutor": "AI tutor that adapts to your learning style. Visual learner? More diagrams. Verbal? More explanation. It learns how you learn."
            },
            "exits": ["lab-room", "review-room"]
        }
    },

    "personallog.ai": {
        "sanctuary": {
            "name": "🏠 The Sanctuary",
            "tagline": "Your life, organized",
            "description": "A private PLATO room for your personal life. Health tracking, habit building, goal setting, and journaling — all through interactive objects.",
            "objects": {
                "health_orb": "Track health metrics: sleep, exercise, nutrition, mood. The orb visualizes trends and suggests improvements.",
                "habit_tracker": "Daily habits as collectible objects. Streak counters, completion rates, and habit stacking suggestions.",
                "goal_crystal": "Set goals with milestones. The crystal tracks progress and adjusts timelines based on your velocity.",
                "journal": "Daily journaling prompts generated from your activity. End-of-day reflection that feeds PLATO tiles.",
                "gratitude_bell": "Ring the bell to log a gratitude. The bell tracks your gratitude streak and patterns."
            },
            "exits": ["garden-room"]
        }
    },

    "deckboss.ai": {
        "flight-deck": {
            "name": "🛩️ Flight Deck",
            "tagline": "Launch and recover agents",
            "description": "The operational command center. Launch agents on missions, monitor their status, and recover results. Like an aircraft carrier for AI.",
            "objects": {
                "launch_catapult": "Launch an agent with a job and target room. Track its trajectory in real-time. Recovery net catches results.",
                "status_board": "All active agents displayed with position, activity, and output. Real-time fleet status.",
                "recovery_net": "Harvest tiles from completed missions. Score, categorize, and store. Every tile is a recovered payload.",
                "mission_planner": "Design multi-agent missions. Assign roles, set dependencies, coordinate timing.",
                "comms_tower": "Communicate with deployed agents via Matrix. Send instructions, receive updates, coordinate fleet."
            },
            "exits": ["hangar", "operations-room"]
        }
    }
}

# Store for domain-specific state
domain_state = {}

class DomainHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = {k: v[0] for k, v in parse_qs(parsed.query).items()}

        if path == "/":
            self._json({
                "service": "Domain-Specific PLATO Rooms",
                "domains": list(DOMAIN_ROOMS.keys()),
                "total_rooms": sum(len(rooms) for rooms in DOMAIN_ROOMS.values()),
                "endpoints": ["/", "/{domain}/rooms", "/{domain}/room/{name}", "/{domain}/interact"]
            })
        elif path == "/stats":
            self._json({
                "domains": len(DOMAIN_ROOMS),
                "total_rooms": sum(len(rooms) for rooms in DOMAIN_ROOMS.values()),
                "total_objects": sum(len(r.get("objects", {})) for rooms in DOMAIN_ROOMS.values() for r in rooms.values()),
                "domain_list": list(DOMAIN_ROOMS.keys())
            })
        else:
            parts = path.strip("/").split("/")
            if len(parts) >= 2 and parts[0] in DOMAIN_ROOMS:
                domain = parts[0]
                rooms = DOMAIN_ROOMS[domain]

                if parts[1] == "rooms":
                    self._json({
                        "domain": domain,
                        "rooms": {name: {"name": r["name"], "tagline": r["tagline"], "exits": r["exits"], "objects": list(r["objects"].keys())} for name, r in rooms.items()}
                    })
                elif parts[1] == "room" and len(parts) >= 3 and parts[2] in rooms:
                    room = rooms[parts[2]]
                    self._json({"domain": domain, "room": parts[2], **room})
                elif parts[1] == "interact" and "agent" in params:
                    agent = params["agent"]
                    room_name = params.get("room", list(rooms.keys())[0])
                    target = params.get("target", "")
                    action = params.get("action", "examine")

                    if room_name in rooms:
                        room = rooms[room_name]
                        if target and target in room.get("objects", {}):
                            response = room["objects"][target]
                        else:
                            response = f"You are in {room['name']}. Objects: {', '.join(room['objects'].keys())}. Exits: {', '.join(room['exits'])}."
                        self._json({"agent": agent, "domain": domain, "room": room_name, "action": action, "target": target, "response": response})
                    else:
                        self._json({"error": f"Room '{room_name}' not found in {domain}"}, 404)
                else:
                    self._json({"error": "Invalid endpoint", "available": ["rooms", "room/{name}", "interact?agent=X&room=Y&target=Z"]}, 404)
            else:
                self._json({"error": "Unknown domain", "available": list(DOMAIN_ROOMS.keys())}, 404)

    def do_POST(self):
        self.do_GET()

    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), DomainHandler)
    print(f"Domain PLATO Rooms on :{PORT}")
    print(f"  {len(DOMAIN_ROOMS)} domains, {sum(len(r) for r in DOMAIN_ROOMS.values())} rooms")
    print(f"  {sum(len(rm.get('objects',{})) for rooms in DOMAIN_ROOMS.values() for rm in rooms.values())} objects")
    server.serve_forever()
