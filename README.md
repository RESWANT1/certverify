# CertVerify

**Cloud-Native DevOps Deployment of a Certificate Issuance and Verification Platform on AWS**

CertVerify is a full-stack web application where an admin issues digital certificates and anyone can verify them by ID. The application is small on purpose. The focus of the project is the DevOps system around it: every `git push` is automatically tested, scanned, containerized, deployed to Kubernetes on AWS, and monitored.

---

## 1. Features

**Application**
- Admin login (JWT)
- Issue a certificate (student name + course) and receive a unique ID such as `CERT-7F3A91BC`
- Public page to verify a certificate by ID
- Two backend microservices, a React frontend and a PostgreSQL database

**DevOps**
- CI/CD with GitHub Actions: test, build, scan, push, deploy
- Security gate: Trivy blocks the deployment on HIGH or CRITICAL vulnerabilities
- Infrastructure as Code with Terraform
- Kubernetes (k3s) deployed with Helm
- Monitoring with Prometheus and Grafana

---

## 2. Architecture

```
Developer -> GitHub -> GitHub Actions
                         |- pytest (tests)
                         |- docker build
                         |- Trivy scan (fails on HIGH/CRITICAL)
                         |- push images -> Amazon ECR
                         '- SSH deploy -> helm upgrade
                                              |
Terraform builds:                             v
  VPC (default), EC2, RDS, ECR, S3, IAM   +----------------------------+
                                          |  EC2 (k3s Kubernetes)      |
User -> http://<EC2-IP>:30080 ----------> |  frontend (React + Nginx)  |
                                          |    |- /api/certs  -> certificate-service
                                          |    '- /api/verify -> verification-service
                                          |  Prometheus + Grafana      |
                                          +-------------+--------------+
                                                        |
                                                  RDS PostgreSQL
```

### Microservices

| Service | Responsibility | Endpoints |
|---|---|---|
| `certificate-service` | Admin login and issuing certificates | `POST /login`, `POST /certificates`, `GET /health` |
| `verification-service` | Public lookup of a certificate | `GET /verify/{id}`, `GET /health` |
| `frontend` | React UI served by Nginx, which also proxies `/api/*` to the services | - |

---

## 3. Tech stack

| Layer | Tools |
|---|---|
| Frontend | React (Vite), Nginx |
| Backend | Python 3.12, FastAPI, SQLAlchemy |
| Database | PostgreSQL 16 (RDS in the cloud) |
| Source control and CI/CD | Git, GitHub, GitHub Actions |
| Containers | Docker, Docker Compose |
| Security scanning | Trivy (SonarCloud optional) |
| Infrastructure as Code | Terraform |
| Orchestration | Kubernetes (k3s), Helm |
| Monitoring | Prometheus, Grafana |
| AWS services | EC2, ECR, RDS, S3, IAM, VPC, security groups |

---

## 4. Folder structure

```
certverify/
├── .github/workflows/ci-cd.yml
├── services/
│   ├── certificate-service/
│   │   ├── app/__init__.py
│   │   ├── app/main.py
│   │   ├── tests/test_health.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── verification-service/      (same layout)
├── frontend/
│   ├── src/App.jsx                (plus the rest of the Vite scaffold)
│   ├── nginx.conf
│   └── Dockerfile
├── helm/certverify/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── app.yaml
│       └── secret.yaml
├── terraform/
│   ├── main.tf
│   └── install-k3s.sh
├── docker-compose.yml
└── README.md
```

---

## 5. Prerequisites (Windows)

Install and verify each tool:

| Tool | Install | Check |
|---|---|---|
| WSL2 | `wsl --install` (restart afterwards) | - |
| Docker Desktop | docker.com (use the WSL 2 engine) | `docker --version` |
| Git | git-scm.com | `git --version` |
| VS Code | code.visualstudio.com | - |
| Python 3.12 | python.org (tick "Add to PATH") | `python --version` |
| Node.js LTS | nodejs.org | `node --version` |
| AWS CLI | AWS website (MSI installer) | `aws --version` |
| Terraform | `winget install Hashicorp.Terraform` | `terraform --version` |

kubectl and Helm are only needed on the EC2 server (k3s provides kubectl, and the install script adds Helm), so you can skip them locally.

Connect your terminal to AWS (create an IAM user and access key in the console first):

```powershell
aws configure
aws sts get-caller-identity
```

Also set an **AWS Budget alert** of $5-10 in the console before creating anything.

---

## 6. Phase 1: Build the application locally

Run all commands from the `certverify` project folder (use the terminal inside VS Code).

