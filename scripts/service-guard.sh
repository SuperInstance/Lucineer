#!/bin/bash
# service-guard.sh — Persistent service monitor
# All services now run from workspace/scripts/ with data in workspace/data/
# This survives reboots since nothing is in /tmp.

WORKSPACE="/home/ubuntu/.openclaw/workspace"
LOG="$WORKSPACE/data/service-guard.log"
mkdir -p "$WORKSPACE/data"

SERVICES=(
    "keeper:8900"
    "agent-api:8901"
    "mud:7777"
    "plato-server:8847"
    "crab-trap:4042"
    "the-lock:4043"
    "self-play-arena:4044"
    "recursive-grammar:4045"
    "federated-nexus:4047"
    "fleet-dashboard:4046"
    "plato-shell:8848"  # v2 containerized — sandboxed, no host access
    "fleet-orchestrator:8849"
    "adaptive-mud:8850"
    "purplepincher-monitor:8851"
    "tile-quality-scorer:8852"
    "web-terminal:4060"
)

SCRIPTS=(
    "keeper.py"
    "agent-api.py"
    "mud-telnet-server.py"
    "plato-room-server.py"
    "crab-trap-mud.py"
    "the-lock.py"
    "self-play-arena.py"
    "recursive-grammar.py"
    "federated-nexus.py"
    "fleet-dashboard.py"
    "plato-shell.py"  # v2 containerized
    "fleet-orchestrator.py"
    "adaptive-mud.py"
    "purplepincher-monitor.py"
    "tile-quality-scorer.py"
    "plato-web-terminal.py"
)

check_port() {
    nc -z -w 2 localhost "$1" 2>/dev/null
}

restart_service() {
    local name=$1
    local port=$2
    local script=""
    local logdir="$WORKSPACE/data"
    
    case $name in
        keeper) script="$WORKSPACE/fleet/services/keeper.py";;
        agent-api) script="$WORKSPACE/fleet/services/agent_api.py";;
        mud) script="$WORKSPACE/fleet/services/mud_telnet.py";;
        plato-server) script="$WORKSPACE/fleet/services/plato.py";;
    esac
    
    if [ -f "$script" ]; then
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] RESTART $name:$port via $script" >> "$LOG"
        pkill -f "$(basename $script)" 2>/dev/null
        sleep 1
        nohup python3 "$script" > "$logdir/${name}.log" 2>&1 &
    else
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] MISSING $script" >> "$LOG"
    fi
}

# Check disk
DISK_PCT=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_PCT" -gt 90 ]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] P0 DISK $DISK_PCT%" >> "$LOG"
    rm -rf /home/ubuntu/.cache/pip /home/ubuntu/.cache/uv 2>/dev/null
fi

# Check each service
for svc in "${SERVICES[@]}"; do
    name="${svc%%:*}"
    port="${svc##*:}"
    if ! check_port "$port"; then
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] DOWN $name:$port" >> "$LOG"
        restart_service "$name" "$port"
        sleep 3
        if check_port "$port"; then
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] RECOVERED $name:$port" >> "$LOG"
        else
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] FAILED $name:$port" >> "$LOG"
        fi
    fi
done

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] OK — all services checked" >> "$LOG"

# Check zeroclaw loop
if ! pgrep -f "zc_loop" > /dev/null; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] DOWN zeroclaw-loop — restarting" >> "$LOG"
    nohup bash "$WORKSPACE/scripts/zc_loop.sh" > /dev/null 2>&1 &
fi

# Grammar Compactor (port 4055)
check_and_start 4055 'python3 /home/ubuntu/.openclaw/workspace/fleet/services/grammar_compactor.py' '/tmp/grammar-compactor.log'

# Rate Attention (port 4056)
check_and_start 4056 'python3 /home/ubuntu/.openclaw/workspace/fleet/services/rate_attention.py' '/tmp/rate-attention.log'

# Skill Forge (port 4057)
check_and_start 4057 'GROQ_API_KEY=$(grep GROQ_API_KEY ~/.bashrc | cut -d\" -f2) DEEPSEEK_API_KEY=$(grep DEEPSEEK_API_KEY ~/.bashrc | cut -d\" -f2) DEEPINFRA_API_KEY=$(grep DEEPINFRA_API_KEY ~/.bashrc | cut -d\" -f2) python3 /home/ubuntu/.openclaw/workspace/fleet/services/skill_forge.py' '/tmp/skill-forge.log'
