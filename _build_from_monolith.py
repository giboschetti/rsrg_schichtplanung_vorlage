# Deprecated: this script used to split ../schichtplanung.html into legacy `js/` + `css/`.
# That vanilla stack was removed — the app is `src/` + Vite (see README).

from __future__ import annotations

import sys


def main() -> None:
    print(
        "Deprecated: _build_from_monolith.py wrote legacy files that were removed "
        "in favor of React (src/ + npm run build). Exiting without changes.",
        file=sys.stderr,
    )
    sys.exit(1)


if __name__ == "__main__":
    main()
