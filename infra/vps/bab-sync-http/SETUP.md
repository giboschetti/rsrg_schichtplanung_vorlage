# BAB sync HTTP trigger (VPS)

Runs `bab_sync_firebase.py` from `/opt/bab-sync/` when the Schichtplanung UI calls `POST` with header `X-BAB-Sync-Secret`. Intended to sit behind **nginx-proxy-manager** with TLS.

## Prerequisites on VPS

- Existing cron sync layout (see AS25 `schichtplanung/CLAUDE.md`): `/opt/bab-sync/venv`, `/opt/bab-sync/bab_sync_firebase.py`, `/etc/bab-webhook-infisical.env`
- **SSH:** `root@187.124.22.21` with key from `0. VPS_Admin/CLAUDE.md`

## Install

From your machine (with repo checkout), copy this folder to the server and run:

```bash
scp -r infra/vps/bab-sync-http root@187.124.22.21:/root/bab-sync-http-src/
ssh root@187.124.22.21 'bash /root/bab-sync-http-src/install.sh'
```

Or paste `server.py`, `bab-sync-http.service`, and `install.sh` manually, then:

```bash
sudo bash install.sh
```

The installer writes `/etc/bab-sync-http.env` (once) and prints the **GitHub secret** value for `VITE_BAB_SYNC_SECRET`.

## nginx-proxy-manager

1. Admin UI (often port **81** on the VPS, or tunnel).
2. **Hosts → Proxy Hosts → Add Proxy Host**
   - Domain: e.g. `bab-sync.example.com` (DNS A-record → VPS IP).
   - Scheme **http**, Forward to **172.17.0.1** port **18503** (Docker bridge to host; if it fails, try `172.18.0.1` per `0. VPS_Admin/CLAUDE.md`).
   - SSL: request Let's Encrypt certificate.

## GitHub Actions (cloud-only frontend env)

The workflow `.github/workflows/firebase-deploy-main.yml` builds with:

- `VITE_BAB_SYNC_URL` — full HTTPS URL shown to the browser (e.g. `https://bab-sync.example.com/`)
- `VITE_BAB_SYNC_SECRET` — same string as `BAB_SYNC_HTTP_SECRET` in `/etc/bab-sync-http.env`

No local `.env.local` is required for production if you deploy via Actions.

## Smoke test

```bash
curl -sS -X POST \
  -H 'Content-Type: application/json' \
  -H 'X-BAB-Sync-Secret: YOUR_SECRET' \
  -d '{"kwFrom":27,"kwTo":27}' \
  'https://YOUR_DOMAIN/bab-sync'
```

Expect HTTP **200** and JSON `{"message": ...}` when the Python sync succeeds.

## Logs

```bash
journalctl -u bab-sync-http -n 100 -f
```
