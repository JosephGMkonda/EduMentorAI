from pathlib import Path
import fitz  



class PDFService:
    @staticmethod
    def extract_pdf(pdf_path: str):
        document = fitz.open(pdf_path)

        pages = []

        for page_number, page in enumerate(document):
            text = page.get_text()

            pages.append({
                "page": page_number + 1,
                "text": text
            })

        document.close()

        return pages
