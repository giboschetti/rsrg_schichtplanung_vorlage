#!/usr/bin/env python3
"""
HTTP trigger for bab_sync_firebase.py — systemd service behind nginx-proxy-manager.

Environment (via systemd EnvironmentFile):
  BAB_SYNC_HTTP_SECRET   Required shared secret (same value as GitHub VITE_BAB_SYNC_SECRET).
  BAB_LISTEN_HOST        Default 0.0.0.0
  BAB_LISTEN_PORT        Default 18503
  BAB_PYTHON             Default /opt/bab-sync/venv/bin/python
  BAB_SCRIPT             Default /opt/bab-sync/bab_sync_firebase.py
  BAB_INFISICAL_ENV      Default /etc/bab-webhook-infisical.env

POST / or /bab-sync with header X-BAB-Sync-Secret and optional JSON body: {"kwFrom":27,"kwTo":30}
"""

from __future__ import annotations

import hmac
import json
import os
import subprocess
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

_AUTH_LOCK = threading.Lock()


def _env(name: str, default: str) -> str:
    v = os.environ.get(name)
    return v.strip() if v else default


def _json_body(handler: BaseHTTPRequestHandler) -> dict:
    length_s = handler.headers.get("Content-Length")
    if not length_s:
        return {}
    try:
        n = int(length_s)
    except ValueError:
        return {}
    if n <= 0:
        return {}
    raw = handler.rfile.read(n)
    if not raw:
        return {}
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {"__invalid_json": True}
    return data if isinstance(data, dict) else {"__invalid_json": True}


def _cors(handler: BaseHTTPRequestHandler) -> None:
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    handler.send_header(
        "Access-Control-Allow-Headers",
        "Content-Type, X-BAB-Sync-Secret",
    )
    handler.send_header("Access-Control-Max-Age", "86400")


def _send_json(handler: BaseHTTPRequestHandler, code: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    _cors(handler)
    handler.end_headers()
    handler.wfile.write(body)


def _authorized(handler: BaseHTTPRequestHandler, secret: str) -> bool:
    sent = handler.headers.get("X-BAB-Sync-Secret") or ""
    return bool(secret) and hmac.compare_digest(sent.encode(), secret.encode())


def _build_argv_kw(body: dict) -> tuple[list[str], str | None]:
    """Returns argv extras after script path, or ([], error message)."""
    out: list[str] = []
    if "__invalid_json" in body:
        return [], "Ungültiger JSON-Body."

    for key in ("kwFrom", "kwTo"):
        if key not in body:
            continue
        val = body[key]
        if val is None:
            continue
        if isinstance(val, bool) or not isinstance(val, (int, float)):
            return [], f"{key} muss eine Zahl sein."
        n = int(val)
        if n < 1 or n > 53:
            return [], f"{key} ausserhalb 1–53."
        cli = "--kw-from" if key == "kwFrom" else "--kw-to"
        out.extend([cli, str(n)])

    return out, None


def _run_sync(python_exe: str, script: str, infisical_env: str, kw_argv: list[str]) -> tuple[int, str, str]:
    """Returns exit_code, stdout, stderr."""
    inner = (
        f'set -a && source "{infisical_env}" && set +a && '
        f'export PYTHONIOENCODING=utf-8 && exec "{python_exe}" "{script}"'
        + ("" if not kw_argv else " " + subprocess.list2cmdline(kw_argv))
    )
    proc = subprocess.run(
        ["bash", "-lc", inner],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=1200,
        cwd="/",
    )
    return proc.returncode, proc.stdout or "", proc.stderr or ""


class BabSyncHandler(BaseHTTPRequestHandler):
    server_version = "bab-sync-http/1.0"

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        _cors(self)
        self.end_headers()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = (parsed.path or "/").rstrip("/") or "/"
        if path not in ("/", "/bab-sync"):
            _send_json(self, 404, {"error": "Not Found"})
            return

        secret = _env("BAB_SYNC_HTTP_SECRET", "")
        if not secret:
            _send_json(self, 503, {"error": "Server nicht konfiguriert."})
            return

        if not _authorized(self, secret):
            _send_json(self, 401, {"error": "Unauthorized"})
            return

        body = _json_body(self)
        kw_argv, err = _build_argv_kw(body)
        if err:
            _send_json(self, 400, {"error": err})
            return

        python_exe = _env("BAB_PYTHON", "/opt/bab-sync/venv/bin/python")
        script = _env("BAB_SCRIPT", "/opt/bab-sync/bab_sync_firebase.py")
        infisical_env = _env("BAB_INFISICAL_ENV", "/etc/bab-webhook-infisical.env")

        if not os.path.isfile(script):
            _send_json(self, 503, {"error": f"Sync-Script fehlt: {script}"})
            return
        if not os.path.isfile(infisical_env):
            _send_json(self, 503, {"error": f"Infisical env fehlt: {infisical_env}"})
            return

        acquired = _AUTH_LOCK.acquire(blocking=False)
        if not acquired:
            _send_json(self, 429, {"error": "Sync läuft bereits — später erneut versuchen."})
            return

        try:
            code, out, err = _run_sync(python_exe, script, infisical_env, kw_argv)
        except subprocess.TimeoutExpired:
            _AUTH_LOCK.release()
            _send_json(self, 504, {"error": "Sync-Timeout (>20 min)."})
            return
        except Exception:
            _AUTH_LOCK.release()
            tb = traceback.format_exc()
            _send_json(self, 500, {"error": "Interner Fehler.", "detail": tb[-800:]})
            return

        _AUTH_LOCK.release()

        tail_out = out.strip()[-8000:] if out else ""
        tail_err = err.strip()[-4000:] if err else ""
        if code != 0:
            msg = "bab_sync_firebase.py fehlgeschlagen."
            _send_json(
                self,
                502,
                {
                    "error": msg,
                    "stderr": tail_err or "(leer)",
                    "stdout_tail": tail_out or "(leer)",
                },
            )
            return

        msg = "Sync abgeschlossen."
        lines = [ln.strip() for ln in out.splitlines() if "Firebase updated" in ln or "Successfully" in ln]
        if lines:
            msg = lines[-1][:500]

        _send_json(self, 200, {"message": msg, "stdout_tail": tail_out[-2000:] if tail_out else ""})


def main() -> None:
    import sys

    host = _env("BAB_LISTEN_HOST", "0.0.0.0")
    port_s = _env("BAB_LISTEN_PORT", "18503")
    try:
        port = int(port_s)
    except ValueError:
        print("BAB_LISTEN_PORT ungültig", file=sys.stderr)
        sys.exit(1)

    if not _env("BAB_SYNC_HTTP_SECRET", ""):
        print("BAB_SYNC_HTTP_SECRET fehlt", file=sys.stderr)
        sys.exit(1)

    server = ThreadingHTTPServer((host, port), BabSyncHandler)
    print(f"bab-sync-http listening on {host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
