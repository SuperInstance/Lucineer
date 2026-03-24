#!/usr/bin/env bash
set -euo pipefail

# SuperInstance Ranch — Jetson Installer
# Tested on: Jetson Orin Nano 8GB (JetPack 6.1+), Jetson AGX Orin
# Usage: curl -sSL https://install.superinstance.ai | bash
#    or: bash scripts/install_jetson.sh

RANCH_DIR="${RANCH_DIR:-$HOME/ranch}"
BRANCH="${BRANCH:-main}"
REPO="https://github.com/SuperInstance/Lucineer"

# ---------------------------------------------------------------------------
# Color output helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_green()  { echo -e "${GREEN}[Ranch]${NC} $*"; }
log_yellow() { echo -e "${YELLOW}[Ranch]${NC} $*"; }
log_red()    { echo -e "${RED}[Ranch] ERROR:${NC} $*" >&2; }
log_info()   { echo -e "${CYAN}[Ranch]${NC} $*"; }
log_bold()   { echo -e "${BOLD}$*${NC}"; }

die() {
  log_red "$*"
  exit 1
}

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo ""
log_bold "  ____"
log_bold " /    \\        ~ LLM Alpha ~   ~ LLM Beta ~   ~ LLM Gamma ~"
log_bold "| o  o |            (*)              (*)              (*)"
log_bold " \\  __ /       ________________________________________________"
log_bold "  |    |      |                                                |"
log_bold "  [ COLLIE ]  |           M E M O R Y   P A S T U R E        |"
log_bold "ORCHESTRATOR  |________________________________________________|"
echo ""
log_green "SuperInstance Ranch Installer"
log_info  "Repo:      $REPO"
log_info  "Target:    $RANCH_DIR"
log_info  "Branch:    $BRANCH"
echo ""

# ---------------------------------------------------------------------------
# Detect platform
# ---------------------------------------------------------------------------
IS_JETSON=false
JETSON_MODEL="unknown"

detect_jetson() {
  if [ -f /etc/nv_tegra_release ]; then
    IS_JETSON=true
    JETSON_MODEL=$(grep -i "board" /etc/nv_tegra_release 2>/dev/null | head -1 || echo "Jetson")
    log_green "Detected Jetson hardware: $JETSON_MODEL"
  elif grep -qi "jetson" /proc/device-tree/model 2>/dev/null; then
    IS_JETSON=true
    JETSON_MODEL=$(cat /proc/device-tree/model 2>/dev/null | tr -d '\0' || echo "Jetson")
    log_green "Detected Jetson hardware: $JETSON_MODEL"
  else
    log_yellow "Not a Jetson — installing for generic Linux. CUDA features will auto-detect."
  fi
}

detect_jetson

# ---------------------------------------------------------------------------
# Jetson-specific: max performance + swap
# ---------------------------------------------------------------------------
if [ "$IS_JETSON" = true ]; then
  log_info "Configuring Jetson for maximum performance..."

  if command -v nvpmodel &>/dev/null; then
    log_info "Setting nvpmodel to max performance (mode 0)..."
    sudo nvpmodel -m 0 || log_yellow "nvpmodel failed — skipping (may need sudo)"
  else
    log_yellow "nvpmodel not found — skipping power mode config"
  fi

  if command -v jetson_clocks &>/dev/null; then
    log_info "Running jetson_clocks to lock clocks at max frequency..."
    sudo jetson_clocks || log_yellow "jetson_clocks failed — skipping"
  else
    log_yellow "jetson_clocks not found — skipping clock config"
  fi
fi