```powershell
mkdir certverify
cd certverify
git init
mkdir services\certificate-service\app, services\certificate-service\tests
mkdir services\verification-service\app, services\verification-service\tests
```

### 6.1 certificate-service

`services/certificate-service/requirements.txt`

```
fastapi==0.115.0
uvicorn==0.30.6
sqlalchemy==2.0.35
psycopg2-binary==2.9.9
python-jose==3.3.0
python-multipart==0.0.9
prometheus-fastapi-instrumentator==7.0.0
pytest==8.3.3
httpx==0.27.2
```

Create an empty `app/__init__.py`, then `app/main.py`:

```python
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
    Base.metadata.create_all(engine)


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
```

`tests/test_health.py`

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_issue_requires_login():
    r = client.post("/certificates", json={"student_name": "A", "course": "B"})
    assert r.status_code == 401
```

`Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 6.2 verification-service

Use the same `requirements.txt`, `Dockerfile`, empty `app/__init__.py`, and a `tests/test_health.py` containing only the first test. Its `app/main.py`:

```python
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
    Base.metadata.create_all(engine)


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
```

Run the tests for each service:

```powershell
cd services\certificate-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m pytest
deactivate
cd ..\..
```

### 6.3 Frontend

```powershell
npm create vite@latest frontend -- --template react
cd frontend
npm install
cd ..
```

Replace `frontend/src/App.jsx` with:

```jsx
import { useState } from "react";

export default function App() {
  const [token, setToken] = useState("");
  const [login, setLogin] = useState({ username: "admin", password: "" });
  const [form, setForm] = useState({ student_name: "", course: "" });
  const [issued, setIssued] = useState(null);
  const [verifyId, setVerifyId] = useState("");
  const [result, setResult] = useState(null);

  async function doLogin() {
    const res = await fetch("/api/certs/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(login),
    });
    if (res.ok) setToken((await res.json()).access_token);
    else alert("Login failed");
  }

  async function issue() {
    const res = await fetch("/api/certs/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    setIssued(await res.json());
  }

  async function verify() {
    const res = await fetch(`/api/verify/${verifyId}`);
    setResult(res.ok ? await res.json() : { valid: false });
  }

  return (
    <div style={{ maxWidth: 520, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>CertVerify</h1>

      <h2>Verify a certificate</h2>
      <input placeholder="CERT-XXXXXXXX" value={verifyId} onChange={(e) => setVerifyId(e.target.value)} />
      <button onClick={verify}>Verify</button>
      {result && (
        <p>
          {result.valid
            ? `Valid: ${result.student_name}, ${result.course}, issued ${result.issued_on}`
            : "Certificate not found"}
        </p>
      )}

      <h2>Admin</h2>
      {!token ? (
        <>
          <input placeholder="username" value={login.username}
                 onChange={(e) => setLogin({ ...login, username: e.target.value })} />
          <input type="password" placeholder="password"
                 onChange={(e) => setLogin({ ...login, password: e.target.value })} />
          <button onClick={doLogin}>Login</button>
        </>
      ) : (
        <>
          <input placeholder="Student name"
                 onChange={(e) => setForm({ ...form, student_name: e.target.value })} />
          <input placeholder="Course"
                 onChange={(e) => setForm({ ...form, course: e.target.value })} />
          <button onClick={issue}>Issue certificate</button>
          {issued && <p>Issued: <b>{issued.id}</b></p>}
        </>
      )}
    </div>
  );
}
```

`frontend/nginx.conf`

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri /index.html;
  }
  location /api/certs/ {
    proxy_pass http://certificate-service:8000/;
  }
  location /api/verify/ {
    proxy_pass http://verification-service:8000/verify/;
  }
}
```

`frontend/Dockerfile`

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

Add a `frontend/.dockerignore` containing `node_modules` and `dist`.

---

## 7. Phase 2: Run everything with Docker Compose

`docker-compose.yml` (project root)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: cert
      POSTGRES_PASSWORD: cert
      POSTGRES_DB: certdb
    volumes:
      - dbdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cert -d certdb"]
      interval: 5s
      retries: 10

  certificate-service:
    build: ./services/certificate-service
    environment:
      DATABASE_URL: postgresql://cert:cert@db:5432/certdb
      JWT_SECRET: dev-secret
      ADMIN_PASSWORD: admin123
    depends_on:
      db:
        condition: service_healthy

  verification-service:
    build: ./services/verification-service
    environment:
      DATABASE_URL: postgresql://cert:cert@db:5432/certdb
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports:
      - "8080:80"
    depends_on:
      - certificate-service
      - verification-service

volumes:
  dbdata:
```

