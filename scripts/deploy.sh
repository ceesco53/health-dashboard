#!/usr/bin/env bash
set -euo pipefail

IMAGE="ghcr.io/ceesco53/health-dashboard"
TAG="${1:-latest}"

echo "→ Building $IMAGE:$TAG (linux/amd64)"
docker buildx build \
  --platform linux/amd64 \
  -t "$IMAGE:$TAG" \
  --push \
  .

echo "→ Applying k8s manifests"
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

echo "→ Rolling restart"
kubectl rollout restart deployment/health-dashboard -n health
kubectl rollout status deployment/health-dashboard -n health

echo "✓ Deployed — https://health.ingress.realmclick.com"
