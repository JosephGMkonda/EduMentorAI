import math
import re
import time
from openai import OpenAI, RateLimitError
from app.config import settings


groq_client = OpenAI(
    api_key=settings.groq_api_key,
    base_url="https://api.groq.com/openai/v1",
)

ollama_client = OpenAI(
    api_key="ollama",
    base_url="http://localhost:11434/v1",
)


def _retry_after_seconds(err: RateLimitError) -> float:
    try:
        header = err.response.headers.get("retry-after")
        if header:
            return float(header)
    except Exception:
        pass
    message = str(err)
    for token in ("minute", "hour", "day"):
        idx = message.find(f"Please try again in ")
        if idx != -1:
            rest = message[idx + len("Please try again in ") :]
            num = ""
            for ch in rest:
                if ch.isdigit() or ch == ".":
                    num += ch
                else:
                    break
            if num:
                multiplier = 60 if token == "minute" else 3600 if token == "hour" else 86400
                return float(num) if token == "minute" else float(num) * multiplier
    return 15


def _call_groq(prompt: str) -> str:
    last_error: Exception | None = None
    for model in ("llama-3.3-70b-versatile", "llama-3.1-8b-instant"):
        attempts = 0
        while attempts < 3:
            try:
                response = groq_client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=2000,
                )
                content = response.choices[0].message.content
                if content and content.strip():
                    return _clean_svg_fences(content)
                last_error = RuntimeError(f"Model {model} returned empty output")
            except RateLimitError as e:
                last_error = e
                wait = _retry_after_seconds(e)
                if wait > 60:
                    break
                time.sleep(min(wait + 1, 60))
                attempts += 1
            except Exception as e:
                last_error = e
                break
    raise last_error if last_error else RuntimeError("Groq generation failed")


def _call_ollama(prompt: str) -> str:
    try:
        response = ollama_client.chat.completions.create(
            model="qwen3:1.7b",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1600,
        )
        content = response.choices[0].message.content
        if content and content.strip():
            return _clean_svg_fences(content)
    except Exception:
        pass
    return ""


def _svg_attr(tag: str, name: str) -> str | None:
    m = re.search(name + r'="([^"]*)"', tag, re.IGNORECASE)
    return m.group(1) if m else None


def _line_endpoints(tag: str) -> tuple[float, float, float, float] | None:
    try:
        x1 = float(_svg_attr(tag, "x1") or 0)
        y1 = float(_svg_attr(tag, "y1") or 0)
        x2 = float(_svg_attr(tag, "x2") or 0)
        y2 = float(_svg_attr(tag, "y2") or 0)
        return x1, y1, x2, y2
    except (TypeError, ValueError):
        return None


def _path_startpoint(tag: str) -> tuple[float, float] | None:
    d = _svg_attr(tag, "d")
    if not d:
        return None
    m = re.match(
        r"\s*[Mm]\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*[, ]\s*([+-]?(?:\d+\.?\d*|\.\d+))",
        d,
    )
    if not m:
        return None
    return float(m.group(1)), float(m.group(2))


def _path_endpoint(tag: str) -> tuple[float, float] | None:
    d = _svg_attr(tag, "d")
    if not d:
        return None
    nums = [float(v) for v in re.findall(r"[+-]?(?:\d+\.?\d*|\.\d+)", d)]
    if len(nums) < 2:
        return None
    return nums[-2], nums[-1]


def _force_labels(svg: str) -> list[tuple[float, float]]:
    """Positions of labels that typically sit beside an arrow (forces, motion, parts)."""
    labels: list[tuple[float, float]] = []
    for m in re.finditer(r"<text[^>]*>([^<]*)</text>", svg, re.IGNORECASE):
        tag = m.group(0)
        x = _svg_attr(tag, "x")
        y = _svg_attr(tag, "y")
        content = m.group(1)
        if x and y and re.search(
            r"\bF\s*[=:]|F\d|\b(force|push|pull|weight|gravity|tension|thrust|drag|"
            r"motion|velocity|speed|acceleration|up|down|engine|wheel|tyre|tire|"
            r"handle|pedal|brake|mirror|seat)\b|N\b",
            content,
            re.IGNORECASE,
        ):
            try:
                labels.append((float(x), float(y)))
            except ValueError:
                pass
    return labels


