from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_issue_requires_login():
    r = client.post("/certificates", json={"student_name": "A", "course": "B"})
    assert r.status_code == 401
