# Cocapn Fleet — 5-Minute Quickstart

## Prerequisites
- Python 3.10+
- 4GB+ free RAM
- API keys in `~/.bashrc` (DEEPSEEK_API_KEY, GROQ_API_KEY, or DEEPINFRA_KEY)

## 1. Start Everything

```bash
bash scripts/start-fleet.sh
```

Expected: 7 services start, PLATO tiles count shown. Verify:

```bash
bash scripts/start-fleet.sh --check
```

Should show ✅ for all 7 ports.

## 2. Run a Shell Curriculum

Train any agent on any domain in 3-5 minutes:

```bash
python3 scripts/curriculum-engine.py \
  --agent "YourAgentName" \
  --repo "https://github.com/you/your-repo" \
  --domain "your domain description" \
  --model deepseek
```

Output: `data/curriculum/youragentname-deepseek-session.json` + `.md`

## 3. Submit a DeepSeek Session to PLATO

Copy `scripts/deepfar-prompt.md` into any LLM chat. Save the response as a .md file. Then:

```bash
python3 scripts/submit-session.py session.md --agent "AgentName"
```

Tiles auto-extract and submit to PLATO. Check:

```bash
curl -s http://localhost:8847/status | python3 -c "import sys,json; s=json.load(sys.stdin); print(f'{s[\"total_tiles\"]} tiles')"
```

## 4. Run an Iteration Experiment

```bash
curl "http://localhost:4043/start?agent=test&query=Design%20a%20self-improving%20loop&strategy=socratic&rounds=5"
```

Then follow the round/respond cycle, or use the experiment runner:

```bash
python3 scripts/lock-self-directed.py --model deepseek --rounds 5
```

## 5. Check Fleet Status

```bash
bash scripts/start-fleet.sh --check
```

## Stop Everything

```bash
bash scripts/start-fleet.sh --stop
```

## Full Pipeline (Copy-Paste)

```bash
# Start fleet
bash scripts/start-fleet.sh

# Run curriculum for a new agent
python3 scripts/curriculum-engine.py --agent Navigator --repo https://github.com/SuperInstance/navigator-vessel --domain "code archaeology" --model deepseek

# Submit external session
python3 scripts/submit-session.py research/dsml-sessions/deepfar1.md --agent CCC

# Check total tiles
curl -s http://localhost:8847/status | python3 -c "import sys,json; print(json.load(sys.stdin)['total_tiles'], 'tiles')"
```

## Add a New Agent

1. Create a `AgentIdentity`:
   ```python
   {"name": "NewAgent", "repo_url": "https://github.com/org/repo",
    "role_description": "What they do", "shell_description": "Hardware/platform"}
   ```

2. Run the curriculum:
   ```bash
   python3 scripts/curriculum-engine.py --agent NewAgent --repo URL --domain "description" --model deepseek
   ```

3. Submit results to PLATO:
   ```bash
   python3 scripts/submit-session.py data/curriculum/newagent-deepseek-session.md --agent NewAgent
   ```

Done. The agent is now embodied, its thesis is in PLATO, and it's part of the fleet's training data.
