import pdfplumber
import re

class CurriculumService:

    @staticmethod
    def clean_cell(text: str | None) -> str:
        if not text:
            return ""
        text = text.replace("\uf0b7", "")
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    @staticmethod
    def extract_topics_from_pdf(pdf_path: str, target_form: str = "Form 1") -> list[dict]:
        topics = []
        current_form = None

        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""

                # Detect which Form section we're currently in
                if re.search(r"\bForm\s*1\b", page_text) and not re.search(r"\bForm\s*2\b", page_text):
                    current_form = "Form 1"
                elif re.search(r"\bForm\s*2\b", page_text) and not re.search(r"\bForm\s*1\b", page_text):
                    current_form = "Form 2"
                # if both appear (e.g. overview pages), leave current_form unchanged — ambiguous page

                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        if len(row) < 3:
                            continue

                        topic = CurriculumService.clean_cell(row[2])
                        learning_objective = CurriculumService.clean_cell(row[1])

                        if not topic or len(topic) < 3:
                            continue

                        # Skip header rows and known noise
                        if topic.lower() in ("form 1", "form 2", "theme/topic"):
                            continue

                        # Skip long blob rows (overview/summary tables merge many topics into one cell)
                        if len(topic) > 60 or topic.count(" ") > 8:
                            continue

                        if current_form != target_form:
                            continue

                        topics.append({
                            "topic": topic,
                            "learning_objective": learning_objective,
                        })

        return topics