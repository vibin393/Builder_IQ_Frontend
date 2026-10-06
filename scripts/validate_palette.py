"""Validate the chart palette against the computable data-viz checks.

A Python port of the dataviz skill's `validate_palette.js`, kept because Node is
not reachable from the build environment here while the project's Python venv is.
The thresholds, the Machado-Oliveira-Fernandes (2009) CVD transforms and the
OKLab maths are copied from the reference implementation so the two agree; keep
them in lockstep if the reference moves.

    python scripts/validate_palette.py "#2a78d6,#eb6834,#1baf7a" --mode light
    python scripts/validate_palette.py "#3987e5,#d95926,#199e70" --mode dark

Exit code 1 on any hard FAIL. WARN bands (CVD 6-8, contrast under 3:1) exit 0 but
each obliges secondary encoding - direct labels, gaps or texture.
"""

import argparse
import math
import re
import sys

# -- thresholds ---------------------------------------------------------------
BAND = {"light": (0.43, 0.77), "dark": (0.48, 0.67)}   # OKLCH L
CHROMA_FLOOR = 0.10                                     # OKLCH C
CVD_TARGET, CVD_FLOOR = 8.0, 6.0                        # OKLab dE x100, min(protan, deutan)
NORMAL_FLOOR = 15.0                                     # OKLab dE x100, unsimulated
CONTRAST_MIN = 3.0                                      # WCAG vs surface
DEFAULT_SURFACE = {"light": "#fcfcfb", "dark": "#1a1a19"}

# Machado, Oliveira & Fernandes (2009) at severity 1.0, linear RGB.
MACHADO = {
    "protan": (
        (0.152286, 1.052583, -0.204868),
        (0.114503, 0.786281, 0.099216),
        (-0.003882, -0.048116, 1.051998),
    ),
    "deutan": (
        (0.367322, 0.860646, -0.227968),
        (0.280085, 0.672501, 0.047413),
        (-0.011820, 0.042940, 0.968881),
    ),
    "tritan": (
        (1.255528, -0.076749, -0.178779),
        (-0.078411, 0.930809, 0.147602),
        (0.004733, 0.691367, 0.303900),
    ),
}

# Input boundary. Kept as the intersection of what JS trim() and Python strip()
# remove, so the two ports accept exactly the same strings.
WS = "[ \t\n\v\f\r   -     　]+"
HEX_RE = re.compile(r"^#?[0-9a-fA-F]{6}$")


def strip_ws(value: str) -> str:
    return re.sub(f"^{WS}|{WS}$", "", value)


def split_colors(raw: str) -> list[str]:
    return [c for c in (strip_ws(p) for p in (raw or "").split(",")) if c]


def hex2srgb(h: str) -> tuple[float, float, float]:
    h = strip_ws(h).lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))


