import json
import subprocess
import urllib.request


def get_token():
    out = subprocess.run(
        "npx -y firebase-tools@latest login:list --json",
        capture_output=True,
        text=True,
        shell=True,
        check=True,
    ).stdout
    payload = json.loads(out)
    return payload["result"][0]["tokens"]["access_token"]


def main():
    token = get_token()
    req = urllib.request.Request(
        "https://firestore.googleapis.com/v1/projects/rsrg-schichtplanung/databases/(default)/documents/projects?pageSize=100",
        headers={"Authorization": "Bearer " + token},
    )
    data = json.loads(urllib.request.urlopen(req).read().decode())
    docs = data.get("documents", [])
    print("projects=", len(docs))
    for d in docs:
        doc_id = d.get("name", "").split("/")[-1]
        fields = d.get("fields", {})
        project_name = ((fields.get("name") or {}).get("stringValue")) or ""
        owner = ((fields.get("ownerId") or {}).get("stringValue")) or ""
        planner_fields = ((fields.get("plannerData") or {}).get("mapValue") or {}).get("fields", {})
        kw = ((planner_fields.get("kwList") or {}).get("arrayValue") or {}).get("values", [])
        workitems = ((planner_fields.get("workItems") or {}).get("mapValue") or {}).get("fields", {})
        print(
            f"{doc_id} | {project_name} | owner {owner} | kw {len(kw)} | workItems {len(workitems)}"
        )


if __name__ == "__main__":
    main()
