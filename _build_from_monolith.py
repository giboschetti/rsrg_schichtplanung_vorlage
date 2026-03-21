# One-off / repeatable: split schichtplanung.html into multi-file layout.
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
SRC = ROOT.parent / "schichtplanung.html"
if not SRC.exists():
    print("Source not found:", SRC, file=sys.stderr)
    sys.exit(1)

h = SRC.read_text(encoding="utf-8")

m = re.search(r"<style>\s*([\s\S]*?)\s*</style>", h)
if not m:
    sys.exit("no <style> block")
css = m.group(1)

saved_end = h.find("</script>", h.find('id="savedData"'))
js_start = h.find("<script>", saved_end)
if js_start < 0:
    sys.exit("no main script")
js_start += len("<script>")
js_end = h.rfind("</script>", 0, h.lower().rfind("</body>"))
js = h[js_start:js_end].strip("\n")

EMPTY_JSON = (
    '{"savedAt":"","stammdaten":{"projektname":"","projektnummer":"","auftraggeber":"",'
    '"bauleiter":"","polier":"","standort":"","baubeginn":"","bauende":""},'
    '"shiftConfig":{"tag":{"von":"07:00","bis":"19:00"},"nacht":{"von":"19:00","bis":"07:00"}},'
    '"kwList":[],"tables":{"mitarbeiter":[]},"workItems":{}}'
)

# Slim DOM (JS rebuilds these)
start = h.find('<div id="table-mitarbeiter"')
end = h.find('<div class="tbl-toolbar">', start)
h2 = (
    h[:start]
    + '<div id="table-mitarbeiter" class="tabulator" role="grid" tabulator-layout="fitColumns" '
    + 'style="height: auto; max-height: 380px;"></div>\n        '
    + h[end:]
)

start = h2.find('<div id="kwListContainer">')
end = h2.find("<!-- Timeline controls -->", start)
if start >= 0 and end > start:
    h2 = (
        h2[:start]
        + "        <div id=\"kwListContainer\"></div>\n"
        + "      </div>\n"
        + "    </div>\n\n"
        + "    "
        + h2[end:]
    )

start = h2.find('<div class="timeline-wrapper" id="timelineWrapper">')
end = h2.find("<!-- Shift Detail Panel -->", start)
h2 = (
    h2[:start]
    + '<div class="timeline-wrapper" id="timelineWrapper"></div>\n\n    '
    + h2[end:]
)

def empty_outer_div(html: str, tid: str) -> str:
    token = f'<div id="{tid}"'
    i = html.find(token)
    if i < 0:
        return html
    gt = html.find(">", i)
    if gt < 0:
        return html
    inner_start = gt + 1
    pos = inner_start
    depth = 1
    while pos < len(html) and depth > 0:
        next_open = html.find("<div", pos)
        next_close = html.find("</div>", pos)
        if next_close < 0:
            break
        if next_open != -1 and next_open < next_close:
            depth += 1
            pos = next_open + 4
        else:
            depth -= 1
            if depth == 0:
                return html[:inner_start] + html[next_close:]
            pos = next_close + 6
    return html


for tid in [
    "sdp-tbl-tasks",
    "sdp-tbl-personal",
    "sdp-tbl-inventar",
    "sdp-tbl-material",
    "sdp-tbl-fremdleistung",
]:
    h2 = empty_outer_div(h2, tid)

# Hide shift panel until a cell is selected
h2 = h2.replace(
    '<div class="sdp-outer" id="shiftDetailPanel" style="display: block;">',
    '<div class="sdp-outer" id="shiftDetailPanel" style="display: none;">',
)

head_end = h2.find("</head>")
if head_end < 0:
    sys.exit("no </head>")
head = h2[:head_end]
body_and_rest = h2[head_end:]

head = re.sub(r"<style>\s*[\s\S]*?\s*</style>", "", head, count=1)
inject = """
  <link rel="stylesheet" href="css/styles.css">
"""
if "<link href=\"https://unpkg.com/tabulator" in head:
    head = head.replace(
        "<link href=\"https://unpkg.com/tabulator-tables@6.3.0/dist/css/tabulator.min.css\" rel=\"stylesheet\">",
        "<link href=\"https://unpkg.com/tabulator-tables@6.3.0/dist/css/tabulator.min.css\" rel=\"stylesheet\">"
        + inject,
    )
else:
    head = head.replace("</title>", "</title>" + inject)

body_and_rest = re.sub(
    r'<script id="savedData" type="application/json">[\s\S]*?</script>',
    f'<script id="savedData" type="application/json">{EMPTY_JSON}</script>',
    body_and_rest,
    count=1,
)

# Remove inline script, add external (before </body>)
body_and_rest = re.sub(
    r"<script>\s*// ─── Constants[\s\S]*?</script>\s*",
    '<script src="js/app.js"></script>\n\n',
    body_and_rest,
    count=1,
)

index_html = head + body_and_rest

(ROOT / "css").mkdir(parents=True, exist_ok=True)
(ROOT / "js").mkdir(parents=True, exist_ok=True)
(ROOT / "css" / "styles.css").write_text(css, encoding="utf-8")
(ROOT / "js" / "app.js").write_text(js, encoding="utf-8")
(ROOT / "index.html").write_text(index_html, encoding="utf-8")
print("Wrote index.html, css/styles.css, js/app.js")
