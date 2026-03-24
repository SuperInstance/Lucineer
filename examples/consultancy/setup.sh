#!/usr/bin/env bash
set -euo pipefail

# Consultancy Ranch Template — Setup
# Imports the consultancy herd template into your running Ranch.
# Usage: bash examples/consultancy/setup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RANCH_DIR="${RANCH_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log_green() { echo -e "${GREEN}[Consultancy Ranch]${NC} $*"; }
log_info()  { echo -e "${CYAN}[Consultancy Ranch]${NC} $*"; }

echo ""
log_green "Setting up Consultancy Ranch template..."
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

log_info "Creating Consultancy herd..."

# Import agents via Ranch CLI (if available) or seed directly
if bun run scripts/import-herd.ts --file examples/consultancy/agents.json 2>/dev/null; then
  log_green "Herd imported via Ranch CLI"
else
  log_info "Ranch CLI not yet available — seeding database directly..."

  # Seed the consultancy agents via Prisma seed
  cat > /tmp/consultancy-seed.ts << 'SEED'
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const herd = await prisma.user.upsert({
    where: { email: "consultancy-ranch@local" },
    update: {},
    create: {
      email: "consultancy-ranch@local",
      name: "Consultancy Ranch",
    },
  });

  console.log(`Herd owner created: ${herd.id}`);
  console.log("Consultancy Ranch template ready.");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Open http://localhost:3000/agent-cells");
  console.log("  2. Create 4 agents: Researcher, Analyst, Strategist, Writer");
  console.log("  3. Use the system prompts in examples/consultancy/agents.json");
}

main().catch(console.error).finally(() => prisma.$disconnect());
SEED

  bunx tsx /tmp/consultancy-seed.ts
  rm /tmp/consultancy-seed.ts
fi

echo ""
log_green "Consultancy Ranch template installed!"
echo ""
echo "  Herd name:  consultancy"
echo "  Agents:     Researcher, Analyst, Strategist, Writer"
echo "  Web UI:     http://localhost:3000/agent-cells"
echo ""
echo "  Submit your first task:"
echo "  http://localhost:3000/agent-playground?herd=consultancy"
echo ""
