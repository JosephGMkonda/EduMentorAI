from pathlib import Path
from app.db.database import SessionLocal
from app.models.curriculum_topic import CurriculumTopic
from app.models.knowledge_chunk import KnowledgeChunk
from app.services.pdf_service import PDFService
from app.services.text_cleaner import TextCleaner
from app.services.chunk_service import ChunkService
from app.services.curriculum_service import CurriculumService
from app.services.embedding_service import generate_embedding
from app.services.llm_service import groq_client, ollama_client
import time
import json
import re

BOOKS_ROOT = Path(__file__).resolve().parent.parent / "books"
PROGRESS_DIR = BOOKS_ROOT / ".progress"
PROGRESS_DIR.mkdir(exist_ok=True)


def call_with_retry(prompt: str, max_retries=5):  
    for attempt in range(max_retries):
        try:
            response = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2048,
            )
            if response.choices and response.choices[0].message.content:
                return response
            print(f"  Empty response on attempt {attempt + 1}, retrying...")
        except Exception as e:
            error_str = str(e)
            print(f"  API error: {error_str[:150]}")
            # Try to extract retry_after from error message
            retry_match = re.search(r"retry_after[=:]?\s*(\d+)", error_str)
            wait = 0
            if retry_match:
                wait = int(retry_match.group(1))
            if "429" in error_str or "rate_limit" in error_str.lower():
                wait = wait or (20 * (attempt + 1))
                print(f"  Rate limited — waiting {wait}s before retry...")
                time.sleep(wait)
            elif "503" in error_str or "overloaded" in error_str.lower():
                wait = wait or (15 * (attempt + 1))
                print(f"  Server overloaded — waiting {wait}s before retry...")
                time.sleep(wait)
            elif "Connection" in error_str or "refused" in error_str or "Timeout" in error_str:
                wait = wait or (10 * (attempt + 1))
                print(f"  Connection issue — waiting {wait}s before retry...")
                time.sleep(wait)
            else:
                print(f"  Unexpected error — waiting {attempt + 1}s before retry...")
                time.sleep(attempt + 1)
    raise RuntimeError("Exceeded max retries due to repeated API errors.")


def classify_topics_batch(chunks: list[str], topic_names: list[str]) -> list[str]:
    topic_list = "\n".join(f"- {t}" for t in topic_names)
    numbered_chunks = "\n\n".join(f"[{i}] {c}" for i, c in enumerate(chunks))

    prompt = f"""
Syllabus topics:
{topic_list}

For each numbered passage below, decide which ONE topic from the list it best matches,
or "NONE" if it matches nothing.

Passages:
{numbered_chunks}

Return ONLY a JSON array of strings, one per passage, in order. Example:
["Numbers", "NONE", "Fractions"]
"""
    for attempt in range(3):
        try:
            response = call_with_retry(prompt)
            raw = response.choices[0].message.content.strip()
            # Extract JSON array from response (handle markdown fences and extra text)
            start = raw.find("[")
            end = raw.rfind("]")
            if start != -1 and end != -1:
                cleaned = raw[start:end + 1]
            else:
                cleaned = raw.strip("```json").strip("```").strip()
            result = json.loads(cleaned)
            if isinstance(result, list) and len(result) == len(chunks):
                return result
            print(f"  Retry {attempt + 1}: unexpected response format, got {len(result) if isinstance(result, list) else 0}/{len(chunks)} items")
        except (json.JSONDecodeError, ValueError) as e:
            print(f"  Retry {attempt + 1}: JSON parse error — {e}")
            time.sleep(2)
    # Fallback: return all NONE so processing continues
    print(f"  Failed to classify after 3 attempts, marking all as NONE")
    return ["NONE"] * len(chunks)


def full_text_from_pdf(pdf_path: Path) -> str:
    pages = PDFService.extract_pdf(str(pdf_path))
    full_text = "\n".join(p["text"] for p in pages)
    return TextCleaner.clean(full_text)


def ingest_syllabus(pdf_path: Path, subject: str, form_level: str, db):
    topics_data = CurriculumService.extract_topics_from_pdf(str(pdf_path), target_form=form_level)

    topic_names = []
    for i, t in enumerate(topics_data):
        db.add(CurriculumTopic(
            form_level=form_level,
            subject=subject,
            topic=t["topic"],
            learning_objective=t["learning_objective"],
            order_number=i,
        ))
        topic_names.append(t["topic"])

    db.commit()
    print(f"  Syllabus: {len(topics_data)} topics extracted from {pdf_path.name}")
    return topic_names


def _progress_file(subject: str, form_level: str, pdf_path: Path) -> Path:
    safe_name = f"{subject}_{form_level}_{pdf_path.stem}".replace(" ", "_")
    return PROGRESS_DIR / f"{safe_name}.json"


def _load_progress(progress_path: Path) -> int:
    """Returns the index of the next batch to process (0 if no progress saved)."""
    if progress_path.exists():
        try:
            data = json.loads(progress_path.read_text())
            return data.get("next_batch_start", 0)
        except (json.JSONDecodeError, OSError):
            return 0
    return 0


def _save_progress(progress_path: Path, next_batch_start: int):
    progress_path.write_text(json.dumps({"next_batch_start": next_batch_start}))


