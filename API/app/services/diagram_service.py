import math


def _nice_step(rng: float) -> float:
    if rng <= 0:
        return 1.0
    mag = 10 ** math.floor(math.log10(rng))
    norm = rng / mag
    if norm < 1.5:
        return mag
    if norm < 3.5:
        return 2 * mag
    if norm < 7.5:
        return 5 * mag
    return 10 * mag


def _fmt_coeff(coef: float, power: int, first: bool = False) -> str:
    if coef == 0:
        return ""
    if power == 0:
        if first:
            return f"{coef:g}"
        return (" + " if coef > 0 else " - ") + f"{abs(coef):g}"
    sup = "" if power == 1 else "\u00b2"
    if first:
        head = "" if coef == 1 else "-" if coef == -1 else f"{coef:g}"
    else:
        sign = " + " if coef > 0 else " - "
        head = sign + ("" if abs(coef) == 1 else f"{abs(coef):g}")
    return f"{head}x{sup}"


def _format_quadratic(a: float, b: float, c: float) -> str:
    out = ""
    first = True
    for coef, power in ((a, 2), (b, 1), (c, 0)):
        part = _fmt_coeff(coef, power, first)
        if part:
            out += part
            first = False
    return out if out else "0"


def quadratic_graph_svg(
    a: float,
    b: float,
    c: float,
    width: int = 640,
    height: int = 480,
) -> str | None:
    """Accurate parabola plot for y = ax^2 + bx + c as a standalone SVG."""
    if a == 0:
        return None

    vx = -b / (2 * a)
    vy = a * vx * vx + b * vx + c

    roots: list[float] = []
    disc = b * b - 4 * a * c
    if disc >= 0:
        r1 = (-b - math.sqrt(disc)) / (2 * a)
        r2 = (-b + math.sqrt(disc)) / (2 * a)
        roots = sorted([r1, r2])

    half = max(4.0, abs(vx) * 1.2 + 0.5)
    if roots:
        half = max(half, max(abs(r - vx) for r in roots) * 1.15 + 1.0)

    xmin, xmax = vx - half, vx + half

    # sample curve to pick a reasonable y-range
    ys = []
    for i in range(401):
        x = xmin + (xmax - xmin) * i / 400
        ys.append(a * x * x + b * x + c)
    ymin, ymax = min(ys), max(ys)
    ypad = max((ymax - ymin) * 0.15, 0.5)
    ymin -= ypad
    ymax += ypad
    if ymin < 0 < ymax and vy > 0:
        ymax = max(ymax, vy + ypad)
    elif ymin < 0 < ymax and vy < 0:
        ymin = min(ymin, vy - ypad)

    left, top, right, bottom = 58, 24, 28, 50
    pw = width - left - right
    ph = height - top - bottom

    def mx(x: float) -> float:
        return left + (x - xmin) / (xmax - xmin) * pw

    def my(y: float) -> float:
        return top + (ymax - y) / (ymax - ymin) * ph

    xstep = _nice_step((xmax - xmin) / 8)
    ystep = _nice_step((ymax - ymin) / 8)

    # parabola path
    pts = []
    for i in range(201):
        x = xmin + (xmax - xmin) * i / 200
        y = a * x * x + b * x + c
        pts.append(f"{mx(x):.1f},{my(y):.1f}")
    path = "M" + " L".join(pts)

    x0, y0 = mx(0), my(0)
    origin_visible = xmin < 0 < xmax and ymin < 0 < ymax

    lines = []
    texts = []
    circles = []
    axes: list[str] = []
    roots_el: list[str] = []
    vertex_el: list[str] = []

    # grid
    grid_x = xmin
    while grid_x <= xmax:
        gx = mx(grid_x)
        if xmin < 0 < xmax:
            pass
        if abs(grid_x) > 1e-9:
            lines.append(
                f'<line x1="{gx:.1f}" y1="{top}" x2="{gx:.1f}" y2="{top+ph}" '
                f'stroke="#e2e8f0" stroke-width="1"/>'
            )
        grid_x += xstep
    grid_y = ymin
    while grid_y <= ymax:
        gy = my(grid_y)
        if abs(grid_y) > 1e-9:
            lines.append(
                f'<line x1="{left}" y1="{gy:.1f}" x2="{left+pw}" y2="{gy:.1f}" '
                f'stroke="#e2e8f0" stroke-width="1"/>'
            )
        grid_y += ystep

    # axes with arrowheads
    if xmin < 0 < xmax:
        axes.append(
            f'<line x1="{mx(xmin):.1f}" y1="{y0:.1f}" x2="{mx(xmax):.1f}" y2="{y0:.1f}" '
            f'stroke="#334155" stroke-width="2"/>'
        )
        axes.append(
            f'<polygon points="{mx(xmax):.1f},{y0:.1f} {mx(xmax)-10:.1f},{y0-5:.1f} {mx(xmax)-10:.1f},{y0+5:.1f}" fill="#334155"/>'
        )
        axes.append(f'<text x="{mx(xmax)-16:.1f}" y="{y0-12:.1f}" font-size="14" fill="#334155">x</text>')
    if ymin < 0 < ymax:
        axes.append(
            f'<line x1="{x0:.1f}" y1="{my(ymax):.1f}" x2="{x0:.1f}" y2="{my(ymin):.1f}" '
            f'stroke="#334155" stroke-width="2"/>'
        )
        axes.append(
            f'<polygon points="{x0:.1f},{my(ymax):.1f} {x0-5:.1f},{my(ymax)+10:.1f} {x0+5:.1f},{my(ymax)+10:.1f}" fill="#334155"/>'
        )
        axes.append(f'<text x="{x0+8:.1f}" y="{my(ymax)+6:.1f}" font-size="14" fill="#334155">y</text>')

    # ticks and numeric labels
    tx = xmin
    while tx <= xmax:
        if abs(tx) > 1e-9 and origin_visible:
            lines.append(
                f'<line x1="{mx(tx):.1f}" y1="{y0-4:.1f}" x2="{mx(tx):.1f}" y2="{y0+4:.1f}" stroke="#334155" stroke-width="1.5"/>'
            )
            texts.append(
                f'<text x="{mx(tx):.1f}" y="{y0+18:.1f}" font-size="13" fill="#475569" text-anchor="middle">{tx:g}</text>'
            )
        tx += xstep
    ty = ymin
    while ty <= ymax:
        if abs(ty) > 1e-9 and origin_visible:
            lines.append(
                f'<line x1="{x0-4:.1f}" y1="{my(ty):.1f}" x2="{x0+4:.1f}" y2="{my(ty):.1f}" stroke="#334155" stroke-width="1.5"/>'
            )
            texts.append(
                f'<text x="{x0-8:.1f}" y="{my(ty)+4:.1f}" font-size="13" fill="#475569" text-anchor="end">{ty:g}</text>'
            )
        ty += ystep

    if origin_visible:
        texts.append(f'<text x="{x0-8:.1f}" y="{y0+18:.1f}" font-size="13" fill="#475569" text-anchor="end">0</text>')

    # roots
    for r in roots:
        rx, ry = mx(r), my(0)
        roots_el.append(f'<circle cx="{rx:.1f}" cy="{ry:.1f}" r="5" fill="#dc2626" stroke="white" stroke-width="1.5"/>')
        roots_el.append(
            f'<text x="{rx:.1f}" y="{ry-12:.1f}" font-size="13" fill="#dc2626" text-anchor="middle">({r:g}, 0)</text>'
        )

    # vertex
    vertex_el.append(f'<circle cx="{mx(vx):.1f}" cy="{my(vy):.1f}" r="5" fill="#16a34a" stroke="white" stroke-width="1.5"/>')
    vlabel = f"({vx:g}, {vy:g})"
    vtext_x = mx(vx) + 10 if mx(vx) < width / 2 else mx(vx) - 10
    vertex_el.append(
        f'<text x="{vtext_x:.1f}" y="{my(vy)-10:.1f}" font-size="13" fill="#16a34a" '
        f'text-anchor="{"start" if mx(vx) < width / 2 else "end"}">{vlabel}</text>'
    )

    equation = _format_quadratic(a, b, c)
    texts.append(
        f'<text x="14" y="24" font-size="17" font-weight="bold" fill="#0f172a">y = {equation}</text>'
    )
    if a > 0:
        texts.append(
            f'<text x="14" y="44" font-size="12" fill="#64748b">opens upward &#8226; '
            f'minimum</text>'
        )
    else:
        texts.append(
            f'<text x="14" y="44" font-size="12" fill="#64748b">opens downward &#8226; '
            f'maximum</text>'
        )

    parts: list[str] = []
    if axes:
        parts.append(
            '<g data-part="1">\n'
            + "\n".join(f"    {a}" for a in axes)
            + "\n  </g>"
        )
    if roots_el:
        parts.append(
            '<g data-part="3">\n'
            + "\n".join(f"    {r}" for r in roots_el)
            + "\n  </g>"
        )
    if vertex_el:
        parts.append(
            '<g data-part="4">\n'
            + "\n".join(f"    {v}" for v in vertex_el)
            + "\n  </g>"
        )

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox='
        f'"0 0 {width} {height}" width="100%">\n'
        f'  <rect x="0" y="0" width="{width}" height="{height}" fill="white" rx="12"/>\n'
        + "\n".join(f"  {l}" for l in lines)
        + "\n"
        + "\n".join(f"  {t}" for t in texts)
        + "\n"
        + "\n".join(f"  {c}" for c in circles)
        + "\n"
        + "\n".join(parts)
        + f'\n  <path data-part="2" d="{path}" fill="none" stroke="#2563eb" stroke-width="3"/>\n'
        + "</svg>"
    )
    return svg