# ---------------------------------------------------------------------------
# Configure swap (16GB recommended for LoRA breeding on Orin Nano)
# ---------------------------------------------------------------------------
configure_swap() {
  local SWAP_FILE="/swapfile"
  local SWAP_SIZE_GB=16

  if swapon --show | grep -q "$SWAP_FILE" 2>/dev/null; then
    log_green "Swap already configured at $SWAP_FILE — skipping"
    return
  fi

  if [ -f "$SWAP_FILE" ]; then
    log_yellow "Swap file exists but not active — activating..."
    sudo swapon "$SWAP_FILE" || log_yellow "Could not activate swap — skipping"
    return
  fi

  log_info "Creating ${SWAP_SIZE_GB}GB swap file at $SWAP_FILE (needed for Night School LoRA breeding)..."

  AVAILABLE_DISK=$(df -BG / | awk 'NR==2{print $4}' | tr -d 'G')
  if [ "${AVAILABLE_DISK:-0}" -lt "$((SWAP_SIZE_GB + 4))" ] 2>/dev/null; then
    log_yellow "Less than $((SWAP_SIZE_GB + 4))GB disk available — skipping swap creation"
    return
  fi

  sudo fallocate -l "${SWAP_SIZE_GB}G" "$SWAP_FILE" || {
    log_yellow "fallocate failed — trying dd (slower)..."
    sudo dd if=/dev/zero of="$SWAP_FILE" bs=1G count="$SWAP_SIZE_GB" status=progress || {
      log_yellow "Could not create swap file — skipping"
      return
    }
  }
  sudo chmod 600 "$SWAP_FILE"
  sudo mkswap "$SWAP_FILE"
  sudo swapon "$SWAP_FILE"

  # Persist across reboots
  if ! grep -q "$SWAP_FILE" /etc/fstab 2>/dev/null; then
    echo "$SWAP_FILE none swap sw 0 0" | sudo tee -a /etc/fstab >/dev/null
    log_green "Swap persisted to /etc/fstab"
  fi

  log_green "Swap configured: ${SWAP_SIZE_GB}GB"
}

configure_swap

# ---------------------------------------------------------------------------
# System dependencies
# ---------------------------------------------------------------------------
log_info "Installing system dependencies..."

if command -v apt-get &>/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    python3-pip \
    python3-dev \
    ca-certificates \
    unzip \
    || die "apt-get install failed"
elif command -v yum &>/dev/null; then
  sudo yum install -y curl git gcc gcc-c++ make python3-pip || die "yum install failed"
elif command -v pacman &>/dev/null; then
  sudo pacman -Sy --noconfirm curl git base-devel python-pip || die "pacman install failed"
else
  log_yellow "Unknown package manager — please install: curl git build-essential python3-pip"
fi

log_green "System dependencies installed"

# ---------------------------------------------------------------------------
# Rust (required for some native deps)
# ---------------------------------------------------------------------------
if command -v rustup &>/dev/null; then
  log_green "Rust already installed ($(rustc --version 2>/dev/null || echo 'version unknown'))"
else
  log_info "Installing Rust via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path || die "Rust install failed"
  export PATH="$HOME/.cargo/bin:$PATH"
  log_green "Rust installed: $(rustc --version)"
fi

# Ensure cargo is in PATH for this session
export PATH="$HOME/.cargo/bin:$PATH"

# ---------------------------------------------------------------------------
# Bun
# ---------------------------------------------------------------------------
if command -v bun &>/dev/null; then
  log_green "Bun already installed ($(bun --version))"
else
  log_info "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash || die "Bun install failed"
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  log_green "Bun installed: $(bun --version)"
fi

# Ensure bun is in PATH
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

# ---------------------------------------------------------------------------
# CUDA toolkit check (warn only — Ranch works without GPU, just slower)
# ---------------------------------------------------------------------------
check_cuda() {
  if command -v nvcc &>/dev/null; then
    CUDA_VER=$(nvcc --version | grep -oP 'release \K[\d.]+' | head -1 || echo "unknown")
    log_green "CUDA toolkit found: $CUDA_VER"
  elif command -v nvidia-smi &>/dev/null; then
    log_green "NVIDIA driver found ($(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1 || echo 'version unknown'))"
    log_yellow "CUDA toolkit (nvcc) not found — GPU acceleration may be limited. Install CUDA for full Ranch performance."
  elif [ "$IS_JETSON" = true ]; then
    # Jetson has CUDA integrated — check via jtop or tegrastats
    log_green "Jetson CUDA: integrated (no nvcc check needed for JetPack builds)"
  else
    log_yellow "No CUDA detected. Ranch will run in CPU mode (slower). Install CUDA 11.8+ for GPU acceleration."
    log_yellow "CUDA install: https://developer.nvidia.com/cuda-downloads"
  fi
}

check_cuda

# ---------------------------------------------------------------------------
# Clone or update repo
# ---------------------------------------------------------------------------
if [ -d "$RANCH_DIR/.git" ]; then
  log_green "Ranch repo already at $RANCH_DIR — pulling latest..."
  git -C "$RANCH_DIR" fetch origin
  git -C "$RANCH_DIR" checkout "$BRANCH" 2>/dev/null || log_yellow "Branch $BRANCH not found locally — staying on current branch"
  git -C "$RANCH_DIR" pull origin "$BRANCH" --ff-only 2>/dev/null || log_yellow "Could not fast-forward — repo may have local changes"
