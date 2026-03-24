#!/usr/bin/env bash
set -euo pipefail

# Coder Ranch Template — Setup
# Imports the coder herd template into your running Ranch.
# Usage: bash examples/coder/setup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RANCH_DIR="${RANCH_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_green()  { echo -e "${GREEN}[Coder Ranch]${NC} $*"; }
log_info()   { echo -e "${CYAN}[Coder Ranch]${NC} $*"; }
log_yellow() { echo -e "${YELLOW}[Coder Ranch]${NC} $*"; }

echo ""
log_green "Setting up Coder Ranch template..."
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

log_info "Creating Coder herd..."

if bun run scripts/import-herd.ts --file examples/coder/agents.json 2>/dev/null; then
  log_green "Herd imported via Ranch CLI"
else
  log_info "Seeding database directly..."

  cat > /tmp/coder-seed.ts << 'SEED'
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const herd = await prisma.user.upsert({
    where: { email: "coder-ranch@local" },
    update: {},
    create: {
      email: "coder-ranch@local",
      name: "Coder Ranch",
    },
  });

  console.log(`Coder Ranch created: ${herd.id}`);
  console.log("");
  console.log("Agents to create in http://localhost:3000/agent-cells:");
  console.log("  1. Architect   - system: Design reviewer, anti-pattern detector");
  console.log("  2. Implementer - system: Code generator matching codebase patterns");
  console.log("  3. Reviewer    - system: Code reviewer, security and correctness");
  console.log("  4. Documenter  - system: Documentation and API reference generator");
}

main().catch(console.error).finally(() => prisma.$disconnect());
SEED

  bunx tsx /tmp/coder-seed.ts
  rm /tmp/coder-seed.ts
fi

echo ""
log_green "Coder Ranch template installed!"
echo ""
echo "  Herd name:  coder"
echo "  Agents:     Architect, Implementer, Reviewer, Documenter"
echo "  Web UI:     http://localhost:3000/agent-cells"
echo ""
log_yellow "Important: Seed your codebase into the Memory Pasture for best results."
echo "  1. Go to http://localhost:3000/crdt-lab"
echo "  2. Click Bulk Import and select your codebase directory"
echo "  3. Click Index"
echo ""
echo "  After indexing, the Implementer will match your team's code style."
echo ""
