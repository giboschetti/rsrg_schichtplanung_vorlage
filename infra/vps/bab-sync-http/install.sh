#!/usr/bin/env bash
# Install bab-sync-http on Ubuntu VPS (run as root).
# Copies server.py + systemd unit; generates shared secret for GitHub + NPM TLS routing instructions.
set -euo pipefail

DEST="/opt/bab-sync-http"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Run as root: sudo bash install.sh"
  exit 1
fi

if [[ ! -f "${SCRIPT_DIR}/server.py" ]] || [[ ! -f "${SCRIPT_DIR}/bab-sync-http.service" ]]; then
  echo "Missing server.py or bab-sync-http.service next to this script."
  exit 1
fi

mkdir -p "$DEST"
install -m 0644 "${SCRIPT_DIR}/server.py" "${DEST}/server.py"

ENV_FILE="/etc/bab-sync-http.env"
if [[ ! -f "$ENV_FILE" ]]; then
  SECRET="$(openssl rand -hex 32)"
  umask 077
  {
    echo "BAB_SYNC_HTTP_SECRET=${SECRET}"
    echo "BAB_LISTEN_HOST=0.0.0.0"
    echo "BAB_LISTEN_PORT=18503"
    echo "BAB_PYTHON=/opt/bab-sync/venv/bin/python"
    echo "BAB_SCRIPT=/opt/bab-sync/bab_sync_firebase.py"
    echo "BAB_INFISICAL_ENV=/etc/bab-webhook-infisical.env"
  } >"$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo ""
  echo "=== Generated ${ENV_FILE} with new BAB_SYNC_HTTP_SECRET ==="
  echo "Add these GitHub repository secrets (Repo → Settings → Secrets → Actions):"
  echo "  VITE_BAB_SYNC_SECRET=${SECRET}"
  echo "  VITE_BAB_SYNC_URL=https://YOUR_DOMAIN_HERE/   (trailing slash OK; must match NPM hostname)"
  echo "(Keep this terminal scrollback safe until secrets are saved.)"
  echo ""
else
  echo "Keeping existing ${ENV_FILE}"
fi

install -m 0644 "${SCRIPT_DIR}/bab-sync-http.service" "/etc/systemd/system/bab-sync-http.service"
systemctl daemon-reload
systemctl enable bab-sync-http.service
systemctl restart bab-sync-http.service

echo ""
echo "=== systemd ==="
systemctl --no-pager -l status bab-sync-http.service || true

echo ""
echo "=== Next steps ==="
echo "1) nginx-proxy-manager: add Proxy Host → Forward http://172.17.0.1:18503 (or host gateway IP from Docker)"
echo "   If that fails, run from VPS: docker exec nginx-proxy-manager sh -c \"ip route\" | head"
echo "2) Use HTTPS + Let's Encrypt on that hostname."
echo "3) Test:"
echo "   curl -sS -X POST -H Content-Type:application/json -H \"X-BAB-Sync-Secret:\$(grep BAB_SYNC_HTTP_SECRET ${ENV_FILE}|cut -d= -f2-)\" \\"
echo "        -d '{}' \"https://YOUR_DOMAIN/\""
echo "4) Firebase Hosting deploy: store VITE_BAB_SYNC_URL + VITE_BAB_SYNC_SECRET in GitHub Actions secrets (see workflow)."