def _polygon_arrowheads(svg: str) -> list[tuple[float, float]]:
    """Centroids of small filled polygons, which are usually already-drawn arrowheads."""
    heads: list[tuple[float, float]] = []
    for m in re.finditer(r"<polygon\b[^>]*>", svg, re.IGNORECASE):
        raw = _svg_attr(m.group(0), "points")
        if not raw:
            continue
        nums = [float(v) for v in re.findall(r"[+-]?(?:\d+\.?\d*|\.\d+)", raw)]
        if len(nums) < 6 or len(nums) % 2:
            continue
        pts = list(zip(nums[0::2], nums[1::2]))
        n = len(pts)
        signed = 0.0
        cx = cy = 0.0
        for i in range(n):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % n]
            cross = x1 * y2 - x2 * y1
            signed += cross
            cx += (x1 + x2) * cross
            cy += (y1 + y2) * cross
        signed /= 2.0
        if abs(signed) <= 0 or abs(signed) >= 320:
            continue
        heads.append((cx / (6.0 * signed), cy / (6.0 * signed)))
    return heads


def _add_marker(svg: str) -> str:
    """Define one reusable arrowhead marker if the AI did not provide any."""
    if re.search(r"<marker\b", svg, re.IGNORECASE):
        return svg
    marker = (
        '<defs><marker id="edm-arrow" viewBox="0 0 10 10" refX="9.5" refY="5" '
        'markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        '<path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker></defs>'
    )
    open_tag = re.search(r"<svg\b[^>]*>", svg, re.IGNORECASE)
    if open_tag:
        svg = svg.replace(open_tag.group(0), open_tag.group(0) + marker, 1)
    return svg


def _add_arrowheads(svg: str) -> str:
    """Add marker arrowheads to lines/paths that point at a labelled part."""
    labels = _force_labels(svg)
    if not labels:
        return svg
    heads = _polygon_arrowheads(svg)

    def near(x: float, y: float, pts: list[tuple[float, float]], tol: float) -> bool:
        return any(abs(x - px) < tol and abs(y - py) < tol for px, py in pts)

    def patch_line(m: re.Match) -> str:
        tag = m.group(0)
        if "marker-end" in tag:
            return tag
        ep = _line_endpoints(tag)
        if not ep:
            return tag
        x1, y1, x2, y2 = ep
        if math.hypot(x2 - x1, y2 - y1) < 30:
            return tag
        if near(x2, y2, heads, 18):
            return tag
        if near(x2, y2, labels, 45):
            return tag[:-2] + ' marker-end="url(#edm-arrow)"/>'
        return tag

    def patch_path(m: re.Match) -> str:
        tag = m.group(0)
        if "marker-end" in tag:
            return tag
        start = _path_startpoint(tag)
        end = _path_endpoint(tag)
        if not start or not end:
            return tag
        if math.hypot(end[0] - start[0], end[1] - start[1]) < 30:
            return tag
        if near(end[0], end[1], heads, 18):
            return tag
        if near(end[0], end[1], labels, 45):
            return tag[:-2] + ' marker-end="url(#edm-arrow)"/>'
        return tag

    svg = re.sub(r"<line\b[^>]*?/>", patch_line, svg, flags=re.IGNORECASE)
    svg = re.sub(r"<path\b[^>]*?/>", patch_path, svg, flags=re.IGNORECASE)
    return svg


