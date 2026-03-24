#!/usr/bin/env bash
set -euo pipefail

# Smart Home Ranch Template — Setup
# Imports the smart-home herd and optionally configures hardware integrations.
# Usage: bash examples/smart-home/setup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RANCH_DIR="${RANCH_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_green()  { echo -e "${GREEN}[Smart Home Ranch]${NC} $*"; }
log_info()   { echo -e "${CYAN}[Smart Home Ranch]${NC} $*"; }
log_yellow() { echo -e "${YELLOW}[Smart Home Ranch]${NC} $*"; }

echo ""
log_green "Setting up Smart Home Ranch template..."
echo ""

# Check Ranch is installed
if [ ! -f "$RANCH_DIR/package.json" ]; then
  echo "Error: Ranch not found at $RANCH_DIR"
  echo "Run: make install  (from your Ranch directory)"
  exit 1
fi

cd "$RANCH_DIR"

# Check bun is available
if ! command -v bun &>/dev/null; then
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

# ---------------------------------------------------------------------------
# Detect Jetson for GPIO setup
# ---------------------------------------------------------------------------
IS_JETSON=false
if [ -f /etc/nv_tegra_release ]; then
  IS_JETSON=true
  log_info "Jetson detected — will configure GPIO permissions"
fi

# ---------------------------------------------------------------------------
# Create herd
# ---------------------------------------------------------------------------
log_info "Creating Smart Home herd..."

if bun run scripts/import-herd.ts --file examples/smart-home/agents.json 2>/dev/null; then
  log_green "Herd imported via Ranch CLI"
else
  log_info "Seeding database directly..."

  cat > /tmp/smarthome-seed.ts << 'SEED'
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const herd = await prisma.user.upsert({
    where: { email: "smarthome-ranch@local" },
    update: {},
    create: {
      email: "smarthome-ranch@local",
      name: "Smart Home Ranch",
    },
  });

  console.log(`Smart Home Ranch created: ${herd.id}`);
  console.log("");
  console.log("Agents to create in http://localhost:3000/agent-cells:");
  console.log("  1. Observer    - sensor monitoring, anomaly detection");
  console.log("  2. Reasoner    - context interpretation, intent inference");
  console.log("  3. Controller  - action decisions with safety constraints");
  console.log("  4. Logger      - event recording, pattern building");
}

main().catch(console.error).finally(() => prisma.$disconnect());
SEED

  bunx tsx /tmp/smarthome-seed.ts
  rm /tmp/smarthome-seed.ts
fi

# ---------------------------------------------------------------------------
# Optional: Jetson GPIO setup
# ---------------------------------------------------------------------------
if [ "$IS_JETSON" = true ]; then
  echo ""
  log_info "Configuring Jetson GPIO permissions for Controller agent..."

  # Install GPIO library if not present
  if ! python3 -c "import Jetson.GPIO" 2>/dev/null; then
    log_info "Installing Jetson.GPIO..."
    pip3 install Jetson.GPIO --quiet || log_yellow "GPIO install failed — install manually: pip3 install Jetson.GPIO"
  fi

  # Set up GPIO group and permissions
  sudo groupadd -f -r gpio 2>/dev/null || true
  sudo usermod -a -G gpio "$USER" 2>/dev/null || log_yellow "Could not add user to gpio group"

  if [ -f /opt/nvidia/jetson-gpio/etc/99-gpio.rules ]; then
    sudo cp /opt/nvidia/jetson-gpio/etc/99-gpio.rules /etc/udev/rules.d/ 2>/dev/null || true
    sudo udevadm control --reload-rules && sudo udevadm trigger || true
    log_green "GPIO permissions configured"
  else
    log_yellow "GPIO udev rules not found — GPIO access may require sudo"
  fi
fi

# ---------------------------------------------------------------------------
# Optional: MQTT broker check
# ---------------------------------------------------------------------------
echo ""
if command -v mosquitto &>/dev/null; then
  log_green "Mosquitto MQTT broker found"
  if ! pgrep mosquitto &>/dev/null; then
    log_yellow "Mosquitto not running — start with: sudo systemctl start mosquitto"
  fi
else
  log_yellow "Mosquitto not installed. For MQTT integration:"
  log_yellow "  sudo apt-get install -y mosquitto mosquitto-clients"
  log_yellow "  sudo systemctl enable --now mosquitto"
fi

# ---------------------------------------------------------------------------
# Success
# ---------------------------------------------------------------------------
echo ""
log_green "Smart Home Ranch template installed!"
echo ""
echo "  Herd name:  smart-home"
echo "  Agents:     Observer, Reasoner, Controller, Logger"
echo "  Web UI:     http://localhost:3000/agent-cells"
echo ""
echo "  To configure GPIO and MQTT, add to your .env:"
echo "    GPIO_ENABLED=\"true\""
echo "    MQTT_BROKER=\"mqtt://localhost:1883\""
echo ""
echo "  Safety constraints: examples/smart-home/safety.json"
echo ""
log_yellow "Note: log out and back in for GPIO group permissions to take effect."
echo ""
