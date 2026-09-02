from sqlalchemy import Column, Integer, String, Text, DateTime
from pgvector.sqlalchemy import Vector
from datetime import datetime
from app.db.database import Base



class KnowledgeChunk(Base):

    __tablename__ = "knowledge_chunks"


    id = Column(Integer,primary_key=True,index=True)
    subject = Column(String,nullable=False)
    form_level = Column(String,nullable=False)
    topic = Column(String,index=True,nullable=False)
    source_book = Column(String,nullable=False)
    page_number = Column(Integer,nullable=True)
    content = Column(Text,nullable=False)
    embedding = Column(Vector(384),nullable=False)
    created_at = Column(DateTime,default=datetime.utcnow)