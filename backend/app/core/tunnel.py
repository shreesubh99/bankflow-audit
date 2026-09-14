import os
import socket
import subprocess
import time
import json
import shutil
import logging
from typing import Optional
from pathlib import Path

logger = logging.getLogger("bankflow.tunnel")

NGROK_DEFAULT_TOKEN = "3JJNxFDVxF4bN1aEmOO5z8PdQl1_68npyebonUDGDWLogrCFS"

def find_ngrok_bin() -> Optional[str]:
    """Finds path to ngrok executable across system paths"""
    candidates = [
        shutil.which("ngrok"),
        "/usr/local/bin/ngrok",
        "/usr/bin/ngrok",
        str(Path.home() / ".local" / "bin" / "ngrok"),
        str(Path.home() / "ngrok"),
        str(Path(__file__).resolve().parent.parent.parent.parent / "ngrok"),
        str(Path(__file__).resolve().parent.parent.parent / "ngrok")
    ]
    for c in candidates:
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return None

def install_ngrok_bin() -> Optional[str]:
    """Downloads official ngrok Linux binary if missing"""
    if os.name == "nt":
        return None
    try:
        dest_dir = Path.home() / ".local" / "bin"
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_file = dest_dir / "ngrok"
        if dest_file.exists():
            return str(dest_file)

        logger.info("[Tunnel] Downloading standalone ngrok binary...")
        cmd = f"curl -sSL https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz | tar -xz -C '{dest_dir}'"
        subprocess.run(cmd, shell=True, timeout=30)
        if dest_file.exists():
            dest_file.chmod(0o755)
            return str(dest_file)
    except Exception as e:
        logger.warning(f"Failed to auto-download ngrok binary: {e}")
    return None

def get_local_ip() -> str:
    """Discovers machine LAN IP address instead of 0.0.0.0"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        pass
    try:
        out = subprocess.check_output("hostname -I 2>/dev/null", shell=True).decode().strip()
        if out:
            return out.split()[0]
    except Exception:
        pass
    return "127.0.0.1"

def get_ngrok_url() -> Optional[str]:
    """Queries active ngrok tunnel from local ngrok agent API (Port 4040)"""
    try:
        import urllib.request
        req = urllib.request.Request("http://127.0.0.1:4040/api/tunnels", headers={"User-Agent": "BankFlowAudit"})
        with urllib.request.urlopen(req, timeout=1.5) as res:
            data = json.loads(res.read().decode("utf-8"))
            for tunnel in data.get("tunnels", []):
                public_url = tunnel.get("public_url", "")
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

    token = os.getenv("NGROK_AUTHTOKEN", NGROK_DEFAULT_TOKEN)

    # 1. Check existing binary or install
    ngrok_bin = find_ngrok_bin()
    if not ngrok_bin:
        ngrok_bin = install_ngrok_bin()

    if ngrok_bin:
        try:
            # Configure authtoken
            subprocess.run(f"'{ngrok_bin}' config add-authtoken {token} >/dev/null 2>&1", shell=True)

            # Start ngrok process
            cmd = f"nohup '{ngrok_bin}' http {port} --log=stdout > /tmp/ngrok-bankflow.log 2>&1 &"
            subprocess.Popen(cmd, shell=True, preexec_fn=os.setpgrp if os.name != "nt" else None)

            # Wait up to 5 seconds for tunnel to establish
            for _ in range(10):
                time.sleep(0.5)
                url = get_ngrok_url()
                if url:
                    return url
        except Exception as e:
            logger.warning(f"Failed to start ngrok via binary: {e}")

    # 2. Fallback to pyngrok if installed
    try:
        from pyngrok import ngrok
        ngrok.set_auth_token(token)
        tunnel = ngrok.connect(port, "http")
        url = tunnel.public_url.replace("http://", "https://")
        return url
    except Exception as e:
        logger.warning(f"pyngrok fallback failed: {e}")

    return None
