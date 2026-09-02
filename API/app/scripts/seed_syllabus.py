from app.db.database import SessionLocal
from app.models.knowledge_chunk import KnowledgeChunk
from app.services.embedding_service import generate_embedding

CHUNKS = [
    # --- Introduction ---
    {
        "subject": "mathematics",
        "form_level": "Form 1",
        "topic": "quadratic_equations",
        "content": "A quadratic equation is one which must contain a term involving x^2, e.g. 3x^2, -5x^2, or just x^2 on its own. It may also contain terms involving x, e.g. 5x or -7x, and constant terms such as 6 or -7. It cannot have terms involving higher powers of x like x^3, and cannot have terms like 1/x."
    },
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "In general, a quadratic equation takes the form ax^2 + bx + c = 0, where a can be any number excluding zero, and b and c can be any numbers including zero. If b or c is zero, that term will not appear."
    },
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "There are four main methods for solving quadratic equations: solution by factorisation, solution by completing the square, solution using the quadratic formula, and solution using graphs. Factorisation and the formula are particularly important."
    },

    # --- Solving by factorisation ---
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "To solve a quadratic equation by factorisation, first write it in standard form ax^2 + bx + c = 0. Look for a common factor across all terms and extract it. For example, 3x^2 - 27 = 0 becomes 3(x^2 - 9) = 0, which factorises further as a difference of two squares: 3(x - 3)(x + 3) = 0."
    },
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "If two quantities multiplied together equal zero, then at least one of the quantities must be zero. So if (x - 3)(x + 3) = 0, then either x - 3 = 0 or x + 3 = 0, giving solutions x = 3 or x = -3."
    },
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "When a quadratic equation has no constant term, such as 5x^2 + 3x = 0, factor out the common x to get x(5x + 3) = 0, giving solutions x = 0 or x = -3/5. A common student error is cancelling the common factor of x directly, which loses the solution x = 0. Quadratic equations generally have two solutions."
    },
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "To factorise x^2 - 5x + 6 = 0, find two numbers that multiply to give 6 (the constant term) and add to give -5 (the coefficient of x). These numbers are -3 and -2. Rewrite -5x as -3x - 2x, then factorise by grouping: x(x - 3) - 2(x - 3) = 0, giving (x - 3)(x - 2) = 0, so x = 3 or x = 2."
    },
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "For a quadratic ax^2 + bx + c = 0 where a is not 1, such as 2x^2 + 3x - 2 = 0, find two numbers that multiply to give a*c (here -4) and add to give b (here 3). These numbers are 4 and -1. Rewrite 3x as 4x - x, then factorise by grouping to get (x + 2)(2x - 1) = 0, giving x = -2 or x = 1/2."
    },
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "Some quadratic equations have a repeated solution. For example, 4x^2 - 12x + 9 = 0 factorises to (2x - 3)(2x - 3) = 0, giving x = 3/2 as the only (repeated) solution."
    },
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "Not every quadratic expression will factorise using integers. For x^2 - 3x - 2 = 0, no two integers multiply to give -2 and add to give -3, so this equation cannot be solved by simple factorisation. Other methods such as completing the square or the quadratic formula are needed instead."
    },

    # --- Completing the square ---
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "To solve a quadratic equation by completing the square, rewrite the x^2 and x terms as a squared bracket. For x^2 - 3x - 2 = 0, half the coefficient of x is -3/2, so write (x - 3/2)^2, then subtract (3/2)^2 to compensate for the extra term introduced: x^2 - 3x - 2 = (x - 3/2)^2 - (3/2)^2 - 2 = 0."
    },
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "Simplifying the completed square form (x - 3/2)^2 - 17/4 = 0 gives (x - 3/2)^2 = 17/4. Taking the square root of both sides gives x - 3/2 = ±(sqrt(17)/2), so x = (3 + sqrt(17))/2 or x = (3 - sqrt(17))/2. These are exact solutions."
    },

    # --- The quadratic formula ---
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "The quadratic formula solves any equation of the form ax^2 + bx + c = 0 using x = (-b ± sqrt(b^2 - 4ac)) / (2a). This formula is important to memorize since it works even when factorisation is not possible."
    },
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "To apply the quadratic formula to x^2 - 3x - 2 = 0, identify a = 1, b = -3, c = -2, then substitute into x = (-b ± sqrt(b^2 - 4ac)) / (2a) to get x = (3 ± sqrt(9 + 8)) / 2 = (3 ± sqrt(17)) / 2, matching the completing-the-square result."
    },
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "Before applying the quadratic formula, rearrange the equation into standard form ax^2 + bx + c = 0. For example, 3x^2 = 5x - 1 becomes 3x^2 - 5x + 1 = 0, with a = 3, b = -5, c = 1, giving solutions x = (5 ± sqrt(13)) / 6."
    },

    # --- Solving by graphs ---
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "A graph of y = ax^2 + bx + c is a parabola. If a is positive, the parabola opens upward; if a is negative, it opens downward. Points where the graph crosses or touches the x-axis (where y = 0) correspond to the solutions of ax^2 + bx + c = 0."
    },
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "If a parabola never touches the x-axis, the quadratic equation has no real roots. If the parabola just touches the x-axis at one point, the equation has two equal (repeated) roots. If the parabola crosses the x-axis at two points, the equation has two distinct real roots."
    },
    {
        "subject": "mathematics",
        "topic": "quadratic_equations",
        "content": "To solve a quadratic equation graphically, plot y = ax^2 + bx + c using a table of values, then read off the x-values where the curve crosses the x-axis. The same graph can be reused to solve related equations by locating where the curve crosses a horizontal line y = k instead of the x-axis, after rearranging the equation into the form ax^2 + bx + c = k."
    },
]


def seed():
    db = SessionLocal()
    try:
        for chunk in CHUNKS:
            embedding = generate_embedding(chunk["content"])
            record = KnowledgeChunk(
                subject=chunk["subject"],
                form_level=chunk.get("form_level", "Form 1"),
                topic=chunk["topic"],
                source_book="seed_data",
                content=chunk["content"],
                embedding=embedding,
            )
            db.add(record)
        db.commit()
        print(f"Seeded {len(CHUNKS)} chunks.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()