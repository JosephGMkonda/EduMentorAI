from app.db.database import Base, engine
from app.models.knowledge_chunk import KnowledgeChunk
from app.models.curriculum_topic import CurriculumTopic


def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully")

if __name__ == "__main__":
    init_db()