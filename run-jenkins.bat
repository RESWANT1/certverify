@echo off
echo ==============================================================
echo             Launching Jenkins CI Server in Docker             
echo ==============================================================
echo.

docker compose -f docker-compose.jenkins.yml up -d --build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to start Jenkins. Make sure Docker Desktop is running!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Jenkins is starting up on: http://localhost:8088
echo Waiting 15 seconds for Jenkins to generate the admin password...
timeout /t 15 > nul

echo.
echo ==============================================================
echo   YOUR INITIAL JENKINS ADMIN PASSWORD:
echo ==============================================================
docker exec jenkins-ci cat /var/jenkins_home/secrets/initialAdminPassword 2>nul || echo (Please wait another 10s and check Docker logs for password)
echo ==============================================================
echo.
echo Opening Jenkins in your browser...
start http://localhost:8088
pause

