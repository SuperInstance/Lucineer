#!/bin/bash
# service-guard.sh — Automated service monitoring and restart
# Automates the mine shaft so Oracle1 can play at the bench.

SERVICES=(
    "keeper:8900:http"
    "agent-api:8901:http"
    "holodeck:7778:telnet"
    "seed-mcp:9438:http"
    "shell:8846:http"
)

LOG="/tmp/service-guard.log"

restart_service() {
    local name=$1
    local port=$2
    local type=$3
    echo "[$(date -u +%H:%M:%S)] RESTARTING $name on :$port" >> "$LOG"
    
    case $name in
        holodeck)
            pkill -f "target/release/holodeck" 2>/dev/null
            sleep 1
            cd /tmp/holodeck-rust && nohup ./target/release/holodeck --port $port > /tmp/holodeck.log 2>&1 &
            ;;
        agent-api)
            pkill -f agent_api.py 2>/dev/null
            sleep 1
            cd /tmp && nohup python3 agent_api.py > /tmp/agent_api.log 2>&1 &
            ;;
        keeper)
            cd /tmp/brothers-keeper && nohup python3 keeper.py > /tmp/keeper.log 2>&1 &
            ;;
        *)
            echo "[$(date -u +%H:%M:%S)] Unknown service: $name" >> "$LOG"
            ;;
    esac
    sleep 2
}

check_service() {
    local port=$1
    local type=$2
    
    if [ "$type" = "telnet" ]; then
        echo "test" | nc -w 2 localhost $port 2>&1 | head -1 | grep -q . && return 0 || return 1
    else
        curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:$port/ 2>/dev/null | grep -q . && return 0 || return 1
    fi
}

# Main loop
echo "[$(date -u +%H:%M:%S)] Service guard running" >> "$LOG"

for svc in "${SERVICES[@]}"; do
    IFS=':' read -r name port type <<< "$svc"
    if ! check_service "$port" "$type"; then
        echo "[$(date -u +%H:%M:%S)] $name :$port DOWN — restarting" >> "$LOG"
        restart_service "$name" "$port" "$type"
    fi
done

# PLATO Room Server
if ! curl -s -o /dev/null -w '' http://localhost:8847/status 2>/dev/null; then
    log "plato-server :8847 DOWN — restarting"
    RESTART_PLATO=1
fi

if [ "$RESTART_PLATO" = "1" ]; then
    pkill -f plato-room-server 2>/dev/null
    sleep 1
    nohup python3 /tmp/plato-room-server.py > /tmp/plato-server.log 2>&1 &
    log "RESTARTED plato-server on :8847"
fi
