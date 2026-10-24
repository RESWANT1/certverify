import datetime
import os
import uuid

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel
from sqlalchemy import Column, Date, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cert:cert@localhost:5432/certdb")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
Session = sessionmaker(bind=engine)
Base = declarative_base()


class Certificate(Base):
    __tablename__ = "certificates"
    id = Column(String, primary_key=True)
    student_name = Column(String, nullable=False)
    course = Column(String, nullable=False)
    issued_on = Column(Date, nullable=False)


app = FastAPI(title="Certificate Service")
Instrumentator().instrument(app).expose(app)
oauth2 = OAuth2PasswordBearer(tokenUrl="login")


@app.on_event("startup")
def startup():
    try:
        Base.metadata.create_all(engine)
    except Exception as e:
        print(f"Warning: Database connection deferred at startup: {e}")


class CertIn(BaseModel):
    student_name: str
    course: str


def current_user(token: str = Depends(oauth2)) -> str:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    if form.username != ADMIN_USER or form.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    expiry = datetime.datetime.utcnow() + datetime.timedelta(hours=2)
    token = jwt.encode({"sub": form.username, "exp": expiry}, JWT_SECRET, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer"}


@app.post("/certificates", status_code=201)
def issue(data: CertIn, user: str = Depends(current_user)):
    cert_id = "CERT-" + uuid.uuid4().hex[:8].upper()
    with Session() as db:
        db.add(Certificate(id=cert_id, student_name=data.student_name,
                           course=data.course, issued_on=datetime.date.today()))
        db.commit()
    return {"id": cert_id}
