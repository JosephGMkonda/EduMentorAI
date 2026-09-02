from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.rag_service import retrieve_relevant_chunks
from app.services.math_angine import solve_quadratic
from app.services.diagram_service import quadratic_graph_svg
from app.services.llm_service import generate_lesson
from app.services.quiz_service import generate_quiz
from app.services.assistant_service import (
    generate_followup,
    generate_practice,
    check_practice_answer,
)
from pydantic import BaseModel


class LessonResponse(BaseModel):
    query: str
    subject: str
    form_level: str
    topic: str
    math_solution: dict | None = None
    lesson: str


class FollowUpRequest(BaseModel):
    query: str
    subject: str = "mathematics"
    form_level: str = "Form 1"
    topic: str = ""
    lesson_excerpt: str = ""
    history: list[dict] = []


class PracticeCheckRequest(BaseModel):
    problem: str
    answer: str
    explanation: str
    student_answer: str
    topic: str = ""


router = APIRouter()

@router.get("/quadratic")
def get_quadratic_solution(a: float, b: float, c: float):
    return solve_quadratic(a, b, c)

@router.get("/relevant_chunks")
def retrieve_context(
    query: str,
    subject: str = "mathematics",
    form_level: str = "Form 1",
    topic: str | None = None,
    db: Session = Depends(get_db),
):
    chunks = retrieve_relevant_chunks(db, query, subject=subject, form_level=form_level, topic=topic)
    return {"query": query, "subject": subject, "form_level": form_level, "relevant_chunks": chunks}

@router.get("/quiz", response_model=dict)
def get_quiz(
    query: str = Query(default="", description="Topic/question for the quiz"),
    subject: str = Query(default="mathematics", description="Subject name"),
    form_level: str = Query(default="Form 1", description="Form level"),
    topic: str = Query(default="", description="Topic name"),
    db: Session = Depends(get_db),
):
    topic_filter = topic if topic else None
    syllabus_chunks = retrieve_relevant_chunks(
        db, query or topic or subject, subject=subject, form_level=form_level, topic=topic_filter
    )
    try:
        questions = generate_quiz(topic or query or subject, syllabus_chunks, subject)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"topic": topic or query or subject, "questions": questions}


@router.post("/followup", response_model=dict)
def follow_up(req: FollowUpRequest, db: Session = Depends(get_db)):
    try:
        reply = generate_followup(
            req.query,
            req.subject,
            req.form_level,
            req.topic or req.query,
            req.lesson_excerpt,
            req.history,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"reply": reply}


@router.get("/practice", response_model=dict)
def get_practice(
    topic: str = Query(default="", description="Topic for practice"),
    subject: str = Query(default="mathematics", description="Subject name"),
    form_level: str = Query(default="Form 1", description="Form level"),
    db: Session = Depends(get_db),
):
    topic_filter = topic or None
    syllabus_chunks = retrieve_relevant_chunks(
        db, topic or subject, subject=subject, form_level=form_level, topic=topic_filter
    )
    try:
        problems = generate_practice(topic or subject, syllabus_chunks, subject)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"topic": topic or subject, "problems": problems}


@router.post("/practice/check", response_model=dict)
def practice_check(req: PracticeCheckRequest):
    try:
        result = check_practice_answer(
            req.problem, req.answer, req.explanation, req.student_answer, req.topic
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return result


@router.get("/lesson", response_model=LessonResponse)
def get_lesson(
    query: str,
    subject: str = Query(default="mathematics", description="Subject name"),
    form_level: str = Query(default="Form 1", description="Form level"),
    topic: str = Query(default="", description="Topic name"),
    a: float | None = Query(default=None, description="Quadratic coefficient a (math only)"),
    b: float | None = Query(default=None, description="Quadratic coefficient b (math only)"),
    c: float | None = Query(default=None, description="Quadratic coefficient c (math only)"),
    db: Session = Depends(get_db),
):
    topic_filter = topic if topic else None
    syllabus_chunks = retrieve_relevant_chunks(
        db, query, subject=subject, form_level=form_level, topic=topic_filter
    )

    # Only solve math if coefficients are provided
    math_solution = None
    diagram_svg = None
    if a is not None and b is not None and c is not None:
        math_solution = solve_quadratic(a, b, c)
        try:
            diagram_svg = quadratic_graph_svg(a, b, c)
        except Exception:
            diagram_svg = None

    try:
        lesson = generate_lesson(topic or subject, syllabus_chunks, math_solution, query, subject)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    if diagram_svg:
        lesson = (
            lesson.rstrip()
            + "\n\n```svg\n"
            + diagram_svg
            + "\n```\n"
            + "\n\n**Parts of this diagram**\n"
            + "**1. Axes** — the x- and y-axes, with arrowheads showing their direction.\n"
            + "**2. Parabola** — the curve traced by the equation, opening up or down.\n"
            + "**3. Roots** — the points where the curve crosses the x-axis (where y = 0).\n"
            + "**4. Vertex** — the turning point: the highest point (maximum) or the lowest point (minimum).\n"
        )

    return LessonResponse(
        query=query,
        subject=subject,
        form_level=form_level,
        topic=topic or subject,
        math_solution=math_solution,
        lesson=lesson,
    )



