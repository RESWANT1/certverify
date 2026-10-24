import datetime
import os

from fastapi import FastAPI, HTTPException
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import Column, Date, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cert:cert@localhost:5432/certdb")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
Session = sessionmaker(bind=engine)
Base = declarative_base()


class Certificate(Base):
    __tablename__ = "certificates"
    id = Column(String, primary_key=True)
    student_name = Column(String, nullable=False)
    course = Column(String, nullable=False)
    issued_on = Column(Date, nullable=False)


app = FastAPI(title="Verification Service")
Instrumentator().instrument(app).expose(app)


@app.on_event("startup")
def startup():
    try:
        Base.metadata.create_all(engine)
    except Exception as e:
        print(f"Warning: Database connection deferred at startup: {e}")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/verify/{cert_id}")
def verify(cert_id: str):
    with Session() as db:
        cert = db.get(Certificate, cert_id.strip().upper())
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return {"valid": True, "id": cert.id, "student_name": cert.student_name,
            "course": cert.course, "issued_on": str(cert.issued_on)}