```powershell
docker compose up --build
```

Open <http://localhost:8080>. Log in as `admin` / `admin123`, issue a certificate, copy the ID and verify it. **Do not move on until this works.**

Stop with `Ctrl+C`, then `docker compose down`.

---

## 8. Phase 3: GitHub and the CI pipeline

1. Create an empty repository named `certverify` on GitHub.
2. Add a `.gitignore` containing `node_modules`, `dist`, `.venv`, `__pycache__`, `.terraform`, `*.tfstate*`, `*.tfvars`.
3. Push the code:

```powershell
git add .
git commit -m "Initial CertVerify app"
git branch -M main
git remote add origin https://github.com/<your-username>/certverify.git
git push -u origin main
```

You will add the pipeline file in Phase 5, once AWS exists. If you want to test CI first, use only the `test` job from the workflow below.

---

## 9. Phase 4: Create the AWS infrastructure with Terraform

### 9.1 SSH key and manual IAM user

```powershell
ssh-keygen -t ed25519 -f $HOME\.ssh\certverify
```

In the AWS console, create an IAM user `github-actions` with the managed policy `AmazonEC2ContainerRegistryPowerUser` and generate an access key for it. The pipeline uses it to push images. (For a production setup you would replace this with GitHub OIDC.)

### 9.2 `terraform/install-k3s.sh`

```bash
#!/bin/bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--write-kubeconfig-mode 644" sh -
snap install aws-cli --classic
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 9.3 `terraform/main.tf`

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  default = "ap-south-1"
}
variable "instance_type" {
  default = "t3.medium"
}
variable "db_password" {
  sensitive = true
}
variable "public_key_path" {}

data "aws_caller_identity" "me" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

resource "aws_ecr_repository" "repos" {
  for_each     = toset(["certificate-service", "verification-service", "frontend"])
  name         = "certverify-${each.key}"
  force_delete = true
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_s3_bucket" "certs" {
  bucket        = "certverify-files-${data.aws_caller_identity.me.account_id}"
  force_destroy = true
}

resource "aws_security_group" "k3s" {
  name   = "certverify-k3s"
  vpc_id = data.aws_vpc.default.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 30080
    to_port     = 30080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "db" {
  name   = "certverify-db"
  vpc_id = data.aws_vpc.default.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.k3s.id]
  }
}

resource "aws_iam_role" "ec2" {
  name = "certverify-ec2"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecr_read" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_instance_profile" "ec2" {
  name = "certverify-ec2"
  role = aws_iam_role.ec2.name
}

resource "aws_db_instance" "db" {
  identifier             = "certverify-db"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  db_name                = "certdb"
  username               = "certadmin"
  password               = var.db_password
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  skip_final_snapshot    = true
}

resource "aws_key_pair" "key" {
  key_name   = "certverify"
  public_key = file(var.public_key_path)
}

resource "aws_instance" "k3s" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.key.key_name
  vpc_security_group_ids = [aws_security_group.k3s.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  user_data              = file("${path.module}/install-k3s.sh")

  root_block_device {
    volume_size = 30
  }
  tags = {
    Name = "certverify-k3s"
  }
}

output "ec2_public_ip" {
  value = aws_instance.k3s.public_ip
}
output "rds_endpoint" {
  value = aws_db_instance.db.address
}
```

### 9.4 Apply

Create `terraform/terraform.tfvars` (never commit it):

```hcl
db_password     = "ChangeMe12345"
public_key_path = "C:/Users/<your-name>/.ssh/certverify.pub"
```

```powershell
cd terraform
terraform init
terraform plan
terraform apply
```

Note the outputs `ec2_public_ip` and `rds_endpoint`. Wait 3-5 minutes after the instance starts, then check that the server is ready:

```powershell
ssh -i $HOME\.ssh\certverify ubuntu@<EC2_PUBLIC_IP>
kubectl get nodes
helm version
```

If `kubectl` or `helm` is not found yet, the startup script is still running. Wait and retry.

---

## 10. Phase 5: CI/CD pipeline and Helm deployment

### 10.1 Helm chart

`helm/certverify/Chart.yaml`

```yaml
apiVersion: v2
name: certverify
version: 0.1.0
appVersion: "1.0"
```

`helm/certverify/values.yaml`

```yaml
registry: ""
tag: latest
imagePullSecret: ecr-pull
databaseUrl: ""
jwtSecret: ""
adminUser: admin
adminPassword: ""
services:
  - name: certificate-service
    port: 8000
    backend: true
  - name: verification-service
    port: 8000
    backend: true
  - name: frontend
    port: 80
    nodePort: 30080
```