def force_diagram_svg(
    magnitude: float = 5.0,
    label: str | None = None,
    direction: str = "right",
    width: int = 440,
    height: int = 260,
) -> str:
    """A box on a surface with a single labelled force arrow."""
    box_x, box_y, box_w, box_h = 90, 100, 120, 90
    ground_y = box_y + box_h + 8
    if direction == "left":
        ax0, ax1 = box_x, box_x - 130
        head_x, head_y = ax1, box_y + box_h / 2
        tip = f"{head_x},{head_y} {head_x+12},{head_y-5} {head_x+12},{head_y+5}"
        label_x = ax1 + 26
    else:
        ax0, ax1 = box_x + box_w, box_x + box_w + 130
        head_x, head_y = ax1, box_y + box_h / 2
        tip = f"{head_x},{head_y} {head_x-12},{head_y-5} {head_x-12},{head_y+5}"
        label_x = ax1 - 28

    if label is None:
        label = f"F = {magnitude:g} N"

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox='
        f'"0 0 {width} {height}" width="100%">\n'
        f'  <rect x="0" y="0" width="{width}" height="{height}" fill="white" rx="12"/>\n'
        f'  <g data-part="1">\n'
        f'    <line x1="30" y1="{ground_y}" x2="{width-30}" y2="{ground_y}" '
        f'stroke="#94a3b8" stroke-width="2"/>\n'
        f'  </g>\n'
        f'  <g data-part="2">\n'
        f'    <rect x="{box_x}" y="{box_y}" width="{box_w}" height="{box_h}" '
        f'fill="#e0f2fe" stroke="#0ea5e9" stroke-width="2.5" rx="6"/>\n'
        f'    <text x="{box_x+box_w/2:.1f}" y="{box_y+box_h/2+6:.1f}" font-size="16" '
        f'fill="#0c4a6e" text-anchor="middle" font-weight="bold">box</text>\n'
        f'  </g>\n'
        f'  <g data-part="3">\n'
        f'    <line x1="{ax0}" y1="{head_y}" x2="{head_x}" y2="{head_y}" '
        f'stroke="#dc2626" stroke-width="3"/>\n'
        f'    <polygon points="{tip}" fill="#dc2626"/>\n'
        f'  </g>\n'
        f'  <g data-part="4">\n'
        f'    <text x="{label_x}" y="{head_y-14}" font-size="16" fill="#dc2626" '
        f'font-weight="bold" text-anchor="middle">{label}</text>\n'
        f'  </g>\n'
        "</svg>"
    )
    return svg
