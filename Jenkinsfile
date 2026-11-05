pipeline {
    agent any

    environment {
        AWS_REGION     = 'ap-south-1'
        AWS_ACCOUNT_ID = credentials('AWS_ACCOUNT_ID')
        REGISTRY       = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        EC2_HOST       = credentials('EC2_HOST')
        DATABASE_URL   = credentials('DATABASE_URL')
        JWT_SECRET     = credentials('JWT_SECRET')
        ADMIN_PASSWORD = credentials('ADMIN_PASSWORD')
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
                    withCredentials([[
                        $class: 'AmazonWebServicesCredentialsBinding',
                        credentialsId: 'aws-credentials',
                        accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                        secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                    ]]) {
                        sh "aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${REGISTRY}"

                        def microservices = [
                            [name: 'certificate-service', path: 'services/certificate-service'],
                            [name: 'verification-service', path: 'services/verification-service'],
                            [name: 'frontend', path: 'frontend']
                        ]

                        for (svc in microservices) {
                            def imageTag = "${REGISTRY}/certverify-${svc.name}:${GIT_COMMIT}"

                            echo ">>> Building Docker image: ${imageTag}"
                            sh "docker build -t ${imageTag} ${svc.path}"

                            echo ">>> Running Trivy DevSecOps Security Scan"
                            sh "trivy image --severity CRITICAL --exit-code 1 --ignore-unfixed ${imageTag}"

                            echo ">>> Pushing image to Amazon ECR"
                            sh "docker push ${imageTag}"
                        }
                    }
                }
            }
        }

        stage('Deploy to Kubernetes via Helm') {
            steps {
                sshagent(['ec2-ssh-key']) {
                    sh """
                        # Sync latest Helm chart to the EC2 server
                        scp -o StrictHostKeyChecking=no -r helm/certverify/* ubuntu@${EC2_HOST}:/home/ubuntu/chart/certverify/

                        # Execute rolling Helm deployment on Kubernetes (k3s)
                        ssh -o StrictHostKeyChecking=no ubuntu@${EC2_HOST} << 'EOF'
                            export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
                            REG=${REGISTRY}

                            # Refresh Amazon ECR pull token
                            kubectl create secret docker-registry ecr-pull \\
                              --docker-server=\$REG --docker-username=AWS \\
                              --docker-password="\$(aws ecr get-login-password --region ${AWS_REGION})" \\
                              --dry-run=client -o yaml | kubectl apply -f -

                            # Rolling upgrade via Helm
                            helm upgrade --install certverify /home/ubuntu/chart/certverify \\
                              --set-string registry=\$REG \\
                              --set-string tag=${GIT_COMMIT} \\
                              --set-string databaseUrl="${DATABASE_URL}" \\
                              --set-string jwtSecret="${JWT_SECRET}" \\
                              --set-string adminPassword="${ADMIN_PASSWORD}"

                            # Verify deployment health
                            kubectl rollout status deployment/frontend --timeout=120s
                        EOF
                    """
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo "SUCCESS: CertVerify deployed to Kubernetes on AWS via Jenkins!"
        }
        failure {
            echo "FAILED: Deployment blocked by unit test failure or Trivy security gate."
        }
    }
}