def _element_boxes(svg: str) -> list[tuple[float, float, float, float]]:
    body = re.sub(r"<defs[\s\S]*?</defs>", "", svg, flags=re.IGNORECASE)
    boxes: list[tuple[float, float, float, float]] = []

    def push(x0: float, y0: float, x1: float, y1: float) -> None:
        if math.isinf(x0) or math.isinf(x1) or math.isinf(y0) or math.isinf(y1):
            return
        boxes.append((x0, y0, x1, y1))

    def nums(raw: str | None) -> list[float]:
        if not raw:
            return []
        return [float(v) for v in re.findall(r"[+-]?(?:\d+\.?\d*|\.\d+)", raw)]

    for tag in re.findall(r"<rect\b[^>]*?/>", body, re.IGNORECASE):
        try:
            x0, y0 = float(_svg_attr(tag, "x") or 0), float(_svg_attr(tag, "y") or 0)
            w0, h0 = float(_svg_attr(tag, "width") or 0), float(_svg_attr(tag, "height") or 0)
        except ValueError:
            continue
        push(x0, y0, x0 + w0, y0 + h0)

    for tag in re.findall(r"<circle\b[^>]*?/>", body, re.IGNORECASE):
        try:
            cx, cy = float(_svg_attr(tag, "cx") or 0), float(_svg_attr(tag, "cy") or 0)
            r = float(_svg_attr(tag, "r") or 0)
        except ValueError:
            continue
        push(cx - r, cy - r, cx + r, cy + r)

    for tag in re.findall(r"<ellipse\b[^>]*?/>", body, re.IGNORECASE):
        try:
            cx, cy = float(_svg_attr(tag, "cx") or 0), float(_svg_attr(tag, "cy") or 0)
            rx, ry = float(_svg_attr(tag, "rx") or 0), float(_svg_attr(tag, "ry") or 0)
        except ValueError:
            continue
        push(cx - rx, cy - ry, cx + rx, cy + ry)

    for tag in re.findall(r"<line\b[^>]*?/>", body, re.IGNORECASE):
        ep = _line_endpoints(tag)
        if ep:
            x1, y1, x2, y2 = ep
            push(min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2))

    for tag in re.findall(r"<(?:polygon|polyline)\b[^>]*>", body, re.IGNORECASE):
        n = nums(_svg_attr(tag, "points"))
        if len(n) >= 4:
            push(min(n[0::2]), min(n[1::2]), max(n[0::2]), max(n[1::2]))

    for tag in re.findall(r"<path\b[^>]*?/>", body, re.IGNORECASE):
        n = nums(_svg_attr(tag, "d"))
        if len(n) >= 2:
            push(min(n[0::2]), min(n[1::2]), max(n[0::2]), max(n[1::2]))

    for m in re.finditer(r"<text\b[^>]*>([^<]*)</text>", body, re.IGNORECASE):
        tag = m.group(0)
        fs = _svg_attr(tag, "font-size")
        try:
            x0, y0 = float(_svg_attr(tag, "x") or 0), float(_svg_attr(tag, "y") or 0)
            fs0 = float(fs) if fs else 16.0
        except ValueError:
            continue
        w = max(len(m.group(1)) * fs0 * 0.62, fs0)
        push(x0, y0 - fs0, x0 + w, y0 + fs0 * 0.2)

    return boxes


