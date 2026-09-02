import sympy as sp

def solve_math_problem(problem_type: str, **kwargs):
    if problem_type == "quadratic":
        return solve_quadratic(**kwargs)
    else:
        raise ValueError("Unsupported problem type")

def solve_quadratic(a: float, b: float, c: float):
    x = sp.symbols('x')
    expr = a * x**2 + b * x + c
    solutions = sp.solve(expr, x)
    factored = sp.factor(expr)

    return {
        "equation": str(expr),
        "solutions": [str(s) for s in solutions],
        "factored_form": str(factored),
    }