"""Rebuild the bundled Natural Earth 1:110m land geometry. Standard library only."""
import json
from pathlib import Path
from urllib.request import urlopen

REVISION = "ca96624a56bd078437bca8184e78163e5039ad19"
SOURCE = f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{REVISION}/geojson/ne_110m_land.geojson"


def main():
    with urlopen(SOURCE, timeout=60) as response:
        data = json.load(response)
    rings = []
    for feature in data["features"]:
        geometry = feature["geometry"]
        polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        for polygon in polygons:
            for ring in polygon:
                rings.append([[round(lon, 2), round(lat, 2)] for lon, lat in ring])
    target = Path(__file__).resolve().parents[1] / "js" / "world-land.js"
    header = f"/* Natural Earth 1:110m land. Public domain. Rounded to 0.01 degrees.\n * {SOURCE}\n * Rebuild: python scripts/build-land.py */\n\"use strict\";\n\nCLOX.land = "
    target.write_text(header + json.dumps(rings, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"{len(rings)} rings, {sum(len(r) for r in rings)} points, {target.stat().st_size} bytes")


if __name__ == "__main__":
    main()