def _tighten_viewbox(svg: str) -> str:
    """Fit the viewBox to the real content (fix clipping and huge empty margins)."""
    m = re.search(r"<svg\b[^>]*>", svg, re.IGNORECASE)
    if not m:
        return svg
    open_tag = m.group(0)
    width = _svg_attr(open_tag, "width")
    height = _svg_attr(open_tag, "height")
    vb_match = re.search(r'\b(viewBox|viewbox)\s*=\s*"([^"]*)"', open_tag)
    try:
        w0, h0 = float(width or 400), float(height or 300)
    except ValueError:
        w0, h0 = 400.0, 300.0
    if vb_match:
        parts = [float(v) for v in vb_match.group(2).replace(",", " ").split()]
        if len(parts) != 4:
            return svg
        vx, vy, vw, vh = parts
    else:
        vx, vy, vw, vh = 0.0, 0.0, w0, h0

    def set_viewbox(vb: str) -> str:
        if vb_match:
            return svg.replace(
                open_tag,
                open_tag.replace(vb_match.group(0), f'{vb_match.group(1)}="{vb}"', 1),
                1,
            )
        return svg.replace(
            open_tag,
            re.sub(r"<svg\b", f'<svg viewBox="{vb}"', open_tag, count=1, flags=re.IGNORECASE),
            1,
        )

    boxes = _element_boxes(svg)
    if not boxes:
        if vb_match:
            return svg
        return set_viewbox(f"0 0 {w0:g} {h0:g}")

    min_x = min(b[0] for b in boxes)
    min_y = min(b[1] for b in boxes)
    max_x = max(b[2] for b in boxes)
    max_y = max(b[3] for b in boxes)

    pad = max(8.0, min(vw, vh) * 0.02)
    margin = max(12.0, min(vw, vh) * 0.05)

    overflow = min_x < vx or min_y < vy or max_x > vx + vw or max_y > vy + vh
    shrink_x = (min_x - vx) > margin and (vx + vw - max_x) > margin
    shrink_y = (min_y - vy) > margin and (vy + vh - max_y) > margin

    if overflow:
        nvx, nvy = min(min_x - pad, vx), min(min_y - pad, vy)
        nvw = max(max_x + pad, vx + vw) - nvx
        nvh = max(max_y + pad, vy + vh) - nvy
    elif shrink_x and shrink_y:
        nvx, nvy = min_x - pad, min_y - pad
        nvw, nvh = max_x + pad - nvx, max_y + pad - nvy
    else:
        if not vb_match:
            return set_viewbox(f"{vx:g} {vy:g} {vw:g} {vh:g}")
        return svg

    if round(nvw, 2) == round(vw, 2) and round(nvh, 2) == round(vh, 2):
        return svg
    return set_viewbox(f"{nvx:g} {nvy:g} {nvw:g} {nvh:g}")


def _beautify_svg(svg: str) -> str:
    """Polish AI-drawn SVGs: rounded background, arrowheads on arrows, sane viewBox."""
    # Round the background rect corners.
    if re.search(r"<rect[^>]*\brx=", svg, re.IGNORECASE) is None:
        m = re.search(r"<rect[^>]*?/>", svg, re.IGNORECASE)
        if m:
            tag = m.group(0)
            fixed = tag[:-2] + ' rx="12"/>'
            svg = svg.replace(tag, fixed, 1)

    svg = _add_marker(svg)
    svg = _add_arrowheads(svg)
    svg = _tighten_viewbox(svg)
    return svg


def _clean_svg_fences(text: str) -> str:
    """Keep only real SVG markup inside ```svg fences; repair broken markup; drop fences that only describe the diagram."""

    def replace(match: re.Match) -> str:
        block = match.group(1)
        m = re.search(r"<svg\b[^>]*>", block, re.IGNORECASE)
        if not m:
            return ""
        outer_tag = m.group(0)
        body = block[m.end():]
        last_close = body.lower().rfind("</svg>")
        if last_close != -1:
            body = body[:last_close]

        # Remove any nested <svg> wrappers inside the body.
        body = re.sub(r"<svg\b[^>]*>", "", body, flags=re.IGNORECASE)
        body = re.sub(r"</svg>", "", body, flags=re.IGNORECASE)

        svg = outer_tag + body + "</svg>"

        # Remove zero-length lines (start == end).
        svg = re.sub(
            r"<line\b[^>]*?x1=\"([0-9.+-]+)\"[^>]*?y1=\"([0-9.+-]+)\"[^>]*?x2=\"\1\"[^>]*?y2=\"\2\"[^>]*?/>",
            "",
            svg,
            flags=re.IGNORECASE,
        )

        # Repaint large solid-black fills to light gray so shapes stay visible.
        # Only shapes, never <text> labels (those must stay black).
        svg = re.sub(
            r"<(circle|rect|ellipse|polygon|path)\b(?=[^>]*fill=[\"']black[\"'])[^>]*>",
            lambda m: m.group(0).replace('fill="black"', 'fill="#e5e7eb"').replace("fill='black'", "fill='#e5e7eb'"),
            svg,
            flags=re.IGNORECASE,
        )

        return "\n```svg\n" + _beautify_svg(svg.strip()) + "\n```\n"

    cleaned = re.sub(
        r"```svg\s*\r?\n([\s\S]*?)\r?\n```", replace, text, flags=re.IGNORECASE
    )
    return cleaned


