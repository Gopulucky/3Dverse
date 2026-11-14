"""Build the self-hosted brand fonts in src/app/fonts/.

Sources are the official Google Fonts repository (OFL-licensed), pinned to a
commit so rebuilds are reproducible. Each family is subset to Google's
`latin` + `latin-ext` ranges (latin-ext carries the rupee sign U+20B9) and
written as woff2 with all OpenType layout features kept (tabular numerals
for prices, kerning, ligatures).

Run (needs fonttools + brotli, e.g. in a throwaway venv):
    python -m venv .venv-fonts && .venv-fonts/Scripts/pip install fonttools brotli
    .venv-fonts/Scripts/python scripts/fonts/build_fonts.py
"""

from __future__ import annotations

import io
import shutil
import sys
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

COMMIT = sys.argv[1] if len(sys.argv) > 1 else "29b4ec6df2522a8aee279414b78a07910b065874"
RAW = f"https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl"
OUT = Path(__file__).resolve().parents[2] / "src" / "app" / "fonts"

# Google Fonts' own unicode-range for the latin and latin-ext subsets.
LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
LATIN_EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"

# (output name, source path, variable-axis limits or None for static)
FONTS = [
    ("SpaceGrotesk-500-700.woff2", "spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf", {"wght": (500, 700)}),
    ("IBMPlexSans-400-700.woff2", "ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf", {"wdth": 100, "wght": (400, 700)}),
    ("IBMPlexMono-400.woff2", "ibmplexmono/IBMPlexMono-Regular.ttf", None),
    ("IBMPlexMono-500.woff2", "ibmplexmono/IBMPlexMono-Medium.ttf", None),
]
LICENSES = [
    ("OFL-SpaceGrotesk.txt", "spacegrotesk/OFL.txt"),
    ("OFL-IBMPlex.txt", "ibmplexsans/OFL.txt"),
]


def fetch(path: str) -> bytes:
    with urllib.request.urlopen(f"{RAW}/{path}", timeout=60) as resp:
        return resp.read()


def unicodes(spec: str) -> list[int]:
    out: list[int] = []
    for part in spec.split(","):
        lo, _, hi = part.removeprefix("U+").partition("-")
        out.extend(range(int(lo, 16), int(hi or lo, 16) + 1))
    return out


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    wanted = unicodes(LATIN) + unicodes(LATIN_EXT)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True

    for name, src, limits in FONTS:
        font = TTFont(io.BytesIO(fetch(src)))
        if limits:
            font = instancer.instantiateVariableFont(font, limits)
            # Round-trip so the subsetter sees fully compiled gvar data.
            buf = io.BytesIO()
            font.save(buf)
            font = TTFont(io.BytesIO(buf.getvalue()), lazy=False)
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=wanted)
        sub.subset(font)
        has_rupee = 0x20B9 in font.getBestCmap()
        subset.save_font(font, str(OUT / name), opts)
        size = (OUT / name).stat().st_size
        print(f"{name}: {size / 1024:.1f} KiB, rupee sign: {'yes' if has_rupee else 'no'}")

    for name, src in LICENSES:
        (OUT / name).write_bytes(fetch(src))
        print(f"{name}: copied")


if __name__ == "__main__":
    build()
    shutil.rmtree(OUT / "__pycache__", ignore_errors=True)