def ingest_textbook(pdf_path: Path, subject: str, form_level: str, topic_names: list[str], db):
    text = full_text_from_pdf(pdf_path)
    chunks = ChunkService.chunk_text(text)

    progress_path = _progress_file(subject, form_level, pdf_path)
    start_index = _load_progress(progress_path)

    if start_index > 0:
        print(f"  Resuming {pdf_path.name} from chunk {start_index}/{len(chunks)}")

    added = 0
    batch_size = 20
    use_ai_classification = 3 <= len(topic_names) <= 8

    if not use_ai_classification and len(topic_names) > 1:
        print(f"  Too many topics ({len(topic_names)}) for reliable AI classification — using keyword matching instead")

    try:
        for i in range(start_index, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]

            if use_ai_classification:
                batch_topics = classify_topics_batch(batch, topic_names)
            else:
                batch_topics = _match_keywords(batch, topic_names)

            for chunk, topic in zip(batch, batch_topics):
                if topic == "NONE" or topic not in topic_names:
                    continue
                embedding = generate_embedding(chunk)
                db.add(KnowledgeChunk(
                    subject=subject,
                    form_level=form_level,
                    topic=topic,
                    source_book=pdf_path.stem,
                    content=chunk,
                    embedding=embedding,
                ))
                added += 1

            db.commit()

            next_start = i + batch_size
            _save_progress(progress_path, next_start)

            if use_ai_classification:
                time.sleep(5)

    except Exception:
        print(f"  Stopped early on {pdf_path.name} — progress saved, rerun the script to resume.")
        raise

    if progress_path.exists():
        progress_path.unlink()

    print(f"  {pdf_path.name}: {added} chunks matched to syllabus topics (of {len(chunks)} total)")


STOP_WORDS = {"the", "a", "an", "of", "in", "to", "and", "is", "are", "was",
               "were", "for", "on", "at", "by", "with", "this", "that", "from"}

def _match_keywords(chunks: list[str], topic_names: list[str]) -> list[str]:
    """Keyword-based topic matching — no API calls needed."""
    if len(topic_names) == 1:
        return [topic_names[0]] * len(chunks)

    results = []
    for chunk in chunks:
        lower = chunk.lower()
        best_score = 0
        best_topic = "NONE"
        for topic in topic_names:
            words = [w for w in topic.lower().split() if w not in STOP_WORDS and len(w) > 2]
            score = sum(1 for w in words if w in lower)
            if score > best_score:
                best_score = score
                best_topic = topic
        results.append(best_topic if best_score > 0 else "NONE")
    return results


FORM_LABELS = {
    "form1": "Form 1",
    "form2": "Form 2",
    "form3": "Form 3",
    "form4": "Form 4",
}


def discover_topics_from_books(subject_folder: Path) -> list[str]:
    """Extract topic names from book PDF table of contents or chapter headings."""
    pdfs = list(subject_folder.glob("*.pdf"))
    if not pdfs:
        return []

    import fitz
    candidates = []
    for pdf_path in pdfs[:2]:
        doc = fitz.open(str(pdf_path))
        for page in doc:
            blocks = page.get_text("dict")["blocks"]
            for block in blocks:
                if "lines" not in block:
                    continue
                for line in block["lines"]:
                    for span in line["spans"]:
                        text = span["text"].strip()
                        if not (3 < len(text) < 50):
                            continue
                        # Must be bold and start with a number (chapter/section heading)
                        if "Bold" not in span["font"]:
                            continue
                        if not re.match(r"^\d+[\.\s)]", text):
                            continue
                        cleaned = re.sub(r"^\d+[\.\)]\s*", "", text).strip().rstrip(".,:;")
                        if cleaned and cleaned not in candidates:
                            candidates.append(cleaned)
        doc.close()

    seen = set()
    unique = []
    for c in candidates:
        low = c.lower()
        if low not in seen:
            seen.add(low)
            unique.append(c)

    return unique[:10]


def run_pipeline():
    for form_folder in sorted(BOOKS_ROOT.glob("form*")):
        folder_name = form_folder.name
        form_level = FORM_LABELS.get(folder_name, folder_name)

        for subject_folder in form_folder.iterdir():
            if not subject_folder.is_dir():
                continue
            subject = subject_folder.name

            print(f"\nProcessing {form_level}/{subject}")
            db = SessionLocal()
            try:
                syllabus_path = subject_folder / "syllabus.pdf"
                topics = []

                if syllabus_path.exists():
                    topics = ingest_syllabus(syllabus_path, subject, form_level, db)
                else:
                    # No syllabus — use subject name as the only topic
                    # All chunks get tagged with the subject; semantic search handles relevance
                    print(f"  No syllabus.pdf found — using subject name as topic")
                    db.add(CurriculumTopic(
                        form_level=form_level,
                        subject=subject,
                        topic=subject,
                        order_number=0,
                    ))
                    db.commit()
                    topics = [subject]

                for book_path in subject_folder.glob("*.pdf"):
                    if book_path.name == "syllabus.pdf" or book_path.name == "syllabus_fixed.pdf":
                        continue
                    try:
                        ingest_textbook(book_path, subject, form_level, topics, db)
                    except Exception as e:
                        # Don't let one book's failure kill the whole pipeline —
                        # move on to the next book/subject; rerun later to resume this one.
                        print(f"  ERROR processing {book_path.name}: {e}")
                        continue
            finally:
                db.close()


if __name__ == "__main__":
    run_pipeline()