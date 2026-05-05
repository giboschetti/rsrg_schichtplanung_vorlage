"""
Inspect the raw Firestore document for AS25 Wankdorf and dump:
  - all top-level field names
  - snapshot.workItems keys that contain intervalle rows
  - plannerData.workItems keys that contain intervalle rows
  - for any key matching KW31/KW32 (Aug 2026), print the full intervalle array
"""
import json
import subprocess
import urllib.request

PROJECT_ID = "rsrg-schichtplanung"
TARGET_PROJECT_NAME = "AS25 Wankdorf"  # adjust if name differs

def get_token():
    out = subprocess.run(
        "npx -y firebase-tools@latest login:list --json",
        capture_output=True, text=True, shell=True, check=True,
    ).stdout
    payload = json.loads(out)
    return payload["result"][0]["tokens"]["access_token"]

def firestore_get(token, url):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    return json.loads(urllib.request.urlopen(req).read().decode())

def from_fs_value(v):
    """Recursively convert Firestore REST value → plain Python."""
    if "stringValue" in v:  return v["stringValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue" in v:  return float(v["doubleValue"])
    if "booleanValue" in v: return v["booleanValue"]
    if "nullValue" in v:    return None
    if "arrayValue" in v:
        return [from_fs_value(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v:
        return {k: from_fs_value(vv) for k, vv in v["mapValue"].get("fields", {}).items()}
    return v  # fallback

def find_project_doc_id(token, name):
    url = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}"
        "/databases/(default)/documents/projects?pageSize=100"
    )
    data = firestore_get(token, url)
    for d in data.get("documents", []):
        fields = d.get("fields", {})
        n = from_fs_value(fields.get("name", {"stringValue": ""}))
        if name.lower() in str(n).lower():
            return d["name"].split("/")[-1], str(n)
    return None, None

def extract_intervalle_from_work_items(work_items: dict, label: str):
    print(f"\n{'='*60}")
    print(f"  {label}  ({len(work_items)} total keys)")
    print(f"{'='*60}")
    keys_with_intervalle = []
    for key, cell in work_items.items():
        intervalle = cell.get("intervalle", []) if isinstance(cell, dict) else []
        if intervalle:
            keys_with_intervalle.append(key)

    print(f"  Keys with intervalle rows: {len(keys_with_intervalle)}")
    for key in sorted(keys_with_intervalle):
        cell = work_items[key]
        rows = cell.get("intervalle", [])
        # flag keys around KW31/KW32 (09-10 Aug 2026)
        flag = " <-- Aug KW31/32" if any(x in key for x in ["31", "32"]) else ""
        print(f"\n  KEY: {key}{flag}")
        for row in rows:
            bab = row.get("babNr", "")
            titel = row.get("babTitel", "")
            status = row.get("status", "")
            von = row.get("vonDatum", "") + " " + row.get("vonZeit", "")
            bis = row.get("bisDatum", "") + " " + row.get("bisZeit", "")
            rid = row.get("id", "")
            print(f"    id={rid}  babNr={bab}  status={status}  von={von.strip()}  bis={bis.strip()}")
            if titel:
                print(f"    titel={titel}")

def main():
    token = get_token()
    doc_id, found_name = find_project_doc_id(token, TARGET_PROJECT_NAME)
    if not doc_id:
        print(f"ERROR: No project found matching '{TARGET_PROJECT_NAME}'")
        return
    print(f"Found project: '{found_name}' (id={doc_id})")

    url = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}"
        f"/databases/(default)/documents/projects/{doc_id}"
    )
    raw = firestore_get(token, url)
    fields = raw.get("fields", {})
    top_level_keys = list(fields.keys())
    print(f"\nTop-level fields in Firestore document: {top_level_keys}")

    # ── snapshot.workItems (React/v2 path) ────────────────────────────────────
    snap_raw = fields.get("snapshot")
    if snap_raw:
        snap = from_fs_value(snap_raw)
        wi_snap = snap.get("workItems", {}) if isinstance(snap, dict) else {}
        extract_intervalle_from_work_items(wi_snap, "snapshot.workItems  [React v2 — written by UI saves]")
        # also show kwList ids so we can verify key format
        kw_list = snap.get("kwList", []) if isinstance(snap, dict) else []
        print(f"\n  snapshot.kwList IDs ({len(kw_list)} weeks):")
        for kw in kw_list:
            print(f"    id={kw.get('id')}  num={kw.get('num')}  year={kw.get('year')}  from={kw.get('dateFrom')}  to={kw.get('dateTo')}")
    else:
        print("\n  [no 'snapshot' field found]")

    # ── plannerData.workItems (legacy / CRON path) ────────────────────────────
    pd_raw = fields.get("plannerData")
    if pd_raw:
        pd = from_fs_value(pd_raw)
        wi_pd = pd.get("workItems", {}) if isinstance(pd, dict) else {}
        extract_intervalle_from_work_items(wi_pd, "plannerData.workItems  [legacy / CRON written]")
        kw_list_pd = pd.get("kwList", []) if isinstance(pd, dict) else []
        print(f"\n  plannerData.kwList IDs ({len(kw_list_pd)} weeks):")
        for kw in kw_list_pd:
            print(f"    id={kw.get('id')}  num={kw.get('num')}  year={kw.get('year')}")
    else:
        print("\n  [no 'plannerData' field found]")

if __name__ == "__main__":
    main()
