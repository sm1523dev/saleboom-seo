#!/usr/bin/env bash
# Encrypt the tunnel token → sealed-secret.yaml.
# Run once (or after rotating the token). Commit sealed-secret.yaml; never commit the raw token.
set -euo pipefail

export KUBECONFIG="$HOME/.kube/kubepi"

DIR="$(cd "$(dirname "$0")" && pwd)"

TUNNEL_TOKEN="eyJhIjoiZDZjNzFjM2IxM2UxYTE4NmM0ZTU2ZGFhNWI5MzhkYjIiLCJ0IjoiMTIyYmQ2ZDEtM2Q0Ny00NGZhLWJmMGMtYjFmOTU3MTU3Y2ZkIiwicyI6ImhtQ0hMaHRRdk5ucW9RQW1KRlJvTzVGQW9uelFhdWp4dWV4MzJmbGtLUmM9In0="

kubectl create secret generic tunnel-token \
  --namespace cloudflared \
  --from-literal=token="$TUNNEL_TOKEN" \
  --dry-run=client -o yaml \
  | kubeseal \
      --controller-name=sealed-secrets-controller \
      --controller-namespace=kube-system \
      --format yaml \
  > "$DIR/sealed-secret.yaml"

echo "k8s/cloudflared/sealed-secret.yaml written — safe to commit to git."