# Words that unmistakably belong to ONE subject. Used only as a safety net to
# drop diagrams that clearly picture a DIFFERENT subject than the current lesson
# (e.g. a forces diagram inside a chemistry lesson). Deliberately small so good
# diagrams are never removed.
_OFFTOPIC_VOCAB = {
    "physics": [
        "force", "friction", "lever", "pulley", "newton", "momentum",
        "resultant", "circuit", "voltage", "resistance", "velocity",
        "acceleration", "gravity", "weight",
    ],
    "chemistry": [
        "reactant", "molecule", "catalyst", "acid", "base", "compound", "bond",
    ],
    "mathematics": [
        "parabola", "transversal", "coordinate", "slope", "vertex",
    ],
}

_STOPWORDS = {
    "the", "and", "for", "with", "about", "how", "what", "why", "into",
    "from", "that", "this", "these", "those", "are", "is", "of", "to", "in",
    "on", "by", "at", "an", "a", "their", "they", "them", "its", "it", "be",
    "or", "not", "you", "we", "your", "when", "where", "which", "can", "will",
    "would", "should", "has", "have", "had", "was", "were", "than", "then",
}


def _topic_keywords(topic: str, query: str) -> list[str]:
    words: list[str] = []
    for source in (topic or "", query or ""):
        for w in re.findall(r"[a-z]{4,}", source.lower()):
            if w not in _STOPWORDS and w not in words:
                words.append(w)
    return words


def _drop_offtopic_diagrams(text: str, subject: str, topic: str, query: str) -> str:
    """Remove ```svg diagrams that clearly belong to another subject.

    A safety net for when the model draws a valid-looking but off-topic diagram
    (e.g. force arrows for a chemistry question). A diagram region (the SVG plus
    the parts legend right below it) is removed only when BOTH hold:
      - it shares no key word with the lesson topic, AND
      - it contains unmistakable vocabulary from a DIFFERENT subject.
    Otherwise the diagram is kept, so good diagrams are never removed.
    """
    vocab = [
        w
        for other, words in _OFFTOPIC_VOCAB.items()
        if other != subject
        for w in words
    ]
    if not vocab:
        return text
    topic_words = _topic_keywords(topic, query)
    if not topic_words:
        return text

    def region_hits(region: str) -> tuple[int, int]:
        body = re.sub(r"<[^>]+>", " ", region).lower()
        topic_hits = sum(
            len(re.findall(r"\b" + re.escape(w) + r"\w*", body))
            for w in topic_words
        )
        off_hits = sum(
            len(re.findall(r"\b" + re.escape(w) + r"\w*", body))
            for w in vocab
        )
        return topic_hits, off_hits

    lines = text.split("\n")
    out: list[str] = []
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        if line.strip().startswith("```svg"):
            block: list[str] = []
            j = i + 1
            while j < n and not lines[j].strip().startswith("```"):
                block.append(lines[j])
                j += 1
            close_fence = lines[j] if j < n else ""

            k = j + 1
            legend: list[str] = []
            while k < n and lines[k].strip() == "":
                k += 1
            legend_start = k
            while k < n and lines[k].strip().startswith("**"):
                legend.append(lines[k])
                k += 1

            region = "\n".join(block) + "\n" + "\n".join(legend)
            topic_hits, off_hits = region_hits(region)

            if topic_hits == 0 and off_hits > 0:
                # Off-topic: drop the fence and everything through the legend.
                i = k
                continue

            out.append(line)
            out.extend(block)
            if close_fence:
                out.append(close_fence)
            i = j + 1
            continue

        out.append(line)
        i += 1

    return "\n".join(out)


