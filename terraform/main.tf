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
  type    = string
  default = "ap-south-1"
}

variable "instance_type" {
  type    = string
  default = "t3.medium"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "public_key_path" {
  type = string
}

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
  name        = "certverify-k3s"
  description = "Security group for k3s EC2 node"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Frontend NodePort access"
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
  name        = "certverify-db"
  description = "Security group for PostgreSQL RDS instance"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "PostgreSQL from k3s EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.k3s.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
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
  value       = aws_instance.k3s.public_ip
  description = "Public IP address of the EC2 instance running k3s"
}

output "rds_endpoint" {
  value       = aws_db_instance.db.address
  description = "Hostname endpoint of the RDS PostgreSQL database"
}
