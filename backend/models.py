from sqlalchemy import Column, Integer, String
from database import engine
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)


class Ward(Base):
    __tablename__ = "wards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    city = Column(String, nullable=False)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, nullable=False, default="reported")


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)

    complaint_id = Column(
        String,
        unique=True,
        nullable=False
    )

    user_id = Column(
        Integer,
        nullable=False
    )

    title = Column(
        String,
        nullable=False
    )

    description = Column(
        String,
        nullable=True
    )

    latitude = Column(
        String,
        nullable=False
    )

    longitude = Column(
        String,
        nullable=False
    )

    waste_type = Column(
        String,
        nullable=True
    )

    photo_url = Column(
        String,
        nullable=True
    )

    status = Column(
        String,
        nullable=False,
        default="open"
    )

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(String, nullable=False)
    assigned_to = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="assigned")

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(String, nullable=False)
    comment = Column(String, nullable=True)
    status = Column(String, nullable=False)

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    action = Column(String, nullable=False)
    details = Column(String, nullable=True)

Base.metadata.create_all(bind=engine)

print("Database tables created successfully!")