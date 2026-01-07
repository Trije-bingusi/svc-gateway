#!/usr/bin/env bash
# =====================================================================
# Script: deploy.sh
# Description: Deploys the svc-gateway application to Kubernetes,
#              retrieving configuration from the Key Vault identified
#              by the KEYVAULT_NAME env variable. The image to deploy
#              should be passed as a positional argument.
# Usage: ./scripts/deploy/deploy.sh <image>
# =====================================================================

set -euo pipefail

# Retrieve image
IMAGE="$1"
if [[ -z "$IMAGE" ]]; then
  echo "Usage: $0 <image>" >&2
  exit 1
fi

# Retrieve configuration from the Key Vault
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/config.sh"
RG_NAME=$(get_secret "rg-name")
AKS_NAME=$(get_secret "aks-name")

# Authenticate to the AKS cluster
source "$SCRIPT_DIR/../utils/authenticate.sh"

# Deploy or upgrade the Helm chart
echo "Deploying Helm chart to namespace '$K8S_NAMESPACE' with image '$IMAGE'"
helm upgrade --install "$RELEASE_NAME" ./helm \
  --namespace "$K8S_NAMESPACE" \
  --values ./helm/values.yaml \
  --values "$VALUES_FILE" \
  --set image="$IMAGE" \
  --wait --timeout 5m
