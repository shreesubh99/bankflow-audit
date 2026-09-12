#!/usr/bin/env bash

# ==============================================================================
#  BankFlow Audit Intelligence - 100% Automated Debian Auto-Installer
#  Configures: System packages, Python venv, Systemd Auto-Boot, & Split-Screen Runner
# ==============================================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}"
CURRENT_USER="$(whoami)"
USER_HOME="${HOME:-/root}"

echo "=========================================================="
echo "    🚀 BankFlow Audit Intelligence - Automated Setup      "
echo "=========================================================="
echo "Installing as user: ${CURRENT_USER}"
echo "Directory: ${SCRIPT_DIR}"

# 1. System packages
echo ""
echo "[1/5] Installing Debian system packages..."
sudo apt-get update -y
sudo apt-get install -y python3 python3-pip python3-venv curl unzip tmux psmisc net-tools

# 2. Setup Python backend virtual environment
echo ""
echo "[2/5] Setting up Python virtual environment..."
cd "${SCRIPT_DIR}/backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 3. Check or Build Frontend
echo ""
echo "[3/5] Verifying Frontend Web GUI assets..."
cd "${SCRIPT_DIR}/frontend"
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "✅ Pre-built frontend verified in frontend/dist. (Zero Node.js dependency required on Debian)"
elif command -v npm &> /dev/null; then
    echo "Building frontend with npm..."
    npm install
    npm run build
fi

# 4. Make all scripts executable
echo ""
echo "[4/5] Setting script execution permissions..."
cd "${SCRIPT_DIR}"
chmod +x setup-debian.sh start-all.sh 2>/dev/null || true

cat << 'EOF' > "${SCRIPT_DIR}/run.sh"
#!/usr/bin/env bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}/backend"
source venv/bin/activate
echo "Starting BankFlow Audit on http://0.0.0.0:8080 ..."
uvicorn app.main:app --host 0.0.0.0 --port 8080
EOF
chmod +x "${SCRIPT_DIR}/run.sh"

# 5. Automatically install and configure systemd service for Auto-Restart on boot
echo ""
echo "[5/5] Configuring systemd Auto-Start service (Reboot Auto-Run)..."
SERVICE_PATH="/etc/systemd/system/office-servers.service"

sudo bash -c "cat << 'EOF' > ${SERVICE_PATH}
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

sudo systemctl daemon-reload
sudo systemctl enable office-servers.service
echo "✅ systemd service 'office-servers' successfully installed and enabled for auto-boot!"

# Detect Local IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$LOCAL_IP" ] && LOCAL_IP="127.0.0.1"

echo ""
echo "=========================================================="
echo "  🎉 ALL CONFIGURATIONS COMPLETED AUTOMATICALLY!          "
echo "=========================================================="
echo "  • BankFlow Audit Web GUI:  http://${LOCAL_IP}:8080      "
echo "  • WhatsApp Bot API:         http://${LOCAL_IP}:3333      "
echo "  • WhatsApp AI Agent API:    http://${LOCAL_IP}:8000      "
echo "  • System Orchestration API: http://${LOCAL_IP}:8080/api/system/status"
echo ""
echo "  • Auto-Restart on Boot:     ENABLED (systemd service)   "
echo "  • Live Split Terminal:      Run 'bash start-all.sh'     "
echo "=========================================================="
echo ""

read -p "Do you want to launch both servers now in split-screen? (y/n): " -n 1 -r || true
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    bash "${SCRIPT_DIR}/start-all.sh"
fi
