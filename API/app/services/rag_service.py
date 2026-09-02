from sqlalchemy.orm import Session
from app.models.knowledge_chunk import KnowledgeChunk
from app.services.embedding_service import generate_embedding


def retrieve_relevant_chunks(
    db: Session, query: str, subject: str, form_level: str,
    topic: str | None = None, top_k: int = 5
):
    query_embedding = generate_embedding(query)

    q = db.query(KnowledgeChunk).filter(
        KnowledgeChunk.subject == subject,
        KnowledgeChunk.form_level == form_level,
    )
    if topic:
        q = q.filter(KnowledgeChunk.topic == topic)

    results = (
        q.order_by(KnowledgeChunk.embedding.cosine_distance(query_embedding))
        .limit(top_k)
        .all()
    )

    return [r.content for r in results]