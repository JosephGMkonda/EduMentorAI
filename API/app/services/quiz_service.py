import json
import re
from app.services.llm_service import _call_groq, _call_ollama


def _parse_quiz_json(raw: str) -> list[dict]:
    raw = raw.strip()
    json_match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not json_match:
        raise ValueError("No JSON found in quiz response")
    data = json.loads(json_match.group(0))
    if isinstance(data, dict) and "questions" in data:
        data = data["questions"]
    if not isinstance(data, list):
        raise ValueError("Quiz response is not a list")
    return data


def generate_quiz(
    topic: str,
    syllabus_context: list[str],
    subject: str = "mathematics",
) -> list[dict]:
    context_text = (
        "\n\n".join(syllabus_context)
        if syllabus_context
        else "(No textbook context available)"
    )

    prompt = f"""
You are a secondary school teacher in Malawi testing a student on {topic}
({subject}). Base every question strictly on the textbook context provided below.

Textbook context:
{context_text}

Create a short quiz of 4 multiple-choice questions about {topic}. The questions
should get progressively harder, test understanding (not just memorisation), and
be appropriate for the national syllabus.

Return your answer as ONLY valid JSON with this exact structure (no extra text,
no markdown fences):

{{
  "questions": [
    {{
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "Short 1-2 sentence explanation"
    }}
  ]
}}

Rules:
- Each question has exactly 4 options.
- correct_index is the 0-based index of the correct option.
- The explanation must teach why that answer is correct.
- Do not invent facts that are not in the context.
"""

    try:
        raw = _call_groq(prompt)
    except Exception:
        raw = _call_ollama(prompt)
        if not raw:
            raise RuntimeError(
                "The AI service is temporarily busy (rate limit reached). "
                "Please wait about a minute and try again."
            )

    questions = _parse_quiz_json(raw)
    cleaned = []
    for q in questions:
        options = [str(o) for o in q.get("options", [])]
        if len(options) < 2:
            continue
        cleaned.append(
            {
                "question": str(q.get("question", "")).strip(),
                "options": options,
                "correct_index": int(q.get("correct_index", 0)),
                "explanation": str(q.get("explanation", "")).strip(),
            }
        )
    if len(cleaned) < 2:
        raise ValueError("Quiz generation returned too few valid questions")
    return cleaned