def s2lin(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(h: str) -> tuple[float, float, float]:
    return tuple(s2lin(c) for c in hex2srgb(h))


def rel_lum(h: str) -> float:
    r, g, b = lin(h)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    hi, lo = sorted((rel_lum(a), rel_lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def oklab_from_lin(rgb) -> tuple[float, float, float]:
    r, g, b = rgb
    l = math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)  # noqa: E741
    m = math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return (
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    )


def oklch(h: str) -> tuple[float, float]:
    L, a, b = oklab_from_lin(lin(h))
    return L, math.hypot(a, b)


def simulate(h: str, kind: str):
    r, g, b = lin(h)
    M = MACHADO[kind]
    return tuple(
        min(1.0, max(0.0, M[i][0] * r + M[i][1] * g + M[i][2] * b)) for i in range(3)
    )


def delta_e(h1: str, h2: str, kind: str | None = None) -> float:
    a = oklab_from_lin(simulate(h1, kind) if kind else lin(h1))
    b = oklab_from_lin(simulate(h2, kind) if kind else lin(h2))
    return 100 * math.dist(a, b)


def validate(palette: list[str], mode: str = "light", surface: str | None = None,
             pairs: str = "adjacent") -> tuple[list[tuple[str, str, str]], bool]:
    surface = surface or DEFAULT_SURFACE[mode]
    lo, hi = BAND[mode]
    report: list[tuple[str, str, str]] = []
    ok = True

    # 2. lightness band
    offband = [(c, round(oklch(c)[0], 3)) for c in palette if not lo <= oklch(c)[0] <= hi]
    if offband:
        ok = False
    report.append((
        "Lightness band",
        "FAIL" if offband else "pass",
        f"outside band: {offband}" if offband else f"all {len(palette)} inside L {lo}-{hi}",
    ))

    # 3. chroma floor
    lowc = [(c, round(oklch(c)[1], 3)) for c in palette if oklch(c)[1] < CHROMA_FLOOR]
    if lowc:
        ok = False
    report.append((
        "Chroma floor",
        "FAIL" if lowc else "pass",
        f"below floor (reads gray): {lowc}" if lowc else f"all {len(palette)} >= {CHROMA_FLOOR}",
    ))

    n = len(palette)
    if pairs == "all":
        pairlist = [(i, j) for i in range(n) for j in range(i + 1, n)]
    else:
        pairlist = [(i, i + 1) for i in range(n - 1)]
    label = "all-pairs" if pairs == "all" else "adjacent"

    # 4. CVD separation
    worst = None
    for kind in ("protan", "deutan"):
        for i, j in pairlist:
            d = delta_e(palette[i], palette[j], kind)
            if worst is None or d < worst[0]:
                worst = (d, kind, palette[i], palette[j])
    tri = min((delta_e(palette[i], palette[j], "tritan") for i, j in pairlist), default=99.0)
    wd = worst[0] if worst else 99.0
    state = "pass" if wd >= CVD_TARGET else ("WARN" if wd >= CVD_FLOOR else "FAIL")
    if state == "FAIL":
        ok = False
    report.append((
        "CVD separation",
        state,
        f"worst {label} {worst[3]}<->{worst[2]} dE {wd:.1f} ({worst[1]}) - tritan {tri:.1f}"
        if worst else "n/a",
    ))

    # 4b. normal-vision floor - a hard gate
    nworst = None
    for i, j in pairlist:
        d = delta_e(palette[i], palette[j])
        if nworst is None or d < nworst[0]:
            nworst = (d, palette[i], palette[j])
    nd = nworst[0] if nworst else 99.0
    if nd < NORMAL_FLOOR:
        ok = False
    report.append((
        "Normal-vision floor",
        "pass" if nd >= NORMAL_FLOOR else "FAIL",
        f"worst {label} {nworst[2]}<->{nworst[1]} dE {nd:.1f} (normal)" if nworst else "n/a",
    ))

    # 5. contrast vs surface - conditional relief, not a hard fail
    low = [(c, round(contrast(c, surface), 2)) for c in palette
           if contrast(c, surface) < CONTRAST_MIN]
    report.append((
        "Contrast vs surface",
        "WARN" if low else "pass",
        f"below {CONTRAST_MIN}:1 - needs visible labels or a table view: {low}"
        if low else f"all {len(palette)} >= {CONTRAST_MIN}:1",
    ))

    return report, ok


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("palette", help="comma-separated hex values")
    ap.add_argument("--mode", choices=("light", "dark"), default="light")
    ap.add_argument("--surface", default=None)
    ap.add_argument("--pairs", choices=("adjacent", "all"), default="adjacent")
    args = ap.parse_args()

    palette = split_colors(args.palette)
    bad = [c for c in palette if not HEX_RE.match(c)]
    if not palette or bad:
        print(f"Not six-digit hex: {bad or 'empty palette'}", file=sys.stderr)
        return 2
    if args.surface and not HEX_RE.match(strip_ws(args.surface)):
        print(f"Surface is not six-digit hex: {args.surface}", file=sys.stderr)
        return 2

    surface = args.surface or DEFAULT_SURFACE[args.mode]
    report, ok = validate(palette, args.mode, surface, args.pairs)

    print(f"\n  palette : {', '.join(palette)}")
    print(f"  mode    : {args.mode}   surface: {surface}   pairs: {args.pairs}\n")
    width = max(len(r[0]) for r in report)
    for name, state, detail in report:
        print(f"  {name:<{width}}  {state:<5}  {detail}")
    print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
