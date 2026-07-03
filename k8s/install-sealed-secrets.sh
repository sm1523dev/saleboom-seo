#!/usr/bin/env bash
# Install Sealed Secrets controller on Pi k3s + kubeseal CLI on this Mac.
# Run once. After this, seal.sh scripts can encrypt secrets.
set -euo pipefail

export KUBECONFIG="$HOME/.kube/kubepi"

SEALED_SECRETS_VERSION="v0.28.0"

echo "==> Installing Sealed Secrets controller on Pi k3s..."
kubectl apply -f "https://github.com/bitnami-labs/sealed-secrets/releases/download/${SEALED_SECRETS_VERSION}/controller.yaml"

echo "==> Waiting for controller to be ready..."
kubectl rollout status deployment/sealed-secrets-controller -n kube-system --timeout=120s

echo "==> Installing kubeseal CLI on this Mac..."
brew install kubeseal

echo ""
echo "Done. Run the seal.sh scripts in k8s/app/ and k8s/cloudflared/ to encrypt secrets."
