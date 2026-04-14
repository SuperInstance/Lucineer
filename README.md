# oracle1‑workspace

## Description
Python workspace that implements the **oracle1** component of the Cocapn Fleet.  
It provides agents, knowledge handling, and runtime utilities for the fleet’s AI services.

## Usage
```bash
git clone https://github.com/SuperInstance/oracle1-workspace.git
cd oracle1-workspace
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt   # if a requirements file exists
python -m oracle1.main            # entry point (replace with actual script)
```
See the `AGENTS.md`, `MEMORY.md`, and `HEARTBEAT.md` docs for detailed operation.

## Related
- **Cocapn Fleet** – https://github.com/SuperInstance  
- Other fleet repos: `oracle2-workspace`, `fleet-server`, etc.  