`helm/certverify/templates/secret.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: certverify-secrets
type: Opaque
stringData:
  DATABASE_URL: {{ .Values.databaseUrl | quote }}
  JWT_SECRET: {{ .Values.jwtSecret | quote }}
  ADMIN_USER: {{ .Values.adminUser | quote }}
  ADMIN_PASSWORD: {{ .Values.adminPassword | quote }}
```

`helm/certverify/templates/app.yaml`

```yaml
{{- range .Values.services }}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .name }}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {{ .name }}
  template:
    metadata:
      labels:
        app: {{ .name }}
    spec:
      imagePullSecrets:
        - name: {{ $.Values.imagePullSecret }}
      containers:
        - name: {{ .name }}
          image: {{ $.Values.registry }}/certverify-{{ .name }}:{{ $.Values.tag }}
          ports:
            - containerPort: {{ .port }}
          {{- if .backend }}
          envFrom:
            - secretRef:
                name: certverify-secrets
          readinessProbe:
            httpGet:
              path: /health
              port: {{ .port }}
          {{- end }}
---
apiVersion: v1
kind: Service
metadata:
  name: {{ .name }}
spec:
  {{- if .nodePort }}
  type: NodePort
  {{- end }}
  selector:
    app: {{ .name }}
  ports:
    - port: {{ .port }}
      targetPort: {{ .port }}
      {{- if .nodePort }}
      nodePort: {{ .nodePort }}
      {{- end }}
{{- end }}
```

The service names (`certificate-service`, `verification-service`) match the hostnames in `nginx.conf`, so the same frontend image works in Docker Compose and in Kubernetes.

### 10.2 GitHub secrets

In the repository go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Keys of the `github-actions` IAM user |
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID |
| `EC2_HOST` | The `ec2_public_ip` output |
| `EC2_SSH_KEY` | Full contents of `$HOME\.ssh\certverify` (the private key) |
| `DATABASE_URL` | `postgresql://certadmin:ChangeMe12345@<rds_endpoint>:5432/certdb` |
| `JWT_SECRET` | A long random string (letters and digits only) |
| `ADMIN_PASSWORD` | The admin password you want (letters and digits only) |

### 10.3 `.github/workflows/ci-cd.yml`

```yaml
name: ci-cd

on:
  push:
    branches: [main]
  pull_request:

env:
  AWS_REGION: ap-south-1
  REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.ap-south-1.amazonaws.com

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [certificate-service, verification-service]
    defaults:
      run:
        working-directory: services/${{ matrix.service }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
      - run: python -m pytest

  build-scan-push:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - name: certificate-service
            path: services/certificate-service
          - name: verification-service
            path: services/verification-service
          - name: frontend
            path: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      - uses: aws-actions/amazon-ecr-login@v2
      - name: Build image
        run: docker build -t $REGISTRY/certverify-${{ matrix.name }}:${{ github.sha }} ${{ matrix.path }}
      - name: Trivy scan (fails on HIGH/CRITICAL)
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: ${{ env.REGISTRY }}/certverify-${{ matrix.name }}:${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: "1"
          ignore-unfixed: true
      - name: Push image
        run: docker push $REGISTRY/certverify-${{ matrix.name }}:${{ github.sha }}

  deploy:
    needs: build-scan-push
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Copy Helm chart to server
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          source: helm/certverify
          target: /home/ubuntu/chart
          strip_components: 1
      - name: Deploy with Helm
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
            REG=${{ env.REGISTRY }}
            kubectl create secret docker-registry ecr-pull \
              --docker-server=$REG --docker-username=AWS \
              --docker-password="$(aws ecr get-login-password --region ${{ env.AWS_REGION }})" \
              --dry-run=client -o yaml | kubectl apply -f -
            helm upgrade --install certverify /home/ubuntu/chart/certverify \
              --set-string registry=$REG \
              --set-string tag=${{ github.sha }} \
              --set-string databaseUrl="${{ secrets.DATABASE_URL }}" \
              --set-string jwtSecret="${{ secrets.JWT_SECRET }}" \
              --set-string adminPassword="${{ secrets.ADMIN_PASSWORD }}"
            kubectl rollout status deployment/frontend --timeout=120s
```

Push to `main`. Watch the **Actions** tab, then open `http://<EC2_PUBLIC_IP>:30080`. The EC2 instance gets ECR read access from its IAM role, which is why the deploy step can refresh the pull secret. The secret is refreshed on every deploy because ECR tokens expire after 12 hours.

