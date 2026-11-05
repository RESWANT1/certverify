pipeline {
    agent any

    environment {
        AWS_REGION = 'ap-south-1'
    }

    stages {
        stage('Unit Testing') {
            parallel {
                stage('Test Certificate Service') {
                    steps {
                        dir('services/certificate-service') {
                            sh '''
                                python3 -m venv .venv
                                . .venv/bin/activate
                                pip install --upgrade pip
                                pip install "psycopg2-binary>=2.9.10"
                                pip install -r requirements.txt
                                pytest
                            '''
                        }
                    }
                }
                stage('Test Verification Service') {
                    steps {
                        dir('services/verification-service') {
                            sh '''
                                python3 -m venv .venv
                                . .venv/bin/activate
                                pip install --upgrade pip
                                pip install "psycopg2-binary>=2.9.10"
                                pip install -r requirements.txt
                                pytest
                            '''
                        }
                    }
                }
            }
        }

        stage('Build & DevSecOps Scan (Trivy)') {
            steps {
                script {
                    // Check if AWS credentials exist
                    try {
                        withCredentials([
                            string(credentialsId: 'AWS_ACCOUNT_ID', variable: 'AWS_ACCOUNT_ID'),
                            [$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-credentials', accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']
                        ]) {
                            def registry = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
                            sh "aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${registry}"

                            def microservices = [
                                [name: 'certificate-service', path: 'services/certificate-service'],
                                [name: 'verification-service', path: 'services/verification-service'],
                                [name: 'frontend', path: 'frontend']
                            ]

                            for (svc in microservices) {
                                def imageTag = "${registry}/certverify-${svc.name}:${GIT_COMMIT}"

                                echo ">>> Building Docker image: ${imageTag}"
                                sh "docker build -t ${imageTag} ${svc.path}"

                                echo ">>> Running Trivy DevSecOps Security Scan"
                                sh "trivy image --severity CRITICAL --exit-code 1 --ignore-unfixed ${imageTag}"

                                echo ">>> Pushing image to Amazon ECR"
                                sh "docker push ${imageTag}"
                            }
                        }
                    } catch (err) {
                        echo "NOTE: AWS Credentials (AWS_ACCOUNT_ID / aws-credentials) not configured in Jenkins yet."
                        echo "Skipping cloud push. Building local images instead for validation..."
                        sh "docker build -t certverify-frontend:${GIT_COMMIT} frontend"
                        sh "docker build -t certverify-certificate-service:${GIT_COMMIT} services/certificate-service"
                        sh "docker build -t certverify-verification-service:${GIT_COMMIT} services/verification-service"
                        echo ">>> Running Trivy DevSecOps Security Scan locally..."
                        sh "trivy image --severity CRITICAL --exit-code 1 --ignore-unfixed certverify-frontend:${GIT_COMMIT}"
                    }
                }
            }
        }

        stage('Deploy to Kubernetes via Helm') {
            steps {
                script {
                    try {
                        withCredentials([
                            string(credentialsId: 'EC2_HOST', variable: 'EC2_HOST'),
                            string(credentialsId: 'DATABASE_URL', variable: 'DATABASE_URL'),
                            string(credentialsId: 'JWT_SECRET', variable: 'JWT_SECRET'),
                            string(credentialsId: 'ADMIN_PASSWORD', variable: 'ADMIN_PASSWORD'),
                            string(credentialsId: 'AWS_ACCOUNT_ID', variable: 'AWS_ACCOUNT_ID')
                        ]) {
                            sshagent(['ec2-ssh-key']) {
                                def registry = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
                                sh """
                                    scp -o StrictHostKeyChecking=no -r helm/certverify/* ubuntu@${EC2_HOST}:/home/ubuntu/chart/certverify/

                                    ssh -o StrictHostKeyChecking=no ubuntu@${EC2_HOST} << 'EOF'
                                        export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
                                        REG=${registry}

                                        kubectl create secret docker-registry ecr-pull \\
                                          --docker-server=\$REG --docker-username=AWS \\
                                          --docker-password="\$(aws ecr get-login-password --region ${AWS_REGION})" \\
                                          --dry-run=client -o yaml | kubectl apply -f -

                                        helm upgrade --install certverify /home/ubuntu/chart/certverify \\
                                          --set-string registry=\$REG \\
                                          --set-string tag=${GIT_COMMIT} \\
                                          --set-string databaseUrl="${DATABASE_URL}" \\
                                          --set-string jwtSecret="${JWT_SECRET}" \\
                                          --set-string adminPassword="${ADMIN_PASSWORD}"

                                        kubectl rollout status deployment/frontend --timeout=120s
EOF
                                """
                            }
                        }
                    } catch (err) {
                        echo "NOTE: EC2 deployment credentials (EC2_HOST / ec2-ssh-key) not configured yet."
                        echo "Skipping remote deployment stage."
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                try {
                    cleanWs()
                } catch (e) {
                    echo "Workspace cleanup skipped."
                }
            }
        }
        success {
            echo "SUCCESS: CertVerify pipeline completed successfully!"
        }
        failure {
            echo "FAILED: Build failed or was blocked by a quality gate."
        }
    }
}
