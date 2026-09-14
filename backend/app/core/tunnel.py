import os
import socket
import subprocess
import time
import json
import logging
from typing import Optional
from pathlib import Path

logger = logging.getLogger("bankflow.tunnel")

NGROK_DEFAULT_TOKEN = "31yGVbAOlk0V2i0vjxJLHGkLclx_6XXNTqL8u39utRass2MB8"

def get_local_ip() -> str:
    """Discovers machine LAN IP address instead of 0.0.0.0"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"

def get_ngrok_url() -> Optional[str]:
    """Queries active ngrok tunnel from local ngrok agent API (Port 4040)"""
    try:
        import urllib.request
        req = urllib.request.Request("http://127.0.0.1:4040/api/tunnels", headers={"User-Agent": "BankFlowAudit"})
        with urllib.request.urlopen(req, timeout=1.0) as res:
            data = json.loads(res.read().decode("utf-8"))
            for tunnel in data.get("tunnels", []):
                public_url = tunnel.get("public_url", "")
                if public_url.startswith("https://") and "8080" in str(tunnel.get("config", {}).get("addr", "")):
                    return public_url
                # If any https tunnel exists
                if public_url.startswith("https://"):
                    return public_url
    except Exception:
        pass
    return None

def ensure_ngrok_tunnel(port: int = 8080) -> Optional[str]:
    """Ensures ngrok tunnel is running on port 8080 and returns public https URL"""
    existing_url = get_ngrok_url()
    if existing_url:
        return existing_url

    # Check if ngrok CLI is installed
    try:
        # 1. Ensure token configured
        token = os.getenv("NGROK_AUTHTOKEN", NGROK_DEFAULT_TOKEN)
        subprocess.run(f"ngrok config add-authtoken {token} >/dev/null 2>&1", shell=True)

        # 2. Launch background ngrok process
        cmd = f"nohup ngrok http {port} --log=stdout > /tmp/ngrok-bankflow.log 2>&1 &"
        subprocess.Popen(cmd, shell=True, preexec_fn=os.setpgrp if os.name != "nt" else None)

        # Wait up to 3 seconds for ngrok API to come up
        for _ in range(6):
            time.sleep(0.5)
            url = get_ngrok_url()
            if url:
                return url
    except Exception as e:
        logger.warning(f"Could not auto-start ngrok CLI: {e}")

    # Fallback to pyngrok if available
    try:
        from pyngrok import ngrok, conf
        token = os.getenv("NGROK_AUTHTOKEN", NGROK_DEFAULT_TOKEN)
        if token:
            ngrok.set_auth_token(token)
        tunnel = ngrok.connect(port, "http")
        return tunnel.public_url.replace("http://", "https://")
    except Exception as e:
        logger.warning(f"pyngrok fallback failed: {e}")

    return None
