#!/usr/bin/env bash

# ==============================================================================
#  BankFlow Audit Intelligence - Local & Remote Launcher with Guaranteed Ngrok
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}/backend"

# 1. Activate or setup Python venv
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "${SCRIPT_DIR}/venv/bin/activate" ]; then
    source "${SCRIPT_DIR}/venv/bin/activate"
fi

# If fastapi is missing in current environment, install requirements
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "[System] Installing missing Python requirements..."
    pip install -r requirements.txt 2>/dev/null || pip3 install -r requirements.txt 2>/dev/null || true
fi

# 2. Locate or Install standalone Ngrok binary
NGROK_BIN="$(command -v ngrok 2>/dev/null || true)"
if [ -z "$NGROK_BIN" ]; then
    for path in "/usr/local/bin/ngrok" "/usr/bin/ngrok" "$HOME/.local/bin/ngrok" "$HOME/ngrok" "${SCRIPT_DIR}/ngrok"; do
        if [ -x "$path" ]; then
            NGROK_BIN="$path"
            break
        fi
    done
fi

if [ -z "$NGROK_BIN" ]; then
    echo "[Ngrok] Downloading standalone ngrok binary..."
    mkdir -p "$HOME/.local/bin"
    curl -sSL https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz | tar -xz -C "$HOME/.local/bin/" 2>/dev/null || true
    if [ -x "$HOME/.local/bin/ngrok" ]; then
        NGROK_BIN="$HOME/.local/bin/ngrok"
    fi
fi

# 3. Configure Ngrok Authtoken
NGROK_TOKEN="3JJNxFDVxF4bN1aEmOO5z8PdQl1_68npyebonUDGDWLogrCFS"
if [ -n "$NGROK_BIN" ]; then
    "$NGROK_BIN" config add-authtoken "${NGROK_TOKEN}" >/dev/null 2>&1 || true
fi

# 4. Clean old 8080 processes
fuser -k 8080/tcp 2>/dev/null || true
pkill -f 'ngrok http 8080' 2>/dev/null || true
sleep 1

# 5. Start Ngrok Tunnel in background
if [ -n "$NGROK_BIN" ]; then
    echo "[Tunnel] Starting Ngrok tunnel for Port 8080..."
    nohup "$NGROK_BIN" http 8080 --log=stdout > /tmp/ngrok-bankflow.log 2>&1 &
fi

# 6. Wait up to 6 seconds for Ngrok Public URL to become active
NGROK_URL=""
for i in {1..12}; do
    NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -n 1 | cut -d'"' -f4 || true)
    if [ -n "$NGROK_URL" ]; then
        break
    fi
    sleep 0.5
done

# 7. Discover Real Local LAN IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
fi
[ -z "$LOCAL_IP" ] && LOCAL_IP="127.0.0.1"

# 8. Print Massive Clear Banner
echo ""
echo "=========================================================================="
echo "  🚀 BANKFLOW AUDIT INTELLIGENCE IS NOW LIVE!                             "
echo "=========================================================================="
if [ -n "$NGROK_URL" ]; then
echo "  🌍 REMOTE INTERNET URL (Any PC / Mobile / Outside Office):               "
echo "     👉  ${NGROK_URL}  👈"
echo "     (Open this link in Chrome / Edge from ANYWHERE in the world!)         "
else
echo "  🌍 REMOTE NGROK URL: Starting background agent (check in a few seconds)  "
fi
echo "--------------------------------------------------------------------------"
echo "  🏠 LOCAL NETWORK URL (Same Wi-Fi / Office PC):                           "
echo "     👉  http://${LOCAL_IP}:8080  👈"
echo "=========================================================================="
echo ""

# 9. Run FastAPI Server
exec uvicorn app.main:app --host 0.0.0.0 --port 8080