---

## 11. Phase 6: Monitoring with Prometheus and Grafana

SSH into the server:

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
kubectl -n monitoring get pods
```

The full stack needs about 4 GB of memory. If the server becomes slow on `t3.medium`, set `instance_type = "t3.large"` in `terraform.tfvars` and re-apply, or install monitoring only for the demo.

Get the Grafana password:

```bash
kubectl -n monitoring get secret monitoring-grafana -o jsonpath="{.data.admin-password}" | base64 -d
```

Open Grafana from your laptop through an SSH tunnel. In one PowerShell window:

```powershell
ssh -i $HOME\.ssh\certverify -L 3000:localhost:3000 ubuntu@<EC2_PUBLIC_IP>
```

Inside that session run:

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl -n monitoring port-forward svc/monitoring-grafana 3000:80
```

Then open <http://localhost:3000> and log in as `admin`. Use the built-in **Kubernetes / Compute Resources** dashboards to show CPU and memory per pod. Both services also expose `/metrics` (request counts and latency) through the instrumentator; to chart those in Grafana, add a `ServiceMonitor` for each service as an extension.

---

## 12. Demo script

1. **Normal deploy:** change the page heading in `App.jsx`, push, show the green pipeline, then refresh the live site.
2. **Use the app:** log in, issue a certificate, verify the ID. Verify a fake ID to show "not found".
3. **Security gate:** add `pyyaml==5.3` to `services/verification-service/requirements.txt` and push. Trivy should fail the pipeline and nothing gets deployed. Revert the change to restore the pipeline.
4. **Monitoring:** open Grafana and show pod CPU and memory while you click around the site.
5. **Infrastructure as Code:** run `terraform destroy`, then `terraform apply` to show the whole environment rebuilt from code. (After a rebuild, update the `EC2_HOST` and `DATABASE_URL` secrets with the new values.)

---

## 13. Cost control and cleanup

- AWS bills for EC2 and RDS while they run, so check current pricing in the AWS console.
- Run `terraform destroy` at the end of every work session, and `terraform apply` when you restart.
- Confirm the **AWS Budget alert** is active.
- Never commit `terraform.tfvars`, the private SSH key or AWS keys.
- Port 22 is open to the internet in this setup so GitHub Actions can SSH in. Access needs the private key, but restrict or remove the rule after your demo.

---

## 14. Troubleshooting

| Problem | Likely fix |
|---|---|
| `docker compose up` fails on Windows | Make sure Docker Desktop is running with the WSL 2 engine; enable virtualization in BIOS if asked |
| Command "not recognized" | Close and reopen PowerShell, or restart the PC |
| Pipeline fails at Trivy | Read the report: update the vulnerable package or the base image version. Only add exceptions if you can justify them |
| `ImagePullBackOff` in Kubernetes | The ECR pull secret is missing or expired: re-run the deploy job. Check the tag exists in ECR |
| Backend pods crash | `kubectl logs deploy/certificate-service`. Usually the wrong `DATABASE_URL` or the RDS security group |
| Site not reachable on port 30080 | Check the EC2 security group and that the `frontend` service shows `30080` in `kubectl get svc` |
| `kubectl`/`helm` not found on EC2 | The startup script is still running. Check `/var/log/cloud-init-output.log` |
| Terraform error about the AMI or region | Check `region` and that the AMI name filter matches in your region |

---

## 15. Optional extensions (extra marks)

- **SonarCloud:** import the repo on sonarcloud.io, add a `SONAR_TOKEN` secret and a `sonar-project.properties` file, and add the `SonarSource/sonarcloud-github-action` step to the `test` job.
- **QR code and PDF:** use the `qrcode` and `reportlab` libraries in `certificate-service`, store the PDF in the S3 bucket, and return a download link.
- **AWS Secrets Manager:** keep the database password there instead of in GitHub secrets.
- **ArgoCD:** switch the deploy step to GitOps.
- **ServiceMonitor:** scrape the `/metrics` endpoints in Prometheus and build an API dashboard.

---

## 16. Final checklist

- [ ] App runs on `localhost:8080` with Docker Compose
- [ ] Tests pass locally and in GitHub Actions
- [ ] Trivy blocks a vulnerable build
- [ ] Images appear in ECR
- [ ] Terraform creates and destroys the AWS resources
- [ ] Site is live at `http://<EC2_PUBLIC_IP>:30080`
- [ ] Grafana dashboards show live data
- [ ] Screenshots of every stage saved for the report
- [ ] `terraform destroy` run after the demo
