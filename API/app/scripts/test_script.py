from app.services.pdf_service import extract_text_from_pdf

text = extract_text_from_pdf("app/books/form1/mathematics/Maths-SSS_Year_1_Term_01 Full-PupilHandbook.pdf")

print(len(text))