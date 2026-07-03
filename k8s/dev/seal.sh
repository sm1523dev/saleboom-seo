#!/usr/bin/env bash
# Encrypt secrets.yaml → sealed-secret.yaml using the Pi cluster's public cert.
# Run this whenever you change secrets.yaml. Commit sealed-secret.yaml; never commit secrets.yaml.
set -euo pipefail

export KUBECONFIG="$HOME/.kube/kubepi"

DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$DIR/secrets.yaml" ]; then
  echo "Error: $DIR/secrets.yaml not found."
  echo "Copy secrets.yaml.example to secrets.yaml, fill in values, then re-run."
  exit 1
fi

kubeseal \
  --controller-name=sealed-secrets-controller \
  --controller-namespace=kube-system \
  --format yaml \
  < "$DIR/secrets.yaml" \
  > "$DIR/sealed-secret.yaml"

echo "sealed-secret.yaml written — safe to commit to git."
