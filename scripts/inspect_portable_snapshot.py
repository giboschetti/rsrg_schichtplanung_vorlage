import glob
import json


def main():
    matches = glob.glob("assets/Schichtplanung_Ausbau*Los_1.html")
    if not matches:
        raise SystemExit("No matching portable file found.")
    path = matches[0]
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    marker = '<script id="savedData" type="application/json">'
    start = html.index(marker) + len(marker)
    end = html.index("</script>", start)
    snapshot = json.loads(html[start:end])
    print("file=", path)
    print("kw=", len(snapshot.get("kwList", [])))
    print("workItems=", len(snapshot.get("workItems", {})))
    print("mitarbeiter=", len(((snapshot.get("tables") or {}).get("mitarbeiter")) or []))


if __name__ == "__main__":
    main()
