#!/usr/bin/env bash

# ==============================================================================
#  BankFlow Audit Intelligence - Local & Remote Launcher with Ngrok
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}/backend"
source venv/bin/activate 2>/dev/null || true

# Ensure ngrok is authenticated
NGROK_TOKEN="3JJNxFDVxF4bN1aEmOO5z8PdQl1_68npyebonUDGDWLogrCFS"
if command -v ngrok &> /dev/null; then
    ngrok config add-authtoken "${NGROK_TOKEN}" 2>/dev/null || true
    # Start ngrok tunnel in background if not already running on 8080
    if ! curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -q "8080"; then
        echo "[Tunnel] Starting ngrok tunnel for Port 8080..."
        nohup ngrok http 8080 --log=stdout > /tmp/ngrok-bankflow.log 2>&1 &
        sleep 2
    fi
fi

LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$LOCAL_IP" ] && LOCAL_IP="127.0.0.1"

NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -n 1 | cut -d'"' -f4)

echo "=================================================================="
echo "  🚀 BankFlow Audit Intelligence Server                           "
echo "=================================================================="
echo "  🏠 Local Network Access:     http://${LOCAL_IP}:8080"
if [ -n "${NGROK_URL}" ]; then
    echo "  🌍 Anywhere Internet Access:  ${NGROK_URL}"
    echo "     (Open this link on any mobile, PC or network anywhere!)"
else
    echo "  🌍 Anywhere Internet Access:  Connecting ngrok tunnel..."
fi
echo "=================================================================="

uvicorn app.main:app --host 0.0.0.0 --port 8080
