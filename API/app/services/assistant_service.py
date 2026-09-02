import json
import re
from app.services.llm_service import _call_groq, _call_ollama


def _extract_json(raw: str) -> dict:
    raw = raw.strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError("No JSON found in response")
    return json.loads(match.group(0))


def _generate(prompt: str, max_tokens: int = 2000) -> str:
    try:
        return _call_groq(prompt)
    except Exception:
        raw = _call_ollama(prompt)
        if raw:
            return raw
        raise RuntimeError(
            "The AI service is temporarily busy (rate limit reached). "
            "Please wait about a minute and try again."
        )


def generate_followup(
    query: str,
    subject: str,
    form_level: str,
    topic: str,
    lesson_excerpt: str,
    history: list[dict],
) -> str:
    conversation = ""
    for msg in history:
        role = "Student" if msg.get("role") == "user" else "Teacher"
        conversation += f"{role}: {msg.get('content', '')}\n"

    prompt = f"""
You are a friendly, patient secondary school teacher in Malawi helping a student
who is reading a lesson about {topic} ({subject}, {form_level}). Use ONLY the
lesson content below — do not invent facts.

Lesson content (current lesson the student is reading):
{lesson_excerpt or "(no lesson text provided)"}

Conversation so far:
{conversation or "(none yet)"}

Student's latest question: {query}

Answer helpfully in simple, warm language a secondary school student can follow.
Aim for 80-150 words. Explain clearly with an example if it helps. If the
question is unrelated or not covered by the lesson, gently say so and steer the
student back to {topic}. Write as one short flowing paragraph — no headings,
no numbered steps.
"""

    return _generate(prompt).strip()


def generate_practice(
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
You are a secondary school teacher in Malawi setting practice questions on
{topic} ({subject}). Base every question strictly on the textbook context below.

Textbook context:
{context_text}

Create exactly 3 short practice questions about {topic}, going from easy to
harder. They should test understanding, be solvable by a secondary school
student, and each must have a clear single correct answer.

Return ONLY valid JSON (no extra text, no markdown fences):

{{
  "problems": [
    {{
      "problem": "The question text",
      "answer": "The concise correct answer",
      "explanation": "1-2 sentence explanation of how to get the answer"
    }}
  ]
}}

Rules:
- Each problem has exactly these 3 fields.
- Keep the "problem" self-contained so a student can solve it without other text.
- The "answer" must be specific enough to mark an answer correct or wrong.
- Do not invent facts that are not in the context.
"""

    raw = _generate(prompt)
    data = _extract_json(raw)
    problems = data.get("problems", []) if isinstance(data, dict) else data

    cleaned = []
    for i, p in enumerate(problems):
        problem = str(p.get("problem", "")).strip()
        answer = str(p.get("answer", "")).strip()
        explanation = str(p.get("explanation", "")).strip()
        if problem and answer:
            cleaned.append(
                {
                    "id": i + 1,
                    "problem": problem,
                    "answer": answer,
                    "explanation": explanation,
                }
            )
    if not cleaned:
        raise ValueError("Practice generation returned no usable problems")
    return cleaned


def check_practice_answer(
    problem: str,
    answer: str,
    explanation: str,
    student_answer: str,
    topic: str = "",
) -> dict:
    prompt = f"""
You are a friendly secondary school teacher marking a student's answer.

Topic: {topic or "this topic"}
Question: {problem}
Correct answer (model answer): {answer}
Teacher's explanation: {explanation}
Student's answer: {student_answer or "(student gave no answer)"}

Decide whether the student's answer is correct. Accept reasonable equivalent
answers, close wording, or answers that show the right idea even if phrasing
differs. Be fair but honest.

Return ONLY valid JSON (no extra text, no markdown fences):

{{
  "correct": true,
  "feedback": "1-2 sentences. If correct, praise briefly and confirm. If wrong, "
}}
"""

    raw = _generate(prompt, max_tokens=600)
    try:
        data = _extract_json(raw)
        correct = bool(data.get("correct", False))
        feedback = str(data.get("feedback", "")).strip()
    except Exception:
        correct = False
        feedback = "Sorry — I could not mark that answer. Please try again."
    return {"correct": correct, "feedback": feedback}
