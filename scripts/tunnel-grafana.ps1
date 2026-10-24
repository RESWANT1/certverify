# Helper script to tunnel Grafana port 3000 to local machine
param (
    [Parameter(Mandatory=$true)]
    [string]$Ec2PublicIp,
    [string]$KeyPath = "$HOME\.ssh\certverify"
)

Write-Host "Opening SSH Tunnel for Grafana to $Ec2PublicIp on local port 3000..." -ForegroundColor Cyan
Write-Host "In the remote shell, run:" -ForegroundColor Yellow
Write-Host "  export KUBECONFIG=/etc/rancher/k3s/k3s.yaml" -ForegroundColor Green
Write-Host "  kubectl -n monitoring port-forward svc/monitoring-grafana 3000:80" -ForegroundColor Green
Write-Host "Then open http://localhost:3000 in your browser and log in as admin." -ForegroundColor Yellow

ssh -i $KeyPath -L 3000:localhost:3000 ubuntu@$Ec2PublicIp