else
  log_info "Cloning SuperInstance Ranch to $RANCH_DIR..."
  mkdir -p "$(dirname "$RANCH_DIR")"
  git clone --branch "$BRANCH" "$REPO" "$RANCH_DIR" || die "git clone failed. Check your internet connection."
  log_green "Repo cloned to $RANCH_DIR"
fi

cd "$RANCH_DIR"

# ---------------------------------------------------------------------------
# Environment setup
# ---------------------------------------------------------------------------
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    log_green "Created .env from .env.example — edit $RANCH_DIR/.env to customize"
  else
    log_yellow ".env.example not found — skipping .env creation. Create .env manually."
  fi
else
  log_green ".env already exists — skipping (not overwriting your config)"
fi

# ---------------------------------------------------------------------------
# Install Node/Bun dependencies
# ---------------------------------------------------------------------------
log_info "Installing project dependencies (bun install)..."
bun install || die "bun install failed"
log_green "Dependencies installed"

# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------
log_info "Setting up database (bunx prisma db push)..."
bunx prisma db push --accept-data-loss 2>/dev/null || {
  log_yellow "prisma db push failed — you may need to set DATABASE_URL in .env"
  log_yellow "Run manually: cd $RANCH_DIR && bunx prisma db push"
}
log_green "Database ready"

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
log_info "Building Ranch web UI..."
if [ -f "Makefile" ] && grep -q "^build:" Makefile 2>/dev/null; then
  make build || {
    log_yellow "make build failed — falling back to bun run build"
    bun run build || log_yellow "Build failed — you can still run in dev mode with: make run"
  }
else
  bun run build || log_yellow "Build failed — you can still run in dev mode: cd $RANCH_DIR && bun run dev"
fi

# ---------------------------------------------------------------------------
# Success!
# ---------------------------------------------------------------------------
echo ""
log_bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_green "  SuperInstance Ranch installed successfully!"
log_bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "Ranch directory: $RANCH_DIR"
log_info "Web UI:          http://localhost:3000"
echo ""
log_bold "Next steps:"
echo ""
echo "  1. Review your config:   nano $RANCH_DIR/.env"
echo "  2. Start the Ranch:      cd $RANCH_DIR && make run"
echo "  3. Open your browser:    http://localhost:3000"
echo "  4. Create your herd:     Follow docs/tutorials/00-quick-start.md"
echo ""
log_bold "Useful commands:"
echo "  make run          — start development server"
echo "  make start        — start production server"
echo "  make breed        — trigger manual breeding cycle"
echo "  make night-school — launch nightly evolution"
echo "  make benchmark    — run performance benchmarks"
echo ""
log_green "Your Ranch is ready. Happy herding!"
echo ""

# Add bun and cargo to shell profile if not already there
SHELL_PROFILE=""
if [ -f "$HOME/.bashrc" ]; then
  SHELL_PROFILE="$HOME/.bashrc"
elif [ -f "$HOME/.zshrc" ]; then
  SHELL_PROFILE="$HOME/.zshrc"
elif [ -f "$HOME/.profile" ]; then
  SHELL_PROFILE="$HOME/.profile"
fi

if [ -n "$SHELL_PROFILE" ]; then
  if ! grep -q 'BUN_INSTALL' "$SHELL_PROFILE" 2>/dev/null; then
    echo '' >> "$SHELL_PROFILE"
    echo '# Bun (SuperInstance Ranch)' >> "$SHELL_PROFILE"
    echo 'export BUN_INSTALL="$HOME/.bun"' >> "$SHELL_PROFILE"
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> "$SHELL_PROFILE"
    log_green "Added Bun to $SHELL_PROFILE"
  fi
  if ! grep -q '.cargo/bin' "$SHELL_PROFILE" 2>/dev/null; then
    echo '' >> "$SHELL_PROFILE"
    echo '# Rust/Cargo (SuperInstance Ranch)' >> "$SHELL_PROFILE"
    echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> "$SHELL_PROFILE"
    log_green "Added Cargo to $SHELL_PROFILE"
  fi
  log_info "Reload your shell: source $SHELL_PROFILE"
fi