def generate_lesson(
    topic: str, syllabus_context: list[str],
    math_solution: dict | None, student_query: str,
    subject: str = "mathematics",
) -> str:
    context_text = "\n\n".join(syllabus_context) if syllabus_context else "(No textbook context available)"

    math_instruction = ""
    if math_solution:
        math_instruction = f"""
Use the verified math solution provided — do not recalculate or second-guess it,
just explain it clearly.

Verified math solution (do not alter these values):
{math_solution}
"""

    prompt = f"""
You are a friendly, patient secondary school teacher in Malawi, teaching {subject}
according to the national syllabus. Explain concepts clearly, using simple
language a secondary school student can follow. Base your teaching strictly on
the textbook context provided below — do not make up information not found in it.
{math_instruction}
Student question: {student_query}
Topic being taught: {topic}
Subject: {subject}

Textbook context:
{context_text}

Write the lesson as ONE continuous, flowing explanation. Do NOT use headings,
numbered steps, "Step 1:", "Step 2:", or any section labels.
Connect each idea to the next with smooth transitions so it reads like a story.

Make the lesson thorough, about 600-900 words. Fully develop each idea, define
every new term, explain the "why" behind each concept, add a real-life example,
clear up one common misconception students often have, then end with a short
worked example and one practice exercise (without giving away the practice
exercise's answer), all in the same continuous prose.

INCLUDE DIAGRAMS: create 1 or 2 simple teaching diagrams as inline SVG so the
student can see what you are explaining.

THE MOST IMPORTANT RULE: every diagram MUST teach the EXACT concept named in
"Topic being taught" and the student question above — never a different concept
from the same or a related subject. Before each diagram, silently check: "Does
this picture illustrate the very concept I am explaining right now?" If not,
redraw it. Examples of WRONG pairings to avoid:
- Teaching a chemical reaction -> do NOT draw force arrows, levers, or pulleys;
  draw the reaction instead (reactants and products, atoms recombining, e.g.
  hydrogen + oxygen -> water).
- Teaching photosynthesis -> do NOT draw a plant's root system or a physics
  diagram; draw a leaf showing sunlight, water and carbon dioxide going in and
  glucose and oxygen coming out.
- Teaching balanced forces -> do NOT draw a molecule or a graph; draw the object
  with the balanced force arrows.
A diagram about a different concept than the current topic is a FAILURE even if
it is technically a valid drawing.

Make the diagrams REAL and ACCURATE — a proper
drawing, not a placeholder. You may draw REAL OBJECTS, not only geometric shapes:
a labelled car (wheels, engine, seats), a human body or heart, a plant, a water
cycle, a circuit, a lever, a pulley — draw whichever object best teaches the
concept. Draw diagrams that fit the subject:
- For {subject} physics: force arrows on a box or object (e.g. an arrow pushing
  a box, labelled "F = 5 N"), or a pulley, lever, or circuit sketch. Arrows must
  point the correct way, scale roughly with size, and have visible arrowheads.
- For {subject} mathematics: geometry (angles, triangles, parallel lines cut by
  a transversal), or coordinate axes with a plotted line or curve. Axes must be
  drawn with arrowheads and labelled x/y with sensible tick numbers.
- For {subject} chemistry: for reactions, show the reactants on the left and the
  products on the right, with an arrow between them and atoms (circles labelled
  with element symbols, e.g. H, O, C) that recombine across the arrow. Atom sizes
  should be roughly proportional (oxygen bigger than hydrogen). For a specific
  molecule or structure (atom, molecule, cell), draw that object itself, clearly
  labelled.
- For any other {subject}, or whenever the topic is about an everyday object:
  draw the actual object (car, human body, plant, heart, water cycle, circuit,
  machine, food web, etc.) as a clear labelled sketch — never a stick figure or
  a placeholder.

CRITICAL RULES FOR DIAGRAMS:
- Output the ACTUAL SVG code, not a description of it. Never write sentences
  like "here is a diagram with width 400 and height 300" or list the SVG
  attributes (colors, widths, heights) as text.
- Place each diagram inside a fenced code block tagged ```svg (all on their own
  lines). The content inside the fence must be ONLY raw SVG markup starting with
  <svg and ending with </svg>.
- Each diagram must be a COMPLETE, VALID, self-contained SVG:
  - viewBox="0 0 400 300" (or similar), width="100%".
  - It MUST end with a closing </svg> tag. Every opening tag must be closed.
  - Never nest <svg> inside <svg> — the SVG must have exactly one <svg> element.
  - Use a white <rect> as the background (fill="white").
- Draw shapes with FILL, not just outlines, so the diagram is visible:
  - Use fill="white" plus stroke="black" stroke-width="2" for boxes, wheels,
    and object outlines.
  - Use light pastel fills (e.g. #bfdbfe blue, #bbf7d0 green, #fef08a yellow)
    for shaded regions or filled objects.
  - Small dots/points should be <circle r="3" fill="black" />.
  - NEVER fill a large shape solid black — that only creates a black blob.
- Arrows must have visible arrowheads. The cleanest way is to define ONE marker
  in <defs> and reuse it on every arrow:
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
  markerWidth="7" markerHeight="7" orient="auto-start-reverse">
  <path d="M0,0 L10,5 L0,10 z" fill="#dc2626"/></marker></defs>
  Then draw each arrow as <line x1=".." y1=".." x2=".." y2=".."
  stroke="#dc2626" stroke-width="3" marker-end="url(#arrow)"/>.
  orient="auto" makes the arrowhead point along the line automatically.
  A filled <polygon> arrowhead drawn next to the line is also acceptable.
- Never draw a line where x1==x2 and y1==y2 (a zero-length invisible line).
  Give every arrow a visible start AND end.
- When an arrow points at a part of an object, put a short <text> label beside
  the arrow (near its middle or near its tip), e.g. "force", "tyre", "handle",
  "up", and tag that arrow and its label with the same data-part number.
- Make labels read well: use <text> with fill="black" and font-size around 16,
  positioned beside the thing they describe, not overlapping other shapes.
- Use correct proportions: right angles get a small square marker, equal sides
  get matching tick marks, and similar shapes look similar.
- LABEL THE KEY PARTS FOR TEACHING: tag the important elements with data-part
  numbers in the order a teacher would explain them. Add data-part="1",
  data-part="2", etc. directly to the main SVG elements, or wrap a part's
  elements in a <g data-part="1">...</g> group. Tag every meaningful part the
  lesson will explain (axes, the plotted line/curve, labelled points, arrows,
  angle markers, atom circles, force arrows, and so on). Do NOT tag the
  background rectangle.
- The app automatically draws a numbered badge beside each data-part, so do NOT
  draw your own numbered circles or labels for the parts.
- IMMEDIATELY AFTER each ```svg diagram block, add a short numbered parts legend
  as plain markdown. It must match the data-part numbers EXACTLY, using this
  format (one line per part, number first):
  **Parts of this diagram**
  **1. Axis** — the horizontal line that shows the x values.
  **2. Parabola** — the curve traced by the equation.
  Each line is "**N. Short name** — one sentence explaining what it is or does."
  Keep the legend right below its diagram, then continue the flowing prose.
- Never use scripts, images, external fonts, or CSS classes inside the SVG.
- NARRATE THE DIAGRAM: just before each ```svg block, briefly say in words what
  the diagram shows and what the student should notice (2-3 sentences), for
  example: "This drawing shows a car being pushed by a force. The blue arrow,
  labelled F = 5 N, points to the right to show the direction of the push." Then
  give the SVG code, then the parts legend. Do NOT list the SVG's technical
  attributes (colors, widths, heights) as text — describe what the picture shows.
- Continue the flowing prose around the code blocks normally.
- FINAL SELF-CHECK before finishing: reread "Topic being taught" and make sure
  every diagram you wrote actually pictures THAT topic (e.g. a chemical reaction
  must show reactants turning into products — never a forces/lever/graph drawing
  from another topic). If any diagram does not, replace it before finishing.
"""

    try:
        text = _call_groq(prompt)
    except Exception:
        text = _call_ollama(prompt)
        if not text:
            raise RuntimeError(
                "The AI service is temporarily busy (rate limit reached). "
                "Please wait about a minute and try again."
            )
    return _drop_offtopic_diagrams(text, subject, topic, student_query)
