from app.services.curriculum_service import CurriculumService

topics = CurriculumService.extract_topics_from_pdf(
    "app/books/form1/mathematics/syllabus_fixed.pdf",
    target_form="Form 1"
)

print(f"Total topic rows extracted: {len(topics)}")
unique_topics = sorted(set(t["topic"] for t in topics))
print(f"\nUnique topics ({len(unique_topics)}):")
for name in unique_topics:
    print(f"- {name}")