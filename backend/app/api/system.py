import os
import socket
import subprocess
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional

router = APIRouter(prefix="/api/system", tags=["System Orchestration"])

def is_port_open(port: int, host: str = "127.0.0.1", timeout: float = 0.5) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(timeout)
            return s.connect_ex((host, port)) == 0
    except Exception:
        return False

class ServerStatus(BaseModel):
    name: str
    port: int
    status: str # "ONLINE" | "OFFLINE"
    description: str

class SystemOverviewDTO(BaseModel):
    all_running: bool
    bankflow_audit: ServerStatus
    whatsapp_bot: ServerStatus
    whatsapp_agent: ServerStatus
    platform: str
    debian_ip: Optional[str] = None

@router.get("/status", response_model=SystemOverviewDTO)
def get_system_status():
    """
    Returns live health & port status for:
    - BankFlow Audit (8080)
    - WhatsApp Node Bot (3333)
    - WhatsApp AI Agent (8000)
    """
    bank_online = is_port_open(8080)
    bot_online = is_port_open(3333)
    agent_online = is_port_open(8000)

    # Detect local IP
    local_ip = "127.0.0.1"
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
    except Exception:
        pass

    return SystemOverviewDTO(
        all_running=(bank_online and bot_online and agent_online),
        platform="Debian/Linux" if os.name != "nt" else "Windows",
        debian_ip=local_ip,
        bankflow_audit=ServerStatus(
            name="BankFlow Audit Intelligence",
            port=8080,
            status="ONLINE" if bank_online else "OFFLINE",
            description="Multi-sheet Excel Parser, Passbook Audit & React GUI Dashboard"
        ),
        whatsapp_bot=ServerStatus(
            name="WhatsApp Web Node Bot",
            port=3333,
            status="ONLINE" if bot_online else "OFFLINE",
            description="Puppeteer WhatsApp Client & Session Engine"
        ),
        whatsapp_agent=ServerStatus(
            name="WhatsApp Python AI Agent",
            port=8000,
            status="ONLINE" if agent_online else "OFFLINE",
            description="Railway & Ticket Booking NLP AI Agent"
        )
    )

@router.post("/start-all")
def start_all_servers():
    """
    API Command to trigger both servers in parallel via tmux or background process.
    """
    # 1. Locate WhatsApp Bot directory
    possible_wa_dirs = [
        Path.home() / "whatsapp-bot-server",
        Path.home() / "debian",
        Path("/root/whatsapp-bot-server"),
        Path("/root/debian"),
        Path(__file__).resolve().parent.parent.parent.parent / "whatsapp-bot-server",
        Path(__file__).resolve().parent.parent.parent.parent / "debian"
    ]

    wa_dir = next((d for d in possible_wa_dirs if (d / "start-debian.sh").exists()), None)

    results = []

    # If WhatsApp is offline, launch it
    if not is_port_open(3333) and not is_port_open(8000):
        if wa_dir and os.name != "nt":
            try:
                # Launch via tmux or nohup
                cmd = f"cd '{wa_dir}' && nohup bash start-debian.sh > /tmp/wa-bot.log 2>&1 &"
                subprocess.Popen(cmd, shell=True, preexec_fn=os.setpgrp)
                results.append("WhatsApp Bot & AI Agent launched in background.")
            except Exception as e:
                results.append(f"Failed to launch WhatsApp Bot: {str(e)}")
        else:
            results.append("WhatsApp Bot directory detected or Windows mode.")
    else:
        results.append("WhatsApp Bot is already running.")

    results.append("BankFlow Audit is currently active on Port 8080.")

    return {
        "success": True,
        "message": "Dual Server startup command executed.",
        "details": results
    }

@router.post("/restart-whatsapp")
def restart_whatsapp():
    """
    Restart WhatsApp Bot & Agent if needed.
    """
    possible_wa_dirs = [
        Path.home() / "whatsapp-bot-server",
        Path.home() / "debian",
        Path("/root/whatsapp-bot-server"),
        Path("/root/debian"),
        Path(__file__).resolve().parent.parent.parent.parent / "whatsapp-bot-server",
        Path(__file__).resolve().parent.parent.parent.parent / "debian"
    ]
    wa_dir = next((d for d in possible_wa_dirs if (d / "start-debian.sh").exists()), None)

    if os.name != "nt":
        subprocess.run("fuser -k 3333/tcp 2>/dev/null || true", shell=True)
        subprocess.run("fuser -k 8000/tcp 2>/dev/null || true", shell=True)
        subprocess.run("pkill -f -9 'whatsapp' 2>/dev/null || true", shell=True)
        subprocess.run("pkill -f -9 'src.server:app' 2>/dev/null || true", shell=True)

        if wa_dir:
            cmd = f"cd '{wa_dir}' && nohup bash start-debian.sh > /tmp/wa-bot.log 2>&1 &"
            subprocess.Popen(cmd, shell=True, preexec_fn=os.setpgrp)
            return {"success": True, "message": "WhatsApp Bot restarted successfully."}

    return {"success": True, "message": "WhatsApp processes cleaned."}
