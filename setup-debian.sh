#!/usr/bin/env bash

# ==============================================================================
#  BankFlow Audit Intelligence - Automated Debian Setup & Build Script
# ==============================================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}"

echo "=========================================================="
echo "    BankFlow Audit Intelligence - Debian Auto-Installer   "
echo "=========================================================="

# 1. System dependencies
echo "[1/4] Installing system packages..."
sudo apt-get update -y
sudo apt-get install -y python3 python3-pip python3-venv curl unzip tmux

# 2. Setup Python backend virtual environment
echo "[2/4] Setting up Python virtual environment..."
cd "${SCRIPT_DIR}/backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 3. Check or Build Frontend
echo "[3/4] Checking Frontend assets..."
cd "${SCRIPT_DIR}/frontend"
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "✅ Pre-built frontend found in frontend/dist. Ready to serve!"
elif command -v npm &> /dev/null; then
    echo "Building frontend with npm..."
    npm install
    npm run build
else
    echo "⚠️ Warning: Node.js not found and frontend/dist missing. Please build frontend on host or install nodejs."
fi

# 4. Create local start script
echo "[4/4] Creating local launcher script..."
cat << 'EOF' > "${SCRIPT_DIR}/run.sh"
#!/usr/bin/env bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}/backend"
source venv/bin/activate
echo "Starting BankFlow Audit on http://0.0.0.0:8080 ..."
uvicorn app.main:app --host 0.0.0.0 --port 8080
EOF
chmod +x "${SCRIPT_DIR}/run.sh"

echo "=========================================================="
echo "  ✅ BankFlow Audit Setup Completed Successfully!         "
echo "  Run manually: bash run.sh                               "
echo "  Access Web GUI: http://<debian-ip>:8080                 "
echo "=========================================================="
