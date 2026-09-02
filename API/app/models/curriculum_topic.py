from sqlalchemy import Column, Integer, String, Text
from app.db.database import Base


class CurriculumTopic(Base):

    __tablename__ = "curriculum_topics"


    id = Column(Integer,primary_key=True,index=True)
    form_level = Column(String,nullable=False)
    subject = Column(String,nullable=False)
    topic = Column(String,nullable=False,index=True)
    sub_topic = Column(String,nullable=True)
    learning_objective = Column(Text,nullable=True)
    term = Column(String,nullable=True)
    order_number = Column(Integer,nullable=True)