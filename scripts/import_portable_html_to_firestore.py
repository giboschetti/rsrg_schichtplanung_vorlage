import json
import re
import subprocess
import sys
import urllib.request


PROJECT_ID = "rsrg-schichtplanung"
HTML_PATH = "assets/Schichtplanung_Ausbau_SZU_Zürich_Los_1.html"
TARGET_PROJECT_NAME = "Ausbau SZU Zürich Los 1"


def run_cmd(command):
    result = subprocess.run(command, capture_output=True, text=True, check=True, shell=True)
    return result.stdout


def get_firebase_access_token():
    output = run_cmd("npx -y firebase-tools@latest login:list --json")
    payload = json.loads(output)
    results = payload.get("result") or []
    if not results:
        raise RuntimeError("No Firebase CLI login found.")
    token = (results[0].get("tokens") or {}).get("access_token")
    if not token:
        raise RuntimeError("Firebase access token missing in login:list output.")
    return token


def read_embedded_snapshot(path):
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    m = re.search(
        r'<script id="savedData" type="application/json">(.*?)</script>',
        html,
        flags=re.DOTALL,
    )
    if not m:
        raise RuntimeError("Could not find <script id='savedData'> in portable HTML.")
    return json.loads(m.group(1))


def to_firestore_value(value):
    if value is None:
        return {"nullValue": None}
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, str):
        return {"stringValue": value}
    if isinstance(value, list):
        return {"arrayValue": {"values": [to_firestore_value(v) for v in value]}}
    if isinstance(value, dict):
        return {
            "mapValue": {
                "fields": {k: to_firestore_value(v) for k, v in value.items()}
            }
        }
    return {"stringValue": str(value)}


def firestore_api(token, method, url, body=None):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8",
    }
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url=url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def find_project_doc_name(token, project_name):
    url = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}"
        f"/databases/(default)/documents:runQuery"
    )
    body = {
        "structuredQuery": {
            "from": [{"collectionId": "projects"}],
            "where": {
                "fieldFilter": {
                    "field": {"fieldPath": "name"},
                    "op": "EQUAL",
                    "value": {"stringValue": project_name},
                }
            },
            "limit": 10,
        }
    }
    result = firestore_api(token, "POST", url, body)
    docs = []
    for row in result:
        doc = row.get("document")
        if doc and doc.get("name"):
            docs.append(doc["name"])
    if not docs:
        raise RuntimeError(f"No Firestore project found with name '{project_name}'.")
    return docs[0]


def build_update_fields(snapshot):
    stammdaten = snapshot.get("stammdaten", {})
    shift_config = snapshot.get("shiftConfig", {})
    kw_list = snapshot.get("kwList", [])
    mitarbeiter = ((snapshot.get("tables") or {}).get("mitarbeiter")) or []
    planner_data = snapshot

    overview = {
        "projektnummer": stammdaten.get("projektnummer", ""),
        "auftraggeber": stammdaten.get("auftraggeber", ""),
        "bauleiter": stammdaten.get("bauleiter", ""),
        "polier": stammdaten.get("polier", ""),
        "standort": stammdaten.get("standort", ""),
        "baubeginn": stammdaten.get("baubeginn", ""),
        "bauende": stammdaten.get("bauende", ""),
        "shiftConfig": shift_config,
    }

    kalenderwochen = [
        {
            "id": kw.get("id"),
            "kw": kw.get("num"),
            "year": kw.get("year"),
            "dateFrom": kw.get("dateFrom", ""),
            "dateTo": kw.get("dateTo", ""),
        }
        for kw in kw_list
    ]

    return {
        "name": stammdaten.get("projektname", TARGET_PROJECT_NAME),
        "schemaVersion": 1,
        "overview": overview,
        "stammdaten": {
            "personal": mitarbeiter,
            "inventar": [],
            "material": [],
            "fremdleistung": [],
        },
        "kalenderwochen": kalenderwochen,
        "plannerData": planner_data,
    }


def patch_project_document(token, doc_name, fields):
    base_url = f"https://firestore.googleapis.com/v1/{doc_name}"
    mask_fields = [
        "name",
        "schemaVersion",
        "overview",
        "stammdaten",
        "kalenderwochen",
        "plannerData",
    ]
    mask_qs = "&".join(f"updateMask.fieldPaths={f}" for f in mask_fields)
    url = f"{base_url}?{mask_qs}"
    body = {"fields": {k: to_firestore_value(v) for k, v in fields.items()}}
    firestore_api(token, "PATCH", url, body)


def main():
    token = get_firebase_access_token()
    snapshot = read_embedded_snapshot(HTML_PATH)
    doc_name = find_project_doc_name(token, TARGET_PROJECT_NAME)
    update_fields = build_update_fields(snapshot)
    patch_project_document(token, doc_name, update_fields)
    print(f"Imported snapshot into Firestore document: {doc_name}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)
