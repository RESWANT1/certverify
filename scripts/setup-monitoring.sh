#!/bin/bash
set -e
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

echo "=== Adding Prometheus Community Helm Repo ==="
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

echo "=== Installing kube-prometheus-stack ==="
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace

echo "=== Checking Monitoring Pods ==="
kubectl -n monitoring get pods

echo "=== Grafana Admin Password ==="
kubectl -n monitoring get secret monitoring-grafana -o jsonpath="{.data.admin-password}" | base64 -d
echo ""
