#!/usr/bin/env bash

# ==============================================================================
#  BankFlow Audit Intelligence - 100% Automated Debian Auto-Installer
#  Configures: System packages, Standalone Ngrok CLI, Python venv, & Systemd Auto-Boot
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}"
CURRENT_USER="$(whoami)"
USER_HOME="${HOME:-/root}"

SUDO=""
if [ "$EUID" -ne 0 ]; then
    if command -v sudo &> /dev/null; then
        SUDO="sudo"
    fi
fi

echo "=========================================================="
echo "    🚀 BankFlow Audit Intelligence - Automated Setup      "
echo "=========================================================="
echo "Installing as user: ${CURRENT_USER}"
echo "Directory: ${SCRIPT_DIR}"

# 1. System packages
echo ""
echo "[1/4] Installing system prerequisites..."
${SUDO} apt-get update -y
${SUDO} apt-get install -y python3 python3-pip python3-venv curl unzip tmux psmisc net-tools 2>/dev/null || true

# 2. Install Standalone Ngrok binary directly
echo ""
echo "[2/4] Installing official Ngrok binary..."
NGROK_BIN="$(command -v ngrok 2>/dev/null || true)"
if [ -z "$NGROK_BIN" ] || [ ! -x "$NGROK_BIN" ]; then
    mkdir -p "$HOME/.local/bin"
    curl -sSL https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz | tar -xz -C "$HOME/.local/bin/" 2>/dev/null || true
    if [ -x "$HOME/.local/bin/ngrok" ]; then
        NGROK_BIN="$HOME/.local/bin/ngrok"
        if [ "$EUID" -eq 0 ] || [ -n "$SUDO" ]; then
            ${SUDO} cp "$NGROK_BIN" /usr/local/bin/ngrok 2>/dev/null || true
        fi
    fi
fi

# Configure Ngrok authtoken
NGROK_TOKEN="3JJNxFDVxF4bN1aEmOO5z8PdQl1_68npyebonUDGDWLogrCFS"
if [ -n "$NGROK_BIN" ]; then
    "$NGROK_BIN" config add-authtoken "${NGROK_TOKEN}" >/dev/null 2>&1 || true
    echo "✅ Ngrok authtoken configured successfully!"
fi

# 3. Setup Python backend virtual environment
echo ""
echo "[3/4] Setting up Python backend..."
cd "${SCRIPT_DIR}/backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv 2>/dev/null || python3 -m venv --without-pip venv 2>/dev/null || true
fi

if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

pip install --upgrade pip 2>/dev/null || true
pip install -r requirements.txt 2>/dev/null || pip3 install -r requirements.txt 2>/dev/null || true

# 4. Make all scripts executable
echo ""
echo "[4/4] Finalizing scripts and Auto-Boot service..."
cd "${SCRIPT_DIR}"
chmod +x setup-debian.sh start-all.sh run.sh 2>/dev/null || true

# Configure systemd service for Auto-Restart on boot
SERVICE_PATH="/etc/systemd/system/office-servers.service"
if [ "$EUID" -eq 0 ] || [ -n "$SUDO" ]; then
${SUDO} bash -c "cat << 'EOF' > ${SERVICE_PATH}
[Unit]
Description=Office Suite - Parallel WhatsApp Bot and BankFlow Audit Servers
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=forking
User=${CURRENT_USER}
WorkingDirectory=${SCRIPT_DIR}
ExecStart=/bin/bash ${SCRIPT_DIR}/start-all.sh
ExecStop=/usr/bin/tmux kill-session -t office-servers
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF"

${SUDO} systemctl daemon-reload 2>/dev/null || true
${SUDO} systemctl enable office-servers.service 2>/dev/null || true
echo "✅ systemd service 'office-servers' enabled for automatic boot!"
fi

echo ""
echo "=========================================================="
echo "  🎉 SETUP COMPLETED SUCCESSFULLY!                        "
echo "=========================================================="
echo "  To start the dual-screen servers right now, run:        "
echo "     bash start-all.sh --restart                          "
echo "=========================================================="
echo ""
